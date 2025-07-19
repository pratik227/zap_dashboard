import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { useContentZaps } from './useContentZaps.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
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

// NEW: Cache for kind:1 notes to avoid redundant fetches
const kind1NotesCache = new Map() // Map<noteId, noteEvent>
const kind1NotesFetchPromises = new Map() // Map<noteId, Promise>

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
    // console.log(`⚠️ Duplicate zap found for campaign ${campaignId.substring(0, 16)}..., skipping: ${zapData.id.substring(0, 16)}...`)
    return
  }
  
  // Add new zap
    console.log('🔍 Starting enhanced campaign zap aggregation listener...')
  campaignAggregatedZaps.set(campaignId, existingZaps)
  
    // Subscribe to ALL zap receipts with broader filters to catch all campaign zaps
  console.log(`📊 Campaign now has ${existingZaps.length} total zaps (${existingZaps.reduce((sum, z) => sum + z.amount, 0)} sats total)`)
  
  // Save to localStorage after adding
        limit: 1000, // Increased limit to catch more zap receipts
        since: Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60) // Last 7 days
}

// Helper function to resolve campaign ID from a zapped event (kind:1 note)
const resolveCampaignIdFromZappedEvent = async (zappedEventId) => {
  // Check cache first
          // console.log(`⚠️ Duplicate zap receipt, skipping: ${zapEvent.id.substring(0, 16)}...`)
    const cachedNote = kind1NotesCache.get(zappedEventId)
    const goalTag = cachedNote.tags.find(tag => tag[0] === 'goal')
    const campaignId = goalTag ? goalTag[1] : null
    // console.log(`✅ Resolved campaign ID from cache: ${campaignId?.substring(0, 16)}... for note ${zappedEventId.substring(0, 16)}...`)
    if (campaignId) {
      // console.log(`🎯 Found goal tag in cached note: ${campaignId}`)
    }
    return campaignId
  }

  // Check if we're already fetching this note
  if (kind1NotesFetchPromises.has(zappedEventId)) {
    return kind1NotesFetchPromises.get(zappedEventId)
  }

  // Create fetch promise
  const fetchPromise = (async () => {
    try {
      // console.log(`🔍 Fetching kind:1 note to resolve campaign ID: ${zappedEventId.substring(0, 16)}...`)
      
      const noteEvent = await nostrRelayManager.getEvent({
        ids: [zappedEventId],
        kinds: [1] // Text notes
      })
      
      if (!noteEvent) {
        // console.log(`❌ Kind:1 note not found: ${zappedEventId.substring(0, 16)}...`)
        return null
      }
      
      // console.log(`✅ Found kind:1 note: ${noteEvent.id}`)
      
      // Cache the note
      kind1NotesCache.set(zappedEventId, noteEvent)
      // console.log(`✅ Cached kind:1 note: ${zappedEventId.substring(0, 16)}...`)
      
      // Extract goal tag
      const goalTag = noteEvent.tags.find(tag => tag[0] === 'goal')
      const campaignId = goalTag ? goalTag[1] : null
      
      if (campaignId) {
        console.log(`✅ Resolved campaign ID from kind:1 note: ${campaignId.substring(0, 16)}...`)
        // console.log(`🎯 Goal tag found: ['goal', '${campaignId}']`)
      } else {
        // console.log(`⚠️ No goal tag found in kind:1 note: ${zappedEventId.substring(0, 16)}...`)
      }
      
      return campaignId
    } catch (error) {
      console.error(`❌ Failed to fetch kind:1 note ${zappedEventId.substring(0, 16)}...:`, error)
      return null
    } finally {
      // Clean up the promise
      kind1NotesFetchPromises.delete(zappedEventId)
    }
  })()
  
  // Store the promise to prevent duplicate fetches
  kind1NotesFetchPromises.set(zappedEventId, fetchPromise)
  return fetchPromise
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
  const auth = useNostrAuth()
  const { currentUser } = auth
  const isAuthenticated = auth.isAuthenticated
  const { startZapTracking } = useContentZaps()
  const { handleZapReceived } = useNotifications()

  // Helper function to fetch kind:1 notes linked to campaigns
  const fetchLinkedNotesForCampaigns = async () => {
    if (!auth.isAuthenticated.value || userCampaigns.value.length === 0) {
      console.log('Cannot fetch linked notes: not authenticated or no campaigns')
      return
    }
    
    try {
      console.log('🔍 Fetching kind:1 notes linked to campaigns...')
      
      const campaignIds = userCampaigns.value.map(campaign => campaign.id)
      console.log('Looking for notes with goal tags matching:', campaignIds.map(id => id.substring(0, 8) + '...'))
      
      // Subscribe to kind:1 notes authored by current user that reference our campaigns
      const linkedNotesSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [1], // Text notes
          authors: [currentUser.value.pubkey],
          '#goal': campaignIds, // Notes that reference our campaigns via goal tag
          limit: 200
        }
      ], {
        onevent: (noteEvent) => {
        console.log(`⚡ Processing zap receipt: ${zapEvent.id.substring(0, 16)}...`)
        // console.log('📋 Zap receipt tags:', zapEvent.tags)
          
          // Cache the note
          kind1NotesCache.set(noteEvent.id, noteEvent)
          
          // Extract goal tag to find which campaign this note belongs to
          const goalTag = noteEvent.tags.find(tag => tag[0] === 'goal')
          if (goalTag && goalTag[1]) {
            const campaignId = goalTag[1]
            console.log(`🎯 Note references campaign: ${campaignId.substring(0, 16)}...`)
            
            // Find the campaign and add this note ID to its linkedNoteIds
            const campaign = userCampaigns.value.find(c => c.id === campaignId)
            if (campaign) {
              if (!campaign.linkedNoteIds) {
                campaign.linkedNoteIds = []
              }
              
              // Add note ID if not already present
              if (!campaign.linkedNoteIds.includes(noteEvent.id)) {
                campaign.linkedNoteIds.push(noteEvent.id)
                console.log(`✅ Added linked note ${noteEvent.id.substring(0, 16)}... to campaign ${campaignId.substring(0, 16)}...`)
                console.log(`Campaign "${campaign.title}" now has ${campaign.linkedNoteIds.length} linked notes`)
              } else {
                console.log(`⚠️ Note ${noteEvent.id.substring(0, 16)}... already linked to campaign`)
              }
            } else {
              console.log(`❌ Campaign not found for goal tag: ${campaignId.substring(0, 16)}...`)
            }
          } else {
            console.log(`⚠️ No goal tag found in note: ${noteEvent.id.substring(0, 16)}...`)
          }
        },
        oneose: () => {
          console.log('📡 End of stored linked notes events')
          linkedNotesSubscription.close()
        },
        onclose: (reason) => {
          console.log('🔌 Linked notes subscription closed:', reason)
        }
      })
      
    } catch (error) {
      console.error('❌ Failed to fetch linked notes:', error)
    }
  }

  // Start campaign zap aggregation listener
  const startCampaignZapAggregation = async () => {
    if (!auth.isAuthenticated.value) {
      console.log('Not authenticated, cannot start campaign zap aggregation')
      return
    }

    // Close existing subscription if any
    if (campaignZapSubscription) {
      console.log('Closing existing campaign zap subscription...')
      campaignZapSubscription.close()
      campaignZapSubscription = null
    }

    // Get all user campaign IDs for targeted filtering
    const campaignIds = userCampaigns.value.map(campaign => campaign.id)
    
    if (campaignIds.length === 0) {
      console.log('No campaigns found, skipping zap aggregation setup')
      return
    }

    try {
      console.log('🔍 Starting optimized campaign zap aggregation listener...')
      console.log('- Campaign IDs:', campaignIds.map(id => id.substring(0, 8) + '...'))
      
      // Subscribe to ALL zap receipts and filter them based on goal tags
      campaignZapSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [9735], // Zap receipts
          limit: 500 // Cast a wider net to catch all zap receipts
        }
      ], {
        onevent: async (zapEvent) => {
          // Deduplicate using processed receipt IDs
          if (processedCampaignZapReceiptIds.has(zapEvent.id)) {
            console.log(`⚠️ Duplicate zap receipt, skipping: ${zapEvent.id.substring(0, 16)}...`)
            return
          }
          processedCampaignZapReceiptIds.add(zapEvent.id)
          
          console.log(`⚡ Processing zap receipt for campaign aggregation: ${zapEvent.id.substring(0, 16)}...`)
          console.log('📋 Zap receipt tags:', zapEvent.tags)
          
          try {
            let campaignId = null
            
            // PRIORITY: Check for direct goal tag in zap receipt (NIP-75)
            const goalTag = zapEvent.tags.find(tag => tag[0] === 'goal')
            if (goalTag && goalTag[1]) {
              campaignId = goalTag[1]
              console.log(`✅ Found direct goal tag in zap receipt: ${campaignId.substring(0, 16)}...`)
              console.log(`🎯 Direct goal tag: ['goal', '${campaignId}']`)
            }
            // Check if zap receipt has goal tag in description (from zap request)
            else {
              try {
                const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
                if (descriptionTag && descriptionTag[1]) {
                  const zapRequest = JSON.parse(descriptionTag[1])
                  const zapRequestGoalTag = zapRequest.tags?.find(tag => tag[0] === 'goal')
                  if (zapRequestGoalTag && zapRequestGoalTag[1]) {
                    campaignId = zapRequestGoalTag[1]
                    console.log(`✅ Found goal tag in zap request: ${campaignId.substring(0, 16)}...`)
                    console.log(`🎯 Zap request goal tag: ['goal', '${campaignId}']`)
                  }
                }
              } catch (parseError) {
                console.warn('Failed to parse zap request from description:', parseError)
              }
            }
            
            // If no direct goal tag found, try to resolve from zapped event
            if (!campaignId) {
              const zappedEventId = extractEventId(zapEvent)
              if (zappedEventId) {
                console.log(`🔍 No direct goal tag found, checking zapped event: ${zappedEventId.substring(0, 16)}...`)
                campaignId = await resolveCampaignIdFromZappedEvent(zappedEventId)
                if (campaignId) {
                  console.log(`✅ Resolved campaign ID from zapped event: ${campaignId.substring(0, 16)}...`)
                } else {
                  console.log(`❌ Could not resolve campaign ID from zapped event: ${zappedEventId.substring(0, 16)}...`)
                }
              } else {
                console.log(`❌ No zapped event ID found in zap receipt`)
                return
              }
            }
            
            // Only process if this zap is for one of our campaigns
            if (!campaignId) {
              console.log(`❌ No campaign ID found for zap receipt: ${zapEvent.id.substring(0, 16)}...`)
              return
            }
            
            // Check if this campaign belongs to us
            if (!campaignIds.includes(campaignId)) {
              console.log(`❌ Zap is for a campaign not owned by us, skipping: ${campaignId.substring(0, 16)}...`)
              console.log(`❌ Our campaign IDs:`, campaignIds.map(id => id.substring(0, 8) + '...'))
              return
            }
            
            // Extract the zapped event ID from the e tag
            const zappedEventId = extractEventId(zapEvent)
            console.log(`🎯 Zapped event ID: ${zappedEventId?.substring(0, 16)}...`)
            
            console.log(`✅ Processing zap for campaign: ${campaignId.substring(0, 16)}...`)
            console.log(`💰 Campaign: ${campaignId}`)
            console.log(`📝 Zapped event: ${zappedEventId}`)
            
            // Extract zap data
            const amount = extractZapAmount(zapEvent)
            const message = extractZapMessage(zapEvent)
            const bolt11 = extractBolt11(zapEvent)
            
            console.log(`💰 Zap amount: ${amount} sats`)
            // console.log(`🎯 Direct goal tag: ['goal', '${campaignId}']`)
            
            // Extract zapper pubkey from zap request in description tag
            let zapperPubkey = zapEvent.pubkey // fallback to receipt pubkey
            try {
              const descriptionTag = zapEvent.tags.find(tag => tag[0] === 'description')
              if (descriptionTag && descriptionTag[1]) {
                const zapRequest = JSON.parse(descriptionTag[1])
                if (zapRequest.pubkey) {
                  zapperPubkey = zapRequest.pubkey
                  console.log(`👤 Zapper pubkey from request: ${zapperPubkey.substring(0, 16)}...`)
                }
                  // console.log(`🎯 Zap request goal tag: ['goal', '${campaignId}']`)
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
              campaignId,
              zappedEventId, // Track which event was actually zapped
              rawZapEvent: zapEvent
            }
            
            console.log(`📊 Created zap data for campaign aggregation:`, {
              id: zapData.id.substring(0, 16) + '...',
              amount: zapData.amount,
              campaignId: zapData.campaignId.substring(0, 16) + '...',
              zappedEventId: zapData.zappedEventId?.substring(0, 16) + '...'
            })
            
            // Add to campaign aggregated zaps
            addZapToCampaignAggregatedZaps(campaignId, zapData)
            
          } catch (error) {
            console.error('❌ Error processing zap for campaign aggregation:', error)
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
  // Fetch user's campaigns from Nostr relays
  const fetchUserCampaigns = async () => {
    if (!isAuthenticated.value) {
      console.log('Not authenticated, cannot fetch campaigns')
      return
    }
    
    // Prevent multiple simultaneous subscriptions
    if (activeSubscriptions.has('user-campaigns')) {
      console.log('Campaign subscription already active')
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
      console.log('Current relay manager status:', nostrRelayManager.getConnectionStats())
      
      // First check if we already have this campaign in our state
      const existingCampaign = userCampaigns.value.find(c => c.id === eventId)
      if (existingCampaign) {
        console.log('Campaign found in local state:', eventId)
        return existingCampaign
      }
      
      console.log('Campaign not in local state, fetching from relays...')
      
      // If not in state, fetch from relays
      const event = await nostrRelayManager.getEvent({
        ids: [eventId],
        kinds: [CAMPAIGN_KIND]
      })
      
      console.log('Relay query result:', event)
      
      if (!event) {
        console.error('No event found with ID:', eventId, 'and kind:', CAMPAIGN_KIND)
        throw new Error('Campaign not found')
      }
      
      console.log('Campaign fetched from relays:', eventId)
      
      // Process the event
      const campaign = processCampaignEvent(event)
      console.log('Processed campaign:', campaign)
      
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
              // console.log(`🔍 No direct goal tag found, checking zapped event: ${zappedEventId.substring(0, 16)}...`)
          console.log('Updated existing campaign:', campaign.title)
        }
      } else if (event.kind === 5) {
        // Handle deletion event
        const deletedEventIds = event.tags
          .filter(tag => tag[0] === 'e')
          .map(tag => tag[1])
        
                // console.log(`❌ Could not resolve campaign ID from zapped event: ${zappedEventId.substring(0, 16)}...`)
        deletedEventIds.forEach(id => {
          const index = userCampaigns.value.findIndex(c => c.id === id)
              // console.log(`❌ No zapped event ID found in zap receipt`)
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
    const descriptionLongTag = event.tags.find(tag => tag[0] === 'description_long')
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    const linkTag = event.tags.find(tag => tag[0] === 'link')
    const closedAtTag = event.tags.find(tag => tag[0] === 'closed_at')
    const relaysTag = event.tags.find(tag => tag[0] === 'relays')
    
    // Parse data
    const goalAmount = amountTag ? parseInt(amountTag[1]) : 0 // in millisats
    const summary = summaryTag ? summaryTag[1] : ''
    const descriptionLong = descriptionLongTag ? descriptionLongTag[1] : ''
    const image = imageTag ? imageTag[1] : null
    const optionalLink = linkTag ? linkTag[1] : null
    const closedAt = closedAtTag ? parseInt(closedAtTag[1]) : null
    const relays = relaysTag ? event.tags.filter(tag => tag[0] === 'relays').map(tag => tag[1]) : []
    
    // Create campaign object
    const campaign = {
      id: event.id,
      pubkey: event.pubkey,
      title,
      content: event.content,
      summary,
      descriptionLong,
      goalAmount, // in millisats
      image,
      optionalLink,
      closedAt,
      relays,
      createdAt: event.created_at,
      linkedNoteIds: [], // Initialize empty array for linked kind:1 notes
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
      console.log('Campaign data received:', campaignData)
      
      // Prepare tags
      const tags = [
        ['amount', campaignData.goalAmount.toString()], // in millisats
        ['summary', campaignData.summary.trim()]
      ]
      
      // Add long description if provided
      if (campaignData.descriptionLong) {
        tags.push(['description_long', campaignData.descriptionLong.trim()])
      }
      
      // Add image if provided
      if (campaignData.image) {
        tags.push(['image', campaignData.image.trim()])
      }
      
      // Add optional link if provided
      if (campaignData.optionalLink) {
        tags.push(['link', campaignData.optionalLink.trim()])
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
      console.log('All tags prepared:', tags)
      
      // Create event
      const eventTemplate = {
        kind: CAMPAIGN_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: campaignData.title
      }
      
      console.log('Event template before signing:', eventTemplate)
            // console.log(`❌ No campaign ID found for zap receipt: ${zapEvent.id.substring(0, 16)}...`)
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      console.log('Event signed successfully:', signedEvent)
            // console.log(`❌ Zap is for a campaign not owned by us, skipping: ${campaignId.substring(0, 16)}...`)
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        console.error('Event signature verification failed')
        throw new Error('Event signature verification failed. Please try again.')
      }
          // console.log(`🎯 Zapped event ID: ${zappedEventId?.substring(0, 16)}...`)
      console.log('Event signature verified successfully')
      
          // console.log(`💰 Campaign: ${campaignId}`)
          // console.log(`📝 Zapped event: ${zappedEventId}`)
        id: signedEvent.id,
        clientId,
        kind: signedEvent.kind,
        pubkey: signedEvent.pubkey,
        created_at: signedEvent.created_at,
        content: signedEvent.content,
        tags: signedEvent.tags
          // console.log(`💬 Zap message: "${message}"`)
      
      // Check relay manager status before publishing
      const relayStats = nostrRelayManager.getConnectionStats()
      console.log('Relay manager stats before publishing:', relayStats)
      
      if (relayStats.writeEnabled === 0) {
        throw new Error('No write-enabled relays available for publishing')
      }
      
                // console.log(`👤 Zapper pubkey from request: ${zapperPubkey.substring(0, 16)}...`)
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      console.log('Publish result:', result)
      
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
      
          // console.log(`📊 Created zap data for campaign aggregation:`, {
          //   id: zapData.id.substring(0, 16) + '...',
          //   amount: zapData.amount,
          //   campaignId: zapData.campaignId.substring(0, 16) + '...',
          //   zappedEventId: zapData.zappedEventId?.substring(0, 16) + '...'
          // })
        })
        
        if (verificationEvent) {
          console.log('✅ Event successfully verified on relays:', verificationEvent.id)
        } else {
          console.warn('⚠️ Event not found on relays after publication - may take time to propagate')
        }
      } catch (verifyError) {
        console.warn('⚠️ Could not verify event publication:', verifyError)
      }
      
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
    
    if (auth.isAuthenticated.value) {
      // Add delay to prevent too many concurrent requests
      setTimeout(() => {
        fetchUserCampaigns()
      }, 1000)
      
      // Fetch linked notes for campaigns
      setTimeout(() => {
        fetchLinkedNotesForCampaigns()
      }, 1500)
      
      // Start campaign zap aggregation
      setTimeout(async () => {
        await startCampaignZapAggregation()
      }, 2000)
    }
  })

  // Watch for authentication changes
  watch(auth.isAuthenticated, async (authenticated) => {
    if (authenticated) {
      // Add delays to prevent concurrent request overload
      setTimeout(() => {
        fetchUserCampaigns()
      }, 500)
      
      setTimeout(() => {
        fetchLinkedNotesForCampaigns()
      }, 1000)
      
      setTimeout(async () => {
        await startCampaignZapAggregation()
      }, 2000)
    } else {
      // Clear campaigns when logged out
      userCampaigns.value = []
      stopCampaignZapAggregation()
    }
  })
  
  // Watch for changes to user campaigns and restart zap aggregation with updated filters
  watch(userCampaigns, async (newCampaigns, oldCampaigns) => {
    // Only restart if we're authenticated and campaigns have actually changed
    if (!auth.isAuthenticated.value) return
    
    const newIds = newCampaigns.map(c => c.id).sort()
    const oldIds = (oldCampaigns || []).map(c => c.id).sort()
    
    // Check if campaign IDs have changed
    if (JSON.stringify(newIds) !== JSON.stringify(oldIds)) {
      console.log('Campaign list changed, restarting zap aggregation with updated filters...')
      console.log('Old campaign IDs:', oldIds)
      console.log('New campaign IDs:', newIds)
      
      // Re-fetch linked notes for the updated campaigns
      await fetchLinkedNotesForCampaigns()
      
      // Restart zap aggregation with new campaign filters
      await startCampaignZapAggregation()
    }
  }, { deep: true })
  
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