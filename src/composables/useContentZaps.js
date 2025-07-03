import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { useNostrAuth } from './useNostrAuth.js'

// Global state for content zaps
const contentZaps = reactive(new Map()) // Map<eventId, zap[]>
const activeSubscriptions = reactive(new Map()) // Map<eventId, subscription>
const isTrackingZaps = ref(false)

// Zap data structure
const createZapData = (zapEvent) => {
  try {
    // Extract zap receipt data (kind 9735)
    const amount = extractZapAmount(zapEvent)
    const zapperPubkey = zapEvent.pubkey
    const timestamp = zapEvent.created_at * 1000 // Convert to milliseconds
    const message = extractZapMessage(zapEvent)
    const bolt11 = extractBolt11(zapEvent)
    
    return {
      id: zapEvent.id,
      amount,
      zapperPubkey,
      timestamp: new Date(timestamp).toISOString(),
      message,
      bolt11,
      rawEvent: zapEvent
    }
  } catch (error) {
    console.error('Failed to create zap data:', error)
    return null
  }
}

// Extract zap amount from zap receipt
const extractZapAmount = (zapEvent) => {
  try {
    // Look for amount in description tag or bolt11
    const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
    if (descriptionTag && descriptionTag[1]) {
      const zapRequest = JSON.parse(descriptionTag[1])
      
      // Check for amount tag in the zap request
      const amountTag = zapRequest.tags?.find(tag => tag[0] === 'amount')
      if (amountTag && amountTag[1]) {
        return Math.floor(parseInt(amountTag[1]) / 1000) // Convert msats to sats
      }
    }
    
    // Fallback: try to extract from bolt11
    const bolt11Tag = zapEvent.tags.find(tag => tag[0] === 'bolt11')
    if (bolt11Tag && bolt11Tag[1]) {
      return extractAmountFromBolt11(bolt11Tag[1])
    }
    
    return 0
  } catch (error) {
    console.warn('Failed to extract zap amount:', error)
    return 0
  }
}

// Extract message from zap request
const extractZapMessage = (zapEvent) => {
  try {
    const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
    if (descriptionTag && descriptionTag[1]) {
      const zapRequest = JSON.parse(descriptionTag[1])
      return zapRequest.content || ''
    }
    return ''
  } catch (error) {
    return ''
  }
}

// Extract bolt11 invoice
const extractBolt11 = (zapEvent) => {
  const bolt11Tag = zapEvent.tags.find(tag => tag[0] === 'bolt11')
  return bolt11Tag ? bolt11Tag[1] : null
}

// Simple bolt11 amount extraction (basic implementation)
const extractAmountFromBolt11 = (bolt11) => {
  try {
    // Very basic bolt11 parsing - in production use a proper library
    const match = bolt11.match(/lnbc(\d+)([munp]?)/)
    if (match) {
      const amount = parseInt(match[1])
      const unit = match[2]
      
      switch (unit) {
        case 'm': return amount * 100000 // mBTC to sats
        case 'u': return amount * 100    // μBTC to sats
        case 'n': return Math.round(amount * 0.1) // nBTC to sats
        case 'p': return Math.round(amount * 0.0001) // pBTC to sats
        default: return Math.floor(amount / 1000) // msats to sats
      }
    }
    return 0
  } catch (error) {
    return 0
  }
}

export function useContentZaps() {
  const { isAuthenticated, currentUser } = useNostrAuth()

  // Start tracking zaps for a specific content item
  const startZapTracking = async (eventId) => {
    if (!eventId || activeSubscriptions.has(eventId)) {
      console.log(`Zap tracking already active for ${eventId}`)
      return
    }

    try {
      console.log(`🔍 Starting zap tracking for content: ${eventId}`)
      
      // Initialize zaps array for this content if not exists
      if (!contentZaps.has(eventId)) {
        contentZaps.set(eventId, [])
      }

      // Subscribe to zap receipts (kind 9735) for this specific event
      const subscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [9735], // Zap receipts
          "#e": [eventId], // Events that reference our content
          limit: 100
        }
      ], {
        onevent: (zapEvent) => {
          console.log(`⚡ Received zap for ${eventId}:`, zapEvent)
          
          const zapData = createZapData(zapEvent)
          if (zapData) {
            const existingZaps = contentZaps.get(eventId) || []
            
            // Check if we already have this zap (avoid duplicates)
            const exists = existingZaps.find(zap => zap.id === zapData.id)
            if (!exists) {
              existingZaps.unshift(zapData) // Add to beginning (newest first)
              contentZaps.set(eventId, existingZaps)
              console.log(`✅ Added zap: ${zapData.amount} sats from ${zapData.zapperPubkey.substring(0, 8)}...`)
            }
          }
        },
        oneose: () => {
          console.log(`📡 End of stored zap events for ${eventId}`)
        },
        onclose: (reason) => {
          console.log(`🔌 Zap subscription closed for ${eventId}:`, reason)
          activeSubscriptions.delete(eventId)
        }
      })

      activeSubscriptions.set(eventId, subscription)
      isTrackingZaps.value = true
      
      console.log(`✅ Zap tracking started for ${eventId}`)
      
    } catch (error) {
      console.error(`❌ Failed to start zap tracking for ${eventId}:`, error)
    }
  }

  // Stop tracking zaps for a specific content item
  const stopZapTracking = (eventId) => {
    const subscription = activeSubscriptions.get(eventId)
    if (subscription) {
      subscription.close()
      activeSubscriptions.delete(eventId)
      console.log(`🛑 Stopped zap tracking for ${eventId}`)
    }
  }

  // Stop all zap tracking
  const stopAllZapTracking = () => {
    activeSubscriptions.forEach((subscription, eventId) => {
      subscription.close()
      console.log(`🛑 Stopped zap tracking for ${eventId}`)
    })
    activeSubscriptions.clear()
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
    const promises = eventIds.map(eventId => startZapTracking(eventId))
    await Promise.allSettled(promises)
  }

  // Clear zaps for a content item
  const clearZapsForContent = (eventId) => {
    contentZaps.delete(eventId)
    stopZapTracking(eventId)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopAllZapTracking()
  })

  return {
    // State
    contentZaps: computed(() => contentZaps),
    isTrackingZaps,
    activeSubscriptions: computed(() => activeSubscriptions),
    
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
    getAllContentZaps
  }
}