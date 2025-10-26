<script setup>
import { ref, inject, computed, onMounted, onUnmounted } from 'vue'
import { 
  IconSearch, 
  IconUpload, 
  IconBolt, 
  IconMenu2, 
  IconUser, 
  IconSettings, 
  IconLogout, 
  IconChevronDown, 
  IconRefresh,
  IconDashboard,
  IconChartBar,
  IconWallet,
  IconMessageCircle,
  IconFileText,
  IconGift,
  IconShoppingCart,
  IconUsers,
  IconEdit,
  IconCalendar
} from '@iconify-prerendered/vue-tabler'
import NotificationDropdown from './NotificationDropdown.vue'
import { useNostrAuth } from '../composables/useNostrAuth.js'

const zapData = inject('zapData')
const isRefreshingData = inject('isRefreshingData')
const refreshZapData = inject('refreshZapData')
const isWalletConnected = inject('isWalletConnected')
const currentPage = inject('currentPage')

const emit = defineEmits(['show-connection', 'toggle-mobile-menu', 'change-page'])

// Use Nostr authentication
const { isAuthenticated, userProfile, currentUser, logout } = useNostrAuth()

const showProfileDropdown = ref(false)
const profileDropdownRef = ref(null)

// Page title, description, and icon mapping
const pageInfo = computed(() => {
  const pageMap = {
    'dashboard': {
      title: 'Dashboard',
      description: 'Welcome back, track your lightning earnings',
      icon: IconDashboard
    },
    'zap-feed': {
      title: 'Zap Feed',
      description: 'Real-time zap activity and notifications',
      icon: IconBolt
    },
    'analytics': {
      title: 'Analytics',
      description: 'Deep insights into your zap performance',
      icon: IconChartBar
    },
    'wallet': {
      title: 'Wallet',
      description: 'Manage your Lightning wallet and transactions',
      icon: IconWallet
    },
    'chat-zaps': {
      title: 'Chat + Zaps',
      description: 'Interactive chat with zap integration',
      icon: IconMessageCircle
    },
    'content': {
      title: 'Content',
      description: 'Manage and analyze your content performance',
      icon: IconFileText
    },
    'donations': {
      title: 'Donations',
      description: 'Manage donation campaigns and goals',
      icon: IconGift
    },
    'mini-pos': {
      title: 'Mini PoS',
      description: 'Point of Sale system for lightning payments',
      icon: IconShoppingCart
    },
    'finances': {
      title: 'Finances',
      description: 'Financial overview and reporting',
      icon: IconWallet
    },
    'settings': {
      title: 'Settings',
      description: 'Manage your zap dashboard preferences and integrations',
      icon: IconSettings
    },
    'notes': {
      title: 'Notes',
      description: 'Keep track of your thoughts and ideas',
      icon: IconEdit
    },
    'audience': {
      title: 'Audience',
      description: 'Manage your Nostr network and follow lists',
      icon: IconUsers
    },
    'calendar': {
      title: 'Calendar',
      description: 'Schedule and manage your zap-related events',
      icon: IconCalendar
    }
  }
  
  return pageMap[currentPage.value] || {
    title: 'Dashboard',
    description: 'Welcome back, track your lightning earnings',
    icon: IconDashboard
  }
})

// Watch for connection status based on zapData
const hasConnection = computed(() => {
  return localStorage.getItem('nwc_url') !== null
})

// Get user avatar with Nostr profile fallback
const getUserAvatar = computed(() => {
  if (isAuthenticated.value && userProfile.value?.picture) {
    return userProfile.value.picture
  }
  // Fallback to default avatar
  return 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
})

// Get user name with Nostr profile fallback
const getUserName = computed(() => {
  if (isAuthenticated.value && userProfile.value?.name) {
    return userProfile.value.name
  }
  return 'Creator'
})

// Get user email/identifier with Nostr profile fallback
const getUserIdentifier = computed(() => {
  if (isAuthenticated.value) {
    if (userProfile.value?.nip05) {
      return userProfile.value.nip05
    }
    if (currentUser.value?.npub) {
      return currentUser.value.npub.substring(0, 20) + '...'
    }
  }
  return 'creator@example.com'
})

