<script setup>
import { ref, provide, watch, onMounted, nextTick } from 'vue'
import { IconAlertTriangle, IconX } from '@iconify-prerendered/vue-tabler'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import Dashboard from './pages/Dashboard.vue'
import ZapFeed from './pages/ZapFeed.vue'
import Analytics from './pages/Analytics.vue'
import ChatZaps from './pages/ChatZaps.vue'
import Content from './pages/Content.vue'
import Donations from './pages/Donations.vue'
import MiniPoS from './pages/MiniPoS.vue'
import Wallet from './pages/Wallet.vue'
import Finances from './pages/Finances.vue'
import Settings from './pages/Settings.vue'
import NWCConnection from './components/NWCConnection.vue'
import { useNostrConnections } from './composables/useNostrConnections.js'
import { useNotifications } from './composables/useNotifications.js'

// Use the Nostr connections composable
const {
  connections,
  activeConnection,
  isLoadingConnection,
  connectionError,
  isWalletConnected,
  setActiveConnection,
  clearActiveConnection,
  loadZapData,
  autoReconnect
} = useNostrConnections()

// Use the notifications composable
const {
  handleConnectionSuccess: notifyConnectionSuccess,
  handleConnectionError: notifyConnectionError,
  handleZapReceived,
  handleBalanceChange
} = useNotifications()

// Global state
const zapData = ref([])
const selectedTimeRange = ref('7d')
const searchQuery = ref('')
const selectedFilters = ref({
  minAmount: 0,
  maxAmount: null,
  noteType: 'all',
  sender: ''
})

const currentPage = ref('dashboard')
const showConnectionModal = ref(false)
const isMobileMenuOpen = ref(false)
const isRefreshingData = ref(false)

// Provide data to child components
provide('zapData', zapData)
provide('selectedTimeRange', selectedTimeRange)
provide('searchQuery', searchQuery)
provide('selectedFilters', selectedFilters)
provide('currentPage', currentPage)
provide('isMobileMenuOpen', isMobileMenuOpen)

// Provide connection management
provide('connections', connections)
provide('activeConnection', activeConnection)
provide('isLoadingConnection', isLoadingConnection)
provide('connectionError', connectionError)
provide('isWalletConnected', isWalletConnected)
provide('setActiveConnection', setActiveConnection)
provide('clearActiveConnection', clearActiveConnection)

const components = {
  dashboard: Dashboard,
  'zap-feed': ZapFeed,
  analytics: Analytics,
  'chat-zaps': ChatZaps,
  content: Content,
  donations: Donations,
  'mini-pos': MiniPoS,
  wallet: Wallet,
  finances: Finances,
  settings: Settings
}

// Enhanced data refresh function with better error handling
const refreshZapData = async (force = false) => {
  if (!activeConnection.value && !force) {
    console.log('No active connection, clearing zap data')
    zapData.value = []
    return
  }
  
  if (isRefreshingData.value) {
    console.log('Data refresh already in progress, skipping...')
    return
  }
  
  isRefreshingData.value = true
  
  try {
    console.log('Refreshing zap data...')
    const data = await loadZapData()
    
    // Check for new zaps and trigger notifications
    if (zapData.value.length > 0 && data.length > zapData.value.length) {
      const newZaps = data.slice(0, data.length - zapData.value.length)
      newZaps.forEach(zap => {
        handleZapReceived(zap)
      })
    }
    
    zapData.value = data
    console.log('Zap data refreshed successfully:', data.length, 'zaps')
  } catch (error) {
    console.error('Failed to refresh zap data:', error)
    // Don't clear existing data on error, just log it
    if (zapData.value.length === 0) {
      zapData.value = []
    }
  } finally {
    isRefreshingData.value = false
  }
}

// Watch for active connection changes with immediate execution
watch(activeConnection, async (newConnection, oldConnection) => {
  console.log('Active connection changed:', {
    old: oldConnection?.name || 'none',
    new: newConnection?.name || 'none'
  })
  
  if (newConnection) {
    // Small delay to ensure NWC client is fully initialized
    await nextTick()
    setTimeout(() => {
      refreshZapData(true)
    }, 500)
  } else {
    zapData.value = []
  }
}, { immediate: true })

// Enhanced initialization
onMounted(async () => {
  console.log('App mounted, checking connection status...')
  
  // Check if we need to show connection modal
  if (!isWalletConnected.value) {
    console.log('No wallet connected, showing connection modal')
    showConnectionModal.value = true
  } else {
    console.log('Wallet already connected, refreshing data...')
    // Give a moment for everything to initialize
    setTimeout(() => {
      refreshZapData(true)
    }, 1000)
  }
})

// Close mobile menu when page changes
const changePage = (page) => {
  currentPage.value = page
  isMobileMenuOpen.value = false
}

