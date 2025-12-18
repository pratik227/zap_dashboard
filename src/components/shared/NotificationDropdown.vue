<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IconBell,
  IconBellRinging,
  IconCheck,
  IconX,
  IconTrash,
  IconBolt,
  IconWallet,
  IconAlertCircle,
  IconCircleCheck,
  IconSparkles,
  IconFilter,
  IconCalendar,
  IconClock,
  IconChevronDown,
  IconSettings
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../../composables/core/useNotifications.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const {
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  removeNotification,
  NOTIFICATION_TYPES
} = useNotifications()

const showDropdown = ref(false)
const dropdownRef = ref(null)
const filterType = ref('all')
const displayCount = ref(50)
const scrollContainer = ref(null)

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value
  if (showDropdown.value) {
    displayCount.value = 50
  }
}

// Infinite scroll handler
const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target
  if (scrollHeight - scrollTop <= clientHeight + 100) {
    if (displayCount.value < filteredNotifications.value.length) {
      displayCount.value += 50
    }
  }
}

// Filter notifications
const filteredNotifications = computed(() => {
  if (filterType.value === 'all') return notifications.value
  if (filterType.value === 'unread') return notifications.value.filter(n => !n.read)
  if (filterType.value === 'zaps') {
    return notifications.value.filter(n =>
      n.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NWC ||
      n.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR ||
      n.type === NOTIFICATION_TYPES.ZAP_SENT
    )
  }
  if (filterType.value === 'calendar') {
    return notifications.value.filter(n =>
      n.type === NOTIFICATION_TYPES.CALENDAR_INVITE ||
      n.type === NOTIFICATION_TYPES.CALENDAR_EVENT_START
    )
  }
  return notifications.value
})

// Displayed notifications (with infinite scroll limit)
const displayedNotifications = computed(() => {
  return filteredNotifications.value.slice(0, displayCount.value)
})

// Group notifications by date
const groupedNotifications = computed(() => {
  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: []
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const thisWeek = new Date(today)
  thisWeek.setDate(thisWeek.getDate() - 7)

  displayedNotifications.value.forEach(notification => {
    const notifDate = new Date(notification.timestamp)
    const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate())

    if (notifDay.getTime() === today.getTime()) {
      groups.today.push(notification)
    } else if (notifDay.getTime() === yesterday.getTime()) {
      groups.yesterday.push(notification)
    } else if (notifDay >= thisWeek) {
      groups.thisWeek.push(notification)
    } else {
      groups.older.push(notification)
    }
  })

  return groups
})

const handleNotificationClick = (notification) => {
  markAsRead(notification.id)
}

const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC:
      return IconWallet
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR:
      return IconSparkles
    case NOTIFICATION_TYPES.ZAP_SENT:
      return IconBolt
    case NOTIFICATION_TYPES.BALANCE_CHANGE:
      return IconWallet
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
      return IconCircleCheck
    case NOTIFICATION_TYPES.CONNECTION_ERROR:
    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR:
      return IconAlertCircle
    case NOTIFICATION_TYPES.CALENDAR_INVITE:
      return IconCalendar
    case NOTIFICATION_TYPES.CALENDAR_EVENT_START:
      return IconClock
    default:
      return IconBell
  }
}

const getNotificationColor = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC:
      return 'text-blue-600 bg-blue-50'
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR:
      return 'text-orange-600 bg-orange-50'
    case NOTIFICATION_TYPES.ZAP_SENT:
      return 'text-amber-600 bg-amber-50'
    case NOTIFICATION_TYPES.BALANCE_CHANGE:
      return 'text-blue-600 bg-blue-50'
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
      return 'text-green-600 bg-green-50'
    case NOTIFICATION_TYPES.CONNECTION_ERROR:
    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR:
      return 'text-red-600 bg-red-50'
    case NOTIFICATION_TYPES.CALENDAR_INVITE:
      return 'text-amber-600 bg-amber-50'
    case NOTIFICATION_TYPES.CALENDAR_EVENT_START:
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatFullTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

const hasUnread = computed(() => unreadCount.value > 0)

