<script setup>
import { ref, provide, watch, onMounted, nextTick,computed, onUnmounted } from 'vue'
import { IconAlertTriangle, IconX } from '@iconify-prerendered/vue-tabler'
import Sidebar from './components/layout/Sidebar.vue'
import { IconTarget } from '@iconify-prerendered/vue-tabler'
import { useContentZaps } from './composables/content/useContentZaps.js'
import { generateAvatar } from './utils/profile/avatarGenerator.js'
import TopBar from './components/layout/TopBar.vue'
import Dashboard from './pages/Dashboard.vue'
import { useNostrLongForm } from './composables/content/useNostrLongForm.js'
import { useNostrAuth } from './composables/auth/useNostrAuth.js'
import ZapFeed from './pages/ZapFeed.vue'
import Analytics from './pages/Analytics.vue'
import ChatZaps from './pages/ChatZaps.vue'
import Content from './pages/Content.vue'
import ContentUnlock from './pages/ContentUnlock.vue'
import Campaigns from './pages/Campaigns.vue'
import CampaignView from './pages/CampaignView.vue'
import CampaignNotFound from './pages/CampaignNotFound.vue'
import Audience from './pages/Audience.vue'
import MiniPoS from './pages/MiniPoS.vue'
import Wallet from './pages/Wallet.vue'
import Finances from './pages/Finances.vue'
import Settings from './pages/Settings.vue'
import InvoiceShare from './pages/InvoiceShare.vue'
import Notes from './pages/Notes.vue'
import NWCConnection from './components/wallet/NWCConnection.vue'
import ErrorBoundary from './components/shared/ErrorBoundary.vue'
import { useNostrConnections } from './composables/core/useNostrConnections.js'
import { useNotifications } from './composables/core/useNotifications.js'
import { nostrRelayManager } from './utils/network/nostrRelayManager.js'
import { useNostrNotes } from './composables/content/useNostrNotes.js'
import Calendar from './pages/Calendar.vue'
import WelcomeModal from './components/modals/WelcomeModal.vue'
import HelpModal from './components/modals/HelpModal.vue'


// UI state for dismissible banners
const showLargeDatasetBanner = ref(true)
let largeDatasetBannerTimeout = null

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
        picture: profile?.picture || generateAvatar(pubkey),
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
        picture: generateAvatar(pubkey),
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

// Use the Nostr auth composable
const { isAuthenticated } = useNostrAuth()

// Use the notifications composable
const {
  handleConnectionSuccess: notifyConnectionSuccess,
  handleConnectionError: notifyConnectionError,
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
const showWelcomeModal = ref(false)
const showHelpModal = ref(false)
const isMobileMenuOpen = ref(false)
const isRefreshingData = ref(false)
const dataLoadingProgress = ref({
  isLoading: false,
  currentStep: '',
  progress: 0,
  totalItems: 0,
  loadedItems: 0,
  estimatedTimeRemaining: 0
})
const isWritingMode = ref(false)

// Combine NWC payments (zapData) with NIP-57 zaps based on connection status
const combinedZapData = computed(() => {
  // Create a map to store unique zaps by payment hash/id
  const uniqueZapsMap = new Map()
  
  // Check connection statuses
  const hasNWCConnection = isWalletConnected.value
  const hasNostrConnection = isAuthenticated.value
  
  // If neither connection is active, return empty array
  if (!hasNWCConnection && !hasNostrConnection) {
    return []
  }
  
  // Process NIP-57 zaps only if Nostr account is connected
  if (hasNostrConnection) {
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
            avatar: zap.sender?.picture || generateAvatar(zap.zapperPubkey),
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
  }
  
  // Process NWC payments only if NWC wallet is connected
  // if (hasNWCConnection) {
  //   zapData.value.forEach(zap => {
  //     // If both connections are active, only add NWC payment if we don't already have a NIP-57 zap with the same ID
  //     // If only NWC is connected, add all NWC payments
  //     if (!hasNostrConnection || !uniqueZapsMap.has(zap.id)) {
  //       uniqueZapsMap.set(zap.id, {
  //         ...zap,
  //         source: 'nwc', // Explicitly mark as NWC payment
  //         eventId: null, // NWC payments don't have associated event IDs
  //         // Add profile fetching capability for NWC payments if they have sender pubkey
  //         sender: zap.sender?.pubkey ? {
  //           ...zap.sender,
  //           fetchProfile: () => fetchAuthorProfile(zap.sender.pubkey)
  //         } : zap.sender
  //       })
  //     } else if (hasNostrConnection && uniqueZapsMap.has(zap.id)) {
  //       console.log(`Skipping duplicate NWC payment with id ${zap.id?.substring(0, 16)}... (already have NIP-57 zap)`)
  //     }
  //   })
  // }

  // Convert map values to array and sort by timestamp
  return Array.from(uniqueZapsMap.values()).sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  )
})


