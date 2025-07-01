import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'

// Content types
const CONTENT_TYPES = {
  ARTICLE: 'article',
  NEWSLETTER: 'newsletter',
  PODCAST: 'podcast',
  VIDEO: 'video',
  IMAGE: 'image',
  DOCUMENT: 'document'
}

// Monetization models
const MONETIZATION_MODELS = {
  ONE_TIME: 'one-time',
  SUBSCRIPTION: 'subscription',
  FREE: 'free'
}

// Content status
const CONTENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
}

// Storage keys
const CONTENT_STORAGE_KEY = 'user_content_items'

// Global content state
const contentItems = ref([])

// Content form state
const contentForm = reactive({
  title: '',
  description: '',
  type: CONTENT_TYPES.ARTICLE,
  monetizationModel: MONETIZATION_MODELS.ONE_TIME,
  price: 1000,
  previewText: '',
  fullContent: '',
  tags: [],
  coverImage: ''
})

// UI state
const currentView = ref('list') // list, create, edit, preview, performance
const editingContent = ref(null)
const selectedContent = ref(null)
const isLoading = ref(false)
const error = ref('')

// Publishing state
const publishingStatus = ref('')
const publishingProgress = ref(0)

// Load content from localStorage
const loadContentFromStorage = () => {
  try {
    const stored = localStorage.getItem(CONTENT_STORAGE_KEY)
    if (stored) {
      const parsedContent = JSON.parse(stored)
      contentItems.value = Array.isArray(parsedContent) ? parsedContent : []
      console.log('Loaded content from storage:', contentItems.value.length, 'items')
    }
  } catch (error) {
    console.error('Failed to load content from storage:', error)
    contentItems.value = []
  }
}

// Save content to localStorage
const saveContentToStorage = () => {
  try {
    localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(contentItems.value))
    console.log('Saved content to storage:', contentItems.value.length, 'items')
  } catch (error) {
    console.error('Failed to save content to storage:', error)
  }
}

// Watch for changes and save to storage
watch(contentItems, saveContentToStorage, { deep: true })

// Initialize content from storage
loadContentFromStorage()

