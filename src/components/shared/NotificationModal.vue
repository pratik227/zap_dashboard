<script setup>
import { ref, computed, toRef, onMounted, onUnmounted } from 'vue'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import {
  IconBell,
  IconBellRinging,
  IconBolt,
  IconCalendar,
  IconCheck,
  IconTrash,
  IconX
} from '@iconify-prerendered/vue-tabler'
import NotificationItem from './NotificationItem.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  notifications: { type: Array, default: () => [] },
  notificationTypes: { type: Object, required: true }
})

const emit = defineEmits(['close', 'mark-read', 'mark-all-read', 'remove', 'clear-all'])

const modalRoot = ref(null)
useFocusTrap(toRef(props, 'show'), modalRoot)

const filterType = ref('all')

const handleEscape = (e) => {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})

const filteredNotifications = computed(() => {
  if (filterType.value === 'all') return props.notifications
  if (filterType.value === 'unread') return props.notifications.filter(n => !n.read)
  if (filterType.value === 'zaps') {
    return props.notifications.filter(n =>
      n.type === props.notificationTypes.ZAP_RECEIVED_NWC ||
      n.type === props.notificationTypes.ZAP_RECEIVED_NOSTR ||
      n.type === props.notificationTypes.ZAP_SENT
    )
  }
  if (filterType.value === 'calendar') {
    return props.notifications.filter(n =>
      n.type === props.notificationTypes.CALENDAR_INVITE ||
      n.type === props.notificationTypes.CALENDAR_EVENT_START
    )
  }
  return props.notifications
})

const unreadCount = computed(() => props.notifications.filter(n => !n.read).length)

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

  filteredNotifications.value.forEach(notification => {
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

const filterOptions = [
  { value: 'all', label: 'All', icon: IconBell },
  { value: 'unread', label: 'Unread', icon: IconBellRinging },
  { value: 'zaps', label: 'Zaps', icon: IconBolt },
  { value: 'calendar', label: 'Calendar', icon: IconCalendar }
]

const handleNotificationClick = (notification) => {
  emit('mark-read', notification.id)
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal">
      <div
        v-if="show"
        ref="modalRoot"
        class="fixed inset-0 bg-black/50 backdrop-blur-lg z-[9999] flex items-center justify-center p-4"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
        tabindex="-1"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="p-4 border-b border-gray-200 flex-shrink-0">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
                <IconBell class="w-5 h-5 text-amber-600" />
                <span>All Notifications</span>
              </h2>
              <div class="flex items-center gap-1">
                <button
                  v-if="unreadCount > 0"
                  @click="emit('mark-all-read')"
                  class="text-xs text-amber-600 hover:text-amber-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all duration-200 flex items-center gap-1.5"
                  title="Mark all as read"
                >
                  <IconCheck class="w-4 h-4" />
                  <span>Mark all</span>
                </button>
                <button
                  v-if="notifications.length > 0"
                  @click="emit('clear-all')"
                  class="text-xs text-gray-500 hover:text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all duration-200 flex items-center gap-1.5"
                  title="Clear all"
                >
                  <IconTrash class="w-4 h-4" />
                  <span>Clear</span>
                </button>
                <button
                  @click="emit('close')"
                  class="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 ml-1"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Filter Tabs -->
            <div class="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                v-for="filter in filterOptions"
                :key="filter.value"
                @click="filterType = filter.value"
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

            <!-- Count -->
            <div class="mt-3 flex items-center justify-between text-xs">
              <span class="text-gray-600">
                <span class="font-semibold text-gray-900">{{ filteredNotifications.length }}</span>
                {{ filterType === 'all' ? 'total' : filterType }}
              </span>
              <span v-if="unreadCount > 0" class="text-amber-600 font-semibold">
                {{ unreadCount }} unread
              </span>
              <span v-else class="text-green-600 font-semibold flex items-center gap-1">
                <IconCheck class="w-3.5 h-3.5" />
                All caught up!
              </span>
            </div>
          </div>

          <!-- Notification List -->
          <div class="overflow-y-auto flex-1">
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
              <template v-if="groupedNotifications.today.length > 0">
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
                  <NotificationItem :notification="notification" @remove="emit('remove', $event)" />
                </div>
              </template>

              <!-- Yesterday -->
              <template v-if="groupedNotifications.yesterday.length > 0">
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
                  <NotificationItem :notification="notification" @remove="emit('remove', $event)" />
                </div>
              </template>

              <!-- This Week -->
              <template v-if="groupedNotifications.thisWeek.length > 0">
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
                  <NotificationItem :notification="notification" @remove="emit('remove', $event)" />
                </div>
              </template>

              <!-- Older -->
              <template v-if="groupedNotifications.older.length > 0">
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
                  <NotificationItem :notification="notification" @remove="emit('remove', $event)" />
                </div>
              </template>

              <!-- Footer -->
              <div class="p-3 text-center bg-gray-50 border-t border-gray-200">
                <div class="text-xs text-gray-600 font-medium">
                  {{ filteredNotifications.length }} notifications
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active {
  transition: opacity 0.3s ease;
}
.modal-enter-active > div {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-leave-active > div {
  transition: transform 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}
.modal-enter-from > div {
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to {
  opacity: 0;
}
.modal-leave-to > div {
  transform: scale(0.95) translateY(10px);
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
</style>
