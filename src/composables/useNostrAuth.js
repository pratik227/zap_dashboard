import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import * as nip19 from 'nostr-tools/nip19'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { initializeNWC } from '../utils/nwcClient.js'
import SWHandler from 'smart-widget-handler'

// Global state for Nostr authentication
const currentUser = ref(null)
const isLoading = ref(false)
const authError = ref('')
const userRelays = ref([])
const relayError = ref('')
const isInWidget = ref(false)
const widgetListener = ref(null)

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

// Connection timeout settings
const CONNECTION_TIMEOUT = 10000 // 10 seconds
const QUERY_TIMEOUT = 15000 // 15 seconds

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

// Sync relay statuses from relay manager
const syncRelayStatuses = () => {
  const managerStatuses = nostrRelayManager.getRelayStatuses()
  
  // Update userRelays with current statuses
  userRelays.value = userRelays.value.map(relay => {
    const managerStatus = managerStatuses.find(s => s.url === relay.url)
    if (managerStatus) {
      return {
        ...relay,
        status: managerStatus.status,
        error: managerStatus.error,
        lastUpdated: managerStatus.lastUpdated,
        lastConnected: managerStatus.lastConnected
      }
    }
    return relay
  })
  
  // Add any new relays from manager that aren't in userRelays
  managerStatuses.forEach(managerStatus => {
    const exists = userRelays.value.find(r => r.url === managerStatus.url)
    if (!exists && managerStatus.config) {
      userRelays.value.push({
        url: managerStatus.url,
        status: managerStatus.status,
        read: managerStatus.config.read,
        write: managerStatus.config.write,
        error: managerStatus.error,
        lastUpdated: managerStatus.lastUpdated,
        lastConnected: managerStatus.lastConnected
      })
    }
  })
  
  // Save updated relays
  saveRelaysToStorage(userRelays.value)
}

// Fetch user profile using the relay manager
const fetchAndStoreProfile = async (pubkey) => {
  if (!pubkey) {
    throw new Error('No pubkey provided')
  }

  isLoading.value = true
  authError.value = ''

  try {
    console.log('Fetching profile using relay manager for pubkey:', pubkey.substring(0, 8) + '...')
    
    // Use relay manager to get profile
    const profileEvent = await nostrRelayManager.getEvent({
      kinds: [0], // NIP-01 profile events
      authors: [pubkey],
      limit: 1
    })
    
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
        display_name: profileData.display_name || null,
        about: profileData.about || 'Nostr user',
        picture: profileData.picture || profileData.avatar || null,
        nip05: profileData.nip05 || null,
        lud16: profileData.lud16 || null,
        lud06: profileData.lud06 || null,
        website: profileData.website || null,
        banner: profileData.banner || null
      },
      lastUpdated: new Date().toISOString(),
      profileEvent: profileEvent
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
      display_name: null,
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

// Check relay status using relay manager
const checkRelayStatus = async (url) => {
  const relay = userRelays.value.find(r => r.url === url)
  if (!relay) return false

  try {
    // The relay manager handles connection checking
    await nostrRelayManager.addRelay(url, { read: relay.read, write: relay.write })
    return true
  } catch (error) {
    console.error(`Failed to check relay ${url}:`, error.message || error)
    return false
  }
}

// Check all relay statuses
const checkAllRelayStatuses = async () => {
  console.log('Checking all relay statuses using relay manager...')
  relayError.value = ''
  
  try {
    // Initialize relay manager with current relays
    await nostrRelayManager.initialize(userRelays.value)
    
    // Sync statuses back to our state
    syncRelayStatuses()
    
    const stats = nostrRelayManager.getConnectionStats()
    console.log('Relay status check completed:', stats)
    
    if (stats.connected === 0) {
      relayError.value = 'No relays are currently reachable'
    }
    
  } catch (error) {
    console.error('Failed to check relay statuses:', error)
    relayError.value = 'Failed to check relay statuses'
  }
}

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
    status: 'connecting',
    read: options.read,
    write: options.write
  }
  
  userRelays.value.push(newRelay)
  saveRelaysToStorage(userRelays.value)
  
  // Add to relay manager
  try {
    await nostrRelayManager.addRelay(url, options)
    syncRelayStatuses()
  } catch (error) {
    // Remove from userRelays if failed to add to manager
    const index = userRelays.value.findIndex(r => r.url === url)
    if (index !== -1) {
      userRelays.value.splice(index, 1)
      saveRelaysToStorage(userRelays.value)
    }
    throw error
  }
  
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
  
  // Remove from relay manager
  nostrRelayManager.removeRelay(url)
  
  console.log('Removed relay:', url)
  return true
}

