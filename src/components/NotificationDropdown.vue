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
  IconClock,
  IconHeart,
  IconMessageCircle,
  IconRepeat,
  IconUsers,
  IconAt,
  IconFileText,
  IconAlertTriangle,
  IconFilter
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../composables/useNotifications.js'

const {
  notifications,
  unreadCount,
  notificationsByCategory,
  unreadCountByCategory,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  removeNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES
} = useNotifications()

const showDropdown = ref(false)
const dropdownRef = ref(null)
const activeCategory = ref('all')
const searchQuery = ref('')

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
  if (notification.actionUrl) {
    window.location.href = notification.actionUrl
  }
}

// Get filtered notifications by active category
const filteredNotifications = computed(() => {
  let filtered = activeCategory.value === 'all'
    ? notifications.value
    : notificationsByCategory.value[activeCategory.value] || []

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(n =>
      n.title.toLowerCase().includes(query) ||
      n.message.toLowerCase().includes(query)
    )
  }

  return filtered
})

// Group notifications by time
const groupedNotifications = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: []
  }

  filteredNotifications.value.forEach(notification => {
    const notifDate = new Date(notification.timestamp)

    if (notifDate >= today) {
      groups.today.push(notification)
    } else if (notifDate >= yesterday) {
      groups.yesterday.push(notification)
    } else if (notifDate >= weekAgo) {
      groups.thisWeek.push(notification)
    } else {
      groups.older.push(notification)
    }
  })

  return groups
})

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
    case NOTIFICATION_TYPES.SYSTEM_ERROR:
      return IconAlertCircle
    case NOTIFICATION_TYPES.ENGAGEMENT_REPLY:
      return IconMessageCircle
    case NOTIFICATION_TYPES.ENGAGEMENT_REPOST:
      return IconRepeat
    case NOTIFICATION_TYPES.ENGAGEMENT_REACTION:
      return IconHeart
    case NOTIFICATION_TYPES.ENGAGEMENT_MENTION:
      return IconAt
    case NOTIFICATION_TYPES.SOCIAL_NEW_FOLLOWER:
      return IconUsers
    case NOTIFICATION_TYPES.SOCIAL_PROFILE_MENTION:
    case NOTIFICATION_TYPES.SOCIAL_TAG_MENTION:
      return IconAt
    case NOTIFICATION_TYPES.CONTENT_PUBLISHED:
    case NOTIFICATION_TYPES.CONTENT_MILESTONE:
      return IconFileText
    case NOTIFICATION_TYPES.SYSTEM_UPDATE:
      return IconAlertTriangle
    default:
      return IconBell
  }
}

