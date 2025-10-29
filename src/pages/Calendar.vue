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
  IconCheck
} from '@iconify-prerendered/vue-tabler'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrCalendar } from '../composables/useNostrCalendar.js'
import { useNostrCalendarList } from '../composables/useNostrCalendarList.js'
import { formatDate, formatTime, isToday, isSameDay } from '../utils/dateUtils.js'
import CalendarListMobile from '../components/CalendarListMobile.vue'
import CalendarListModal from '../components/CalendarListModal.vue'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

const {
  events,
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
  filterEventsByCalendars
} = useNostrCalendar()

const {
  calendarLists,
  selectedCalendars,
  defaultCalendar,
  fetchCalendarLists,
  getCalendar
} = useNostrCalendarList()

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
const isEditingEvent = ref(false)
const showCalendarListModal = ref(false)
const editingCalendar = ref(null)
const showMobileCalendars = ref(false)

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
  participants: [],
  tags: [],
  calendar_id: null
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

    // Get calendar color if event is assigned to a calendar
    const calendar = event.calendar_id ? getCalendar(event.calendar_id) : null
    const baseColor = calendar?.color || (event.type === 'time-based' ? 'blue' : 'green')

    // Vibrant post-it color system - bold and eye-catching
    const getEventColors = (colorName) => {
      const colorMap = {
        // Bold Blues - confident, strong
        'blue': { bg: '#60A5FA', text: '#1E3A8A' },
        'lightblue': { bg: '#38BDF8', text: '#0C4A6E' },
        'skyblue': { bg: '#7DD3FC', text: '#075985' },

        // Bold Purples - creative, vibrant
        'purple': { bg: '#C084FC', text: '#4C1D95' },
        'lavender': { bg: '#A78BFA', text: '#5B21B6' },
        'indigo': { bg: '#818CF8', text: '#312E81' },

        // Bold Greens - fresh, energetic
        'green': { bg: '#4ADE80', text: '#14532D' },
        'sage': { bg: '#86EFAC', text: '#166534' },
        'mint': { bg: '#5EEAD4', text: '#134E4A' },

        // Bold Yellows/Golds - warm, attention-grabbing
        'yellow': { bg: '#FDE047', text: '#713F12' },
        'amber': { bg: '#FBBF24', text: '#78350F' },

        // Bold Reds/Pinks - urgent, important
        'red': { bg: '#F87171', text: '#7F1D1D' },
        'pink': { bg: '#F472B6', text: '#831843' },
        'rose': { bg: '#FB7185', text: '#881337' },

        // Bold Oranges - energetic, fun
        'orange': { bg: '#FB923C', text: '#7C2D12' },
        'coral': { bg: '#FDBA74', text: '#9A3412' },

        // Bold Teals - modern, fresh
        'teal': { bg: '#2DD4BF', text: '#134E4A' },
        'cyan': { bg: '#22D3EE', text: '#164E63' },

        // Neutral - professional
        'gray': { bg: '#94A3B8', text: '#1E293B' },
        'slate': { bg: '#CBD5E1', text: '#0F172A' }
      }

      return colorMap[colorName] || colorMap['blue']
    }

    const colors = getEventColors(baseColor)

    return {
      id: event.id,
      title: event.title,
      start: start,
      end: end,
      allDay: event.type === 'date-based',
      backgroundColor: colors.bg,
      borderColor: colors.bg,
      textColor: colors.text,
      classNames: [
        'fc-event-custom',
        `fc-event-${event.type}`,
        `fc-event-${getEventStatus(event)}`
      ],
      extendedProps: {
        description: event.description,
        location: event.location,
        participants: event.participants,
        tags: event.tags,
        type: event.type,
        status: getEventStatus(event),
        calendar,
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
    headerToolbar: false,
    initialView: calendarView.value,
    events: fullCalendarEvents.value,
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: 2,
    weekends: true,
    height: 'auto',
    contentHeight: 'auto',
    expandRows: false,
    handleWindowResize: true,
    windowResizeDelay: 100,
    select: handleDateSelect,
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    viewDidMount: handleViewChange,
    themeSystem: 'standard',
    buttonText: {
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      list: 'List'
    },
    dayHeaderFormat: { weekday: 'short' },
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      meridiem: 'short'
    },
    slotLabelFormat: {
      hour: 'numeric',
      minute: '2-digit',
      meridiem: 'short'
    },
    eventDisplay: 'block',
    displayEventTime: true,
    displayEventEnd: false,
    nowIndicator: true,
    scrollTime: '08:00:00'
  }
})

