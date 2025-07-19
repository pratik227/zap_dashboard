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
import { formatDate, formatTime, isToday, isSameDay } from '../utils/dateUtils.js'

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
  createNewEvent
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
  participants: [],
  tags: []
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
    console.log(`Event ${event.id} - Start: ${start}, End: ${end}`)
    
    return {
      id: event.id,
      title: event.title,
      start: start,
      end: end,
      allDay: event.type === 'date-based',
      backgroundColor: event.type === 'time-based' ? '#dbeafe' : '#dcfce7',
      borderColor: event.type === 'time-based' ? '#3b82f6' : '#16a34a',
      textColor: event.type === 'time-based' ? '#1e40af' : '#15803d',
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
      left: 'prev,next today',
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
    tags: []
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
    tags: [...(event.tags || [])]
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
}

// Modal handlers
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
    tags: []
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

// Form validation
const isFormValid = computed(() => {
  return modalEventForm.value.title.trim() &&
         modalEventForm.value.start_date &&
         (modalEventForm.value.type === 'date-based' || modalEventForm.value.start_time)
})

// Initialize
onMounted(() => {
  if (isAuthenticated.value) {
    fetchCalendarEvents()
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
      <!-- Calendar Header -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <!-- Title and Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 mb-1 flex items-center space-x-2">
                <IconCalendar class="w-6 h-6 text-orange-600" />
                <span>Calendar Events</span>
              </h1>
              <p class="text-gray-600 text-sm">
                View and manage Nostr calendar events (NIP-52)
              </p>
            </div>
            
            <!-- Quick Actions -->
            <div class="flex items-center space-x-2">
              <button @click="goToToday" class="btn-secondary text-sm">
                Today
              </button>
              
              <button @click="showFilters = !showFilters" class="btn-secondary">
                <IconFilter class="w-4 h-4" />
                Filters
              </button>
              
              <button @click="createNewEvent" class="btn-primary">
                <IconPlus class="w-4 h-4" />
                New Event
              </button>
            </div>
          </div>
        </div>
        
        <!-- Filters -->
        <div v-if="showFilters" class="mt-6 pt-6 border-t border-orange-100/50">
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
  </div>
</template>
