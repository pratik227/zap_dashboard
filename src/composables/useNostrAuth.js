import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import * as nip19 from 'nostr-tools/nip19'
import SWHandler from 'smart-widget-handler'

// Global state for Nostr authentication - ensure all values are properly initialized
const currentUser = ref(null)
const isLoading = ref(false)
const authError = ref('')
const userRelays = ref([])
const relayError = ref('')

// Smart widget handler state
const isInWidget = ref(false)
const widgetListener = ref(null)

// Ensure userRelays is always an array
if (!Array.isArray(userRelays.value)) {
  userRelays.value = []
}

// Storage keys
const NOSTR_USER_KEY = 'nostrUser'
const NOSTR_RELAYS_KEY = 'nostrRelays'

// Default relays with proper configuration
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', status: 'disconnected', read: true, write: true },
  { url: 'wss://nos.lol', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.snort.social', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.primal.net', status: 'disconnected', read: true, write: true },
  { url: 'wss://nostr.wine', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.nostr.band', status: 'disconnected', read: true, write: false }
]

// Simple pool for relay connections - using proper nostr-tools pattern
let pool = null
let activeSubscriptions = new Map()

// Connection timeout settings
const CONNECTION_TIMEOUT = 10000 // 10 seconds
const QUERY_TIMEOUT = 15000 // 15 seconds
const RELAY_CHECK_TIMEOUT = 10000 // 10 seconds for relay status checking

// Debounce utility
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Initialize pool with proper error handling
const initPool = () => {
  if (!pool) {
    try {
      pool = new SimplePool()
      console.log('SimplePool initialized successfully')
    } catch (error) {
      console.error('Failed to initialize SimplePool:', error)
      throw error
    }
  }
  return pool
}

// Load user from localStorage
const loadUserFromStorage = () => {
  try {
    const stored = localStorage.getItem(NOSTR_USER_KEY)
    if (stored) {
      const userData = JSON.parse(stored)
      currentUser.value = userData
      console.log('Loaded user from storage:', userData.npub)
      return true
    }
  } catch (error) {
    console.error('Failed to load user from storage:', error)
    authError.value = 'Failed to load saved user data'
  }
  return false
}

// Save user to localStorage
const saveUserToStorage = (userData) => {
  try {
    localStorage.setItem(NOSTR_USER_KEY, JSON.stringify(userData))
    console.log('Saved user to storage:', userData.npub)
  } catch (error) {
    console.error('Failed to save user to storage:', error)
  }
}

// Load relays from localStorage
const loadRelaysFromStorage = () => {
  try {
    const stored = localStorage.getItem(NOSTR_RELAYS_KEY)
    if (stored) {
      const relayData = JSON.parse(stored)
      userRelays.value = relayData
      console.log('Loaded relays from storage:', relayData.length, 'relays')
      return true
    }
  } catch (error) {
    console.error('Failed to load relays from storage:', error)
    relayError.value = 'Failed to load saved relay data'
  }
  return false
}

// Save relays to localStorage
const saveRelaysToStorage = (relayData) => {
  try {
    localStorage.setItem(NOSTR_RELAYS_KEY, JSON.stringify(relayData))
    console.log('Saved relays to storage:', relayData.length, 'relays')
  } catch (error) {
    console.error('Failed to save relays to storage:', error)
  }
}

// Fetch user profile using proper nostr-tools patterns
const fetchAndStoreProfile = async (pubkey) => {
  if (!pubkey) {
    throw new Error('No pubkey provided')
  }

  isLoading.value = true
  authError.value = ''

  try {
    const currentPool = initPool()

    // Get read-enabled relays
    const readRelays = userRelays.value
      .filter(relay => relay.read && relay.status === 'connected')
      .map(relay => relay.url)

    // Fallback to all configured relays if no connected read relays
    let relayUrls = readRelays.length > 0 ? readRelays : userRelays.value.map(r => r.url)

    // Use default relays as last resort
    if (relayUrls.length === 0) {
      relayUrls = DEFAULT_RELAYS.map(relay => relay.url)
      console.warn('No configured relays, using default relays')
    }

    console.log('Fetching profile from relays:', relayUrls)

    // Use the new querySync method with timeout
    const profileEvent = await Promise.race([
      currentPool.get(relayUrls, {
        kinds: [0], // NIP-01 profile events
        authors: [pubkey],
        limit: 1
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), QUERY_TIMEOUT)
      )
    ])

    if (profileEvent) {
      return createUserData(pubkey, profileEvent)
    } else {
      // If no profile found, create minimal user data
      const userData = createMinimalUserData(pubkey)
      currentUser.value = userData
      saveUserToStorage(userData)
      console.log('No profile found, created minimal profile for pubkey:', pubkey)
      return userData
    }

  } catch (error) {
    console.error('Failed to fetch profile:', error)
    authError.value = `Failed to fetch profile: ${error.message}`

    // Create minimal user data as fallback
    const userData = createMinimalUserData(pubkey)
    currentUser.value = userData
    saveUserToStorage(userData)
    return userData
  } finally {
    isLoading.value = false
  }
}

