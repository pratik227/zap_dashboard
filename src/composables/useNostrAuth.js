import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import { nip19 } from 'nostr-tools'

// Global state for Nostr authentication
const currentUser = ref(null)
const isLoading = ref(false)
const authError = ref('')
const userRelays = ref([])
const relayError = ref('')

// Storage keys
const NOSTR_USER_KEY = 'nostrUser'
const NOSTR_RELAYS_KEY = 'nostrRelays'

// Default relays
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', status: 'disconnected', read: true, write: true },
  { url: 'wss://nos.lol', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.snort.social', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.nostr.band', status: 'disconnected', read: true, write: false },
  { url: 'wss://relay.primal.net', status: 'disconnected', read: true, write: true }
]

// Simple pool for relay connections
let pool = null

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

// Fetch user profile from relays
const fetchAndStoreProfile = async (pubkey) => {
  if (!pubkey) {
    throw new Error('No pubkey provided')
  }

  isLoading.value = true
  authError.value = ''

  try {
    const currentPool = initPool()
    const relayUrls = userRelays.value
      .filter(relay => relay.read && relay.status === 'connected')
      .map(relay => relay.url)

    if (relayUrls.length === 0) {
      // Fallback to default relays if no connected relays
      const fallbackUrls = DEFAULT_RELAYS.map(relay => relay.url)
      console.warn('No connected relays, using fallback relays')
      
      const events = await currentPool.list(fallbackUrls, [
        {
          kinds: [0],
          authors: [pubkey],
          limit: 1
        }
      ])

      if (events.length > 0) {
        const profileEvent = events[0]
        const profileData = JSON.parse(profileEvent.content)
        
        const userData = {
          pubkey,
          npub: nip19.npubEncode(pubkey),
          profile: profileData,
          lastUpdated: new Date().toISOString()
        }

        currentUser.value = userData
        saveUserToStorage(userData)
        console.log('Profile fetched and stored:', userData)
        return userData
      } else {
        throw new Error('No profile found for this pubkey')
      }
    } else {
      const events = await currentPool.list(relayUrls, [
        {
          kinds: [0],
          authors: [pubkey],
          limit: 1
        }
      ])

      if (events.length > 0) {
        const profileEvent = events[0]
        const profileData = JSON.parse(profileEvent.content)
        
        const userData = {
          pubkey,
          npub: nip19.npubEncode(pubkey),
          profile: profileData,
          lastUpdated: new Date().toISOString()
        }

        currentUser.value = userData
        saveUserToStorage(userData)
        console.log('Profile fetched and stored:', userData)
        return userData
      } else {
        // Create minimal user data if no profile found
        const userData = {
          pubkey,
          npub: nip19.npubEncode(pubkey),
          profile: {
            name: `User ${pubkey.substring(0, 8)}`,
            display_name: `User ${pubkey.substring(0, 8)}`,
            about: 'Nostr user'
          },
          lastUpdated: new Date().toISOString()
        }

        currentUser.value = userData
        saveUserToStorage(userData)
        console.log('Created minimal profile:', userData)
        return userData
      }
    }
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    authError.value = `Failed to fetch profile: ${error.message}`
    throw error
  } finally {
    isLoading.value = false
  }
}

// Check relay status
const checkRelayStatus = async (url) => {
  const relay = userRelays.value.find(r => r.url === url)
  if (!relay) return

  relay.status = 'checking'
  
  try {
    const currentPool = initPool()
    
    // Test connection with a simple subscription
    const sub = currentPool.sub([url], [{ kinds: [0], limit: 1 }])
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        relay.status = 'disconnected'
        sub.unsub()
        resolve(false)
      }, 5000) // 5 second timeout

      sub.on('event', () => {
        clearTimeout(timeout)
        relay.status = 'connected'
        sub.unsub()
        resolve(true)
      })

      sub.on('eose', () => {
        clearTimeout(timeout)
        relay.status = 'connected'
        sub.unsub()
        resolve(true)
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

// Login function
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
          
          await fetchAndStoreProfile(pubkey)
          
          // Clean up event listener
          document.removeEventListener('nlAuth', handleAuth)
          
          resolve(currentUser.value)
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
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (isLoading.value) {
        document.removeEventListener('nlAuth', handleAuth)
        isLoading.value = false
        authError.value = 'Login timeout - please try again'
        reject(new Error('Login timeout'))
      }
    }, 30000)
  })
}

// Logout function
const logout = () => {
  try {
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
  
  // Load user from storage
  loadUserFromStorage()
  
  // Load or initialize relays
  if (!loadRelaysFromStorage()) {
    console.log('No saved relays found, using defaults')
    userRelays.value = [...DEFAULT_RELAYS]
    saveRelaysToStorage(userRelays.value)
  }
  
  // Check relay statuses
  await checkAllRelayStatuses()
}

// Computed properties
const isAuthenticated = computed(() => !!currentUser.value)
const userProfile = computed(() => currentUser.value?.profile || null)
const connectedRelays = computed(() => userRelays.value.filter(relay => relay.status === 'connected'))

// Watch for changes and save to storage
watch(currentUser, (newUser) => {
  if (newUser) {
    saveUserToStorage(newUser)
  }
}, { deep: true })

watch(userRelays, (newRelays) => {
  saveRelaysToStorage(newRelays)
}, { deep: true })

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
    
    // Actions
    login,
    logout,
    fetchAndStoreProfile,
    addRelay,
    removeRelay,
    checkRelayStatus,
    checkAllRelayStatuses,
    validateRelayUrl,
    initAuthAndRelays
  }
}