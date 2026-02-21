import { ref, reactive, computed, watch } from 'vue'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNotifications } from '../core/useNotifications.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'

// Global state for content zaps
const contentZaps = reactive(new Map()) // Map<eventId, zap[]>
const isTrackingZaps = ref(false)

// Batched subscription state (module-scoped)
const trackedEventIds = new Set()
let batchedSubscription = null
let resubscribeTimer = null
const RESUBSCRIBE_DEBOUNCE = 1000 // 1s debounce before resubscribing
const CHUNK_SIZE = 50 // Max event IDs per filter

// Create enriched zap data from a raw zap event using shared utilities
const createZapData = async (zapEvent) => {
  try {
    const parsed = parseZapReceipt(zapEvent)
    if (!parsed) return null

    const zapData = {
      id: parsed.id,
      amount: parsed.amount,
      zapperPubkey: parsed.zapperPubkey,
      sender: {
        pubkey: parsed.zapperPubkey,
        name: `User ${parsed.zapperPubkey.substring(0, 8)}`,
        avatar: generateAvatar(parsed.zapperPubkey)
      },
      timestamp: parsed.timestamp,
      message: parsed.message,
      bolt11: parsed.bolt11,
      eventId: parsed.zappedEventId,
      rawEvent: zapEvent
    }

    // Fetch profile to enrich sender data before notification
    const profile = await fetchProfile(parsed.zapperPubkey)
    if (profile) {
      zapData.sender = {
        pubkey: parsed.zapperPubkey,
        name: profile.name || `user:${parsed.zapperPubkey.substring(0, 8)}`,
        avatar: profile.picture || generateAvatar(parsed.zapperPubkey),
        picture: profile.picture || generateAvatar(parsed.zapperPubkey),
        nip05: profile.nip05
      }
    }

    return zapData
  } catch (error) {
    console.error('Failed to create zap data:', error)
    return null
  }
}

// Open a single batched subscription for all tracked event IDs
const openBatchedSubscription = (getNotificationHandler) => {
  // Close existing subscription
  if (batchedSubscription) {
    batchedSubscription.close()
    batchedSubscription = null
  }

  if (trackedEventIds.size === 0) {
    isTrackingZaps.value = false
    return
  }

  const allIds = Array.from(trackedEventIds)

  // Chunk event IDs into groups of CHUNK_SIZE to avoid oversized filters
  const filters = []
  for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
    filters.push({
      kinds: [9735],
      '#e': allIds.slice(i, i + CHUNK_SIZE),
      limit: 100
    })
  }

  try {
    batchedSubscription = nostrRelayManager.subscribeToEvents(filters, {
      onevent: async (zapEvent) => {
        const zapData = await createZapData(zapEvent)
        if (!zapData || !zapData.eventId) return

        // Route zap to the correct eventId bucket via the zap's #e tag
        const eventId = zapData.eventId
        if (!trackedEventIds.has(eventId)) return

        if (!contentZaps.has(eventId)) {
          contentZaps.set(eventId, [])
        }

        const existingZaps = contentZaps.get(eventId)
        const exists = existingZaps.find(zap => zap.id === zapData.id)
        if (!exists) {
          existingZaps.unshift(zapData)
          contentZaps.set(eventId, existingZaps)

          // Trigger notification
          try {
            const handler = getNotificationHandler()
            if (handler) handler(zapData)
          } catch (err) {
            console.warn('Failed to trigger notification:', err)
          }
        }
      },
      oneose: () => {},
      onclose: () => {
        batchedSubscription = null
      }
    })

    isTrackingZaps.value = true
    console.log(`[contentZaps] Batched subscription opened for ${allIds.length} event IDs`)
  } catch (error) {
    console.error('[contentZaps] Failed to open batched subscription:', error)
  }
}

// Debounced resubscribe — coalesces rapid add/remove calls
const scheduleResubscribe = (getNotificationHandler) => {
  if (resubscribeTimer) clearTimeout(resubscribeTimer)
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = null
    openBatchedSubscription(getNotificationHandler)
  }, RESUBSCRIBE_DEBOUNCE)
}

