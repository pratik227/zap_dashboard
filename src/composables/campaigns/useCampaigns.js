import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { verifyEvent } from 'nostr-tools/pure'
import { useNotifications } from '../core/useNotifications.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { subscribe } from '../../utils/network/subscribe.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { fetchProfile, batchFetchProfiles, profileCache } from '../../utils/profile/profileFetcher.js'

// Global state for campaigns
const userCampaigns = ref([])
const publicCampaigns = ref([])
const isLoading = ref(false)
const error = ref('')

const processedEventIds = new Set()

// Campaign-specific zap aggregation state
const campaignAggregatedZaps = reactive(new Map()) // Map<campaignId, zap[]>

// Storage keys
const CAMPAIGN_AGGREGATED_ZAPS_KEY = 'campaign_aggregated_zaps'
const CAMPAIGNS_STORAGE_KEY = 'user_campaigns'

// Campaign kind as per NIP-75
const CAMPAIGN_KIND = 9041

// ── Module-scope helpers ─────────────────────────────────────────────────────

// Unique nonce per subscription for live sub
let subNonce = 0

// Track the live zap subscription and abort controller
let liveZapSubscription = null
let aggregationAbortController = null

// ── Debounced save for campaign aggregated zaps ──────────────────────────────

let _saveTimer = null
const debouncedSaveCampaignAggregatedZaps = () => {
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    saveCampaignAggregatedZaps()
  }, 2000)
}

// ── localStorage helpers ─────────────────────────────────────────────────────

const loadCampaignsFromStorage = () => {
  try {
    const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      userCampaigns.value = Array.isArray(parsed) ? parsed : []
      return true
    }
  } catch (error) {
    console.error('Failed to load campaigns from storage:', error)
  }
  return false
}

const saveCampaignsToStorage = () => {
  try {
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(userCampaigns.value))
  } catch (error) {
    console.error('Failed to save campaigns to storage:', error)
  }
}

const loadCampaignAggregatedZaps = () => {
  try {
    const stored = localStorage.getItem(CAMPAIGN_AGGREGATED_ZAPS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      Object.entries(parsed).forEach(([campaignId, zaps]) => {
        campaignAggregatedZaps.set(campaignId, zaps)
      })
    }
  } catch (error) {
    console.error('Failed to load campaign aggregated zaps from storage:', error)
  }
}

