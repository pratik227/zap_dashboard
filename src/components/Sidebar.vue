<script setup>
import { inject, computed, ref, watch } from 'vue'
import { useNostrAuth } from '../composables/useNostrAuth.js'
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
  IconMessageCircle
} from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const combinedZapData = inject('combinedZapData')
const activeConnection = inject('activeConnection')
const isWalletConnected = inject('isWalletConnected')
const emit = defineEmits(['change-page', 'show-help'])

const { isAuthenticated } = useNostrAuth()
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
  const studioPages = ['content', 'notes', 'campaigns']
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
  {
    id: 'studio',
    label: 'Studio',
    icon: IconVideo,
    requiresAuth: true,
    hasSubmenu: true,
    submenuKey: 'studio',
    submenuItems: [
      { id: 'content', label: 'Content', icon: IconFileText },
      { id: 'notes', label: 'Notes', icon: IconEdit },
      { id: 'campaigns', label: 'Campaigns', icon: IconTarget }
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

  // If clicking on a parent with submenu
  if (item.hasSubmenu) {
    // For dashboard, always toggle when clicked
    if (item.submenuKey === 'dashboard' && !isAuthenticated.value) {
      emit('change-page', 'lightning-explorer')
      return
    }
    toggleSubmenu(item.submenuKey)
    return
  }

  // Regular item
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

watch(currentPage, () => {
  checkAndOpenParentMenu()
})
</script>

<template>
  <aside class="h-screen w-72 bg-gradient-to-b from-white to-gray-50 border-r border-gray-200 flex flex-col overflow-hidden shadow-xl">
    <!-- Logo Section -->
    <div class="flex-shrink-0 px-6 py-6 border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div class="flex items-center space-x-3">
        <img
          src="/new_logo3.png"
          alt="ZapTracker Logo"
          class="w-14 h-14 object-contain"
        />
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent leading-tight truncate">ZapTracker</h1>
          <p class="text-xs text-gray-500 truncate">Lightning Analytics</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-3 py-4 overflow-y-auto">
      <ul class="space-y-1">
        <li v-for="item in menuItems" :key="item.id">
          <!-- Main Menu Item -->
          <button
            @click="handlePageChange(item)"
            :disabled="isItemDisabled(item)"
            :class="[
              'w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
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
            class="mt-1 ml-3 space-y-0.5 relative"
          >
            <div class="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-orange-200 via-orange-300 to-transparent"></div>
            <li v-for="subItem in item.submenuItems" :key="subItem.id">
              <button
                @click="handleSubmenuClick(subItem)"
                :class="[
                  'w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-left transition-all duration-200 relative',
                  currentPage === subItem.id
                    ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900'
                ]"
              >
                <div class="flex items-center space-x-3 pl-3">
                  <div
                    :class="[
                      'absolute left-4 w-2 h-2 rounded-full transition-all duration-200',
                      currentPage === subItem.id
                        ? 'bg-orange-500 ring-2 ring-orange-200'
                        : 'bg-gray-300'
                    ]"
                  ></div>
                  <component
                    :is="subItem.icon"
                    :class="[
                      'w-4 h-4 flex-shrink-0 ml-2',
                      currentPage === subItem.id
                        ? 'text-orange-600'
                        : 'text-gray-400'
                    ]"
                  />
                  <span class="text-xs truncate">{{ subItem.label }}</span>
                </div>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>

    <!-- Stats & Wallet Section (Only when authenticated) -->
    <div v-if="isAuthenticated" class="flex-shrink-0 border-t border-gray-200 bg-white/50 backdrop-blur-sm">
      <!-- Wallet Status -->
      <div v-if="isWalletConnected && activeConnection" class="px-4 pt-4">
        <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200 shadow-sm">
          <div class="flex items-center space-x-2 mb-3">
            <div class="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <IconWallet class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-gray-700 truncate">{{ activeConnection.name || 'Wallet Connected' }}</p>
              <p class="text-xs text-green-600 font-medium">Connected</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Zap Stats -->
      <div v-if="combinedZapData.length > 0" class="px-4 py-4">
        <div class="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-50 rounded-2xl p-4 border border-orange-200 shadow-sm">
          <div class="flex items-center space-x-2 mb-3">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center shadow-md">
              <IconBolt class="w-5 h-5 text-white" />
            </div>
            <p class="text-xs font-bold text-gray-700">Your Activity</p>
          </div>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
              <div class="flex items-center space-x-2">
                <IconBolt class="w-4 h-4 text-orange-500" />
                <span class="text-xs text-gray-600 font-medium">Total Zaps</span>
              </div>
              <span class="text-sm font-bold text-gray-900 tabular-nums">{{ totalZaps.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
              <div class="flex items-center space-x-2">
                <IconCoins class="w-4 h-4 text-orange-500" />
                <span class="text-xs text-gray-600 font-medium">Total Sats</span>
              </div>
              <span class="text-sm font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent tabular-nums">{{ totalSats.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Help Button (Only when not authenticated) -->
    <div v-if="!isAuthenticated" class="flex-shrink-0 px-4 py-5 border-t border-gray-200 bg-white/50">
      <button
        @click="handleShowHelp"
        class="w-full px-5 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold rounded-2xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
      >
        <IconSparkles class="w-5 h-5" />
        <span>How to Get Started</span>
      </button>
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
      <a
        href="https://geyser.fund/project/zaptracker?hero=drshift"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-3 group"
        title="Support on Geyser"
      >
        <div class="flex-shrink-0 w-5 h-5 relative">
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
        <span class="text-xs text-gray-600 group-hover:text-rose-600 transition-colors duration-300 font-medium">
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

button:disabled {
  pointer-events: none;
}
</style>
