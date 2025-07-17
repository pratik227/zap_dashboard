import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { useContentZaps } from './useContentZaps.js'
import { useNotifications } from './useNotifications.js'
import { extractAmountFromBolt11 } from '../utils/invoiceUtils.js'

// Global state for campaigns
const userCampaigns = ref([])
const publicCampaigns = ref([])
const isLoading = ref(false)
const error = ref('')

// Track active subscriptions
const activeSubscriptions = reactive(new Map())
const processedEventIds = new Set()

// Campaign zaps tracking
const campaignZaps = reactive(new Map()) // Map<eventId, zap[]>

// NEW: Campaign-specific zap aggregation state (independent of useContentZaps)
const campaignAggregatedZaps = reactive(new Map()) // Map<campaignId, zap[]>
const processedCampaignZapReceiptIds = new Set() // Track processed zap receipt IDs
let campaignZapSubscription = null // Track campaign zap subscription

// Storage key for campaign aggregated zaps
const CAMPAIGN_AGGREGATED_ZAPS_KEY = 'campaign_aggregated_zaps'

// Campaign kind as per NIP-75
const CAMPAIGN_KIND = 9041

// Helper functions for zap data extraction (adapted from useContentZaps)
const extractBolt11 = (zapEvent) => {
  const bolt11Tag = zapEvent.tags.find(tag => tag[0] === 'bolt11')
  return bolt11Tag ? bolt11Tag[1] : null
}

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

// Load campaign aggregated zaps from localStorage
const loadCampaignAggregatedZaps = () => {
  try {
    const stored = localStorage.getItem(CAMPAIGN_AGGREGATED_ZAPS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Convert plain object back to Map
      Object.entries(parsed).forEach(([campaignId, zaps]) => {
        campaignAggregatedZaps.set(campaignId, zaps)
      })
      console.log('Loaded campaign aggregated zaps from storage:', campaignAggregatedZaps.size, 'campaigns')
    }
  } catch (error) {
    console.error('Failed to load campaign aggregated zaps from storage:', error)
  }
}

// Save campaign aggregated zaps to localStorage
const saveCampaignAggregatedZaps = () => {
  try {
    // Convert Map to plain object for JSON serialization
    const toSave = Object.fromEntries(campaignAggregatedZaps)
    localStorage.setItem(CAMPAIGN_AGGREGATED_ZAPS_KEY, JSON.stringify(toSave))
    console.log('Saved campaign aggregated zaps to storage:', campaignAggregatedZaps.size, 'campaigns')
  } catch (error) {
    console.error('Failed to save campaign aggregated zaps to storage:', error)
  }
}

// Add zap to campaign aggregated zaps with deduplication
const addZapToCampaignAggregatedZaps = (campaignId, zapData) => {
  if (!campaignId || !zapData) return
  
  // Get existing zaps for this campaign
  const existingZaps = campaignAggregatedZaps.get(campaignId) || []
  
  // Check for duplicates by zap ID
  const exists = existingZaps.find(zap => zap.id === zapData.id)
  if (exists) {
    console.log('Duplicate zap found for campaign, skipping:', campaignId, zapData.id)
    return
  }
  
  // Add new zap
  existingZaps.unshift(zapData) // Add to beginning (newest first)
  campaignAggregatedZaps.set(campaignId, existingZaps)
  
  console.log(`✅ Added zap to campaign ${campaignId}: ${zapData.amount} sats from ${zapData.zapperPubkey?.substring(0, 8)}...`)
}

