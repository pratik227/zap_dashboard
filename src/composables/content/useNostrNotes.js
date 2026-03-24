import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { useContentZaps } from './useContentZaps.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'

// Global state for notes
const notes = ref([])
const isFetchingNotes = ref(false)
const isPublishing = ref(false)
const error = ref('')
let currentSubscription = null // Track current subscription
const processedEventIds = new Set()
const PROCESSED_IDS_MAX = 1000
let fetchTimeout = null // Track fetch timeout
let notesCleanupInterval = null // Track cleanup interval (module-scoped, not window)
const trackedZapNoteIds = new Set() // Track which notes already have zap tracking started

// Note form state
const noteForm = reactive({
  content: '',
  tags: []
})

// UI state
const currentView = ref('list') // list, create, edit, view
const selectedNote = ref(null)
const editingNote = ref(null)

export function useNostrNotes() {
  const { currentUser, isAuthenticated, writeRelays, readRelays } = useNostrAuth()
  const { startZapTracking, clearZapsForContent } = useContentZaps()

  // Computed properties
  const userNotes = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    return notes.value.filter(note => note.pubkey === currentUser.value.pubkey)
  })

  const sortedNotes = computed(() => {
    return [...userNotes.value].sort((a, b) => b.created_at - a.created_at)
  })

  // Extract hashtags from content
  const extractHashtags = (content) => {
    const hashtagRegex = /#(\w+)/g
    const hashtags = []
    let match
    
    while ((match = hashtagRegex.exec(content)) !== null) {
      hashtags.push(match[1])
    }
    
    return hashtags
  }

  // Create note title from content
  const createNoteTitle = (content) => {
    // Get plain text for title
    const plainText = content.trim()

    // Get first line or first 50 characters
    const firstLine = plainText.split('\n')[0]
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine || 'Untitled Note'
  }

  // Create note preview from content
  const createNotePreview = (content) => {
    // Get plain text for preview
    const plainText = content.replace(/\n+/g, ' ').trim()

    return plainText.length > 200 ? plainText.substring(0, 200) + '...' : plainText
  }

  // Fetch user's notes from Nostr relays
  const fetchUserNotes = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return
    }

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useNostrNotes] Relay manager not ready:', err.message)
      return
    }

    isFetchingNotes.value = true
    error.value = ''

    // Clear any existing timeout
    if (fetchTimeout) {
      clearTimeout(fetchTimeout)
    }

    // Set a timeout to force-reset loading state after 15 seconds
    fetchTimeout = setTimeout(() => {
      if (isFetchingNotes.value) {
        console.warn('⏰ Fetch timeout: EOSE not received after 15 seconds, resetting loading state')
        isFetchingNotes.value = false
      }
    }, 15000)

    try {
      // Subscribe to user's kind:1 events (notes) and kind:5 deletion events
      // Increased limit for users with many notes
      currentSubscription = nostrService.subscribe([
        {
          kinds: [1], // Text notes
          authors: [currentUser.value.pubkey],
          limit: 500 // Increased from 100 to handle large datasets
        },
        {
          kinds: [5], // Deletion events
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: (event) => {
          // Check if we've already processed this event ID
          if (processedEventIds.has(event.id)) {
            return
          }
          
          processedEventIds.add(event.id)
          if (processedEventIds.size > PROCESSED_IDS_MAX) {
            const toEvict = Array.from(processedEventIds).slice(0, 200)
            toEvict.forEach(id => processedEventIds.delete(id))
          }

          if (event.kind === 1) {
            // Handle text note events
            // Check if we already have this note by ID
            const existingIndex = notes.value.findIndex(note => note.id === event.id)
            
            if (existingIndex === -1) {
              // Also check for duplicate content (in case of race conditions)
              const duplicateContentIndex = notes.value.findIndex(note => 
                note.content === event.content && 
                Math.abs(note.created_at - event.created_at) < 5 // Within 5 seconds
              )
              
              if (duplicateContentIndex !== -1) {
                return
              }
              
              // Add new note
              notes.value.push({
                ...event,
                title: createNoteTitle(event.content),
                preview: createNotePreview(event.content),
                hashtags: extractHashtags(event.content)
              })
            } else {
              // Update existing note
              notes.value[existingIndex] = {
                ...event,
                title: createNoteTitle(event.content),
                preview: createNotePreview(event.content),
                hashtags: extractHashtags(event.content)
              }
            }
          } else if (event.kind === 5) {
            // Handle deletion events
            // Extract the event IDs being deleted from the tags
            const deletedEventIds = event.tags
              .filter(tag => tag[0] === 'e')
              .map(tag => tag[1])
            
            // Remove the deleted notes from local state
            deletedEventIds.forEach(deletedId => {
              const index = notes.value.findIndex(note => note.id === deletedId)
              if (index !== -1) {
                notes.value.splice(index, 1)
              }
            })
          }
        },
        oneose: () => {
          isFetchingNotes.value = false
          if (fetchTimeout) {
            clearTimeout(fetchTimeout)
            fetchTimeout = null
          }
          // Close subscription after EOSE — this is a fetch, not a live sub.
          // The refresh cycle will re-fetch periodically.
          if (currentSubscription) {
            currentSubscription.close()
            currentSubscription = null
          }
        },
        onclose: (reason) => {
          isFetchingNotes.value = false
          if (fetchTimeout) {
            clearTimeout(fetchTimeout)
            fetchTimeout = null
          }
        }
      })

      // Store subscription for cleanup
      return currentSubscription

    } catch (err) {
      console.error('Failed to fetch notes:', err)
      error.value = getUserFriendlyError(err)
      isFetchingNotes.value = false
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
        fetchTimeout = null
      }
    }
  }

  // Publish note to Nostr
  const publishNote = async (content, tags = [], pTags = []) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!content.trim()) {
      throw new Error('Note content cannot be empty')
    }

    isPublishing.value = true
    error.value = ''

    try {
      // Extract hashtags from content
      const contentHashtags = extractHashtags(content)
      
      // Combine provided tags with hashtags from content
      const allTags = [...new Set([...tags, ...contentHashtags])]

      // Build event tags array
      const eventTags = [
        ...allTags.map(tag => ['t', tag]), // Add hashtags as 't' tags
        ...pTags // Add p tags for mentions (NIP-10)
      ]

      // Create note event
      let eventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: eventTags,
        content: content.trim()
      }

      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      // Start tracking zaps for this note
      startZapTracking(signedEvent.id)

      // Add the note to our local state immediately
      const newNote = {
        ...signedEvent,
        title: createNoteTitle(content),
        preview: createNotePreview(content),
        hashtags: allTags
      }

      // Check if we already have this note (in case subscription already processed it)
      const existingIndex = notes.value.findIndex(note => note.id === signedEvent.id)
      if (existingIndex === -1) {
        processedEventIds.add(signedEvent.id) // Mark as processed
        notes.value.unshift(newNote)
      }

      // Reset form
      noteForm.content = ''
      noteForm.tags = []

      return {
        event: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('❌ Note publishing error:', err)
      throw err
    } finally {
      isPublishing.value = false
    }
  }

  // Update existing note
  const updateNote = async (noteId, newContent, tags = [], pTags = []) => {
    // In Nostr, we can't actually update events, so we publish a new one
    // and mark the old one as deleted with a kind:5 event
    
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!newContent.trim()) {
      throw new Error('Note content cannot be empty')
    }

    isPublishing.value = true
    error.value = ''

    try {
      // Extract hashtags from content
      const contentHashtags = extractHashtags(newContent)
      
      // Combine provided tags with hashtags from content
      const allTags = [...new Set([...tags, ...contentHashtags])]

      // Build event tags array
      const eventTags = [
        ...allTags.map(tag => ['t', tag]), // Add hashtags as 't' tags
        ...pTags // Add p tags for mentions (NIP-10)
      ]

      // Create note event
      let eventTemplate = {
        kind: 1, // Text note
        created_at: Math.floor(Date.now() / 1000),
        tags: eventTags,
        content: newContent.trim()
      }

      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      // Start tracking zaps for the new note
      startZapTracking(signedEvent.id)

      // Now publish a deletion event for the old note
      
      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', noteId]], // Reference to the event being deleted
        content: 'Note updated - replaced with new version'
      }

      // Sign and publish deletion event
      let signedDeletionEvent
      let deletionResult
      try {
        const deletion = await publishService.signAndPublish(deletionEvent)
        signedDeletionEvent = deletion.event
        deletionResult = deletion.result
      } catch (err) {
        console.warn('⚠️ Failed to publish deletion event, but note update was successful:', err.userMessage || err.message)
        signedDeletionEvent = null
        deletionResult = { successful: 0, failed: 0 }
      }

      // Remove the old note from local state
      const oldNoteIndex = notes.value.findIndex(note => note.id === noteId)
      if (oldNoteIndex !== -1) {
        notes.value.splice(oldNoteIndex, 1)
      }

      // Add the new note to our local state immediately
      const newNote = {
        ...signedEvent,
        title: createNoteTitle(newContent),
        preview: createNotePreview(newContent),
        hashtags: allTags
      }

      // Check if we already have this note (in case subscription already processed it)
      const existingIndex = notes.value.findIndex(note => note.id === signedEvent.id)
      if (existingIndex === -1) {
        processedEventIds.add(signedEvent.id) // Mark as processed
        notes.value.unshift(newNote)
      }

      // Reset form
      noteForm.content = ''
      noteForm.tags = []

      return {
        event: signedEvent,
        deletionEvent: signedDeletionEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed,
        deletionSuccessful: deletionResult.successful,
        deletionFailed: deletionResult.failed
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('❌ Note update error:', err)
      throw err
    } finally {
      isPublishing.value = false
    }
  }

  // Delete note (publish kind:5 deletion event)
  const deleteNote = async (noteId) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', noteId]], // Reference to the event being deleted
        content: 'Note deleted'
      }

      // Sign and publish deletion event
      const { event: signedEvent, result } = await publishService.signAndPublish(deletionEvent)

      if (result.successful > 0) {
        // Remove from local state
        const index = notes.value.findIndex(note => note.id === noteId)
        if (index !== -1) {
          notes.value.splice(index, 1)
        }
        // Clean up zap tracking for deleted note
        clearZapsForContent(noteId)

      }

      return result

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('❌ Note deletion error:', err)
      throw err
    }
  }

  // View management
  const setView = (view) => {
    currentView.value = view
    error.value = ''
  }

  const viewNote = (note) => {
    selectedNote.value = note
    currentView.value = 'view'
  }

  const editNote = (note) => {
    editingNote.value = note
    noteForm.content = note.content
    noteForm.tags = note.hashtags || []
    currentView.value = 'edit'
  }

  const createNewNote = () => {
    editingNote.value = null
    noteForm.content = ''
    noteForm.tags = []
    currentView.value = 'create'
  }

  // Format date for display
  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    
    return date.toLocaleDateString()
  }

  // Watch for notes changes to track zaps on new notes
  // Shallow watch on array length — only fires when notes are added/removed, not on deep property changes
  watch(() => notes.value.length, () => {
    if (isAuthenticated.value && notes.value.length > 0) {
      const untracked = notes.value.filter(note => !trackedZapNoteIds.has(note.id))
      if (untracked.length > 0) {
        untracked.forEach(note => {
          trackedZapNoteIds.add(note.id)
          startZapTracking(note.id)
        })
      }
    }
  })

  // Initialize notes when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      // Only fetch if we don't already have notes
      if (notes.value.length === 0) {
        // Clean up any existing subscription
        if (currentSubscription) {
          currentSubscription.close()
          currentSubscription = null
        }
        processedEventIds.clear() // Clear processed event IDs
        
        // fetchUserNotes already awaits ready() internally
        fetchUserNotes().catch(err => console.warn('[useNostrNotes] Initial fetch failed:', err.message))

        registerRefresh('notes', async () => {
          if (currentSubscription) { currentSubscription.close(); currentSubscription = null }
          processedEventIds.clear()
          await fetchUserNotes()
        }, 'notes')

        // Set up periodic cleanup of duplicate notes
        const cleanupInterval = setInterval(() => {
          if (isAuthenticated.value) {
            cleanupDuplicateNotes()
          } else {
            clearInterval(cleanupInterval)
          }
        }, 30000)
        notesCleanupInterval = cleanupInterval
      }
    } else {
      // Clean up subscription when not authenticated
      if (currentSubscription) {
        currentSubscription.close()
        currentSubscription = null
      }
      processedEventIds.clear()
      trackedZapNoteIds.clear()
      notes.value = []
      unregisterRefresh('notes')

      // Clear cleanup interval
      if (notesCleanupInterval) {
        clearInterval(notesCleanupInterval)
        notesCleanupInterval = null
      }
    }
  }, { immediate: true })

  // Cleanup function to close subscriptions
  const cleanup = () => {
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }
    processedEventIds.clear()
    trackedZapNoteIds.clear()

    // Clear fetch timeout
    if (fetchTimeout) {
      clearTimeout(fetchTimeout)
      fetchTimeout = null
    }

    // Clear cleanup interval
    if (notesCleanupInterval) {
      clearInterval(notesCleanupInterval)
      notesCleanupInterval = null
    }
  }

  // Debug function to log current state
  const debugState = () => {
    // no-op in production; kept for API compatibility
  }

  // Function to manually remove a note from local state (for cleanup)
  const removeNoteFromLocalState = (noteId) => {
    const index = notes.value.findIndex(note => note.id === noteId)
    if (index !== -1) {
      notes.value.splice(index, 1)
      return true
    }
    return false
  }

  // Function to check for and remove duplicate notes
  const cleanupDuplicateNotes = () => {
    const seenIds = new Set()
    const seenContent = new Map() // content -> first note id
    
    const notesToRemove = []
    
    notes.value.forEach((note, index) => {
      // Check for duplicate IDs (shouldn't happen, but just in case)
      if (seenIds.has(note.id)) {
        notesToRemove.push(index)
        return
      }
      seenIds.add(note.id)
      
      // Check for duplicate content within 5 seconds
      const contentKey = note.content + '_' + Math.floor(note.created_at / 5)
      if (seenContent.has(contentKey)) {
        const firstNoteId = seenContent.get(contentKey)
        const firstNote = notes.value.find(n => n.id === firstNoteId)
        
        // Keep the newer note, remove the older one
        if (note.created_at > firstNote.created_at) {
          const firstIndex = notes.value.findIndex(n => n.id === firstNoteId)
          if (firstIndex !== -1) {
            notesToRemove.push(firstIndex)
            seenContent.set(contentKey, note.id)
          }
        } else {
          notesToRemove.push(index)
        }
      } else {
        seenContent.set(contentKey, note.id)
      }
    })
    
    // Remove notes in reverse order to maintain indices
    notesToRemove.sort((a, b) => b - a).forEach(index => {
      notes.value.splice(index, 1)
    })
    
    return notesToRemove.length
  }

  return {
    // State
    notes: sortedNotes,
    noteForm,
    currentView,
    selectedNote,
    editingNote,
    isLoading: isPublishing,
    isPublishing,
    isFetchingNotes,
    error,

    // Actions
    fetchUserNotes,
    publishNote,
    updateNote,
    deleteNote,
    cleanup,
    debugState,
    removeNoteFromLocalState,
    cleanupDuplicateNotes,
    
    // View management
    setView,
    viewNote,
    editNote,
    createNewNote,
    
    // Utilities
    formatDate,
    createNoteTitle,
    createNotePreview,
    extractHashtags
  }
}