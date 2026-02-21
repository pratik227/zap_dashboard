import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { useContentZaps } from './useContentZaps.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'

// Global state for notes
const notes = ref([])
const isFetchingNotes = ref(false)
const isLoading = ref(false)
const error = ref('')
let currentSubscription = null // Track current subscription
const processedEventIds = new Set() // Track processed event IDs to prevent duplicates
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
  const { startZapTracking } = useContentZaps()

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
      console.log('Not authenticated, cannot fetch notes')
      return
    }

    await nostrRelayManager.ready()

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
      console.log('Fetching notes for user:', currentUser.value.pubkey.substring(0, 8) + '...')

      // Subscribe to user's kind:1 events (notes) and kind:5 deletion events
      // Increased limit for users with many notes
      currentSubscription = nostrRelayManager.subscribeToEvents([
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
          console.log('Received event:', event.kind === 1 ? 'note' : 'deletion', event.id.substring(0, 16) + '...', 'at', new Date().toISOString())
          
          // Check if we've already processed this event ID
          if (processedEventIds.has(event.id)) {
            console.log('⚠️ Event already processed, skipping:', event.id.substring(0, 16) + '...')
            return
          }
          
          // Mark this event as processed
          processedEventIds.add(event.id)
          
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
                console.log('⚠️ Found duplicate content, skipping:', event.id.substring(0, 16) + '...')
                return
              }
              
              // Add new note
              console.log('✅ Adding new note to local state:', event.id.substring(0, 16) + '...')
              notes.value.push({
                ...event,
                title: createNoteTitle(event.content),
                preview: createNotePreview(event.content),
                hashtags: extractHashtags(event.content)
              })
            } else {
              // Update existing note
              console.log('🔄 Updating existing note in local state:', event.id.substring(0, 16) + '...')
              notes.value[existingIndex] = {
                ...event,
                title: createNoteTitle(event.content),
                preview: createNotePreview(event.content),
                hashtags: extractHashtags(event.content)
              }
            }
          } else if (event.kind === 5) {
            // Handle deletion events
            console.log('🗑️ Processing deletion event:', event.id.substring(0, 16) + '...')
            
            // Extract the event IDs being deleted from the tags
            const deletedEventIds = event.tags
              .filter(tag => tag[0] === 'e')
              .map(tag => tag[1])
            
            console.log('Deletion event targets:', deletedEventIds.map(id => id.substring(0, 16) + '...'))
            
            // Remove the deleted notes from local state
            deletedEventIds.forEach(deletedId => {
              const index = notes.value.findIndex(note => note.id === deletedId)
              if (index !== -1) {
                console.log('🗑️ Removing deleted note from local state:', deletedId.substring(0, 16) + '...')
                notes.value.splice(index, 1)
              }
            })
          }
        },
        oneose: () => {
          console.log('End of stored notes events')
          isFetchingNotes.value = false
          if (fetchTimeout) {
            clearTimeout(fetchTimeout)
            fetchTimeout = null
          }
        },
        onclose: (reason) => {
          console.log('Notes subscription closed:', reason)
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
      error.value = 'Failed to fetch notes: ' + err.message
      isFetchingNotes.value = false
      if (fetchTimeout) {
        clearTimeout(fetchTimeout)
        fetchTimeout = null
      }
    }
  }

  // Publish note to Nostr
  const publishNote = async (content, tags = [], pTags = []) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!content.trim()) {
      throw new Error('Note content cannot be empty')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Publishing note to Nostr...')

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

      console.log('Signing note event...')
      
      // Sign the event using the browser extension
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      console.log('Publishing note to relays...')

      // Publish to Nostr relays
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Note published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

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
        console.log('Manually adding published note to local state:', signedEvent.id.substring(0, 16) + '...')
        processedEventIds.add(signedEvent.id) // Mark as processed
        notes.value.unshift(newNote)
      } else {
        console.log('Note already exists in local state, skipping manual add:', signedEvent.id.substring(0, 16) + '...')
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
      error.value = 'Failed to publish note: ' + err.message
      console.error('❌ Note publishing error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update existing note
  const updateNote = async (noteId, newContent, tags = [], pTags = []) => {
    // In Nostr, we can't actually update events, so we publish a new one
    // and mark the old one as deleted with a kind:5 event
    
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!newContent.trim()) {
      throw new Error('Note content cannot be empty')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Updating note...')

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

      console.log('Signing updated note event...')
      
      // Sign the event using the browser extension
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      console.log('Publishing updated note to relays...')

      // Publish to Nostr relays
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Updated note published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

      // Start tracking zaps for the new note
      startZapTracking(signedEvent.id)

      // Now publish a deletion event for the old note
      console.log('Publishing deletion event for old note:', noteId)
      
      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', noteId]], // Reference to the event being deleted
        content: 'Note updated - replaced with new version'
      }

      // Sign the deletion event
      const signedDeletionEvent = await window.nostr.signEvent(deletionEvent)
      
      // Verify the signed deletion event
      const isDeletionValid = verifyEvent(signedDeletionEvent)
      if (!isDeletionValid) {
        console.warn('Deletion event signature verification failed, but continuing...')
      }

      // Publish deletion event to Nostr relays
      const deletionResult = await nostrRelayManager.publishEvent(signedDeletionEvent)
      
      if (deletionResult.successful > 0) {
        console.log('✅ Deletion event published successfully for old note')
      } else {
        console.warn('⚠️ Failed to publish deletion event, but note update was successful')
      }

      // Remove the old note from local state
      const oldNoteIndex = notes.value.findIndex(note => note.id === noteId)
      if (oldNoteIndex !== -1) {
        console.log('Removing old note from local state:', noteId.substring(0, 16) + '...')
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
        console.log('Manually adding updated note to local state:', signedEvent.id.substring(0, 16) + '...')
        processedEventIds.add(signedEvent.id) // Mark as processed
        notes.value.unshift(newNote)
      } else {
        console.log('Updated note already exists in local state, skipping manual add:', signedEvent.id.substring(0, 16) + '...')
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
      error.value = 'Failed to update note: ' + err.message
      console.error('❌ Note update error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete note (publish kind:5 deletion event)
  const deleteNote = async (noteId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      console.log('Publishing deletion event for note:', noteId)

      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', noteId]], // Reference to the event being deleted
        content: 'Note deleted'
      }

      // Sign the deletion event
      const signedEvent = await window.nostr.signEvent(deletionEvent)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Deletion event signature verification failed')
      }

      // Publish to Nostr relays
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful > 0) {
        // Remove from local state
        const index = notes.value.findIndex(note => note.id === noteId)
        if (index !== -1) {
          notes.value.splice(index, 1)
        }
        
        console.log('✅ Note deletion published successfully')
      }

      return result

    } catch (err) {
      error.value = 'Failed to delete note: ' + err.message
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
        fetchUserNotes()

        registerRefresh('notes', async () => {
          if (currentSubscription) { currentSubscription.close(); currentSubscription = null }
          processedEventIds.clear()
          await fetchUserNotes()
        })

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
    console.log('🔍 Current Notes State:')
    console.log('- Total notes:', notes.value.length)
    console.log('- Processed event IDs:', processedEventIds.size)
    console.log('- Notes:', notes.value.map(note => ({
      id: note.id.substring(0, 16) + '...',
      title: note.title,
      content: note.content.substring(0, 50) + '...',
      created_at: new Date(note.created_at * 1000).toISOString()
    })))
  }

  // Function to manually remove a note from local state (for cleanup)
  const removeNoteFromLocalState = (noteId) => {
    const index = notes.value.findIndex(note => note.id === noteId)
    if (index !== -1) {
      console.log('🗑️ Manually removing note from local state:', noteId.substring(0, 16) + '...')
      notes.value.splice(index, 1)
      return true
    }
    return false
  }

  // Function to check for and remove duplicate notes
  const cleanupDuplicateNotes = () => {
    console.log('🧹 Cleaning up duplicate notes...')
    const seenIds = new Set()
    const seenContent = new Map() // content -> first note id
    
    const notesToRemove = []
    
    notes.value.forEach((note, index) => {
      // Check for duplicate IDs (shouldn't happen, but just in case)
      if (seenIds.has(note.id)) {
        console.log('Found duplicate ID, marking for removal:', note.id.substring(0, 16) + '...')
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
            console.log('Found duplicate content, removing older note:', firstNoteId.substring(0, 16) + '...')
            notesToRemove.push(firstIndex)
            seenContent.set(contentKey, note.id)
          }
        } else {
          console.log('Found duplicate content, marking current note for removal:', note.id.substring(0, 16) + '...')
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
    
    console.log(`🧹 Cleanup complete. Removed ${notesToRemove.length} duplicate notes.`)
    return notesToRemove.length
  }

  return {
    // State
    notes: sortedNotes,
    noteForm,
    currentView,
    selectedNote,
    editingNote,
    isLoading,
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