// Create user data from profile event
const createUserData = (pubkey, profileEvent) => {
  try {
    const profileData = JSON.parse(profileEvent.content)
    const npub = nip19.npubEncode(pubkey)

    const userData = {
      pubkey,
      npub,
      profile: {
        ...profileData,
        // Ensure we have basic fields with proper fallback logic
        name: profileData.name || `User ${pubkey.substring(0, 8)}`,
        display_name: profileData.display_name || null, // No fallback for display_name
        about: profileData.about || 'Nostr user',
        picture: profileData.picture || profileData.avatar || null,
        nip05: profileData.nip05 || null,
        lud16: profileData.lud16 || null,
        lud06: profileData.lud06 || null,
        website: profileData.website || null,
        banner: profileData.banner || null
      },
      lastUpdated: new Date().toISOString(),
      profileEvent: profileEvent // Store the raw event for reference
    }

    currentUser.value = userData
    saveUserToStorage(userData)
    console.log('Profile fetched and stored:', userData)
    return userData
  } catch (error) {
    console.error('Failed to parse profile data:', error)
    return createMinimalUserData(pubkey)
  }
}

// Create minimal user data when no profile is found
const createMinimalUserData = (pubkey) => {
  console.log('Creating minimal user data for pubkey:', pubkey)
  
  const userData = {
    pubkey,
    npub: nip19.npubEncode(pubkey),
    profile: {
      name: `user_${pubkey.slice(0, 8)}`,
      display_name: `User ${pubkey.slice(0, 8)}`,
      about: '',
      picture: '',
      banner: '',
      nip05: '',
      lud16: '',
      lud06: '',
      website: ''
    },
    created_at: Math.floor(Date.now() / 1000),
    relays: [...DEFAULT_RELAYS]
  }

  currentUser.value = userData
  saveUserToStorage(userData)
  return userData
}

// Process smart widget profile data
const processSmartWidgetProfile = (widgetProfile) => {
  console.log('Processing smart widget profile:', widgetProfile)
  
  if (!widgetProfile || !widgetProfile.pubkey) {
    throw new Error('Invalid widget profile data')
  }

  const userData = {
    pubkey: widgetProfile.pubkey,
    npub: nip19.npubEncode(widgetProfile.pubkey),
    profile: {
      name: widgetProfile.name || '',
      display_name: widgetProfile.display_name || widgetProfile.name || '',
      about: widgetProfile.about || '',
      picture: widgetProfile.picture || '',
      banner: widgetProfile.banner || '',
      nip05: widgetProfile.nip05 || '',
      lud16: widgetProfile.lud16 || '',
      lud06: widgetProfile.lud06 || '',
      website: widgetProfile.website || ''
    },
    created_at: Math.floor(Date.now() / 1000),
    relays: [...DEFAULT_RELAYS],
    fromWidget: true
  }

  currentUser.value = userData
  saveUserToStorage(userData)
  return userData
}

