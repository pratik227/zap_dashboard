<script setup>
import { inject, computed, ref, watch, onMounted } from 'vue'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useNostrConnections } from '../../composables/core/useNostrConnections.js'
import {
  IconDashboard,
  IconBolt,
  IconChartBar,
  IconWallet,
  IconFileText,
  IconEdit,
  IconTarget,
  IconCalendar,
  IconUsers,
  IconSettings,
  IconChevronDown,
  IconChevronRight,
  IconActivity,
  IconCoins,
  IconSparkles,
  IconVideo,
  IconMessageCircle,
  IconTrophy,
  IconPhoto
} from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const combinedZapData = inject('combinedZapData')
const activeConnection = inject('activeConnection')
const isWalletConnected = inject('isWalletConnected')
const emit = defineEmits(['change-page', 'show-help'])

const { isAuthenticated } = useNostrAuth()
const { getBalance } = useNostrConnections()

const walletBalance = ref(null)
const isLoadingBalance = ref(false)
const dashboardSubmenuOpen = ref(true)
const studioSubmenuOpen = ref(false)
const audienceSubmenuOpen = ref(false)

const totalZaps = computed(() => {
  return combinedZapData.value.filter(zap => zap.eventId).length
})

const totalSats = computed(() => {
  return combinedZapData.value
    .filter(zap => zap.eventId)
    .reduce((sum, zap) => sum + zap.amount, 0)
})

const checkAndOpenParentMenu = () => {
  const dashboardPages = ['dashboard', 'lightning-explorer']
  const studioPages = ['content', 'notes', 'campaigns', 'contest']
  const audiencePages = ['audience', 'chat-zaps']

  if (dashboardPages.includes(currentPage.value)) {
    dashboardSubmenuOpen.value = true
  }
  if (studioPages.includes(currentPage.value)) {
    studioSubmenuOpen.value = true
  }
  if (audiencePages.includes(currentPage.value)) {
    audienceSubmenuOpen.value = true
  }
}

checkAndOpenParentMenu()

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: IconDashboard,
    requiresAuth: false,
    hasSubmenu: true,
    submenuKey: 'dashboard',
    submenuItems: [
      { id: 'dashboard', label: 'ZapTracker Dashboard', icon: IconDashboard },
      { id: 'lightning-explorer', label: 'Lightning Explorer', icon: IconActivity }
    ]
  },
  { id: 'zap-feed', label: 'Zap Feed', icon: IconBolt, requiresAuth: true },
  { id: 'wallet', label: 'Wallet', icon: IconWallet, requiresAuth: true },
  { id: 'analytics', label: 'Analytics', icon: IconChartBar, requiresAuth: true },
  { id: 'media', label: 'Media', icon: IconPhoto, requiresAuth: true },
  {
    id: 'studio',
    label: 'Studio',
    icon: IconVideo,
    requiresAuth: true,
    hasSubmenu: true,
    submenuKey: 'studio',
    submenuItems: [
      { id: 'content', label: 'Articles', icon: IconFileText },
      { id: 'notes', label: 'Notes', icon: IconEdit },
      { id: 'campaigns', label: 'Campaigns', icon: IconTarget },
      { id: 'contest', label: 'Contest', icon: IconTrophy }
    ]
  },
  {
    id: 'audience',
    label: 'Audience',
    icon: IconUsers,
    requiresAuth: true,
    hasSubmenu: true,
    submenuKey: 'audience',
    submenuItems: [
      { id: 'audience', label: 'Your Audience', icon: IconUsers },
      { id: 'chat-zaps', label: 'Chat', icon: IconMessageCircle }
    ]
  },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar, requiresAuth: true },
  { id: 'settings', label: 'Settings', icon: IconSettings, requiresAuth: false }
]

const toggleSubmenu = (submenuKey) => {
  if (submenuKey === 'dashboard') {
    dashboardSubmenuOpen.value = !dashboardSubmenuOpen.value
  } else if (submenuKey === 'studio') {
    studioSubmenuOpen.value = !studioSubmenuOpen.value
  } else if (submenuKey === 'audience') {
    audienceSubmenuOpen.value = !audienceSubmenuOpen.value
  }
}

const isSubmenuOpen = (submenuKey) => {
  if (submenuKey === 'dashboard') return dashboardSubmenuOpen.value
  if (submenuKey === 'studio') return studioSubmenuOpen.value
  if (submenuKey === 'audience') return audienceSubmenuOpen.value
  return false
}

const isParentActive = (item) => {
  if (!item.hasSubmenu) return false
  return item.submenuItems.some(subItem => subItem.id === currentPage.value)
}

