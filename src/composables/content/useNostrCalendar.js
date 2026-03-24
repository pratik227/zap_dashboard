import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { useNotifications } from '../core/useNotifications.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { nip52 } from '../../services/nostr/nostrImports.js'

// NIP-52 Calendar Event Kinds
const CALENDAR_EVENT_KINDS = {
  DATE_BASED: 31922, // Date-based calendar event (all-day events)
  TIME_BASED: 31923, // Time-based calendar event (with specific times)
  CALENDAR: 31924,   // Calendar collection
  RSVP: 31925        // Calendar event RSVP
}

// Global state for calendar events
const events = ref([])
const rsvps = ref([]) // RSVPs for calendar events
const isLoading = ref(false)
const error = ref('')
let currentSubscription = null
let rsvpSubscription = null
const processedEventIds = new Set()
const processedRsvpIds = new Set()

// Event form state
const eventForm = reactive({
  title: '',
  description: '',
  type: 'time-based', // time-based or date-based
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  start_tzid: '',
  end_tzid: '',
  location: '',
  geohash: '',
  participants: [], // Array of {pubkey, relay, role}
  tags: [],
  references: [] // Array of URLs
})

// UI state
const currentView = ref('list') // list, create, edit, view
const selectedEvent = ref(null)
const editingEvent = ref(null)