// Start campaign zap aggregation listener
const startCampaignZapAggregation = async () => {
  if (!isAuthenticated.value || campaignZapSubscription) {
    console.log('Campaign zap aggregation already active or not authenticated')
    return
  }

  try {
    console.log('🔍 Starting campaign zap aggregation listener...')
    
    // Subscribe to all zap receipts (kind 9735)
    campaignZapSubscription = nostrRelayManager.subscribeToEvents([
      {
        kinds: [9735], // Zap receipts
        limit: 100
      }
    ], {
      onevent: async (zapEvent) => {
        // Deduplicate using processed receipt IDs
        if (processedCampaignZapReceiptIds.has(zapEvent.id)) {
          return
        }
        processedCampaignZapReceiptIds.add(zapEvent.id)
        
        console.log(`⚡ Processing zap receipt for campaign aggregation: ${zapEvent.id.substring(0, 16)}...`)
        
        try {
          // Extract the directly zapped event ID
          const directZappedEventId = extractEventId(zapEvent)
          if (!directZappedEventId) {
            console.log('No event ID found in zap receipt, skipping')
            return
          }
          
          // Fetch the directly zapped event with timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fetch timeout')), 10000)
          )
          
          const directZappedEvent = await Promise.race([
            nostrRelayManager.getEvent({
              ids: [directZappedEventId]
            }),
            timeoutPromise
          ])
          
          if (!directZappedEvent) {
            console.log('Could not fetch directly zapped event:', directZappedEventId)
            return
          }
          
          // Check if the zapped event has a goal tag pointing to a campaign
          const goalTag = directZappedEvent.tags.find(tag => tag[0] === 'goal')
          if (!goalTag || !goalTag[1]) {
            console.log('No goal tag found in zapped event, not a campaign-related zap')
            return
          }
          
          const campaignId = goalTag[1]
          console.log(`Found campaign reference in zapped event: ${campaignId}`)
          
          // Extract zap data
          const amount = extractZapAmount(zapEvent)
          const message = extractZapMessage(zapEvent)
          const bolt11 = extractBolt11(zapEvent)
          
          // Extract zapper pubkey from zap request in description tag
          let zapperPubkey = zapEvent.pubkey // fallback to receipt pubkey
          try {
            const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
            if (descriptionTag && descriptionTag[1]) {
              const zapRequest = JSON.parse(descriptionTag[1])
              if (zapRequest.pubkey) {
                zapperPubkey = zapRequest.pubkey
              }
            }
          } catch (error) {
            console.warn('Failed to extract zapper pubkey from zap request:', error)
          }
          
          // Create zap data object
          const zapData = {
            id: zapEvent.id, // Use zap receipt ID as unique identifier
            amount,
            zapperPubkey,
            timestamp: new Date(zapEvent.created_at * 1000).toISOString(),
            message,
            bolt11,
            directZappedEventId,
            campaignId,
            rawZapEvent: zapEvent,
            rawZappedEvent: directZappedEvent
          }
          
          // Add to campaign aggregated zaps
          addZapToCampaignAggregatedZaps(campaignId, zapData)
          
        } catch (error) {
          console.error('Error processing zap for campaign aggregation:', error)
        }
      },
      oneose: () => {
        console.log('📡 End of stored zap events for campaign aggregation')
      },
      onclose: (reason) => {
        console.log('🔌 Campaign zap aggregation subscription closed:', reason)
        campaignZapSubscription = null
      }
    })
    
    console.log('✅ Campaign zap aggregation listener started')
    
  } catch (error) {
    console.error('❌ Failed to start campaign zap aggregation:', error)
  }
}

// Stop campaign zap aggregation listener
const stopCampaignZapAggregation = () => {
  if (campaignZapSubscription) {
    campaignZapSubscription.close()
    campaignZapSubscription = null
    console.log('🛑 Stopped campaign zap aggregation listener')
  }
}