const handlePageChange = (item) => {
  if (item.requiresAuth && !isAuthenticated.value) return

  if (item.hasSubmenu) {
    if (item.submenuKey === 'dashboard' && !isAuthenticated.value) {
      emit('change-page', 'lightning-explorer')
      return
    }
    toggleSubmenu(item.submenuKey)
    return
  }

  emit('change-page', item.id)
}

const handleSubmenuClick = (subItem) => {
  emit('change-page', subItem.id)
}

const isItemDisabled = (item) => {
  return item.requiresAuth && !isAuthenticated.value
}

const handleShowHelp = () => {
  emit('show-help')
}

const fetchWalletBalance = async () => {
  if (!isWalletConnected.value) {
    walletBalance.value = null
    return
  }

  isLoadingBalance.value = true
  try {
    const balanceData = await getBalance()

    if (balanceData && typeof balanceData.balance === 'number') {
      walletBalance.value = balanceData.balance
    } else {
      walletBalance.value = 0
    }
  } catch {
    walletBalance.value = 0
  } finally {
    isLoadingBalance.value = false
  }
}

const formattedBalance = computed(() => {
  if (walletBalance.value === null) return null
  if (walletBalance.value === 0) return '0'
  const sats = Math.floor(walletBalance.value / 1000)
  return sats.toLocaleString()
})

const handleWalletClick = () => {
  emit('change-page', 'wallet')
}

watch(currentPage, () => {
  checkAndOpenParentMenu()
})

watch(isWalletConnected, (connected) => {
  if (connected) {
    setTimeout(() => {
      fetchWalletBalance()
    }, 500)
  } else {
    walletBalance.value = null
  }
}, { immediate: true })

watch(activeConnection, (newConnection, oldConnection) => {
  if (newConnection && newConnection !== oldConnection) {
    setTimeout(() => {
      fetchWalletBalance()
    }, 1000)
  }
})

onMounted(() => {
  if (isWalletConnected.value) {
    setTimeout(() => {
      fetchWalletBalance()
    }, 1000)
  }
})
</script>

