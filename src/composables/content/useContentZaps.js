import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNotifications } from '../core/useNotifications.js'
import { getPaymentHashFromInvoice } from '../../utils/wallet/invoiceUtils.js'
import * as nip19 from 'nostr-tools/nip19'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

// Global state for content zaps
const contentZaps = reactive(new Map()) // Map<eventId, zap[]>
const activeSubscriptions = reactive(new Map()) // Map<eventId, subscription>
const isTrackingZaps = ref(false)
const allZapEvents = ref([]) // Store all zap events for reference

// Profile cache to avoid repeated fetches
const profileCache = new Map()
const profileFetchPromises = new Map()

// Zap data structure
const createZapData = (zapEvent) => {
  try {
    // Get the bolt11 invoice from the zap receipt
    const bolt11 = extractBolt11(zapEvent)

    // Extract payment hash from bolt11 invoice if available
    let paymentHash = null
    if (bolt11) {
      paymentHash = getPaymentHashFromInvoice(bolt11)
      console.log(`Extracted payment hash from bolt11: ${paymentHash?.substring(0, 16)}...`)
    }
    
    // Use payment hash as ID if available, otherwise fall back to event ID
    const id = paymentHash || zapEvent.id
    
    // Extract zap receipt data (kind 9735)
    const amount = extractZapAmount(zapEvent)
    
    // Extract zapper pubkey from zap request in description tag
    let zapperPubkey = zapEvent.pubkey // fallback to receipt pubkey
    try {
      const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
      if (descriptionTag && descriptionTag[1]) {
        const zapRequest = JSON.parse(descriptionTag[1])
        if (zapRequest.pubkey) {
          zapperPubkey = zapRequest.pubkey
          console.log(`✅ Extracted zapper pubkey from zap request: ${zapperPubkey.substring(0, 16)}...`)
        }
      }
    } catch (error) {
      console.warn('Failed to extract zapper pubkey from zap request:', error)
    }
    
    const timestamp = zapEvent.created_at * 1000 // Convert to milliseconds
    const message = extractZapMessage(zapEvent)
    const eventId = extractEventId(zapEvent) 
    const senderProfile = { pubkey: zapperPubkey }
    
    // Log the extracted data for debugging
    console.log(`Creating zap data for event ${eventId}, payment hash: ${id?.substring(0, 16)}..., amount: ${amount}, zapper: ${zapperPubkey.substring(0, 16)}...`)
    
    const zapData = {
      id: id, // This should be the payment hash for deduplication
      amount,
      zapperPubkey: zapperPubkey,
      sender: {
        pubkey: zapperPubkey,
        name: `User ${zapperPubkey.substring(0, 8)}`,
        avatar: generateAvatar(zapperPubkey)
      },
      timestamp: new Date(timestamp).toISOString(),
      message,
      bolt11,
      eventId,
      rawEvent: zapEvent
    }
    
    // Fetch profile asynchronously - don't wait for it
    fetchZapperProfile(zapperPubkey).then(profile => {
      if (profile) {
        zapData.sender = {
          pubkey: zapperPubkey,
          name: profile.name || `user:${zapperPubkey.substring(0, 8)}`,
          avatar: profile.picture || generateAvatar(zapperPubkey),
          nip05: profile.nip05
        }
      }
    }).catch(error => {
      console.warn('Failed to fetch zapper profile:', error)
    })
    
    return zapData
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
  const bolt11 = bolt11Tag ? bolt11Tag[1] : null

  // Log the bolt11 for debugging
  if (bolt11) {
    console.log(`Found bolt11 invoice in zap event ${zapEvent.id.substring(0, 8)}...: ${bolt11.substring(0, 20)}...`)
  }

  return bolt11
}

// Extract event ID from zap receipt
const extractEventId = (zapEvent) => {
  try {
    // First check for e tag in the zap receipt itself
    const eTag = zapEvent.tags.find(tag => tag[0] === 'e')
    if (eTag && eTag[1]) {
      return eTag[1]
    }
    
    // If not found, check in the description tag (zap request)
    const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
    if (descriptionTag && descriptionTag[1]) {
      const zapRequest = JSON.parse(descriptionTag[1])
      
      // Check for e tag in the zap request
      const requestETag = zapRequest.tags?.find(tag => tag[0] === 'e')
      if (requestETag && requestETag[1]) {
        return requestETag[1]
      }
    }
    
    return null
  } catch (error) {
    console.warn('Failed to extract event ID from zap receipt:', error)
    return null
  }
}

// Enhanced profile fetching with caching
const fetchZapperProfile = async (pubkey) => {
  // Check cache first
  if (profileCache.has(pubkey)) {
    const cached = profileCache.get(pubkey)
    // Use cached profile if it's less than 1 hour old
    if (Date.now() - cached.timestamp < 3600000) {
      return cached.profile
    }
  }

  // Check if we're already fetching this profile
  if (profileFetchPromises.has(pubkey)) {
    return profileFetchPromises.get(pubkey)
  }

  // Create the fetch promise
  const fetchPromise = _fetchProfileFromNostr(pubkey)
  profileFetchPromises.set(pubkey, fetchPromise)

  try {
    const profile = await fetchPromise
    
    // Cache the result
    profileCache.set(pubkey, {
      profile,
      timestamp: Date.now()
    })
    
    return profile
  } catch (error) {
    console.warn(`Failed to fetch profile for ${pubkey.substring(0, 8)}:`, error)
    // Return a fallback profile
    return {
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateAvatar(pubkey),
      nip05: null
    }
  } finally {
    profileFetchPromises.delete(pubkey)
  }
}

// Internal function to fetch profile from Nostr relays
const _fetchProfileFromNostr = async (pubkey) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Profile fetch timeout'))
    }, 15000) // 15 second timeout

    try {
      console.log('🔍 Fetching profile for:', pubkey.substring(0, 8) + '...')
      
      const profileSub = nostrRelayManager.subscribeToEvents([
        {
          kinds: [0], // Profile metadata
          authors: [pubkey],
          limit: 1
        }
      ], {
        onevent: (event) => {
          try {
            clearTimeout(timeout)
            const profileData = JSON.parse(event.content)
            
            const profile = {
              name: profileData.name || profileData.display_name || `user:${pubkey.substring(0, 8)}`,
              picture: profileData.picture || profileData.avatar || generateAvatar(pubkey),
              nip05: profileData.nip05 || null
            }
            
            console.log('✅ Profile fetched successfully for:', profile.name)
            profileSub.close()
            resolve(profile)
          } catch (error) {
            console.warn('⚠️ Failed to parse profile data:', error)
            clearTimeout(timeout)
            profileSub.close()
            reject(error)
          }
        },
        oneose: () => {
          // If no profile found, resolve with fallback after a short delay
          setTimeout(() => {
            clearTimeout(timeout)
            profileSub.close()
            resolve({
              name: `user:${pubkey.substring(0, 8)}`,
              picture: generateAvatar(pubkey),
              nip05: null
            })
          }, 2000) // Wait 2 seconds for potential profile events
        },
        onclose: () => {
          clearTimeout(timeout)
        }
      })
    } catch (error) {
      clearTimeout(timeout)
      reject(error)
    }
  })
}

