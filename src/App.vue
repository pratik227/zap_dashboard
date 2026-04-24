<script setup>
import { ref, provide, watch, onMounted, nextTick, computed, onUnmounted, defineAsyncComponent } from 'vue'
import { IconAlertTriangle, IconX, IconRefresh, IconExternalLink } from '@iconify-prerendered/vue-tabler'
import Sidebar from './components/layout/Sidebar.vue'
import { useContentZaps } from './composables/content/useContentZaps.js'
import { generateAvatar } from './utils/profile/avatarGenerator.js'
import { profileService } from './services/nostr/ProfileService.js'
import { getUserFriendlyError } from './services/nostr/errors.js'
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
const SocialDesk = lazyLoad(() => import('./pages/SocialDesk.vue'))
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
const { isAuthenticated, isLoading: isLoginLoading, currentUser, userProfile, login } = useNostrAuth()

// Welcome toast after successful login
const welcomeToast = ref(null)
let _welcomeTimer = null
watch(isAuthenticated, (authed, wasAuthed) => {
  if (authed && !wasAuthed) {
    const name = userProfile.value?.name || userProfile.value?.display_name || ''
    const avatar = userProfile.value?.picture || ''
    welcomeToast.value = { name, avatar }
    clearTimeout(_welcomeTimer)
    _welcomeTimer = setTimeout(() => { welcomeToast.value = null }, 3500)
  }
})

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
  media: Media,
  'social-desk': SocialDesk
}

// Check if current page is standalone
const isStandalonePage = computed(() => {
  return currentPage.value === 'invoice-share' || currentPage.value === 'campaign-view'
})

const isFullscreenPage = computed(() => currentPage.value === 'social-desk')

