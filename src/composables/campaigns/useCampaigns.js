import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { DEFAULT_RELAY_URLS, STORAGE_KEYS } from '../../utils/constants.js'
import { storageService } from '../../services/StorageService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { nip75 } from '../../services/nostr/nostrImports.js'

// Global state for campaigns
const userCampaigns = ref([])
const isLoading = ref(false)
const error = ref('')

const processedEventIds = new Set()
const PROCESSED_IDS_MAX = 1000

// Campaign-specific zap aggregation state
const campaignAggregatedZaps = reactive(new Map()) // Map<campaignId, zap[]>

// Storage keys (from constants.js)
const CAMPAIGN_AGGREGATED_ZAPS_KEY = STORAGE_KEYS.CAMPAIGN_ZAPS
const CAMPAIGNS_STORAGE_KEY = STORAGE_KEYS.CAMPAIGNS

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

// ── Storage helpers ──────────────────────────────────────────────────────────

const loadCampaignsFromStorage = () => {
  const parsed = storageService.get(CAMPAIGNS_STORAGE_KEY, null)
  if (parsed) {
    userCampaigns.value = Array.isArray(parsed) ? parsed : []
    return true
  }
  return false
}

const saveCampaignsToStorage = () => {
  storageService.set(CAMPAIGNS_STORAGE_KEY, userCampaigns.value)
}

const loadCampaignAggregatedZaps = () => {
  const parsed = storageService.get(CAMPAIGN_AGGREGATED_ZAPS_KEY, null)
  if (parsed) {
    Object.entries(parsed).forEach(([campaignId, zaps]) => {
      campaignAggregatedZaps.set(campaignId, zaps)
    })
  }
}