// Filtered events based on search, filters, and calendar selection
const filteredEvents = computed(() => {
  let filtered = [...events.value]

  // Apply calendar filter - only show events from selected calendars
  if (selectedCalendars.value.size > 0) {
    filtered = filtered.filter(event => {
      // Show events without calendar assignment OR events from selected calendars
      return !event.calendar_id || selectedCalendars.value.has(event.calendar_id)
    })
  }

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
    filtered = filtered.filter(event => event.type === selectedFilters.value.type)
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
    participants: [],
    tags: [],
    calendar_id: defaultCalendar.value?.d_tag || null
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
  
  // Open edit event modal
  isEditingEvent.value = true
  selectedEvent.value = event
  
  // Populate form
  modalEventForm.value = {
    title: event.title,
    description: event.description,
    type: event.type,
    location: event.location || '',
    participants: [...(event.participants || [])],
    tags: [...(event.tags || [])],
    calendar_id: event.calendar_id || null
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
  updateCalendarTitle()
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
    tags: [],
    calendar_id: defaultCalendar.value?.d_tag || null
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
    participants: [],
    tags: [],
    calendar_id: defaultCalendar.value?.d_tag || null
  }
}

// Calendar List Modal Handlers
const openCreateCalendarModal = () => {
  editingCalendar.value = null
  showCalendarListModal.value = true
}

const openEditCalendarModal = (calendar) => {
  editingCalendar.value = calendar
  showCalendarListModal.value = true
}

const closeCalendarListModal = () => {
  showCalendarListModal.value = false
  editingCalendar.value = null
}

const toggleMobileCalendars = () => {
  showMobileCalendars.value = !showMobileCalendars.value
}

// Helper functions
const getViewLabel = (view) => {
  const labels = {
    'dayGridMonth': 'Month',
    'timeGridWeek': 'Week',
    'timeGridDay': 'Day',
    'listWeek': 'Agenda'
  }
  return labels[view] || view
}

const changeView = (view) => {
  calendarView.value = view
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.changeView(view)
    updateCalendarTitle()
  }
}

// Calendar title state
const currentCalendarTitle = ref('')

// Update title whenever view changes
const updateCalendarTitle = () => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    currentCalendarTitle.value = calendarApi.view.title
  } else {
    const now = new Date()
    currentCalendarTitle.value = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
}

// Calendar navigation
const goToToday = () => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    calendarApi.today()
    updateCalendarTitle()
  }
}

