import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import * as nip19 from 'nostr-tools/nip19'

// Global state for Nostr authentication
const currentUser = ref(null)
const isLoading = ref(false)
const authError = ref('')
const userRelays = ref([])
const relayError = ref('')

// Storage keys
const NOSTR_USER_KEY = 'nostrUser'
const NOSTR_RELAYS_KEY = 'nostrRelays'

// Default relays with proper configuration
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', status: 'disconnected', read: true, write: true },
  { url: 'wss://nos.lol', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.snort.social', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.nostr.band', status: 'disconnected', read: true, write: false },
  { url: 'wss://relay.primal.net', status: 'disconnected', read: true, write: true },
  { url: 'wss://nostr.wine', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.nostr.info', status: 'disconnected', read: true, write: false }
]

// Simple pool for relay connections
let pool = null
let activeSubscriptions = new Map()

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

// Initialize pool
const initPool = () => {
  if (!pool) {
    pool = new SimplePool()
    console.log('SimplePool initialized')
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

// Fetch user profile from relays using proper nostr-tools patterns
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

    // Fallback to all relays if no connected read relays
    const relayUrls = readRelays.length > 0 ? readRelays : userRelays.value.map(r => r.url)
    
    if (relayUrls.length === 0) {
      // Use default relays as last resort
      const fallbackUrls = DEFAULT_RELAYS.map(relay => relay.url)
      console.warn('No configured relays, using default relays')
      
      const profileEvent = await fetchProfileFromRelays(currentPool, fallbackUrls, pubkey)
      if (profileEvent) {
        return createUserData(pubkey, profileEvent)
      }
    } else {
      const profileEvent = await fetchProfileFromRelays(currentPool, relayUrls, pubkey)
      if (profileEvent) {
        return createUserData(pubkey, profileEvent)
      }
    }
    
    // If no profile found, create minimal user data
    const userData = createMinimalUserData(pubkey)
    currentUser.value = userData
    saveUserToStorage(userData)
    console.log('Created minimal profile for pubkey:', pubkey)
    return userData

  } catch (error) {
    console.error('Failed to fetch profile:', error)
    authError.value = `Failed to fetch profile: ${error.message}`
    throw error
  } finally {
    isLoading.value = false
  }
}

// Helper function to fetch profile from relays
const fetchProfileFromRelays = async (pool, relayUrls, pubkey) => {
  return new Promise((resolve, reject) => {
    let profileEvent = null
    const timeout = setTimeout(() => {
      if (sub) sub.close()
      resolve(profileEvent)
    }, 15000) // 15 second timeout

    const sub = pool.subscribeMany(relayUrls, [
      {
        kinds: [0], // NIP-01 profile events
        authors: [pubkey],
        limit: 1
      }
    ], {
      onevent: (event) => {
        console.log('Received profile event:', event)
        if (!profileEvent || event.created_at > profileEvent.created_at) {
          profileEvent = event // Keep the most recent profile event
        }
      },
      oneose: () => {
        clearTimeout(timeout)
        sub.close()
        resolve(profileEvent)
      },
      onclose: (reason) => {
        clearTimeout(timeout)
        if (reason && reason !== 'closed by caller') {
          console.warn('Profile subscription closed:', reason)
        }
        resolve(profileEvent)
      }
    })
  })
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
        // Ensure we have basic fields
        name: profileData.name || profileData.display_name || `User ${pubkey.substring(0, 8)}`,
        display_name: profileData.display_name || profileData.name || `User ${pubkey.substring(0, 8)}`,
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
  const npub = nip19.npubEncode(pubkey)
  
  const userData = {
    pubkey,
    npub,
    profile: {
      name: `User ${pubkey.substring(0, 8)}`,
      display_name: `User ${pubkey.substring(0, 8)}`,
      about: 'Nostr user',
      picture: null,
      nip05: null,
      lud16: null,
      lud06: null,
      website: null,
      banner: null
    },
    lastUpdated: new Date().toISOString(),
    profileEvent: null
  }

  currentUser.value = userData
  saveUserToStorage(userData)
  return userData
}

