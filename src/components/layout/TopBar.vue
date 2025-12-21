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
  IconCalendar,
  IconHelp
} from '@iconify-prerendered/vue-tabler'
import NotificationDropdown from '../shared/NotificationDropdown.vue'
import ThreadsPromo from '../shared/ThreadsPromo.vue'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const zapData = inject('zapData')
const isRefreshingData = inject('isRefreshingData')
const refreshZapData = inject('refreshZapData')
const isWalletConnected = inject('isWalletConnected')
const currentPage = inject('currentPage')

const emit = defineEmits(['show-connection', 'toggle-mobile-menu', 'change-page', 'show-help'])

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
  // Fallback to generated avatar
  return generateAvatar(currentUser.value?.pubkey)
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

const handleLoginClick = () => {
  console.log('🚀 Triggering nostr-login widget from TopBar...')
  document.dispatchEvent(new Event('nlLaunch'))
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
        <!-- How to Start Button - Desktop - Always Visible -->
        <button
          @click="emit('show-help')"
          class="hidden sm:flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
        >
          <IconHelp class="w-4 h-4" />
          <span>How to Start</span>
        </button>

        <!-- Mobile Help Button - Always Visible -->
        <button
          @click="emit('show-help')"
          class="sm:hidden relative text-gray-500 hover:text-orange-600 p-2 rounded-xl transition-all duration-200 hover:bg-orange-50 group flex items-center justify-center touch-target"
        >
          <IconHelp class="w-5 h-5" />
        </button>

        <!-- Pre-Authentication: Prominent Login CTA -->
        <button
          v-if="!isAuthenticated"
          @click="handleLoginClick"
          class="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base"
        >
          <IconBolt class="w-4 h-4 sm:w-5 sm:h-5" />
          <span class="hidden sm:inline">Connect with Nostr</span>
          <span class="sm:hidden">Connect</span>
        </button>

        <!-- Post-Authentication: Show Notifications + Profile -->
        <template v-if="isAuthenticated">
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
          <!-- Notifications with Consistent Hover Effect -->
          <div class="hover:bg-orange-50 rounded-lg transition-all duration-200 group">
            <NotificationDropdown />
          </div>
        </div>
        
        <!-- Enhanced Profile Dropdown -->
        <div class="relative" ref="profileDropdownRef">
          <!-- Profile Trigger Button - Avatar Only -->
          <button
            @click="toggleProfileDropdown"
            class="relative p-0.5 rounded-full hover:bg-orange-50 transition-all duration-200 group touch-target"
            :title="getUserName"
          >
            <div class="relative">
              <img
                :src="getUserAvatar"
                :alt="getUserName"
                class="w-9 h-9 rounded-full border-2 border-orange-200 group-hover:border-orange-400 transition-all duration-200"
                @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
              />
              <!-- Online indicator -->
              <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
            </div>
          </button>
          
          <!-- Dropdown Menu -->
          <transition name="dropdown">
            <div 
              v-if="showProfileDropdown"
              class="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50"
            >
              <!-- Profile Header -->
              <div class="px-4 py-4 border-b border-gray-100 bg-gradient-to-br from-orange-50 to-amber-50">
                <div class="flex items-start gap-3">
                  <div class="relative flex-shrink-0">
                    <img
                      :src="getUserAvatar"
                      :alt="getUserName"
                      class="w-12 h-12 rounded-full border-2 border-orange-300 shadow-sm"
                      @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                    />
                    <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                  </div>
                  <div class="flex-1 min-w-0 pt-0.5">
                    <div class="font-semibold text-gray-900 truncate text-base">{{ getUserName }}</div>
                    <div class="text-sm text-gray-600 truncate mt-0.5">{{ getUserIdentifier }}</div>
                  </div>
                </div>
              </div>
              
              <!-- Account Section -->
              <div class="py-1">
                <div class="px-4 py-2">
                  <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">My Account</div>
                </div>
                
                <button 
                  @click="handleProfileAction('profile')"
                  class="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-200"
                >
                  <IconUser class="w-4 h-4" />
                  <span>Profile</span>
                </button>
                
                <button 
                  @click="handleProfileAction('settings')"
                  class="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-200"
                >
                  <IconSettings class="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </div>
              
              <!-- Divider -->
              <div class="border-t border-gray-100 my-1"></div>
              
              <!-- Sign Out -->
              <button
                @click="handleProfileAction('signout')"
                class="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <IconLogout class="w-4 h-4" />
                <span>Sign out</span>
              </button>

              <!-- Divider -->
              <div class="border-t border-gray-100 my-1"></div>

              <!-- Threads Promo -->
              <ThreadsPromo variant="menu" />
            </div>
          </transition>
        </div>
        </template>
      </div>
    </div>
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
</style>