const navigateCalendar = (direction) => {
  const calendarApi = fullCalendarRef.value?.getApi()
  if (calendarApi) {
    if (direction === 'prev') {
      calendarApi.prev()
    } else if (direction === 'next') {
      calendarApi.next()
    }
    updateCalendarTitle()
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

// Form validation
const isFormValid = computed(() => {
  return modalEventForm.value.title.trim() &&
         modalEventForm.value.start_date &&
         (modalEventForm.value.type === 'date-based' || modalEventForm.value.start_time)
})

// Initialize
onMounted(() => {
  if (isAuthenticated.value) {
    fetchCalendarLists()
    fetchCalendarEvents()
  }
  // Initialize title after a brief delay to ensure calendar is mounted
  setTimeout(() => {
    updateCalendarTitle()
  }, 100)
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
    <div v-else class="flex flex-col min-h-[calc(100vh-180px)] -mx-6 -mb-6">
      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Calendar Header -->
        <div class="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6">
          <!-- Top Row: Primary Actions -->
          <div class="flex items-center justify-between py-3 gap-3">
            <!-- Left: Calendars & Navigation -->
            <div class="flex items-center gap-2 sm:gap-3">
              <button
                @click="toggleMobileCalendars"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
              >
                <IconCalendar class="w-5 h-5" />
                <span class="hidden sm:inline">Calendars</span>
                <span v-if="selectedCalendars.size > 0" class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  {{ selectedCalendars.size }}
                </span>
              </button>

              <!-- Navigation Controls -->
              <div class="flex items-center gap-1 ml-2">
                <button
                  @click="navigateCalendar('prev')"
                  class="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  title="Previous"
                >
                  <IconChevronLeft class="w-5 h-5 text-gray-700" />
                </button>
                <button
                  @click="navigateCalendar('next')"
                  class="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  title="Next"
                >
                  <IconChevronRight class="w-5 h-5 text-gray-700" />
                </button>
                <button
                  @click="goToToday"
                  class="hidden sm:flex px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                >
                  Today
                </button>
              </div>

              <!-- Current Date Display -->
              <h2 class="text-lg sm:text-xl font-semibold text-gray-900 ml-2">
                {{ currentCalendarTitle }}
              </h2>
            </div>

            <!-- Right: View & Actions -->
            <div class="flex items-center gap-2">
              <button @click="showFilters = !showFilters" class="p-2 rounded-lg hover:bg-gray-100 transition-colors sm:hidden">
                <IconFilter class="w-5 h-5 text-gray-700" />
              </button>

              <button @click="openNewEventModal" class="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm font-medium">
                <IconPlus class="w-4 h-4" />
                <span class="hidden sm:inline">Create</span>
              </button>
            </div>
          </div>

          <!-- Bottom Row: View Switcher & Filters (Desktop) -->
          <div class="hidden sm:flex items-center justify-between py-2 border-t border-gray-100">
            <div class="flex items-center gap-1">
              <button
                v-for="view in ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek']"
                :key="view"
                @click="changeView(view)"
                :class="[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  calendarView === view
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50'
                ]"
              >
                {{ getViewLabel(view) }}
              </button>
            </div>

            <button
              @click="showFilters = !showFilters"
              :class="[
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                showFilters ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              ]"
            >
              <IconFilter class="w-4 h-4" />
              Filters
            </button>
          </div>

          <!-- Mobile View Switcher -->
          <div class="flex sm:hidden items-center gap-1 py-2 overflow-x-auto">
            <button
              v-for="view in ['dayGridMonth', 'timeGridWeek', 'listWeek']"
              :key="view"
              @click="changeView(view)"
              :class="[
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                calendarView === view
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700'
              ]"
            >
              {{ getViewLabel(view) }}
            </button>
          </div>
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
              <option value="all">All Types</option>
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
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div v-if="isLoading" class="p-4 sm:p-6 space-y-4 animate-pulse">
              <!-- Calendar header skeleton -->
              <div class="flex items-center justify-between mb-4">
                <div class="h-8 bg-gray-200 rounded w-32"></div>
                <div class="flex gap-2">
                  <div class="h-8 bg-gray-200 rounded w-24"></div>
                  <div class="h-8 bg-gray-200 rounded w-24"></div>
                </div>
              </div>

              <!-- Calendar grid skeleton -->
              <div class="grid grid-cols-7 gap-2">
                <!-- Week day headers -->
                <div v-for="i in 7" :key="'header-' + i" class="h-8 bg-gray-100 rounded"></div>
                <!-- Calendar dates -->
                <div v-for="i in 35" :key="'date-' + i" class="h-20 bg-gray-50 rounded border border-gray-100"></div>
              </div>
            </div>

            <div v-else class="calendar-wrapper">
              <FullCalendar
                ref="fullCalendarRef"
                :options="calendarOptions"
                class="fc-google-theme"
              />
            </div>
          </div>

          <!-- Event Statistics -->
          <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
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
      </div>
    </div>

    <!-- Event Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showEventModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ isEditingEvent ? 'Edit Event' : 'Create Event' }}
              </h3>
              <button @click="closeEventModal" class="text-gray-500 hover:text-gray-700">
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <!-- Title -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  v-model="modalEventForm.title"
                  type="text"
                  placeholder="Event title"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>

              <!-- Calendar Selection -->
              <div v-if="calendarLists.length > 0">
                <label class="block text-sm font-medium text-gray-700 mb-2">Calendar</label>
                <select
                  v-model="modalEventForm.calendar_id"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                >
                  <option :value="null">No Calendar</option>
                  <option v-for="calendar in calendarLists" :key="calendar.d_tag" :value="calendar.d_tag">
                    <span :style="{ color: calendar.color }">●</span> {{ calendar.title }}
                  </option>
                </select>
              </div>

              <!-- Type -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
                <select
                  v-model="modalEventForm.type"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                >
                  <option value="time-based">Time-based Event</option>
                  <option value="date-based">Date-based Event</option>
                </select>
              </div>

              <!-- Date and Time -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    v-model="modalEventForm.start_date"
                    type="date"
                    class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    v-model="modalEventForm.end_date"
                    type="date"
                    class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                </div>
              </div>

              <!-- Time fields for time-based events -->
              <div v-if="modalEventForm.type === 'time-based'" class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    v-model="modalEventForm.start_time"
                    type="time"
                    class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    v-model="modalEventForm.end_time"
                    type="time"
                    class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  v-model="modalEventForm.description"
                  rows="3"
                  placeholder="Event description"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                ></textarea>
              </div>

              <!-- Location -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  v-model="modalEventForm.location"
                  type="text"
                  placeholder="Event location"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>
              
              <!-- Actions -->
              <div class="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  v-if="isEditingEvent"
                  @click="handleDeleteEvent"
                  class="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  <IconTrash class="w-4 h-4 inline mr-2" />
                  Delete
                </button>
                <button
                  @click="handleEventFormCancel"
                  class="w-full sm:w-auto btn-secondary"
                >
                  Cancel
                </button>
                <button
                  @click="handleEventFormSubmit"
                  :disabled="!isFormValid || isLoading"
                  class="w-full sm:w-auto btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin inline mr-2" />
                  <IconCheck v-else class="w-4 h-4 inline mr-2" />
                  {{ isEditingEvent ? 'Update' : 'Create' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Calendar List Modal -->
    <CalendarListModal
      :show="showCalendarListModal"
      :calendar="editingCalendar"
      @close="closeCalendarListModal"
    />

    <!-- Mobile Calendar List -->
    <CalendarListMobile
      :show="showMobileCalendars"
      @close="toggleMobileCalendars"
      @create-calendar="openCreateCalendarModal"
      @edit-calendar="openEditCalendarModal"
    />
  </div>
</template>

<style>
/* Google Calendar-inspired styling */
.calendar-wrapper {
  padding: 0;
}

.fc-google-theme {
  font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #3c4043;
}

/* Toolbar - hidden since we use custom header */
.fc-google-theme .fc-toolbar {
  display: none;
}

/* Table and Grid */
.fc-google-theme .fc-scrollgrid {
  border: none !important;
  border-radius: 0;
}

.fc-google-theme .fc-scrollgrid-sync-table {
  border: none;
}

/* Day Headers */
.fc-google-theme .fc-col-header-cell {
  background: #ffffff;
  border: none !important;
  border-bottom: 1px solid #dadce0 !important;
  padding: 12px 8px;
  font-weight: 500;
  font-size: 11px;
  color: #70757a;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.fc-google-theme .fc-col-header-cell-cushion {
  padding: 4px;
  color: #70757a;
  text-decoration: none;
  font-weight: 500;
}

/* Day Cells */
.fc-google-theme .fc-daygrid-day {
  background: #ffffff;
  border-color: #e8eaed !important;
  border-width: 1px !important;
}

.fc-google-theme .fc-daygrid-day:hover {
  background: #f8f9fa;
  cursor: pointer;
}

.fc-google-theme .fc-day-today {
  background: #fef7e0 !important;
}

.fc-google-theme .fc-daygrid-day-frame {
  min-height: 110px;
  padding: 2px;
  display: flex;
  flex-direction: column;
}

.fc-google-theme .fc-daygrid-day-top {
  display: flex;
  justify-content: flex-start;
  padding: 6px 8px 4px 8px;
  flex-shrink: 0;
}

/* Day Numbers */
.fc-google-theme .fc-daygrid-day-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 13px;
  font-weight: 400;
  color: #3c4043;
  width: 32px;
  height: 32px;
  line-height: 1;
  border-radius: 50%;
  margin: 0;
  transition: all 0.2s ease;
}

.fc-google-theme .fc-daygrid-day-number:hover {
  background: #e8eaed;
}

.fc-google-theme .fc-day-today .fc-daygrid-day-number {
  background: #1a73e8;
  color: #ffffff;
  font-weight: 500;
}

.fc-google-theme .fc-day-other .fc-daygrid-day-number {
  color: #9aa0a6;
  opacity: 0.6;
}

.fc-google-theme .fc-daygrid-day-events {
  padding: 0 6px 4px 6px;
  flex: 1;
  overflow: hidden;
}

/* Events - Vibrant Post-it Style */
.fc-google-theme .fc-event {
  border: none !important;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
  position: relative;
}

.fc-google-theme .fc-event:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.15),
    0 3px 6px rgba(0, 0, 0, 0.1);
  z-index: 20;
}

