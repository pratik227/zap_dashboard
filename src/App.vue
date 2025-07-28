<script setup>
import { ref, provide, watch, onMounted, nextTick,computed, onUnmounted } from 'vue'
import { IconAlertTriangle, IconX } from '@iconify-prerendered/vue-tabler'
import Sidebar from './components/Sidebar.vue'
import { useContentZaps } from './composables/useContentZaps.js'
import TopBar from './components/TopBar.vue'
import Dashboard from './pages/Dashboard.vue'
import { useNostrLongForm } from './composables/useNostrLongForm.js'
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
import { useNostrNotes } from './composables/useNostrNotes.js'
import { useNostrAuth } from './composables/useNostrAuth.js'

// Track processed event IDs to prevent duplicates
const processedEventIds = new Set() // Track processed event IDs to prevent duplicates
// Track processed payment hashes for deduplication across NWC and NIP-57
const processedPaymentHashes = new Set()

// Profile cache to avoid repeated fetches
const profileCache = new Map()
const profileFetchPromises = new Map()

// Fetch author profile using relay manager
const fetchAuthorProfile = async (pubkey, forceRefresh = false) => {
  // Return cached profile if available (unless force refresh)
  if (!forceRefresh && profileCache.has(pubkey)) {
    return profileCache.get(pubkey)
  }
  
  // If already fetching this profile, wait for the promise
  if (profileFetchPromises.has(pubkey)) {
    return profileFetchPromises.get(pubkey)
  }
  
  // Create a new fetch promise
  const fetchPromise = (async () => {
    try {
      const authorEvent = await nostrRelayManager.getEvent({
        kinds: [0],
        authors: [pubkey],
        limit: 1
      })
      
      let profile = null
      
      if (authorEvent) {
        try {
          profile = JSON.parse(authorEvent.content)
        } catch (err) {
          console.warn('Failed to parse author profile:', err)
        }
      }
      
      const profileData = {
        pubkey,
        name: profile?.name || profile?.display_name || `user:${pubkey.substring(0, 8)}`,
        picture: profile?.picture || generateFallbackAvatar(pubkey),
        nip05: profile?.nip05 || null,
        about: profile?.about || null
      }
      
      // Cache the profile
      profileCache.set(pubkey, profileData)
      return profileData
      
    } catch (err) {
      console.warn('Failed to fetch author profile:', err)
      const fallbackProfile = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateFallbackAvatar(pubkey),
        nip05: null,
        about: null
      }
      
      // Cache the fallback profile
      profileCache.set(pubkey, fallbackProfile)
      return fallbackProfile
    } finally {
      // Clean up the promise
      profileFetchPromises.delete(pubkey)
    }
  })()
  
  // Store the promise to prevent duplicate fetches
  profileFetchPromises.set(pubkey, fetchPromise)
  return fetchPromise
}

// Refresh profile for a specific pubkey
const refreshProfile = async (pubkey) => {
  if (!pubkey) return
  
  try {
    const profile = await fetchAuthorProfile(pubkey, true) // Force refresh
    profileStore.value.set(pubkey, profile)
    return profile
  } catch (error) {
    console.error('Failed to refresh profile:', error)
    throw error
  }
}

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

// Use the content zaps composable to get NIP-57 zaps
const { getAllContentZaps } = useContentZaps()

// Initialize content zaps tracking
const { initializeZapTracking } = useContentZaps()

// Initialize notes and zaps tracking early
const { notes, fetchUserNotes } = useNostrNotes()
const { fetchUserLongFormContent } = useNostrLongForm()

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

// Combine NWC payments (zapData) with NIP-57 zaps
const combinedZapData = computed(() => {
  // Create a map to store unique zaps by payment hash/id
  const uniqueZapsMap = new Map()
  
  // First, process NIP-57 zaps from useContentZaps (prioritize these)
  const contentZapsMap = getAllContentZaps.value
  
  // Convert the map of content zaps to an array
  Object.entries(contentZapsMap).forEach(([eventId, zapData]) => {
    zapData.zaps.forEach(zap => {
      // Add NIP-57 zap to the map with payment hash/id as key
      uniqueZapsMap.set(zap.id, {
        id: zap.id,
        amount: zap.amount,
        timestamp: zap.timestamp,
        sender: {
          name: zap.sender?.name || `User ${zap.zapperPubkey.substring(0, 8)}`,
          pubkey: zap.zapperPubkey,
          nip05: zap.sender?.nip05 || null,
          avatar: zap.sender?.picture || generateFallbackAvatar(zap.zapperPubkey),
          // Add profile fetching capability
          fetchProfile: () => fetchAuthorProfile(zap.zapperPubkey)
        },
        note: zap.message || 'Zap',
        noteType: 'original',
        client: 'nostr',
        source: 'nip57', // Explicitly mark as NIP-57 zap
        eventId: eventId
      })
    })
  })
  
  // Now process NWC payments, only adding them if they don't already exist in the map
  zapData.value.forEach(zap => {
    // Only add NWC payment if we don't already have a NIP-57 zap with the same ID
    if (!uniqueZapsMap.has(zap.id)) {
      uniqueZapsMap.set(zap.id, {
        ...zap,
        source: 'nwc', // Explicitly mark as NWC payment
        eventId: null, // NWC payments don't have associated event IDs
        // Add profile fetching capability for NWC payments if they have sender pubkey
        sender: zap.sender?.pubkey ? {
          ...zap.sender,
          fetchProfile: () => fetchAuthorProfile(zap.sender.pubkey)
        } : zap.sender
      })
    } else {
      console.log(`Skipping duplicate NWC payment with id ${zap.id?.substring(0, 16)}... (already have NIP-57 zap)`)
    }
  })

  // Convert map values to array and sort by timestamp
  return Array.from(uniqueZapsMap.values()).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  )
})