const saveCampaignAggregatedZaps = () => {
  const toSave = Object.fromEntries(campaignAggregatedZaps)
  storageService.set(CAMPAIGN_AGGREGATED_ZAPS_KEY, toSave)
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
      const noteEvents = await nostrService.query(
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
        const events = await nostrService.query(
          [{ kinds: [9735], '#e': chunk, limit: 2000 }],
          { timeout: 25000, eoseGrace: 3000 }
        )
        for (const e of events) allZapEvents.set(e.id, e)
      }

      // Strategy B: Zaps by #goal tag — catches zaps that only have a goal tag
      if (campaignIds.length > 0) {
        const goalEvents = await nostrService.query(
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

  // ── Shared zap enrichment helper ─────────────────────────────────────────

  const enrichZap = (zap, campaignId) => {
    const profile = profileService.getCached(zap.zapperPubkey) || null
    return {
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
      zappedEventId: zap.zappedEventId
    }
  }

  // ── Shared zap-to-campaign resolver ────────────────────────────────────

  const resolveZapCampaignId = (zap, campaignIdSet, linkedNoteMap) => {
    if (zap.zappedEventId && campaignIdSet.has(zap.zappedEventId)) {
      return zap.zappedEventId
    }
    if (zap.goalTag && campaignIdSet.has(zap.goalTag)) {
      return zap.goalTag
    }
    if (zap.zappedEventId && linkedNoteMap) {
      for (const [cId, noteIds] of linkedNoteMap) {
        if (noteIds.has(zap.zappedEventId)) return cId
      }
    }
    return null
  }

  // ── Live zap subscription (Phase 6, extracted for cache/live separation) ──

  const openLiveZapSubscription = (campaignIds, campaignIdSet, linkedNoteMap) => {
    // Close any existing live sub first
    if (liveZapSubscription) {
      liveZapSubscription.close()
      liveZapSubscription = null
    }

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
      for (let i = 0; i < allLinkedNoteIds.length; i += 50) {
        const chunk = allLinkedNoteIds.slice(i, i + 50)
        liveFilters.push({ kinds: [9735], '#e': chunk, since: Math.floor(Date.now() / 1000) })
      }
    }

    const nonce = ++subNonce
    liveZapSubscription = nostrService.subscribe(liveFilters, {
      _nonce: nonce,
      onevent: async (zapEvent) => {
        const parsed = parseZapReceipt(zapEvent)
        if (!parsed) return

        const campaignId = resolveZapCampaignId(parsed, campaignIdSet, linkedNoteMap)
        if (!campaignId) return

        const existingZaps = campaignAggregatedZaps.get(campaignId) || []
        if (existingZaps.some(z => z.id === parsed.id)) return

        try { await profileService.get(parsed.zapperPubkey) } catch { /* use fallback */ }

        const currentZaps = campaignAggregatedZaps.get(campaignId) || []
        campaignAggregatedZaps.set(campaignId, [...currentZaps, enrichZap(parsed, campaignId)])
        debouncedSaveCampaignAggregatedZaps()
      },
      oneose: () => {},
      onclose: () => { liveZapSubscription = null }
    })
  }

  // ── 6-Phase orchestrator ─────────────────────────────────────────────────

  const startCampaignZapAggregation = async () => {
    if (!auth.isAuthenticated.value) {
      return
    }

    // Only aggregate active campaigns — expired/completed ones serve from cached localStorage
    const activeCampaigns = userCampaigns.value.filter(c => !isCampaignExpired(c) && !isCampaignCompleted(c.id))
    const campaignIds = activeCampaigns.map(c => c.id)

    // Abort any previous run before checking empty (cleans up stale live subscriptions)
    stopCampaignZapAggregation()

    if (campaignIds.length === 0) {
      return
    }

    const controller = new AbortController()
    aggregationAbortController = controller
    const signal = controller.signal

    try {
      const campaignIdSet = new Set(campaignIds)

      // ── Phase 1: Linked notes ──────────────────────────────────────────
      if (signal.aborted) return
      const linkedNoteMap = await batchFetchLinkedNotes(campaignIds)

      // ── Phase 1b: Connect to campaign relay tags ───────────────────────
      // Campaigns store preferred relays in their 'relays' tag — connect to
      // those relays so zap queries reach the relays the campaign was published to.
      if (signal.aborted) return
      const campaignRelayUrls = [...new Set(
        activeCampaigns.flatMap(c => c.relays || []).filter(Boolean)
      )]
      if (campaignRelayUrls.length > 0) {
        await Promise.allSettled(
          campaignRelayUrls.map(url =>
            nostrService.connectToRelay(url, { read: true, write: false })
          )
        )
      }

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

      // Resolve each zap to its campaign using the shared resolver
      const campaignZapMap = new Map()
      for (const zap of parsedZaps) {
        const cId = resolveZapCampaignId(zap, campaignIdSet, linkedNoteMap)
        if (cId) {
          if (!campaignZapMap.has(cId)) campaignZapMap.set(cId, [])
          campaignZapMap.get(cId).push(zap)
        }
      }
      // ── Phase 4: Fetch profiles ────────────────────────────────────────
      if (signal.aborted) return
      const allZapperPubkeys = [...new Set(parsedZaps.map(z => z.zapperPubkey))]
      try {
        await profileService.batch(allZapperPubkeys)
      } catch (err) {
        console.warn('[CampaignZaps] Phase 4 failed (continuing with generated avatars):', err)
      }

      // ── Phase 5: Enrich + merge + save ─────────────────────────────────
      if (signal.aborted) return

      for (const [campaignId, zaps] of campaignZapMap) {
        const existingZaps = campaignAggregatedZaps.get(campaignId) || []
        const existingIds = new Set(existingZaps.map(z => z.id))

        const newZaps = zaps
          .filter(z => !existingIds.has(z.id))
          .map(z => enrichZap(z, campaignId))

        if (newZaps.length > 0) {
          campaignAggregatedZaps.set(campaignId, [...existingZaps, ...newZaps])
        }
      }

      // Single save after all merges
      saveCampaignAggregatedZaps()

      // ── Phase 6: Open live subscription (separated for clarity) ────────
      if (signal.aborted) return
      openLiveZapSubscription(campaignIds, campaignIdSet, linkedNoteMap)

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

    processedEventIds.clear()
    isLoading.value = true
    error.value = ''

    try {
      const events = await nostrService.query(
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
      error.value = getUserFriendlyError(err)
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
      const event = await nostrService.queryOne({
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
      error.value = getUserFriendlyError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Process campaign events ──────────────────────────────────────────────

  const handleCampaignEvent = (event) => {
    if (processedEventIds.has(event.id)) return
    processedEventIds.add(event.id)
    if (processedEventIds.size > PROCESSED_IDS_MAX) {
      const toEvict = Array.from(processedEventIds).slice(0, 200)
      toEvict.forEach(id => processedEventIds.delete(id))
    }
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

    // Use nip75 to parse standard zap goal fields
    const goal = nip75.parseZapGoal(event)

    // Extract custom tags not covered by nip75
    const descriptionLongTag = event.tags.find(tag => tag[0] === 'description_long')
    const linkTag = event.tags.find(tag => tag[0] === 'link')

    const campaign = {
      id: event.id,
      pubkey: event.pubkey,
      title: goal.content || 'Untitled Campaign',
      content: event.content,
      summary: goal.summary || '',
      descriptionLong: descriptionLongTag ? descriptionLongTag[1] : '',
      goalAmount: goal.amount || 0,
      image: goal.image || null,
      optionalLink: linkTag ? linkTag[1] : null,
      closedAt: goal.closedAt || null,
      relays: goal.relays || [],
      createdAt: event.created_at,
      linkedNoteIds: [],
      rawEvent: event
    }

    return campaign;
  }

  // ── CRUD operations (unchanged) ──────────────────────────────────────────

  const publishCampaign = async (campaignData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    try {
      const relayUrls = nostrService.getReadRelays().map(relay => relay.url)
      const relays = relayUrls.length > 0 ? relayUrls : DEFAULT_RELAY_URLS.slice(0, 3)

      // Build the zap goal template via nip75
      const template = nip75.createZapGoalTemplate({
        content: campaignData.title,
        amount: campaignData.goalAmount,
        relays,
        closedAt: campaignData.closedAt || undefined,
        image: campaignData.image ? campaignData.image.trim() : undefined,
        summary: campaignData.summary ? campaignData.summary.trim() : undefined,
      })

      // Add custom tags not supported by nip75
      if (campaignData.descriptionLong) {
        template.tags.push(['description_long', campaignData.descriptionLong.trim()])
      }
      if (campaignData.optionalLink) {
        template.tags.push(['link', campaignData.optionalLink.trim()])
      }

      // Use PublishService for sign → verify → publish with retry
      const { event: signedEvent } = await publishService.signAndPublish(template)

      const campaign = processCampaignEvent(signedEvent)

      const existingIndex = userCampaigns.value.findIndex(c => c.id === signedEvent.id)
      if (existingIndex === -1) {
        userCampaigns.value.push(campaign)
      } else {
        userCampaigns.value[existingIndex] = campaign
      }

      return campaign
    } catch (err) {
      console.error('Failed to publish campaign:', err)
      error.value = getUserFriendlyError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const editCampaign = async (campaignId, updatedCampaignData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    try {
      const newCampaign = await publishCampaign(updatedCampaignData)

      // Migrate zap data from old campaign ID to new campaign ID
      const oldZaps = campaignAggregatedZaps.get(campaignId)
      if (oldZaps && oldZaps.length > 0) {
        campaignAggregatedZaps.set(newCampaign.id, oldZaps.map(z => ({
          ...z,
          campaignId: newCampaign.id
        })))
      }

      try {
        await deleteCampaign(campaignId)
      } catch (deleteError) {
        console.warn('Failed to delete old campaign, but new campaign was created:', deleteError)
      }

      return newCampaign
    } catch (err) {
      console.error('Failed to edit campaign:', err)
      error.value = getUserFriendlyError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteCampaign = async (campaignId) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    try {
      // Use PublishService for sign → verify → publish with retry
      await publishService.signAndPublish({
        kind: 5,
        tags: [['e', campaignId]],
        content: 'Deleting campaign'
      })

      const index = userCampaigns.value.findIndex(c => c.id === campaignId)
      if (index !== -1) {
        userCampaigns.value.splice(index, 1)
      }

      // Clean up orphaned zap aggregation data
      if (campaignAggregatedZaps.has(campaignId)) {
        campaignAggregatedZaps.delete(campaignId)
        saveCampaignAggregatedZaps()
      }

      return true
    } catch (err) {
      console.error('Failed to delete campaign:', err)
      error.value = getUserFriendlyError(err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Campaign helpers (unchanged) ─────────────────────────────────────────

  const getCampaignProgress = (campaignId) => {
    const campaign = userCampaigns.value.find(c => c.id === campaignId)

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

  // Only track active (non-expired) campaign IDs — avoid isCampaignCompleted here
  // because it reads campaignAggregatedZaps (reactive Map), which would recompute
  // this signature on every zap change. Completed filtering happens in startCampaignZapAggregation.
  const campaignIdSignature = computed(() =>
    userCampaigns.value.filter(c => !isCampaignExpired(c)).map(c => c.id).sort().join(',')
  )

  // ── Initialization ───────────────────────────────────────────────────────

  // Load cached campaigns immediately on composable initialization
  loadCampaignsFromStorage()
  loadCampaignAggregatedZaps()

  // Guard to prevent double aggregation from auth watcher + signature watcher
  let _aggregationRunning = false

  // Watch for authentication changes
  watch(auth.isAuthenticated, async (authenticated) => {
    if (authenticated) {
      loadCampaignsFromStorage()
      loadCampaignAggregatedZaps()

      try {
        _aggregationRunning = true
        await fetchUserCampaigns()
        await startCampaignZapAggregation()
      } catch (err) {
        console.warn('[useCampaigns] Init failed:', err.message)
      } finally {
        _aggregationRunning = false
      }

      registerRefresh('campaigns', () => fetchUserCampaigns(), 'campaigns')
    } else {
      userCampaigns.value = []
      stopCampaignZapAggregation()
      if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null }
      if (_campaignSaveTimer) { clearTimeout(_campaignSaveTimer); _campaignSaveTimer = null }
      processedEventIds.clear()
      campaignAggregatedZaps.clear()
      unregisterRefresh('campaigns')
    }
  }, { immediate: true })

  // Watch for campaign ID changes only (not deep) — restarts aggregation
  watch(campaignIdSignature, async (newSig, oldSig) => {
    if (!auth.isAuthenticated.value) return
    if (oldSig === undefined) return // skip initial
    if (_aggregationRunning) return // already running from auth watcher
    await startCampaignZapAggregation()
  })

  // Save campaigns to storage on changes (debounced, shallow watch on length)
  let _campaignSaveTimer = null
  const debouncedSaveCampaigns = () => {
    if (_campaignSaveTimer) clearTimeout(_campaignSaveTimer)
    _campaignSaveTimer = setTimeout(saveCampaignsToStorage, 2000)
  }
  watch(() => userCampaigns.value.length, debouncedSaveCampaigns)

  return {
    // State
    userCampaigns,
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