<template>
  <aside class="h-screen w-80 lg:w-72 flex-shrink-0 bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 flex flex-col overflow-hidden shadow-xl">
    <!-- Logo Section -->
    <div class="flex-shrink-0 px-4 py-4 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div class="flex items-center space-x-2.5 min-w-0">
        <img
          src="/new_logo3.png"
          alt="ZapTracker Logo"
          class="w-12 h-12 flex-shrink-0 object-contain"
        />
        <div class="min-w-0 flex-1 overflow-hidden">
          <h1 class="text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent leading-tight truncate">
            ZapTracker
          </h1>
          <p class="text-xs text-gray-500 truncate">Lightning Analytics</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-2.5 py-3 overflow-y-auto overflow-x-hidden" aria-label="Main navigation">
      <ul class="space-y-1">
        <li v-for="item in menuItems" :key="item.id">
          <!-- Main Menu Item -->
          <button
            @click="handlePageChange(item)"
            :disabled="isItemDisabled(item)"
            :class="[
              'w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-200 min-w-0',
              (currentPage === item.id || isParentActive(item))
                ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-600 font-semibold shadow-sm border border-orange-100'
                : isItemDisabled(item)
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900'
            ]"
          >
            <component
              :is="item.icon"
              :class="[
                'w-5 h-5 flex-shrink-0',
                (currentPage === item.id || isParentActive(item))
                  ? 'text-orange-500'
                  : isItemDisabled(item)
                  ? 'text-gray-300'
                  : 'text-gray-500'
              ]"
            />
            <span class="text-sm truncate flex-1">{{ item.label }}</span>
            <component
              v-if="item.hasSubmenu && (isAuthenticated || item.submenuKey === 'dashboard')"
              :is="isSubmenuOpen(item.submenuKey) ? IconChevronDown : IconChevronRight"
              :class="[
                'w-4 h-4 flex-shrink-0 ml-2 transition-transform duration-200',
                (currentPage === item.id || isParentActive(item)) ? 'text-orange-500' : 'text-gray-400'
              ]"
            />
          </button>

          <!-- Submenu Items -->
          <ul
            v-if="item.hasSubmenu && (isAuthenticated || item.submenuKey === 'dashboard') && isSubmenuOpen(item.submenuKey)"
            class="mt-1 ml-2 space-y-0.5 relative"
          >
            <div class="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-orange-200 via-orange-300 to-transparent"></div>
            <li v-for="subItem in item.submenuItems" :key="subItem.id">
              <button
                @click="handleSubmenuClick(subItem)"
                :class="[
                  'w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left transition-all duration-200 relative min-w-0',
                  currentPage === subItem.id
                    ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900'
                ]"
              >
                <div class="flex items-center space-x-2 pl-2 min-w-0 overflow-hidden">
                  <div
                    :class="[
                      'absolute left-3 w-2 h-2 rounded-full transition-all duration-200 flex-shrink-0',
                      currentPage === subItem.id
                        ? 'bg-orange-500 ring-2 ring-orange-200'
                        : 'bg-gray-300'
                    ]"
                  ></div>
                  <component
                    :is="subItem.icon"
                    :class="[
                      'w-4 h-4 flex-shrink-0 ml-1',
                      currentPage === subItem.id
                        ? 'text-orange-600'
                        : 'text-gray-400'
                    ]"
                  />
                  <span class="text-xs truncate flex-1 min-w-0">{{ subItem.label }}</span>
                </div>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>

    <!-- Stats & Wallet Section -->
    <div v-if="isAuthenticated" class="flex-shrink-0 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
      <!-- Wallet Status -->
      <div v-if="isWalletConnected && activeConnection" class="px-3 pt-3">
        <button
          @click="handleWalletClick"
          class="w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
        >
          <div class="flex items-center space-x-2 min-w-0 mb-2">
            <div class="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <IconWallet class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1 min-w-0 overflow-hidden text-left">
              <p class="text-xs font-bold text-gray-800 truncate">
                {{ activeConnection.name || 'Wallet Connected' }}
              </p>
              <p class="text-xs text-gray-600 font-medium truncate">Connected</p>
            </div>
          </div>
          <div v-if="formattedBalance !== null" class="bg-white/60 rounded-lg px-2.5 py-2">
            <div class="flex items-center justify-between min-w-0 gap-2">
              <span class="text-xs text-gray-600 font-medium">Balance</span>
              <div class="flex items-center space-x-1 flex-shrink-0">
                <span class="text-sm font-bold text-gray-900 tabular-nums">
                  {{ formattedBalance }}
                </span>
                <span class="text-xs text-gray-500 font-medium">sats</span>
              </div>
            </div>
          </div>
          <div v-else-if="isLoadingBalance" class="bg-white/60 rounded-lg px-2.5 py-2">
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
            </div>
          </div>
        </button>
      </div>

      <!-- Zap Stats -->
      <div v-if="combinedZapData.length > 0" class="px-3 py-3">
        <button
          @click="emit('change-page', 'zap-feed')"
          class="w-full bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 rounded-xl p-3 border border-orange-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 hover:scale-[1.02] cursor-pointer text-left"
        >
          <div class="flex items-center space-x-2 mb-2.5 min-w-0">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
              <IconBolt class="w-5 h-5 text-white" />
            </div>
            <p class="text-xs font-bold text-gray-700 truncate">Your Activity</p>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between bg-white/60 rounded-lg px-2.5 py-1.5 min-w-0 gap-2">
              <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                <IconBolt class="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span class="text-xs text-gray-600 font-medium truncate">Total Zaps</span>
              </div>
              <span class="text-sm font-bold text-gray-900 tabular-nums flex-shrink-0">
                {{ totalZaps.toLocaleString() }}
              </span>
            </div>
            <div class="flex items-center justify-between bg-white/60 rounded-lg px-2.5 py-1.5 min-w-0 gap-2">
              <div class="flex items-center space-x-1.5 min-w-0 flex-1">
                <IconCoins class="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span class="text-xs text-gray-600 font-medium truncate">Total Sats</span>
              </div>
              <span class="text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent tabular-nums flex-shrink-0">
                {{ totalSats.toLocaleString() }}
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Help Button -->
    <div v-if="!isAuthenticated" class="flex-shrink-0 px-3 py-4 border-t border-gray-200 bg-white/50">
      <button
        @click="handleShowHelp"
        class="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
      >
        <IconSparkles class="w-4 h-4 flex-shrink-0" />
        <span class="truncate">How to Get Started</span>
      </button>
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
      <a
        href="https://geyser.fund/project/zaptracker?hero=drshift"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2.5 group min-w-0"
        title="Support on Geyser"
      >
        <div class="flex-shrink-0 w-4 h-4 relative">
          <img
            src="/geyser-logo/logo-icon-black.svg"
            alt="Geyser"
            class="w-full h-full object-contain absolute inset-0 transition-opacity duration-300 group-hover:opacity-0"
          />
          <img
            src="/geyser-logo/heart-red.svg"
            alt="Support"
            class="w-full h-full object-contain absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-pulse"
          />
        </div>
        <span class="text-xs text-gray-600 group-hover:text-rose-600 transition-colors duration-300 font-medium truncate flex-1 min-w-0">
          Support ZapTracker
        </span>
      </a>
    </div>
  </aside>
</template>

<style scoped>
aside {
  -webkit-user-select: none;
  user-select: none;
}

aside,
aside * {
  box-sizing: border-box;
}

button:disabled {
  pointer-events: none;
}

nav {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

nav::-webkit-scrollbar {
  width: 6px;
}

nav::-webkit-scrollbar-track {
  background: transparent;
}

nav::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
}

nav::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}
</style>