export function useNostrCalendar() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  const { handleCalendarInvite, startEventMonitoring, stopEventMonitoring } = useNotifications()

  // Computed properties
  const userEvents = computed(() => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    return events.value.filter(event => event.pubkey === currentUser.value.pubkey)
  })

  // Computed property for ALL events (including invited events), sorted by date
  const sortedEvents = computed(() => {
    return [...events.value].sort((a, b) => {
      const timeA = a.type === 'time-based' ? a.start : new Date(a.start_date).getTime() / 1000
      const timeB = b.type === 'time-based' ? b.start : new Date(b.start_date).getTime() / 1000
      return timeB - timeA // Sort by most recent first
    })
  })

  // Fetch user profile metadata using ProfileService
  const fetchUserProfile = async (pubkey) => {
    try {
      const profile = await profileService.get(pubkey)
      if (!profile) return null
      return {
        name: profile.name || profile.display_name,
        picture: profile.picture,
        nip05: profile.nip05
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      return null
    }
  }

  // Create calendar event data structure using nip52 parsing
  const createEventData = async (calendarEvent) => {
    try {
      const isTimeBased = calendarEvent.kind === CALENDAR_EVENT_KINDS.TIME_BASED

      // Use nip52 parser for core fields (works for time-based kind 31923)
      // For date-based events, fall back to manual parsing since nip52 only covers time-based
      let eventData = {
        id: calendarEvent.id,
        type: isTimeBased ? 'time-based' : 'date-based',
        pubkey: calendarEvent.pubkey,
        created_at: calendarEvent.created_at,
        participants: [],
        tags: [],
        references: [],
        rawEvent: calendarEvent
      }

      if (isTimeBased) {
        const parsed = nip52.parseTimeBasedCalendarEvent(calendarEvent)
        // Map nip52 parsed result to our UI data shape
        eventData.title = parsed.name || 'Untitled Event'
        eventData.description = parsed.content || calendarEvent.content || ''
        eventData.location = parsed.location || ''
        eventData.geohash = parsed.geohash || ''
        eventData.start = parsed.start ?? null
        eventData.end = parsed.end ?? null
        eventData.start_tzid = parsed.startTzid || ''
        eventData.end_tzid = parsed.endTzid || ''
      } else {
        // Date-based event (kind 31922) — nip52 only covers time-based, parse manually
        eventData.title = calendarEvent.tags.find(tag => tag[0] === 'name')?.[1] || 'Untitled Event'
        eventData.description = calendarEvent.content || ''
        eventData.location = calendarEvent.tags.find(tag => tag[0] === 'location')?.[1] || ''
        eventData.geohash = calendarEvent.tags.find(tag => tag[0] === 'g')?.[1] || ''
        const startTag = calendarEvent.tags.find(tag => tag[0] === 'start')
        const endTag = calendarEvent.tags.find(tag => tag[0] === 'end')
        eventData.start_date = startTag ? startTag[1] : null
        eventData.end_date = endTag ? endTag[1] : null
      }

      // Extract participants (p tags) with relay and role
      // nip52 may parse participants, but we need relay+role+profile enrichment
      const participantTags = calendarEvent.tags
        .filter(tag => tag[0] === 'p')
        .map(tag => ({
          pubkey: tag[1],
          relay: tag[2] || '',
          role: tag[3] || ''
        }))

      // Batch fetch profiles for all participants at once (instead of one-by-one)
      if (participantTags.length > 0) {
        const pubkeys = participantTags.map(p => p.pubkey)
        try { await profileService.batch(pubkeys) } catch { /* use fallbacks */ }

        eventData.participants = participantTags.map(participant => {
          const profile = profileService.getCached(participant.pubkey)
          return {
            ...participant,
            name: profile?.name,
            picture: profile?.picture,
            nip05: profile?.nip05
          }
        })
      }

      // Extract hashtags (t tags)
      eventData.tags = calendarEvent.tags
        .filter(tag => tag[0] === 't')
        .map(tag => tag[1])

      // Extract references (r tags)
      eventData.references = calendarEvent.tags
        .filter(tag => tag[0] === 'r')
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
      return
    }

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useNostrCalendar] Relay manager not ready:', err.message)
      return
    }

    isLoading.value = true
    error.value = ''

    // Set a timeout to stop loading after 5 seconds
    const loadingTimeout = setTimeout(() => {
      if (isLoading.value) {
        isLoading.value = false
      }
    }, 5000)

    try {
      // Subscribe to calendar events (both time-based and date-based)
      currentSubscription = nostrService.subscribe([
        {
          // Events created by the user
          kinds: [CALENDAR_EVENT_KINDS.TIME_BASED, CALENDAR_EVENT_KINDS.DATE_BASED],
          authors: [currentUser.value.pubkey],
          limit: 100
        },
        {
          // Events where user is invited as participant (tagged with 'p' tag)
          kinds: [CALENDAR_EVENT_KINDS.TIME_BASED, CALENDAR_EVENT_KINDS.DATE_BASED],
          '#p': [currentUser.value.pubkey],
          limit: 100
        },
        {
          kinds: [5], // Deletion events
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: async (event) => {
          // Check if we've already processed this event ID
          if (processedEventIds.has(event.id)) {
            return
          }
          
          // Mark this event as processed
          processedEventIds.add(event.id)
          
          if (event.kind === CALENDAR_EVENT_KINDS.TIME_BASED || event.kind === CALENDAR_EVENT_KINDS.DATE_BASED) {
            // Handle calendar event
            const existingIndex = events.value.findIndex(e => e.id === event.id)
            
            if (existingIndex === -1) {
              // Add new event
              const eventData = await createEventData(event)
              if (eventData) {
                events.value.push(eventData)

                // Check if current user is invited (not the organizer)
                if (currentUser.value && eventData.pubkey !== currentUser.value.pubkey) {
                  const isInvited = eventData.participants?.some(p => p.pubkey === currentUser.value.pubkey)
                  if (isInvited) {
                    // Fetch organizer profile for the notification
                    const organizerProfile = await fetchUserProfile(eventData.pubkey)
                    handleCalendarInvite({
                      id: eventData.id,
                      title: eventData.title,
                      start: eventData.start,
                      start_date: eventData.start_date,
                      type: eventData.type,
                      organizer: eventData.pubkey,
                      organizerProfile: organizerProfile || null
                    })
                  }
                }
              }
            } else {
              // Update existing event
              const eventData = await createEventData(event)
              if (eventData) {
                events.value[existingIndex] = eventData
              }
            }
          } else if (event.kind === 5) {
            // Handle deletion events
            const deletedEventIds = event.tags
              .filter(tag => tag[0] === 'e')
              .map(tag => tag[1])
            
            deletedEventIds.forEach(deletedId => {
              const index = events.value.findIndex(e => e.id === deletedId)
              if (index !== -1) {
                events.value.splice(index, 1)
              }
            })
          }
        },
        oneose: () => {
          clearTimeout(loadingTimeout)
          isLoading.value = false
          // Close subscription after EOSE — refresh cycle will re-fetch
          setTimeout(() => {
            if (currentSubscription) {
              currentSubscription.close()
              currentSubscription = null
            }
          }, 3000)
        },
        onclose: () => {
          clearTimeout(loadingTimeout)
          isLoading.value = false
          currentSubscription = null
        }
      })

      return currentSubscription

    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
      error.value = getUserFriendlyError(err)
      clearTimeout(loadingTimeout)
      isLoading.value = false
    }
  }

  // Create calendar event
  const createEvent = async (eventData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!eventData.title.trim()) {
      throw new Error('Event title is required')
    }

    isLoading.value = true
    error.value = ''

    try {
      const isTimeBased = eventData.type === 'time-based'
      const dTag = Date.now().toString() // UUID/identifier for replaceable events

      let eventTemplate

      if (isTimeBased) {
        // Build nip52 time-based event input
        const nip52Input = {
          identifier: dTag,
          name: eventData.title.trim(),
          content: eventData.description.trim(),
        }

        if (eventData.start_date && eventData.start_time) {
          const startDateTime = new Date(`${eventData.start_date}T${eventData.start_time}`)
          nip52Input.start = Math.floor(startDateTime.getTime() / 1000)
        }

        if (eventData.end_date && eventData.end_time) {
          const endDateTime = new Date(`${eventData.end_date}T${eventData.end_time}`)
          nip52Input.end = Math.floor(endDateTime.getTime() / 1000)
        }

        if (eventData.start_tzid?.trim()) {
          nip52Input.startTzid = eventData.start_tzid.trim()
        }
        if (eventData.end_tzid?.trim()) {
          nip52Input.endTzid = eventData.end_tzid.trim()
        }
        if (eventData.location?.trim()) {
          nip52Input.location = eventData.location.trim()
        }
        if (eventData.geohash?.trim()) {
          nip52Input.geohash = eventData.geohash.trim()
        }

        // Build participants array for nip52
        if (Array.isArray(eventData.participants) && eventData.participants.length > 0) {
          nip52Input.participants = eventData.participants
            .map(p => {
              if (typeof p === 'string' && p.trim()) return { pubkey: p.trim() }
              if (p?.pubkey?.trim()) return { pubkey: p.pubkey.trim(), relay: p.relay?.trim() || '', role: p.role?.trim() || '' }
              return null
            })
            .filter(Boolean)
        }

        if (Array.isArray(eventData.tags) && eventData.tags.length > 0) {
          nip52Input.hashtags = eventData.tags.filter(t => t?.trim()).map(t => t.trim())
        }

        if (Array.isArray(eventData.references) && eventData.references.length > 0) {
          nip52Input.references = eventData.references.filter(r => r?.trim()).map(r => r.trim())
        }

        eventTemplate = nip52.createTimeBasedCalendarEventTemplate(nip52Input)
      } else {
        // Date-based event (kind 31922) — nip52 only covers time-based, build manually
        const kind = CALENDAR_EVENT_KINDS.DATE_BASED
        let tags = [
          ['d', dTag],
          ['name', eventData.title.trim()]
        ]

        if (eventData.start_date) {
          tags.push(['start', eventData.start_date])
        }
        if (eventData.end_date) {
          tags.push(['end', eventData.end_date])
        }
        if (eventData.location?.trim()) {
          tags.push(['location', eventData.location.trim()])
        }
        if (eventData.geohash?.trim()) {
          tags.push(['g', eventData.geohash.trim()])
        }

        // Add participant tags with optional relay and role
        if (Array.isArray(eventData.participants)) {
          eventData.participants.forEach(participant => {
            if (typeof participant === 'string' && participant.trim()) {
              tags.push(['p', participant.trim()])
            } else if (participant?.pubkey?.trim()) {
              const pTag = ['p', participant.pubkey.trim()]
              if (participant.relay?.trim()) {
                pTag.push(participant.relay.trim())
              }
              if (participant.role?.trim()) {
                if (pTag.length === 2) pTag.push('')
                pTag.push(participant.role.trim())
              }
              tags.push(pTag)
            }
          })
        }

        if (Array.isArray(eventData.tags)) {
          eventData.tags.forEach(tag => {
            if (tag?.trim()) {
              tags.push(['t', tag.trim()])
            }
          })
        }

        if (Array.isArray(eventData.references)) {
          eventData.references.forEach(ref => {
            if (ref?.trim()) {
              tags.push(['r', ref.trim()])
            }
          })
        }

        eventTemplate = {
          kind,
          created_at: Math.floor(Date.now() / 1000),
          tags,
          content: eventData.description.trim()
        }
      }

      // Sign and publish to Nostr relays
      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      // Add the event to our local state immediately
      const newEvent = await createEventData(signedEvent)
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
        start_tzid: '',
        end_tzid: '',
        location: '',
        geohash: '',
        participants: [],
        tags: [],
        references: []
      })

      return {
        event: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('❌ Calendar event creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update calendar event (creates new event and deletes old one)
  const updateEvent = async (eventId, newEventData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Create new event
      const result = await createEvent(newEventData)
      
      // Delete old event
      await deleteEvent(eventId)
      
      return result
    } catch (err) {
      error.value = getUserFriendlyError(err)
      throw err
    }
  }

  // Delete calendar event
  const deleteEvent = async (eventId) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Create deletion event (kind:5)
      let deletionEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', eventId]],
        content: 'Calendar event deleted'
      }

      // Sign and publish deletion event
      const { event: signedEvent, result } = await publishService.signAndPublish(deletionEvent)

      if (result.successful > 0) {
        // Remove from local state
        const index = events.value.findIndex(event => event.id === eventId)
        if (index !== -1) {
          events.value.splice(index, 1)
        }
      }

      return result

    } catch (err) {
      error.value = getUserFriendlyError(err)
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
      geohash: event.geohash || '',
      participants: [...(event.participants || [])],
      tags: [...(event.tags || [])],
      references: [...(event.references || [])]
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
      start_tzid: '',
      end_tzid: '',
      location: '',
      geohash: '',
      participants: [],
      tags: [],
      references: []
    })
    currentView.value = 'create'
  }

  // Create RSVP for a calendar event
  const createRSVP = async (eventId, eventKind, eventAuthor, status, freebusy, note = '') => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!['accepted', 'declined', 'tentative'].includes(status)) {
      throw new Error('Invalid RSVP status. Must be accepted, declined, or tentative')
    }

    if (freebusy && !['free', 'busy'].includes(freebusy)) {
      throw new Error('Invalid freebusy status. Must be free or busy')
    }

    isLoading.value = true
    error.value = ''

    try {
      // Build RSVP using nip52 helper
      const rsvpInput = {
        identifier: Date.now().toString(),
        eventAddress: `${eventKind}:${eventAuthor}:${eventId}`,
        status,
        content: note.trim(),
      }

      // Add freebusy if provided and status is not declined
      if (freebusy && status !== 'declined') {
        rsvpInput.freebusy = freebusy
      }

      let rsvpEvent = nip52.createCalendarEventRSVPTemplate(rsvpInput)

      // Sign and publish RSVP event
      const { event: signedEvent, result } = await publishService.signAndPublish(rsvpEvent)

      // Add to local state
      const rsvpData = {
        id: signedEvent.id,
        eventId,
        eventKind,
        eventAuthor,
        pubkey: currentUser.value.pubkey,
        status,
        freebusy: freebusy || null,
        note: note.trim(),
        created_at: signedEvent.created_at
      }

      const existingIndex = rsvps.value.findIndex(r => r.id === signedEvent.id)
      if (existingIndex === -1) {
        processedRsvpIds.add(signedEvent.id)
        rsvps.value.push(rsvpData)
      }

      return {
        rsvp: signedEvent,
        successfulRelays: result.successful,
        failedRelays: result.failed
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('❌ RSVP creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Fetch RSVPs for calendar events
  const fetchRSVPs = async (eventId = null) => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return
    }

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useNostrCalendar] Relay manager not ready for RSVPs:', err.message)
      return
    }

    try {

      // Build filters to get:
      // 1. RSVPs by the current user
      // 2. RSVPs for events created by the current user
      // 3. RSVPs for events where user is a participant
      const filters = [
        {
          // RSVPs created by current user
          kinds: [CALENDAR_EVENT_KINDS.RSVP],
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ]

      // If we have events, also fetch RSVPs for those events
      if (events.value.length > 0) {
        // Get all event identifiers (kind:pubkey:d-tag format)
        const eventIdentifiers = events.value
          .filter(e => e.rawEvent)
          .map(e => {
            const dTag = e.rawEvent.tags.find(tag => tag[0] === 'd')?.[1]
            if (dTag) {
              return `${e.rawEvent.kind}:${e.rawEvent.pubkey}:${dTag}`
            }
            return null
          })
          .filter(Boolean)

        if (eventIdentifiers.length > 0) {
          filters.push({
            kinds: [CALENDAR_EVENT_KINDS.RSVP],
            '#a': eventIdentifiers,
            limit: 200
          })
        }
      }

      // Close previous RSVP subscription before opening a new one
      if (rsvpSubscription) {
        rsvpSubscription.close()
        rsvpSubscription = null
      }

      const rsvpPubkeysToFetch = new Set()

      rsvpSubscription = nostrService.subscribe(filters, {
        onevent: async (event) => {
          if (processedRsvpIds.has(event.id)) {
            return
          }

          processedRsvpIds.add(event.id)

          // Parse RSVP data using nip52 helper
          const parsed = nip52.parseCalendarEventRSVP(event)

          // nip52 may not cover Plektos simplified format — fall back if needed
          let statusValue = parsed?.status ?? null
          let freebusyValue = parsed?.freebusy ?? null

          if (!statusValue) {
            // Fallback: try Plektos simplified format ['status', 'accepted']
            const plektosStatusTag = event.tags.find(tag => tag[0] === 'status')
            if (plektosStatusTag) {
              statusValue = plektosStatusTag[1]
            }
          }
          if (!freebusyValue) {
            const plektosFreebusyTag = event.tags.find(tag => tag[0] === 'freebusy')
            if (plektosFreebusyTag) {
              freebusyValue = plektosFreebusyTag[1]
            }
          }

          const eventAddress = parsed?.eventAddress || event.tags.find(tag => tag[0] === 'a')?.[1]

          if (eventAddress && statusValue) {
            const [eventKind, eventAuthor, eventId] = eventAddress.split(':')

            // Queue pubkey for batch profile fetch after EOSE
            rsvpPubkeysToFetch.add(event.pubkey)

            const rsvpData = {
              id: event.id,
              eventId,
              eventKind: parseInt(eventKind),
              eventAuthor,
              pubkey: event.pubkey,
              name: null,
              picture: null,
              nip05: null,
              status: statusValue,
              freebusy: freebusyValue,
              note: parsed?.content ?? event.content,
              created_at: event.created_at
            }

            const existingIndex = rsvps.value.findIndex(r => r.id === event.id)
            if (existingIndex === -1) {
              rsvps.value.push(rsvpData)
            } else {
              rsvps.value[existingIndex] = rsvpData
            }
          }
        },
        oneose: () => {
          // Batch fetch all RSVP author profiles, then enrich
          if (rsvpPubkeysToFetch.size > 0) {
            const pubkeys = Array.from(rsvpPubkeysToFetch)
            profileService.batch(pubkeys).then(() => {
              // Enrich RSVP entries with fetched profiles
              rsvps.value.forEach((rsvp, i) => {
                const cached = profileService.getCached(rsvp.pubkey)
                if (cached) {
                  rsvps.value[i] = { ...rsvp, name: cached.name, picture: cached.picture, nip05: cached.nip05 }
                }
              })
            }).catch(e => {
              console.warn('RSVP profile batch fetch failed:', e.message)
            })
          }
          // Close subscription after grace period
          setTimeout(() => { if (rsvpSubscription) { rsvpSubscription.close(); rsvpSubscription = null } }, 3000)
        }
      })

      return rsvpSubscription

    } catch (err) {
      console.error('Failed to fetch RSVPs:', err)
      error.value = getUserFriendlyError(err)
    }
  }

  // Get RSVPs for a specific event
  const getEventRSVPs = (eventId) => {
    // eventId can be either the actual event ID or the d-tag
    // We need to find the event and get its d-tag for matching
    const event = events.value.find(e => e.id === eventId)
    if (!event || !event.rawEvent) {
      return []
    }

    const dTag = event.rawEvent.tags.find(tag => tag[0] === 'd')?.[1]
    if (!dTag) {
      return []
    }

    return rsvps.value.filter(rsvp => rsvp.eventId === dTag)
  }

  // Get user's RSVP for a specific event
  const getUserRSVP = (eventId) => {
    if (!currentUser.value?.pubkey) return null
    
    // Get d-tag from event
    const event = events.value.find(e => e.id === eventId)
    if (!event || !event.rawEvent) return null
    
    const dTag = event.rawEvent.tags.find(tag => tag[0] === 'd')?.[1]
    if (!dTag) return null
    
    return rsvps.value.find(
      rsvp => rsvp.eventId === dTag && rsvp.pubkey === currentUser.value.pubkey
    )
  }

  // Cleanup function
  const cleanup = () => {
    if (currentSubscription) {
      currentSubscription.close()
      currentSubscription = null
    }
    if (rsvpSubscription) {
      rsvpSubscription.close()
      rsvpSubscription = null
    }
    processedEventIds.clear()
    processedRsvpIds.clear()
  }

  // Initialize events when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      if (currentSubscription) {
        currentSubscription.close()
        currentSubscription = null
      }
      processedEventIds.clear()

      // fetchCalendarEvents already awaits ready() internally
      fetchCalendarEvents().catch(err => console.warn('[useNostrCalendar] Initial fetch failed:', err.message))

      registerRefresh('calendar', async () => {
        if (currentSubscription) { currentSubscription.close(); currentSubscription = null }
        processedEventIds.clear()
        await fetchCalendarEvents()
      }, 'calendar')
    } else {
      if (currentSubscription) {
        currentSubscription.close()
        currentSubscription = null
      }
      if (rsvpSubscription) {
        rsvpSubscription.close()
        rsvpSubscription = null
      }
      processedEventIds.clear()
      processedRsvpIds.clear()
      rsvps.value = []
      events.value = []
      unregisterRefresh('calendar')
    }
  }, { immediate: true })

  // Watch authentication status to start/stop monitoring
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      startEventMonitoring(() => events.value)
    } else {
      stopEventMonitoring()
    }
  }, { immediate: true })

  return {
    // State
    events: sortedEvents,
    rsvps,
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
    
    // RSVP Actions
    createRSVP,
    fetchRSVPs,
    getEventRSVPs,
    getUserRSVP,
    
    // View management
    setView,
    viewEvent,
    editEvent,
    createNewEvent,
    
    // Constants
    CALENDAR_EVENT_KINDS
  }
}