// Data status for header display
const dataStatus = computed(() => {
  if (!isWalletConnected.value) {
    return {
      show: false,
      text: '',
      color: ''
    }
  }

  if (zapData.value.length > 0) {
    return {
      show: true,
      text: `${zapData.value.length} zaps loaded`,
      color: 'text-green-600'
    }
  }

  return {
    show: true,
    text: 'No data yet',
    color: 'text-gray-500'
  }
})

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (profileDropdownRef.value && !profileDropdownRef.value.contains(event.target)) {
    showProfileDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const toggleProfileDropdown = () => {
  showProfileDropdown.value = !showProfileDropdown.value
}

const handleProfileAction = (action) => {
  showProfileDropdown.value = false
  
  switch (action) {
    case 'profile':
      emit('change-page', 'settings', 'nostr')
      break
    case 'settings':
      emit('change-page', 'settings', 'alerts')
      break
    case 'account':
      console.log('Navigate to account')
      break
    case 'signout':
      logout()
      break
  }
}

const handleRefresh = () => {
  if (refreshZapData && !isRefreshingData.value) {
    refreshZapData()
  }
}
</script>

<template>
  <div class="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
    <div class="flex items-center justify-between">
      <!-- Mobile Menu Button + Page Title -->
      <div class="flex items-center space-x-3">
        <!-- Mobile Menu Toggle -->
        <button 
          @click="emit('toggle-mobile-menu')"
          class="lg:hidden p-2 text-gray-600 hover:text-orange-600 transition-colors touch-target hover:bg-orange-50 rounded-lg"
        >
          <IconMenu2 class="w-6 h-6" />
        </button>
        
        <!-- Page Title -->
        <div>
          <h2 class="text-lg sm:text-xl font-semibold text-gray-800 flex items-center space-x-2">
            <component :is="pageInfo.icon" class="w-5 h-5 text-orange-600" />
            <span>{{ pageInfo.title }}</span>
          </h2>
          <p class="text-xs sm:text-sm text-gray-600 hidden sm:block">{{ pageInfo.description }}</p>
        </div>
      </div>
      
      <!-- Right Side Actions -->
      <div class="flex items-center space-x-2 sm:space-x-3">
        <!-- Search - Hidden on mobile, shown on tablet+ -->
<!--        <div class="relative hidden md:block">-->
<!--          <input-->
<!--            type="text"-->
<!--            placeholder="Search zaps..."-->
<!--            class="w-48 lg:w-64 pl-10 pr-4 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm transition-all text-sm hover:shadow-sm"-->
<!--          />-->
<!--          <IconSearch class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />-->
<!--        </div>-->

        <!-- Data Status & Refresh (when connected) -->
        <div v-if="dataStatus.show" class="flex items-center space-x-3">
<!--          <div class="hidden sm:flex items-center space-x-2">-->
<!--            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>-->
<!--            <span :class="['text-xs font-medium', dataStatus.color]">-->
<!--              {{ dataStatus.text }}-->
<!--            </span>-->
<!--          </div>-->

          <!-- Refresh Button with Consistent Styling -->
          <button
            @click="handleRefresh"
            :disabled="isRefreshingData"
            :title="isRefreshingData ? 'Refreshing...' : 'Refresh data'"
            class="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 touch-target group disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <IconRefresh :class="[
              'w-5 h-5 transition-all duration-200 group-hover:scale-110',
              isRefreshingData ? 'animate-spin' : ''
            ]" />
          </button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-2">
          <!-- Connection Button -->
          <button 
            @click="emit('show-connection')"
            :class="[
              'btn-secondary text-sm transition-all duration-200',
              hasConnection ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : ''
            ]"
          >
            <IconBolt :class="['w-4 h-4', hasConnection ? 'text-green-600' : '']" />
            <span class="hidden sm:inline">{{ hasConnection ? 'Connected' : 'Connect' }}</span>
          </button>
          
          <!-- Notifications with Consistent Hover Effect -->
          <div class="hover:bg-orange-50 rounded-lg transition-all duration-200 group">
            <NotificationDropdown />
          </div>
        </div>
        
        <!-- Enhanced Profile Dropdown -->
        <div class="relative" ref="profileDropdownRef">
          <!-- Profile Trigger Button -->
          <button
            @click="toggleProfileDropdown"
            class="p-2 rounded-lg hover:bg-orange-50 transition-all duration-200 group touch-target"
          >
            <div class="relative">
              <img
                :src="getUserAvatar"
                :alt="getUserName"
                class="w-9 h-9 rounded-full border-2 border-orange-200 group-hover:border-orange-300 transition-all duration-200"
                @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
              />
              <!-- Online indicator -->
              <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
            </div>
          </button>
          
          <!-- Dropdown Menu -->
          <transition name="dropdown">
            <div
              v-if="showProfileDropdown"
              class="profile-dropdown"
            >
              <!-- Profile Header -->
              <div class="profile-dropdown-header">
                <div class="profile-avatar-wrapper">
                  <img
                    :src="getUserAvatar"
                    :alt="getUserName"
                    class="profile-dropdown-avatar"
                    @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                  />
                  <div class="profile-status-indicator"></div>
                </div>
                <div class="profile-info-wrapper">
                  <h3 class="profile-dropdown-name">{{ getUserName }}</h3>
                  <p class="profile-dropdown-identifier">{{ getUserIdentifier }}</p>
                </div>
              </div>

              <!-- Divider -->
              <div class="profile-dropdown-divider"></div>

              <!-- Public Key Section -->
              <div class="profile-dropdown-section">
                <div class="profile-dropdown-label">
                  <IconBolt class="w-4 h-4 text-gray-400" />
                  <span>PUBLIC KEY</span>
                </div>
                <p class="profile-dropdown-value">{{ getUserIdentifier }}</p>
              </div>

              <!-- Connection Status -->
              <div class="profile-dropdown-section">
                <div class="profile-dropdown-status">
                  <div class="w-2 h-2 rounded-full bg-green-500"></div>
                  <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ hasConnection ? 'Connected' : 'Disconnected' }}</span>
                </div>
              </div>

              <!-- Divider -->
              <div class="profile-dropdown-divider"></div>

              <!-- Menu Items -->
              <button
                @click="handleProfileAction('profile')"
                class="profile-dropdown-item"
              >
                <IconUser class="w-4 h-4" />
                <span>Edit Profile</span>
              </button>

              <button
                @click="handleProfileAction('settings')"
                class="profile-dropdown-item"
              >
                <IconSettings class="w-4 h-4" />
                <span>Settings</span>
              </button>

              <!-- Divider -->
              <div class="profile-dropdown-divider"></div>

              <!-- Sign Out -->
              <button
                @click="handleProfileAction('signout')"
                class="profile-dropdown-item-danger"
              >
                <IconLogout class="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Profile Dropdown Styles */
