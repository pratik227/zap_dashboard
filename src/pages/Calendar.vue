<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  IconCalendar,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconUsers,
  IconBolt,
  IconExternalLink,
  IconFilter,
  IconSearch,
  IconUser,
  IconAlertCircle,
  IconLoader,
  IconRefresh,
  IconEye,
  IconEdit,
  IconTrash,
  IconShare,
  IconX,
  IconCheck,
  IconBell,
  IconMessage,
  IconCopy
} from '@iconify-prerendered/vue-tabler'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import { useNostrCalendar } from '../composables/content/useNostrCalendar.js'
import { formatDate, formatTime, isToday, isSameDay } from '../utils/core/dateUtils.js'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import UserSearchInput from '../components/audience/UserSearchInput.vue'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

const {
  events,
  rsvps,
  isLoading,
  error,
  currentView,
  selectedEvent,
  eventForm,
  fetchCalendarEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  setView,
  viewEvent,
  editEvent,
  createNewEvent,
  createRSVP,
  fetchRSVPs,
  getEventRSVPs,
  getUserRSVP
} = useNostrCalendar()

// FullCalendar ref
const fullCalendarRef = ref(null)

// Calendar state
const calendarView = ref('dayGridMonth') // dayGridMonth, timeGridWeek, timeGridDay, listWeek
const searchQuery = ref('')
const selectedFilters = ref({
  type: 'all', // all, time-based, date-based
  status: 'all' // all, upcoming, past
})
const showFilters = ref(false)
const showEventModal = ref(false)
const showViewEventModal = ref(false)
const isEditingEvent = ref(false)

// Event form state for modal
const modalEventForm = ref({
  title: '',
  description: '',
  type: 'time-based',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  location: '',
  geohash: '',
  participants: [],
  tags: [],
  references: []
})

// Input fields for adding items
const newTag = ref('')
const newReference = ref('')

// RSVP state
const showRSVPModal = ref(false)
const rsvpForm = ref({
  status: 'accepted',
  freebusy: 'busy',
  note: ''
})

// Pending invitations modal state
const showPendingInvitationsModal = ref(false)

// Compute invited events (where user is a participant but not the creator)
const invitedEvents = computed(() => {
  if (!currentUser.value?.pubkey) return []
  
  const invited = events.value.filter(event => {
    const isNotCreator = event.pubkey !== currentUser.value.pubkey
    const isParticipant = event.participants?.some(p => p.pubkey === currentUser.value.pubkey)
    return isNotCreator && isParticipant
  })
  return invited
})

// Compute pending invitations (invited events without RSVP)
const pendingInvitations = computed(() => {
  if (!currentUser.value?.pubkey) return []
  return invitedEvents.value.filter(event => 
    !getUserRSVP(event.id)
  )
})

// Compute events created by user
const myEvents = computed(() => {
  if (!currentUser.value?.pubkey) return []
  return events.value.filter(event => event.pubkey === currentUser.value.pubkey)
})

// Transform events for FullCalendar
const fullCalendarEvents = computed(() => {
  return filteredEvents.value.map(event => {
    let start, end
    
    if (event.type === 'time-based') {
      start = new Date(event.start * 1000)
      end = event.end ? new Date(event.end * 1000) : null
    } else {
      start = new Date(event.start_date)
      if (event.end_date) {
        const endDate = new Date(event.end_date)
        endDate.setDate(endDate.getDate() + 1)
        end = endDate
      } else {
        end = null
      }
    }
    // Check if this is an invited event
    const isInvited = event.pubkey !== currentUser.value?.pubkey && 
                      event.participants?.some(p => p.pubkey === currentUser.value?.pubkey)
    const hasPendingRSVP = isInvited && !getUserRSVP(event.id)
    
    return {
      id: event.id,
      title: isInvited ? `📨 ${event.title}` : event.title,
      start: start,
      end: end,
      allDay: event.type === 'date-based',
      backgroundColor: hasPendingRSVP ? '#fef3c7' : (event.type === 'time-based' ? '#dbeafe' : '#dcfce7'),
      borderColor: hasPendingRSVP ? '#f59e0b' : (event.type === 'time-based' ? '#3b82f6' : '#16a34a'),
      textColor: hasPendingRSVP ? '#92400e' : (event.type === 'time-based' ? '#1e40af' : '#15803d'),
      classNames: [
        'fc-event-custom',
        `fc-event-${event.type}`,
        `fc-event-${getEventStatus(event)}`,
        isInvited ? 'fc-event-invited' : '',
        hasPendingRSVP ? 'fc-event-pending' : ''
      ],
      extendedProps: {
        description: event.description,
        location: event.location,
        geohash: event.geohash,
        participants: event.participants,
        tags: event.tags,
        references: event.references,
        type: event.type,
        status: getEventStatus(event),
        originalEvent: event
      }
    }
  })
})

// FullCalendar options
const calendarOptions = computed(() => {
  return {
    plugins: [
      dayGridPlugin,
      timeGridPlugin,
      interactionPlugin,
      listPlugin
    ],
    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    initialView: calendarView.value,
    events: fullCalendarEvents.value,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 3,
    weekends: true,
    height: 'auto',
    aspectRatio: 1.35,
    select: handleDateSelect,
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    viewDidMount: handleViewChange,
    // Styling
    themeSystem: 'standard',
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      list: 'List'
    }
  }
})

// Filtered events based on search and filters
const filteredEvents = computed(() => {
  let filtered = [...events.value]
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(event => 
      event.title.toLowerCase().includes(query) ||
      event.description.toLowerCase().includes(query) ||
      event.location?.toLowerCase().includes(query)
    )
  }
  
  // Apply type filter
  if (selectedFilters.value.type !== 'all') {
    if (selectedFilters.value.type === 'my-events') {
      // Show only events created by the user
      filtered = filtered.filter(event => event.pubkey === currentUser.value?.pubkey)
    } else if (selectedFilters.value.type === 'invited') {
      // Show only events where user is invited
      filtered = filtered.filter(event => 
        event.pubkey !== currentUser.value?.pubkey && 
        event.participants?.some(p => p.pubkey === currentUser.value?.pubkey)
      )
    } else if (selectedFilters.value.type === 'pending') {
      // Show only invited events without RSVP
      filtered = filtered.filter(event => 
        event.pubkey !== currentUser.value?.pubkey && 
        event.participants?.some(p => p.pubkey === currentUser.value?.pubkey) &&
        !getUserRSVP(event.id)
      )
    } else {
      // time-based or date-based
      filtered = filtered.filter(event => event.type === selectedFilters.value.type)
    }
  }
  
  // Apply status filter
  if (selectedFilters.value.status !== 'all') {
    const now = Date.now() / 1000
    if (selectedFilters.value.status === 'upcoming') {
      filtered = filtered.filter(event => {
        const eventTime = event.type === 'time-based' ? event.start : 
                         new Date(event.start_date).getTime() / 1000
        return eventTime > now
      })
    } else if (selectedFilters.value.status === 'past') {
      filtered = filtered.filter(event => {
        const eventTime = event.type === 'time-based' ? event.end || event.start : 
                         new Date(event.end_date || event.start_date).getTime() / 1000
        return eventTime < now
      })
    }
  }
  
  return filtered.sort((a, b) => {
    const timeA = a.type === 'time-based' ? a.start : new Date(a.start_date).getTime() / 1000
    const timeB = b.type === 'time-based' ? b.start : new Date(b.start_date).getTime() / 1000
    return timeA - timeB
  })
})

// Event handlers
const handleDateSelect = (selectInfo) => {
  // Open create event modal with pre-filled dates
  isEditingEvent.value = false
  modalEventForm.value = {
    title: '',
    description: '',
    type: selectInfo.allDay ? 'date-based' : 'time-based',
    start_date: selectInfo.startStr.split('T')[0],
    end_date: selectInfo.endStr.split('T')[0],
    start_time: selectInfo.allDay ? '' : selectInfo.startStr.split('T')[1]?.substring(0, 5) || '',
    end_time: selectInfo.allDay ? '' : selectInfo.endStr.split('T')[1]?.substring(0, 5) || '',
    location: '',
    geohash: '',
    participants: [],
    tags: [],
    references: []
  }
  showEventModal.value = true
  
  // Clear the selection
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.unselect()
  }
}

