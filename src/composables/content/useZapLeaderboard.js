import { ref, computed } from 'vue'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { subscribe } from '../../utils/network/subscribe.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { batchFetchProfiles, profileCache } from '../../utils/profile/profileFetcher.js'

export function useZapLeaderboard() {
  const isLoading = ref(false)
  const error = ref('')
  const progress = ref('')

  const rootEvent = ref(null)
  const replies = ref([])
  const allZaps = ref([])
  const leaderboard = ref([])

  // Summary stats
  const totalSats = computed(() => leaderboard.value.reduce((sum, e) => sum + e.totalSats, 0))
  const totalZapCount = computed(() => allZaps.value.length)
  const totalParticipants = computed(() => leaderboard.value.length)
  const replyCount = computed(() => replies.value.length)

  // Step 1: Fetch the root event
  const fetchRootEvent = async (eventId) => {
    progress.value = 'Fetching event...'
    const event = await nostrRelayManager.getEvent({ ids: [eventId] })
    if (!event) throw new Error('Event not found on relays')
    rootEvent.value = event
    return event
  }

  // Step 2: Fetch ALL replies (direct + nested) with recursive pass
  const fetchAllReplies = async (rootEventId) => {
    progress.value = 'Finding comments...'
    const allReplies = new Map()

    // Pass 1: direct replies referencing the root event
    const directReplies = await subscribe(
      [{ kinds: [1], '#e': [rootEventId], limit: 500 }],
      { timeout: 20000, eoseGrace: 3000 }
    )

    for (const r of directReplies) {
      allReplies.set(r.id, r)
    }

    // Pass 2: replies to replies (nested comments that may not tag root)
    if (directReplies.length > 0) {
      progress.value = `Found ${directReplies.length} direct comments, checking nested...`
      const directIds = directReplies.map(r => r.id)

      // Batch in chunks of 50 to avoid oversized filters
      for (let i = 0; i < directIds.length; i += 50) {
        const chunk = directIds.slice(i, i + 50)
        const nested = await subscribe(
          [{ kinds: [1], '#e': chunk, limit: 500 }],
          { timeout: 15000, eoseGrace: 2000 }
        )
        for (const r of nested) {
          allReplies.set(r.id, r)
        }
      }
    }

    return Array.from(allReplies.values())
  }

  // Step 3: Fetch zaps using both #e and #p filters for comprehensive coverage
  const fetchAllZaps = async (eventIds, authorPubkey) => {
    progress.value = `Collecting zaps for ${eventIds.length} events...`
    const allZapEvents = new Map()

    // Strategy A: Zaps by #e tag (event reference) -- primary method
    // Batch in chunks of 50 to avoid oversized filters on relays
    for (let i = 0; i < eventIds.length; i += 50) {
      const chunk = eventIds.slice(i, i + 50)
      const label = eventIds.length > 50
        ? `Collecting zaps (batch ${Math.floor(i / 50) + 1})...`
        : `Collecting zaps for ${eventIds.length} events...`
      progress.value = label

      const events = await subscribe(
        [{ kinds: [9735], '#e': chunk, limit: 2000 }],
        { timeout: 25000, eoseGrace: 3000 }
      )
      for (const e of events) allZapEvents.set(e.id, e)
    }

    // Strategy B: Zaps by #p tag (author pubkey) -- catches zaps indexed
    // differently by some relays. Filter to only relevant event IDs after.
    if (authorPubkey) {
      progress.value = 'Cross-checking zaps by author...'
      const eventIdSet = new Set(eventIds)
      const pTagEvents = await subscribe(
        [{ kinds: [9735], '#p': [authorPubkey], limit: 2000 }],
        { timeout: 20000, eoseGrace: 3000 }
      )
      for (const e of pTagEvents) {
        // Only include if the zap references one of our event IDs
        const eTag = e.tags.find(t => t[0] === 'e')?.[1]
        if (eTag && eventIdSet.has(eTag)) {
          allZapEvents.set(e.id, e)
        }
      }
    }

    return Array.from(allZapEvents.values())
  }

  // Step 4: Aggregate zaps per pubkey and build the leaderboard
  const buildLeaderboard = async (parsedZaps) => {
    progress.value = 'Building leaderboard...'

    const grouped = new Map()
    for (const zap of parsedZaps) {
      if (!grouped.has(zap.zapperPubkey)) {
        grouped.set(zap.zapperPubkey, { totalSats: 0, zapCount: 0, zaps: [] })
      }
      const entry = grouped.get(zap.zapperPubkey)
      entry.totalSats += zap.amount
      entry.zapCount += 1
      entry.zaps.push(zap)
    }

    progress.value = `Loading ${grouped.size} profiles...`
    const pubkeys = Array.from(grouped.keys())
    await batchFetchProfiles(pubkeys)

    const entries = []
    for (const [pubkey, data] of grouped) {
      const cached = profileCache.get(pubkey)
      const profile = cached?.profile || null
      entries.push({
        pubkey,
        name: profile?.name || `user:${pubkey.substring(0, 8)}`,
        picture: profile?.picture || generateAvatar(pubkey),
        nip05: profile?.nip05 || null,
        totalSats: data.totalSats,
        zapCount: data.zapCount,
        zaps: data.zaps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      })
    }

    entries.sort((a, b) => b.totalSats - a.totalSats)
    return entries
  }

  // Main entry point
  const resolveContest = async (eventId) => {
    isLoading.value = true
    error.value = ''
    rootEvent.value = null
    replies.value = []
    allZaps.value = []
    leaderboard.value = []

    try {
      // 1. Fetch root event
      const event = await fetchRootEvent(eventId)
      const authorPubkey = event.pubkey

      // 2. Fetch all replies (direct + nested)
      const foundReplies = await fetchAllReplies(eventId)
      replies.value = foundReplies

      // 3. Fetch all zaps via #e AND #p strategies
      const allEventIds = [eventId, ...foundReplies.map(r => r.id)]
      const zapEvents = await fetchAllZaps(allEventIds, authorPubkey)

      // 4. Parse and deduplicate zap receipts
      const seenZapIds = new Set()
      const parsedZaps = []
      for (const zapEvent of zapEvents) {
        const parsed = parseZapReceipt(zapEvent)
        if (parsed && !seenZapIds.has(parsed.id)) {
          seenZapIds.add(parsed.id)
          parsedZaps.push(parsed)
        }
      }
      allZaps.value = parsedZaps

      // 5. Build leaderboard
      leaderboard.value = await buildLeaderboard(parsedZaps)
      progress.value = ''

    } catch (err) {
      console.error('Contest resolution failed:', err)
      error.value = err.message || 'Failed to resolve contest'
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    isLoading.value = false
    error.value = ''
    progress.value = ''
    rootEvent.value = null
    replies.value = []
    allZaps.value = []
    leaderboard.value = []
  }

  return {
    isLoading,
    error,
    progress,
    rootEvent,
    replies,
    allZaps,
    leaderboard,
    totalSats,
    totalZapCount,
    totalParticipants,
    replyCount,
    resolveContest,
    reset
  }
}