// Generate a fallback avatar based on pubkey
const generateFallbackAvatar = (pubkey) => {
  if (!pubkey) return 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  
  // Use a deterministic approach to generate avatar based on pubkey
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  // Create a hash from the pubkey to consistently select an avatar
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Add error handling for page loading
const pageLoadingError = ref('')
const isPageLoading = ref(false)

// Reactive profile store
const profileStore = ref(new Map())

// Watch for new zaps and fetch profiles
watch(combinedZapData, async (newZaps) => {
  const profilePromises = []
  
  newZaps.forEach(zap => {
    const pubkey = zap.sender?.pubkey || zap.sender?.zapperPubkey
    if (pubkey && !profileStore.value.has(pubkey)) {
      profilePromises.push(
        fetchAuthorProfile(pubkey).then(profile => {
          profileStore.value.set(pubkey, profile)
        }).catch(error => {
          console.warn('Failed to fetch profile for pubkey:', pubkey, error)
        })
      )
    }
  })
  
  // Wait for all profile fetches to complete
  if (profilePromises.length > 0) {
    await Promise.allSettled(profilePromises)
  }
}, { immediate: true })

// Enhanced combined zap data with profile integration
const enhancedCombinedZapData = computed(() => {
  return combinedZapData.value.map(zap => {
    const pubkey = zap.sender?.pubkey || zap.sender?.zapperPubkey
    const profile = pubkey ? profileStore.value.get(pubkey) : null
    
    if (profile && zap.sender) {
      return {
        ...zap,
        sender: {
          ...zap.sender,
          name: profile.name,
          picture: profile.picture,
          avatar: profile.picture, // For backward compatibility
          nip05: profile.nip05,
          about: profile.about
        }
      }
    }
    
    return zap
  })
})

// Provide data to child components
provide('zapData', zapData)
provide('combinedZapData', enhancedCombinedZapData)
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

// Provide profile management
provide('profileStore', profileStore)
provide('fetchAuthorProfile', fetchAuthorProfile)
provide('refreshProfile', refreshProfile)

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
    
    // Check if we're in a Yakihonne iframe
    const isInYakihonneIframe = () => {
      try {
        // Check if we're in an iframe
        const isIframe = window.self !== window.top;
        if (!isIframe) return false;
        
        // Check if referrer contains 'yakihonne'
        const referrer = document.referrer || '';
        if (referrer.includes('yakihonne')) return true;
        
        // Check if parent origin contains 'yakihonne'
        try {
          const parentOrigin = window.parent.origin || '';
          if (parentOrigin.includes('yakihonne')) return true;
        } catch (e) {
          // Cross-origin access might be restricted
        }
        
        // Check URL parameters or hash for yakihonne
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('yakihonne') || window.location.hash.includes('yakihonne')) {
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking for Yakihonne iframe:', error);
        return false;
      }
    };
    
    // Auto-login if we're in a Yakihonne iframe with a delay to ensure everything is loaded
    if (isInYakihonneIframe()) {
      console.log('Detected Yakihonne iframe, will attempt auto-login after delay...');
      
      // Add delay to ensure everything is properly initialized
      setTimeout(async () => {
        console.log('Attempting auto-login for Yakihonne iframe now...');
        const { login } = useNostrAuth();
        try {
          const user = await login();
          console.log('Auto-login successful for Yakihonne iframe:', user.npub);
        } catch (error) {
          console.error('Auto-login failed for Yakihonne iframe:', error);
        }
      }, 2000); // 2 second delay before attempting login
    }
    
    // Initialize content zap tracking
    if (isWalletConnected.value) {
      console.log('Initializing content zap tracking...')
      setTimeout(() => {
        initializeZapTracking()
      }, 2000) // Small delay to ensure relay manager is fully initialized
    }
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
        
        initializeZapTracking()
        
        // Also initialize notes tracking
        console.log('Initializing notes tracking...')
        fetchUserNotes().catch(err => {
          console.error('Failed to fetch notes:', err)
        })
        
        // Initialize long-form content tracking
        console.log('Initializing long-form content tracking...')
        fetchUserLongFormContent().catch(err => {
          console.error('Failed to fetch long-form content:', err)
        })
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
                    <span class="text-amber-800 text-sm sm:text-base">No NWC wallet connected. Connect it now.</span>
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
                @click="showConnectionModal = false"
                class="text-gray-500 flex items-center justify-center flex items-center hover:text-gray-700 p-1 touch-target hover:bg-gray-100 rounded-full transition-all duration-200 hover:scale-110"
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