// Check relay status using proper nostr-tools patterns
const checkRelayStatus = async (url) => {
  const relay = userRelays.value.find(r => r.url === url)
  if (!relay) return false

  relay.status = 'checking'
  
  try {
    const currentPool = initPool()
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (sub) sub.close()
        relay.status = 'disconnected'
        resolve(false)
      }, 8000) // 8 second timeout

      const sub = currentPool.subscribe([url], [{ kinds: [0], limit: 1 }], {
        onevent: (event) => {
          clearTimeout(timeout)
          relay.status = 'connected'
          sub.close()
          resolve(true)
        },
        oneose: () => {
          clearTimeout(timeout)
          relay.status = 'connected'
          sub.close()
          resolve(true)
        },
        onclose: (reason) => {
          clearTimeout(timeout)
          if (reason && reason !== 'closed by caller') {
            relay.status = 'disconnected'
          }
          resolve(relay.status === 'connected')
        }
      })
    })
  } catch (error) {
    console.error(`Failed to check relay ${url}:`, error)
    relay.status = 'disconnected'
    return false
  }
}

// Check all relay statuses (debounced)
const checkAllRelayStatuses = debounce(async () => {
  console.log('Checking all relay statuses...')
  relayError.value = ''
  
  try {
    const promises = userRelays.value.map(relay => checkRelayStatus(relay.url))
    await Promise.allSettled(promises)
    console.log('Relay status check completed')
    
    // Save updated relay statuses
    saveRelaysToStorage(userRelays.value)
  } catch (error) {
    console.error('Failed to check relay statuses:', error)
    relayError.value = 'Failed to check some relay statuses'
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

// Start listening for user events
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

  // Subscribe to user's events (notes, reactions, etc.)
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
      // Here you can emit events or update reactive state
      // For example, you could emit a custom event that other parts of the app can listen to
      document.dispatchEvent(new CustomEvent('nostr:event', { detail: event }))
    },
    oneose: () => {
      console.log('End of stored events for user:', pubkey)
    },
    onclose: (reason) => {
      console.log('User event subscription closed:', reason)
      activeSubscriptions.delete(pubkey)
    }
  })

  activeSubscriptions.set(pubkey, sub)
  console.log('Started listening for events for user:', pubkey)
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

// Login function with enhanced timeout and error handling
const login = () => {
  return new Promise((resolve, reject) => {
    isLoading.value = true
    authError.value = ''
    
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
  })
}

// Logout function
const logout = () => {
  try {
    // Stop event listeners
    if (currentUser.value) {
      stopUserEventListener(currentUser.value.pubkey)
    }
    
    // Close all active subscriptions
    activeSubscriptions.forEach(sub => sub.close())
    activeSubscriptions.clear()
    
    // Dispatch logout event
    document.dispatchEvent(new Event('nlLogout'))
    
    // Clear state
    currentUser.value = null
    authError.value = ''
    
    // Clear storage
    localStorage.removeItem(NOSTR_USER_KEY)
    
    console.log('User logged out successfully')
    return true
  } catch (error) {
    console.error('Logout error:', error)
    authError.value = 'Failed to logout'
    return false
  }
}

// Initialize auth and relays
const initAuthAndRelays = async () => {
  console.log('Initializing Nostr auth and relays...')
  
  // Initialize pool
  initPool()
  
  // Load user from storage
  const hasUser = loadUserFromStorage()
  
  // Load or initialize relays
  if (!loadRelaysFromStorage()) {
    console.log('No saved relays found, using defaults')
    userRelays.value = [...DEFAULT_RELAYS]
    saveRelaysToStorage(userRelays.value)
  }
  
  // Check relay statuses
  await checkAllRelayStatuses()
  
  // If user exists, start listening for their events
  if (hasUser && currentUser.value) {
    startUserEventListener(currentUser.value.pubkey)
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
const connectedRelays = computed(() => userRelays.value.filter(relay => relay.status === 'connected'))
const readRelays = computed(() => userRelays.value.filter(relay => relay.read && relay.status === 'connected'))
const writeRelays = computed(() => userRelays.value.filter(relay => relay.write && relay.status === 'connected'))

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
  
  // Close pool
  if (pool) {
    pool.close([])
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