<script setup>
import { ref, provide, watch, onMounted, nextTick, computed, onUnmounted, defineAsyncComponent } from 'vue'
import { IconAlertTriangle, IconX, IconWifi, IconWifiOff, IconRefresh } from '@iconify-prerendered/vue-tabler'
import Sidebar from './components/layout/Sidebar.vue'
import { useContentZaps } from './composables/content/useContentZaps.js'
import { generateAvatar } from './utils/profile/avatarGenerator.js'
import { profileService } from './services/nostr/ProfileService.js'
import { useUserZaps } from './composables/content/useUserZaps.js'
import TopBar from './components/layout/TopBar.vue'
import Dashboard from './pages/Dashboard.vue'
import { useNostrLongForm } from './composables/content/useNostrLongForm.js'
import { useNostrAuth } from './composables/auth/useNostrAuth.js'
import ZapFeed from './pages/ZapFeed.vue'
import Analytics from './pages/Analytics.vue'
import Content from './pages/Content.vue'
import Campaigns from './pages/Campaigns.vue'
import Notes from './pages/Notes.vue'
import Wallet from './pages/Wallet.vue'
import Settings from './pages/Settings.vue'
import NWCConnection from './components/wallet/NWCConnection.vue'
import ErrorBoundary from './components/shared/ErrorBoundary.vue'
import { useNostrConnections } from './composables/core/useNostrConnections.js'
import { storageService } from './services/StorageService.js'
import { useConnectionStatus } from './composables/core/useConnectionStatus.js'
import { useNotifications } from './composables/core/useNotifications.js'
import { nostrService } from './services/nostr/NostrService.js'
import { useNostrNotes } from './composables/content/useNostrNotes.js'
import { startRefreshCycle, stopRefreshCycle, setActiveGroup } from './utils/refreshCycle.js'
import { APP_HARD_TIMEOUT, RELAY_READY_TIMEOUT } from './utils/constants.js'
import AppLoader from './components/layout/AppLoader.vue'
import PwaInstallBanner from './components/pwa/PwaInstallBanner.vue'

// Lazy-loaded pages with chunk-load-failure recovery.
// After a deploy, stale index.html may reference old chunk hashes.
// Shows loading spinner while fetching, error UI with reload button on failure.
import ChunkLoadError from './components/shared/ChunkLoadError.vue'
import ChunkLoadSpinner from './components/shared/ChunkLoadSpinner.vue'

function lazyLoad(loader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: ChunkLoadSpinner,
    errorComponent: ChunkLoadError,
    delay: 150,       // show spinner after 150ms (avoids flash for fast loads)
    timeout: 30000,   // 30s before treating as error
    onError(error, retry, fail, attempts) {
      // Retry once silently for transient network issues
      if (attempts <= 1) {
        retry()
      } else {
        fail()  // show ChunkLoadError with reload button
      }
    }
  })
}

const ChatZaps = lazyLoad(() => import('./pages/ChatZaps.vue'))
const ContentUnlock = lazyLoad(() => import('./pages/ContentUnlock.vue'))
const CampaignView = lazyLoad(() => import('./pages/CampaignView.vue'))
const CampaignNotFound = lazyLoad(() => import('./pages/CampaignNotFound.vue'))
const Audience = lazyLoad(() => import('./pages/Audience.vue'))
const MiniPoS = lazyLoad(() => import('./pages/MiniPoS.vue'))
const Finances = lazyLoad(() => import('./pages/Finances.vue'))
const InvoiceShare = lazyLoad(() => import('./pages/InvoiceShare.vue'))
const Calendar = lazyLoad(() => import('./pages/Calendar.vue'))
const ContestResolver = lazyLoad(() => import('./pages/ContestResolver.vue'))
const Media = lazyLoad(() => import('./pages/Media.vue'))
const WelcomeModal = lazyLoad(() => import('./components/modals/WelcomeModal.vue'))
const HelpModal = lazyLoad(() => import('./components/modals/HelpModal.vue'))

// App loading gate
const appReady = ref(false)
const loadingPhase = ref('session')
const loadingTimedOut = ref(false)

// Read stored user for loading screen
const storedUserRaw = storageService.getRaw('nostrUser')
const hasStoredUser = !!storedUserRaw
const storedUserName = ref('')
const storedUserAvatar = ref('')
if (storedUserRaw) {
  try {
    const parsed = JSON.parse(storedUserRaw)
    storedUserName.value = parsed.profile?.display_name || parsed.profile?.name || ''
    storedUserAvatar.value = parsed.profile?.picture || ''
  } catch (e) { /* ignore parse errors */ }
}