export function useContent() {
  const { currentUser, isAuthenticated, userProfile, writeRelays, connectedRelays } = useNostrAuth()

  // Filter content by current user
  const userContentItems = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }

    return contentItems.value.filter(item =>
      item.creatorPubkey === currentUser.value.pubkey
    )
  })

  // Computed properties based on user's content
  const totalRevenue = computed(() => {
    return userContentItems.value.reduce((sum, item) => sum + item.revenue, 0)
  })

  const totalUnlocks = computed(() => {
    return userContentItems.value.reduce((sum, item) => sum + item.unlocks, 0)
  })

  const publishedItems = computed(() => {
    return userContentItems.value.filter(item => item.status === CONTENT_STATUS.PUBLISHED)
  })

  const draftItems = computed(() => {
    return userContentItems.value.filter(item => item.status === CONTENT_STATUS.DRAFT)
  })

  const revenueInUSD = computed(() => {
    return (totalRevenue.value * 0.0003).toFixed(2) // Rough BTC to USD conversion
  })

  const contentStats = computed(() => {
    const published = publishedItems.value.length
    const drafts = draftItems.value.length
    const totalViews = userContentItems.value.reduce((sum, item) => sum + item.views, 0)
    const totalSubscribers = userContentItems.value.reduce((sum, item) => sum + item.subscribers, 0)

    return {
      published,
      drafts,
      totalViews,
      totalSubscribers,
      totalRevenue: totalRevenue.value,
      totalUnlocks: totalUnlocks.value
    }
  })

  const topPerformingContent = computed(() => {
    return [...userContentItems.value]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
  })

  // Content management functions
  const createContent = async (contentData) => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      throw new Error('Authentication required to create content')
    }

    isLoading.value = true
    error.value = ''

    try {
      const newContent = {
        id: Date.now().toString(),
        ...contentData,
        creatorPubkey: currentUser.value.pubkey,
        creatorName: userProfile.value?.name || 'Anonymous Creator',
        unlocks: 0,
        revenue: 0,
        views: 0,
        subscribers: 0,
        status: CONTENT_STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      contentItems.value.unshift(newContent)

      // Reset form
      Object.assign(contentForm, {
        title: '',
        description: '',
        type: CONTENT_TYPES.ARTICLE,
        monetizationModel: MONETIZATION_MODELS.ONE_TIME,
        price: 1000,
        previewText: '',
        fullContent: '',
        tags: [],
        coverImage: ''
      })

      currentView.value = 'list'
      return newContent
    } catch (err) {
      error.value = 'Failed to create content: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const updateContent = async (id, updates) => {
    if (!isAuthenticated.value) {
      throw new Error('Authentication required to update content')
    }

    isLoading.value = true
    error.value = ''

    try {
      const index = contentItems.value.findIndex(item =>
        item.id === id && item.creatorPubkey === currentUser.value.pubkey
      )

      if (index === -1) {
        throw new Error('Content not found or access denied')
      }

      contentItems.value[index] = {
        ...contentItems.value[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }

      return contentItems.value[index]
    } catch (err) {
      error.value = 'Failed to update content: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const deleteContent = async (id) => {
    if (!isAuthenticated.value) {
      throw new Error('Authentication required to delete content')
    }

    isLoading.value = true
    error.value = ''

    try {
      const index = contentItems.value.findIndex(item =>
        item.id === id && item.creatorPubkey === currentUser.value.pubkey
      )

      if (index === -1) {
        throw new Error('Content not found or access denied')
      }

      contentItems.value.splice(index, 1)
      return true
    } catch (err) {
      error.value = 'Failed to delete content: ' + err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const publishContent = async (id) => {
    return updateContent(id, { status: CONTENT_STATUS.PUBLISHED })
  }

  const unpublishContent = async (id) => {
    return updateContent(id, { status: CONTENT_STATUS.DRAFT })
  }

  const duplicateContent = async (id) => {
    if (!isAuthenticated.value) {
      throw new Error('Authentication required to duplicate content')
    }

    const original = userContentItems.value.find(item => item.id === id)
    if (!original) {
      throw new Error('Content not found')
    }

    const duplicate = {
      ...original,
      id: Date.now().toString(),
      title: original.title + ' (Copy)',
      status: CONTENT_STATUS.DRAFT,
      unlocks: 0,
      revenue: 0,
      views: 0,
      subscribers: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    contentItems.value.unshift(duplicate)
    return duplicate
  }

  // Enhanced Nostr publishing functionality using correct SimplePool API
  const publishToNostr = async (contentId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const content = userContentItems.value.find(item => item.id === contentId)
    if (!content) {
      throw new Error('Content not found')
    }

    try {
      isLoading.value = true
      publishingStatus.value = 'Preparing content for Nostr...'
      publishingProgress.value = 10

      // Get write-enabled relays from useNostrAuth
      const availableWriteRelays = writeRelays.value || []
      
      if (availableWriteRelays.length === 0) {
        throw new Error('No write-enabled relays available. Please check your relay configuration in Settings > Nostr.')
      }

      // Create NIP-23 long-form content event
      const eventTemplate = {
        kind: 30023, // Long-form content (NIP-23)
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', contentId], // Identifier tag
          ['title', content.title],
          ['summary', content.description],
          ['published_at', Math.floor(new Date(content.createdAt).getTime() / 1000).toString()],
          ...content.tags.map(tag => ['t', tag])
        ],
        content: content.fullContent
      }

      // Add price tag if monetized
      if (content.monetizationModel !== MONETIZATION_MODELS.FREE) {
        eventTemplate.tags.push(['price', content.price.toString(), 'sats'])
      }

      // Add cover image if available
      if (content.coverImage) {
        eventTemplate.tags.push(['image', content.coverImage])
      }

      publishingStatus.value = 'Signing event with your Nostr key...'
      publishingProgress.value = 30

      // Sign the event using the browser extension
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      publishingStatus.value = 'Broadcasting to Nostr relays...'
      publishingProgress.value = 50

      // Get relay URLs for publishing
      const relayUrls = availableWriteRelays.map(relay => relay.url)
      
      console.log('Publishing to relays:', relayUrls)

      // Create a new pool instance for publishing
      const pool = new SimplePool()
      
      try {
        // Use the correct SimplePool API - publish to multiple relays
        const publishPromises = pool.publish(relayUrls, signedEvent)
        
        publishingStatus.value = 'Waiting for relay confirmations...'
        publishingProgress.value = 80

        // Wait for publishing results with timeout
        const results = await Promise.race([
          Promise.allSettled(publishPromises),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Publishing timeout after 30 seconds')), 30000)
          )
        ])

        // Count successful publications
        const successfulPublications = results
          .filter(result => result.status === 'fulfilled')
          .length

        const failedPublications = results.length - successfulPublications

        publishingProgress.value = 100

        if (successfulPublications === 0) {
          throw new Error('Failed to publish to any relays. Please check your relay connections.')
        }

        // Update content status with Nostr event information
        await updateContent(contentId, {
          status: CONTENT_STATUS.PUBLISHED,
          nostrEventId: signedEvent.id,
          publishedToRelays: successfulPublications,
          publishedAt: new Date().toISOString()
        })

        publishingStatus.value = `Successfully published to ${successfulPublications} relay${successfulPublications !== 1 ? 's' : ''}!`
        
        if (failedPublications > 0) {
          publishingStatus.value += ` (${failedPublications} relay${failedPublications !== 1 ? 's' : ''} failed)`
        }

        console.log('✅ Content published to Nostr successfully:', {
          eventId: signedEvent.id,
          successfulRelays: successfulPublications,
          failedRelays: failedPublications
        })

        return {
          event: signedEvent,
          successfulRelays: successfulPublications,
          failedRelays: failedPublications
        }

      } finally {
        // Always close the pool to clean up connections
        pool.close(relayUrls)
      }

    } catch (err) {
      error.value = 'Failed to publish to Nostr: ' + err.message
      publishingStatus.value = 'Publishing failed: ' + err.message
      console.error('❌ Nostr publishing error:', err)
      throw err
    } finally {
      isLoading.value = false
      // Clear publishing status after 5 seconds
      setTimeout(() => {
        publishingStatus.value = ''
        publishingProgress.value = 0
      }, 5000)
    }
  }

  // Content interaction functions
  const purchaseContent = async (contentId, paymentHash) => {
    // Simulate content purchase
    const content = contentItems.value.find(item => item.id === contentId)
    if (content) {
      content.unlocks += 1
      content.revenue += content.price
      content.views += 1
    }
  }

  const subscribeToContent = async (contentId, subscriptionData) => {
    // Simulate subscription
    const content = contentItems.value.find(item => item.id === contentId)
    if (content) {
      content.subscribers += 1
      content.revenue += content.price
    }
  }

  // View management
  const setView = (view) => {
    currentView.value = view
    error.value = ''
  }

  const editContent = (content) => {
    editingContent.value = content
    Object.assign(contentForm, content)
    currentView.value = 'edit'
  }

  const previewContent = (content) => {
    selectedContent.value = content
    currentView.value = 'preview'
  }

  // Utility functions
  const formatPrice = (price) => {
    return price.toLocaleString() + ' sats'
  }

  const formatRevenue = (revenue) => {
    return revenue.toLocaleString() + ' sats'
  }

  const getContentTypeIcon = (type) => {
    const icons = {
      [CONTENT_TYPES.ARTICLE]: 'IconFileText',
      [CONTENT_TYPES.NEWSLETTER]: 'IconMail',
      [CONTENT_TYPES.PODCAST]: 'IconMicrophone',
      [CONTENT_TYPES.VIDEO]: 'IconVideo',
      [CONTENT_TYPES.IMAGE]: 'IconPhoto',
      [CONTENT_TYPES.DOCUMENT]: 'IconFile'
    }
    return icons[type] || 'IconFileText'
  }

  const getStatusColor = (status) => {
    const colors = {
      [CONTENT_STATUS.PUBLISHED]: 'text-green-600 bg-green-100',
      [CONTENT_STATUS.DRAFT]: 'text-yellow-600 bg-yellow-100',
      [CONTENT_STATUS.ARCHIVED]: 'text-gray-600 bg-gray-100'
    }
    return colors[status] || 'text-gray-600 bg-gray-100'
  }

  return {
    // State
    contentItems: userContentItems,
    contentForm,
    currentView,
    editingContent,
    selectedContent,
    isLoading,
    error,
    publishingStatus,
    publishingProgress,

    // Computed
    totalRevenue,
    totalUnlocks,
    publishedItems,
    draftItems,
    revenueInUSD,
    contentStats,
    topPerformingContent,

    // Actions
    createContent,
    updateContent,
    deleteContent,
    publishContent,
    unpublishContent,
    duplicateContent,
    purchaseContent,
    subscribeToContent,
    publishToNostr,
    
    // View management
    setView,
    editContent,
    previewContent,
    
    // Utilities
    formatPrice,
    formatRevenue,
    getContentTypeIcon,
    getStatusColor,
    
    // Constants
    CONTENT_TYPES,
    MONETIZATION_MODELS,
    CONTENT_STATUS
  }
}