// Add error handling for page loading
const pageLoadingError = ref('')
const isPageLoading = ref(false)

// Reactive profile store
const profileStore = ref(new Map())

// Enhanced profile fetching with batching and progress tracking
const fetchProfilesInBatches = async (pubkeys, batchSize = 10) => {
  const batches = []
  for (let i = 0; i < pubkeys.length; i += batchSize) {
    batches.push(pubkeys.slice(i, i + batchSize))
  }
  
  let totalProcessed = 0
  const totalProfiles = pubkeys.length
  
  for (const batch of batches) {
    const batchPromises = batch.map(pubkey => 
      fetchAuthorProfile(pubkey).then(profile => {
        profileStore.value.set(pubkey, profile)
        totalProcessed++
        
        // Update progress
        dataLoadingProgress.value.progress = Math.round((totalProcessed / totalProfiles) * 100)
        dataLoadingProgress.value.loadedItems = totalProcessed
        dataLoadingProgress.value.currentStep = `Loading profiles (${totalProcessed}/${totalProfiles})`
        
        return profile
      }).catch(error => {
        console.warn('Failed to fetch profile for pubkey:', pubkey, error)
        totalProcessed++
        
        // Update progress even on error
        dataLoadingProgress.value.progress = Math.round((totalProcessed / totalProfiles) * 100)
        dataLoadingProgress.value.loadedItems = totalProcessed
        dataLoadingProgress.value.currentStep = `Loading profiles (${totalProcessed}/${totalProfiles})`
        
        return null
      })
    )
    
    await Promise.allSettled(batchPromises)
    
    // Small delay between batches to prevent overwhelming the relays
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

// Watch for new zaps and fetch profiles with batching
watch(combinedZapData, async (newZaps) => {
  const uniquePubkeys = new Set()
  
  newZaps.forEach(zap => {
    const pubkey = zap.sender?.pubkey || zap.sender?.zapperPubkey
    if (pubkey && !profileStore.value.has(pubkey)) {
      uniquePubkeys.add(pubkey)
    }
  })
  
  if (uniquePubkeys.size > 0) {
    console.log(`📊 Fetching ${uniquePubkeys.size} profiles in batches...`)
    
    // Only show profile loading progress if we're not already loading main data
    if (!isRefreshingData.value) {
      dataLoadingProgress.value.isLoading = true
      dataLoadingProgress.value.totalItems = uniquePubkeys.size
      dataLoadingProgress.value.currentStep = 'Preparing profile data...'
    }
    
    await fetchProfilesInBatches(Array.from(uniquePubkeys))
    
    // Only clear profile loading if we're not loading main data
    if (!isRefreshingData.value) {
      dataLoadingProgress.value.isLoading = false
    }
    
    console.log(`✅ Profile fetching completed: ${uniquePubkeys.size} profiles loaded`)
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

// Auto-show and auto-hide logic for the large dataset banner
const scheduleLargeDatasetBannerHide = () => {
  if (largeDatasetBannerTimeout) {
    clearTimeout(largeDatasetBannerTimeout)
    largeDatasetBannerTimeout = null
  }
  largeDatasetBannerTimeout = setTimeout(() => {
    showLargeDatasetBanner.value = false
  }, 5000)
}

watch(
  () => ({
    len: enhancedCombinedZapData.value.filter(zap => zap.eventId).length,
    loading: dataLoadingProgress.value.isLoading
  }),
  ({ len, loading }) => {
    if (len > 50 && !loading) {
      showLargeDatasetBanner.value = true
      scheduleLargeDatasetBannerHide()
    }
  },
  { immediate: true }
)

const dismissLargeDatasetBanner = () => {
  showLargeDatasetBanner.value = false
  if (largeDatasetBannerTimeout) {
    clearTimeout(largeDatasetBannerTimeout)
    largeDatasetBannerTimeout = null
  }
}

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
provide('isAuthenticated', isAuthenticated)
provide('setActiveConnection', setActiveConnection)
provide('clearActiveConnection', clearActiveConnection)

// Provide profile management
provide('profileStore', profileStore)
provide('fetchAuthorProfile', fetchAuthorProfile)
provide('refreshProfile', refreshProfile)

const components = {
  dashboard: Dashboard,
  'lightning-explorer': Dashboard,
  'zap-feed': ZapFeed,
  analytics: Analytics,
  'chat-zaps': ChatZaps,
  content: Content,
  'content-unlock': ContentUnlock,
  'campaigns': Campaigns,
  'campaign-view': CampaignView,
  'campaign-not-found': CampaignNotFound,
  'audience': Audience,
  'mini-pos': MiniPoS,
  wallet: Wallet,
  finances: Finances,
  settings: Settings,
  'invoice-share': InvoiceShare,
  notes: Notes,
  calendar: Calendar
}

// Check if current page is standalone
const isStandalonePage = computed(() => {
  return currentPage.value === 'invoice-share' || currentPage.value === 'campaign-view'
})

// Enhanced data refresh function with progressive loading and better error handling
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
    
    // Update progress tracking
    dataLoadingProgress.value.isLoading = true
    dataLoadingProgress.value.currentStep = 'Loading zap data from wallet...'
    dataLoadingProgress.value.progress = 0
    
    // Show loading progress for large datasets
    const startTime = Date.now()
    const data = await loadZapData()
    const loadTime = Date.now() - startTime
    
    // Update progress
    dataLoadingProgress.value.progress = 50
    dataLoadingProgress.value.currentStep = `Loaded ${data.length} zaps, processing data...`
    
    // Log performance metrics for large datasets
    if (data.length > 100) {
      console.log(`📊 Performance: Loaded ${data.length} zaps in ${loadTime}ms (${Math.round(data.length / (loadTime / 1000))} zaps/sec)`)
    }
    
    zapData.value = data
    console.log('Zap data refreshed successfully:', data.length, 'zaps')
    
    // Update final progress
    dataLoadingProgress.value.progress = 100
    dataLoadingProgress.value.currentStep = `Data loaded successfully (${data.length} zaps)`
    
    // Clear any connection errors on successful refresh
    if (connectionError.value) {
      connectionError.value = ''
    }
    
    // Clear loading state after a short delay to show completion
    setTimeout(() => {
      dataLoadingProgress.value.isLoading = false
    }, 1000)
    
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
    
    // Set connection error for display with more specific error messages
    if (error.message.includes('timeout')) {
      connectionError.value = 'Request timed out. The network may be slow or the dataset is large. Please try again.'
    } else if (error.message.includes('network')) {
      connectionError.value = 'Network error. Please check your connection and try again.'
    } else if (error.message.includes('relay')) {
      connectionError.value = 'Relay connection failed. Please try reconnecting your wallet.'
    } else {
      connectionError.value = `Failed to refresh data: ${error.message}`
    }
    
    // Don't clear existing data on error, just log it
    if (zapData.value.length === 0) {
      zapData.value = []
    }
  } finally {
    // Only clear loading state if this is not a retry
    if (retryCount === 0) {
      isRefreshingData.value = false
      dataLoadingProgress.value.isLoading = false
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
  console.log('🚀 App mounted, initializing ZapTracker...')

  // Check if this is first visit - show HelpModal
  const hasSeenHelp = localStorage.getItem('zaptracker_welcome_seen')
  if (!hasSeenHelp && !isAuthenticated.value) {
    console.log('👋 First visit detected, showing HelpModal...')
    showHelpModal.value = true
  }

  // Check nostr-login availability
  console.log('🔍 Checking nostr-login availability...')
  const nostrLoginScript = document.querySelector('script[src*="nostr-login"]')
  if (nostrLoginScript) {
    console.log('✅ Nostr-login script found in DOM')
  } else {
    console.error('❌ Nostr-login script NOT found in DOM - login will not work!')
  }

  // Check if window.nostr is available (could be from extension or nostr-login)
  if (window.nostr) {
    console.log('✅ window.nostr is available')
    console.log('   - Has getPublicKey:', typeof window.nostr.getPublicKey === 'function')
    console.log('   - Has signEvent:', typeof window.nostr.signEvent === 'function')
  } else {
    console.log('ℹ️ window.nostr not available yet (normal if no extension installed)')
  }

  // Check authentication state
  console.log('🔐 Authentication status:', {
    isAuthenticated: isAuthenticated.value,
    hasStoredUser: !!localStorage.getItem('nostrUser'),
    isWalletConnected: isWalletConnected.value
  })

  try {
    // Initialize the relay manager first
    await nostrRelayManager.initialize()
    console.log('✅ Relay manager initialized successfully')

    // Initialize content zap tracking
    if (isWalletConnected.value) {
      console.log('💰 Initializing content zap tracking...')
      setTimeout(() => {
        initializeZapTracking()
      }, 2000)
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
  // COMMENTED OUT: Auto-showing connection modal was too aggressive
  // Users can still connect via the Wallet page's "Connect Wallet" button or Settings
  // if (!isWalletConnected.value && !isStandalonePage.value) {
  //   console.log('💳 No wallet connected, showing connection modal')
  //   showConnectionModal.value = true
  // } else if (isWalletConnected.value) {
  if (isWalletConnected.value) {
    console.log('💳 Wallet already connected, refreshing data...')
    setTimeout(() => {
      refreshZapData(true)
    }, 1000)
  }

  // Start periodic health check and data refresh
  startPeriodicHealthCheck()

  console.log('✅ ZapTracker initialization complete')
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
provide('dataLoadingProgress', dataLoadingProgress)

// Watch for connection errors and notify
watch(connectionError, (error) => {
  if (error) {
    handleConnectionError(new Error(error))
  }
})

// Provide error handling to child components
provide('pageLoadingError', pageLoadingError)
provide('isPageLoading', isPageLoading)

// Handle writing mode changes from Content page
const handleWritingModeChange = (writingMode) => {
  isWritingMode.value = writingMode
}

// Welcome modal handlers
const handleWelcomeClose = () => {
  showWelcomeModal.value = false
}

// Help modal handlers
const handleShowHelp = () => {
  showHelpModal.value = true
}

const handleHelpClose = () => {
  showHelpModal.value = false
}

const handleTriggerLogin = () => {
  console.log('🚀 Triggering nostr-login widget from App...')
  document.dispatchEvent(new Event('nlLaunch'))
}

const handleTriggerViewOnly = () => {
  console.log('👁️ Triggering view-only mode from App...')
  // Trigger nostr-login widget with readonly option
  document.dispatchEvent(new Event('nlLaunch'))
}

// Onboarding checklist handlers
const handleChecklistTaskAction = (action) => {
  switch (action) {
    case 'connect-nostr':
      // Trigger nostr-login widget
      console.log('🚀 Triggering nostr-login widget from checklist...')
      document.dispatchEvent(new Event('nlLaunch'))
      break
    case 'setup-profile':
      changePage('settings', 'nostr')
      break
    case 'connect-wallet':
      changePage('wallet')
      break
    case 'create-content':
      changePage('content')
      break
    case 'create-campaign':
      changePage('campaigns')
      break
  }
}
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
  <div v-else :class="[
    'h-screen bg-gradient-to-br from-orange-25 via-amber-25 to-yellow-25 flex overflow-hidden',
    isWritingMode ? 'writing-mode' : ''
  ]">
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
      'fixed top-0 left-0 h-screen w-64 overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:z-30', isWritingMode ? 'lg:-translate-x-full' : '',
      isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
    ]">
      <Sidebar
        @change-page="changePage"
        @show-help="handleShowHelp"
      />
    </div>
    
    <!-- Main Content Area -->
    <div :class="['flex-1 flex flex-col h-screen overflow-hidden', isWritingMode ? 'lg:ml-0' : 'lg:ml-64']">
      <!-- Fixed Top Bar -->
      <header :class="['sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-orange-100/50', isWritingMode ? 'lg:hidden' : '']">
        <TopBar
          @show-connection="showConnectionModal = true"
          @toggle-mobile-menu="isMobileMenuOpen = !isMobileMenuOpen"
          @change-page="changePage"
          @show-help="handleShowHelp"
        />
      </header>
      
      <!-- Scrollable Main Content -->
      <main :class="['flex-1 overflow-y-auto scrollbar-thin', isWritingMode ? 'p-0' : 'p-3 sm:p-4 lg:p-6']">
        <div class="p-3 sm:p-4 lg:p-6">
          <!-- Connection Status Bar -->
        <!--  <transition name="slide-down">
            <div v-if="!isWalletConnected && currentPage === 'wallet'" class="mb-4 lg:mb-6">
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
          </transition> -->
          
          <!-- Loading State -->
          <transition name="slide-down">
            <div v-if="isLoadingConnection || isRefreshingData || dataLoadingProgress.isLoading" class="mb-4 lg:mb-6">
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                <div class="flex items-center space-x-2 mb-2">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span class="text-blue-800 text-sm sm:text-base">
                    {{ isLoadingConnection ? 'Connecting to wallet...' : 
                       dataLoadingProgress.isLoading ? dataLoadingProgress.currentStep : 'Refreshing data...' }}
                  </span>
                </div>
                
                <!-- Progress bar for data loading -->
                <div v-if="dataLoadingProgress.isLoading && dataLoadingProgress.totalItems > 0" class="mt-2">
                  <div class="flex justify-between text-xs text-blue-700 mb-1">
                    <span>{{ dataLoadingProgress.currentStep }}</span>
                    <span>{{ dataLoadingProgress.loadedItems }}/{{ dataLoadingProgress.totalItems }}</span>
                  </div>
                  <div class="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      class="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      :style="{ width: dataLoadingProgress.progress + '%' }"
                    ></div>
                  </div>
                </div>
                
                <!-- Performance info for large datasets -->
                <div v-if="dataLoadingProgress.isLoading && dataLoadingProgress.totalItems > 50" class="mt-2 text-xs text-blue-600">
                  <span class="inline-flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                    Large dataset detected - this may take a moment
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
          
          <!-- Data Summary for Large Datasets -->
          <transition name="slide-down">
            <div v-if="enhancedCombinedZapData.length > 50 && !dataLoadingProgress.isLoading && showLargeDatasetBanner" class="mb-4 lg:mb-6">
              <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div class="flex items-center space-x-2">
                    <div class="p-2 bg-green-100 rounded-full">
                      <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                      </svg>
                    </div>
                    <div>
                      <span class="text-green-800 text-sm sm:text-base font-medium">
                        Large dataset loaded successfully
                      </span>
                      <p class="text-green-700 text-xs">
                        {{ enhancedCombinedZapData.filter(zap => zap.eventId).length }} zaps • {{ profileStore.size }} profiles • Ready for analysis
                      </p>
                    </div>
                  </div>
                  <div class="text-xs text-green-600 flex items-center space-x-3">
                    <span class="inline-flex items-center">
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"></path>
                      </svg>
                      Optimized for large datasets
                    </span>
                    <button @click="dismissLargeDatasetBanner" class="text-green-700 hover:text-green-900 p-1 rounded-md hover:bg-green-100 transition-colors" aria-label="Dismiss">
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                      </svg>
                    </button>
                  </div>
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
                @writing-mode-change="handleWritingModeChange"
                @trigger-login="handleTriggerLogin"
                @show-help="handleShowHelp"
              />
            </ErrorBoundary>
          </transition>
        </div>
      </main>
    </div>

    <!-- Welcome Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <WelcomeModal
        v-if="showWelcomeModal"
        @close="handleWelcomeClose"
      />
    </Teleport>

    <!-- Help Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <HelpModal
        v-if="showHelpModal"
        :auto-show="false"
        @close="handleHelpClose"
        @trigger-login="handleTriggerLogin"
        @trigger-view-only="handleTriggerViewOnly"
      />
    </Teleport>

    <!-- Connection Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showConnectionModal && currentPage === 'wallet'" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
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

<style scoped>
/* Writing mode styles */
.writing-mode {
  background: #fafafa !important;
}

.writing-mode .lg\:ml-0 {
  margin-left: 0 !important;
}

.writing-mode .lg\:-translate-x-full {
  transform: translateX(-100%) !important;
}

.writing-mode .lg\:hidden {
  display: none !important;
}

@media (min-width: 1024px) {
  .writing-mode {
    background: #fafafa !important;
  }
}
</style>
