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
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrCalendar } from '../composables/useNostrCalendar.js'
import { formatDate, formatTime, isToday, isSameDay } from '../utils/dateUtils.js'
import UserSearchInput from '../components/UserSearchInput.vue'

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
  
  console.log('🔍 Checking invited events. Total events:', events.value.length)
  console.log('🔍 Current user pubkey:', currentUser.value.pubkey.substring(0, 8))
  console.log('🔍 All event titles:', events.value.map(e => e.title))
  
  const invited = events.value.filter(event => {
    const isNotCreator = event.pubkey !== currentUser.value.pubkey
    const isParticipant = event.participants?.some(p => p.pubkey === currentUser.value.pubkey)
    
    console.log(`🔍 Event "${event.title}":`, {
      creator: event.pubkey.substring(0, 8),
      isNotCreator,
      hasParticipants: !!event.participants,
      participantCount: event.participants?.length || 0,
      isParticipant,
      participantPubkeys: event.participants?.map(p => p.pubkey.substring(0, 8))
    })
    
    if (isNotCreator && isParticipant) {
      console.log('✅ INVITED EVENT FOUND:', event.title)
    }
    
    return isNotCreator && isParticipant
  })
  
  console.log('📨 Total invited events:', invited.length)
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
    console.log(`Event ${event.id} - Start: ${start}, End: ${end}`, {
      title: event.title,
      creator: event.pubkey?.substring(0, 8),
      hasParticipants: !!event.participants,
      participantCount: event.participants?.length || 0
    })
    
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
}