export function useCampaigns() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  const { startZapTracking, getZapsForContent, getTotalZapAmount } = useContentZaps()
  const { handleZapReceived } = useNotifications()

  // Fetch user's campaigns from Nostr relays
  const fetchUserCampaigns = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch campaigns')
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching campaigns for user:', currentUser.value.pubkey.substring(0, 8) + '...')
      
      // Subscribe to user's campaigns (kind 9041) and deletion events (kind 5)
      const subscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [CAMPAIGN_KIND], // Campaign events (NIP-75)
          authors: [currentUser.value.pubkey],
          limit: 100
        },
        {
          kinds: [5], // Deletion events
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: (event) => {
          handleCampaignEvent(event)
        },
        oneose: () => {
          console.log('End of stored campaign events')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Campaign subscription closed:', reason)
          isLoading.value = false
        }
      })
      
      // Store subscription for cleanup
      activeSubscriptions.set('user-campaigns', subscription)
      
      return subscription
    } catch (err) {
      console.error('Failed to fetch campaigns:', err)
      error.value = 'Failed to fetch campaigns: ' + err.message
      isLoading.value = false
    }
  }

  // Fetch a specific campaign by ID
  const fetchCampaignById = async (eventId) => {
    if (!eventId) {
      throw new Error('Campaign ID is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching campaign by ID:', eventId)
      
      // First check if we already have this campaign in our state
      const existingCampaign = userCampaigns.value.find(c => c.id === eventId)
      if (existingCampaign) {
        console.log('Campaign found in local state:', eventId)
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
      
      console.log('Campaign fetched from relays:', eventId)
      
      // Process the event
      const campaign = processCampaignEvent(event)
      
      // Start tracking zaps for this campaign
      startZapTracking(event.id)
      
      return campaign
    } catch (err) {
      console.error('Failed to fetch campaign by ID:', err)
      error.value = 'Failed to fetch campaign: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Process campaign event
  const handleCampaignEvent = (event) => {
    // Prevent duplicate processing
    if (processedEventIds.has(event.id)) {
      return
    }
    processedEventIds.add(event.id)

    try {
      if (event.kind === CAMPAIGN_KIND) {
        // Handle campaign event
        const campaign = processCampaignEvent(event)
        
        // Check if we already have this campaign
        const existingIndex = userCampaigns.value.findIndex(c => c.id === event.id)
        
        if (existingIndex === -1) {
          // Add new campaign
          userCampaigns.value.push(campaign)
          console.log('Added new campaign:', campaign.title)
          
          // Start tracking zaps for this campaign
          startZapTracking(event.id)
        } else {
          // Update existing campaign
          userCampaigns.value[existingIndex] = campaign
          console.log('Updated existing campaign:', campaign.title)
        }
      } else if (event.kind === 5) {
        // Handle deletion event
        const deletedEventIds = event.tags
          .filter(tag => tag[0] === 'e')
          .map(tag => tag[1])
        
        // Remove deleted campaigns
        deletedEventIds.forEach(id => {
          const index = userCampaigns.value.findIndex(c => c.id === id)
          if (index !== -1) {
            console.log('Removing deleted campaign:', userCampaigns.value[index].title)
            userCampaigns.value.splice(index, 1)
          }
        })
      }
    } catch (error) {
      console.error('Failed to process campaign event:', error)
    }
  }

  // Process campaign event into campaign object
  const processCampaignEvent = (event) => {
    // Extract campaign data from event
    console.log('Processing campaign event with ID:', event.id);
    
    // Ensure we have a valid event
    if (!event || !event.id) {
      console.error('Invalid campaign event:', event);
      throw new Error('Invalid campaign event');
    }
    
    const title = event.content || 'Untitled Campaign';
    
    // Extract tags
    const amountTag = event.tags.find(tag => tag[0] === 'amount')
    const summaryTag = event.tags.find(tag => tag[0] === 'summary')
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    const closedAtTag = event.tags.find(tag => tag[0] === 'closed_at')
    const relaysTag = event.tags.find(tag => tag[0] === 'relays')
    
    // Parse data
    const goalAmount = amountTag ? parseInt(amountTag[1]) : 0 // in millisats
    const summary = summaryTag ? summaryTag[1] : ''
    const image = imageTag ? imageTag[1] : null
    const closedAt = closedAtTag ? parseInt(closedAtTag[1]) : null
    const relays = relaysTag ? event.tags.filter(tag => tag[0] === 'relays').map(tag => tag[1]) : []
    
    // Create campaign object
    const campaign = {
      id: event.id,
      pubkey: event.pubkey,
      title,
      content: event.content,
      summary,
      goalAmount, // in millisats
      image,
      closedAt,
      relays,
      createdAt: event.created_at,
      rawEvent: event
    }
    
    console.log('Processed campaign:', campaign);
    return campaign;
  }

  // Create and publish a new campaign
  const publishCampaign = async (campaignData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''
    
    // Generate a unique client-side ID to prevent duplicates
    const clientId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    console.log(`Starting campaign publication with client ID: ${clientId}`)

    try {
      console.log('Creating new campaign:', campaignData.title)
      
      // Prepare tags
      const tags = [
        ['amount', campaignData.goalAmount.toString()], // in millisats
        ['summary', campaignData.summary.trim()]
      ]
      
      // Add image if provided
      if (campaignData.image) {
        tags.push(['image', campaignData.image.trim()])
      }
      
      // Add closed_at if provided
      if (campaignData.closedAt) {
        const closedAtStr = campaignData.closedAt.toString()
        tags.push(['closed_at', closedAtStr])
        console.log(`Setting campaign end date: ${new Date(campaignData.closedAt * 1000).toLocaleString()}, timestamp: ${closedAtStr}`)
      }
      
      // Add relays
      // NIP-75 requires a SINGLE relays tag with MULTIPLE values (not multiple relays tags)
      const relayUrls = nostrRelayManager.getReadRelays().map(relay => relay.url)
      let relaysTag = ['relays']
      
      if (relayUrls.length > 0) {
        relaysTag.push(...relayUrls)
      } else {
        // Fallback to default relays if none are configured
        relaysTag.push('wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social')
      }
      tags.push(relaysTag)
      
      console.log('Final relays tag:', relaysTag)
      
      // Create event
      const eventTemplate = {
        kind: CAMPAIGN_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: campaignData.title
      }
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        console.error('Event signature verification failed')
        throw new Error('Event signature verification failed. Please try again.')
      }
      
      // Log the complete event for debugging
      console.log('Publishing campaign event:', {
        id: signedEvent.id,
        clientId,
        kind: signedEvent.kind,
        pubkey: signedEvent.pubkey,
        created_at: signedEvent.created_at,
        content: signedEvent.content,
        tags: signedEvent.tags
      })
      
      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      } else {
        console.log(`✅ Campaign published successfully with client ID ${clientId}:`, {
          eventId: signedEvent.id,
          successfulRelays: result.successful,
          failedRelays: result.failed
        })
      }
      
      // Log detailed information for debugging
      console.log('Campaign Event ID:', signedEvent.id);
      console.log('Campaign Event:', signedEvent);
      console.log('Publish Result:', result);
      
      // Check if we already have this campaign in our local state
      const existingCampaign = userCampaigns.value.find(c => c.id === signedEvent.id)
      
      if (!existingCampaign) {
        // Process and add to local state only if it doesn't exist
        const campaign = processCampaignEvent(signedEvent)
        userCampaigns.value.push(campaign)
        console.log(`Added campaign to local state with ID: ${campaign.id}`)
      } else {
        console.log(`Campaign already exists in local state with ID: ${existingCampaign.id}, skipping addition`)
      }
      
      // Start tracking zaps for this campaign
      startZapTracking(signedEvent.id)
      
      // Process and return the campaign object
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

  // Delete a campaign (publish kind 5 deletion event)
  const deleteCampaign = async (campaignId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Deleting campaign:', campaignId)
      
      // Create deletion event
      const eventTemplate = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', campaignId]],
        content: 'Deleting campaign'
      }
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }
      
      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }
      
      console.log('Campaign deletion published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })
      
      // Remove from local state
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

  // Get campaign progress
  const getCampaignProgress = (campaignId) => {
    const campaign = userCampaigns.value.find(c => c.id === campaignId) || 
                    publicCampaigns.value.find(c => c.id === campaignId)
    
    if (!campaign) return { current: 0, goal: 0, percentage: 0 }
    
    // Use campaign aggregated zaps instead of content zaps
    const campaignZaps = campaignAggregatedZaps.get(campaignId) || []
    const raisedAmount = campaignZaps.reduce((sum, zap) => sum + zap.amount, 0) // in sats
    const goalAmount = Math.floor(campaign.goalAmount / 1000) // convert millisats to sats
    
    const percentage = goalAmount > 0 ? Math.min(100, Math.floor((raisedAmount / goalAmount) * 100)) : 0
    
    return {
      current: raisedAmount,
      goal: goalAmount,
      percentage
    }
  }

  // Check if campaign is expired
  const isCampaignExpired = (campaign) => {
    if (!campaign.closedAt) return false
    
    const now = Math.floor(Date.now() / 1000)
    const diff = campaign.closedAt - now
    const diffDays = Math.floor(diff / (24 * 60 * 60))
    const diffHours = Math.floor((diff % (24 * 60 * 60)) / 3600)
    
    console.log(`Campaign expiration check for "${campaign.title}":`)
    console.log(`- Current time: ${new Date(now * 1000).toLocaleString()}`)
    console.log(`- End time: ${new Date(campaign.closedAt * 1000).toLocaleString()}`)
    console.log(`- Time remaining: ${diffDays} days, ${diffHours} hours (${diff} seconds)`)
    console.log(`- Status: ${campaign.closedAt < now ? 'EXPIRED' : 'ACTIVE'}`)
    
    return campaign.closedAt < now
  }

  // Check if campaign is completed
  const isCampaignCompleted = (campaignId) => {
    const progress = getCampaignProgress(campaignId)
    return progress.percentage >= 100
  }

  // Get campaign status
  const getCampaignStatus = (campaign) => {
    if (isCampaignExpired(campaign)) return 'expired'
    if (isCampaignCompleted(campaign.id)) return 'completed'
    return 'active'
  }

  // Share campaign on Nostr
  const shareCampaignOnNostr = async (campaignId, customMessage = '') => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const campaign = userCampaigns.value.find(c => c.id === campaignId)
    if (!campaign) {
      throw new Error('Campaign not found')
    }

    try {
      // Create share URL
      const shareUrl = `${window.location.origin}?page=campaign-view&eventId=${campaignId}`
      
      // Create content with custom message or default
      const content = customMessage || 
        `I'm raising sats with #ZapTracker! Support my campaign: ${campaign.title}\n\n${shareUrl}`
      
      // Create event
      const eventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['goal', campaignId],
          ['e', campaignId],
          ['p', campaign.pubkey]
        ],
        content
      }
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }
      
      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }
      
      console.log('Campaign shared successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })
      
      return {
        eventId: signedEvent.id,
        shareUrl
      }
    } catch (err) {
      console.error('Failed to share campaign:', err)
      throw err
    }
  }

  // Initialize when the composable is used
  onMounted(async () => {
    // Load campaign aggregated zaps from storage
    loadCampaignAggregatedZaps()
    
    if (isAuthenticated.value) {
      fetchUserCampaigns()
      // Start campaign zap aggregation
      await startCampaignZapAggregation()
    }
  })

  // Watch for authentication changes
  watch(isAuthenticated, async (authenticated) => {
    if (authenticated) {
      fetchUserCampaigns()
      await startCampaignZapAggregation()
    } else {
      // Clear campaigns when logged out
      userCampaigns.value = []
      stopCampaignZapAggregation()
    }
  })
  
  // Watch for changes to campaign aggregated zaps and save to storage
  watch(campaignAggregatedZaps, saveCampaignAggregatedZaps, { deep: true })

  // Cleanup on unmount
  onUnmounted(() => {
    // Close all subscriptions
    activeSubscriptions.forEach(subscription => {
      subscription.close()
    })
    activeSubscriptions.clear()
    
    // Stop campaign zap aggregation
    stopCampaignZapAggregation()
  })

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
    deleteCampaign,
    shareCampaignOnNostr,
    
    // Helpers
    getCampaignProgress,
    isCampaignExpired,
    isCampaignCompleted,
    getCampaignStatus,
    
    // NEW: Campaign zap aggregation
    campaignAggregatedZaps: computed(() => campaignAggregatedZaps),
    startCampaignZapAggregation,
    stopCampaignZapAggregation,
    
    // Constants
    CAMPAIGN_KIND
  }
}