// If no stored user, show app immediately (new user)
if (!hasStoredUser) {
  appReady.value = true
}

// Inline status for login errors (replaces browser alert dialogs)
const loginError = ref(null)
let _loginStatusTimer = null
const showLoginStatus = (message, type = 'error') => {
  clearTimeout(_loginStatusTimer)
  loginError.value = { message, type }
  _loginStatusTimer = setTimeout(() => { loginError.value = null }, 6000)
}

// UI state for dismissible banners
const showLargeDatasetBanner = ref(true)
let largeDatasetBannerTimeout = null

// Fetch author profile using ProfileService
const fetchAuthorProfile = async (pubkey, forceRefresh = false) => {
  const profile = await profileService.get(pubkey, forceRefresh ? { forceFresh: true } : {})
  if (!profile) {
    return {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateAvatar(pubkey),
      nip05: null,
      about: null
    }
  }
  return {
    pubkey: profile.pubkey,
    name: profile.name,
    picture: profile.picture || generateAvatar(pubkey),
    nip05: profile.nip05,
    about: profile.about
  }
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
const { isAuthenticated, login } = useNostrAuth()

// Relay connection health
const { status: relayStatus, isOffline: isRelayOffline, isConnecting: isRelayConnecting, connectionLabel: relayLabel } = useConnectionStatus()

// Use the notifications composable
const {
  handleConnectionSuccess: notifyConnectionSuccess,
  handleConnectionError: notifyConnectionError,
  notifications
} = useNotifications()

// Use the content zaps composable to get NIP-57 zaps
const { getAllContentZaps } = useContentZaps()

// Content zaps now self-initialize via watch(isAuthenticated)

// Use the user zaps composable for #p-based zap subscription
const { userZaps, isLoading: isUserZapsLoading } = useUserZaps()

// Initialize notes tracking early (composable self-registers with refresh cycle)
const { notes, isFetchingNotes } = useNostrNotes()
useNostrLongForm() // triggers composable initialization + refresh registration

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
const activeSettingsTab = ref('profile')
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

// Combine user zaps (#p subscription) with content zaps (#e subscriptions)
const combinedZapData = computed(() => {
  const uniqueZapsMap = new Map()

  const hasNostrConnection = isAuthenticated.value

  if (!hasNostrConnection) {
    return []
  }

  // Source 1: User zaps from #p subscription (primary — catches ALL zaps to user)
  userZaps.value.forEach(zap => {
    uniqueZapsMap.set(zap.id, zap)
  })

  // Source 2: Content zaps from #e subscriptions (may overlap, deduped by id)
  const contentZapsMap = getAllContentZaps.value
  Object.entries(contentZapsMap).forEach(([eventId, zapData]) => {
    zapData.zaps.forEach(zap => {
      if (uniqueZapsMap.has(zap.id)) return // already have from user zaps
      uniqueZapsMap.set(zap.id, {
        id: zap.id,
        amount: zap.amount,
        timestamp: zap.timestamp,
        sender: {
          name: zap.sender?.name || `User ${zap.zapperPubkey.substring(0, 8)}`,
          pubkey: zap.zapperPubkey,
          nip05: zap.sender?.nip05 || null,
          avatar: zap.sender?.picture || generateAvatar(zap.zapperPubkey),
          fetchProfile: () => fetchAuthorProfile(zap.zapperPubkey)
        },
        note: zap.message || 'Zap',
        noteType: 'original',
        client: 'nostr',
        source: 'nip57',
        eventId: eventId
      })
    })
  })

  return Array.from(uniqueZapsMap.values()).sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  )
})


// Add error handling for page loading
const pageLoadingError = ref('')
const isPageLoading = ref(false)

// Reactive profile store
const profileStore = ref(new Map())

// Profile fetching with batching using ProfileService
const fetchProfilesInBatches = async (pubkeys) => {
  const totalProfiles = pubkeys.length

  dataLoadingProgress.value.currentStep = `Loading profiles (0/${totalProfiles})`

  await profileService.batch(pubkeys)

  // After batch fetch, populate profileStore from shared cache
  let loaded = 0
  for (const pubkey of pubkeys) {
    const cached = profileService.getCached(pubkey)
    if (cached) {
      profileStore.value.set(pubkey, {
        pubkey: cached.pubkey,
        name: cached.name,
        picture: cached.picture || generateAvatar(pubkey),
        nip05: cached.nip05,
        about: cached.about
      })
    }
    loaded++
  }

  dataLoadingProgress.value.progress = 100
  dataLoadingProgress.value.loadedItems = loaded
  dataLoadingProgress.value.currentStep = `Loading profiles (${loaded}/${totalProfiles})`
}

