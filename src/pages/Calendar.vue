<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
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
  IconShare
} from '@iconify-prerendered/vue-tabler'
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

// Calendar state
const currentDate = ref(new Date())
const selectedDate = ref(new Date())
const calendarView = ref('month') // month, week, day
const showEventModal = ref(false)
const showFilters = ref(false)
const searchQuery = ref('')
const selectedFilters = ref({
  type: 'all', // all, time-based, date-based
  status: 'all' // all, upcoming, past
})

// Calendar navigation
const navigateMonth = (direction) => {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + direction)
  currentDate.value = newDate
}

const navigateWeek = (direction) => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + (direction * 7))
  currentDate.value = newDate
}

const navigateDay = (direction) => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + direction)
  currentDate.value = newDate
}

const goToToday = () => {
  currentDate.value = new Date()
  selectedDate.value = new Date()
}

// Calendar grid generation
const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - firstDay.getDay())
  
  const days = []
  const current = new Date(startDate)
  
  for (let i = 0; i < 42; i++) {
    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === month,
      isToday: isToday(current),
      isSelected: isSameDay(current, selectedDate.value),
      events: getEventsForDate(current)
    })
    current.setDate(current.getDate() + 1)
  }
  
  return days
})

const weekDays = computed(() => {
  const startOfWeek = new Date(currentDate.value)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  
  const days = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(date.getDate() + i)
    days.push({
      date,
      isToday: isToday(date),
      isSelected: isSameDay(date, selectedDate.value),
      events: getEventsForDate(date)
    })
  }
  
  return days
})

// Get events for a specific date
const getEventsForDate = (date) => {
  return filteredEvents.value.filter(event => {
    if (event.type === 'time-based') {
      const eventDate = new Date(event.start * 1000)
      return isSameDay(eventDate, date)
    } else if (event.type === 'date-based') {
      const eventDate = new Date(event.start_date)
      return isSameDay(eventDate, date)
    }
    return false
  })
}

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
const handleDateClick = (day) => {
  selectedDate.value = new Date(day.date)
  if (day.events.length === 1) {
    viewEvent(day.events[0])
  } else if (day.events.length > 1) {
    // Show day view with multiple events
    calendarView.value = 'day'
    currentDate.value = new Date(day.date)
  }
}

const handleEventClick = (event) => {
  viewEvent(event)
  showEventModal.value = true
}

const handleCreateEvent = async () => {
  try {
    await createEvent({ ...eventForm })
    setView('list')
    showEventModal.value = false
  } catch (error) {
    console.error('Failed to create event:', error)
  }
}

const handleUpdateEvent = async () => {
  if (!selectedEvent.value) return
  
  try {
    await updateEvent(selectedEvent.value.id, { ...eventForm })
    setView('list')
    showEventModal.value = false
  } catch (error) {
    console.error('Failed to update event:', error)
  }
}

const handleDeleteEvent = async (event) => {
  if (confirm(`Are you sure you want to delete "${event.title}"?`)) {
    try {
      await deleteEvent(event.id)
      showEventModal.value = false
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }
}

const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Format event time for display
const formatEventTime = (event) => {
  if (event.type === 'time-based') {
    const start = new Date(event.start * 1000)
    const end = event.end ? new Date(event.end * 1000) : null
    
    if (end && !isSameDay(start, end)) {
      return `${formatDate(start)} ${formatTime(start)} - ${formatDate(end)} ${formatTime(end)}`
    } else if (end) {
      return `${formatTime(start)} - ${formatTime(end)}`
    } else {
      return formatTime(start)
    }
  } else {
    const start = new Date(event.start_date)
    const end = event.end_date ? new Date(event.end_date) : null
    
    if (end && !isSameDay(start, end)) {
      return `${formatDate(start)} - ${formatDate(end)}`
    } else {
      return formatDate(start)
    }
  }
}

// Get event type badge color
const getEventTypeBadge = (type) => {
  return type === 'time-based' 
    ? 'bg-blue-100 text-blue-700' 
    : 'bg-green-100 text-green-700'
}

// Get event status
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

// Month/year display
const currentMonthYear = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })
})