const handleEventClick = (clickInfo) => {
  const event = clickInfo.event.extendedProps.originalEvent
  selectedEvent.value = event
  showViewEventModal.value = true
}

const openEditFromView = () => {
  const event = selectedEvent.value
  if (!event) return
  
  showViewEventModal.value = false
  isEditingEvent.value = true
  
  // Populate form
  modalEventForm.value = {
    title: event.title,
    description: event.description,
    type: event.type,
    location: event.location || '',
    geohash: event.geohash || '',
    participants: [...(event.participants || [])],
    tags: [...(event.tags || [])],
    references: [...(event.references || [])]
  }

  if (event.type === 'time-based') {
    if (event.start) {
      const startDate = new Date(event.start * 1000)
      modalEventForm.value.start_date = startDate.toISOString().split('T')[0]
      modalEventForm.value.start_time = startDate.toTimeString().split(' ')[0].substring(0, 5)
    }
    if (event.end) {
      const endDate = new Date(event.end * 1000)
      modalEventForm.value.end_date = endDate.toISOString().split('T')[0]
      modalEventForm.value.end_time = endDate.toTimeString().split(' ')[0].substring(0, 5)
    }
  } else {
    modalEventForm.value.start_date = event.start_date || ''
    modalEventForm.value.end_date = event.end_date || ''
  }

  showEventModal.value = true
}

const openRSVPFromView = () => {
  const event = selectedEvent.value
  if (!event) return
  showViewEventModal.value = false
  openRSVPModal(event)
}

const handleEventDrop = async (dropInfo) => {
  // Handle event drag and drop
  const event = dropInfo.event.extendedProps.originalEvent
  const newStart = dropInfo.event.start
  const newEnd = dropInfo.event.end
  
  try {
    const updatedData = { ...event }
    
    if (event.type === 'time-based') {
      updatedData.start = Math.floor(newStart.getTime() / 1000)
      if (newEnd) {
        updatedData.end = Math.floor(newEnd.getTime() / 1000)
      }
    } else {
      updatedData.start_date = newStart.toISOString().split('T')[0]
      if (newEnd) {
        updatedData.end_date = newEnd.toISOString().split('T')[0]
      }
    }
    
    await updateEvent(event.id, updatedData)
  } catch (error) {
    console.error('Failed to update event:', error)
    dropInfo.revert()
  }
}

const handleEventResize = async (resizeInfo) => {
  // Handle event resize
  const event = resizeInfo.event.extendedProps.originalEvent
  const newEnd = resizeInfo.event.end
  
  try {
    const updatedData = { ...event }
    
    if (event.type === 'time-based') {
      if (newEnd) {
        updatedData.end = Math.floor(newEnd.getTime() / 1000)
      }
    } else {
      if (newEnd) {
        updatedData.end_date = newEnd.toISOString().split('T')[0]
      }
    }
    
    await updateEvent(event.id, updatedData)
  } catch (error) {
    console.error('Failed to resize event:', error)
    resizeInfo.revert()
  }
}

const handleViewChange = (viewInfo) => {
  calendarView.value = viewInfo.view.type
}

// Modal handlers
const openNewEventModal = () => {
  isEditingEvent.value = false
  selectedEvent.value = null
  
  // Set default form values
  modalEventForm.value = {
    title: '',
    description: '',
    type: 'time-based',
    start_date: new Date().toISOString().split('T')[0], // Today's date
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    participants: [],
    tags: []
  }
  
  showEventModal.value = true
  resetFormTouched()
}

const handleEventFormSubmit = async () => {
  formSubmitAttempted.value = true
  if (!isFormValid.value) return
  try {
    if (isEditingEvent.value && selectedEvent.value) {
      await updateEvent(selectedEvent.value.id, { ...modalEventForm.value })
    } else {
      await createEvent({ ...modalEventForm.value })
    }
    closeEventModal()
  } catch (error) {
    console.error('Failed to save event:', error)
  }
}

const handleEventFormCancel = () => {
  closeEventModal()
}

const handleDeleteEvent = async () => {
  if (!selectedEvent.value) return
  
  if (confirm(`Are you sure you want to delete "${selectedEvent.value.title}"?`)) {
    try {
      await deleteEvent(selectedEvent.value.id)
      closeEventModal()
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }
}

const closeEventModal = () => {
  showEventModal.value = false
  isEditingEvent.value = false
  selectedEvent.value = null
  modalEventForm.value = {
    title: '',
    description: '',
    type: 'time-based',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    geohash: '',
    participants: [],
    tags: [],
    references: []
  }
}

// Calendar navigation
const goToToday = () => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.today()
  }
}

const navigatePrev = () => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.prev()
  }
}

const navigateNext = () => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.next()
  }
}

const changeView = (viewType) => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.changeView(viewType)
  }
}

// Utility functions
const getEventStatus = (event) => {
  const now = Date.now() / 1000
  const eventTime = event.type === 'time-based' ? event.start : 
                   new Date(event.start_date).getTime() / 1000
  const endTime = event.type === 'time-based' ? (event.end || event.start) : 
                 new Date(event.end_date || event.start_date).getTime() / 1000
  
  if (endTime < now) return 'past'
  if (eventTime > now) return 'upcoming'
  return 'ongoing'
}

const getStatusColor = (status) => {
  switch (status) {
    case 'past': return 'text-gray-500'
    case 'ongoing': return 'text-green-600'
    case 'upcoming': return 'text-blue-600'
    default: return 'text-gray-600'
  }
}

const getEventTypeBadge = (type) => {
  return type === 'time-based' 
    ? 'bg-blue-100 text-blue-700' 
    : 'bg-green-100 text-green-700'
}

// Inline status for login errors
const inlineStatus = ref(null)
let _statusTimer = null
const showStatus = (message, type = 'error') => {
  clearTimeout(_statusTimer)
  inlineStatus.value = { message, type }
  _statusTimer = setTimeout(() => { inlineStatus.value = null }, 4000)
}

onUnmounted(() => {
  clearTimeout(_statusTimer)
})

const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
    if (error.message.includes('No Nostr extension')) {
      showStatus('No Nostr extension found. Please install a NIP-07 browser extension — we recommend Jump by Buho (from the ZapTracker founders, available for Firefox & Chrome), or Alby, nos2x, or Flamingo — and refresh this page.')
    } else {
      showStatus(getUserFriendlyError(error))
    }
  }
}

// Helper functions for managing participants, tags, and references
const addParticipant = (user) => {
  if (!modalEventForm.value.participants) {
    modalEventForm.value.participants = []
  }
  
  // Check if user is already added
  const exists = modalEventForm.value.participants.some(p => p.pubkey === user.pubkey)
  if (exists) {
    return
  }
  
  modalEventForm.value.participants.push({
    pubkey: user.pubkey,
    name: user.name,
    picture: user.picture,
    nip05: user.nip05,
    relay: '',
    role: user.role || ''
  })
}

const removeParticipant = (index) => {
  if (modalEventForm.value.participants) {
    modalEventForm.value.participants.splice(index, 1)
  }
}