/* Day Grid Events (Month View) */
.fc-google-theme .fc-daygrid-event {
  margin: 2px 3px;
  padding: 0;
  min-height: 28px;
  border-radius: 6px;
}

.fc-google-theme .fc-daygrid-block-event {
  padding: 5px 10px;
  border-left: none !important;
}

.fc-google-theme .fc-daygrid-block-event .fc-event-main {
  display: flex;
  align-items: center;
  gap: 4px;
  line-height: 1.4;
}

.fc-google-theme .fc-daygrid-block-event .fc-event-time {
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0.9;
}

.fc-google-theme .fc-daygrid-block-event .fc-event-title {
  font-weight: 600;
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* All-day events styling */
.fc-google-theme .fc-daygrid-event.fc-event-start.fc-event-end {
  border-radius: 6px;
}

.fc-google-theme .fc-daygrid-event.fc-event-start:not(.fc-event-end) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  margin-right: 0;
}

.fc-google-theme .fc-daygrid-event:not(.fc-event-start):not(.fc-event-end) {
  border-radius: 0;
  margin-left: 0;
  margin-right: 0;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.08),
    0 1px 2px rgba(0, 0, 0, 0.04);
}

.fc-google-theme .fc-daygrid-event.fc-event-end:not(.fc-event-start) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  margin-left: 0;
}

