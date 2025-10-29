import { ref, computed, watch } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { verifyEvent } from 'nostr-tools/pure'

// NIP-52 Calendar List Kind
const CALENDAR_LIST_KIND = 31924

// Global state for calendar lists
const calendarLists = ref([])
const isLoading = ref(false)
const error = ref('')
let currentSubscription = null
const processedCalendarIds = new Set()

// Default colors for calendars
export const CALENDAR_COLORS = [
  { name: 'Red', value: '#FF6B6B' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Yellow', value: '#FFD93D' },
  { name: 'Green', value: '#6BCF7F' },
  { name: 'Blue', value: '#4D96FF' },
  { name: 'Purple', value: '#B084CC' },
  { name: 'Pink', value: '#FF6B9D' },
  { name: 'Gray', value: '#95A5A6' }
]

// UI state
const selectedCalendars = ref(new Set())
const defaultCalendarId = ref(null)

// Track if initialization has already been set up
let isWatchInitialized = false
let hasFetchedCalendars = false

export function useNostrCalendarList() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  // Load state from local storage
  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('nostr_calendar_lists')
      if (stored) {
        calendarLists.value = JSON.parse(stored)
      }

      const storedSelected = localStorage.getItem('nostr_selected_calendars')
      if (storedSelected) {
        selectedCalendars.value = new Set(JSON.parse(storedSelected))
      }

      const storedDefault = localStorage.getItem('nostr_default_calendar')
      if (storedDefault) {
        defaultCalendarId.value = storedDefault
      }
    } catch (err) {
      console.error('Failed to load calendar lists from local storage:', err)
    }
  }

  // Save state to local storage
  const saveToLocalStorage = () => {
    try {
      localStorage.setItem('nostr_calendar_lists', JSON.stringify(calendarLists.value))
      localStorage.setItem('nostr_selected_calendars', JSON.stringify([...selectedCalendars.value]))
      if (defaultCalendarId.value) {
        localStorage.setItem('nostr_default_calendar', defaultCalendarId.value)
      }
    } catch (err) {
      console.error('Failed to save calendar lists to local storage:', err)
    }
  }

  // Computed properties
  const userCalendarLists = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    return calendarLists.value.filter(cal => cal.pubkey === currentUser.value.pubkey)
  })

  const sortedCalendarLists = computed(() => {
    return [...userCalendarLists.value].sort((a, b) => {
      // Default calendar first
      if (a.d_tag === defaultCalendarId.value) return -1
      if (b.d_tag === defaultCalendarId.value) return 1
      // Then sort by creation date
      return b.created_at - a.created_at
    })
  })

  const defaultCalendar = computed(() => {
    if (!defaultCalendarId.value) return null
    return calendarLists.value.find(cal => cal.d_tag === defaultCalendarId.value)
  })

  // Create calendar data structure from Nostr event
  const createCalendarData = (calendarEvent) => {
    try {
      const title = calendarEvent.tags.find(tag => tag[0] === 'title')?.[1] || 'Untitled Calendar'
      const color = calendarEvent.tags.find(tag => tag[0] === 'color')?.[1] || CALENDAR_COLORS[0].value
      const d_tag = calendarEvent.tags.find(tag => tag[0] === 'd')?.[1]

      // Get event references
      const eventRefs = calendarEvent.tags
        .filter(tag => tag[0] === 'a')
        .map(tag => tag[1])

      return {
        id: calendarEvent.id,
        d_tag,
        title,
        description: calendarEvent.content || '',
        color,
        pubkey: calendarEvent.pubkey,
        created_at: calendarEvent.created_at,
        event_refs: eventRefs,
        event_count: eventRefs.length,
        rawEvent: calendarEvent
      }
    } catch (error) {
      console.error('Failed to create calendar data:', error)
      return null
    }
  }

  // Fetch calendar lists from Nostr relays
  const fetchCalendarLists = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch calendar lists')
      return
    }

    if (!nostrRelayManager.isInitialized) {
      console.log('Relay manager not initialized, cannot fetch calendar lists')
      error.value = 'Relay manager not initialized'
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching calendar lists for user:', currentUser.value.pubkey.substring(0, 8) + '...')

      // Subscribe to calendar list events
      currentSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [CALENDAR_LIST_KIND],
          authors: [currentUser.value.pubkey],
          limit: 50
        },
        {
          kinds: [5], // Deletion events
          authors: [currentUser.value.pubkey],
          '#k': [CALENDAR_LIST_KIND.toString()],
          limit: 50
        }
      ], {
        onevent: (event) => {
          console.log('Received calendar list event:', event.kind, event.id.substring(0, 16) + '...')

          if (processedCalendarIds.has(event.id)) {
            console.log('⚠️ Calendar already processed, skipping:', event.id.substring(0, 16) + '...')
            return
          }

          processedCalendarIds.add(event.id)

          if (event.kind === CALENDAR_LIST_KIND) {
            const existingIndex = calendarLists.value.findIndex(c => c.d_tag ===
              event.tags.find(tag => tag[0] === 'd')?.[1])

            if (existingIndex === -1) {
              console.log('✅ Adding new calendar list:', event.id.substring(0, 16) + '...')
              const calendarData = createCalendarData(event)
              if (calendarData) {
                calendarLists.value.push(calendarData)
                // Auto-select new calendar
                selectedCalendars.value.add(calendarData.d_tag)
                // Set as default if it's the first calendar
                if (calendarLists.value.length === 1) {
                  defaultCalendarId.value = calendarData.d_tag
                }
                saveToLocalStorage()
              }
            } else {
              console.log('🔄 Updating existing calendar list:', event.id.substring(0, 16) + '...')
              const calendarData = createCalendarData(event)
              if (calendarData) {
                calendarLists.value[existingIndex] = calendarData
                saveToLocalStorage()
              }
            }
          } else if (event.kind === 5) {
            // Handle deletion events
            console.log('🗑️ Processing calendar deletion event:', event.id.substring(0, 16) + '...')

            const deletedDTags = event.tags
              .filter(tag => tag[0] === 'a' && tag[1].startsWith(`${CALENDAR_LIST_KIND}:`))
              .map(tag => tag[1].split(':')[2])

            deletedDTags.forEach(dTag => {
              const index = calendarLists.value.findIndex(c => c.d_tag === dTag)
              if (index !== -1) {
                console.log('🗑️ Removing deleted calendar list:', dTag)
                calendarLists.value.splice(index, 1)
                selectedCalendars.value.delete(dTag)
                if (defaultCalendarId.value === dTag) {
                  defaultCalendarId.value = calendarLists.value[0]?.d_tag || null
                }
                saveToLocalStorage()
              }
            })
          }
        },
        oneose: () => {
          console.log('End of stored calendar lists')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Calendar lists subscription closed:', reason)
          isLoading.value = false
        }
      })

      return currentSubscription

    } catch (err) {
      console.error('Failed to fetch calendar lists:', err)
      error.value = 'Failed to fetch calendar lists: ' + err.message
      isLoading.value = false
    }
  }

  // Create calendar list
  const createCalendarList = async (calendarData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!calendarData.title?.trim()) {
      throw new Error('Calendar title is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Creating calendar list...')

      const d_tag = Date.now().toString() + '-' + Math.random().toString(36).substring(7)

      let tags = [
        ['d', d_tag],
        ['title', calendarData.title.trim()],
        ['color', calendarData.color || CALENDAR_COLORS[0].value]
      ]

      let eventTemplate = {
        kind: CALENDAR_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: calendarData.description?.trim() || ''
      }

      console.log('Signing calendar list event...')

      const signedEvent = await window.nostr.signEvent(eventTemplate)

      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      console.log('Publishing calendar list to relays...')

      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Calendar list published successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

      // Add to local state immediately
      const newCalendar = createCalendarData(signedEvent)
      if (newCalendar) {
        const existingIndex = calendarLists.value.findIndex(c => c.d_tag === d_tag)
        if (existingIndex === -1) {
          processedCalendarIds.add(signedEvent.id)
          calendarLists.value.push(newCalendar)
          selectedCalendars.value.add(d_tag)

          // Set as default if it's the first calendar
          if (calendarLists.value.length === 1) {
            defaultCalendarId.value = d_tag
          }

          saveToLocalStorage()
        }
      }

      return {
        calendar: signedEvent,
        d_tag,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = 'Failed to create calendar list: ' + err.message
      console.error('❌ Calendar list creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update calendar list (creates new version)
  const updateCalendarList = async (d_tag, calendarData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const existingCalendar = calendarLists.value.find(c => c.d_tag === d_tag)
    if (!existingCalendar) {
      throw new Error('Calendar not found')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Updating calendar list:', d_tag)

      let tags = [
        ['d', d_tag],
        ['title', calendarData.title?.trim() || existingCalendar.title],
        ['color', calendarData.color || existingCalendar.color]
      ]

      // Preserve existing event references
      existingCalendar.event_refs.forEach(ref => {
        tags.push(['a', ref])
      })

      let eventTemplate = {
        kind: CALENDAR_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: calendarData.description?.trim() || existingCalendar.description
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)

      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Calendar list updated successfully')

      // Update local state
      const newCalendar = createCalendarData(signedEvent)
      if (newCalendar) {
        const index = calendarLists.value.findIndex(c => c.d_tag === d_tag)
        if (index !== -1) {
          calendarLists.value[index] = newCalendar
          saveToLocalStorage()
        }
      }

      return result

    } catch (err) {
      error.value = 'Failed to update calendar list: ' + err.message
      console.error('❌ Calendar list update error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete calendar list
  const deleteCalendarList = async (d_tag) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const calendar = calendarLists.value.find(c => c.d_tag === d_tag)
    if (!calendar) {
      throw new Error('Calendar not found')
    }

    try {
      console.log('Deleting calendar list:', d_tag)

      const coordinate = `${CALENDAR_LIST_KIND}:${currentUser.value.pubkey}:${d_tag}`

      let deletionEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['a', coordinate]
        ],
        content: 'Calendar deleted'
      }

      const signedEvent = await window.nostr.signEvent(deletionEvent)

      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Deletion event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful > 0) {
        const index = calendarLists.value.findIndex(c => c.d_tag === d_tag)
        if (index !== -1) {
          calendarLists.value.splice(index, 1)
          selectedCalendars.value.delete(d_tag)

          if (defaultCalendarId.value === d_tag) {
            defaultCalendarId.value = calendarLists.value[0]?.d_tag || null
          }

          saveToLocalStorage()
        }

        console.log('✅ Calendar list deleted successfully')
      }

      return result

    } catch (err) {
      error.value = 'Failed to delete calendar list: ' + err.message
      console.error('❌ Calendar list deletion error:', err)
      throw err
    }
  }

  // Toggle calendar selection
  const toggleCalendarSelection = (d_tag) => {
    if (selectedCalendars.value.has(d_tag)) {
      selectedCalendars.value.delete(d_tag)
    } else {
      selectedCalendars.value.add(d_tag)
    }
    saveToLocalStorage()
  }

  // Set default calendar
  const setDefaultCalendar = (d_tag) => {
    defaultCalendarId.value = d_tag
    saveToLocalStorage()
  }

  // Get calendar by d_tag
  const getCalendar = (d_tag) => {
    return calendarLists.value.find(c => c.d_tag === d_tag)
  }

  // Check if calendar is selected
  const isCalendarSelected = (d_tag) => {
    return selectedCalendars.value.has(d_tag)
  }

  // Cleanup function
  const cleanup = () => {
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }
    processedCalendarIds.clear()
  }

  // Initialize calendar lists when authenticated (only once)
  if (!isWatchInitialized) {
    isWatchInitialized = true

    watch(isAuthenticated, (authenticated) => {
      if (authenticated) {
        loadFromLocalStorage()

        if (!hasFetchedCalendars) {
          hasFetchedCalendars = true

          if (currentSubscription) {
            currentSubscription.close()
            currentSubscription = null
          }
          processedCalendarIds.clear()

          const initializeCalendarLists = () => {
            if (nostrRelayManager.isInitialized) {
              fetchCalendarLists()
            } else {
              const handleInitialized = () => {
                fetchCalendarLists()
                nostrRelayManager.removeEventListener('initialized', handleInitialized)
              }
              nostrRelayManager.addEventListener('initialized', handleInitialized)
            }
          }

          initializeCalendarLists()
        }
      } else {
        hasFetchedCalendars = false
        if (currentSubscription) {
          currentSubscription.close()
          currentSubscription = null
        }
        processedCalendarIds.clear()
        calendarLists.value = []
        selectedCalendars.value.clear()
        defaultCalendarId.value = null
      }
    }, { immediate: true })
  }

  return {
    // State
    calendarLists: sortedCalendarLists,
    isLoading,
    error,
    selectedCalendars,
    defaultCalendar,
    defaultCalendarId,

    // Actions
    fetchCalendarLists,
    createCalendarList,
    updateCalendarList,
    deleteCalendarList,
    toggleCalendarSelection,
    setDefaultCalendar,
    getCalendar,
    isCalendarSelected,
    cleanup,

    // Constants
    CALENDAR_LIST_KIND,
    CALENDAR_COLORS
  }
}