export function useContentZaps() {
  const { isAuthenticated, currentUser } = useNostrAuth()

  // Initialize notification handler
  let notificationHandler = null
  const getNotificationHandler = () => {
    if (!notificationHandler) {
      const { handleZapReceivedNostr } = useNotifications()
      notificationHandler = handleZapReceivedNostr
    }
    return notificationHandler
  }

  // Initialize zap tracking for all published content
  const initializeZapTracking = async () => {
    try {
      const contentStorageKey = 'user_content_items'
      const storedContent = localStorage.getItem(contentStorageKey)

      if (storedContent) {
        const contentItems = JSON.parse(storedContent)
        const publishedContent = contentItems.filter(item =>
          item.status === 'published' && item.nostrEventId
        )

        if (publishedContent.length > 0) {
          const eventIds = publishedContent.map(item => item.nostrEventId)
          await trackMultipleContent(eventIds)
        }
      }
    } catch (error) {
      console.error('Failed to initialize zap tracking:', error)
    }
  }

  // Start tracking zaps for a specific content item
  const startZapTracking = async (eventId) => {
    if (!eventId || trackedEventIds.has(eventId)) return

    if (!contentZaps.has(eventId)) {
      contentZaps.set(eventId, [])
    }

    trackedEventIds.add(eventId)
    scheduleResubscribe(getNotificationHandler)
  }

  // Stop tracking zaps for a specific content item
  const stopZapTracking = (eventId) => {
    if (!trackedEventIds.has(eventId)) return
    trackedEventIds.delete(eventId)
    scheduleResubscribe(getNotificationHandler)
  }

  // Stop all zap tracking
  const stopAllZapTracking = () => {
    if (resubscribeTimer) {
      clearTimeout(resubscribeTimer)
      resubscribeTimer = null
    }
    if (batchedSubscription) {
      batchedSubscription.close()
      batchedSubscription = null
    }
    trackedEventIds.clear()
    isTrackingZaps.value = false
  }

  // Get zaps for a specific content item
  const getZapsForContent = (eventId) => {
    return contentZaps.get(eventId) || []
  }

  // Get total zap amount for content
  const getTotalZapAmount = (eventId) => {
    const zaps = getZapsForContent(eventId)
    return zaps.reduce((total, zap) => total + zap.amount, 0)
  }

  // Get zap count for content
  const getZapCount = (eventId) => {
    return getZapsForContent(eventId).length
  }

  // Get all content with zaps
  const getAllContentZaps = computed(() => {
    const result = {}
    contentZaps.forEach((zaps, eventId) => {
      result[eventId] = {
        zaps,
        totalAmount: zaps.reduce((sum, zap) => sum + zap.amount, 0),
        count: zaps.length
      }
    })
    return result
  })

  // Track zaps for multiple content items
  const trackMultipleContent = async (eventIds) => {
    let added = false
    for (const eventId of eventIds) {
      if (!eventId || trackedEventIds.has(eventId)) continue
      if (!contentZaps.has(eventId)) {
        contentZaps.set(eventId, [])
      }
      trackedEventIds.add(eventId)
      added = true
    }
    if (added) {
      scheduleResubscribe(getNotificationHandler)
    }
  }

  // Clear zaps for a content item
  const clearZapsForContent = (eventId) => {
    contentZaps.delete(eventId)
    stopZapTracking(eventId)
  }

  // Cleanup on auth change
  watch(isAuthenticated, (auth) => {
    if (!auth) stopAllZapTracking()
  })

  return {
    // State
    contentZaps: computed(() => contentZaps),
    isTrackingZaps,

    // Actions
    startZapTracking,
    stopZapTracking,
    stopAllZapTracking,
    trackMultipleContent,
    clearZapsForContent,

    // Getters
    getZapsForContent,
    getTotalZapAmount,
    getZapCount,
    getAllContentZaps,
    initializeZapTracking
  }
}
