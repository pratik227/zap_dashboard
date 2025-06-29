<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  IconBell, 
  IconBellRinging,
  IconCheck, 
  IconX, 
  IconTrash,
  IconSettings,
  IconBolt,
  IconWallet,
  IconAlertCircle,
  IconClock
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../composables/useNotifications.js'

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
  // You can add navigation logic here based on notification type
}

const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED:
    case NOTIFICATION_TYPES.ZAP_SENT:
      return IconBolt
    case NOTIFICATION_TYPES.BALANCE_CHANGE:
      return IconWallet
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
      return IconCheck
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
    case NOTIFICATION_TYPES.ZAP_RECEIVED:
      return 'text-green-600 bg-green-100'
    case NOTIFICATION_TYPES.ZAP_SENT:
      return 'text-orange-600 bg-orange-100'
    case NOTIFICATION_TYPES.BALANCE_CHANGE:
      return 'text-blue-600 bg-blue-100'
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS:
      return 'text-green-600 bg-green-100'
    case NOTIFICATION_TYPES.CONNECTION_ERROR:
    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR:
      return 'text-red-600 bg-red-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

const hasUnread = computed(() => unreadCount.value > 0)
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- Notification Bell Button -->
    <button 
      @click="toggleDropdown"
      class="p-2 text-gray-500 hover:text-orange-600 relative transition-all duration-200 touch-target hover:bg-orange-50 rounded-lg group"
    >
      <IconBellRinging v-if="hasUnread" class="w-5 h-5 animate-bounce text-orange-600" />
      <IconBell v-else class="w-5 h-5 group-hover:scale-110 transition-transform" />
      
      <!-- Unread Count Badge -->
      <span 
        v-if="unreadCount > 0" 
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-red-400 to-pink-400 rounded-full text-white text-xs font-medium flex items-center justify-center animate-pulse"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>
    
    <!-- Notification Dropdown -->
    <transition name="dropdown">
      <div 
        v-if="showDropdown"
        class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden"
      >
        <!-- Header -->
        <div class="p-4 border-b border-gray-100">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconBell class="w-5 h-5 text-orange-600" />
              <span>Notifications</span>
            </h3>
            <div class="flex items-center space-x-2">
              <button
                v-if="unreadCount > 0"
                @click="markAllAsRead"
                class="text-xs text-orange-600 hover:text-orange-700 font-medium"
                title="Mark all as read"
              >
                <IconCheck class="w-4 h-4" />
              </button>
              <button
                v-if="notifications.length > 0"
                @click="clearAllNotifications"
                class="text-xs text-gray-500 hover:text-red-600 font-medium"
                title="Clear all"
              >
                <IconTrash class="w-4 h-4" />
              </button>
            </div>
          </div>
          <p class="text-sm text-gray-600 mt-1">
            {{ unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!' }}
          </p>
        </div>
        
        <!-- Notifications List -->
        <div class="max-h-64 overflow-y-auto scrollbar-thin">
          <div v-if="notifications.length === 0" class="p-6 text-center">
            <IconBell class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No notifications</h4>
            <p class="text-gray-600 text-sm">You're all caught up!</p>
          </div>
          
          <div v-else class="divide-y divide-gray-100">
            <div
              v-for="notification in recentNotifications"
              :key="notification.id"
              @click="handleNotificationClick(notification)"
              :class="[
                'p-4 hover:bg-gray-50 cursor-pointer transition-colors relative',
                !notification.read ? 'bg-orange-25/50' : ''
              ]"
            >
              <!-- Unread Indicator -->
              <div 
                v-if="!notification.read"
                class="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-orange-400 rounded-full"
              ></div>
              
              <div class="flex items-start space-x-3" :class="{ 'ml-4': !notification.read }">
                <!-- Icon -->
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  getNotificationColor(notification.type)
                ]">
                  <component :is="getNotificationIcon(notification.type)" class="w-4 h-4" />
                </div>
                
                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-medium text-gray-900 truncate">
                      {{ notification.title }}
                    </h4>
                    <div class="flex items-center space-x-2 flex-shrink-0">
                      <span class="text-xs text-gray-500">
                        {{ formatTime(notification.timestamp) }}
                      </span>
                      <button
                        @click.stop="removeNotification(notification.id)"
                        class="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <IconX class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mt-1 line-clamp-2">
                    {{ notification.message }}
                  </p>
                  
                  <!-- Additional Data -->
                  <div v-if="notification.data?.amount" class="mt-2">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      <IconBolt class="w-3 h-3 mr-1" />
                      {{ notification.data.amount }} sats
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div v-if="notifications.length > 10" class="p-3 border-t border-gray-100 text-center">
          <button class="text-sm text-orange-600 hover:text-orange-700 font-medium">
            View all notifications
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease-out;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
