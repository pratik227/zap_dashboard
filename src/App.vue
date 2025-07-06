<script setup>
import { ref, provide, watch, onMounted, nextTick,computed, onUnmounted } from 'vue'
import { IconAlertTriangle, IconX } from '@iconify-prerendered/vue-tabler'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import Dashboard from './pages/Dashboard.vue'
import ZapFeed from './pages/ZapFeed.vue'
import Analytics from './pages/Analytics.vue'
import ChatZaps from './pages/ChatZaps.vue'
import Content from './pages/Content.vue'
import ContentUnlock from './pages/ContentUnlock.vue'
import Donations from './pages/Donations.vue'
import MiniPoS from './pages/MiniPoS.vue'
import Wallet from './pages/Wallet.vue'
import Finances from './pages/Finances.vue'
import Settings from './pages/Settings.vue'
import InvoiceShare from './pages/InvoiceShare.vue'
import Notes from './pages/Notes.vue'
import NWCConnection from './components/NWCConnection.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { useNostrConnections } from './composables/useNostrConnections.js'
import { useNotifications } from './composables/useNotifications.js'
import { nostrRelayManager } from './utils/nostrRelayManager.js'

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
  autoReconnect,
  getBalance
} = useNostrConnections()

// Use the notifications composable
const {
  handleConnectionSuccess: notifyConnectionSuccess,
  handleConnectionError: notifyConnectionError,
  handleZapReceived,
  handleBalanceChange,
  notifications
} = useNotifications()

// Global state
const zapData = ref([])
const selectedTimeRange = ref('all') // Changed from '7d' to 'all'
const searchQuery = ref('')
const selectedFilters = ref({
  minAmount: 0,
  maxAmount: null,
  noteType: 'all',
  sender: ''
})

const currentPage = ref('dashboard')
const activeSettingsTab = ref('nostr')
const showConnectionModal = ref(false)
const isMobileMenuOpen = ref(false)
const isRefreshingData = ref(false)

// Add error handling for page loading
const pageLoadingError = ref('')
const isPageLoading = ref(false)

// Provide data to child components
provide('zapData', zapData)
provide('selectedTimeRange', selectedTimeRange)
provide('searchQuery', searchQuery)
provide('selectedFilters', selectedFilters)
provide('currentPage', currentPage)
provide('activeSettingsTab', activeSettingsTab)
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
  'content-unlock': ContentUnlock,
  donations: Donations,
  'mini-pos': MiniPoS,
  wallet: Wallet,
  finances: Finances,
  settings: Settings,
  'invoice-share': InvoiceShare,
  notes: Notes
}

// Check if current page is standalone
const isStandalonePage = computed(() => {
  return currentPage.value === 'invoice-share'
})

// Enhanced data refresh function with better error handling
const refreshZapData = async (force = false, retryCount = 0) => {
  if (!activeConnection.value && !force) {
    console.log('No active connection, clearing zap data')
    zapData.value = []
    return
  }
  
  if (isRefreshingData.value && retryCount === 0) {
    console.log('Data refresh already in progress, skipping...')
    return
  }
  
  isRefreshingData.value = true
  const maxRetries = 3
  
  try {
    console.log(`Refreshing zap data... (attempt ${retryCount + 1}/${maxRetries + 1})`)
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
    
    // Clear any connection errors on successful refresh
    if (connectionError.value) {
      connectionError.value = ''
    }
    
  } catch (error) {
    console.error(`Failed to refresh zap data (attempt ${retryCount + 1}):`, error)
    
    // If we have retries left and it's a network/connection error, retry
    if (retryCount < maxRetries && isNetworkError(error)) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Exponential backoff, max 10s
      console.log(`Retrying data refresh in ${delay}ms...`)
      
      setTimeout(async () => {
        await refreshZapData(force, retryCount + 1)
      }, delay)
      return
    }
    
    // Set connection error for display
    connectionError.value = `Failed to refresh data: ${error.message}`
    
    // Don't clear existing data on error, just log it
    if (zapData.value.length === 0) {
      zapData.value = []
    }
  } finally {
    // Only clear loading state if this is not a retry
    if (retryCount === 0) {
      isRefreshingData.value = false
    }
  }
}

// Helper function to determine if an error is network-related
const isNetworkError = (error) => {
  const networkErrorMessages = [
    'timeout',
    'network',
    'connection',
    'failed to fetch',
    'load failed',
    'websocket',
    'relay'
  ]
  
  const errorMessage = error.message.toLowerCase()
  return networkErrorMessages.some(msg => errorMessage.includes(msg))
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
  console.log('App mounted, initializing relay manager...')
  
  try {
    // Initialize the relay manager first
    await nostrRelayManager.initialize()
    console.log('✅ Relay manager initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize relay manager:', error)
  }
  
  // Check URL parameters for page navigation
  const urlParams = new URLSearchParams(window.location.search)
  const pageParam = urlParams.get('page')
  
  if (pageParam && components[pageParam]) {
    currentPage.value = pageParam
  }
  
  // Check if we need to show connection modal (only for non-standalone pages)
  if (!isWalletConnected.value && !isStandalonePage.value) {
    console.log('No wallet connected, showing connection modal')
    showConnectionModal.value = true
  } else if (isWalletConnected.value) {
    console.log('Wallet already connected, refreshing data...')
    // Give a moment for everything to initialize
    setTimeout(() => {
      refreshZapData(true)
    }, 1000)
  }
  
  // Start periodic health check and data refresh
  startPeriodicHealthCheck()
})

