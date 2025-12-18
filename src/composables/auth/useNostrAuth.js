import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { SimplePool } from 'nostr-tools/pool'
import * as nip19 from 'nostr-tools/nip19'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { initializeNWC } from '../../utils/wallet/nwcClient.js'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'

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
  { url: 'wss://relay.primal.net', status: 'disconnected', read: true, write: true },
  { url: 'wss://nostr.wine', status: 'disconnected', read: true, write: true },
  { url: 'wss://relay.nostr.band', status: 'disconnected', read: true, write: false },
  { url: 'wss://nostr-01.yakihonne.com', status: 'disconnected', read: true, write: false },
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

// Fetch user profile using centralized profileFetcher
const fetchAndStoreProfile = async (pubkey) => {
  if (!pubkey) {
    throw new Error('No pubkey provided')
  }
  isLoading.value = true
  authError.value = ''
  try {
    const profile = await fetchProfile(pubkey)
    const npub = nip19.npubEncode(pubkey)
    const userData = {
      pubkey,
      npub,
      profile,
      lastUpdated: new Date().toISOString(),
      profileEvent: null // Not used with centralized fetcher
    }
    currentUser.value = userData
    saveUserToStorage(userData)
    return userData
  } catch (error) {
    authError.value = `Failed to fetch profile: ${error.message}`
    // Fallback minimal user data
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
  } finally {
    isLoading.value = false
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

// Start listening for user events using relay manager
const startUserEventListener = (pubkey) => {
  if (!pubkey) return

  try {
    // Subscribe to user's events using relay manager
    const sub = nostrRelayManager.subscribeToEvents([
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
        // console.log('Received user event:', event)
        // Emit custom event for other parts of the app
        document.dispatchEvent(new CustomEvent('nostr:event', { detail: event }))
      },
      oneose: () => {
        console.log('End of stored events for user:', pubkey)
      },
      onclose: (reasons) => {
        console.log('User event subscription closed:', reasons)
      }
    })

    console.log('Started listening for events for user:', pubkey)
    return sub
  } catch (error) {
    console.error('Failed to start user event listener:', error)
    return null
  }
}

// Check if nostr-login is available
const checkNostrLoginAvailable = () => {
  const checks = {
    windowNostr: typeof window !== 'undefined' && 'nostr' in window,
    hasNostrLoginScript: !!document.querySelector('script[src*="nostr-login"]'),
    canDispatchEvents: typeof document !== 'undefined' && typeof CustomEvent !== 'undefined'
  }

  console.log('🔍 Nostr-login availability check:', checks)
  return checks
}

// Login function
const login = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Login function called')
    isLoading.value = true
    authError.value = ''

    // Check if user is already logged in
    if (isAuthenticated.value && currentUser.value) {
      console.log('✅ User already logged in:', currentUser.value.npub)
      isLoading.value = false
      resolve(currentUser.value)
      return
    }

    // Check nostr-login availability
    const availability = checkNostrLoginAvailable()
    if (!availability.hasNostrLoginScript) {
      console.error('❌ Nostr-login script not found in DOM')
      authError.value = 'Nostr-login not properly loaded. Please refresh the page.'
      isLoading.value = false
      reject(new Error('Nostr-login script not loaded'))
      return
    }

    console.log('📡 Setting up authentication flow...')

    // Track timeout and interval for cleanup
    let timeoutId = null
    let progressInterval = null

    // Listen for auth events
    const handleAuth = async (event) => {
      try {
        console.log('🎉 Nostr auth event received:', {
          type: event.type,
          detail: event.detail,
          hasWindowNostr: !!window.nostr
        })

        // Clear timeout and interval since we got a response
        if (timeoutId) clearTimeout(timeoutId)
        if (progressInterval) clearInterval(progressInterval)

        if (window.nostr && window.nostr.getPublicKey) {
          console.log('🔑 Fetching public key from window.nostr...')
          const pubkey = await window.nostr.getPublicKey()
          console.log('✅ Got pubkey from nostr:', pubkey.substring(0, 16) + '...')

          // Check if this user is already stored
          const existingUser = localStorage.getItem(NOSTR_USER_KEY)
          if (existingUser) {
            try {
              const userData = JSON.parse(existingUser)
              if (userData.pubkey === pubkey) {
                console.log('♻️ User already exists, using stored data:', userData.npub)
                currentUser.value = userData

                // Start listening for user events
                startUserEventListener(pubkey)

                // Clean up event listener
                document.removeEventListener('nlAuth', handleAuth)

                console.log('✅ Authentication completed successfully!')
                resolve(userData)
                return
              } else {
                console.log('🔄 Different user detected, fetching new profile...')
              }
            } catch (error) {
              console.warn('⚠️ Failed to parse existing user data:', error)
            }
          }

          // Fetch and store profile for new user
          console.log('📥 Fetching user profile...')
          const userData = await fetchAndStoreProfile(pubkey)
          console.log('✅ Profile fetched successfully:', userData.npub)

          // Start listening for user events
          startUserEventListener(pubkey)

          // Clean up event listener
          document.removeEventListener('nlAuth', handleAuth)

          console.log('✅ Authentication completed successfully!')
          resolve(userData)
        } else {
          console.error('❌ window.nostr not available or missing getPublicKey')
          throw new Error('Nostr provider not available. Please connect using the nostr-login modal.')
        }
      } catch (error) {
        console.error('❌ Auth error:', error)
        authError.value = error.message

        // Clean up timers
        if (timeoutId) clearTimeout(timeoutId)
        if (progressInterval) clearInterval(progressInterval)

        document.removeEventListener('nlAuth', handleAuth)
        reject(error)
      } finally {
        isLoading.value = false
      }
    }

    // Add event listener
    console.log('👂 Adding nlAuth event listener...')
    document.addEventListener('nlAuth', handleAuth)

    // Dispatch login event
    console.log('🚀 Dispatching nlLaunch event to trigger nostr-login modal...')
    document.dispatchEvent(new Event('nlLaunch'))

    // Log after a short delay to check if modal appeared
    setTimeout(() => {
      if (isLoading.value) {
        console.log('⏳ Waiting for user to complete authentication in nostr-login modal...')
        console.log('💡 Take your time! The app will wait for you to:')
        console.log('   • Choose your authentication method')
        console.log('   • Enter your credentials')
        console.log('   • Complete the login process')
        console.log('')
        console.log('⚠️ If modal did not appear, check:')
        console.log('   1. Browser console for nostr-login errors')
        console.log('   2. If nostr-login CDN is accessible')
        console.log('   3. If popup blockers are interfering')
      }
    }, 1000)

    // Progress reminders every 30 seconds
    progressInterval = setInterval(() => {
      if (isLoading.value) {
        console.log('⏳ Still waiting for authentication... Take your time!')
      } else {
        clearInterval(progressInterval)
      }
    }, 30000)

    // Extended timeout - 5 minutes to give users plenty of time
    const timeoutDuration = 300000 // 5 minutes (300 seconds)
    timeoutId = setTimeout(() => {
      if (isLoading.value) {
        console.error(`⏰ Login timeout - no response after ${timeoutDuration / 60000} minutes`)
        console.log('💡 This usually means:')
        console.log('   • You closed the authentication modal')
        console.log('   • The modal did not appear due to popup blocker')
        console.log('   • You can try clicking "Connect Nostr" again')

        clearInterval(progressInterval)
        document.removeEventListener('nlAuth', handleAuth)
        isLoading.value = false
        authError.value = 'Authentication timed out. Please try again.'
        reject(new Error('Login timeout'))
      }
    }, timeoutDuration)
  })
}