const getNotificationColor = (type, priority) => {
  if (priority === 'urgent') return 'text-red-600 bg-red-100 border border-red-200'
  if (priority === 'high') return 'text-orange-600 bg-orange-100 border border-orange-200'

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
    case NOTIFICATION_TYPES.SYSTEM_ERROR:
      return 'text-red-600 bg-red-100'
    case NOTIFICATION_TYPES.ENGAGEMENT_REPLY:
    case NOTIFICATION_TYPES.ENGAGEMENT_MENTION:
      return 'text-blue-600 bg-blue-100'
    case NOTIFICATION_TYPES.ENGAGEMENT_REPOST:
      return 'text-green-600 bg-green-100'
    case NOTIFICATION_TYPES.ENGAGEMENT_REACTION:
      return 'text-pink-600 bg-pink-100'
    case NOTIFICATION_TYPES.SOCIAL_NEW_FOLLOWER:
      return 'text-purple-600 bg-purple-100'
    case NOTIFICATION_TYPES.SOCIAL_PROFILE_MENTION:
    case NOTIFICATION_TYPES.SOCIAL_TAG_MENTION:
      return 'text-indigo-600 bg-indigo-100'
    case NOTIFICATION_TYPES.CONTENT_PUBLISHED:
    case NOTIFICATION_TYPES.CONTENT_MILESTONE:
      return 'text-teal-600 bg-teal-100'
    case NOTIFICATION_TYPES.SYSTEM_UPDATE:
      return 'text-gray-600 bg-gray-100'
    default:
      return 'text-gray-600 bg-gray-100'
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

const getFullTime = (timestamp) => {
  return new Date(timestamp).toLocaleString()
}

const hasUnread = computed(() => unreadCount.value > 0)

const categories = computed(() => [
  {
    id: 'all',
    label: 'All',
    icon: IconBell,
    count: unreadCountByCategory.value.all
  },
  {
    id: 'zaps',
    label: 'Zaps',
    icon: IconBolt,
    count: unreadCountByCategory.value.zaps
  },
  {
    id: 'engagements',
    label: 'Engagements',
    icon: IconHeart,
    count: unreadCountByCategory.value.engagements
  },
  {
    id: 'social',
    label: 'Social',
    icon: IconUsers,
    count: unreadCountByCategory.value.social
  },
  {
    id: 'wallet',
    label: 'Wallet',
    icon: IconWallet,
    count: unreadCountByCategory.value.wallet
  },
  {
    id: 'system',
    label: 'System',
    icon: IconSettings,
    count: unreadCountByCategory.value.system
  }
])

const getContentTypeBadge = (contentType) => {
  if (!contentType) return null

  const badges = {
    campaign: { label: 'Campaign', color: 'bg-purple-100 text-purple-700' },
    article: { label: 'Article', color: 'bg-blue-100 text-blue-700' },
    note: { label: 'Note', color: 'bg-green-100 text-green-700' },
    event: { label: 'Event', color: 'bg-orange-100 text-orange-700' },
    long_form: { label: 'Long Form', color: 'bg-indigo-100 text-indigo-700' }
  }

  return badges[contentType] || null
}

const hasNotificationsInGroup = computed(() => {
  return {
    today: groupedNotifications.value.today.length > 0,
    yesterday: groupedNotifications.value.yesterday.length > 0,
    thisWeek: groupedNotifications.value.thisWeek.length > 0,
    older: groupedNotifications.value.older.length > 0
  }
})

const setCategory = (categoryId) => {
  activeCategory.value = categoryId
}
</script>

<template>
  <div class="relative" ref="dropdownRef">
    <!-- Notification Bell Button -->
    <button
      @click="toggleDropdown"
      class="relative text-gray-500 hover:text-orange-600 p-2 transition-all duration-200 touch-target group flex items-center justify-center"
    >
      <IconBellRinging v-if="hasUnread" class="w-5 h-5 animate-bounce text-orange-600" />
      <IconBell v-else class="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />

      <!-- Unread Count Badge -->
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-gradient-to-r from-red-500 to-pink-500 rounded-full text-white text-xs font-medium flex items-center justify-center animate-pulse shadow-lg"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Notification Dropdown -->
    <transition name="dropdown">
      <div
        v-if="showDropdown"
        class="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
      >
        <!-- Header -->
        <div class="p-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconBell class="w-5 h-5 text-orange-600" />
              <span>Notifications</span>
            </h3>
            <div class="flex items-center space-x-2">
              <button
                v-if="unreadCount > 0"
                @click="markAllAsRead"
                class="text-xs text-orange-600 hover:text-orange-700 font-medium p-1 hover:bg-white rounded transition-colors"
                title="Mark all as read"
              >
                <IconCheck class="w-4 h-4" />
              </button>
              <button
                v-if="notifications.length > 0"
                @click="clearAllNotifications"
                class="text-xs text-gray-500 hover:text-red-600 font-medium p-1 hover:bg-white rounded transition-colors"
                title="Clear all"
              >
                <IconTrash class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Category Tabs -->
          <div class="flex items-center space-x-1 overflow-x-auto scrollbar-thin pb-2">
            <button
              v-for="category in categories"
              :key="category.id"
              @click="setCategory(category.id)"
              :class="[
                'flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                activeCategory === category.id
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              ]"
            >
              <component :is="category.icon" class="w-3.5 h-3.5" />
              <span>{{ category.label }}</span>
              <span
                v-if="category.count > 0"
                :class="[
                  'ml-1 px-1.5 py-0.5 rounded-full text-xs font-medium',
                  activeCategory === category.id
                    ? 'bg-white/20 text-white'
                    : 'bg-orange-100 text-orange-600'
                ]"
              >
                {{ category.count }}
              </span>
            </button>
          </div>
        </div>

        <!-- Notifications List -->
        <div class="max-h-96 overflow-y-auto scrollbar-thin">
          <!-- Empty State -->
          <div v-if="filteredNotifications.length === 0" class="p-8 text-center">
            <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <IconBell class="w-8 h-8 text-gray-400" />
            </div>
            <h4 class="text-lg font-medium text-gray-900 mb-2">No notifications</h4>
            <p class="text-gray-600 text-sm">
              {{ activeCategory === 'all' ? "You're all caught up!" : `No ${activeCategory} notifications` }}
            </p>
          </div>

          <!-- Today -->
          <div v-if="hasNotificationsInGroup.today">
            <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wider">Today</h4>
            </div>
            <div class="divide-y divide-gray-100">
              <div
                v-for="notification in groupedNotifications.today"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 hover:bg-gradient-to-r hover:from-orange-25 hover:to-amber-25 cursor-pointer transition-all relative group',
                  !notification.read ? 'bg-orange-25/50' : ''
                ]"
              >
                <!-- Unread Indicator -->
                <div
                  v-if="!notification.read"
                  class="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full animate-pulse"
                ></div>

                <div class="flex items-start space-x-3" :class="{ 'ml-4': !notification.read }">
                  <!-- Icon with Priority Border -->
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                    getNotificationColor(notification.type, notification.priority)
                  ]">
                    <component :is="getNotificationIcon(notification.type)" class="w-5 h-5" />
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between">
                      <h4 class="text-sm font-semibold text-gray-900">
                        {{ notification.title }}
                      </h4>
                      <div class="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <span class="text-xs text-gray-500" :title="getFullTime(notification.timestamp)">
                          {{ formatTime(notification.timestamp) }}
                        </span>
                        <button
                          @click.stop="removeNotification(notification.id)"
                          class="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <IconX class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p class="text-sm text-gray-600 mt-1 line-clamp-2">
                      {{ notification.message }}
                    </p>

                    <!-- Badges and Metadata -->
                    <div class="flex items-center space-x-2 mt-2">
                      <!-- Amount Badge -->
                      <span v-if="notification.data?.amount" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800">
                        <IconBolt class="w-3 h-3 mr-1" />
                        {{ notification.data.amount }} sats
                      </span>

                      <!-- Content Type Badge -->
                      <span
                        v-if="getContentTypeBadge(notification.contentType)"
                        :class="[
                          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                          getContentTypeBadge(notification.contentType).color
                        ]"
                      >
                        {{ getContentTypeBadge(notification.contentType).label }}
                      </span>

                      <!-- Priority Badge -->
                      <span
                        v-if="notification.priority === 'high' || notification.priority === 'urgent'"
                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"
                      >
                        <IconAlertCircle class="w-3 h-3 mr-1" />
                        {{ notification.priority }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Yesterday -->
          <div v-if="hasNotificationsInGroup.yesterday">
            <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wider">Yesterday</h4>
            </div>
            <div class="divide-y divide-gray-100">
              <div
                v-for="notification in groupedNotifications.yesterday"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 hover:bg-gradient-to-r hover:from-orange-25 hover:to-amber-25 cursor-pointer transition-all relative group',
                  !notification.read ? 'bg-orange-25/50' : ''
                ]"
              >
                <div
                  v-if="!notification.read"
                  class="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full animate-pulse"
                ></div>

                <div class="flex items-start space-x-3" :class="{ 'ml-4': !notification.read }">
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                    getNotificationColor(notification.type, notification.priority)
                  ]">
                    <component :is="getNotificationIcon(notification.type)" class="w-5 h-5" />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between">
                      <h4 class="text-sm font-semibold text-gray-900">{{ notification.title }}</h4>
                      <div class="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <span class="text-xs text-gray-500" :title="getFullTime(notification.timestamp)">
                          {{ formatTime(notification.timestamp) }}
                        </span>
                        <button
                          @click.stop="removeNotification(notification.id)"
                          class="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <IconX class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p class="text-sm text-gray-600 mt-1 line-clamp-2">{{ notification.message }}</p>

                    <div class="flex items-center space-x-2 mt-2">
                      <span v-if="notification.data?.amount" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800">
                        <IconBolt class="w-3 h-3 mr-1" />
                        {{ notification.data.amount }} sats
                      </span>
                      <span
                        v-if="getContentTypeBadge(notification.contentType)"
                        :class="['inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getContentTypeBadge(notification.contentType).color]"
                      >
                        {{ getContentTypeBadge(notification.contentType).label }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- This Week -->
          <div v-if="hasNotificationsInGroup.thisWeek">
            <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wider">This Week</h4>
            </div>
            <div class="divide-y divide-gray-100">
              <div
                v-for="notification in groupedNotifications.thisWeek"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 hover:bg-gradient-to-r hover:from-orange-25 hover:to-amber-25 cursor-pointer transition-all relative group',
                  !notification.read ? 'bg-orange-25/50' : ''
                ]"
              >
                <div
                  v-if="!notification.read"
                  class="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full animate-pulse"
                ></div>

                <div class="flex items-start space-x-3" :class="{ 'ml-4': !notification.read }">
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                    getNotificationColor(notification.type, notification.priority)
                  ]">
                    <component :is="getNotificationIcon(notification.type)" class="w-5 h-5" />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between">
                      <h4 class="text-sm font-semibold text-gray-900">{{ notification.title }}</h4>
                      <div class="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <span class="text-xs text-gray-500" :title="getFullTime(notification.timestamp)">
                          {{ formatTime(notification.timestamp) }}
                        </span>
                        <button
                          @click.stop="removeNotification(notification.id)"
                          class="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <IconX class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p class="text-sm text-gray-600 mt-1 line-clamp-2">{{ notification.message }}</p>

                    <div class="flex items-center space-x-2 mt-2">
                      <span v-if="notification.data?.amount" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800">
                        <IconBolt class="w-3 h-3 mr-1" />
                        {{ notification.data.amount }} sats
                      </span>
                      <span
                        v-if="getContentTypeBadge(notification.contentType)"
                        :class="['inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getContentTypeBadge(notification.contentType).color]"
                      >
                        {{ getContentTypeBadge(notification.contentType).label }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Older -->
          <div v-if="hasNotificationsInGroup.older">
            <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wider">Older</h4>
            </div>
            <div class="divide-y divide-gray-100">
              <div
                v-for="notification in groupedNotifications.older"
                :key="notification.id"
                @click="handleNotificationClick(notification)"
                :class="[
                  'p-4 hover:bg-gradient-to-r hover:from-orange-25 hover:to-amber-25 cursor-pointer transition-all relative group',
                  !notification.read ? 'bg-orange-25/50' : ''
                ]"
              >
                <div
                  v-if="!notification.read"
                  class="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-gradient-to-r from-orange-400 to-pink-400 rounded-full animate-pulse"
                ></div>

                <div class="flex items-start space-x-3" :class="{ 'ml-4': !notification.read }">
                  <div :class="[
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110',
                    getNotificationColor(notification.type, notification.priority)
                  ]">
                    <component :is="getNotificationIcon(notification.type)" class="w-5 h-5" />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between">
                      <h4 class="text-sm font-semibold text-gray-900">{{ notification.title }}</h4>
                      <div class="flex items-center space-x-2 flex-shrink-0 ml-2">
                        <span class="text-xs text-gray-500" :title="getFullTime(notification.timestamp)">
                          {{ formatTime(notification.timestamp) }}
                        </span>
                        <button
                          @click.stop="removeNotification(notification.id)"
                          class="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <IconX class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p class="text-sm text-gray-600 mt-1 line-clamp-2">{{ notification.message }}</p>

                    <div class="flex items-center space-x-2 mt-2">
                      <span v-if="notification.data?.amount" class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800">
                        <IconBolt class="w-3 h-3 mr-1" />
                        {{ notification.data.amount }} sats
                      </span>
                      <span
                        v-if="getContentTypeBadge(notification.contentType)"
                        :class="['inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', getContentTypeBadge(notification.contentType).color]"
                      >
                        {{ getContentTypeBadge(notification.contentType).label }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}

@keyframes bounce-subtle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.animate-bounce {
  animation: bounce-subtle 1s ease-in-out infinite;
}
</style>
