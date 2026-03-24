import { ref, reactive, computed, watch } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNotifications } from '../core/useNotifications.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import {
  CONTENT_ZAP_CHUNK_SIZE,
  CONTENT_ZAP_RESUBSCRIBE_DEBOUNCE,
  TRACKED_EVENT_IDS_MAX
} from '../../utils/constants.js'
import { storageService } from '../../services/StorageService.js'
import { getPublishedContentEventIds } from './useContent.js'

// Global state for content zaps
const contentZaps = reactive(new Map()) // Map<eventId, zap[]>
const isTrackingZaps = ref(false)

// Batched subscription state (module-scoped)
const trackedEventIds = new Set()
let batchedSubscription = null
let resubscribeTimer = null

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
    const profile = await profileService.get(parsed.zapperPubkey)
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

  // Chunk event IDs into groups of CONTENT_ZAP_CHUNK_SIZE to avoid oversized filters
  const filters = []
  for (let i = 0; i < allIds.length; i += CONTENT_ZAP_CHUNK_SIZE) {
    filters.push({
      kinds: [9735],
      '#e': allIds.slice(i, i + CONTENT_ZAP_CHUNK_SIZE),
      limit: 100
    })
  }

  try {
    batchedSubscription = nostrService.subscribe(filters, {
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
  }, CONTENT_ZAP_RESUBSCRIBE_DEBOUNCE)
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
  // Uses useContent's centralized accessor instead of direct localStorage
  const initializeZapTracking = async () => {
    const eventIds = getPublishedContentEventIds()

    if (eventIds.length > 0) {
      await trackMultipleContent(eventIds)
    }
  }

  // Start tracking zaps for a specific content item
  const startZapTracking = async (eventId) => {
    if (!eventId || trackedEventIds.has(eventId)) return

    // Cap tracked IDs — remove oldest (first-added) entries when full
    if (trackedEventIds.size >= TRACKED_EVENT_IDS_MAX) {
      const iter = trackedEventIds.values()
      const oldest = iter.next().value
      trackedEventIds.delete(oldest)
      contentZaps.delete(oldest) // also free zap data for evicted ID
    }

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
    contentZaps.clear()
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

  // Self-initialize on login, cleanup on logout
  watch(isAuthenticated, (auth) => {
    if (auth) {
      initializeZapTracking().catch(err => console.warn('[useContentZaps] Init tracking failed:', err.message))
    } else {
      stopAllZapTracking()
    }
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