// Watch for new zaps and fetch profiles with batching (debounced to avoid relay spam)
let _profileFetchTimer = null
watch(() => combinedZapData.value.length, () => {
  if (_profileFetchTimer) clearTimeout(_profileFetchTimer)
  _profileFetchTimer = setTimeout(async () => {
    const uniquePubkeys = new Set()

    combinedZapData.value.forEach(zap => {
      const pubkey = zap.sender?.pubkey || zap.sender?.zapperPubkey
      if (pubkey && !profileStore.value.has(pubkey)) {
        uniquePubkeys.add(pubkey)
      }
    })

    if (uniquePubkeys.size > 0) {
      await fetchProfilesInBatches(Array.from(uniquePubkeys))
    }
  }, 2000)
})

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
  calendar: Calendar,
  contest: ContestResolver,
  media: Media
}

// Check if current page is standalone
const isStandalonePage = computed(() => {
  return currentPage.value === 'invoice-share' || currentPage.value === 'campaign-view'
})

// Enhanced data refresh function with progressive loading and better error handling
const refreshZapData = async (force = false, retryCount = 0) => {
  if (!activeConnection.value && !force) {
    zapData.value = []
    return
  }

  if (isRefreshingData.value && retryCount === 0) {
    return
  }
  
  isRefreshingData.value = true
  const maxRetries = 3
  
  try {
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
    
    zapData.value = data
    
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
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000)
      
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
  // Check URL parameters for page navigation (do this early)
  const urlParams = new URLSearchParams(window.location.search)
  const pageParam = urlParams.get('page')
  if (pageParam && components[pageParam]) {
    currentPage.value = pageParam
  }

  // Standalone pages skip loading screen
  if (isStandalonePage.value) {
    appReady.value = true
  }

  // Check if this is first visit - show HelpModal
  const hasSeenHelp = storageService.getRaw('zaptracker_welcome_seen')
  if (!hasSeenHelp && !isAuthenticated.value) {
    showHelpModal.value = true
  }

  // Wait for relay manager to be initialized (useNostrAuth.initAuthAndRelays handles init with user relays)
  // Do NOT call initialize() here — it would steal the init with no user relays

  // Run loading sequence for returning users
  if (hasStoredUser && !appReady.value) {
    loadingPhase.value = 'session'
    await nextTick()
    await runLoadingSequence()
  }

  startPeriodicHealthCheck()
  startRefreshCycle()
})

// Periodic health check and data refresh
let healthCheckInterval = null

const startPeriodicHealthCheck = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
  }
  
  // Check every 5 minutes — only balance + reconnect (data refresh handled by refreshCycle)
  healthCheckInterval = setInterval(async () => {
    if (isWalletConnected.value && !isRefreshingData.value) {
      try {
        await getBalance()
      } catch (error) {
        console.warn('Periodic health check failed:', error)

        if (error.message?.includes('not initialized') || error.message?.includes('timeout')) {
          try {
            await autoReconnect()
          } catch (reconnectError) {
            console.error('Auto-reconnect failed:', reconnectError)
            connectionError.value = 'Connection lost. Please reconnect your wallet.'
          }
        }
      }
    }
  }, 300000) // 5 minutes
}

// Cleanup on unmount
onUnmounted(() => {
  clearTimeout(_loginStatusTimer)
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval)
  }
  stopRefreshCycle()
  window.removeEventListener('popstate', handlePopState)
})

// Watch for transaction notifications and auto-refresh
watch(() => notifications.value?.length, (newLen, oldLen) => {
  if (!newLen || !oldLen || newLen <= oldLen) return

  // Check if there are new payment-related notifications
  const hasNewPaymentNotification = notifications.value.some(notification =>
    (notification.type === 'zap_received_nwc' ||
     notification.type === 'zap_received_nostr' ||
     notification.type === 'payment_success' ||
     notification.type === 'payment_error') &&
    !notification.read
  )

  if (hasNewPaymentNotification && isWalletConnected.value) {
    setTimeout(() => {
      refreshZapData(true)
    }, 2000) // Small delay to ensure transaction is fully processed
  }
})

// Map page names to refresh cycle groups
// Pages without an explicit mapping default to 'dashboard' (global-only refresh)
const pageGroupMap = {
  dashboard: 'dashboard',
  notes: 'notes',
  content: 'content',
  'content-unlock': 'content',
  campaigns: 'campaigns',
  'campaign-view': 'campaigns',
  audience: 'audience',
  calendar: 'calendar',
  media: 'dashboard',
  settings: 'dashboard',
  notifications: 'dashboard'
}