const handleEventFormSubmit = async () => {
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

const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
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
      console.log('Link copied to clipboard:', link)
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
  if (pendingInvitations.value.length === 1) {
    openRSVPModal(pendingInvitations.value[0])
  } else if (pendingInvitations.value.length > 1) {
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

// Watch for events changes to refetch RSVPs
watch(() => events.value.length, (newLength, oldLength) => {
  if (newLength > 0 && newLength !== oldLength) {
    console.log('Events loaded, fetching RSVPs for all events...')
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

    <!-- Event Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showEventModal" class="fixed inset-0 z-[9999]">
          <!-- Backdrop -->
          <div
            @click="closeEventModal"
            class="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          ></div>

          <!-- Modal Content - Desktop: centered card, Mobile: bottom sheet -->
          <div class="absolute inset-0 flex md:items-center md:justify-center md:p-12 pointer-events-none">
            <div class="pointer-events-auto w-full md:w-[640px] h-full md:h-auto md:max-h-[85vh] bg-white md:shadow-xl md:overflow-hidden flex flex-col md:mt-0 mt-auto md:animate-scale-in animate-slide-up rounded-t-3xl md:rounded-2xl max-h-[90vh]">
              <!-- Header - Minimal and elegant -->
              <div class="flex-shrink-0 md:sticky md:top-0 md:z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 rounded-t-3xl md:rounded-t-2xl">
                <div class="px-6 md:px-8 pt-6 md:pt-7 pb-5 md:pb-6 flex items-start justify-between">
                  <div class="flex-1">
                    <h2 class="text-xl md:text-2xl font-semibold text-gray-900 tracking-tight leading-tight">
                      {{ isEditingEvent ? 'Edit Event' : 'New Event' }}
                    </h2>
                    <p class="text-sm text-gray-500 mt-1.5">{{ isEditingEvent ? 'Update event details' : 'Create a new calendar event' }}</p>
                  </div>
                  <button
                    @click="closeEventModal"
                    class="w-8 h-8 md:w-9 md:h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all duration-200 flex-shrink-0 ml-4"
                  >
                    <IconX class="w-4.5 h-4.5 md:w-5 md:h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <!-- Scrollable Content -->
              <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">
                <div class="px-6 md:px-8 py-6 md:py-8">
                <div class="space-y-7">
                  <!-- Title -->
                  <div>
                    <label class="block text-sm font-medium text-gray-900 mb-2.5">Title</label>
                    <input
                      v-model="modalEventForm.title"
                      type="text"
                      placeholder="Event title"
                      class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-base placeholder-gray-400 hover:border-gray-400"
                    />
                  </div>

                  <!-- Type - Segmented Control Style -->
                  <div>
                    <label class="block text-sm font-medium text-gray-900 mb-2.5">Event Type</label>
                    <div class="inline-flex bg-gray-100/80 rounded-lg p-1.5 w-full">
                      <button
                        type="button"
                        @click="modalEventForm.type = 'time-based'"
                        :class="[
                          'flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200',
                          modalEventForm.type === 'time-based'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        ]"
                      >
                        <IconClock class="w-4 h-4 inline mr-2" />
                        Time-based
                      </button>
                      <button
                        type="button"
                        @click="modalEventForm.type = 'date-based'"
                        :class="[
                          'flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200',
                          modalEventForm.type === 'date-based'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-800'
                        ]"
                      >
                        <IconCalendar class="w-4 h-4 inline mr-2" />
                        Date-based
                      </button>
                    </div>
                  </div>

                  <!-- Date and Time - Card Style -->
                  <div class="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <label class="block text-sm font-medium text-gray-900 mb-4">When</label>
                    <div class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <label class="block text-xs font-medium text-gray-700 mb-2">Start Date</label>
                          <input
                            v-model="modalEventForm.start_date"
                            type="date"
                            class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-700 mb-2">End Date</label>
                          <input
                            v-model="modalEventForm.end_date"
                            type="date"
                            class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
                          />
                        </div>
                      </div>

                      <!-- Time fields for time-based events -->
                      <div v-if="modalEventForm.type === 'time-based'" class="grid grid-cols-2 gap-4 pt-3 border-t border-gray-300">
                        <div>
                          <label class="block text-xs font-medium text-gray-700 mb-2">Start Time</label>
                          <input
                            v-model="modalEventForm.start_time"
                            type="time"
                            class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-700 mb-2">End Time</label>
                          <input
                            v-model="modalEventForm.end_time"
                            type="time"
                            class="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Description -->
                  <div>
                    <label class="block text-sm font-medium text-gray-900 mb-2.5">Description</label>
                    <textarea
                      v-model="modalEventForm.description"
                      rows="4"
                      placeholder="Add details about your event..."
                      class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-base placeholder-gray-400 resize-none hover:border-gray-400"
                    ></textarea>
                  </div>

                  <!-- Location -->
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2.5">
                      <IconMapPin class="w-4 h-4 text-gray-500" />
                      Location
                    </label>
                    <input
                      v-model="modalEventForm.location"
                      type="text"
                      placeholder="Add location or online link"
                      class="w-full px-4 py-3.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-base placeholder-gray-400 hover:border-gray-400"
                    />
                    <p class="text-xs text-gray-500 mt-2.5">Physical address or video call link</p>
                  </div>

                  <!-- Geohash - Collapsible -->
                  <details class="group">
                    <summary class="flex items-center justify-between cursor-pointer text-sm font-medium text-gray-600 py-2.5 hover:text-gray-800 transition-colors">
                      <span>Advanced Location (Geohash)</span>
                      <IconChevronRight class="w-4 h-4 transition-transform group-open:rotate-90" />
                    </summary>
                    <div class="mt-3">
                      <input
                        v-model="modalEventForm.geohash"
                        type="text"
                        placeholder="e.g., 9q5"
                        class="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm placeholder-gray-400 hover:border-gray-400"
                      />
                      <p class="text-xs text-gray-500 mt-2.5">Geohash for searchable physical location</p>
                    </div>
                  </details>

                  <!-- Participants -->
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                      <IconUsers class="w-4 h-4 text-gray-500" />
                      Participants
                    </label>
                    <div class="space-y-3">
                      <!-- User Search Component -->
                      <UserSearchInput
                        placeholder="Search users by name or npub..."
                        role-label="Role (optional)"
                        :show-role="true"
                        @user-selected="addParticipant"
                      />

                      <!-- Selected Participants List -->
                      <div v-if="modalEventForm.participants && modalEventForm.participants.length > 0" class="space-y-2.5">
                        <div
                          v-for="(participant, index) in modalEventForm.participants"
                          :key="index"
                          class="flex items-center gap-3 bg-gray-50 px-4 py-3.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          <!-- Avatar -->
                          <div class="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200 flex-shrink-0">
                            <img
                              v-if="participant.picture"
                              :src="participant.picture"
                              :alt="participant.name"
                              class="w-full h-full object-cover"
                              @error="(e) => e.target.style.display = 'none'"
                            />
                            <div v-else class="w-full h-full flex items-center justify-center">
                              <IconUser class="w-5 h-5 text-gray-500" />
                            </div>
                          </div>

                          <!-- User Info -->
                          <div class="flex-1 min-w-0">
                            <p class="font-medium text-sm text-gray-900 truncate">
                              {{ participant.name || participant.pubkey?.substring(0, 16) + '...' }}
                            </p>
                            <div class="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span v-if="participant.nip05" class="truncate">{{ participant.nip05 }}</span>
                              <span v-else class="font-mono truncate">{{ participant.pubkey?.substring(0, 16) }}...</span>
                              <span v-if="participant.role" class="inline-flex items-center px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{{ participant.role }}</span>
                            </div>
                          </div>

                          <!-- Remove Button -->
                          <button
                            @click="removeParticipant(index)"
                            type="button"
                            class="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 transition-colors"
                          >
                            <IconX class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tags -->
                  <div>
                    <label class="block text-sm font-medium text-gray-900 mb-3">
                      Hashtags
                    </label>
                    <div class="space-y-3">
                      <div class="flex gap-2.5">
                        <input
                          v-model="newTag"
                          type="text"
                          placeholder="Add hashtag"
                          class="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm placeholder-gray-400 hover:border-gray-400"
                          @keyup.enter="addTag"
                        />
                        <button
                          @click="addTag"
                          type="button"
                          class="w-11 h-11 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95"
                        >
                          <IconPlus class="w-5 h-5" />
                        </button>
                      </div>
                      <div v-if="modalEventForm.tags && modalEventForm.tags.length > 0" class="flex flex-wrap gap-2">
                        <span
                          v-for="(tag, index) in modalEventForm.tags"
                          :key="index"
                          class="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium border border-orange-100"
                        >
                          #{{ tag }}
                          <button
                            @click="removeTag(index)"
                            type="button"
                            class="hover:bg-orange-100 rounded-full p-0.5 transition-colors"
                          >
                            <IconX class="w-3 h-3" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- References / Links -->
                  <div>
                    <label class="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                      <IconExternalLink class="w-4 h-4 text-gray-500" />
                      Reference Links
                    </label>
                    <div class="space-y-3">
                      <div class="flex gap-2.5">
                        <input
                          v-model="newReference"
                          type="url"
                          placeholder="https://example.com"
                          class="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm placeholder-gray-400 hover:border-gray-400"
                          @keyup.enter="addReference"
                        />
                        <button
                          @click="addReference"
                          type="button"
                          class="w-11 h-11 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95"
                        >
                          <IconPlus class="w-5 h-5" />
                        </button>
                      </div>
                      <div v-if="modalEventForm.references && modalEventForm.references.length > 0" class="space-y-2.5">
                        <div
                          v-for="(ref, index) in modalEventForm.references"
                          :key="index"
                          class="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          <a :href="ref" target="_blank" class="flex-1 truncate text-orange-600 hover:text-orange-700 text-sm font-medium">
                            {{ ref }}
                          </a>
                          <button
                            @click="removeReference(index)"
                            type="button"
                            class="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 transition-colors"
                          >
                            <IconX class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>

              <!-- Fixed Footer with Actions -->
              <div class="flex-shrink-0 md:sticky md:bottom-0 md:z-10 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 md:px-8 py-4 md:py-5 safe-bottom">
                <div>
                  <!-- Mobile Layout: Stacked Buttons -->
                  <div class="flex md:hidden flex-col gap-2">
                    <button
                      @click="handleEventFormSubmit"
                      :disabled="!isFormValid || isLoading"
                      class="w-full py-3 rounded-xl bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-white font-semibold transition-all text-sm shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin inline mr-1.5" />
                      <IconCheck v-else class="w-4 h-4 inline mr-1.5" />
                      {{ isEditingEvent ? 'Update Event' : 'Create Event' }}
                    </button>
                    <div class="flex gap-2">
                      <button
                        @click="handleEventFormCancel"
                        class="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        v-if="isEditingEvent"
                        @click="handleDeleteEvent"
                        class="flex-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold transition-colors text-sm"
                      >
                        <IconTrash class="w-4 h-4 inline mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <!-- Desktop Layout: Horizontal Buttons -->
                  <div class="hidden md:flex items-center justify-between gap-3">
                    <!-- Delete Button (Edit Mode Only) -->
                    <button
                      v-if="isEditingEvent"
                      @click="handleDeleteEvent"
                      class="px-5 py-2.5 rounded-lg text-red-600 font-medium hover:bg-red-50 transition-all text-base"
                    >
                      <IconTrash class="w-4 h-4 inline mr-1.5" />
                      Delete
                    </button>

                    <!-- Spacer for alignment -->
                    <div v-else class="flex-1"></div>

                    <!-- Cancel & Submit -->
                    <div class="flex items-center gap-3 flex-1 justify-end">
                      <button
                        @click="handleEventFormCancel"
                        class="px-5 py-2.5 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-all text-base"
                      >
                        Cancel
                      </button>
                      <button
                        @click="handleEventFormSubmit"
                        :disabled="!isFormValid || isLoading"
                        class="px-6 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all text-base shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                      >
                        <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin inline mr-2" />
                        {{ isEditingEvent ? 'Update Event' : 'Create Event' }}
                      </button>
                    </div>
                  </div>
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
        <div v-if="showViewEventModal && selectedEvent" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-start mb-6">
              <div class="flex-1">
                <h3 class="text-2xl font-bold text-gray-900">{{ selectedEvent.title }}</h3>
                <div class="flex items-center space-x-2 mt-2">
                  <span :class="['inline-block px-3 py-1 rounded-full text-xs font-medium', getEventTypeBadge(selectedEvent.type)]">
                    {{ selectedEvent.type === 'time-based' ? 'Time-based Event' : 'Date-based Event' }}
                  </span>
                  <!-- RSVP Summary -->
                  <div v-if="getEventRSVPs(selectedEvent.id).length > 0 || (selectedEvent.participants && selectedEvent.participants.length > 0)" class="flex items-center space-x-1 text-xs">
                    <span class="px-2 py-1 bg-green-50 text-green-700 rounded-full">
                      {{ getEventRSVPs(selectedEvent.id).filter(r => r.status === 'accepted').length }} ✓
                    </span>
                    <span class="px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">
                      {{ getEventRSVPs(selectedEvent.id).filter(r => r.status === 'tentative').length }} ?
                    </span>
                    <span class="px-2 py-1 bg-red-50 text-red-700 rounded-full">
                      {{ getEventRSVPs(selectedEvent.id).filter(r => r.status === 'declined').length }} ✗
                    </span>
                    <span v-if="selectedEvent.participants && selectedEvent.participants.length > 0" class="px-2 py-1 bg-gray-50 text-gray-600 rounded-full">
                      {{ selectedEvent.participants.filter(p => !getParticipantRSVP(selectedEvent.id, p.pubkey)).length }} pending
                    </span>
                  </div>
                </div>
              </div>
              <button @click="showViewEventModal = false" class="text-gray-500 hover:text-gray-700">
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <!-- Date/Time -->
              <div class="bg-gray-50 p-4 rounded-lg">
                <div class="flex items-start space-x-3">
                  <IconClock class="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <p class="font-medium text-gray-900">
                      {{ selectedEvent.type === 'time-based' 
                        ? new Date(selectedEvent.start * 1000).toLocaleString() 
                        : selectedEvent.start_date }}
                    </p>
                    <p v-if="selectedEvent.end || selectedEvent.end_date" class="text-sm text-gray-600 mt-1">
                      to {{ selectedEvent.type === 'time-based' 
                        ? new Date(selectedEvent.end * 1000).toLocaleString() 
                        : selectedEvent.end_date }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Description -->
              <div v-if="selectedEvent.description">
                <h4 class="font-medium text-gray-900 mb-2">Description</h4>
                <p class="text-gray-700 whitespace-pre-wrap">{{ selectedEvent.description }}</p>
              </div>

              <!-- Location -->
              <div v-if="selectedEvent.location">
                <div class="flex items-start space-x-3">
                  <IconMapPin class="w-5 h-5 text-gray-600 mt-0.5" />
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900 mb-1">Location</h4>
                    <p class="text-gray-700">{{ selectedEvent.location }}</p>
                    <p v-if="selectedEvent.geohash" class="text-xs text-gray-500 mt-1">
                      Geohash: {{ selectedEvent.geohash }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Attendees (Going) - All accepted RSVPs -->
              <div v-if="getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.status === 'accepted').length > 0">
                <div class="flex items-start space-x-3">
                  <div class="text-2xl mt-0.5">🧑‍🤝‍🧑</div>
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900 mb-1">Attendees</h4>
                    <p class="text-sm text-green-600 font-medium mb-3">
                      Going · {{ getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.status === 'accepted').length }} 
                      {{ getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.status === 'accepted').length === 1 ? 'person' : 'people' }}
                    </p>
                    <div class="space-y-2">
                      <div
                        v-for="(rsvp, index) in getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.status === 'accepted')"
                        :key="index"
                        class="flex items-center space-x-3 bg-green-50 px-3 py-2 rounded-lg border border-green-100"
                      >
                        <!-- Avatar -->
                        <div class="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          <img
                            v-if="rsvp.picture"
                            :src="rsvp.picture"
                            :alt="rsvp.name"
                            class="w-full h-full object-cover"
                            @error="(e) => e.target.style.display = 'none'"
                          />
                          <div v-else class="w-full h-full flex items-center justify-center">
                            <IconUser class="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                        
                        <!-- User Info -->
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center space-x-2">
                            <p class="font-medium text-sm text-gray-900 truncate">
                              {{ rsvp.name || rsvp.pubkey?.substring(0, 16) + '...' }}
                            </p>
                          </div>
                          <div class="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
                            <span v-if="rsvp.nip05" class="truncate">{{ rsvp.nip05 }}</span>
                            <span v-else class="font-mono truncate">{{ rsvp.pubkey?.substring(0, 16) }}...</span>
                          </div>
                        </div>
                        
                        <!-- Going Badge -->
                        <span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          ✓ Going
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Invited Participants -->
              <div v-if="selectedEvent.participants && selectedEvent.participants.length > 0">
                <div class="flex items-start space-x-3">
                  <IconUsers class="w-5 h-5 text-gray-600 mt-0.5" />
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900 mb-2">
                      Invited Participants ({{ selectedEvent.participants.length }})
                      <span class="text-xs text-gray-500 font-normal ml-2">
                        {{ selectedEvent.participants.filter(p => getParticipantRSVP(selectedEvent.id, p.pubkey)?.status === 'accepted').length }} accepted,
                        {{ selectedEvent.participants.filter(p => !getParticipantRSVP(selectedEvent.id, p.pubkey)).length }} pending
                      </span>
                    </h4>
                    <div class="space-y-2">
                      <div
                        v-for="(participant, index) in selectedEvent.participants"
                        :key="index"
                        class="flex items-center space-x-3 bg-gray-50 px-3 py-2 rounded-lg"
                      >
                        <!-- Avatar -->
                        <div class="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                          <img
                            v-if="participant.picture"
                            :src="participant.picture"
                            :alt="participant.name"
                            class="w-full h-full object-cover"
                            @error="(e) => e.target.style.display = 'none'"
                          />
                          <div v-else class="w-full h-full flex items-center justify-center">
                            <IconUser class="w-5 h-5 text-gray-400" />
                          </div>
                        </div>
                        
                        <!-- User Info -->
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center space-x-2">
                            <p class="font-medium text-sm text-gray-900 truncate">
                              {{ participant.name || participant.pubkey?.substring(0, 16) + '...' }}
                            </p>
                            <span v-if="participant.role" class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                              {{ participant.role }}
                            </span>
                          </div>
                          <div class="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
                            <span v-if="participant.nip05" class="truncate">{{ participant.nip05 }}</span>
                            <span v-else class="font-mono truncate">{{ participant.pubkey?.substring(0, 16) }}...</span>
                          </div>
                        </div>
                        
                        <!-- RSVP Status -->
                        <div class="flex-shrink-0">
                          <span
                            v-if="getParticipantRSVP(selectedEvent.id, participant.pubkey)"
                            :class="['px-2 py-1 rounded-full text-xs font-medium', getRSVPStatusColor(getParticipantRSVP(selectedEvent.id, participant.pubkey).status)]"
                          >
                            {{ getRSVPStatusIcon(getParticipantRSVP(selectedEvent.id, participant.pubkey).status) }}
                            {{ getParticipantRSVP(selectedEvent.id, participant.pubkey).status }}
                          </span>
                          <span v-else class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            • Pending
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tags -->
              <div v-if="selectedEvent.tags && selectedEvent.tags.length > 0">
                <h4 class="font-medium text-gray-900 mb-2">Tags</h4>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(tag, index) in selectedEvent.tags"
                    :key="index"
                    class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                  >
                    #{{ tag }}
                  </span>
                </div>
              </div>

              <!-- References -->
              <div v-if="selectedEvent.references && selectedEvent.references.length > 0">
                <div class="flex items-start space-x-3">
                  <IconExternalLink class="w-5 h-5 text-gray-600 mt-0.5" />
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900 mb-2">Reference Links</h4>
                    <div class="space-y-2">
                      <a
                        v-for="(ref, index) in selectedEvent.references"
                        :key="index"
                        :href="ref"
                        target="_blank"
                        class="block text-blue-600 hover:underline text-sm truncate"
                      >
                        {{ ref }}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Discussion (RSVP Notes) -->
              <div v-if="getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.note && rsvp.note.trim()).length > 0">
                <div class="flex items-start space-x-3">
                  <IconMessage class="w-5 h-5 text-gray-600 mt-0.5" />
                  <div class="flex-1">
                    <h4 class="font-medium text-gray-900 mb-3">
                      Discussion
                      <span class="text-xs text-gray-500 font-normal ml-1">
                        ({{ getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.note && rsvp.note.trim()).length }})
                      </span>
                    </h4>
                    <div class="space-y-3">
                      <div
                        v-for="rsvp in getEventRSVPs(selectedEvent.id).filter(rsvp => rsvp.note && rsvp.note.trim())"
                        :key="rsvp.id"
                        class="bg-gray-50 p-3 rounded-lg"
                      >
                        <div class="flex items-start space-x-3">
                          <!-- Avatar -->
                          <div class="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                            <img
                              v-if="rsvp.picture"
                              :src="rsvp.picture"
                              :alt="rsvp.name"
                              class="w-full h-full object-cover"
                              @error="(e) => e.target.style.display = 'none'"
                            />
                            <div v-else class="w-full h-full flex items-center justify-center">
                              <IconUser class="w-5 h-5 text-gray-400" />
                            </div>
                          </div>
                          
                          <div class="flex-1 min-w-0">
                            <!-- Header -->
                            <div class="flex items-center justify-between mb-1">
                              <div class="flex items-center space-x-2">
                                <span class="font-medium text-sm text-gray-900">
                                  {{ rsvp.name || rsvp.pubkey.substring(0, 16) + '...' }}
                                </span>
                                <span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getRSVPStatusColor(rsvp.status)]">
                                  {{ getRSVPStatusIcon(rsvp.status) }} {{ rsvp.status }}
                                </span>
                              </div>
                              <span class="text-xs text-gray-500">
                                {{ new Date(rsvp.created_at * 1000).toLocaleDateString() }}
                              </span>
                            </div>
                            
                            <!-- NIP-05 -->
                            <p v-if="rsvp.nip05" class="text-xs text-gray-500 mb-2">{{ rsvp.nip05 }}</p>
                            
                            <!-- Note/Comment -->
                            <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ rsvp.note }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Other RSVPs (non-participants who responded) -->
              <div v-if="getEventRSVPs(selectedEvent.id).filter(rsvp => !selectedEvent.participants?.some(p => p.pubkey === rsvp.pubkey)).length > 0">
                <h4 class="font-medium text-gray-900 mb-2">
                  Other RSVPs 
                  <span class="text-xs text-gray-500 font-normal ml-1">
                    ({{ getEventRSVPs(selectedEvent.id).filter(rsvp => !selectedEvent.participants?.some(p => p.pubkey === rsvp.pubkey)).length }})
                  </span>
                </h4>
                <p class="text-xs text-gray-500 mb-2">People who RSVP'd but weren't invited</p>
                <div class="space-y-2">
                  <div
                    v-for="rsvp in getEventRSVPs(selectedEvent.id).filter(rsvp => !selectedEvent.participants?.some(p => p.pubkey === rsvp.pubkey))"
                    :key="rsvp.id"
                    class="bg-gray-50 px-3 py-2 rounded-lg text-sm"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-mono text-xs">{{ rsvp.pubkey.substring(0, 16) }}...</span>
                      <span :class="['px-2 py-1 rounded-full text-xs font-medium', getRSVPStatusColor(rsvp.status)]">
                        {{ getRSVPStatusIcon(rsvp.status) }} {{ rsvp.status }}
                      </span>
                    </div>
                    <p v-if="rsvp.note" class="text-gray-600 mt-1">{{ rsvp.note }}</p>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <!-- Left side - View on Nostr -->
                <div class="flex items-center space-x-2">
                  <button
                    @click="openNostrEvent(selectedEvent)"
                    class="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center"
                  >
                    <IconExternalLink class="w-4 h-4 inline mr-1" />
                    View on Nostr
                  </button>
                  <button
                    @click="copyNostrEventLink(selectedEvent)"
                    class="text-gray-600 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                    title="Copy link"
                  >
                    <IconCopy class="w-4 h-4" />
                  </button>
                </div>
                
                <!-- Right side - Action buttons -->
                <div class="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                  <button
                    @click="openRSVPFromView"
                    class="w-full sm:w-auto btn-secondary"
                  >
                    <IconCheck class="w-4 h-4 inline mr-2" />
                    {{ getUserRSVP(selectedEvent.id) ? 'Update RSVP' : 'RSVP' }}
                  </button>
                  <button
                    v-if="selectedEvent.pubkey === currentUser?.pubkey"
                    @click="openEditFromView"
                    class="w-full sm:w-auto btn-primary"
                  >
                    <IconEdit class="w-4 h-4 inline mr-2" />
                    Edit Event
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- RSVP Modal -->
    <Teleport to="#modal-root">
      <transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showRSVPModal" @click="closeRSVPModal" class="fixed inset-0 bg-black/40 z-[9999] flex items-end md:items-center justify-center">
          <transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="translate-y-full md:translate-y-0 md:scale-95 opacity-0"
            enter-to-class="translate-y-0 md:scale-100 opacity-100"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="translate-y-0 md:scale-100 opacity-100"
            leave-to-class="translate-y-full md:translate-y-0 md:scale-95 opacity-0"
          >
            <div
              @click.stop
              class="bg-white w-full md:max-w-lg md:mx-4 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
            >
              <!-- Handle bar for mobile -->
              <div class="md:hidden flex justify-center pt-3 pb-1">
                <div class="w-10 h-1 bg-gray-300 rounded-full"></div>
              </div>

              <!-- Header -->
              <div class="px-6 pt-5 pb-4 border-b border-gray-100">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <h3 class="text-xl font-bold text-gray-900">RSVP</h3>
                    <p class="text-sm text-gray-500 mt-0.5">Respond to invitation</p>
                  </div>
                  <button
                    @click="closeRSVPModal"
                    class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <IconX class="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              <!-- Content -->
              <div class="px-6 py-6 max-h-[70vh] md:max-h-[600px] overflow-y-auto">
                <!-- Event Info Card -->
                <div v-if="selectedEvent" class="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 mb-6 border border-amber-100">
                  <div class="flex items-start gap-3">
                    <div class="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                      <IconCalendar class="w-6 h-6 text-amber-600" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <h4 class="text-base font-semibold text-gray-900 mb-1 truncate">{{ selectedEvent.title }}</h4>
                      <div class="flex items-center gap-2 text-sm text-gray-600">
                        <IconClock class="w-4 h-4 flex-shrink-0" />
                        <span>
                          {{ selectedEvent.type === 'time-based'
                            ? new Date(selectedEvent.start * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                            : new Date(selectedEvent.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Response Options -->
                <div class="mb-5">
                  <label class="block text-sm font-semibold text-gray-700 mb-3">Your Response</label>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      @click="rsvpForm.status = 'accepted'"
                      :class="[
                        'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                        rsvpForm.status === 'accepted'
                          ? 'border-amber-400 bg-amber-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      ]"
                    >
                      <div :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        rsvpForm.status === 'accepted' ? 'bg-amber-400' : 'bg-gray-100'
                      ]">
                        <IconCheck :class="['w-4 h-4', rsvpForm.status === 'accepted' ? 'text-white' : 'text-gray-400']" />
                      </div>
                      <span :class="['text-xs font-semibold', rsvpForm.status === 'accepted' ? 'text-amber-700' : 'text-gray-600']">Yes</span>
                    </button>

                    <button
                      @click="rsvpForm.status = 'tentative'"
                      :class="[
                        'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                        rsvpForm.status === 'tentative'
                          ? 'border-blue-400 bg-blue-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      ]"
                    >
                      <div :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        rsvpForm.status === 'tentative' ? 'bg-blue-400' : 'bg-gray-100'
                      ]">
                        <IconAlertCircle :class="['w-4 h-4', rsvpForm.status === 'tentative' ? 'text-white' : 'text-gray-400']" />
                      </div>
                      <span :class="['text-xs font-semibold', rsvpForm.status === 'tentative' ? 'text-blue-700' : 'text-gray-600']">Maybe</span>
                    </button>

                    <button
                      @click="rsvpForm.status = 'declined'"
                      :class="[
                        'flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all',
                        rsvpForm.status === 'declined'
                          ? 'border-gray-400 bg-gray-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                      ]"
                    >
                      <div :class="[
                        'w-8 h-8 rounded-full flex items-center justify-center',
                        rsvpForm.status === 'declined' ? 'bg-gray-400' : 'bg-gray-100'
                      ]">
                        <IconX :class="['w-4 h-4', rsvpForm.status === 'declined' ? 'text-white' : 'text-gray-400']" />
                      </div>
                      <span :class="['text-xs font-semibold', rsvpForm.status === 'declined' ? 'text-gray-700' : 'text-gray-600']">No</span>
                    </button>
                  </div>
                </div>

                <!-- Availability -->
                <div v-if="rsvpForm.status !== 'declined'" class="mb-5">
                  <label class="block text-sm font-semibold text-gray-700 mb-3">Availability</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      @click="rsvpForm.freebusy = 'free'"
                      :class="[
                        'py-2.5 px-4 rounded-xl border-2 transition-all text-sm font-medium',
                        rsvpForm.freebusy === 'free'
                          ? 'border-green-400 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      ]"
                    >
                      Free
                    </button>
                    <button
                      @click="rsvpForm.freebusy = 'busy'"
                      :class="[
                        'py-2.5 px-4 rounded-xl border-2 transition-all text-sm font-medium',
                        rsvpForm.freebusy === 'busy'
                          ? 'border-gray-400 bg-gray-50 text-gray-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      ]"
                    >
                      Busy
                    </button>
                  </div>
                </div>

                <!-- Note -->
                <div>
                  <label class="block text-sm font-semibold text-gray-700 mb-3">Add a message <span class="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    v-model="rsvpForm.note"
                    rows="3"
                    placeholder="Let them know you're excited to attend..."
                    class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-base placeholder:text-gray-400 resize-none"
                  ></textarea>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button
                  @click="handleRSVPSubmit"
                  :disabled="isLoading"
                  class="w-full py-4 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-2xl font-semibold text-base transition-all shadow-lg hover:shadow-xl disabled:shadow-none hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  <IconLoader v-if="isLoading" class="w-5 h-5 animate-spin" />
                  <template v-else>
                    <IconBolt class="w-5 h-5" />
                    <span>Send Response</span>
                  </template>
                </button>
              </div>
            </div>
          </transition>
        </div>
      </transition>
    </Teleport>

    <!-- Pending Invitations List Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showPendingInvitationsModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-6">
              <div>
                <h3 class="text-xl font-bold text-gray-900">Pending Invitations</h3>
                <p class="text-sm text-gray-600 mt-1">You have {{ pendingInvitations.length }} pending event invitation{{ pendingInvitations.length !== 1 ? 's' : '' }}</p>
              </div>
              <button @click="closePendingInvitationsModal" class="text-gray-500 hover:text-gray-700">
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <div
                v-for="(event, index) in pendingInvitations"
                :key="event.id"
                class="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <h4 class="text-lg font-semibold text-gray-900 truncate">{{ event.title }}</h4>
                      <span :class="['inline-block px-2 py-0.5 rounded-full text-xs font-medium', getEventTypeBadge(event.type)]">
                        {{ event.type === 'time-based' ? 'Time-based' : 'Date-based' }}
                      </span>
                    </div>

                    <div class="space-y-2 text-sm text-gray-700">
                      <div class="flex items-center gap-2">
                        <IconClock class="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span>
                          {{ event.type === 'time-based'
                            ? new Date(event.start * 1000).toLocaleString()
                            : event.start_date }}
                        </span>
                      </div>

                      <div v-if="event.location" class="flex items-center gap-2">
                        <IconMapPin class="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span class="truncate">{{ event.location }}</span>
                      </div>

                      <div v-if="event.description" class="flex items-start gap-2">
                        <IconMessage class="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                        <p class="line-clamp-2">{{ event.description }}</p>
                      </div>

                      <div class="flex items-center gap-2">
                        <IconUser class="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span class="text-gray-600">
                          Organizer:
                          <span class="font-medium text-gray-900">
                            {{ event.pubkey === currentUser?.pubkey ? 'You' : event.pubkey.substring(0, 16) + '...' }}
                          </span>
                        </span>
                      </div>

                      <div v-if="event.participants && event.participants.length > 0" class="flex items-center gap-2">
                        <IconUsers class="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span class="text-gray-600">{{ event.participants.length }} participant{{ event.participants.length !== 1 ? 's' : '' }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex flex-col gap-2">
                    <button
                      @click="openRSVPFromList(event)"
                      class="btn-primary text-sm whitespace-nowrap"
                    >
                      <IconCheck class="w-4 h-4 inline mr-1" />
                      RSVP
                    </button>
                    <button
                      @click="() => { closePendingInvitationsModal(); viewEvent(event); showViewEventModal = true }"
                      class="btn-secondary text-sm whitespace-nowrap"
                    >
                      <IconEye class="w-4 h-4 inline mr-1" />
                      View Details
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="pendingInvitations.length === 0" class="text-center py-8">
                <IconCheck class="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p class="text-gray-600">All invitations have been responded to!</p>
              </div>
            </div>

            <div class="mt-6 pt-4 border-t border-gray-200">
              <button
                @click="closePendingInvitationsModal"
                class="w-full btn-secondary"
              >
                Close
              </button>
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

/* Line clamp utility for description preview */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
