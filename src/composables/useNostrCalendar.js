import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'

// NIP-52 Calendar Event Kinds
const CALENDAR_EVENT_KINDS = {
  TIME_BASED: 31922, // Time-based calendar event
  DATE_BASED: 31923  // Date-based calendar event
}

// Global state for calendar events
const events = ref([])
const isLoading = ref(false)
const error = ref('')
let currentSubscription = null
const processedEventIds = new Set()

// Event form state
const eventForm = reactive({
  title: '',
  description: '',
  type: 'time-based', // time-based or date-based
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  location: '',
  participants: [],
  tags: []
})

// UI state
const currentView = ref('list') // list, create, edit, view
const selectedEvent = ref(null)
const editingEvent = ref(null)

export function useNostrCalendar() {
  const { currentUser, isAuthenticated, writeRelays, readRelays } = useNostrAuth()

  // Computed properties
  const userEvents = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    return events.value.filter(event => event.pubkey === currentUser.value.pubkey)
  })

  const sortedEvents = computed(() => {
    return [...userEvents.value].sort((a, b) => {
      const timeA = a.type === 'time-based' ? a.start : new Date(a.start_date).getTime() / 1000
      const timeB = b.type === 'time-based' ? b.start : new Date(b.start_date).getTime() / 1000
      return timeA - timeB
    })
  })

  // Create calendar event data structure
  const createEventData = (calendarEvent) => {
    try {
      const isTimeBased = calendarEvent.kind === CALENDAR_EVENT_KINDS.TIME_BASED
      
      // Extract event data from tags
      const title = calendarEvent.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled Event'
      const description = calendarEvent.content || ''
      const location = calendarEvent.tags.find(tag => tag[0] === 'location')?.[1] || ''
      
      let eventData = {
        id: calendarEvent.id,
        title,
        description,
        location,
        type: isTimeBased ? 'time-based' : 'date-based',
        pubkey: calendarEvent.pubkey,
        created_at: calendarEvent.created_at,
        participants: [],
        tags: [],
        rawEvent: calendarEvent
      }

      if (isTimeBased) {
        // Time-based event (kind 31922)
        const startTag = calendarEvent.tags.find(tag => tag[0] === 'start')
        const endTag = calendarEvent.tags.find(tag => tag[0] === 'end')
        
        eventData.start = startTag ? parseInt(startTag[1]) : null
        eventData.end = endTag ? parseInt(endTag[1]) : null
      } else {
        // Date-based event (kind 31923)
        const startDateTag = calendarEvent.tags.find(tag => tag[0] === 'start_date')
        const endDateTag = calendarEvent.tags.find(tag => tag[0] === 'end_date')
        
        eventData.start_date = startDateTag ? startDateTag[1] : null
        eventData.end_date = endDateTag ? endDateTag[1] : null
      }

      // Extract participants (p tags)
      eventData.participants = calendarEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => tag[1])

      // Extract other tags (t tags)
      eventData.tags = calendarEvent.tags
        .filter(tag => tag[0] === 't')
        .map(tag => tag[1])

      return eventData
    } catch (error) {
      console.error('Failed to create event data:', error)
      return null
    }
  }

  // Fetch calendar events from Nostr relays
  const fetchCalendarEvents = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch calendar events')
      return
    }

    if (!nostrRelayManager.isInitialized) {
      console.log('Relay manager not initialized, cannot fetch calendar events')
      error.value = 'Relay manager not initialized'
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching calendar events for user:', currentUser.value.pubkey.substring(0, 8) + '...')

      // Subscribe to calendar events (both time-based and date-based)
      currentSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [CALENDAR_EVENT_KINDS.TIME_BASED, CALENDAR_EVENT_KINDS.DATE_BASED],
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
          console.log('Received calendar event:', event.kind, event.id.substring(0, 16) + '...', 'at', new Date().toISOString())
          
          // Check if we've already processed this event ID
          if (processedEventIds.has(event.id)) {
            console.log('⚠️ Event already processed, skipping:', event.id.substring(0, 16) + '...')
            return
          }
          
          // Mark this event as processed
          processedEventIds.add(event.id)
          
          if (event.kind === CALENDAR_EVENT_KINDS.TIME_BASED || event.kind === CALENDAR_EVENT_KINDS.DATE_BASED) {
            // Handle calendar event
            const existingIndex = events.value.findIndex(e => e.id === event.id)
            
            if (existingIndex === -1) {
              // Add new event
              console.log('✅ Adding new calendar event to local state:', event.id.substring(0, 16) + '...')
              const eventData = createEventData(event)
              if (eventData) {
                events.value.push(eventData)
              }
            } else {
              // Update existing event
              console.log('🔄 Updating existing calendar event in local state:', event.id.substring(0, 16) + '...')
              const eventData = createEventData(event)
              if (eventData) {
                events.value[existingIndex] = eventData
              }
            }
          } else if (event.kind === 5) {
            // Handle deletion events
            console.log('🗑️ Processing deletion event:', event.id.substring(0, 16) + '...')
            
            const deletedEventIds = event.tags
              .filter(tag => tag[0] === 'e')
              .map(tag => tag[1])
            
            deletedEventIds.forEach(deletedId => {
              const index = events.value.findIndex(e => e.id === deletedId)
              if (index !== -1) {
                console.log('🗑️ Removing deleted event from local state:', deletedId.substring(0, 16) + '...')
                events.value.splice(index, 1)
              }
            })
          }
        },
        oneose: () => {
          console.log('End of stored calendar events')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Calendar events subscription closed:', reason)
          isLoading.value = false
        }
      })

      return currentSubscription

    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
      error.value = 'Failed to fetch calendar events: ' + err.message
      isLoading.value = false
    }
  }

  // Create calendar event
  const createEvent = async (eventData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!eventData.title.trim()) {
      throw new Error('Event title is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Creating calendar event...')

      const isTimeBased = eventData.type === 'time-based'
      const kind = isTimeBased ? CALENDAR_EVENT_KINDS.TIME_BASED : CALENDAR_EVENT_KINDS.DATE_BASED

      // Build tags
      let tags = [
        ['title', eventData.title.trim()],
        ['d', Date.now().toString()] // Identifier for replaceable events
      ]

      if (isTimeBased) {
        // Time-based event
        if (eventData.start_date && eventData.start_time) {
          const startDateTime = new Date(`${eventData.start_date}T${eventData.start_time}`)
          tags.push(['start', Math.floor(startDateTime.getTime() / 1000).toString()])
        }
        
        if (eventData.end_date && eventData.end_time) {
          const endDateTime = new Date(`${eventData.end_date}T${eventData.end_time}`)
          tags.push(['end', Math.floor(endDateTime.getTime() / 1000).toString()])
        }
      } else {
        // Date-based event
        if (eventData.start_date) {
          tags.push(['start_date', eventData.start_date])
        }
        
        if (eventData.end_date) {
          tags.push(['end_date', eventData.end_date])
        }
      }

      if (eventData.location?.trim()) {
        tags.push(['location', eventData.location.trim()])
      }

      // Add participant tags
      eventData.participants.forEach(participant => {
        if (participant.trim()) {
          tags.push(['p', participant.trim()])
        }
      })

      // Add hashtags
      eventData.tags.forEach(tag => {
        if (tag.trim()) {
          tags.push(['t', tag.trim()])
        }
      })

      // Create event template
      let eventTemplate = {
        kind,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: eventData.description.trim()
      }

      console.log('Signing calendar event...')
      
      // Sign the event using the browser extension
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      console.log('Publishing calendar event to relays...')

      // Publish to Nostr relays
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Calendar event published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

      // Add the event to our local state immediately
      const newEvent = createEventData(signedEvent)
      if (newEvent) {
        const existingIndex = events.value.findIndex(e => e.id === signedEvent.id)
        if (existingIndex === -1) {
          processedEventIds.add(signedEvent.id)
          events.value.unshift(newEvent)
        }
      }

      // Reset form
      Object.assign(eventForm, {
        title: '',
        description: '',
        type: 'time-based',
        start_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        location: '',
        participants: [],
        tags: []
      })

      return {
        event: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = 'Failed to create event: ' + err.message
      console.error('❌ Calendar event creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update calendar event (creates new event and deletes old one)
  const updateEvent = async (eventId, newEventData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Create new event
      const result = await createEvent(newEventData)
      
      // Delete old event
      await deleteEvent(eventId)
      
      return result
    } catch (err) {
      error.value = 'Failed to update event: ' + err.message
      throw err
    }
  }

  // Delete calendar event
  const deleteEvent = async (eventId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      console.log('Publishing deletion event for calendar event:', eventId)

      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', eventId]],
        content: 'Calendar event deleted'
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
        const index = events.value.findIndex(event => event.id === eventId)
        if (index !== -1) {
          events.value.splice(index, 1)
        }
        
        console.log('✅ Calendar event deletion published successfully')
      }

      return result

    } catch (err) {
      error.value = 'Failed to delete event: ' + err.message
      console.error('❌ Calendar event deletion error:', err)
      throw err
    }
  }

  // View management
  const setView = (view) => {
    currentView.value = view
    error.value = ''
  }

  const viewEvent = (event) => {
    selectedEvent.value = event
    currentView.value = 'view'
  }

  const editEvent = (event) => {
    editingEvent.value = event
    
    // Populate form with event data
    Object.assign(eventForm, {
      title: event.title,
      description: event.description,
      type: event.type,
      location: event.location || '',
      participants: [...(event.participants || [])],
      tags: [...(event.tags || [])]
    })

    if (event.type === 'time-based') {
      if (event.start) {
        const startDate = new Date(event.start * 1000)
        eventForm.start_date = startDate.toISOString().split('T')[0]
        eventForm.start_time = startDate.toTimeString().split(' ')[0].substring(0, 5)
      }
      if (event.end) {
        const endDate = new Date(event.end * 1000)
        eventForm.end_date = endDate.toISOString().split('T')[0]
        eventForm.end_time = endDate.toTimeString().split(' ')[0].substring(0, 5)
      }
    } else {
      eventForm.start_date = event.start_date || ''
      eventForm.end_date = event.end_date || ''
    }

    currentView.value = 'edit'
  }

  const createNewEvent = () => {
    editingEvent.value = null
    Object.assign(eventForm, {
      title: '',
      description: '',
      type: 'time-based',
      start_date: '',
      end_date: '',
      start_time: '',
      end_time: '',
      location: '',
      participants: [],
      tags: []
    })
    currentView.value = 'create'
  }

  // Cleanup function
  const cleanup = () => {
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }
    processedEventIds.clear()
  }

  // Initialize events when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      if (events.value.length === 0) {
        if (currentSubscription) {
          currentSubscription.close()
          currentSubscription = null
        }
        processedEventIds.clear()
        
        const initializeEvents = () => {
          if (nostrRelayManager.isInitialized) {
            fetchCalendarEvents()
          } else {
            const handleInitialized = () => {
              fetchCalendarEvents()
              nostrRelayManager.removeEventListener('initialized', handleInitialized)
            }
            nostrRelayManager.addEventListener('initialized', handleInitialized)
          }
        }
        
        initializeEvents()
      }
    } else {
      if (currentSubscription) {
        currentSubscription.close()
        currentSubscription = null
      }
      processedEventIds.clear()
      events.value = []
    }
  }, { immediate: true })

  return {
    // State
    events: sortedEvents,
    eventForm,
    currentView,
    selectedEvent,
    editingEvent,
    isLoading,
    error,

    // Actions
    fetchCalendarEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    cleanup,
    
    // View management
    setView,
    viewEvent,
    editEvent,
    createNewEvent,
    
    // Constants
    CALENDAR_EVENT_KINDS
  }
}