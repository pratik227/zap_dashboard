import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useContentZaps } from './useContentZaps.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { useNostrLongForm } from './useNostrLongForm.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { useMentions } from './useMentions.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { storageService } from '../../services/StorageService.js'

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

// Load content from storage
const loadContentFromStorage = () => {
  const parsedContent = storageService.get(CONTENT_STORAGE_KEY, [])
  contentItems.value = Array.isArray(parsedContent) ? parsedContent : []
}

// Save content to storage
const saveContentToStorage = () => {
  storageService.set(CONTENT_STORAGE_KEY, contentItems.value)
}

// ── Shared accessors for other content composables ──────────────────────
// These prevent useNostrLongForm / useContentZaps from directly hitting localStorage.

/** Read-only access to the content items array (for EngagementAnalytics, etc.) */
export const getContentItems = () => contentItems.value

/** Get the published content event IDs (for zap tracking initialization) */
export const getPublishedContentEventIds = () => {
  return contentItems.value
    .filter(item => item.status === 'published' && item.nostrEventId)
    .map(item => item.nostrEventId)
}

/** Upsert a content item from relay data (used by useNostrLongForm) */
export const upsertContentItem = (contentItem) => {
  const existingIndex = contentItems.value.findIndex(item =>
    item.nostrEventId === contentItem.id || item.id === contentItem.id
  )

  if (existingIndex !== -1) {
    contentItems.value[existingIndex] = {
      ...contentItems.value[existingIndex],
      nostrEventId: contentItem.id,
      title: contentItem.title,
      description: contentItem.description,
      type: contentItem.type,
      monetizationModel: contentItem.monetizationModel,
      price: contentItem.price,
      previewText: contentItem.previewText,
      fullContent: contentItem.fullContent,
      tags: contentItem.tags,
      coverImage: contentItem.coverImage,
      status: 'published',
      publishedToRelays: contentItem.publishedToRelays || contentItems.value[existingIndex].publishedToRelays || 1,
      publishedAt: contentItem.publishedAt,
      updatedAt: new Date().toISOString()
    }
  } else {
    contentItems.value.push({ ...contentItem, id: contentItem.id })
  }
  debouncedSaveContent()
}

/** Remove a content item by ID (used by useNostrLongForm) */
export const removeContentItem = (contentId) => {
  contentItems.value = contentItems.value.filter(item =>
    item.nostrEventId !== contentId && item.id !== contentId
  )
  debouncedSaveContent()
}

// Watch for changes and save to storage (debounced, length-based to avoid deep watching)
let _contentSaveTimer = null
const debouncedSaveContent = () => {
  if (_contentSaveTimer) clearTimeout(_contentSaveTimer)
  _contentSaveTimer = setTimeout(saveContentToStorage, 2000)
}
watch(() => contentItems.value.length, debouncedSaveContent)

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
    initializeZapTracking,
    clearZapsForContent
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
      error.value = getUserFriendlyError(err)
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
      error.value = getUserFriendlyError(err)
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
      if (contentToDelete.nostrEventId && signerService.isConnected) {
        try {
          // Create deletion event (kind:5)
          const deletionEvent = {
            kind: 5, // Deletion
            created_at: Math.floor(Date.now() / 1000),
            tags: [['e', contentToDelete.nostrEventId]], // Reference to the event being deleted
            content: 'Content deleted by author'
          }

          const { result: deletionResult } = await publishService.signAndPublish(deletionEvent)
        } catch (deletionError) {
          console.warn('⚠️ Failed to publish deletion request:', deletionError.userMessage || deletionError.message, 'but continuing with local deletion')
        }
      }

      // Clean up zap tracking for this content
      if (contentToDelete.nostrEventId) {
        clearZapsForContent(contentToDelete.nostrEventId)
      }

      contentItems.value.splice(index, 1)

      // Also remove from relay-fetched longFormContent to prevent ghost reappearance
      const longFormIndex = longFormContent.value.findIndex(item =>
        item.id === id || item.id === contentToDelete.nostrEventId
      )
      if (longFormIndex !== -1) {
        longFormContent.value.splice(longFormIndex, 1)
      }

      return true
    } catch (err) {
      error.value = getUserFriendlyError(err)
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
    if (!isAuthenticated.value || !signerService.isConnected) {
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
      const stats = nostrService.getConnectionStats()
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
          ...(content.tags || []).map(tag => ['t', tag]), // Topic tags
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

      publishingStatus.value = 'Signing and broadcasting...'
      publishingProgress.value = 50

      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      publishingProgress.value = 100

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
      error.value = getUserFriendlyError(err)
      publishingStatus.value = 'Publishing failed: ' + getUserFriendlyError(err)
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
    Object.assign(contentForm, {
      title: content.title || '',
      type: content.type || CONTENT_TYPES.ARTICLE,
      content: content.content || '',
      coverImage: content.coverImage || '',
      description: content.description || '',
      tags: content.tags ? [...content.tags] : [],
      monetizationModel: content.monetizationModel || 'free',
      price: content.price || 0
    })
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

  // Watch for authentication changes (handles both init and re-login)
  // Note: initializeZapTracking + fetchUserLongFormContent are handled by their own composable watchers
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      // Composables self-initialize — just ensure localStorage is saved after publish operations
      setTimeout(() => saveContentToStorage(), 2000)
    } else {
      // Clear stale content state on logout
      selectedContentId.value = null
      currentView.value = 'list'
      editingContent.value = null
    }
  }, { immediate: true })

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