// Logout function
const logout = () => {
  try {
    // Dispatch logout event
    document.dispatchEvent(new Event('nlLogout'))
    
    // Clear state (but preserve relays)
    currentUser.value = null
    authError.value = ''
    // NOTE: We intentionally DO NOT clear userRelays.value here
    // Relays should persist across logout/login sessions
    
    // Clear authentication-related localStorage data
    // NOTE: We intentionally preserve user-created content (campaigns, follow packs, relays)
    // so they can be restored after re-login
    const nostrKeys = [
      // Authentication data
      NOSTR_USER_KEY, // 'nostrUser'
      // NOSTR_RELAYS_KEY is intentionally NOT cleared - relays persist across sessions
      
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
    
    // PRESERVE these keys across logout/login:
    // - 'user_campaigns' (campaigns persist in Nostr relays)
    // - 'campaign_aggregated_zaps' (zap data for campaigns)
    // - 'follow_lists_my' (user's follow packs)
    // - 'follow_lists_discovered' (discovered follow packs)
    // - 'follow_lists_profiles' (cached profiles for follow pack members)
    
    nostrKeys.forEach(key => {
      localStorage.removeItem(key)
    })
    
    // Clean up NWC client and relay manager
    initializeNWC(null)
    nostrRelayManager.cleanup()
    
    console.log('User logged out successfully')
    console.log('Preserved data: relays, campaigns, follow packs (will be restored on re-login)')
    
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
    refreshUserProfile: async () => {
      if (!currentUser.value) throw new Error('No user logged in')
      return await fetchAndStoreProfile(currentUser.value.pubkey)
    },
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
