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
  IconSparkles
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../composables/useNotifications.js'
import { generateAvatar } from '../utils/avatarGenerator.js'

const {
  notifications,
  unreadCount,
  recentNotifications,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  removeNotification,
  NOTIFICATION_TYPES
} = useNotifications()

const showDropdown = ref(false)
const dropdownRef = ref(null)

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
}

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
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

const getBadgeColor = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC:
      return 'bg-blue-100 text-blue-700'
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR:
      return 'bg-orange-100 text-orange-700'
    case NOTIFICATION_TYPES.ZAP_SENT:
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return date.toLocaleDateString()
}

const hasUnread = computed(() => unreadCount.value > 0)

const getSourceLabel = (notification) => {
  if (notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NWC) {
    return 'Wallet Transaction'
  } else if (notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR) {
    return 'Content Zap'
  }
  return null
}
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- Notification Bell Button -->
    <button
      @click="toggleDropdown"
      class="relative text-gray-500 hover:text-orange-600 p-2 rounded-lg transition-all duration-200 ease-out hover:bg-orange-50/50 touch-target group flex items-center justify-center"
    >
      <IconBellRinging v-if="hasUnread" class="w-5 h-5 text-orange-600 animate-[bounce_1s_ease-in-out_3]" />
      <IconBell v-else class="w-5 h-5 group-hover:scale-110 transition-transform duration-200 ease-out" />

      <!-- Unread Count Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-orange-500 to-orange-600 rounded-full text-white text-[10px] font-semibold flex items-center justify-center shadow-lg shadow-orange-500/30"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Notification Dropdown -->
    <transition name="dropdown">
      <div
        v-if="showDropdown"
        class="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-[32rem] overflow-hidden"
      >
        <!-- Header -->
        <div class="p-4 border-b border-gray-100 bg-gradient-to-br from-orange-50/50 to-white">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-base font-semibold text-gray-900 flex items-center gap-2">
              <IconBell class="w-5 h-5 text-orange-600" />
              <span>Notifications</span>
            </h3>
            <div class="flex items-center gap-2">
              <button
                v-if="unreadCount > 0"
                @click="markAllAsRead"
                class="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded-lg hover:bg-orange-50 transition-all duration-200 flex items-center gap-1"
                title="Mark all as read"
              >
                <IconCheck class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">All</span>
              </button>
              <button
                v-if="notifications.length > 0"
                @click="clearAllNotifications"
                class="text-xs text-gray-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-all duration-200"
                title="Clear all"
              >
                <IconTrash class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p class="text-xs text-gray-600">
            {{ unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'You\'re all caught up!' }}
          </p>
        </div>

        <!-- Notifications List -->
        <div class="max-h-96 overflow-y-auto">
          <div v-if="notifications.length === 0" class="p-8 text-center">
            <IconBell class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-base font-medium text-gray-900 mb-1">No notifications</h4>
            <p class="text-gray-500 text-sm">You're all caught up!</p>
          </div>

          <div v-else class="divide-y divide-gray-100">
            <div
              v-for="notification in recentNotifications"
              :key="notification.id"
              @click="handleNotificationClick(notification)"
              :class="[
                'p-4 hover:bg-gradient-to-r cursor-pointer transition-all duration-200 relative group',
                !notification.read
                  ? 'bg-orange-50/30 hover:from-orange-50/40 hover:to-orange-50/20'
                  : 'hover:from-gray-50/40 hover:to-gray-50/20'
              ]"
            >
              <!-- Unread Indicator -->
              <div
                v-if="!notification.read"
                class="absolute left-2 top-1/2 transform -translate-y-1/2 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"
              ></div>

              <div class="flex items-start gap-3" :class="{ 'ml-3': !notification.read }">
                <!-- Icon -->
                <div :class="[
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-110',
                  getNotificationColor(notification.type)
                ]">
                  <component :is="getNotificationIcon(notification.type)" class="w-5 h-5" />
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2 mb-1">
                    <h4 class="text-sm font-semibold text-gray-900 truncate">
                      {{ notification.title }}
                    </h4>
                    <span class="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                      {{ formatTime(notification.timestamp) }}
                    </span>
                  </div>

                  <p class="text-sm text-gray-600 line-clamp-2 mb-2">
                    {{ notification.message }}
                  </p>

                  <!-- Source Label for Zap Notifications -->
                  <div v-if="getSourceLabel(notification)" class="flex items-center gap-2 mb-2">
                    <span :class="[
                      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                      notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NWC
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    ]">
                      {{ getSourceLabel(notification) }}
                    </span>
                  </div>

                  <!-- Amount Badge -->
                  <div v-if="notification.data?.amount" class="flex items-center gap-2">
                    <span :class="[
                      'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold',
                      getBadgeColor(notification.type)
                    ]">
                      <IconBolt class="w-3.5 h-3.5 mr-1" />
                      {{ notification.data.amount.toLocaleString() }} sats
                    </span>
                  </div>

                  <!-- Sender Info for Nostr Zaps -->
                  <div v-if="notification.data?.sender && notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR" class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                    <img
                      :src="notification.data.sender.picture || notification.data.sender.avatar || generateAvatar(notification.data.sender.pubkey)"
                      :alt="notification.data.sender.name"
                      class="w-5 h-5 rounded-full"
                      @error="$event.target.src = generateAvatar(notification.data.sender.pubkey)"
                    />
                    <span class="text-xs text-gray-600">
                      from <span class="font-medium text-gray-900">{{ notification.data.sender.name }}</span>
                    </span>
                  </div>
                </div>

                <!-- Remove Button -->
                <button
                  @click.stop="removeNotification(notification.id)"
                  class="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <IconX class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="notifications.length > 10" class="p-3 border-t border-gray-100 text-center bg-gradient-to-br from-white to-gray-50/50">
          <span class="text-xs text-gray-500 font-medium">
            Showing {{ recentNotifications.length }} of {{ notifications.length }} notifications
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Dropdown transition */
.dropdown-enter-active {
  animation: dropdown-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dropdown-leave-active {
  animation: dropdown-out 0.2s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
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
    transform: translateY(-8px) scale(0.98);
  }
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.5);
}
</style>