// Initialize smart widget handler
const initSmartWidgetHandler = () => {
  // Only initialize if we're actually in an iframe and don't already have a user
  try {
    // Check if we're in an iframe (widget context) and SWHandler is available
    if (window.self !== window.top && typeof SWHandler !== 'undefined' && SWHandler !== null) {
      console.log('Detected iframe context, setting up smart widget handler')
      isInWidget.value = true
      
      // Only set up if we don't already have a listener
      if (!widgetListener.value) {
        // Notify parent that we're ready
        SWHandler.client.ready()
        
        // Set up listener for parent messages
        widgetListener.value = SWHandler.client.listen((data) => {
          console.log('Received message from parent:', data)
          
          if (data.kind === 'user-metadata' && data.data && data.data.user) {
            try {
              const userData = processSmartWidgetProfile(data.data.user)
              console.log('Successfully authenticated via smart widget:', userData)
              
              // Start listening for user events
              startUserEventListener(userData.pubkey)
              
              isLoading.value = false
              authError.value = ''
            } catch (error) {
              console.error('Error processing widget profile:', error)
              authError.value = 'Failed to process widget authentication'
              isLoading.value = false
            }
          }
        })
      }
      
      return true // Successfully initialized widget handler
    } else {
      console.log('Not in widget context or SWHandler not available')
    }
  } catch (error) {
    console.log('Smart widget handler not available or failed to initialize:', error)
    // Don't set isInWidget to true if there's an error
  }
  
  return false // Not in widget context or failed to initialize
}

// Clean up smart widget handler
const cleanupSmartWidgetHandler = () => {
  if (widgetListener.value) {
    console.log('Cleaning up smart widget handler listener')
    widgetListener.value.close()
    widgetListener.value = null
  }
  isInWidget.value = false
}

// Check relay status using proper connection testing with ensureRelay
const checkRelayStatus = async (url) => {
  const relay = userRelays.value.find(r => r.url === url)
  if (!relay) return false

  relay.status = 'checking'

  try {
    const currentPool = initPool()

    // Use ensureRelay with connection timeout to test the relay
    await currentPool.ensureRelay(url, {
      connectionTimeout: RELAY_CHECK_TIMEOUT
    })

    // If ensureRelay succeeds, the relay is connected
    relay.status = 'connected'
    console.log(`Relay ${url} is connected`)
    return true

  } catch (error) {
    // If ensureRelay throws an error, the relay is disconnected
    console.error(`Failed to check relay ${url}:`, error.message || error)
    relay.status = 'disconnected'
    return false
  }
}

// Check all relay statuses with proper error handling
const checkAllRelayStatuses = debounce(async () => {
  console.log('Checking all relay statuses...')
  relayError.value = ''

  try {
    // Check relays in parallel but with individual error handling
    const promises = userRelays.value.map(async (relay) => {
      try {
        return await checkRelayStatus(relay.url)
      } catch (error) {
        console.warn(`Error checking relay ${relay.url}:`, error)
        relay.status = 'disconnected'
        return false
      }
    })

    await Promise.allSettled(promises)
    console.log('Relay status check completed')

    // Save updated relay statuses
    saveRelaysToStorage(userRelays.value)

    // Check if we have any connected relays
    const connectedCount = userRelays.value.filter(r => r.status === 'connected').length
    if (connectedCount === 0) {
      relayError.value = 'No relays are currently reachable'
    }

  } catch (error) {
    console.error('Failed to check relay statuses:', error)
    relayError.value = 'Failed to check relay statuses'
  }
}, 1000)

// Validate relay URL
const validateRelayUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return 'Relay URL is required'
  }

  if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
    return 'Relay URL must start with wss:// or ws://'
  }

  try {
    new URL(url)
    return null // Valid
  } catch {
    return 'Invalid relay URL format'
  }
}

// Add relay
const addRelay = async (url, options = { read: true, write: true }) => {
  const validation = validateRelayUrl(url)
  if (validation) {
    throw new Error(validation)
  }

  // Check for duplicate
  const existingRelay = userRelays.value.find(relay => relay.url === url)
  if (existingRelay) {
    throw new Error('Relay already exists')
  }

  const newRelay = {
    url: url.trim(),
    status: 'checking',
    read: options.read,
    write: options.write
  }

  userRelays.value.push(newRelay)
  saveRelaysToStorage(userRelays.value)

  // Check status of new relay
  await checkRelayStatus(url)

  console.log('Added relay:', url)
  return newRelay
}

// Remove relay
const removeRelay = (url) => {
  const index = userRelays.value.findIndex(relay => relay.url === url)
  if (index === -1) {
    throw new Error('Relay not found')
  }

  userRelays.value.splice(index, 1)
  saveRelaysToStorage(userRelays.value)

  console.log('Removed relay:', url)
  return true
}

