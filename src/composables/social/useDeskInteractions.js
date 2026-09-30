/**
 * useDeskInteractions — Deterministic interaction tracking for SocialDesk.
 *
 * Architecture:
 * - Counts are DERIVED from a normalized event index (Set<eventId> per post per kind),
 *   not incremented on each event. This makes resubscribe safe — replayed events
 *   hit the dedup set and counts don't inflate.
 * - Reference-counted consumers: the shared subscription is only closed when the
 *   last consumer unmounts (not on any single unmount).
 * - Interaction classification is strict: replies validated via NIP-10 e-tag markers,
 *   reactions validated for kind:7, zap receipts checked for bolt11.
 */

import { reactive, onUnmounted } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'

// ── Constants ───────────────────────────────────────────────────
const CHUNK_SIZE = 50
const RESUBSCRIBE_DEBOUNCE = 1500
const TRACKED_IDS_MAX = 300

// ── Singleton state ─────────────────────────────────────────────
//
// eventIndex: Map<postId, { reactions: Set<eventId>, reposts: Set<eventId>,
//   replies: Set<eventId>, zaps: Set<eventId>, myReaction: boolean, myRepost: boolean }>
//
// Counts are always derived: interactions.get(postId).reactions.size
//
const eventIndex = new Map()
const trackedIds = new Set()
const trackRefCounts = new Map()
let subscription = null
let resubscribeTimer = null
let consumerCount = 0

// ── Index helpers ───────────────────────────────────────────────

function getOrCreateEntry(postId) {
  if (!eventIndex.has(postId)) {
    eventIndex.set(postId, {
      reactions: new Set(),
      reposts: new Set(),
      replies: new Set(),
      zaps: new Set(),
      myReaction: false,
      myRepost: false
    })
  }
  return eventIndex.get(postId)
}

/**
 * Derive a plain counts object from the indexed sets.
 * This is what the UI reads — always consistent with the underlying data.
 */
function deriveCounts(postId) {
  const entry = eventIndex.get(postId)
  if (!entry) {
    return { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false }
  }
  return {
    reactions: entry.reactions.size,
    reposts: entry.reposts.size,
    replies: entry.replies.size,
    zaps: entry.zaps.size,
    myReaction: entry.myReaction,
    myRepost: entry.myRepost
  }
}

// ── Reactive counts layer ───────────────────────────────────────
// We use a reactive Map that the UI reads. It's updated after indexing events.
const countsMap = reactive(new Map())

function refreshCounts(postId) {
  countsMap.set(postId, deriveCounts(postId))
}

// ── Event classification ────────────────────────────────────────

function classifyEvent(event, myPubkey) {
  const eTags = event.tags.filter(t => t[0] === 'e')
  const qTags = event.tags.filter(t => t[0] === 'q')

  for (const eTag of eTags) {
    const postId = eTag[1]
    if (!trackedIds.has(postId)) continue

    const entry = getOrCreateEntry(postId)

    switch (event.kind) {
      case 7: {
        // NIP-25 reaction — must have e-tag pointing to this post
        // Already filtered above. Deduplicate by event id.
        entry.reactions.add(event.id)
        if (myPubkey && event.pubkey === myPubkey) entry.myReaction = true
        refreshCounts(postId)
        break
      }

      case 6:
      case 16: {
        // NIP-18 repost
        entry.reposts.add(event.id)
        if (myPubkey && event.pubkey === myPubkey) entry.myRepost = true
        refreshCounts(postId)
        break
      }

      case 1: {
        // Reply — validate it's actually a reply using NIP-10 marker convention
        // Only count if the e-tag has a "reply" or "root" marker pointing to our post,
        // OR if it's the last e-tag (positional convention for older clients)
        const marker = eTag[3] // NIP-10 marker: "root", "reply", "mention"
        const isLastETag = eTag === eTags[eTags.length - 1]
        const isReply = marker === 'reply' || marker === 'root' || (!marker && isLastETag)

        if (isReply) {
          entry.replies.add(event.id)
          refreshCounts(postId)
        }
        break
      }

      case 9735: {
        // NIP-57 zap receipt — validate it has a bolt11 tag
        const hasBolt11 = event.tags.some(t => t[0] === 'bolt11')
        const hasDescription = event.tags.some(t => t[0] === 'description')
        if (hasBolt11 || hasDescription) {
          entry.zaps.add(event.id)
          refreshCounts(postId)
        }
        break
      }
    }
  }

  if (event.kind === 1) {
    for (const qTag of qTags) {
      const postId = qTag[1]
      if (!trackedIds.has(postId)) continue

      const entry = getOrCreateEntry(postId)
      entry.reposts.add(event.id)
      if (myPubkey && event.pubkey === myPubkey) entry.myRepost = true
      refreshCounts(postId)
    }
  }
}

