import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useContentZaps } from './useContentZaps.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { useNostrLongForm } from './useNostrLongForm.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { useMentions } from './useMentions.js'

// Content types
const CONTENT_TYPES = {
  ARTICLE: 'article',
  NEWSLETTER: 'newsletter',
  STORY: 'story',
  REVIEW: 'review'
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
  type: CONTENT_TYPES.ARTICLE,
  content: '',
  coverImage: '',
  description:'',
  tags: [],
  monetizationModel: 'free',
  price: 0
})

// UI state
const currentView = ref('list') // list, create, edit, preview, performance
const editingContent = ref(null)
const selectedContentId = ref(null)
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
  const { currentUser, isAuthenticated, userProfile } = useNostrAuth()
  const { 
    startZapTracking, 
    getZapsForContent, 
    getTotalZapAmount,
    getZapCount,
    getAllContentZaps,
    initializeZapTracking
  } = useContentZaps()
  
  const { fetchUserLongFormContent, longFormContent } = useNostrLongForm()

  // Filter content by current user
  const userContentItems = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }

    return contentItems.value.filter(item =>
      item.creatorPubkey === currentUser.value.pubkey
    )
  })
  
  // Combine local storage content with content from relays
  const combinedContentItems = computed(() => {
    // Start with local storage content
    const localItems = userContentItems.value
    
    // Add items from relays that aren't already in local storage
    const relayItems = longFormContent.value.filter(relayItem => 
      !localItems.some(localItem => 
        localItem.id === relayItem.id || 
        localItem.nostrEventId === relayItem.id
      )
    )
    
    return [...localItems, ...relayItems].sort((a, b) => 
      new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    )
  })

  // Enhanced content items with zap data
  const combinedContentItemsWithZaps = computed(() => {
    const allZaps = getAllContentZaps.value
    
    return combinedContentItems.value.map(item => {
      const eventId = item.nostrEventId || item.id
      const zapData = allZaps[eventId] || { zaps: [], totalAmount: 0, count: 0 }
      
      return {
        ...item,
        zapCount: zapData.count,
        zapAmount: zapData.totalAmount,
        zaps: zapData.zaps,
        totalRevenue: zapData.totalAmount // Only zap revenue for free content
      }
    })
  })

  // Computed properties
  const totalRevenue = computed(() => {
    return combinedContentItemsWithZaps.value.reduce((sum, item) => sum + item.totalRevenue, 0)
  })

  const publishedItems = computed(() => {
    return combinedContentItemsWithZaps.value.filter(item => item.status === CONTENT_STATUS.PUBLISHED)
  })

  const draftItems = computed(() => {
    return combinedContentItemsWithZaps.value.filter(item => item.status === CONTENT_STATUS.DRAFT)
  })

  const contentStats = computed(() => {
    const published = publishedItems.value.length
    const drafts = draftItems.value.length
    const totalViews = combinedContentItemsWithZaps.value.reduce((sum, item) => sum + (item.views || 0), 0)

    return {
      published,
      drafts,
      totalViews,
      totalRevenue: totalRevenue.value,
      totalUnlocks: 0 // Not applicable for free content
    }
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
        type: 'article', // Default to article since we removed type selection
        creatorPubkey: currentUser.value.pubkey,
        creatorName: userProfile.value?.name || 'Anonymous Creator',
        views: 0,
        monetizationModel: 'free',
        price: 0,
        status: CONTENT_STATUS.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      contentItems.value.unshift(newContent)

      // Reset form
      Object.assign(contentForm, {
        title: '',
        type: CONTENT_TYPES.ARTICLE,
        content: '',
        coverImage: '',
        tags: []
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

      const contentToDelete = contentItems.value[index]
      
      // If content was published to Nostr, publish a deletion request
      if (contentToDelete.nostrEventId && window.nostr) {
        try {
          console.log('Publishing deletion request for content:', contentToDelete.nostrEventId)
          
          // Create deletion event (kind:5)
          const deletionEvent = {
            kind: 5, // Deletion
            created_at: Math.floor(Date.now() / 1000),
            tags: [['e', contentToDelete.nostrEventId]], // Reference to the event being deleted
            content: 'Content deleted by author'
          }

          // Sign the deletion event
          const signedDeletionEvent = await window.nostr.signEvent(deletionEvent)
          
          // Verify the signed deletion event
          const isDeletionValid = verifyEvent(signedDeletionEvent)
          if (!isDeletionValid) {
            console.warn('Deletion event signature verification failed, but continuing with local deletion...')
          } else {
            // Publish deletion event to Nostr relays
            const deletionResult = await nostrRelayManager.publishEvent(signedDeletionEvent)
            
            if (deletionResult.successful > 0) {
              console.log('✅ Deletion request published successfully to', deletionResult.successful, 'relays')
            } else {
              console.warn('⚠️ Failed to publish deletion request, but continuing with local deletion')
            }
          }
        } catch (deletionError) {
          console.warn('⚠️ Failed to publish deletion request:', deletionError.message, 'but continuing with local deletion')
        }
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
      views: 0,
      nostrEventId: null, // Clear Nostr event ID for duplicate
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    contentItems.value.unshift(duplicate)
    return duplicate
  }

  // Enhanced Nostr publishing functionality
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
      publishingStatus.value = 'Publishing to Nostr...'
      publishingProgress.value = 25

      // Check relay connections
      const stats = nostrRelayManager.getConnectionStats()
      if (stats.writeEnabled === 0) {
        throw new Error('No write-enabled relays available. Please check your relay configuration.')
      }

      // Extract p tags from mentions in content (NIP-10)
      const { extractPTags } = useMentions()
      const pTags = extractPTags(content.content || '')
      
      // Create NIP-23 long-form content event (kind:30023)
      let eventTemplate = {
        kind: 30023, // Long-form content (NIP-23)
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', contentId], // Identifier tag (required for addressable events)
          ['title', content.title], // Article title
          ['summary', content.description || ''], // Article summary
          ['published_at', Math.floor(new Date(content.createdAt).getTime() / 1000).toString()],
          ...content.tags.map(tag => ['t', tag]), // Topic tags
          ...pTags // Add p tags for mentions (NIP-10)
        ],
        content: content.content // Main blog content
      }

      // Add optional tags
      if (content.coverImage) {
        eventTemplate.tags.push(['image', content.coverImage])
      }
      
      eventTemplate.tags.push(['content-type', content.type])
      eventTemplate.tags.push(['client', 'ZapTracker'])

      publishingStatus.value = 'Signing with your Nostr key...'
      publishingProgress.value = 50

      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      publishingStatus.value = 'Broadcasting to relays...'
      publishingProgress.value = 75

      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      publishingProgress.value = 100

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Update content status
      await updateContent(contentId, {
        status: CONTENT_STATUS.PUBLISHED,
        nostrEventId: signedEvent.id,
        publishedToRelays: result.successful,
        publishedAt: new Date().toISOString()
      })

      // Start zap tracking
      await startZapTracking(signedEvent.id)

      publishingStatus.value = `Published successfully to ${result.successful} relay${result.successful !== 1 ? 's' : ''}!`

      return {
        event: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = 'Failed to publish: ' + err.message
      publishingStatus.value = 'Publishing failed: ' + err.message
      throw err
    } finally {
      isLoading.value = false
      // Clear status after 5 seconds
      setTimeout(() => {
        publishingStatus.value = ''
        publishingProgress.value = 0
      }, 5000)
    }
  }

  // View management
  const setView = (view) => {
    currentView.value = view
    error.value = ''
    
    if (view === 'create') {
      editingContent.value = null
      Object.assign(contentForm, {
        title: '',
        type: CONTENT_TYPES.ARTICLE,
        content: '',
        description:'',
        coverImage: '',
        tags: [],
        monetizationModel: 'free',
        price: 0
      })
    }

    if (view !== 'edit' && view !== 'create') {
      editingContent.value = null
    }
  }

  const editContent = (content) => {
    editingContent.value = content
    Object.assign(contentForm, content)
    currentView.value = 'edit'
  }

  // selectedContent is a computed that live-tracks the item from the enriched list,
  // so it auto-updates when zaps/engagement data change
  const selectedContent = computed(() => {
    if (!selectedContentId.value) return null
    return combinedContentItemsWithZaps.value.find(
      item => (item.id === selectedContentId.value || item.nostrEventId === selectedContentId.value)
    ) || null
  })

  const previewContent = (content) => {
    selectedContentId.value = content?.id || content?.nostrEventId || null
    currentView.value = 'preview'
  }

  // Initialize when authenticated
  if (isAuthenticated.value) {
    initializeZapTracking()
    
    setTimeout(() => {
      fetchUserLongFormContent().catch(err => {
        console.error('Failed to fetch long-form content:', err)
      })
    }, 2000)
  }

  // Watch for authentication changes
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      setTimeout(() => {
        initializeZapTracking()
        fetchUserLongFormContent().catch(err => {
          console.error('Failed to fetch long-form content:', err)
        })
      }, 1000)
    }
  })

  return {
    // State
    contentItems: combinedContentItemsWithZaps,
    contentForm,
    currentView,
    editingContent,
    selectedContent,
    isLoading,
    error,
    publishingStatus,
    publishingProgress,

    // Computed
    contentStats,
    publishedItems,
    draftItems,

    // Actions
    createContent,
    updateContent,
    deleteContent,
    duplicateContent,
    publishToNostr,
    
    // View management
    setView,
    editContent,
    previewContent,
    
    // Zap functions
    getZapsForContent,
    getTotalZapAmount,
    getZapCount,
    
    // Constants
    CONTENT_TYPES,
    CONTENT_STATUS
  }
}