// Start listening for user events with proper subscription management
const startUserEventListener = (pubkey) => {
  if (!pubkey || !pool) return

  const currentPool = initPool()
  const relayUrls = userRelays.value
    .filter(relay => relay.read && relay.status === 'connected')
    .map(relay => relay.url)

  if (relayUrls.length === 0) {
    console.warn('No connected read relays for event listening')
    return
  }

  // Close existing subscription if any
  const existingSub = activeSubscriptions.get(pubkey)
  if (existingSub) {
    existingSub.close()
  }

  try {
    // Subscribe to user's events using proper nostr-tools pattern
    const sub = currentPool.subscribeMany(relayUrls, [
      {
        kinds: [1, 6, 7], // Notes, reposts, reactions
        authors: [pubkey],
        limit: 50
      },
      {
        kinds: [1, 6, 7], // Events mentioning the user
        '#p': [pubkey],
        limit: 50
      }
    ], {
      onevent: (event) => {
        console.log('Received user event:', event)
        // Emit custom event for other parts of the app
        document.dispatchEvent(new CustomEvent('nostr:event', { detail: event }))
      },
      oneose: () => {
        console.log('End of stored events for user:', pubkey)
      },
      onclose: (reasons) => {
        console.log('User event subscription closed:', reasons)
        activeSubscriptions.delete(pubkey)
      },
      maxWait: QUERY_TIMEOUT
    })

    activeSubscriptions.set(pubkey, sub)
    console.log('Started listening for events for user:', pubkey)
  } catch (error) {
    console.error('Failed to start user event listener:', error)
  }
}

// Stop listening for user events
const stopUserEventListener = (pubkey) => {
  const sub = activeSubscriptions.get(pubkey)
  if (sub) {
    sub.close()
    activeSubscriptions.delete(pubkey)
    console.log('Stopped listening for events for user:', pubkey)
  }
}

// Login function with smart-widget-handler integration
const login = () => {
  return new Promise((resolve, reject) => {
    isLoading.value = true
    authError.value = ''

    // Check if we're in a widget context and try smart-widget-handler first
    if (window.self !== window.top && !currentUser.value) {
      console.log('Detected widget context, trying smart widget authentication...')
      
      if (initSmartWidgetHandler()) {
        // Set up a timeout for widget authentication
        const widgetTimeout = setTimeout(() => {
          if (isLoading.value && !currentUser.value) {
            console.log('Widget authentication timeout, falling back to Nostr extension')
            fallbackToNostrExtension(resolve, reject)
          }
        }, 5000) // 5 second timeout for widget auth
        
        // Watch for successful widget authentication
        const stopWatching = watch(currentUser, (newUser) => {
          if (newUser && newUser.fromWidget) {
            clearTimeout(widgetTimeout)
            stopWatching()
            resolve(newUser)
          }
        })
        
        return
      }
    }
    
    // Use traditional Nostr extension login
    fallbackToNostrExtension(resolve, reject)
  })
}

// Fallback to traditional Nostr extension authentication
const fallbackToNostrExtension = (resolve, reject) => {
  console.log('Using traditional Nostr extension authentication...')
  
  // Listen for auth events
  const handleAuth = async (event) => {
    try {
      console.log('Nostr auth event received:', event.detail)

      if (window.nostr && window.nostr.getPublicKey) {
        const pubkey = await window.nostr.getPublicKey()
        console.log('Got pubkey from nostr extension:', pubkey)

        // Fetch and store profile
        const userData = await fetchAndStoreProfile(pubkey)

        // Start listening for user events
        startUserEventListener(pubkey)

        // Clean up event listener
        document.removeEventListener('nlAuth', handleAuth)

        resolve(userData)
      } else {
        throw new Error('Nostr extension not available')
      }
    } catch (error) {
      console.error('Auth error:', error)
      authError.value = error.message
      document.removeEventListener('nlAuth', handleAuth)
      reject(error)
    } finally {
      isLoading.value = false
    }
  }

  // Add event listener
  document.addEventListener('nlAuth', handleAuth)

  // Dispatch login event
  document.dispatchEvent(new Event('nlLaunch'))

  // Timeout after 60 seconds
  setTimeout(() => {
    if (isLoading.value) {
      document.removeEventListener('nlAuth', handleAuth)
      isLoading.value = false
      authError.value = 'Login timeout - please try again'
      reject(new Error('Login timeout'))
    }
  }, 60000)
}

// Logout function
const logout = () => {
  try {
    // Stop event listeners
    if (currentUser.value) {
      stopUserEventListener(currentUser.value.pubkey)
    }
    
    // Clean up smart widget handler
    cleanupSmartWidgetHandler()
    
    // Clear user data
    currentUser.value = null
    authError.value = ''
    
    // Clear storage
    localStorage.removeItem(NOSTR_USER_KEY)
    
    console.log('Logout completed')
  } catch (error) {
    console.error('Error during logout:', error)
    authError.value = 'Error during logout'
  }
}