.fc-google-theme .fc-event-main {
  color: inherit;
  padding: 0;
}

.fc-google-theme .fc-event-title {
  font-weight: 600;
  color: inherit;
  padding: 0;
}

.fc-google-theme .fc-event-time {
  font-weight: 600;
  color: inherit;
  padding: 0;
}

/* Multi-day Events */
.fc-google-theme .fc-daygrid-event {
  margin-bottom: 2px;
}

.fc-google-theme .fc-daygrid-event-harness {
  margin-bottom: 2px;
}

/* For events that span multiple days */
.fc-google-theme .fc-event-start,
.fc-google-theme .fc-event-end {
  border-radius: 4px;
}

.fc-google-theme .fc-event-start {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.fc-google-theme .fc-event-end {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.fc-google-theme .fc-h-event {
  border-left-width: 3px;
  border-left-style: solid;
}

/* Day Grid Event Dots */
.fc-google-theme .fc-daygrid-event-dot {
  border-width: 4px;
  border-radius: 4px;
  margin-right: 4px;
}

/* More Link */
.fc-google-theme .fc-more-link {
  color: #5f6368;
  font-weight: 500;
  font-size: 11px;
  padding: 4px 6px;
  margin: 2px 0;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: inline-block;
}

.fc-google-theme .fc-more-link:hover {
  background: #f1f3f4;
  color: #3c4043;
  text-decoration: none;
}

.fc-google-theme .fc-daygrid-more-link {
  text-align: left;
  padding: 4px 6px;
  margin-top: 2px;
}

/* Time Grid (Week/Day View) */
.fc-google-theme .fc-timegrid-slot {
  height: 48px;
  border-color: #e8eaed !important;
}

.fc-google-theme .fc-timegrid-slot-label {
  border: none !important;
  padding: 0 12px;
  font-size: 10px;
  color: #70757a;
  vertical-align: top;
  padding-top: 2px;
  font-weight: 400;
}

.fc-google-theme .fc-timegrid-axis {
  border: none !important;
}

.fc-google-theme .fc-timegrid-col {
  border-color: #e8eaed !important;
}

.fc-google-theme .fc-timegrid-event {
  border: none !important;
  border-radius: 7px;
  padding: 8px 12px;
  box-shadow:
    0 3px 6px rgba(0, 0, 0, 0.12),
    0 2px 4px rgba(0, 0, 0, 0.08);
}

.fc-google-theme .fc-timegrid-event .fc-event-main {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.fc-google-theme .fc-timegrid-event .fc-event-time {
  font-weight: 700;
  font-size: 12px;
  opacity: 0.95;
}

.fc-google-theme .fc-timegrid-event .fc-event-title {
  font-weight: 600;
  font-size: 13px;
  line-height: 1.4;
}

.fc-google-theme .fc-timegrid-event:hover {
  transform: translateX(-3px) scale(1.03);
  box-shadow:
    0 8px 16px rgba(0, 0, 0, 0.18),
    0 4px 8px rgba(0, 0, 0, 0.12);
}

.fc-google-theme .fc-timegrid-event-harness {
  margin-right: 1px;
}

/* Now Indicator */
.fc-google-theme .fc-timegrid-now-indicator-line {
  border-color: #ea4335;
  border-width: 2px;
}

.fc-google-theme .fc-timegrid-now-indicator-arrow {
  border-color: #ea4335;
  border-width: 6px;
}

/* List View */
.fc-google-theme .fc-list {
  border: none;
}

.fc-google-theme .fc-list-day-cushion {
  background: #f8f9fa;
  padding: 12px 16px;
  font-weight: 500;
  color: #3c4043;
  border-top: 1px solid #dadce0;
}

.fc-google-theme .fc-list-event {
  cursor: pointer;
  transition: background 0.2s ease;
}

.fc-google-theme .fc-list-event:hover {
  background: #f8f9fa;
}

.fc-google-theme .fc-list-event-dot {
  border-width: 6px;
  border-radius: 6px;
}

.fc-google-theme .fc-list-event-title {
  padding: 12px 16px;
  font-size: 14px;
  color: #3c4043;
}

.fc-google-theme .fc-list-event-time {
  padding: 12px 16px;
  font-size: 13px;
  color: #70757a;
}

/* Popover */
.fc-google-theme .fc-popover {
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fc-google-theme .fc-popover-header {
  background: #f8f9fa;
  padding: 12px 16px;
  border-bottom: 1px solid #dadce0;
  font-weight: 500;
}

.fc-google-theme .fc-popover-close {
  font-size: 20px;
  color: #5f6368;
  opacity: 1;
}

/* List View (Agenda) */
.fc-google-theme .fc-list-event {
  border-left: 3px solid !important;
  transition: background 0.1s ease;
}

.fc-google-theme .fc-list-event:hover {
  background: #f8f9fa;
}

.fc-google-theme .fc-list-event-time,
.fc-google-theme .fc-list-event-title {
  padding: 12px 16px;
}

.fc-google-theme .fc-list-event-time {
  font-size: 13px;
  font-weight: 400;
  color: #5f6368;
}

.fc-google-theme .fc-list-event-title {
  font-size: 14px;
  font-weight: 500;
}

.fc-google-theme .fc-list-day-cushion {
  background: #f8f9fa;
  padding: 8px 16px;
  font-weight: 500;
  font-size: 13px;
  color: #3c4043;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .fc-google-theme .fc-daygrid-day-frame {
    min-height: 80px;
    padding: 2px;
  }

  .fc-google-theme .fc-daygrid-day-top {
    padding: 4px 6px 2px 6px;
  }

  .fc-google-theme .fc-daygrid-day-number {
    padding: 0;
    font-size: 12px;
    width: 26px;
    height: 26px;
    line-height: 1;
  }

  .fc-google-theme .fc-daygrid-day-events {
    padding: 0 3px 2px 3px;
  }

  .fc-google-theme .fc-daygrid-event {
    margin: 2px 2px;
    padding: 0;
    min-height: 26px;
    border-radius: 5px;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .fc-google-theme .fc-daygrid-block-event {
    padding: 4px 8px;
  }

  .fc-google-theme .fc-daygrid-block-event .fc-event-time {
    display: none;
  }

  .fc-google-theme .fc-daygrid-block-event .fc-event-title {
    font-size: 12px;
    font-weight: 600;
  }

  .fc-google-theme .fc-col-header-cell {
    padding: 8px 4px;
    font-size: 10px;
  }

  .fc-google-theme .fc-timegrid-slot {
    height: 40px;
  }

  .fc-google-theme .fc-timegrid-slot-label {
    font-size: 9px;
    padding: 0 8px;
  }

  .fc-google-theme .fc-timegrid-event {
    padding: 6px 10px;
    border-radius: 6px;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .fc-google-theme .fc-timegrid-event .fc-event-time {
    font-weight: 700;
    font-size: 11px;
  }

  .fc-google-theme .fc-timegrid-event .fc-event-title {
    font-weight: 600;
    font-size: 12px;
  }

  .calendar-wrapper {
    font-size: 12px;
  }

  .fc-google-theme .fc-list-event-title,
  .fc-google-theme .fc-list-event-time {
    padding: 10px 12px;
    font-size: 12px;
  }

  .fc-google-theme .fc-more-link {
    font-size: 10px;
    padding: 2px 4px;
  }
}

/* Smooth transitions */
.fc-google-theme * {
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Selection Highlight */
.fc-google-theme .fc-highlight {
  background: rgba(26, 115, 232, 0.1);
}

/* Scrollbar styling for calendar */
.fc-google-theme .fc-scroller::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.fc-google-theme .fc-scroller::-webkit-scrollbar-track {
  background: #f1f3f4;
}

.fc-google-theme .fc-scroller::-webkit-scrollbar-thumb {
  background: #dadce0;
  border-radius: 4px;
}

.fc-google-theme .fc-scroller::-webkit-scrollbar-thumb:hover {
  background: #bdc1c6;
}
</style>