const currentWeekRange = computed(() => {
  const startOfWeek = new Date(currentDate.value)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  
  return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`
})

const currentDayDisplay = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric',
    year: 'numeric' 
  })
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
          <!-- Title and Navigation -->
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
            
            <!-- Calendar Navigation -->
            <div class="flex items-center space-x-2">
              <button
                @click="calendarView === 'month' ? navigateMonth(-1) : 
                        calendarView === 'week' ? navigateWeek(-1) : 
                        navigateDay(-1)"
                class="btn-secondary p-2"
              >
                <IconChevronLeft class="w-4 h-4" />
              </button>
              
              <div class="text-center min-w-[200px]">
                <div class="font-semibold text-gray-900">
                  {{ calendarView === 'month' ? currentMonthYear :
                     calendarView === 'week' ? currentWeekRange :
                     currentDayDisplay }}
                </div>
              </div>
              
              <button
                @click="calendarView === 'month' ? navigateMonth(1) : 
                        calendarView === 'week' ? navigateWeek(1) : 
                        navigateDay(1)"
                class="btn-secondary p-2"
              >
                <IconChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center space-x-3">
            <!-- View Toggle -->
            <div class="flex items-center bg-orange-50 p-1 rounded-lg">
              <button
                @click="calendarView = 'month'"
                :class="[
                  'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  calendarView === 'month'
                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                    : 'text-orange-700 hover:bg-orange-100/80'
                ]"
              >
                Month
              </button>
              <button
                @click="calendarView = 'week'"
                :class="[
                  'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  calendarView === 'week'
                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                    : 'text-orange-700 hover:bg-orange-100/80'
                ]"
              >
                Week
              </button>
              <button
                @click="calendarView = 'day'"
                :class="[
                  'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  calendarView === 'day'
                    ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                    : 'text-orange-700 hover:bg-orange-100/80'
                ]"
              >
                Day
              </button>
            </div>
            
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

      <!-- Calendar Views -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <!-- Month View -->
        <div v-if="calendarView === 'month'" class="p-6">
          <!-- Calendar Grid -->
          <div class="grid grid-cols-7 gap-1 mb-4">
            <!-- Day Headers -->
            <div v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" 
                 :key="day" 
                 class="p-2 text-center text-sm font-medium text-gray-600">
              {{ day }}
            </div>
            
            <!-- Calendar Days -->
            <div
              v-for="day in calendarDays"
              :key="day.date.toISOString()"
              @click="handleDateClick(day)"
              :class="[
                'min-h-[80px] p-1 border border-gray-100 cursor-pointer transition-all duration-200 hover:bg-orange-50',
                day.isCurrentMonth ? 'bg-white' : 'bg-gray-50',
                day.isToday ? 'bg-orange-100 border-orange-300' : '',
                day.isSelected ? 'ring-2 ring-orange-400' : ''
              ]"
            >
              <div class="flex flex-col h-full">
                <div :class="[
                  'text-sm font-medium mb-1',
                  day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                  day.isToday ? 'text-orange-600 font-bold' : ''
                ]">
                  {{ day.date.getDate() }}
                </div>
                
                <!-- Events -->
                <div class="flex-1 space-y-1">
                  <div
                    v-for="event in day.events.slice(0, 2)"
                    :key="event.id"
                    @click.stop="handleEventClick(event)"
                    :class="[
                      'text-xs p-1 rounded truncate cursor-pointer transition-colors',
                      getEventTypeBadge(event.type)
                    ]"
                  >
                    {{ event.title }}
                  </div>
                  <div v-if="day.events.length > 2" class="text-xs text-gray-500">
                    +{{ day.events.length - 2 }} more
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Week View -->
        <div v-else-if="calendarView === 'week'" class="p-6">
          <div class="grid grid-cols-7 gap-4">
            <div
              v-for="day in weekDays"
              :key="day.date.toISOString()"
              class="space-y-2"
            >
              <div class="text-center">
                <div class="text-sm font-medium text-gray-600">
                  {{ day.date.toLocaleDateString('en-US', { weekday: 'short' }) }}
                </div>
                <div :class="[
                  'text-lg font-semibold',
                  day.isToday ? 'text-orange-600' : 'text-gray-900'
                ]">
                  {{ day.date.getDate() }}
                </div>
              </div>
              
              <div class="space-y-2 min-h-[200px]">
                <div
                  v-for="event in day.events"
                  :key="event.id"
                  @click="handleEventClick(event)"
                  :class="[
                    'p-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md',
                    getEventTypeBadge(event.type)
                  ]"
                >
                  <div class="font-medium text-sm truncate">{{ event.title }}</div>
                  <div class="text-xs opacity-75">{{ formatEventTime(event) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Day View -->
        <div v-else-if="calendarView === 'day'" class="p-6">
          <div class="space-y-4">
            <div
              v-for="event in getEventsForDate(currentDate)"
              :key="event.id"
              @click="handleEventClick(event)"
              class="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center space-x-2 mb-2">
                    <h3 class="font-semibold text-gray-900">{{ event.title }}</h3>
                    <span :class="['px-2 py-1 rounded-full text-xs font-medium', getEventTypeBadge(event.type)]">
                      {{ event.type === 'time-based' ? 'Timed' : 'All Day' }}
                    </span>
                    <span :class="['text-xs font-medium', getStatusColor(getEventStatus(event))]">
                      {{ getEventStatus(event) }}
                    </span>
                  </div>
                  
                  <p class="text-gray-600 text-sm mb-2">{{ event.description }}</p>
                  
                  <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <span class="flex items-center space-x-1">
                      <IconClock class="w-4 h-4" />
                      <span>{{ formatEventTime(event) }}</span>
                    </span>
                    <span v-if="event.location" class="flex items-center space-x-1">
                      <IconMapPin class="w-4 h-4" />
                      <span>{{ event.location }}</span>
                    </span>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2">
                  <button
                    @click.stop="editEvent(event)"
                    class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  >
                    <IconEdit class="w-4 h-4" />
                  </button>
                  <button
                    @click.stop="handleDeleteEvent(event)"
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <IconTrash class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <!-- No events for day -->
            <div v-if="getEventsForDate(currentDate).length === 0" class="text-center py-12">
              <IconCalendar class="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">No events today</h3>
              <p class="text-gray-600 mb-4">Create your first event for this day</p>
              <button @click="createNewEvent" class="btn-primary">
                <IconPlus class="w-4 h-4" />
                Create Event
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Events List -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
        <div class="p-6 border-b border-orange-100/50">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">Upcoming Events</h3>
            <span class="text-sm text-gray-500">{{ filteredEvents.length }} events</span>
          </div>
        </div>
        
        <div v-if="isLoading" class="p-6">
          <div class="flex items-center justify-center space-x-2">
            <IconLoader class="w-5 h-5 animate-spin text-orange-600" />
            <span class="text-gray-600">Loading events...</span>
          </div>
        </div>
        
        <div v-else-if="filteredEvents.length === 0" class="p-6 text-center">
          <IconCalendar class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No events found</h4>
          <p class="text-gray-600 mb-4">
            {{ events.length === 0 ? 'Create your first calendar event' : 'Try adjusting your filters' }}
          </p>
          <button @click="createNewEvent" class="btn-primary">
            <IconPlus class="w-4 h-4" />
            Create Event
          </button>
        </div>
        
        <div v-else class="divide-y divide-orange-100/50">
          <div
            v-for="event in filteredEvents.slice(0, 10)"
            :key="event.id"
            @click="handleEventClick(event)"
            class="p-4 hover:bg-orange-25/50 transition-colors cursor-pointer"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                  <h4 class="font-semibold text-gray-900">{{ event.title }}</h4>
                  <span :class="['px-2 py-1 rounded-full text-xs font-medium', getEventTypeBadge(event.type)]">
                    {{ event.type === 'time-based' ? 'Timed' : 'All Day' }}
                  </span>
                  <span :class="['text-xs font-medium', getStatusColor(getEventStatus(event))]">
                    {{ getEventStatus(event) }}
                  </span>
                </div>
                
                <p class="text-gray-600 text-sm mb-2">{{ event.description }}</p>
                
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span class="flex items-center space-x-1">
                    <IconClock class="w-4 h-4" />
                    <span>{{ formatEventTime(event) }}</span>
                  </span>
                  <span v-if="event.location" class="flex items-center space-x-1">
                    <IconMapPin class="w-4 h-4" />
                    <span>{{ event.location }}</span>
                  </span>
                  <span v-if="event.participants && event.participants.length > 0" class="flex items-center space-x-1">
                    <IconUsers class="w-4 h-4" />
                    <span>{{ event.participants.length }} participants</span>
                  </span>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  @click.stop="editEvent(event)"
                  class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <IconEdit class="w-4 h-4" />
                </button>
                <button
                  @click.stop="handleDeleteEvent(event)"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <IconTrash class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>