// Initialize auth and relays with smart-widget-handler support
const initAuthAndRelays = async () => {
  console.log('Initializing Nostr auth and relays...')

  try {
    // Initialize pool
    initPool()

    // Load user from storage first (this ensures existing functionality works)
    const hasStoredUser = loadUserFromStorage()
    
    // Only try smart-widget-handler if we're actually in an iframe and don't have a stored user
    if (!hasStoredUser && window.self !== window.top) {
      console.log('No stored user and in iframe context, trying smart widget handler...')
      const widgetInitialized = initSmartWidgetHandler()
      
      if (widgetInitialized) {
        console.log('Smart widget handler initialized, waiting for parent authentication...')
        isLoading.value = true
        
        // Set up a timeout for widget authentication during initialization
        setTimeout(() => {
          if (isLoading.value && !currentUser.value) {
            console.log('Widget authentication timeout during initialization')
            isLoading.value = false
          }
        }, 3000) // 3 second timeout for initial widget auth
      }
    } else if (hasStoredUser) {
      console.log('User loaded from storage successfully')
    } else {
      console.log('No stored user, running in standalone mode')
    }

    // Load or initialize relays
    if (!loadRelaysFromStorage()) {
      console.log('No saved relays found, using defaults')
      userRelays.value = [...DEFAULT_RELAYS]
      saveRelaysToStorage(userRelays.value)
    }

    // Check relay statuses with timeout
    await Promise.race([
      checkAllRelayStatuses(),
      new Promise((resolve) =>
        setTimeout(() => {
          console.warn('Relay status check timed out')
          resolve()
        }, CONNECTION_TIMEOUT)
      )
    ])

    // If user exists, start listening for their events
    if (currentUser.value) {
      // Wait a bit for relays to be checked
      setTimeout(() => {
        startUserEventListener(currentUser.value.pubkey)
      }, 2000)
    }
  } catch (error) {
    console.error('Failed to initialize auth and relays:', error)
    authError.value = 'Failed to initialize Nostr connection'
  }
}

// Refresh user profile
const refreshUserProfile = async () => {
  if (!currentUser.value) {
    throw new Error('No user logged in')
  }

  console.log('Refreshing user profile...')
  return await fetchAndStoreProfile(currentUser.value.pubkey)
}

// Computed properties
const isAuthenticated = computed(() => !!currentUser.value)
const userProfile = computed(() => currentUser.value?.profile || null)
const connectedRelays = computed(() => (userRelays.value || []).filter(relay => relay.status === 'connected'))
const readRelays = computed(() => (userRelays.value || []).filter(relay => relay.read && relay.status === 'connected'))
const writeRelays = computed(() => (userRelays.value || []).filter(relay => relay.write && relay.status === 'connected'))

// Watch for changes and save to storage
watch(currentUser, (newUser) => {
  if (newUser) {
    saveUserToStorage(newUser)
  }
}, { deep: true })

watch(userRelays, (newRelays) => {
  saveRelaysToStorage(newRelays)
}, { deep: true })

// Cleanup on unmount
onUnmounted(() => {
  // Close all active subscriptions
  activeSubscriptions.forEach(sub => sub.close())
  activeSubscriptions.clear()

  // Clean up smart widget handler
  cleanupSmartWidgetHandler()

  // Close pool connections
  if (pool) {
    try {
      pool.close(userRelays.value.map(r => r.url))
    } catch (error) {
      console.warn('Error closing pool connections:', error)
    }
  }
})

export function useNostrAuth() {
  return {
    // State
    currentUser,
    isLoading,
    authError,
    userRelays,
    relayError,
    isInWidget,

    // Computed
    isAuthenticated,
    userProfile,
    connectedRelays,
    readRelays,
    writeRelays,

    // Actions
    login,
    logout,
    fetchAndStoreProfile,
    refreshUserProfile,
    addRelay,
    removeRelay,
    checkRelayStatus,
    checkAllRelayStatuses,
    validateRelayUrl,
    initAuthAndRelays,
    startUserEventListener,
    stopUserEventListener,

    // Utilities
    pool: computed(() => pool)
  }
}