// Generate a consistent fallback avatar based on pubkey
// generateAvatar imported from avatarGenerator.js

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
      console.log('🔍 Initializing zap tracking for all published content...', new Date().toISOString())
      
      // Get all content items from localStorage
      const contentStorageKey = 'user_content_items'
      const storedContent = localStorage.getItem(contentStorageKey)
      
      if (storedContent) {
        const contentItems = JSON.parse(storedContent)
        console.log('Found content items in storage:', contentItems.length)
        
        // Filter for published content with Nostr event IDs
        const publishedContent = contentItems.filter(item => 
          item.status === 'published' && item.nostrEventId
        )
        
        if (publishedContent.length > 0) {
          const eventIds = publishedContent.map(item => item.nostrEventId)
          console.log(`Found ${eventIds.length} published content items with Nostr event IDs:`, eventIds)
          await trackMultipleContent(eventIds)
        } else {
          console.log('No published content items found with Nostr event IDs')
        }
      } else {
        console.log('No content items found in storage')
      }
    } catch (error) {
      console.error('Failed to initialize zap tracking:', error)
    }
  }

  // Start tracking zaps for a specific content item
  const startZapTracking = async (eventId) => {
    if (!eventId || activeSubscriptions.has(eventId)) {
      console.log(`Zap tracking already active for ${eventId || 'undefined eventId'}`)
      return
    }

    try {
      console.log(`🔍 Starting zap tracking for content: ${eventId}`, new Date().toISOString())
      
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
          console.log(`⚡ Received zap for ${eventId}:`, zapEvent.id)
          
          const zapData = createZapData(zapEvent)
          if (zapData) {
            const existingZaps = contentZaps.get(eventId) || []
            
            // Store the zap event for reference
            allZapEvents.value.push(zapEvent)
            
            // Check if we already have this zap (avoid duplicates)
            const exists = existingZaps.find(zap => zap.id === zapData.id)
            if (!exists) {
              console.log('✅ Adding new zap:', zapData)
              existingZaps.unshift(zapData) // Add to beginning (newest first)
              contentZaps.set(eventId, existingZaps)
              console.log(`✅ Added zap: ${zapData.amount} sats from ${zapData.zapperPubkey.substring(0, 8)}... for event ${eventId}`)

              // Trigger notification for new zap receipt
              try {
                const handler = getNotificationHandler()
                if (handler) {
                  handler(zapData)
                }
              } catch (err) {
                console.warn('Failed to trigger notification:', err)
              }
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
    const results = await Promise.allSettled(promises)
    console.log(`Tracking results for ${eventIds.length} content items:`, 
      results.map((r, i) => `${eventIds[i]}: ${r.status}`))
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
    allZapEvents: computed(() => allZapEvents.value),
    
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
    initializeZapTracking,
    fetchZapperProfile,
    extractEventId
  }
}