const filterOptions = [
  { value: 'all', label: 'All', icon: IconBell },
  { value: 'unread', label: 'Unread', icon: IconBellRinging },
  { value: 'zaps', label: 'Zaps', icon: IconBolt },
  { value: 'calendar', label: 'Calendar', icon: IconCalendar }
]

const unreadFilteredCount = computed(() => {
  return filteredNotifications.value.filter(n => !n.read).length
})
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- Notification Bell Button -->
    <button
      @click="toggleDropdown"
      class="relative text-gray-500 hover:text-amber-600 p-2 rounded-xl transition-all duration-200 hover:bg-amber-50 group flex items-center justify-center"
    >
      <IconBellRinging v-if="hasUnread" class="w-5 h-5 text-amber-600 animate-[wiggle_0.5s_ease-in-out_3]" />
      <IconBell v-else class="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />

      <!-- Unread Count Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full text-white text-[11px] font-bold flex items-center justify-center shadow-lg shadow-red-500/40 ring-2 ring-white"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Notification Dropdown -->
    <transition name="dropdown">
      <div
        v-if="showDropdown"
        class="absolute right-0 top-full mt-2 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
        style="max-height: calc(100vh - 120px);"
      >
        <!-- Header -->
        <div class="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div class="p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <IconBell class="w-5 h-5 text-amber-600" />
                <span>Notifications</span>
              </h3>
              <div class="flex items-center gap-1">
                <button
                  v-if="unreadCount > 0"
                  @click="markAllAsRead"
                  class="text-xs text-amber-600 hover:text-amber-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all duration-200 flex items-center gap-1.5"
                  title="Mark all as read"
                >
                  <IconCheck class="w-4 h-4" />
                  <span>Mark all</span>
                </button>
                <button
                  v-if="notifications.length > 0"
                  @click="clearAllNotifications"
                  class="text-xs text-gray-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all duration-200 flex items-center gap-1.5"
                  title="Clear all"
                >
                  <IconTrash class="w-4 h-4" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            <!-- Filter Tabs -->
            <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                v-for="filter in filterOptions"
                :key="filter.value"
                @click="filterType = filter.value; displayCount = 50"
                :class="[
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  filterType === filter.value
                    ? 'bg-white text-amber-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                <component :is="filter.icon" class="w-4 h-4" />
                <span>{{ filter.label }}</span>
              </button>
            </div>

            <!-- Status Bar -->
            <div class="mt-3 flex items-center justify-between text-xs">
              <span class="text-gray-600">
                <span class="font-semibold text-gray-900">{{ filteredNotifications.length }}</span>
                {{ filterType === 'all' ? 'total' : filterType }}
              </span>
              <span v-if="unreadFilteredCount > 0" class="text-amber-600 font-semibold">
                {{ unreadFilteredCount }} unread
              </span>
              <span v-else class="text-green-600 font-semibold flex items-center gap-1">
                <IconCheck class="w-3.5 h-3.5" />
                All caught up!
              </span>
            </div>

            <!-- Storage Info Banner -->
            <div v-if="notifications.length >= 200" class="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs">
              <div class="flex items-start gap-2">
                <IconAlertCircle class="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div class="flex-1">
                  <p class="text-blue-900 font-medium">
                    Showing {{ notifications.length }} notifications
                  </p>
                  <p class="text-blue-700 mt-0.5">
                    Older notifications are automatically archived. Calendar events are always kept.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notifications List -->
        <div
          ref="scrollContainer"
          @scroll="handleScroll"
          class="overflow-y-auto"
          style="max-height: calc(100vh - 300px);"
        >
          <div v-if="filteredNotifications.length === 0" class="p-12 text-center">
            <div class="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <IconBell class="w-10 h-10 text-gray-300" />
            </div>
            <h4 class="text-base font-semibold text-gray-900 mb-2">No notifications</h4>
            <p class="text-gray-500 text-sm">
              {{ filterType === 'all' ? "You're all caught up!" : `No ${filterType} notifications` }}
            </p>
          </div>

          <div v-else>
            <!-- Today -->
            <div v-if="groupedNotifications.today.length > 0">
              <div class="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 z-5">
                <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Today</h4>
              </div>
              <div
                v-for="notification in groupedNotifications.today"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 border-b border-gray-100 hover:bg-gradient-to-r cursor-pointer transition-all duration-200 relative group',
                  !notification.read
                    ? 'bg-amber-50/40 hover:from-amber-50/60 hover:to-amber-50/30'
                    : 'hover:from-gray-50/60 hover:to-gray-50/30'
                ]"
              >
                <NotificationItem :notification="notification" @remove="removeNotification" />
              </div>
            </div>

            <!-- Yesterday -->
            <div v-if="groupedNotifications.yesterday.length > 0">
              <div class="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 z-5">
                <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Yesterday</h4>
              </div>
              <div
                v-for="notification in groupedNotifications.yesterday"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 border-b border-gray-100 hover:bg-gradient-to-r cursor-pointer transition-all duration-200 relative group',
                  !notification.read
                    ? 'bg-amber-50/40 hover:from-amber-50/60 hover:to-amber-50/30'
                    : 'hover:from-gray-50/60 hover:to-gray-50/30'
                ]"
              >
                <NotificationItem :notification="notification" @remove="removeNotification" />
              </div>
            </div>

            <!-- This Week -->
            <div v-if="groupedNotifications.thisWeek.length > 0">
              <div class="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 z-5">
                <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">This Week</h4>
              </div>
              <div
                v-for="notification in groupedNotifications.thisWeek"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 border-b border-gray-100 hover:bg-gradient-to-r cursor-pointer transition-all duration-200 relative group',
                  !notification.read
                    ? 'bg-amber-50/40 hover:from-amber-50/60 hover:to-amber-50/30'
                    : 'hover:from-gray-50/60 hover:to-gray-50/30'
                ]"
              >
                <NotificationItem :notification="notification" @remove="removeNotification" />
              </div>
            </div>

            <!-- Older -->
            <div v-if="groupedNotifications.older.length > 0">
              <div class="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200 z-5">
                <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Older</h4>
              </div>
              <div
                v-for="notification in groupedNotifications.older"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 border-b border-gray-100 hover:bg-gradient-to-r cursor-pointer transition-all duration-200 relative group',
                  !notification.read
                    ? 'bg-amber-50/40 hover:from-amber-50/60 hover:to-amber-50/30'
                    : 'hover:from-gray-50/60 hover:to-gray-50/30'
                ]"
              >
                <NotificationItem :notification="notification" @remove="removeNotification" />
              </div>
            </div>

            <!-- Load More Indicator -->
            <div v-if="displayCount < filteredNotifications.length" class="p-4 text-center bg-gradient-to-t from-gray-50 to-transparent">
              <div class="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <IconChevronDown class="w-4 h-4 animate-bounce" />
                <span>Showing {{ displayCount }} of {{ filteredNotifications.length }}</span>
              </div>
              <p class="text-xs text-gray-500 mt-1">Scroll for more</p>
            </div>

            <!-- All Loaded Indicator -->
            <div v-else-if="filteredNotifications.length > 20" class="p-3 text-center bg-gray-50 border-t border-gray-200">
              <div class="text-xs text-gray-600 font-medium">
                All {{ filteredNotifications.length }} notifications loaded
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
// Notification Item Component (inline for simplicity)
import { defineComponent, h } from 'vue'

