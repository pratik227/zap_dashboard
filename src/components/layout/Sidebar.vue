<script setup>
import { inject, computed, ref, watch } from 'vue'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
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

const totalZaps = computed(() =>
  combinedZapData.value.filter(zap => zap.eventId).length
)

const totalSats = computed(() =>
  combinedZapData.value
    .filter(zap => zap.eventId)
    .reduce((sum, zap) => sum + zap.amount, 0)
)

const checkAndOpenParentMenu = () => {
  if (['dashboard', 'lightning-explorer'].includes(currentPage.value)) {
    dashboardSubmenuOpen.value = true
  }
  if (['content', 'notes', 'campaigns'].includes(currentPage.value)) {
    studioSubmenuOpen.value = true
  }
  if (['audience', 'chat-zaps'].includes(currentPage.value)) {
    audienceSubmenuOpen.value = true
  }
}

watch(currentPage, checkAndOpenParentMenu, { immediate: true })

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: IconDashboard,
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
  { id: 'settings', label: 'Settings', icon: IconSettings }
]

const toggleSubmenu = key => {
  if (key === 'dashboard') dashboardSubmenuOpen.value = !dashboardSubmenuOpen.value
  if (key === 'studio') studioSubmenuOpen.value = !studioSubmenuOpen.value
  if (key === 'audience') audienceSubmenuOpen.value = !audienceSubmenuOpen.value
}

const isSubmenuOpen = key =>
  key === 'dashboard'
    ? dashboardSubmenuOpen.value
    : key === 'studio'
    ? studioSubmenuOpen.value
    : audienceSubmenuOpen.value

const isParentActive = item =>
  item.hasSubmenu && item.submenuItems.some(i => i.id === currentPage.value)

const handlePageChange = item => {
  if (item.requiresAuth && !isAuthenticated.value) return
  if (item.hasSubmenu) return toggleSubmenu(item.submenuKey)
  emit('change-page', item.id)
}
</script>

<template>
  <aside
    class="
      h-screen
      w-64 sm:w-72 lg:w-80
      bg-gradient-to-b from-white to-gray-50
      border-r border-gray-200
      flex flex-col
      shadow-xl
      overflow-hidden
    "
  >
    <!-- Logo -->
    <div class="px-4 sm:px-6 py-5 border-b bg-white/80 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <img src="/new_logo3.png" class="w-12 h-12 sm:w-14 sm:h-14 object-contain" />
        <div class="min-w-0">
          <h1 class="text-lg sm:text-xl font-bold truncate bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            ZapTracker
          </h1>
          <p class="text-xs text-gray-500 truncate">Lightning Analytics</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 px-2 sm:px-3 py-4 overflow-y-auto overflow-x-hidden">
      <ul class="space-y-1">
        <li v-for="item in menuItems" :key="item.id">
          <button
            @click="handlePageChange(item)"
            :class="[
              'w-full flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl text-left transition',
              currentPage === item.id || isParentActive(item)
                ? 'bg-orange-50 text-orange-600 font-semibold'
                : 'text-gray-700 hover:bg-gray-100'
            ]"
          >
            <component :is="item.icon" class="w-5 h-5 flex-shrink-0" />
            <span class="flex-1 truncate text-sm">{{ item.label }}</span>
            <component
              v-if="item.hasSubmenu"
              :is="isSubmenuOpen(item.submenuKey) ? IconChevronDown : IconChevronRight"
              class="w-4 h-4 text-gray-400"
            />
          </button>

          <!-- Submenu -->
          <ul
            v-if="item.hasSubmenu && isSubmenuOpen(item.submenuKey)"
            class="mt-1 ml-3 space-y-0.5"
          >
            <li v-for="sub in item.submenuItems" :key="sub.id">
              <button
                @click="$emit('change-page', sub.id)"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
              >
                <component :is="sub.icon" class="w-4 h-4" />
                <span class="truncate">{{ sub.label }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </nav>

    <!-- Help Button -->
    <div v-if="!isAuthenticated" class="p-4 border-t bg-white/60">
      <button
        @click="$emit('show-help')"
        class="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm"
      >
        How to Get Started
      </button>
    </div>
  </aside>
</template>

<style scoped>
aside,
aside * {
  box-sizing: border-box;
  user-select: none;
}
</style>