// Enhanced page change function to handle tab navigation
const changePage = async (page, tab = null) => {
  if (!components[page]) {
    console.error('Invalid page:', page)
    pageLoadingError.value = `Page "${page}" not found`
    return
  }

  isPageLoading.value = true
  pageLoadingError.value = ''

  // Set active refresh group for the new page (default to 'dashboard' = global-only)
  setActiveGroup(pageGroupMap[page] || 'dashboard')

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
    window.history.pushState({ page }, '', url)

    // Give the component a moment to load
    await nextTick()

  } catch (error) {
    console.error('Page change error:', error)
    pageLoadingError.value = `Failed to load page: ${error.message}`
  } finally {
    isPageLoading.value = false
  }
}

// Browser back/forward button support
const handlePopState = (event) => {
  const page = event.state?.page
    || new URLSearchParams(window.location.search).get('page')
    || 'dashboard'
  if (components[page] && page !== currentPage.value) {
    currentPage.value = page
    setActiveGroup(pageGroupMap[page] || 'dashboard')
    isMobileMenuOpen.value = false
  }
}
window.addEventListener('popstate', handlePopState)

// Provide changePage function to child components
provide('changePage', changePage)

// Enhanced connection success handler with notifications
const handleConnectionSuccess = () => {
  showConnectionModal.value = false

  // Notify about successful connection
  if (activeConnection.value) {
    notifyConnectionSuccess(activeConnection.value.name)
  }

  // refreshZapData is triggered by the activeConnection watcher — no duplicate call needed
}

// Enhanced connection error handler with notifications
const handleConnectionError = (error) => {
  console.error('Connection error:', error)
  notifyConnectionError(error)
}

// Manual refresh function for user-triggered refreshes
const handleManualRefresh = async () => {
  if (!isWalletConnected.value) return
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

const showLoginError = (error) => {
  if (error.message.includes('No Nostr extension')) {
    showLoginStatus('No Nostr extension found. Please install a NIP-07 browser extension (Alby, nos2x, or Flamingo) and refresh this page.')
  } else {
    showLoginStatus('Login failed: ' + error.message)
  }
}

/**
 * Shared loading sequence used by both onMounted (boot) and post-login.
 * Phases: relays → profile → syncing (waits for actual data) → ready.
 */
const runLoadingSequence = async () => {
  appReady.value = false
  loadingTimedOut.value = false
  const timeout = setTimeout(() => {
    loadingTimedOut.value = true
    appReady.value = true
  }, APP_HARD_TIMEOUT)

  // Phase: relays
  loadingPhase.value = 'relays'
  try {
    await Promise.race([
      nostrService.ready(),
      new Promise(r => setTimeout(r, RELAY_READY_TIMEOUT))
    ])
  } catch (e) { /* continue */ }

  // Phase: profile
  loadingPhase.value = 'profile'
  await new Promise(r => setTimeout(r, 800))

  // Phase: syncing — wait for composables to finish their initial fetch
  loadingPhase.value = 'syncing'
  await Promise.race([
    new Promise(resolve => {
      // Track whether each loader has started (gone true at least once).
      // isFetchingNotes starts false, awaits relay ready, then flips true.
      // We must not resolve before it even starts.
      let zapsStarted = isUserZapsLoading.value
      let notesStarted = isFetchingNotes.value

      const isDone = () => {
        // Both must have started and finished, OR have data already
        const zapsReady = zapsStarted && !isUserZapsLoading.value
        const notesReady = notesStarted && !isFetchingNotes.value
        const hasData = notes.value.length > 0 || userZaps.value.length > 0
        return (zapsReady && notesReady) || hasData
      }

      if (isDone()) { resolve(); return }

      const unwatch = watch(
        () => ({
          zapsLoading: isUserZapsLoading.value,
          notesLoading: isFetchingNotes.value,
          dataLen: notes.value.length + userZaps.value.length
        }),
        ({ zapsLoading, notesLoading }) => {
          if (zapsLoading) zapsStarted = true
          if (notesLoading) notesStarted = true
          if (isDone()) { unwatch(); resolve() }
        }
      )
    }),
    // Safety net: don't block forever (new user with no data, or slow relays)
    new Promise(r => setTimeout(r, 12000))
  ])

  // Phase: ready
  loadingPhase.value = 'ready'
  await new Promise(r => setTimeout(r, 400))

  appReady.value = true
  clearTimeout(timeout)
}

const runPostLoginLoader = () => runLoadingSequence()

const handleTriggerLogin = async () => {
  try {
    // Re-read stored user info for loader greeting (login() writes to localStorage)
    loadingPhase.value = 'session'
    await login()

    // After login, read the freshly stored user for the loader display
    const raw = storageService.getRaw('nostrUser')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        storedUserName.value = parsed.profile?.display_name || parsed.profile?.name || ''
        storedUserAvatar.value = parsed.profile?.picture || ''
      } catch (e) { /* ignore */ }
    }

    await runPostLoginLoader()
  } catch (error) {
    showLoginError(error)
  }
}