// Widget detection and setup functions
const detectWidgetContext = () => {
  try {
    // Check if we're running in an iframe
    const inIframe = window.self !== window.top
    console.log('Widget context detection - in iframe:', inIframe)
    return inIframe
  } catch (error) {
    console.log('Widget context detection - iframe check failed, assuming in widget:', error)
    return true // Assume we're in a widget if we can't access parent
  }
}

const setupWidgetListener = () => {
  return new Promise((resolve, reject) => {
    console.log('Setting up widget listener...')
    
    try {
      // Set up listener for messages from parent (host)
      const listener = SWHandler.client.listen((data) => {
        console.log('Received message from parent:', data)
        
        if (data.kind === 'user-metadata') {
          console.log('Received user metadata from widget:', data.data.user)
          resolve(data.data.user)
        } else if (data.kind === 'err-msg') {
          console.error('Widget error:', data.data)
          reject(new Error(data.data))
        }
      })
      
      widgetListener.value = listener
      
      // Notify parent that we're ready
      SWHandler.client.ready()
      console.log('Notified parent widget that client is ready')
      
      // Set timeout for widget authentication
      setTimeout(() => {
        reject(new Error('Widget authentication timeout'))
      }, 5000)
      
    } catch (error) {
      console.error('Failed to setup widget listener:', error)
      reject(error)
    }
  })
}

const processSmartWidgetProfile = (widgetUser) => {
  console.log('Processing smart widget profile:', widgetUser)
  
  if (!widgetUser || !widgetUser.pubkey) {
    throw new Error('Invalid widget user data - missing pubkey')
  }
  
  // Convert pubkey to npub format
  const npub = nip19.npubEncode(widgetUser.pubkey)
  
  // Create user data structure
  const userData = {
    pubkey: widgetUser.pubkey,
    npub: npub,
    profile: {
      name: widgetUser.name || '',
      display_name: widgetUser.display_name || widgetUser.name || '',
      about: widgetUser.about || '',
      picture: widgetUser.picture || '',
      banner: widgetUser.banner || '',
      nip05: widgetUser.nip05 || '',
      lud16: widgetUser.lud16 || '',
      lud06: widgetUser.lud06 || '',
      website: widgetUser.website || '',
      updated_at: Math.floor(Date.now() / 1000)
    },
    source: 'widget',
    loginTime: Date.now()
  }
  
  console.log('Created widget user data:', userData)
  return userData
}

const cleanupWidgetResources = () => {
  if (widgetListener.value) {
    console.log('Cleaning up widget listener')
    try {
      widgetListener.value.close()
    } catch (error) {
      console.warn('Error closing widget listener:', error)
    }
    widgetListener.value = null
  }
}

// Start listening for user events using relay manager
const startUserEventListener = (pubkey) => {
  console.log('Starting user event listener for:', pubkey)
  
  // Use relay manager to listen for user events
  nostrRelayManager.subscribeToUserEvents(pubkey, (event) => {
    console.log('Received user event:', event)
    
    // Handle profile updates (kind 0)
    if (event.kind === 0) {
      try {
        const profile = JSON.parse(event.content)
        console.log('Profile update received:', profile)
        
        // Update current user profile
        if (currentUser.value && currentUser.value.pubkey === event.pubkey) {
          currentUser.value = {
            ...currentUser.value,
            profile: {
              ...currentUser.value.profile,
              ...profile,
              updated_at: event.created_at
            }
          }
          console.log('Updated current user profile:', currentUser.value)
        }
      } catch (error) {
        console.error('Failed to parse profile update:', error)
      }
    }
    
    // Handle other event types as needed
    // Kind 3: Contact list
    // Kind 10002: Relay list
    // etc.
  })
}

