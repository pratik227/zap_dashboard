import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { useContentZaps } from './useContentZaps.js'
import { useNotifications } from './useNotifications.js'

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

// Campaign kind as per NIP-75
const CAMPAIGN_KIND = 9041

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
    console.log('Processing campaign event:', event);
    
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
      }
      
      console.log('✅ Campaign published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })
      
      // Log detailed information for debugging
      console.log('Campaign Event ID:', signedEvent.id);
      console.log('Campaign Event:', signedEvent);
      console.log('Publish Result:', result);
      
      // Process and add to local state
      const campaign = processCampaignEvent(signedEvent)
      userCampaigns.value.push(campaign)
      
      // Start tracking zaps for this campaign
      startZapTracking(signedEvent.id)
      
      return campaign
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
    
    const raisedAmount = getTotalZapAmount(campaignId) // in sats
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
        `⚡ I'm raising sats! Support my campaign: ${campaign.title}\n\n${shareUrl}`
      
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
  onMounted(() => {
    if (isAuthenticated.value) {
      fetchUserCampaigns()
    }
  })

  // Watch for authentication changes
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      fetchUserCampaigns()
    } else {
      // Clear campaigns when logged out
      userCampaigns.value = []
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    // Close all subscriptions
    activeSubscriptions.forEach(subscription => {
      subscription.close()
    })
    activeSubscriptions.clear()
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
    
    // Constants
    CAMPAIGN_KIND
  }
}