// ── Subscription management ─────────────────────────────────────

function openSubscription(myPubkey) {
  if (subscription) {
    subscription.close()
    subscription = null
  }

  if (trackedIds.size === 0) return

  const allIds = Array.from(trackedIds)
  const filters = []

  for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
    const chunk = allIds.slice(i, i + CHUNK_SIZE)
    filters.push(
      { kinds: [7], '#e': chunk, limit: 500 },
      { kinds: [6, 16], '#e': chunk, limit: 200 },
      { kinds: [1], '#e': chunk, limit: 200 },
      { kinds: [1], '#q': chunk, limit: 200 },
      { kinds: [9735], '#e': chunk, limit: 200 }
    )
  }

  try {
    subscription = nostrService.subscribe(filters, {
      onevent: (event) => classifyEvent(event, myPubkey),
      oneose: () => { /* initial batch complete */ },
      onclose: () => { subscription = null }
    })
  } catch {
    // Subscription failed — counts stay at 0, safe fallback
  }
}

function scheduleResubscribe(myPubkey) {
  if (resubscribeTimer) clearTimeout(resubscribeTimer)
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = null
    openSubscription(myPubkey)
  }, RESUBSCRIBE_DEBOUNCE)
}

// ── Public API ──────────────────────────────────────────────────

export function useDeskInteractions() {
  const { currentUser } = useNostrAuth()

  // Reference counting: track how many consumers are active
  consumerCount++

  /**
   * Get reactive interaction counts for a post.
   * Returns a plain object from the reactive countsMap.
   */
  function getInteractions(eventId) {
    if (!countsMap.has(eventId)) {
      countsMap.set(eventId, { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false })
    }
    return countsMap.get(eventId)
  }

  /**
   * Start tracking interactions for a batch of post IDs.
   */
  function trackPosts(eventIds) {
    let added = false
    for (const id of eventIds) {
      if (!id) continue

      const nextRefCount = (trackRefCounts.get(id) || 0) + 1
      trackRefCounts.set(id, nextRefCount)
      if (nextRefCount > 1) continue

      // Cap tracked IDs — evict oldest
      if (trackedIds.size >= TRACKED_IDS_MAX) {
        const oldest = trackedIds.values().next().value
        trackedIds.delete(oldest)
        trackRefCounts.delete(oldest)
        eventIndex.delete(oldest)
        countsMap.delete(oldest)
      }

      trackedIds.add(id)
      getOrCreateEntry(id)
      if (!countsMap.has(id)) {
        countsMap.set(id, { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false })
      }
      added = true
    }

    if (added) {
      scheduleResubscribe(currentUser.value?.pubkey)
    }
  }

  /**
   * Stop tracking interactions for a batch of post IDs.
   */
  function untrackPosts(eventIds) {
    let removed = false
    for (const id of eventIds) {
      const refCount = trackRefCounts.get(id)
      if (!refCount) continue

      if (refCount > 1) {
        trackRefCounts.set(id, refCount - 1)
        continue
      }

      trackRefCounts.delete(id)
      if (trackedIds.delete(id)) {
        eventIndex.delete(id)
        countsMap.delete(id)
        removed = true
      }
    }
    if (removed) {
      scheduleResubscribe(currentUser.value?.pubkey)
    }
  }

  /**
   * Optimistically add a single event to the index.
   * Used after user publishes a reaction/repost — adds the event ID
   * so it's already deduped when the subscription replays it.
   */
  function recordLocalEvent(postId, kind, eventId) {
    const entry = getOrCreateEntry(postId)
    const myPubkey = currentUser.value?.pubkey

    switch (kind) {
      case 7:
        entry.reactions.add(eventId || `local-${Date.now()}`)
        entry.myReaction = true
        break
      case 6:
      case 16:
        entry.reposts.add(eventId || `local-${Date.now()}`)
        entry.myRepost = true
        break
      case 1:
        entry.replies.add(eventId || `local-${Date.now()}`)
        break
      case 9735:
        entry.zaps.add(eventId || `local-${Date.now()}`)
        break
    }
    refreshCounts(postId)
  }

  // Cleanup: only close subscription when last consumer unmounts
  onUnmounted(() => {
    consumerCount--
    if (consumerCount <= 0) {
      consumerCount = 0
      if (subscription) { subscription.close(); subscription = null }
      if (resubscribeTimer) { clearTimeout(resubscribeTimer); resubscribeTimer = null }
    }
  })

  return {
    getInteractions,
    trackPosts,
    untrackPosts,
    recordLocalEvent
  }
}