.profile-dropdown {
  @apply absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl overflow-hidden z-50;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.profile-dropdown-header {
  @apply flex items-start gap-3 p-4;
}

.profile-avatar-wrapper {
  @apply relative flex-shrink-0;
}

.profile-dropdown-avatar {
  @apply w-12 h-12 rounded-full object-cover;
  border: 2px solid rgba(0, 0, 0, 0.06);
}

.profile-status-indicator {
  @apply absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.profile-info-wrapper {
  @apply flex-1 min-w-0;
}

.profile-dropdown-name {
  @apply text-base font-semibold text-gray-900 truncate mb-0.5;
  letter-spacing: -0.01em;
}

.profile-dropdown-identifier {
  @apply text-sm text-gray-500 truncate font-mono;
  font-size: 13px;
}

.profile-dropdown-divider {
  @apply mx-4 h-px bg-gray-100;
}

.profile-dropdown-section {
  @apply px-4 py-3;
}

.profile-dropdown-section + .profile-dropdown-section {
  @apply border-t border-gray-100;
}

.profile-dropdown-label {
  @apply flex items-center gap-2 mb-1;
}

.profile-dropdown-label span {
  @apply text-xs font-medium text-gray-500 uppercase tracking-wider;
  letter-spacing: 0.05em;
}

.profile-dropdown-value {
  @apply text-sm text-gray-900 font-mono truncate;
  padding-left: 24px;
}

.profile-dropdown-status {
  @apply flex items-center gap-2;
}

.profile-dropdown-item {
  @apply w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150;
  -webkit-tap-highlight-color: transparent;
}

.profile-dropdown-item:active {
  @apply bg-gray-100;
}

.profile-dropdown-item-danger {
  @apply w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150;
  -webkit-tap-highlight-color: transparent;
}

.profile-dropdown-item-danger:active {
  @apply bg-red-100;
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdown-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .profile-dropdown {
    @apply w-screen max-w-sm rounded-xl;
    right: -12px;
  }

  .profile-dropdown-header {
    @apply p-3.5;
  }

  .profile-dropdown-avatar {
    @apply w-11 h-11;
  }

  .profile-dropdown-name {
    @apply text-[15px];
  }

  .profile-dropdown-identifier {
    font-size: 12px;
  }

  .profile-dropdown-section {
    @apply px-3.5 py-2.5;
  }

  /* Larger touch targets on mobile */
  .profile-dropdown-item,
  .profile-dropdown-item-danger {
    @apply py-3.5;
    min-height: 52px;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-active,
  .dropdown-leave-active,
  .profile-dropdown-item,
  .profile-dropdown-item-danger {
    transition: none !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .profile-dropdown {
    border: 2px solid rgba(0, 0, 0, 0.2);
  }

  .profile-dropdown-avatar {
    border-width: 2px;
  }
}
</style>