const NotificationItem = defineComponent({
  props: ['notification'],
  emits: ['remove'],
  setup(props, { emit }) {
    const { NOTIFICATION_TYPES } = useNotifications()

    const getNotificationIcon = (type) => {
      switch (type) {
        case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC: return IconWallet
        case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR: return IconSparkles
        case NOTIFICATION_TYPES.ZAP_SENT: return IconBolt
        case NOTIFICATION_TYPES.BALANCE_CHANGE: return IconWallet
        case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
        case NOTIFICATION_TYPES.PAYMENT_SUCCESS: return IconCircleCheck
        case NOTIFICATION_TYPES.CONNECTION_ERROR:
        case NOTIFICATION_TYPES.PAYMENT_ERROR:
        case NOTIFICATION_TYPES.WALLET_ERROR: return IconAlertCircle
        case NOTIFICATION_TYPES.CALENDAR_INVITE: return IconCalendar
        case NOTIFICATION_TYPES.CALENDAR_EVENT_START: return IconClock
        default: return IconBell
      }
    }

    const getNotificationColor = (type) => {
      switch (type) {
        case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC: return 'text-blue-600 bg-blue-50'
        case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR: return 'text-orange-600 bg-orange-50'
        case NOTIFICATION_TYPES.ZAP_SENT: return 'text-amber-600 bg-amber-50'
        case NOTIFICATION_TYPES.BALANCE_CHANGE: return 'text-blue-600 bg-blue-50'
        case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
        case NOTIFICATION_TYPES.PAYMENT_SUCCESS: return 'text-green-600 bg-green-50'
        case NOTIFICATION_TYPES.CONNECTION_ERROR:
        case NOTIFICATION_TYPES.PAYMENT_ERROR:
        case NOTIFICATION_TYPES.WALLET_ERROR: return 'text-red-600 bg-red-50'
        case NOTIFICATION_TYPES.CALENDAR_INVITE: return 'text-amber-600 bg-amber-50'
        case NOTIFICATION_TYPES.CALENDAR_EVENT_START: return 'text-red-600 bg-red-50'
        default: return 'text-gray-600 bg-gray-50'
      }
    }

    const formatTime = (timestamp) => {
      const date = new Date(timestamp)
      const now = new Date()
      const diff = now - date
      if (diff < 60000) return 'Just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }

    return () => h('div', { class: 'flex items-start gap-3' }, [
      // Unread indicator
      !props.notification.read && h('div', {
        class: 'absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-amber-200'
      }),

      // Icon
      h('div', {
        class: `w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105 ${getNotificationColor(props.notification.type)} ${!props.notification.read ? 'ml-3' : ''}`
      }, [
        h(getNotificationIcon(props.notification.type), { class: 'w-5 h-5' })
      ]),

      // Content
      h('div', { class: 'flex-1 min-w-0' }, [
        h('div', { class: 'flex items-start justify-between gap-2 mb-1' }, [
          h('h4', { class: 'text-sm font-semibold text-gray-900 leading-tight' }, props.notification.title),
          h('span', { class: 'text-xs text-gray-500 whitespace-nowrap flex-shrink-0 font-medium' }, formatTime(props.notification.timestamp))
        ]),
        h('p', { class: 'text-sm text-gray-600 leading-snug mb-2' }, props.notification.message),

        // Amount badge
        props.notification.data?.amount && h('div', { class: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700' }, [
          h(IconBolt, { class: 'w-3.5 h-3.5' }),
          h('span', `${props.notification.data.amount.toLocaleString()} sats`)
        ]),

        // Sender info for Nostr zaps
        props.notification.data?.sender && props.notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR && h('div', { class: 'flex items-center gap-2 mt-2 pt-2 border-t border-gray-100' }, [
          h('img', {
            src: props.notification.data.sender.picture || props.notification.data.sender.avatar || generateAvatar(props.notification.data.sender.pubkey),
            alt: props.notification.data.sender.name,
            class: 'w-6 h-6 rounded-full ring-2 ring-white',
            onerror: (e) => e.target.src = generateAvatar(props.notification.data.sender.pubkey)
          }),
          h('span', { class: 'text-xs text-gray-600' }, [
            'from ',
            h('span', { class: 'font-semibold text-gray-900' }, props.notification.data.sender.name)
          ])
        ])
      ]),

      // Remove button
      h('button', {
        onClick: (e) => {
          e.stopPropagation()
          emit('remove', props.notification.id)
        },
        class: 'text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0'
      }, [
        h(IconX, { class: 'w-4 h-4' })
      ])
    ])
  }
})

export default {
  components: {
    NotificationItem
  }
}
</script>

<style scoped>
/* Dropdown transition */
.dropdown-enter-active {
  animation: dropdown-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dropdown-leave-active {
  animation: dropdown-out 0.2s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-16px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdown-out {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
  }
}

@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Smooth scrolling */
.overflow-y-auto {
  scroll-behavior: smooth;
}
</style>