const useImmersiveLayout = computed(() =>
  isWritingMode.value || isFullscreenPage.value
)

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
      connectionError.value = getUserFriendlyError(error)
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
  clearTimeout(_welcomeTimer)
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
const changePage = async (page, tab = null, options = {}) => {
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
    const query = options.query || {}
    const managedQueryKeys = ['eventId']
    managedQueryKeys.forEach((key) => {
      if (query[key] !== undefined && query[key] !== null && query[key] !== '') {
        url.searchParams.set(key, query[key])
      } else {
        url.searchParams.delete(key)
      }
    })
    window.history.pushState({ page }, '', url)

    // Give the component a moment to load
    await nextTick()

  } catch (error) {
    console.error('Page change error:', error)
    pageLoadingError.value = getUserFriendlyError(error)
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

// ── No-extension modal ────────────────────────────────────────
const showNoExtensionModal = ref(false)

const detectedBrowser = computed(() => {
  if (typeof navigator === 'undefined') return { name: 'Chrome', store: 'chrome' }
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return { name: 'Firefox', store: 'firefox' }
  if (ua.includes('Edg/')) return { name: 'Edge', store: 'chrome' }
  if (ua.includes('OPR') || ua.includes('Opera')) return { name: 'Opera', store: 'chrome' }
  if (ua.includes('Brave')) return { name: 'Brave', store: 'chrome' }
  if (ua.includes('Chrome')) return { name: 'Chrome', store: 'chrome' }
  if (ua.includes('Safari')) return { name: 'Safari', store: 'unsupported' }
  return { name: 'your browser', store: 'chrome' }
})

const jumpInstallUrl = computed(() => {
  if (detectedBrowser.value.store === 'firefox') {
    return 'https://addons.mozilla.org/en-US/firefox/addon/aspect-extension/'
  }
  return 'https://chromewebstore.google.com/detail/aspect-nostr-signer/jliekadcmakmcjbehgoagipgkbpohjfg'
})

// ── Login overlay ─────────────────────────────────────────────
const showLoginOverlay = ref(false)
const loginOverlayStatus = ref('Connecting...')

const showLoginError = (err) => {
  showLoginOverlay.value = false
  if (err.message?.includes('No Nostr extension')) {
    showNoExtensionModal.value = true
  } else {
    showLoginStatus(getUserFriendlyError(err))
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
    showLoginOverlay.value = true
    loginOverlayStatus.value = 'Looking for Nostr extension...'

    // Re-read stored user info for loader greeting (login() writes to localStorage)
    loadingPhase.value = 'session'
    loginOverlayStatus.value = 'Connecting to your extension...'
    await login()
    loginOverlayStatus.value = 'Loading your profile...'

    // After login, read the freshly stored user for the loader display
    const raw = storageService.getRaw('nostrUser')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        storedUserName.value = parsed.profile?.display_name || parsed.profile?.name || ''
        storedUserAvatar.value = parsed.profile?.picture || ''
      } catch (e) { /* ignore */ }
    }

    showLoginOverlay.value = false
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
  <div v-if="appReady && isStandalonePage" class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
    <component
      :is="components[currentPage]"
      :key="currentPage"
      @change-page="changePage"
    />
  </div>

  <!-- Main Application Layout -->
  <div v-else-if="appReady" :class="[
    'h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex overflow-hidden',
    isWritingMode ? 'writing-mode' : ''
  ]">
    <!-- Mobile Menu Overlay -->
    <transition name="overlay-fade">
      <div 
        v-if="isMobileMenuOpen" 
        :class="[
          'fixed inset-0 bg-black/50 z-40',
          isFullscreenPage ? '' : 'lg:hidden'
        ]"
        @click="isMobileMenuOpen = false"
      ></div>
    </transition>
    
    <!-- Sidebar - Mobile Drawer / Desktop Fixed -->
    <div :class="[
      'fixed top-0 left-0 h-screen w-80 lg:w-72 overflow-y-auto z-50 transform transition-transform duration-300 ease-in-out',
      isFullscreenPage ? '' : (isWritingMode ? 'lg:-translate-x-full' : 'lg:translate-x-0 lg:z-30'),
      isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
    ]">
      <Sidebar
        @change-page="changePage"
        @show-help="handleShowHelp"
      />
    </div>
    
    <!-- Main Content Area -->
    <div :class="['flex-1 flex flex-col h-screen overflow-hidden', useImmersiveLayout ? 'lg:ml-0' : 'lg:ml-72']">
      <!-- Fixed Top Bar -->
      <header :class="['sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-orange-100/50', isWritingMode || isFullscreenPage ? 'hidden' : '']">
        <TopBar
          @show-connection="showConnectionModal = true"
          @toggle-mobile-menu="isMobileMenuOpen = !isMobileMenuOpen"
          @change-page="changePage"
          @show-help="handleShowHelp"
        />
      </header>
      
      <!-- Main Content -->
      <main :class="[
        'relative flex-1 min-h-0',
        isFullscreenPage ? 'overflow-hidden' : 'overflow-y-auto scrollbar-thin'
      ]">
        <transition name="slide-down">
          <div
            v-if="loginError"
            :class="[
              isFullscreenPage
                ? 'pointer-events-none absolute inset-x-3 top-3 z-30 sm:inset-x-4 sm:top-4 lg:inset-x-6'
                : 'mb-0'
            ]"
            role="alert"
            aria-live="assertive"
          >
            <div class="bg-red-50 text-red-800 border border-red-200 rounded-lg px-4 py-3 text-sm font-medium shadow-sm">
              {{ loginError.message }}
            </div>
          </div>
        </transition>

        <transition name="slide-down">
          <div
            v-if="welcomeToast"
            :class="[
              isFullscreenPage
                ? 'pointer-events-none absolute inset-x-3 top-3 z-30 sm:inset-x-4 sm:top-4 lg:inset-x-6'
                : 'mb-0'
            ]"
            role="status"
            aria-live="polite"
          >
            <div class="bg-white border border-green-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
              <div class="w-8 h-8 rounded-full overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
                <img v-if="welcomeToast.avatar" :src="welcomeToast.avatar" alt="" class="w-full h-full object-cover" @error="$event.target.style.display='none'" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900">
                  Signed in{{ welcomeToast.name ? ` as ${welcomeToast.name}` : '' }}
                </p>
              </div>
              <div class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse"></div>
            </div>
          </div>
        </transition>

        <div :class="[isFullscreenPage ? 'flex h-full min-h-0 flex-col' : 'p-3 sm:p-4 lg:p-6']">
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
          
          <!-- Page Content with Transition -->
          <transition name="page-fade" mode="out-in">
            <ErrorBoundary v-if="!pageLoadingError && !isPageLoading">
              <component
                :is="components[currentPage]"
                :key="currentPage"
                :initial-tab="currentPage === 'settings' ? activeSettingsTab : undefined"
                @change-page="changePage"
                @toggle-sidebar="isMobileMenuOpen = !isMobileMenuOpen"
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

    <!-- Login Loading Overlay -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div
          v-if="showLoginOverlay"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-gray-900/80 via-gray-900/70 to-gray-900/80 backdrop-blur-xl"
        >
          <div class="text-center px-8">
            <!-- Animated Nostr logo ring -->
            <div class="relative w-24 h-24 mx-auto mb-8">
              <div class="absolute inset-0 rounded-full border-[3px] border-orange-500/20"></div>
              <div class="absolute inset-0 rounded-full border-[3px] border-transparent border-t-orange-500 animate-spin" style="animation-duration: 1.2s"></div>
              <div class="absolute inset-2 rounded-full border-[2px] border-transparent border-b-amber-400 animate-spin" style="animation-duration: 1.8s; animation-direction: reverse"></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <svg class="w-10 h-10 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.6 2.4a1.6 1.6 0 0 0-3.2 0v6.4L7.2 5.6a1.6 1.6 0 0 0-2.3 2.3L8.1 11H1.6a1.6 1.6 0 0 0 0 3.2h6.5l-3.2 3.2a1.6 1.6 0 0 0 2.3 2.3l3.2-3.2v6.4a1.6 1.6 0 0 0 3.2 0v-6.4l3.2 3.2a1.6 1.6 0 0 0 2.3-2.3l-3.2-3.2h6.4a1.6 1.6 0 0 0 0-3.2h-6.5l3.2-3.1a1.6 1.6 0 0 0-2.3-2.3L13.6 8.8z"/>
                </svg>
              </div>
            </div>
            <p class="text-white text-lg font-semibold mb-2">{{ loginOverlayStatus }}</p>
            <p class="text-white/50 text-sm">Please approve the request in your extension</p>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- No Extension Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div
          v-if="showNoExtensionModal"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          @click.self="showNoExtensionModal = false"
        >
          <div class="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <!-- Cinematic header with browser-specific illustration -->
            <div class="relative bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 px-8 pt-10 pb-16 text-center overflow-hidden">
              <!-- Background decoration -->
              <div class="absolute -top-10 -left-10 w-36 h-36 bg-white/10 rounded-full"></div>
              <div class="absolute -bottom-6 -right-8 w-28 h-28 bg-white/8 rounded-full"></div>
              <div class="absolute top-6 right-14 w-6 h-6 bg-white/15 rounded-full"></div>
              <div class="absolute bottom-12 left-10 w-4 h-4 bg-white/12 rounded-full"></div>

              <!-- Browser + Extension install illustration -->
              <div class="relative w-28 h-28 mx-auto mb-5">
                <svg viewBox="0 0 112 112" fill="none" class="w-full h-full drop-shadow-lg">
                  <!-- Browser window frame -->
                  <rect x="8" y="16" width="96" height="72" rx="8" fill="white" opacity="0.15"/>
                  <rect x="12" y="20" width="88" height="64" rx="6" stroke="white" stroke-width="2.5" opacity="0.9"/>
                  <!-- Title bar dots -->
                  <circle cx="24" cy="29" r="2.5" fill="white" opacity="0.6"/>
                  <circle cx="33" cy="29" r="2.5" fill="white" opacity="0.6"/>
                  <circle cx="42" cy="29" r="2.5" fill="white" opacity="0.6"/>
                  <!-- URL bar -->
                  <rect x="20" y="36" width="72" height="8" rx="4" fill="white" opacity="0.2"/>

                  <!-- Firefox icon (when Firefox detected) -->
                  <g v-if="detectedBrowser.store === 'firefox'">
                    <circle cx="56" cy="62" r="14" fill="white" opacity="0.25"/>
                    <circle cx="56" cy="62" r="10" fill="white" opacity="0.9"/>
                    <path d="M56 54c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 13c-2.8 0-5-2.2-5-5s2.2-5 5-5c.7 0 1.4.2 2 .4-.5.5-.8 1.1-.8 1.8 0 1.4 1.1 2.5 2.5 2.5.7 0 1.3-.3 1.8-.8.2.6.4 1.3.4 2 .1 2.8-2.1 5.1-4.9 5.1z" fill="#FF6611"/>
                  </g>

                  <!-- Chrome icon (when Chrome/Edge/Chromium detected) -->
                  <g v-else>
                    <circle cx="56" cy="62" r="14" fill="white" opacity="0.25"/>
                    <circle cx="56" cy="62" r="10" fill="white" opacity="0.9"/>
                    <circle cx="56" cy="62" r="4" fill="#4285F4"/>
                    <path d="M56 54l6.9 4-3.5 6h-6.8l-3.5-6z" fill="#EA4335" opacity="0.9"/>
                    <path d="M49.1 58l-3.5 6 6.9 4 3.5-6z" fill="#34A853" opacity="0.9"/>
                    <path d="M62.9 58l3.5 6-6.9 4-3.5-6z" fill="#FBBC05" opacity="0.9"/>
                  </g>

                  <!-- Puzzle piece (extension) floating in -->
                  <g class="ext-puzzle-float">
                    <rect x="76" y="4" width="28" height="28" rx="6" fill="white" opacity="0.95"/>
                    <path d="M90 11v4h-2.5c-1.1 0-2 .9-2 2s.9 2 2 2H90v4h-4c0-1.1-.9-2-2-2s-2 .9-2 2h-4V11h12z" fill="#F97316"/>
                  </g>

                  <!-- Arrow pointing down from puzzle to browser -->
                  <path d="M90 34 L90 42 L86 38 M90 42 L94 38" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
                </svg>
              </div>

              <h3 class="text-2xl font-bold text-white">Install Jump for {{ detectedBrowser.name }}</h3>
              <p class="text-white/80 text-sm mt-1">One-click setup — your keys stay in your browser</p>

              <button
                @click="showNoExtensionModal = false"
                class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                aria-label="Close"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>

            <!-- Content -->
            <div class="px-8 py-6 -mt-8 relative">
              <!-- Step-by-step install card -->
              <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">

                <!-- Step 1: Install -->
                <div class="flex gap-3 mb-4">
                  <div class="w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</div>
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-gray-900 mb-1">Add the extension</p>
                    <a
                      :href="jumpInstallUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-200/60 hover:bg-orange-100 transition-colors group"
                    >
                      <div class="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                        <!-- Browser store icon -->
                        <svg v-if="detectedBrowser.store === 'firefox'" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9.22.66.7 1.15 1.31 1.4-.1.47-.15.95-.15 1.45 0 2.84 2.2 5.15 5 5.15.55 0 1.08-.09 1.58-.25.27.82 1.05 1.42 1.97 1.42.43 0 .83-.13 1.16-.36A7.96 7.96 0 0 1 12 20z"/>
                        </svg>
                        <svg v-else class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-gray-900">Jump by Buho</p>
                        <p class="text-xs text-gray-500">
                          {{ detectedBrowser.store === 'firefox' ? 'Firefox Add-ons' : 'Chrome Web Store' }}
                          <span class="text-orange-500 font-medium ml-1">— Install free</span>
                        </p>
                      </div>
                      <IconExternalLink class="w-4 h-4 text-gray-400 group-hover:text-orange-500 flex-shrink-0" />
                    </a>
                  </div>
                </div>

                <!-- Step 2: Create or import -->
                <div class="flex gap-3 mb-4">
                  <div class="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">2</div>
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-gray-900 mb-0.5">Create or import your keys</p>
                    <p class="text-xs text-gray-500 leading-relaxed">Jump will walk you through it — generate new keys or import an existing nsec</p>
                  </div>
                </div>

                <!-- Step 3: Refresh -->
                <div class="flex gap-3">
                  <div class="w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">3</div>
                  <div class="flex-1">
                    <p class="text-sm font-semibold text-gray-900 mb-0.5">Come back and connect</p>
                    <p class="text-xs text-gray-500 leading-relaxed">Refresh this page and click "Connect with Nostr" — done</p>
                  </div>
                </div>
              </div>

              <!-- Alternatives (collapsed) -->
              <details class="mb-5 group">
                <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition-colors flex items-center gap-1 select-none">
                  <svg class="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="currentColor"><path d="M4 2l4 4-4 4"/></svg>
                  Other NIP-07 extensions
                </summary>
                <div class="flex flex-wrap gap-2 mt-2.5 pl-4">
                  <a href="https://getalby.com" target="_blank" rel="noopener noreferrer"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >Alby <IconExternalLink class="w-3 h-3 text-gray-400" /></a>
                  <a href="https://github.com/nickodev/nos2x" target="_blank" rel="noopener noreferrer"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >nos2x <IconExternalLink class="w-3 h-3 text-gray-400" /></a>
                  <a href="https://www.getflamingo.org" target="_blank" rel="noopener noreferrer"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >Flamingo <IconExternalLink class="w-3 h-3 text-gray-400" /></a>
                </div>
              </details>

              <button
                @click="showNoExtensionModal = false; location.reload()"
                class="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all duration-200 hover:scale-[1.01]"
              >
                I've installed it — refresh page
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
/* Extension puzzle piece float animation */
.ext-puzzle-float {
  animation: puzzleFloat 2.5s ease-in-out infinite;
}
@keyframes puzzleFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

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