const saveCampaignAggregatedZaps = () => {
  try {
    const toSave = Object.fromEntries(campaignAggregatedZaps)
    localStorage.setItem(CAMPAIGN_AGGREGATED_ZAPS_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('Failed to save campaign aggregated zaps to storage:', error)
  }
}

// ── Stop aggregation ─────────────────────────────────────────────────────────

const stopCampaignZapAggregation = () => {
  if (aggregationAbortController) {
    aggregationAbortController.abort()
    aggregationAbortController = null
  }
  if (liveZapSubscription) {
    liveZapSubscription.close()
    liveZapSubscription = null
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// useCampaigns() composable
// ═════════════════════════════════════════════════════════════════════════════

export function useCampaigns() {
  const auth = useNostrAuth()
  const { currentUser } = auth
  const isAuthenticated = auth.isAuthenticated
  const { handleZapReceived } = useNotifications()

  // ── Phase 1: Batch fetch linked notes ────────────────────────────────────

  /**
   * Fetch all kind:1 notes authored by the user that reference our campaigns
   * via #goal tag. Returns Map<campaignId, Set<noteId>>.
   * Also updates campaign.linkedNoteIds for any code reading it.
   */
  const batchFetchLinkedNotes = async (campaignIds) => {
    const linkedNoteMap = new Map() // Map<campaignId, Set<noteId>>
    campaignIds.forEach(id => linkedNoteMap.set(id, new Set()))

    if (!auth.isAuthenticated.value || campaignIds.length === 0) {
      return linkedNoteMap
    }

    try {
      const noteEvents = await subscribe(
        [{
          kinds: [1],
          authors: [currentUser.value.pubkey],
          '#goal': campaignIds,
          limit: 200
        }],
        { timeout: 20000, eoseGrace: 3000 }
      )

      for (const noteEvent of noteEvents) {
        const goalTag = noteEvent.tags.find(tag => tag[0] === 'goal')
        if (goalTag?.[1] && linkedNoteMap.has(goalTag[1])) {
          linkedNoteMap.get(goalTag[1]).add(noteEvent.id)

          // Update campaign.linkedNoteIds for compatibility
          const campaign = userCampaigns.value.find(c => c.id === goalTag[1])
          if (campaign) {
            if (!campaign.linkedNoteIds) campaign.linkedNoteIds = []
            if (!campaign.linkedNoteIds.includes(noteEvent.id)) {
              campaign.linkedNoteIds.push(noteEvent.id)
            }
          }
        }
      }

    } catch (err) {
      console.warn('[CampaignZaps] Phase 1 failed (continuing with empty linked notes):', err)
    }

    return linkedNoteMap
  }

  // ── Phase 2: Batch fetch zaps ────────────────────────────────────────────

  /**
   * Fetch zap receipts for all campaign event IDs + linked note IDs.
   * Uses chunked #e filters (batches of 50) plus one #goal filter.
   * Returns array of raw zap events.
   */
  const batchFetchZaps = async (allEventIds, campaignIds) => {
    const allZapEvents = new Map()

    try {
      // Strategy A: Zaps by #e tag — chunked in batches of 50
      for (let i = 0; i < allEventIds.length; i += 50) {
        const chunk = allEventIds.slice(i, i + 50)
        const events = await subscribe(
          [{ kinds: [9735], '#e': chunk, limit: 2000 }],
          { timeout: 25000, eoseGrace: 3000 }
        )
        for (const e of events) allZapEvents.set(e.id, e)
      }

      // Strategy B: Zaps by #goal tag — catches zaps that only have a goal tag
      if (campaignIds.length > 0) {
        const goalEvents = await subscribe(
          [{ kinds: [9735], '#goal': campaignIds, limit: 2000 }],
          { timeout: 20000, eoseGrace: 3000 }
        )
        for (const e of goalEvents) allZapEvents.set(e.id, e)
      }

    } catch (err) {
      console.warn('[CampaignZaps] Phase 2 failed:', err)
    }

    return Array.from(allZapEvents.values())
  }

  // ── Phase 3: Resolve zaps to campaigns (pure client-side) ────────────────

  /**
   * Resolve each parsed zap to a campaign ID using 3 strategies.
   * 0 relay calls — all data comes from Phase 1 + Phase 2.
   * Returns Map<campaignId, parsedZap[]>.
   */
  const resolveZapsToCampaigns = (parsedZaps, campaignIdSet, linkedNoteMap) => {
    const result = new Map() // Map<campaignId, parsedZap[]>

    // Build reverse lookup: noteId -> campaignId
    const noteToCampaign = new Map()
    for (const [campaignId, noteIds] of linkedNoteMap) {
      for (const noteId of noteIds) {
        noteToCampaign.set(noteId, campaignId)
      }
    }

    for (const zap of parsedZaps) {
      let campaignId = null

      // Strategy 1: zappedEventId is itself a campaign ID
      if (zap.zappedEventId && campaignIdSet.has(zap.zappedEventId)) {
        campaignId = zap.zappedEventId
      }

      // Strategy 2: goalTag matches a campaign ID
      if (!campaignId && zap.goalTag && campaignIdSet.has(zap.goalTag)) {
        campaignId = zap.goalTag
      }

      // Strategy 3: zappedEventId is a linked note (reverse lookup from Phase 1)
      if (!campaignId && zap.zappedEventId && noteToCampaign.has(zap.zappedEventId)) {
        campaignId = noteToCampaign.get(zap.zappedEventId)
      }

      if (campaignId) {
        if (!result.has(campaignId)) result.set(campaignId, [])
        result.get(campaignId).push(zap)
      }
    }

    return result
  }

  // ── 6-Phase orchestrator ─────────────────────────────────────────────────

  const startCampaignZapAggregation = async () => {
    if (!auth.isAuthenticated.value) {
      return
    }

    const campaignIds = userCampaigns.value.map(c => c.id)
    if (campaignIds.length === 0) {
      return
    }

    // Abort any previous run
    stopCampaignZapAggregation()

    const controller = new AbortController()
    aggregationAbortController = controller
    const signal = controller.signal

    try {
      const campaignIdSet = new Set(campaignIds)

      // ── Phase 1: Linked notes ──────────────────────────────────────────
      if (signal.aborted) return
      const linkedNoteMap = await batchFetchLinkedNotes(campaignIds)

      // ── Phase 2: Fetch zaps ────────────────────────────────────────────
      if (signal.aborted) return
      // Collect all event IDs to query: campaign IDs + all linked note IDs
      const allEventIds = [...campaignIds]
      for (const noteIds of linkedNoteMap.values()) {
        for (const noteId of noteIds) {
          allEventIds.push(noteId)
        }
      }
      const rawZapEvents = await batchFetchZaps(allEventIds, campaignIds)

      // ── Phase 3: Parse + resolve to campaigns ─────────────────────────
      if (signal.aborted) return
      const seenZapIds = new Set()
      const parsedZaps = []
      for (const zapEvent of rawZapEvents) {
        const parsed = parseZapReceipt(zapEvent)
        if (parsed && !seenZapIds.has(parsed.id)) {
          seenZapIds.add(parsed.id)
          parsedZaps.push(parsed)
        }
      }

      const campaignZapMap = resolveZapsToCampaigns(parsedZaps, campaignIdSet, linkedNoteMap)
      // ── Phase 4: Fetch profiles ────────────────────────────────────────
      if (signal.aborted) return
      const allZapperPubkeys = [...new Set(parsedZaps.map(z => z.zapperPubkey))]
      try {
        await batchFetchProfiles(allZapperPubkeys)
      } catch (err) {
        console.warn('[CampaignZaps] Phase 4 failed (continuing with generated avatars):', err)
      }

      // ── Phase 5: Enrich + merge + save ─────────────────────────────────
      if (signal.aborted) return

      for (const [campaignId, zaps] of campaignZapMap) {
        const existingZaps = campaignAggregatedZaps.get(campaignId) || []
        const existingIds = new Set(existingZaps.map(z => z.id))

        const enrichedZaps = []
        for (const zap of zaps) {
          if (existingIds.has(zap.id)) continue

          const cached = profileCache.get(zap.zapperPubkey)
          const profile = cached?.profile || null
          enrichedZaps.push({
            id: zap.id,
            amount: zap.amount,
            zapperPubkey: zap.zapperPubkey,
            sender: {
              pubkey: zap.zapperPubkey,
              name: profile?.name || `user:${zap.zapperPubkey.substring(0, 8)}`,
              picture: profile?.picture || generateAvatar(zap.zapperPubkey),
              nip05: profile?.nip05 || null,
              about: profile?.about || null
            },
            timestamp: zap.timestamp,
            message: zap.message,
            bolt11: zap.bolt11,
            campaignId,
            zappedEventId: zap.zappedEventId,
            rawZapEvent: zap.rawZapEvent
          })
        }

        if (enrichedZaps.length > 0) {
          campaignAggregatedZaps.set(campaignId, [...existingZaps, ...enrichedZaps])
        }
      }

      // Single save after all merges
      saveCampaignAggregatedZaps()

      // ── Phase 6: Open live subscription ────────────────────────────────
      if (signal.aborted) return

      const liveFilters = [
        { kinds: [9735], '#e': campaignIds, since: Math.floor(Date.now() / 1000) },
        { kinds: [9735], '#goal': campaignIds, since: Math.floor(Date.now() / 1000) }
      ]

      // Also include linked note IDs in live subscription
      const allLinkedNoteIds = []
      for (const noteIds of linkedNoteMap.values()) {
        for (const noteId of noteIds) {
          allLinkedNoteIds.push(noteId)
        }
      }
      if (allLinkedNoteIds.length > 0) {
        // Chunk linked note IDs into batches of 50 for the live sub filter
        for (let i = 0; i < allLinkedNoteIds.length; i += 50) {
          const chunk = allLinkedNoteIds.slice(i, i + 50)
          liveFilters.push({ kinds: [9735], '#e': chunk, since: Math.floor(Date.now() / 1000) })
        }
      }

      const nonce = ++subNonce
      liveZapSubscription = nostrRelayManager.subscribeToEvents(liveFilters, {
        _nonce: nonce,
        onevent: async (zapEvent) => {
          // Parse the live zap
          const parsed = parseZapReceipt(zapEvent)
          if (!parsed) return

          // Resolve to campaign
          let campaignId = null
          if (parsed.zappedEventId && campaignIdSet.has(parsed.zappedEventId)) {
            campaignId = parsed.zappedEventId
          }
          if (!campaignId && parsed.goalTag && campaignIdSet.has(parsed.goalTag)) {
            campaignId = parsed.goalTag
          }
          if (!campaignId && parsed.zappedEventId) {
            // Check linked notes reverse lookup
            for (const [cId, noteIds] of linkedNoteMap) {
              if (noteIds.has(parsed.zappedEventId)) {
                campaignId = cId
                break
              }
            }
          }

          if (!campaignId) return

          // Check for duplicate
          const existingZaps = campaignAggregatedZaps.get(campaignId) || []
          if (existingZaps.some(z => z.id === parsed.id)) return

          // Fetch profile for the zapper (single pubkey)
          let profile = null
          try {
            profile = await fetchProfile(parsed.zapperPubkey)
          } catch { /* use fallback */ }

          const enrichedZap = {
            id: parsed.id,
            amount: parsed.amount,
            zapperPubkey: parsed.zapperPubkey,
            sender: {
              pubkey: parsed.zapperPubkey,
              name: profile?.name || `user:${parsed.zapperPubkey.substring(0, 8)}`,
              picture: profile?.picture || generateAvatar(parsed.zapperPubkey),
              nip05: profile?.nip05 || null,
              about: profile?.about || null
            },
            timestamp: parsed.timestamp,
            message: parsed.message,
            bolt11: parsed.bolt11,
            campaignId,
            zappedEventId: parsed.zappedEventId,
            rawZapEvent: parsed.rawZapEvent
          }

          // Add to reactive map
          const currentZaps = campaignAggregatedZaps.get(campaignId) || []
          campaignAggregatedZaps.set(campaignId, [...currentZaps, enrichedZap])

          // Debounced save
          debouncedSaveCampaignAggregatedZaps()
        },
        oneose: () => {},
        onclose: (reason) => {
          liveZapSubscription = null
        }
      })

    } catch (err) {
      if (!signal.aborted) {
        console.error('[CampaignZaps] Aggregation failed:', err)
      }
    }
  }

  // ── Fetch user campaigns from relays ─────────────────────────────────────

  const fetchUserCampaigns = async () => {
    if (!isAuthenticated.value) {
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      const events = await subscribe(
        [
          {
            kinds: [CAMPAIGN_KIND],
            authors: [currentUser.value.pubkey],
            limit: 100
          },
          {
            kinds: [5], // Deletion events
            authors: [currentUser.value.pubkey],
            limit: 100
          }
        ],
        { timeout: 20000, eoseGrace: 3000 }
      )

      for (const event of events) {
        handleCampaignEvent(event)
      }

      isLoading.value = false
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
      error.value = 'Failed to fetch campaigns: ' + err.message
      isLoading.value = false
    }
  }

  // ── Fetch campaign by ID ─────────────────────────────────────────────────

  const fetchCampaignById = async (eventId) => {
    if (!eventId) {
      throw new Error('Campaign ID is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      // First check if we already have this campaign in our state
      const existingCampaign = userCampaigns.value.find(c => c.id === eventId)
      if (existingCampaign) {
        return existingCampaign
      }

      // If not in state, fetch from relays
      const event = await nostrRelayManager.getEvent({
        ids: [eventId],
        kinds: [CAMPAIGN_KIND]
      })

      if (!event) {
        throw new Error('Campaign not found')
      }

      // Process the event
      const campaign = processCampaignEvent(event)

      return campaign
    } catch (err) {
      console.error('Failed to fetch campaign by ID:', err)
      error.value = 'Failed to fetch campaign: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Process campaign events ──────────────────────────────────────────────

  const handleCampaignEvent = (event) => {
    if (processedEventIds.has(event.id)) return
    processedEventIds.add(event.id)

    try {
      if (event.kind === CAMPAIGN_KIND) {
        const campaign = processCampaignEvent(event)
        const existingIndex = userCampaigns.value.findIndex(c => c.id === event.id)

        if (existingIndex === -1) {
          userCampaigns.value.push(campaign)
        } else {
          userCampaigns.value[existingIndex] = campaign
        }
      } else if (event.kind === 5) {
        const deletedEventIds = event.tags
          .filter(tag => tag[0] === 'e')
          .map(tag => tag[1])

        deletedEventIds.forEach(id => {
          const index = userCampaigns.value.findIndex(c => c.id === id)
          if (index !== -1) {
            userCampaigns.value.splice(index, 1)
          }
        })
      }
    } catch (error) {
      console.error('Failed to process campaign event:', error)
    }
  }

  const processCampaignEvent = (event) => {
    if (!event || !event.id) {
      console.error('Invalid campaign event:', event);
      throw new Error('Invalid campaign event');
    }

    const title = event.content || 'Untitled Campaign';

    const amountTag = event.tags.find(tag => tag[0] === 'amount')
    const summaryTag = event.tags.find(tag => tag[0] === 'summary')
    const descriptionLongTag = event.tags.find(tag => tag[0] === 'description_long')
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    const linkTag = event.tags.find(tag => tag[0] === 'link')
    const closedAtTag = event.tags.find(tag => tag[0] === 'closed_at')
    const relaysTag = event.tags.find(tag => tag[0] === 'relays')

    const goalAmount = amountTag ? parseInt(amountTag[1]) : 0
    const summary = summaryTag ? summaryTag[1] : ''
    const descriptionLong = descriptionLongTag ? descriptionLongTag[1] : ''
    const image = imageTag ? imageTag[1] : null
    const optionalLink = linkTag ? linkTag[1] : null
    const closedAt = closedAtTag ? parseInt(closedAtTag[1]) : null
    const relays = relaysTag ? event.tags.filter(tag => tag[0] === 'relays').map(tag => tag[1]) : []

    const campaign = {
      id: event.id,
      pubkey: event.pubkey,
      title,
      content: event.content,
      summary,
      descriptionLong,
      goalAmount,
      image,
      optionalLink,
      closedAt,
      relays,
      createdAt: event.created_at,
      linkedNoteIds: [],
      rawEvent: event
    }

    return campaign;
  }

  // ── CRUD operations (unchanged) ──────────────────────────────────────────

  const publishCampaign = async (campaignData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    const clientId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    try {
      const tags = [
        ['amount', campaignData.goalAmount.toString()],
        ['summary', campaignData.summary.trim()]
      ]

      if (campaignData.descriptionLong) {
        tags.push(['description_long', campaignData.descriptionLong.trim()])
      }
      if (campaignData.image) {
        tags.push(['image', campaignData.image.trim()])
      }
      if (campaignData.optionalLink) {
        tags.push(['link', campaignData.optionalLink.trim()])
      }
      if (campaignData.closedAt) {
        const closedAtStr = campaignData.closedAt.toString()
        tags.push(['closed_at', closedAtStr])
      }

      const relayUrls = nostrRelayManager.getReadRelays().map(relay => relay.url)
      let relaysTag = ['relays']
      if (relayUrls.length > 0) {
        relaysTag.push(...relayUrls)
      } else {
        relaysTag.push('wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social')
      }
      tags.push(relaysTag)

      const eventTemplate = {
        kind: CAMPAIGN_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: campaignData.title
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)

      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed. Please try again.')
      }

      const relayStats = nostrRelayManager.getConnectionStats()

      if (relayStats.writeEnabled === 0) {
        throw new Error('No write-enabled relays available for publishing')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      try {
        const verificationEvent = await nostrRelayManager.getEvent({
          ids: [signedEvent.id],
          kinds: [CAMPAIGN_KIND]
        })
        if (!verificationEvent) {
          console.warn('Event not found on relays after publication - may take time to propagate')
        }
      } catch (verifyError) {
        console.warn('Could not verify event publication:', verifyError)
      }

      const existingCampaign = userCampaigns.value.find(c => c.id === signedEvent.id)
      if (!existingCampaign) {
        const campaign = processCampaignEvent(signedEvent)
        userCampaigns.value.push(campaign)
      }

      const campaignObject = processCampaignEvent(signedEvent)
      return campaignObject
    } catch (err) {
      console.error('Failed to publish campaign:', err)
      error.value = 'Failed to publish campaign: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const editCampaign = async (campaignId, updatedCampaignData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    try {
      const newCampaign = await publishCampaign(updatedCampaignData)

      try {
        await deleteCampaign(campaignId)
      } catch (deleteError) {
        console.warn('Failed to delete old campaign, but new campaign was created:', deleteError)
      }

      return newCampaign
    } catch (err) {
      console.error('Failed to edit campaign:', err)
      error.value = 'Failed to edit campaign: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteCampaign = async (campaignId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    try {
      const eventTemplate = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', campaignId]],
        content: 'Deleting campaign'
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)

      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      const index = userCampaigns.value.findIndex(c => c.id === campaignId)
      if (index !== -1) {
        userCampaigns.value.splice(index, 1)
      }

      return true
    } catch (err) {
      console.error('Failed to delete campaign:', err)
      error.value = 'Failed to delete campaign: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Campaign helpers (unchanged) ─────────────────────────────────────────

  const getCampaignProgress = (campaignId) => {
    const campaign = userCampaigns.value.find(c => c.id === campaignId) ||
                    publicCampaigns.value.find(c => c.id === campaignId)

    if (!campaign) return { current: 0, goal: 0, percentage: 0 }

    const campaignZaps = campaignAggregatedZaps.get(campaignId) || []
    const raisedAmount = campaignZaps.reduce((sum, zap) => sum + zap.amount, 0)
    const goalAmount = Math.floor(campaign.goalAmount / 1000)

    const percentage = goalAmount > 0 ? Math.min(100, Math.floor((raisedAmount / goalAmount) * 100)) : 0

    return {
      current: raisedAmount,
      goal: goalAmount,
      percentage
    }
  }

  const isCampaignExpired = (campaign) => {
    if (!campaign.closedAt) return false
    const now = Math.floor(Date.now() / 1000)
    return campaign.closedAt < now
  }

  const isCampaignCompleted = (campaignId) => {
    const progress = getCampaignProgress(campaignId)
    return progress.percentage >= 100
  }

  const getCampaignStatus = (campaign) => {
    if (isCampaignExpired(campaign)) return 'expired'
    if (isCampaignCompleted(campaign.id)) return 'completed'
    return 'active'
  }

  // ── campaignIdSignature computed (replaces deep watcher) ─────────────────

  const campaignIdSignature = computed(() =>
    userCampaigns.value.map(c => c.id).sort().join(',')
  )

  // ── Initialization ───────────────────────────────────────────────────────

  onMounted(async () => {
    loadCampaignAggregatedZaps()

    if (auth.isAuthenticated.value) {
      await fetchUserCampaigns()
      await startCampaignZapAggregation()
    }
  })

  // Load cached campaigns immediately on composable initialization
  loadCampaignsFromStorage()
  loadCampaignAggregatedZaps()

  // Watch for authentication changes
  watch(auth.isAuthenticated, async (authenticated) => {
    if (authenticated) {
      loadCampaignsFromStorage()
      loadCampaignAggregatedZaps()

      await fetchUserCampaigns()
      await startCampaignZapAggregation()

      registerRefresh('campaigns', () => fetchUserCampaigns())
    } else {
      userCampaigns.value = []
      stopCampaignZapAggregation()
      unregisterRefresh('campaigns')
    }
  })

  // Watch for campaign ID changes only (not deep) — restarts aggregation
  watch(campaignIdSignature, async (newSig, oldSig) => {
    if (!auth.isAuthenticated.value) return
    if (oldSig === undefined) return // skip initial
    await startCampaignZapAggregation()
  })

  // Save campaigns to storage on changes
  watch(userCampaigns, saveCampaignsToStorage, { deep: true })

  return {
    // State
    userCampaigns,
    publicCampaigns,
    isLoading,
    error,

    // Actions
    fetchUserCampaigns,
    fetchCampaignById,
    publishCampaign,
    editCampaign,
    deleteCampaign,

    // Helpers
    getCampaignProgress,
    isCampaignExpired,
    isCampaignCompleted,
    getCampaignStatus,

    // Campaign zap aggregation
    campaignAggregatedZaps: computed(() => campaignAggregatedZaps),
    startCampaignZapAggregation,
    stopCampaignZapAggregation,

    // Constants
    CAMPAIGN_KIND
  }
}