const addTag = () => {
  if (!modalEventForm.value.tags) {
    modalEventForm.value.tags = []
  }
  if (newTag.value.trim() && !modalEventForm.value.tags.includes(newTag.value.trim())) {
    modalEventForm.value.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  if (modalEventForm.value.tags) {
    modalEventForm.value.tags.splice(index, 1)
  }
}

const addReference = () => {
  if (!modalEventForm.value.references) {
    modalEventForm.value.references = []
  }
  if (newReference.value.trim() && !modalEventForm.value.references.includes(newReference.value.trim())) {
    modalEventForm.value.references.push(newReference.value.trim())
    newReference.value = ''
  }
}

const removeReference = (index) => {
  if (modalEventForm.value.references) {
    modalEventForm.value.references.splice(index, 1)
  }
}

// Generate njump.me link for event
const getNostrEventLink = (event) => {
  if (!event?.rawEvent) return null
  
  // Create nevent (NIP-19) identifier
  // For now, we'll use the event ID directly with njump
  // njump.me supports both note IDs and nevent identifiers
  return `https://njump.me/${event.rawEvent.id}`
}

const openNostrEvent = (event) => {
  const link = getNostrEventLink(event)
  if (link) {
    window.open(link, '_blank')
  }
}

const copyNostrEventLink = async (event) => {
  const link = getNostrEventLink(event)
  if (link) {
    try {
      await navigator.clipboard.writeText(link)
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }
}

// RSVP functions
const getParticipantRSVP = (eventId, participantPubkey) => {
  // Use getEventRSVPs which handles d-tag matching correctly
  const eventRsvps = getEventRSVPs(eventId)
  return eventRsvps.find(rsvp => rsvp.pubkey === participantPubkey)
}

const getRSVPStatusColor = (status) => {
  switch (status) {
    case 'accepted':
      return 'bg-green-100 text-green-700'
    case 'declined':
      return 'bg-red-100 text-red-700'
    case 'tentative':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

const getRSVPStatusIcon = (status) => {
  switch (status) {
    case 'accepted':
      return '✓'
    case 'declined':
      return '✗'
    case 'tentative':
      return '?'
    default:
      return '•'
  }
}

const openRSVPModal = (event) => {
  if (!event) {
    console.error('Cannot open RSVP modal: event is null or undefined')
    return
  }

  selectedEvent.value = event
  const existingRSVP = getUserRSVP(event.id)

  if (existingRSVP) {
    rsvpForm.value = {
      status: existingRSVP.status,
      freebusy: existingRSVP.freebusy || 'busy',
      note: existingRSVP.note || ''
    }
  } else {
    rsvpForm.value = {
      status: 'accepted',
      freebusy: 'busy',
      note: ''
    }
  }
  
  showRSVPModal.value = true
}

const closeRSVPModal = () => {
  showRSVPModal.value = false
  selectedEvent.value = null
  rsvpForm.value = {
    status: 'accepted',
    freebusy: 'busy',
    note: ''
  }
}

const handleViewInvitations = () => {
  if (pendingInvitations.value.length === 0) {
    return
  }

  if (pendingInvitations.value.length === 1) {
    openRSVPModal(pendingInvitations.value[0])
  } else {
    showPendingInvitationsModal.value = true
  }
}

const closePendingInvitationsModal = () => {
  showPendingInvitationsModal.value = false
}

const openRSVPFromList = (event) => {
  showPendingInvitationsModal.value = false
  openRSVPModal(event)
}

const handleRSVPSubmit = async () => {
  if (!selectedEvent.value) return
  
  try {
    const event = selectedEvent.value
    const dTag = event.rawEvent?.tags?.find(tag => tag[0] === 'd')?.[1]
    
    await createRSVP(
      dTag || event.id,
      event.rawEvent?.kind || (event.type === 'time-based' ? 31923 : 31922),
      event.pubkey,
      rsvpForm.value.status,
      rsvpForm.value.status !== 'declined' ? rsvpForm.value.freebusy : null,
      rsvpForm.value.note
    )
    
    closeRSVPModal()
  } catch (error) {
    console.error('Failed to submit RSVP:', error)
  }
}

// Form validation
const isFormValid = computed(() => {
  return modalEventForm.value.title.trim() &&
         modalEventForm.value.start_date &&
         (modalEventForm.value.type === 'date-based' || modalEventForm.value.start_time)
})

// Form touched state for inline validation
const formTouched = ref({
  title: false,
  start_date: false,
  start_time: false
})

const formSubmitAttempted = ref(false)

const resetFormTouched = () => {
  formTouched.value = { title: false, start_date: false, start_time: false }
  formSubmitAttempted.value = false
}

// Helper function to get profile picture with fallback
const getProfilePicture = (user) => {
  if (user?.picture) {
    return user.picture
  }
  if (user?.pubkey) {
    return generateAvatar(user.pubkey)
  }
  return null
}

// Unified people list for event detail view
const allEventPeople = computed(() => {
  if (!selectedEvent.value) return []
  const eventId = selectedEvent.value.id
  const rsvpList = getEventRSVPs(eventId)
  const participants = selectedEvent.value.participants || []
  const peopleMap = new Map()

  // Add invited participants first
  for (const p of participants) {
    const rsvp = getParticipantRSVP(eventId, p.pubkey)
    peopleMap.set(p.pubkey, {
      pubkey: p.pubkey,
      name: p.name || rsvp?.name,
      picture: p.picture || rsvp?.picture,
      role: p.role,
      rsvpStatus: rsvp?.status || null,
      isInvited: true
    })
  }

  // Add RSVPs from non-invited people
  for (const rsvp of rsvpList) {
    if (!peopleMap.has(rsvp.pubkey)) {
      peopleMap.set(rsvp.pubkey, {
        pubkey: rsvp.pubkey,
        name: rsvp.name,
        picture: rsvp.picture,
        role: null,
        rsvpStatus: rsvp.status,
        isInvited: false
      })
    }
  }

  // Sort: accepted first, then tentative, then pending, then declined
  const statusOrder = { accepted: 0, tentative: 1, null: 2, undefined: 2, declined: 3 }
  return Array.from(peopleMap.values()).sort((a, b) => {
    return (statusOrder[a.rsvpStatus] ?? 2) - (statusOrder[b.rsvpStatus] ?? 2)
  })
})

const acceptedCount = computed(() => allEventPeople.value.filter(p => p.rsvpStatus === 'accepted').length)
const tentativeCount = computed(() => allEventPeople.value.filter(p => p.rsvpStatus === 'tentative').length)
const declinedCount = computed(() => allEventPeople.value.filter(p => p.rsvpStatus === 'declined').length)
const pendingCount = computed(() => allEventPeople.value.filter(p => !p.rsvpStatus).length)

const eventMessages = computed(() => {
  if (!selectedEvent.value) return []
  return getEventRSVPs(selectedEvent.value.id).filter(rsvp => rsvp.note && rsvp.note.trim())
})

// Watch for events changes to refetch RSVPs
watch(() => events.value.length, (newLength, oldLength) => {
  if (newLength > 0 && newLength !== oldLength) {
    // Small delay to ensure events are fully processed
    setTimeout(() => {
      fetchRSVPs()
    }, 500)
  }
})

// Initialize
onMounted(() => {
  if (isAuthenticated.value) {
    fetchCalendarEvents()
    fetchRSVPs()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Inline Status Banner -->
    <transition name="slide-down">
      <div v-if="inlineStatus" role="status" aria-live="polite" :class="[
        'mb-4 px-4 py-3 rounded-lg text-sm font-medium',
        inlineStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
        inlineStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
        'bg-blue-50 text-blue-800 border border-blue-200'
      ]">
        {{ inlineStatus.message }}
      </div>
    </transition>

    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconUser class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
            <p class="text-purple-100 text-sm">
              Connect your Nostr identity to view and manage calendar events from the decentralized network.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
        >
          <IconBolt class="w-4 h-4" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Authenticated Content -->
    <div v-else>
      <!-- Pending Invitations Banner -->
      <div v-if="pendingInvitations.length > 0" class="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-xl shadow-lg mb-6">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconBell class="w-6 h-6" />
            </div>
            <div>
              <h3 class="font-semibold text-lg">
                {{ pendingInvitations.length }} Pending Invitation{{ pendingInvitations.length !== 1 ? 's' : '' }}
              </h3>
              <p class="text-sm text-white/90">You've been invited to {{ pendingInvitations.length }} event{{ pendingInvitations.length !== 1 ? 's' : '' }}. Click to view and RSVP.</p>
            </div>
          </div>
          <button
            @click="handleViewInvitations"
            class="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            View Invitations
          </button>
        </div>
      </div>

      <!-- Calendar Header -->

       <div class="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">

        <div class="flex items-center space-x-3 mb-4">
          <button @click="goToToday" class="btn-secondary text-sm">
                Today
              </button>

              <button @click="showFilters = !showFilters" class="btn-secondary">
                <IconFilter class="w-4 h-4" />
                Filters
              </button>

              <button @click="openNewEventModal" class="btn-primary">
                <IconPlus class="w-4 h-4" />
                New Event
              </button>
          </div>
        </div>
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6"  v-if="showFilters" >

        <!-- Filters -->
        <div class="mt-6 pt-6 border-t border-orange-100/50">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <!-- Search -->
            <div class="relative">
              <IconSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search events..."
                class="w-full pl-10 pr-4 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm"
              />
            </div>

            <!-- Type Filter -->
            <select
              v-model="selectedFilters.type"
              class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm"
            >
              <option value="all">All Events</option>
              <option value="my-events">My Events</option>
              <option value="invited">
                Invited Events
                <span v-if="invitedEvents.length > 0">({{ invitedEvents.length }})</span>
              </option>
              <option value="pending">
                Pending Invitations
                <span v-if="pendingInvitations.length > 0">({{ pendingInvitations.length }})</span>
              </option>
              <option value="time-based">Time-based Events</option>
              <option value="date-based">Date-based Events</option>
            </select>

            <!-- Status Filter -->
            <select
              v-model="selectedFilters.status"
              class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm"
            >
              <option value="all">All Events</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>

      <!-- FullCalendar Component -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm mt-4 overflow-hidden">
        <div v-if="isLoading" class="p-6">
          <div class="flex items-center justify-center space-x-2">
            <IconLoader class="w-5 h-5 animate-spin text-orange-600" />
            <span class="text-gray-600">Loading events...</span>
          </div>
        </div>
        
        <div v-else class="p-6">
          <FullCalendar 
            ref="fullCalendarRef"
            :options="calendarOptions"
            class="fc-custom-theme"
          />
        </div>
      </div>

      <!-- Event Statistics -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6 mt-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Event Statistics</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-orange-600">{{ filteredEvents.length }}</div>
            <div class="text-sm text-gray-600">Total Events</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-blue-600">
              {{ filteredEvents.filter(e => e.type === 'time-based').length }}
            </div>
            <div class="text-sm text-gray-600">Time-based</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">
              {{ filteredEvents.filter(e => e.type === 'date-based').length }}
            </div>
            <div class="text-sm text-gray-600">Date-based</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Modal — Streamlined with progressive disclosure -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showEventModal" class="fixed inset-0 z-[9999]">
          <!-- Backdrop -->
          <div
            @click="closeEventModal"
            class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          ></div>

          <!-- Modal -->
          <div class="absolute inset-0 flex md:items-center md:justify-center md:p-8 pointer-events-none">
            <div class="pointer-events-auto w-full md:w-[520px] md:max-h-[85vh] max-h-[92vh] mt-auto md:mt-0 bg-white md:shadow-2xl flex flex-col md:animate-scale-in animate-slide-up rounded-t-3xl md:rounded-2xl overflow-hidden">

              <!-- Header — compact -->
              <div class="flex-shrink-0 rounded-t-3xl md:rounded-t-2xl">
                <!-- Mobile drag handle -->
                <div class="md:hidden flex justify-center pt-2.5 pb-1">
                  <div class="w-9 h-1 bg-gray-300 rounded-full"></div>
                </div>
                <div class="px-5 md:px-6 pt-3 md:pt-5 pb-3 flex items-center justify-between">
                  <h2 class="text-lg font-bold text-gray-900">
                    {{ isEditingEvent ? 'Edit Event' : 'New Event' }}
                  </h2>
                  <button
                    @click="closeEventModal"
                    class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <IconX class="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <!-- Scrollable Content -->
              <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">
                <div class="px-5 md:px-6 pb-5">

                  <!-- ═══ ESSENTIALS ═══ -->

                  <!-- Title — large, clean input -->
                  <input
                    v-model="modalEventForm.title"
                    type="text"
                    placeholder="Event name"
                    class="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-gray-200 focus:border-orange-400 focus:outline-none focus:ring-0 transition-colors text-xl font-semibold text-gray-900 placeholder-gray-300"
                    @blur="formTouched.title = true"
                  />
                  <p v-if="!modalEventForm.title.trim() && (formTouched.title || formSubmitAttempted)" class="text-xs text-red-500 mt-1">Title is required</p>

                  <!-- Date/Time + Type — all in one compact card -->
                  <div class="mt-4 bg-gray-50/80 rounded-xl border border-gray-200/80 overflow-hidden">
                    <!-- Type toggle row -->
                    <div class="px-4 pt-3 pb-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        @click="modalEventForm.type = 'time-based'"
                        :class="[
                          'px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
                          modalEventForm.type === 'time-based'
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-white text-gray-500 border border-gray-200 hover:text-orange-600 hover:border-orange-200'
                        ]"
                      >
                        <IconClock class="w-3 h-3 inline mr-1 -mt-px" />Specific time
                      </button>
                      <button
                        type="button"
                        @click="modalEventForm.type = 'date-based'"
                        :class="[
                          'px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200',
                          modalEventForm.type === 'date-based'
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'bg-white text-gray-500 border border-gray-200 hover:text-orange-600 hover:border-orange-200'
                        ]"
                      >
                        <IconCalendar class="w-3 h-3 inline mr-1 -mt-px" />All-day
                      </button>
                    </div>
                    <!-- Date inputs -->
                    <div class="px-4 pb-3 grid grid-cols-2 gap-2.5">
                      <div>
                        <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Start</label>
                        <input
                          v-model="modalEventForm.start_date"
                          type="date"
                          class="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm"
                          @blur="formTouched.start_date = true"
                        />
                        <p v-if="!modalEventForm.start_date && (formTouched.start_date || formSubmitAttempted)" class="text-xs text-red-500 mt-1">Start date is required</p>
                      </div>
                      <div>
                        <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">End</label>
                        <input
                          v-model="modalEventForm.end_date"
                          type="date"
                          class="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <!-- Time inputs (time-based only) -->
                    <div v-if="modalEventForm.type === 'time-based'" class="px-4 pb-3 grid grid-cols-2 gap-2.5 -mt-1">
                      <div>
                        <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">From</label>
                        <input
                          v-model="modalEventForm.start_time"
                          type="time"
                          class="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm"
                          @blur="formTouched.start_time = true"
                        />
                        <p v-if="!modalEventForm.start_time && (formTouched.start_time || formSubmitAttempted)" class="text-xs text-red-500 mt-1">Start time is required</p>
                      </div>
                      <div>
                        <label class="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">Until</label>
                        <input
                          v-model="modalEventForm.end_time"
                          type="time"
                          class="w-full px-2.5 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Location — icon-prefixed inline -->
                  <div class="mt-3 flex items-center gap-3 px-1">
                    <IconMapPin class="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <input
                      v-model="modalEventForm.location"
                      type="text"
                      placeholder="Add location or link"
                      class="flex-1 py-2.5 bg-transparent border-0 border-b border-gray-200 focus:border-orange-400 focus:outline-none focus:ring-0 transition-colors text-sm text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <!-- Description — icon-prefixed inline -->
                  <div class="mt-1 flex items-start gap-3 px-1">
                    <IconMessage class="w-4 h-4 text-gray-400 flex-shrink-0 mt-3" />
                    <textarea
                      v-model="modalEventForm.description"
                      rows="2"
                      placeholder="Add description"
                      class="flex-1 py-2.5 bg-transparent border-0 border-b border-gray-200 focus:border-orange-400 focus:outline-none focus:ring-0 transition-colors text-sm text-gray-900 placeholder-gray-400 resize-none"
                    ></textarea>
                  </div>

                  <!-- ═══ MORE OPTIONS — collapsible ═══ -->
                  <details class="mt-5 group" :open="isEditingEvent && ((modalEventForm.participants && modalEventForm.participants.length > 0) || (modalEventForm.tags && modalEventForm.tags.length > 0) || (modalEventForm.references && modalEventForm.references.length > 0) || modalEventForm.geohash) ? true : undefined">
                    <summary class="flex items-center gap-2 cursor-pointer select-none py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 transition-colors">
                      <div class="flex items-center gap-2 flex-1">
                        <IconPlus class="w-4 h-4 text-orange-500 transition-transform group-open:rotate-45" />
                        <span class="text-sm font-semibold text-gray-700">More options</span>
                      </div>
                      <!-- Preview badges for already-added items -->
                      <div class="flex items-center gap-1.5">
                        <span v-if="modalEventForm.participants && modalEventForm.participants.length > 0" class="text-xs px-2 py-0.5 bg-orange-50 text-orange-500 rounded-full font-medium">
                          {{ modalEventForm.participants.length }} invited
                        </span>
                        <span v-if="modalEventForm.tags && modalEventForm.tags.length > 0" class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                          {{ modalEventForm.tags.length }} tags
                        </span>
                        <span v-if="modalEventForm.references && modalEventForm.references.length > 0" class="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                          {{ modalEventForm.references.length }} links
                        </span>
                      </div>
                    </summary>

                    <div class="mt-3 space-y-4 pt-3 border-t border-gray-100">

                      <!-- Invite People -->
                      <div>
                        <label class="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                          <IconUsers class="w-4 h-4 text-gray-400" />
                          Invite People
                        </label>
                        <UserSearchInput
                          placeholder="Search by name or npub..."
                          role-label="Role (optional)"
                          :show-role="true"
                          @user-selected="addParticipant"
                        />
                        <div v-if="modalEventForm.participants && modalEventForm.participants.length > 0" class="mt-2.5 space-y-1.5">
                          <div
                            v-for="(participant, index) in modalEventForm.participants"
                            :key="index"
                            class="flex items-center gap-2.5 bg-gray-50 px-3 py-2 rounded-lg"
                          >
                            <div class="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 flex-shrink-0">
                              <img
                                v-if="participant.picture"
                                :src="participant.picture"
                                :alt="participant.name"
                                class="w-full h-full object-cover"
                                @error="(e) => e.target.style.display = 'none'"
                              />
                              <div v-else class="w-full h-full flex items-center justify-center">
                                <IconUser class="w-3.5 h-3.5 text-orange-400" />
                              </div>
                            </div>
                            <p class="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">
                              {{ participant.name || participant.pubkey?.substring(0, 12) + '...' }}
                            </p>
                            <span v-if="participant.role" class="text-[11px] px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded font-medium">{{ participant.role }}</span>
                            <button
                              @click="removeParticipant(index)"
                              type="button"
                              class="w-6 h-6 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center flex-shrink-0 transition-colors"
                            >
                              <IconX class="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Hashtags -->
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Hashtags</label>
                        <div class="flex gap-2">
                          <input
                            v-model="newTag"
                            type="text"
                            placeholder="Add tag"
                            class="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm placeholder-gray-400"
                            @keyup.enter="addTag"
                          />
                          <button
                            @click="addTag"
                            type="button"
                            class="px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-600 text-sm font-medium transition-colors active:scale-95"
                          >
                            Add
                          </button>
                        </div>
                        <div v-if="modalEventForm.tags && modalEventForm.tags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                          <span
                            v-for="(tag, index) in modalEventForm.tags"
                            :key="index"
                            class="inline-flex items-center gap-1 bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full text-xs font-medium border border-orange-100"
                          >
                            #{{ tag }}
                            <button @click="removeTag(index)" type="button" class="hover:text-orange-800 transition-colors">
                              <IconX class="w-3 h-3" />
                            </button>
                          </span>
                        </div>
                      </div>

                      <!-- Links -->
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Reference Links</label>
                        <div class="flex gap-2">
                          <input
                            v-model="newReference"
                            type="url"
                            placeholder="https://..."
                            class="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm placeholder-gray-400"
                            @keyup.enter="addReference"
                          />
                          <button
                            @click="addReference"
                            type="button"
                            class="px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-600 text-sm font-medium transition-colors active:scale-95"
                          >
                            Add
                          </button>
                        </div>
                        <div v-if="modalEventForm.references && modalEventForm.references.length > 0" class="mt-2 space-y-1">
                          <div
                            v-for="(ref, index) in modalEventForm.references"
                            :key="index"
                            class="flex items-center gap-2 text-xs group"
                          >
                            <IconExternalLink class="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <a :href="ref" target="_blank" class="flex-1 truncate text-orange-600 hover:text-orange-700 font-medium">{{ ref }}</a>
                            <button @click="removeReference(index)" type="button" class="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                              <IconX class="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Geohash -->
                      <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Geohash</label>
                        <input
                          v-model="modalEventForm.geohash"
                          type="text"
                          placeholder="e.g., 9q5 — for searchable location"
                          class="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all text-sm placeholder-gray-400"
                        />
                      </div>

                    </div>
                  </details>

                </div>
              </div>

              <!-- Footer -->
              <div class="flex-shrink-0 border-t border-gray-200 bg-white px-5 md:px-6 py-3.5 safe-bottom">
                <div class="flex items-center gap-3">
                  <button
                    v-if="isEditingEvent"
                    @click="handleDeleteEvent"
                    class="p-2.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Delete event"
                  >
                    <IconTrash class="w-4 h-4" />
                  </button>
                  <div class="flex-1"></div>
                  <button
                    @click="handleEventFormCancel"
                    class="px-4 py-2.5 rounded-lg text-gray-500 font-medium hover:bg-gray-100 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    @click="handleEventFormSubmit"
                    :disabled="!isFormValid || isLoading"
                    class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white font-semibold transition-all text-sm shadow-sm shadow-orange-200/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.97] flex items-center gap-2"
                  >
                    <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                    <template v-else>
                      {{ isEditingEvent ? 'Save Changes' : 'Create Event' }}
                    </template>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- View Event Details Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showViewEventModal && selectedEvent" class="fixed inset-0 z-[9999]">
          <!-- Backdrop -->
          <div @click="showViewEventModal = false" class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>

          <!-- Modal -->
          <div class="absolute inset-0 flex md:items-center md:justify-center md:p-8 pointer-events-none">
            <div class="pointer-events-auto w-full md:w-[520px] h-full md:h-auto md:max-h-[88vh] bg-white md:shadow-2xl flex flex-col md:mt-0 mt-auto md:animate-scale-in animate-slide-up rounded-t-3xl md:rounded-2xl max-h-[92vh] overflow-hidden">

              <!-- Top bar -->
              <div class="flex-shrink-0">
                <!-- Mobile drag handle -->
                <div class="md:hidden flex justify-center pt-2.5 pb-1">
                  <div class="w-9 h-1 bg-gray-300 rounded-full"></div>
                </div>
                <!-- Utility row: share actions left, close right -->
                <div class="flex items-center justify-between px-5 md:px-6 pt-2 md:pt-4">
                  <div class="flex items-center gap-0.5">
                    <button
                      @click="openNostrEvent(selectedEvent)"
                      class="p-2 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50/60 transition-colors"
                      title="View on Nostr"
                    >
                      <IconExternalLink class="w-4 h-4" />
                    </button>
                    <button
                      @click="copyNostrEventLink(selectedEvent)"
                      class="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Copy link"
                    >
                      <IconCopy class="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    @click="showViewEventModal = false"
                    class="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <IconX class="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <!-- Scrollable content -->
              <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">
                <div class="px-5 md:px-6 pt-2 pb-6">

                  <!-- Event header -->
                  <div class="mb-5">
                    <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-500 uppercase tracking-widest mb-2">
                      <IconClock v-if="selectedEvent.type === 'time-based'" class="w-3 h-3" />
                      <IconCalendar v-else class="w-3 h-3" />
                      {{ selectedEvent.type === 'time-based' ? 'Time-based event' : 'All-day event' }}
                    </span>
                    <h2 class="text-2xl md:text-[28px] font-bold text-gray-900 leading-[1.2] tracking-tight">
                      {{ selectedEvent.title }}
                    </h2>
                  </div>

                  <!-- Key details — clean full-width rows -->
                  <div class="mb-5 -mx-5 md:-mx-6">
                    <!-- Date & Time -->
                    <div class="flex items-center gap-3.5 px-5 md:px-6 py-3 border-y border-gray-100">
                      <div class="w-10 h-10 rounded-xl bg-orange-50 flex flex-col items-center justify-center flex-shrink-0 border border-orange-100/60">
                        <span class="text-[10px] font-bold text-orange-500 uppercase leading-none">
                          {{ selectedEvent.type === 'time-based'
                            ? new Date(selectedEvent.start * 1000).toLocaleDateString('en-US', { month: 'short' })
                            : '' }}
                        </span>
                        <span class="text-sm font-bold text-gray-900 leading-none mt-px">
                          {{ selectedEvent.type === 'time-based'
                            ? new Date(selectedEvent.start * 1000).getDate()
                            : '—' }}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900">
                          {{ selectedEvent.type === 'time-based'
                            ? new Date(selectedEvent.start * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                            : selectedEvent.start_date }}
                        </p>
                        <p v-if="selectedEvent.type === 'time-based'" class="text-sm text-gray-500 mt-0.5">
                          {{ new Date(selectedEvent.start * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}
                          <template v-if="selectedEvent.end">
                            – {{ new Date(selectedEvent.end * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}
                          </template>
                        </p>
                        <p v-else-if="selectedEvent.end_date" class="text-sm text-gray-500 mt-0.5">
                          Through {{ selectedEvent.end_date }}
                        </p>
                      </div>
                    </div>

                    <!-- Location -->
                    <div v-if="selectedEvent.location" class="flex items-center gap-3.5 px-5 md:px-6 py-3 border-b border-gray-100">
                      <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100/60">
                        <IconMapPin class="w-4.5 h-4.5 text-blue-500" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900 break-words">{{ selectedEvent.location }}</p>
                        <p v-if="selectedEvent.geohash" class="text-xs text-gray-400 mt-0.5 font-mono">{{ selectedEvent.geohash }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Description -->
                  <div v-if="selectedEvent.description" class="mb-5">
                    <p class="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{{ selectedEvent.description }}</p>
                  </div>

                  <!-- People — unified section -->
                  <div v-if="allEventPeople.length > 0" class="mb-5">
                    <div class="flex items-center justify-between mb-3">
                      <h4 class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">People</h4>
                      <div class="flex items-center gap-2.5 text-xs">
                        <span v-if="acceptedCount > 0" class="flex items-center gap-1 text-green-600 font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          {{ acceptedCount }} going
                        </span>
                        <span v-if="tentativeCount > 0" class="flex items-center gap-1 text-amber-600 font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          {{ tentativeCount }} maybe
                        </span>
                        <span v-if="pendingCount > 0" class="flex items-center gap-1 text-gray-400 font-medium">
                          <span class="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                          {{ pendingCount }} pending
                        </span>
                      </div>
                    </div>

                    <!-- Avatar stack preview -->
                    <div v-if="allEventPeople.length > 3" class="flex items-center mb-3">
                      <div class="flex -space-x-2">
                        <div
                          v-for="(person, i) in allEventPeople.slice(0, 6)"
                          :key="'stack-' + person.pubkey"
                          class="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white flex-shrink-0"
                          :style="{ zIndex: 10 - i }"
                        >
                          <img
                            :src="getProfilePicture(person)"
                            :alt="person.name || 'User'"
                            class="w-full h-full object-cover"
                            @error="(e) => { e.target.src = generateAvatar(person.pubkey) }"
                          />
                        </div>
                        <div
                          v-if="allEventPeople.length > 6"
                          class="w-8 h-8 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center flex-shrink-0 text-xs font-semibold text-gray-500"
                        >
                          +{{ allEventPeople.length - 6 }}
                        </div>
                      </div>
                    </div>

                    <!-- Full people list -->
                    <div class="space-y-0.5">
                      <div
                        v-for="person in allEventPeople"
                        :key="'list-' + person.pubkey"
                        class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50/80 transition-colors"
                      >
                        <div class="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                          <img
                            :src="getProfilePicture(person)"
                            :alt="person.name || 'User'"
                            class="w-full h-full object-cover"
                            @error="(e) => { e.target.src = generateAvatar(person.pubkey) }"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 truncate">
                            {{ person.name || person.pubkey?.substring(0, 12) + '...' }}
                          </p>
                          <p v-if="person.role" class="text-xs text-orange-500">{{ person.role }}</p>
                        </div>
                        <span :class="[
                          'inline-flex items-center gap-1 text-xs font-medium',
                          person.rsvpStatus === 'accepted' ? 'text-green-600' :
                          person.rsvpStatus === 'tentative' ? 'text-amber-600' :
                          person.rsvpStatus === 'declined' ? 'text-red-500' :
                          'text-gray-400'
                        ]">
                          <span :class="[
                            'w-1.5 h-1.5 rounded-full',
                            person.rsvpStatus === 'accepted' ? 'bg-green-500' :
                            person.rsvpStatus === 'tentative' ? 'bg-amber-400' :
                            person.rsvpStatus === 'declined' ? 'bg-red-400' :
                            'bg-gray-300'
                          ]"></span>
                          {{ person.rsvpStatus === 'accepted' ? 'Going' :
                             person.rsvpStatus === 'tentative' ? 'Maybe' :
                             person.rsvpStatus === 'declined' ? 'Declined' :
                             'Invited' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Discussion -->
                  <div v-if="eventMessages.length > 0" class="mb-5">
                    <h4 class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Discussion</h4>
                    <div class="space-y-3">
                      <div
                        v-for="msg in eventMessages"
                        :key="msg.id"
                        class="flex items-start gap-2.5"
                      >
                        <div class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
                          <img
                            :src="getProfilePicture(msg)"
                            :alt="msg.name || 'User'"
                            class="w-full h-full object-cover"
                            @error="(e) => { e.target.src = generateAvatar(msg.pubkey) }"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-baseline gap-2 mb-0.5">
                            <span class="text-sm font-semibold text-gray-900">{{ msg.name || msg.pubkey.substring(0, 8) + '...' }}</span>
                            <span class="text-[11px] text-gray-400">{{ new Date(msg.created_at * 1000).toLocaleDateString() }}</span>
                          </div>
                          <p class="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{{ msg.note }}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tags & Links -->
                  <div v-if="(selectedEvent.tags?.length > 0) || (selectedEvent.references?.length > 0)" class="pt-4 border-t border-gray-100">
                    <div v-if="selectedEvent.tags?.length > 0" class="flex flex-wrap gap-1.5 mb-3">
                      <span
                        v-for="(tag, index) in selectedEvent.tags"
                        :key="index"
                        class="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md font-medium"
                      >#{{ tag }}</span>
                    </div>
                    <div v-if="selectedEvent.references?.length > 0" class="space-y-1.5">
                      <a
                        v-for="(ref, index) in selectedEvent.references"
                        :key="index"
                        :href="ref"
                        target="_blank"
                        rel="noopener"
                        class="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium group truncate"
                      >
                        <IconExternalLink class="w-3 h-3 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <span class="truncate underline underline-offset-2 decoration-blue-200 group-hover:decoration-blue-400 transition-colors">{{ ref }}</span>
                      </a>
                    </div>
                  </div>

                </div>
              </div>

              <!-- Sticky footer -->
              <div class="flex-shrink-0 border-t border-gray-200 px-5 md:px-6 py-3 bg-white safe-bottom">
                <div class="flex items-center gap-2">
                  <button
                    @click="openRSVPFromView"
                    class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white font-semibold text-sm transition-all shadow-sm shadow-orange-200/50 flex items-center justify-center gap-1.5 active:scale-[0.97]"
                  >
                    <IconCheck class="w-4 h-4" />
                    {{ getUserRSVP(selectedEvent.id) ? 'Update RSVP' : 'RSVP' }}
                  </button>
                  <button
                    v-if="selectedEvent.pubkey === currentUser?.pubkey"
                    @click="openEditFromView"
                    class="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors flex items-center gap-1.5"
                  >
                    <IconEdit class="w-4 h-4" />
                    Edit
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- RSVP Modal — Streamlined with full event context -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showRSVPModal" class="fixed inset-0 z-[9999]">
          <!-- Backdrop -->
          <div @click="closeRSVPModal" class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>

          <!-- Modal — full-height mobile bottom sheet, centered card on desktop -->
          <div class="absolute inset-0 flex md:items-center md:justify-center md:p-8 pointer-events-none">
            <div
              @click.stop
              class="pointer-events-auto bg-white w-full md:w-[480px] md:max-h-[85vh] max-h-[92vh] mt-auto md:mt-0 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:animate-scale-in animate-slide-up"
            >
              <!-- Mobile drag handle -->
              <div class="md:hidden flex justify-center pt-2.5 pb-1">
                <div class="w-9 h-1 bg-gray-300 rounded-full"></div>
              </div>

              <!-- Header — event title + close -->
              <div class="flex-shrink-0 px-5 md:px-6 pt-3 md:pt-5 pb-3 flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-medium text-orange-500 mb-0.5">RSVP to event</p>
                  <h3 v-if="selectedEvent" class="text-lg md:text-xl font-bold text-gray-900 leading-tight">{{ selectedEvent.title }}</h3>
                </div>
                <button
                  @click="closeRSVPModal"
                  class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5"
                >
                  <IconX class="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <!-- Scrollable content -->
              <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">
                <div v-if="selectedEvent" class="px-5 md:px-6 pb-5 space-y-4">

                  <!-- Event details — compact info rows -->
                  <div class="space-y-2">
                    <!-- Date & Time -->
                    <div class="flex items-center gap-3 py-2">
                      <div class="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <IconClock class="w-4 h-4 text-orange-500" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900">
                          {{ selectedEvent.type === 'time-based'
                            ? new Date(selectedEvent.start * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                            : selectedEvent.start_date }}
                        </p>
                        <p v-if="selectedEvent.type === 'time-based'" class="text-xs text-gray-500 mt-0.5">
                          {{ new Date(selectedEvent.start * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}
                          <template v-if="selectedEvent.end"> — {{ new Date(selectedEvent.end * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}</template>
                        </p>
                        <p v-else-if="selectedEvent.end_date" class="text-xs text-gray-500 mt-0.5">
                          to {{ selectedEvent.end_date }}
                        </p>
                      </div>
                    </div>

                    <!-- Location (clickable if URL) -->
                    <div v-if="selectedEvent.location" class="flex items-center gap-3 py-2">
                      <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <IconMapPin class="w-4 h-4 text-blue-500" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <a
                          v-if="selectedEvent.location.startsWith('http')"
                          :href="selectedEvent.location"
                          target="_blank"
                          rel="noopener"
                          class="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline truncate block"
                        >
                          {{ selectedEvent.location }}
                        </a>
                        <p v-else class="text-sm font-medium text-gray-900 truncate">{{ selectedEvent.location }}</p>
                      </div>
                    </div>

                    <!-- Attendees summary -->
                    <div v-if="getEventRSVPs(selectedEvent.id).length > 0 || (selectedEvent.participants && selectedEvent.participants.length > 0)" class="flex items-center gap-3 py-2">
                      <div class="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <IconUsers class="w-4 h-4 text-green-500" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span v-if="getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').length > 0" class="text-sm font-medium text-green-700">
                            {{ getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').length }} going
                          </span>
                          <span v-if="getEventRSVPs(selectedEvent.id).filter(r => r.status === 'tentative').length > 0" class="text-sm text-amber-600">
                            · {{ getEventRSVPs(selectedEvent.id).filter(r => r.status === 'tentative').length }} maybe
                          </span>
                          <span v-if="selectedEvent.participants && selectedEvent.participants.filter(p => !getParticipantRSVP(selectedEvent.id, p.pubkey)).length > 0" class="text-sm text-gray-400">
                            · {{ selectedEvent.participants.filter(p => !getParticipantRSVP(selectedEvent.id, p.pubkey)).length }} pending
                          </span>
                        </div>
                        <!-- Avatar stack of going users -->
                        <div v-if="getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').length > 0" class="flex items-center mt-1.5 -space-x-1.5">
                          <div
                            v-for="(rsvp, i) in getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').slice(0, 6)"
                            :key="i"
                            class="w-6 h-6 rounded-full overflow-hidden border-2 border-white flex-shrink-0"
                            :title="rsvp.name || rsvp.pubkey?.substring(0, 12)"
                          >
                            <img
                              :src="getProfilePicture(rsvp)"
                              :alt="rsvp.name || 'User'"
                              class="w-full h-full object-cover"
                              @error="(e) => { e.target.src = generateAvatar(rsvp.pubkey) }"
                            />
                          </div>
                          <span v-if="getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').length > 6" class="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-500 font-medium flex-shrink-0">
                            +{{ getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').length - 6 }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Description (collapsible if long) -->
                  <div v-if="selectedEvent.description" class="bg-gray-50/80 rounded-xl px-4 py-3">
                    <p class="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed line-clamp-4">{{ selectedEvent.description }}</p>
                  </div>

                  <!-- Reference links — clickable -->
                  <div v-if="selectedEvent.references && selectedEvent.references.length > 0" class="space-y-1.5">
                    <a
                      v-for="(ref, index) in selectedEvent.references"
                      :key="index"
                      :href="ref"
                      target="_blank"
                      rel="noopener"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50/60 hover:bg-orange-50 border border-orange-100/50 transition-colors group"
                    >
                      <IconExternalLink class="w-3.5 h-3.5 text-orange-400 group-hover:text-orange-500 flex-shrink-0" />
                      <span class="text-sm text-orange-600 group-hover:text-orange-700 font-medium truncate">{{ ref }}</span>
                    </a>
                  </div>

                  <!-- Divider -->
                  <div class="border-t border-gray-100"></div>

                  <!-- Response selection -->
                  <div>
                    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your response</p>
                    <div class="grid grid-cols-3 gap-2.5">
                      <!-- Going -->
                      <button
                        @click="rsvpForm.status = 'accepted'"
                        :class="[
                          'flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 transition-all duration-200 touch-target',
                          rsvpForm.status === 'accepted'
                            ? 'border-green-400 bg-green-50 shadow-md shadow-green-100/50'
                            : 'border-gray-200 bg-white hover:border-green-200 hover:bg-green-50/30'
                        ]"
                      >
                        <div :class="[
                          'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
                          rsvpForm.status === 'accepted' ? 'bg-green-500 scale-110' : 'bg-gray-100'
                        ]">
                          <IconCheck :class="['w-5 h-5', rsvpForm.status === 'accepted' ? 'text-white' : 'text-gray-400']" />
                        </div>
                        <span :class="['text-sm font-bold', rsvpForm.status === 'accepted' ? 'text-green-700' : 'text-gray-500']">Going</span>
                      </button>

                      <!-- Maybe -->
                      <button
                        @click="rsvpForm.status = 'tentative'"
                        :class="[
                          'flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 transition-all duration-200 touch-target',
                          rsvpForm.status === 'tentative'
                            ? 'border-amber-400 bg-amber-50 shadow-md shadow-amber-100/50'
                            : 'border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/30'
                        ]"
                      >
                        <div :class="[
                          'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
                          rsvpForm.status === 'tentative' ? 'bg-amber-500 scale-110' : 'bg-gray-100'
                        ]">
                          <IconAlertCircle :class="['w-5 h-5', rsvpForm.status === 'tentative' ? 'text-white' : 'text-gray-400']" />
                        </div>
                        <span :class="['text-sm font-bold', rsvpForm.status === 'tentative' ? 'text-amber-700' : 'text-gray-500']">Maybe</span>
                      </button>

                      <!-- Can't go -->
                      <button
                        @click="rsvpForm.status = 'declined'"
                        :class="[
                          'flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 transition-all duration-200 touch-target',
                          rsvpForm.status === 'declined'
                            ? 'border-gray-400 bg-gray-100 shadow-md shadow-gray-200/50'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                        ]"
                      >
                        <div :class="[
                          'w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
                          rsvpForm.status === 'declined' ? 'bg-gray-500 scale-110' : 'bg-gray-100'
                        ]">
                          <IconX :class="['w-5 h-5', rsvpForm.status === 'declined' ? 'text-white' : 'text-gray-400']" />
                        </div>
                        <span :class="['text-sm font-bold', rsvpForm.status === 'declined' ? 'text-gray-700' : 'text-gray-500']">Can't go</span>
                      </button>
                    </div>
                  </div>

                  <!-- Availability + Message — shown together when not declining -->
                  <div v-if="rsvpForm.status !== 'declined'" class="space-y-3">
                    <!-- Availability — segmented toggle -->
                    <div>
                      <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mark as</p>
                      <div class="inline-flex bg-gray-100 rounded-lg p-1 w-full">
                        <button
                          @click="rsvpForm.freebusy = 'free'"
                          :class="[
                            'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                            rsvpForm.freebusy === 'free'
                              ? 'bg-white text-green-700 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          ]"
                        >
                          Free
                        </button>
                        <button
                          @click="rsvpForm.freebusy = 'busy'"
                          :class="[
                            'flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200',
                            rsvpForm.freebusy === 'busy'
                              ? 'bg-white text-gray-700 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          ]"
                        >
                          Busy
                        </button>
                      </div>
                    </div>

                    <!-- Message -->
                    <textarea
                      v-model="rsvpForm.note"
                      rows="2"
                      placeholder="Add a message (optional)"
                      class="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 focus:bg-white text-sm placeholder:text-gray-400 resize-none transition-all"
                    ></textarea>
                  </div>

                  <!-- Declining — just a message -->
                  <div v-else>
                    <textarea
                      v-model="rsvpForm.note"
                      rows="2"
                      placeholder="Let the organizer know why (optional)"
                      class="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 focus:bg-white text-sm placeholder:text-gray-400 resize-none transition-all"
                    ></textarea>
                  </div>

                </div>
              </div>

              <!-- Sticky footer -->
              <div class="flex-shrink-0 border-t border-gray-100 bg-white px-5 md:px-6 py-4 safe-bottom">
                <div class="flex items-center gap-3">
                  <button
                    @click="closeRSVPModal"
                    class="px-4 py-3 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    Cancel
                  </button>
                  <button
                    @click="handleRSVPSubmit"
                    :disabled="isLoading"
                    :class="[
                      'flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed',
                      rsvpForm.status === 'accepted'
                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm shadow-green-200/50'
                        : rsvpForm.status === 'tentative'
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white shadow-sm shadow-amber-200/50'
                          : 'bg-gray-500 hover:bg-gray-600 text-white'
                    ]"
                  >
                    <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                    <template v-else>
                      <IconBolt class="w-4 h-4" />
                      <span>{{ rsvpForm.status === 'accepted' ? "I'm going" : rsvpForm.status === 'tentative' ? 'Maybe' : 'Decline' }}</span>
                    </template>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Pending Invitations Modal — mobile responsive -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showPendingInvitationsModal" class="fixed inset-0 z-[9999]">
          <!-- Backdrop -->
          <div @click="closePendingInvitationsModal" class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"></div>

          <!-- Modal -->
          <div class="absolute inset-0 flex md:items-center md:justify-center md:p-8 pointer-events-none">
            <div class="pointer-events-auto w-full md:w-[520px] md:max-h-[85vh] max-h-[92vh] mt-auto md:mt-0 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:animate-scale-in animate-slide-up">

              <!-- Mobile drag handle -->
              <div class="md:hidden flex justify-center pt-2.5 pb-1">
                <div class="w-9 h-1 bg-gray-300 rounded-full"></div>
              </div>

              <!-- Header -->
              <div class="flex-shrink-0 px-5 md:px-6 pt-3 md:pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-lg md:text-xl font-bold text-gray-900">Pending Invitations</h3>
                  <p class="text-sm text-gray-500 mt-0.5">{{ pendingInvitations.length }} event{{ pendingInvitations.length !== 1 ? 's' : '' }} awaiting your response</p>
                </div>
                <button @click="closePendingInvitationsModal" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0">
                  <IconX class="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <!-- Scrollable list -->
              <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">
                <div class="px-5 md:px-6 py-4 space-y-3">
                  <div
                    v-for="event in pendingInvitations"
                    :key="event.id"
                    class="bg-white border border-gray-200 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all"
                  >
                    <!-- Event info -->
                    <div class="mb-3">
                      <h4 class="text-base font-semibold text-gray-900 leading-tight mb-1.5">{{ event.title }}</h4>
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-2 text-sm text-gray-600">
                          <IconClock class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>
                            {{ event.type === 'time-based'
                              ? new Date(event.start * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                              : event.start_date }}
                          </span>
                        </div>
                        <div v-if="event.location" class="flex items-center gap-2 text-sm text-gray-600">
                          <IconMapPin class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span class="truncate">{{ event.location }}</span>
                        </div>
                        <div v-if="event.participants && event.participants.length > 0" class="flex items-center gap-2 text-sm text-gray-500">
                          <IconUsers class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>{{ event.participants.length }} invited</span>
                        </div>
                      </div>
                      <p v-if="event.description" class="text-sm text-gray-500 mt-2 line-clamp-2">{{ event.description }}</p>
                    </div>

                    <!-- Action buttons -->
                    <div class="flex items-center gap-2">
                      <button
                        @click="openRSVPFromList(event)"
                        class="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-1.5 active:scale-[0.97] shadow-sm"
                      >
                        <IconBolt class="w-3.5 h-3.5" />
                        RSVP
                      </button>
                      <button
                        @click="() => { closePendingInvitationsModal(); viewEvent(event); showViewEventModal = true }"
                        class="py-2.5 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition-colors flex items-center gap-1.5"
                      >
                        <IconEye class="w-3.5 h-3.5" />
                        <span class="hidden sm:inline">Details</span>
                      </button>
                    </div>
                  </div>

                  <div v-if="pendingInvitations.length === 0" class="text-center py-10">
                    <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <IconCheck class="w-6 h-6 text-green-500" />
                    </div>
                    <p class="text-sm text-gray-500">All caught up — no pending invitations</p>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex-shrink-0 border-t border-gray-100 px-5 md:px-6 py-3.5 safe-bottom">
                <button
                  @click="closePendingInvitationsModal"
                  class="w-full py-2.5 rounded-xl text-gray-600 font-medium text-sm hover:bg-gray-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Apple-style slide up animation for mobile bottom sheet */
@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.animate-slide-up {
  animation: slide-up 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Apple-style scale in animation for desktop modal */
@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-scale-in {
  animation: scale-in 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Modal transitions */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

/* Smooth scrolling for modal content */
.overflow-y-auto {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

/* Custom scrollbar styling for webkit browsers */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

/* Line clamp utilities for description preview */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