// Periodic health check and data refresh
let healthCheckInterval = null

const startPeriodicHealthCheck = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
  }
  
  // Check every 2 minutes
  healthCheckInterval = setInterval(async () => {
    if (isWalletConnected.value && !isRefreshingData.value) {
      console.log('Performing periodic health check and data refresh...')
      
      try {
        // Test connection health by doing a simple balance check
        await getBalance()
        
        // If successful, refresh data to catch any new transactions
        await refreshZapData(true)
        
      } catch (error) {
        console.warn('Periodic health check failed:', error)
        
        // If connection seems broken, try to reconnect
        if (error.message.includes('not initialized') || error.message.includes('timeout')) {
          console.log('Connection appears broken, attempting auto-reconnect...')
          try {
            await autoReconnect()
            console.log('Auto-reconnect successful')
          } catch (reconnectError) {
            console.error('Auto-reconnect failed:', reconnectError)
            connectionError.value = 'Connection lost. Please reconnect your wallet.'
          }
        }
      }
    }
  }, 120000) // 2 minutes
}

// Cleanup on unmount
onUnmounted(() => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
  }
})

// Watch for transaction notifications and auto-refresh
watch(notifications, (newNotifications, oldNotifications) => {
  if (!newNotifications || !oldNotifications) return
  
  // Check if there are new payment-related notifications
  const hasNewPaymentNotification = newNotifications.length > oldNotifications.length &&
    newNotifications.some(notification => 
      (notification.type === 'zap_received' || 
       notification.type === 'payment_success' || 
       notification.type === 'payment_error') &&
      !notification.read
    )
  
  if (hasNewPaymentNotification && isWalletConnected.value) {
    console.log('New payment notification detected, auto-refreshing data...')
    setTimeout(() => {
      refreshZapData(true)
    }, 2000) // Small delay to ensure transaction is fully processed
  }
}, { deep: true })

// Enhanced page change function to handle tab navigation
const changePage = async (page, tab = null) => {
  if (!components[page]) {
    console.error('Invalid page:', page)
    pageLoadingError.value = `Page "${page}" not found`
    return
  }
  
  isPageLoading.value = true
  pageLoadingError.value = ''
  
  try {
    currentPage.value = page
    isMobileMenuOpen.value = false
    
    // If navigating to settings and a specific tab is provided, set it
    if (page === 'settings' && tab) {
      activeSettingsTab.value = tab
    }
    
    // Update URL without page reload
    const url = new URL(window.location)
    if (page !== 'dashboard') {
      url.searchParams.set('page', page)
    } else {
      url.searchParams.delete('page')
    }
    window.history.pushState({}, '', url)
    
    // Give the component a moment to load
    await nextTick()
    
  } catch (error) {
    console.error('Page change error:', error)
    pageLoadingError.value = `Failed to load page: ${error.message}`
  } finally {
    isPageLoading.value = false
  }
}

// Provide changePage function to child components
provide('changePage', changePage)

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

// Provide error handling to child components
provide('pageLoadingError', pageLoadingError)
provide('isPageLoading', isPageLoading)
</script>

<template>
  <!-- Standalone Invoice Share Page -->
  <div v-if="isStandalonePage" class="min-h-screen bg-gradient-to-br from-orange-25 via-amber-25 to-yellow-25">
    <component 
      :is="components[currentPage]" 
      :key="currentPage"
      @change-page="changePage"
    />
  </div>

  <!-- Main Application Layout -->
  <div v-else class="h-screen bg-gradient-to-br from-orange-25 via-amber-25 to-yellow-25 flex overflow-hidden">
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
          @change-page="changePage"
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
          
          <!-- Page Loading Error -->
          <transition name="slide-down">
            <div v-if="pageLoadingError" class="mb-4 lg:mb-6">
              <div class="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div class="flex items-center space-x-2">
                    <IconAlertTriangle class="w-5 h-5 text-red-600" />
                    <span class="text-red-800 text-sm sm:text-base">{{ pageLoadingError }}</span>
                  </div>
                  <button 
                    @click="changePage('dashboard')"
                    class="btn-secondary text-sm whitespace-nowrap text-blue-600 hover:text-blue-700"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </transition>
          
          <!-- Page Loading State -->
          <transition name="slide-down">
            <div v-if="isPageLoading" class="mb-4 lg:mb-6">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div class="flex items-center space-x-2">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span class="text-blue-800 text-sm sm:text-base">Loading page...</span>
                </div>
              </div>
            </div>
          </transition>
          
          <!-- Page Content with Transition -->
          <transition name="page-fade" mode="out-in">
            <ErrorBoundary v-if="!pageLoadingError && !isPageLoading">
              <component 
                :is="components[currentPage]" 
                :key="currentPage"
                :initial-tab="currentPage === 'settings' ? activeSettingsTab : undefined"
                @change-page="changePage"
              />
            </ErrorBoundary>
          </transition>
        </div>
      </main>
    </div>
    
    <!-- Connection Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showConnectionModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-4 sm:p-6 max-w-md w-full transform animate-modal-content max-h-[90vh] overflow-y-auto shadow-2xl">
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
    </Teleport>
  </div>
</template>