// Enhanced connection success handler with notifications
const handleConnectionSuccess = async () => {
  console.log('Connection successful, updating UI...')
  showConnectionModal.value = false
  
  // Notify about successful connection
  if (activeConnection.value) {
    notifyConnectionSuccess(activeConnection.value.name)
  }
  
  // Wait a moment for the connection to fully establish
  await nextTick()
  setTimeout(() => {
    refreshZapData(true)
  }, 500)
}

// Enhanced connection error handler with notifications
const handleConnectionError = (error) => {
  console.error('Connection error:', error)
  notifyConnectionError(error)
}

// Manual refresh function for user-triggered refreshes
const handleManualRefresh = async () => {
  if (!isWalletConnected.value) {
    console.log('No wallet connected for manual refresh')
    return
  }
  
  console.log('Manual refresh triggered')
  await refreshZapData(true)
}

// Provide manual refresh function to child components
provide('refreshZapData', handleManualRefresh)
provide('isRefreshingData', isRefreshingData)

// Watch for connection errors and notify
watch(connectionError, (error) => {
  if (error) {
    handleConnectionError(new Error(error))
  }
})
</script>

<template>
  <div class="h-screen bg-gradient-to-br from-orange-25 via-amber-25 to-yellow-25 flex overflow-hidden">
    <!-- Mobile Menu Overlay -->
    <transition name="overlay-fade">
      <div 
        v-if="isMobileMenuOpen" 
        class="fixed inset-0 bg-black/50 z-40 lg:hidden"
        @click="isMobileMenuOpen = false"
      ></div>
    </transition>
    
    <!-- Sidebar - Mobile Drawer / Desktop Fixed -->
    <div :class="[
      'fixed top-0 left-0 h-screen w-64 overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:z-30',
      isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
    ]">
      <Sidebar @change-page="changePage" />
    </div>
    
    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col h-screen overflow-hidden lg:ml-64">
      <!-- Fixed Top Bar -->
      <header class="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-orange-100/50">
        <TopBar 
          @show-connection="showConnectionModal = true" 
          @toggle-mobile-menu="isMobileMenuOpen = !isMobileMenuOpen"
        />
      </header>
      
      <!-- Scrollable Main Content -->
      <main class="flex-1 overflow-y-auto scrollbar-thin">
        <div class="p-3 sm:p-4 lg:p-6">
          <!-- Connection Status Bar -->
          <transition name="slide-down">
            <div v-if="!isWalletConnected" class="mb-4 lg:mb-6">
              <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 animate-pulse-subtle">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div class="flex items-center space-x-2">
                    <IconAlertTriangle class="w-5 h-5 text-amber-600 animate-bounce-subtle" />
                    <span class="text-amber-800 text-sm sm:text-base">No wallet connected. Connect your wallet to view real zap data.</span>
                  </div>
                  <button 
                    @click="showConnectionModal = true"
                    class="btn-primary text-sm whitespace-nowrap animate-pulse-button"
                  >
                    Connect Wallet
                  </button>
                </div>
              </div>
            </div>
          </transition>
          
          <!-- Loading State -->
          <transition name="slide-down">
            <div v-if="isLoadingConnection || isRefreshingData" class="mb-4 lg:mb-6">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span class="text-blue-800 text-sm sm:text-base">
                    {{ isLoadingConnection ? 'Connecting to wallet...' : 'Refreshing data...' }}
                  </span>
                </div>
              </div>
            </div>
          </transition>
          
          <!-- Connection Error -->
          <transition name="slide-down">
            <div v-if="connectionError && !isLoadingConnection" class="mb-4 lg:mb-6">
              <div class="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div class="flex items-center space-x-2">
                    <IconAlertTriangle class="w-5 h-5 text-red-600" />
                    <span class="text-red-800 text-sm sm:text-base">{{ connectionError }}</span>
                  </div>
                  <div class="flex space-x-2">
                    <button 
                      @click="handleManualRefresh"
                      :disabled="isRefreshingData"
                      class="btn-secondary text-sm whitespace-nowrap text-blue-600 hover:text-blue-700"
                    >
                      Retry
                    </button>
                    <button 
                      @click="showConnectionModal = true"
                      class="btn-secondary text-sm whitespace-nowrap text-red-600 hover:text-red-700"
                    >
                      Reconnect
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </transition>
          
          <!-- Page Content with Transition -->
          <transition name="page-fade" mode="out-in">
            <component :is="components[currentPage]" :key="currentPage" />
          </transition>
        </div>
      </main>
    </div>
    
    <!-- Connection Modal -->
    <transition name="modal-transition">
      <div v-if="showConnectionModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full mx-4 transform animate-modal-content">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg sm:text-xl font-bold text-gray-800">Connect Your Wallet</h2>
            <button 
              v-if="isWalletConnected"
              @click="showConnectionModal = false"
              class="text-gray-500 hover:text-gray-700 p-1 touch-target hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
            >
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <NWCConnection @connection-success="handleConnectionSuccess" />
          <div v-if="isWalletConnected" class="mt-4 flex justify-end">
            <button 
              @click="showConnectionModal = false"
              class="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>