// Login function
const login = () => {
  return new Promise(async (resolve, reject) => {
    isLoading.value = true
    authError.value = ''
    
    // Check if user is already logged in
    if (isAuthenticated.value && currentUser.value) {
      console.log('User already logged in:', currentUser.value.npub)
      isLoading.value = false
      resolve(currentUser.value)
      return
    }
    
    // First, try widget authentication if we're in a widget context
    const inWidget = detectWidgetContext()
    isInWidget.value = inWidget
    
    if (inWidget) {
      console.log('Detected widget context, attempting widget authentication...')
      
      try {
        // Try to get user data from widget
        const widgetUser = await setupWidgetListener()
        console.log('Widget authentication successful:', widgetUser)
        
        // Process widget profile data
        const userData = processSmartWidgetProfile(widgetUser)
        
        // Set current user
        currentUser.value = userData
        
        // Start listening for user events
        startUserEventListener(userData.pubkey)
        
        isLoading.value = false
        resolve(userData)
        return
        
      } catch (widgetError) {
        console.warn('Widget authentication failed, falling back to standard auth:', widgetError)
        // Continue to standard authentication below
        isInWidget.value = false
      }
    }
    
    // Standard Nostr extension authentication (fallback)
    console.log('Attempting standard Nostr extension authentication...')
    
    // Listen for auth events
    const handleAuth = async (event) => {
      try {
        console.log('Nostr auth event received:', event.detail)
        
        if (window.nostr && window.nostr.getPublicKey) {
          const pubkey = await window.nostr.getPublicKey()
          console.log('Got pubkey from nostr extension:', pubkey)
          
          // Check if this user is already stored
          const existingUser = localStorage.getItem(NOSTR_USER_KEY)
          if (existingUser) {
            try {
              const userData = JSON.parse(existingUser)
              if (userData.pubkey === pubkey) {
                console.log('User already exists, using stored data:', userData.npub)
                currentUser.value = userData
                
                // Start listening for user events
                startUserEventListener(pubkey)
                
                // Clean up event listener
                document.removeEventListener('nlAuth', handleAuth)
                
                resolve(userData)
                return
              }
            } catch (error) {
              console.warn('Failed to parse existing user data:', error)
            }
          }
          
          // Fetch and store profile for new user
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
    // Clean up widget resources first
    cleanupWidgetResources()
    
    // Dispatch logout event
    document.dispatchEvent(new Event('nlLogout'))
    
    // Clear state
    currentUser.value = null
    authError.value = ''
    userRelays.value = []
    isInWidget.value = false
    
    // Clear all Nostr-related localStorage data
    const nostrKeys = [
      // Authentication data
      NOSTR_USER_KEY, // 'nostrUser'
      NOSTR_RELAYS_KEY, // 'nostrRelays'
      
      // Connection data
      'nostr_connections',
      'active_connection_id',
      'nwc_url',
      
      // Notification data
      'notification_settings',
      'last_transaction_timestamp',
      'last_balance',
      'processed_transactions',
      'notifications_list',
      
      // Content data
      'user_content_items'
    ]
    
    nostrKeys.forEach(key => {
      localStorage.removeItem(key)
    })
    
    // Clean up NWC client and relay manager
    initializeNWC(null)
    nostrRelayManager.cleanup()
    
    console.log('User logged out successfully - cleared all Nostr data from localStorage')
    
    // Reload the page to reset all components
    window.location.reload()
    
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
  
  try {
    // Load user from storage
    const hasUser = loadUserFromStorage()
    
    // Load or initialize relays
    if (!loadRelaysFromStorage()) {
      console.log('No saved relays found, using defaults')
      userRelays.value = [...DEFAULT_RELAYS]
      saveRelaysToStorage(userRelays.value)
    }
    
    // Initialize relay manager with user relays
    await nostrRelayManager.initialize(userRelays.value)
    
    // Set up relay manager event listeners
    nostrRelayManager.addEventListener((event) => {
      if (event.type === 'relayConnected' || event.type === 'relayDisconnected' || 
          event.type === 'relayHealthy' || event.type === 'relayUnhealthy') {
        syncRelayStatuses()
      }
    })
    
    // Sync initial statuses
    syncRelayStatuses()
    
    // If user exists, start listening for their events
    if (hasUser && currentUser.value) {
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
  // Clean up widget resources
  cleanupWidgetResources()
  // Relay manager cleanup is handled by the manager itself
})

export function useNostrAuth() {
  // Initialize auth and relays when the composable is first used
  onMounted(async () => {
    console.log('🚀 useNostrAuth: Initializing auth and relays on mount...')
    await initAuthAndRelays()
  })

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
    
    // Utilities
    syncRelayStatuses
  }
}