const handleTriggerViewOnly = async () => {
  // View-only mode removed - now requires extension
  await handleTriggerLogin()
}

// Onboarding checklist handlers
const handleChecklistTaskAction = async (action) => {
  switch (action) {
    case 'connect-nostr':
      await handleTriggerLogin()
      break
    case 'setup-profile':
      changePage('settings', 'profile')
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
  <!-- Loading screen -->
  <Transition name="loader-fade">
    <AppLoader
      v-if="!appReady"
      :phase="loadingPhase"
      :user-name="storedUserName"
      :user-avatar="storedUserAvatar"
      :timed-out="loadingTimedOut"
      :zap-count="userZaps.length"
      :note-count="notes.length"
      :zaps-loading="isUserZapsLoading"
      :notes-loading="isFetchingNotes"
    />
  </Transition>

  <!-- Standalone Invoice Share Page -->
  <div v-if="appReady && isStandalonePage" class="min-h-screen bg-gradient-to-br from-orange-25 via-amber-25 to-yellow-25">
    <component
      :is="components[currentPage]"
      :key="currentPage"
      @change-page="changePage"
    />
  </div>

  <!-- Main Application Layout -->
  <div v-else-if="appReady" :class="[
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
      'fixed top-0 left-0 h-screen w-80 lg:w-72 overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:z-30', isWritingMode ? 'lg:-translate-x-full' : '',
      isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
    ]">
      <Sidebar
        @change-page="changePage"
        @show-help="handleShowHelp"
      />
    </div>
    
    <!-- Main Content Area -->
    <div :class="['flex-1 flex flex-col h-screen overflow-hidden', isWritingMode ? 'lg:ml-0' : 'lg:ml-72']">
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
        <!-- Offline Banner — prominent, above all page content -->
        <transition name="slide-down">
          <div v-if="isRelayOffline && isAuthenticated" class="mx-3 sm:mx-4 lg:mx-6 mt-3 sm:mt-4 lg:mt-6 mb-0">
            <div class="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center space-x-3">
                  <div class="p-2 bg-red-100 rounded-full">
                    <IconWifiOff class="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <span class="text-red-800 text-sm font-medium">No relay connections</span>
                    <p class="text-red-600 text-xs">Showing cached data. Live updates paused.</p>
                  </div>
                </div>
                <button
                  @click="changePage('settings')"
                  class="text-xs font-medium text-red-700 hover:text-red-900 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                >
                  Check Settings
                </button>
              </div>
            </div>
          </div>
        </transition>

        <!-- Degraded Connection Banner -->
        <transition name="slide-down">
          <div v-if="relayStatus === 'degraded' && isAuthenticated && !isRelayOffline" class="mx-3 sm:mx-4 lg:mx-6 mt-3 sm:mt-4 lg:mt-6 mb-0">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <div class="flex items-center space-x-2">
                <IconWifi class="w-4 h-4 text-yellow-600" />
                <span class="text-yellow-800 text-xs">Degraded connection — {{ relayLabel }} relays online</span>
              </div>
            </div>
          </div>
        </transition>

        <!-- Login Error Banner -->
        <transition name="slide-down">
          <div v-if="loginError" class="mx-3 sm:mx-4 lg:mx-6 mt-3 sm:mt-4 lg:mt-6 mb-0" role="alert" aria-live="assertive">
            <div class="bg-red-50 text-red-800 border border-red-200 rounded-lg px-4 py-3 text-sm font-medium">
              {{ loginError.message }}
            </div>
          </div>
        </transition>

        <div class="p-3 sm:p-4 lg:p-6">
          <!-- Connection Status Bar (legacy, commented out) -->
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
                aria-label="Close"
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

    <!-- PWA Install Banner -->
    <PwaInstallBanner />
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

/* Loader fade-out transition */
.loader-fade-leave-active {
  transition: opacity 0.4s ease;
}

.loader-fade-leave-to {
  opacity: 0;
}
</style>
