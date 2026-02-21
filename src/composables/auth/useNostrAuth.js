import { ref, reactive, computed, watch, onMounted } from 'vue'
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

// Initialization guard to prevent multiple setups
let isInitialized = false

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

  console.log('🔍 fetchAndStoreProfile: Starting fetch for', pubkey.substring(0, 16) + '...')

  // First, check what we have stored (so we don't overwrite good data with bad)
  let existingProfile = null
  const existingUser = localStorage.getItem(NOSTR_USER_KEY)
  if (existingUser) {
    try {
      const existing = JSON.parse(existingUser)
      if (existing.pubkey === pubkey && existing.profile?.picture) {
        existingProfile = existing
        console.log('📦 fetchAndStoreProfile: Have existing profile with picture')
      }
    } catch (e) {
      // ignore parse error
    }
  }

  try {
    const profile = await fetchProfile(pubkey)

    console.log('📥 fetchAndStoreProfile: Got profile response:', {
      name: profile?.name,
      picture: profile?.picture ? profile.picture.substring(0, 50) + '...' : 'NULL',
      nip05: profile?.nip05
    })

    // If fetched profile has no picture but we have existing with picture, keep existing
    if (!profile?.picture && existingProfile) {
      console.log('♻️ fetchAndStoreProfile: Fetched profile has no picture, keeping existing')
      currentUser.value = existingProfile
      return existingProfile
    }

    const npub = nip19.npubEncode(pubkey)
    const userData = {
      pubkey,
      npub,
      profile,
      lastUpdated: new Date().toISOString(),
      profileEvent: null
    }
    currentUser.value = userData
    saveUserToStorage(userData)

    console.log('✅ fetchAndStoreProfile: Profile stored successfully')
    return userData
  } catch (error) {
    console.error('❌ fetchAndStoreProfile: Error -', error.message)
    authError.value = `Failed to fetch profile: ${error.message}`

    // If we have a profile with picture, keep it
    if (existingProfile) {
      console.log('♻️ fetchAndStoreProfile: Keeping existing profile with picture (fetch failed)')
      currentUser.value = existingProfile
      return existingProfile
    }

    // Create fallback profile
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
    console.log('⚠️ fetchAndStoreProfile: Using fallback profile (no picture)')
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

// Fetch user's NIP-65 relay list (kind 10002) from Nostr
const fetchUserRelayList = async (pubkey) => {
  if (!pubkey) return null

  try {
    console.log('Fetching NIP-65 relay list for user:', pubkey.substring(0, 16) + '...')
    
    // Query for kind 10002 (NIP-65 relay list) from the user
    const relayListEvent = await nostrRelayManager.getEvent({
      kinds: [10002],
      authors: [pubkey],
      limit: 1
    })

    if (!relayListEvent) {
      console.log('No NIP-65 relay list found for user')
      return null
    }

    console.log('Found NIP-65 relay list event:', relayListEvent.id.substring(0, 16) + '...')

    // Parse relay list from tags
    // Format: ["r", "wss://relay.example.com", "read"] or ["r", "wss://relay.example.com", "write"] or ["r", "wss://relay.example.com"]
    const relays = []
    for (const tag of relayListEvent.tags) {
      if (tag[0] === 'r' && tag[1]) {
        const url = tag[1]
        const marker = tag[2] // "read", "write", or undefined (both)
        
        relays.push({
          url,
          read: !marker || marker === 'read',
          write: !marker || marker === 'write',
          status: 'disconnected'
        })
      }
    }

    console.log(`Parsed ${relays.length} relays from NIP-65 list:`, relays.map(r => r.url))
    return relays
  } catch (error) {
    console.error('Failed to fetch NIP-65 relay list:', error)
    return null
  }
}

// Update relay manager with user's relays
const updateRelaysFromNip65 = async (pubkey) => {
  const nip65Relays = await fetchUserRelayList(pubkey)
  
  if (nip65Relays && nip65Relays.length > 0) {
    console.log('Updating relay manager with user\'s NIP-65 relays...')
    
    // Merge NIP-65 relays with existing relays (NIP-65 takes priority)
    const existingUrls = new Set(userRelays.value.map(r => r.url))
    const newRelays = []
    
    for (const relay of nip65Relays) {
      if (!existingUrls.has(relay.url)) {
        newRelays.push(relay)
      } else {
        // Update existing relay with NIP-65 settings
        const existingIndex = userRelays.value.findIndex(r => r.url === relay.url)
        if (existingIndex !== -1) {
          userRelays.value[existingIndex] = {
            ...userRelays.value[existingIndex],
            read: relay.read,
            write: relay.write
          }
        }
      }
    }
    
    // Add new relays from NIP-65
    if (newRelays.length > 0) {
      userRelays.value = [...userRelays.value, ...newRelays]
      console.log(`Added ${newRelays.length} new relays from NIP-65 list`)
    }
    
    // Save updated relays
    saveRelaysToStorage(userRelays.value)
    
    // Update relay manager with new relays (don't re-initialize, just add new ones)
    try {
      await nostrRelayManager.updateRelays(nip65Relays)
      console.log('Relay manager updated with user relays')
    } catch (error) {
      console.warn('Failed to update relay manager:', error)
    }
    
    return true
  }
  
  return false
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

// Check if profile has essential data (picture)
const isProfileComplete = (userData) => {
  return userData?.profile?.picture && userData?.profile?.name
}

// Wait for relay manager to be ready (with timeout)
const waitForRelayManager = async (timeoutMs = 5000) => {
  const result = await Promise.race([
    nostrRelayManager.ready().then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), timeoutMs))
  ])
  if (!result) console.warn('Timeout waiting for relay manager')
  return result
}

// Login function - NIP-07 browser extension only
const login = async () => {
  console.log('🚀 Login with NIP-07 extension')

  // Check if user is already logged in with complete profile
  if (isAuthenticated.value && currentUser.value && isProfileComplete(currentUser.value)) {
    console.log('✅ User already logged in with complete profile:', currentUser.value.npub)
    return currentUser.value
  }

  // Check for NIP-07 extension
  if (!window.nostr) {
    const error = 'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 browser extension.'
    console.error('❌', error)
    authError.value = error
    throw new Error(error)
  }

  isLoading.value = true
  authError.value = ''

  try {
    // Get public key from extension
    console.log('🔑 Requesting public key from extension...')
    const pubkey = await window.nostr.getPublicKey()
    console.log('✅ Got pubkey:', pubkey.substring(0, 16) + '...')

    // Check if this user is already stored with complete profile
    const existingUser = localStorage.getItem(NOSTR_USER_KEY)
    if (existingUser) {
      try {
        const userData = JSON.parse(existingUser)
        if (userData.pubkey === pubkey && isProfileComplete(userData)) {
          console.log('♻️ Using stored profile (complete):', userData.npub, '- picture:', userData.profile?.picture?.substring(0, 30) + '...')
          currentUser.value = userData

          // Background tasks (don't block)
          if (nostrRelayManager.isInitialized) {
            startUserEventListener(pubkey)
            updateRelaysFromNip65(pubkey).catch(() => {})
          } else {
            console.log('⏳ Relay manager not ready, will start listeners later')
          }
          return userData
        } else if (userData.pubkey === pubkey) {
          console.log('⚠️ Stored profile incomplete (missing picture)')
          // Set the incomplete profile for now so UI shows something
          currentUser.value = userData
        }
      } catch (e) {
        console.warn('Failed to parse stored user:', e)
      }
    }

    // Check if relay manager is ready before fetching
    if (!nostrRelayManager.isInitialized) {
      console.log('⏳ Waiting for relay manager to be ready...')
      const ready = await waitForRelayManager(5000)
      if (!ready) {
        console.warn('⚠️ Relay manager not ready, using stored/fallback profile')
        // If we have a stored user (even incomplete), return it
        if (currentUser.value) {
          console.log('♻️ Returning stored profile (relay timeout)')
          // Schedule background refresh when relays are ready
          scheduleProfileRefresh(pubkey)
          return currentUser.value
        }
        // Create minimal profile
        const npub = nip19.npubEncode(pubkey)
        const fallbackUser = {
          pubkey,
          npub,
          profile: {
            name: `User ${pubkey.substring(0, 8)}`,
            picture: null
          },
          lastUpdated: new Date().toISOString()
        }
        currentUser.value = fallbackUser
        saveUserToStorage(fallbackUser)
        scheduleProfileRefresh(pubkey)
        return fallbackUser
      }
    }

    // Fetch profile from relays (fresh fetch)
    console.log('📥 Fetching profile from relays...')
    const userData = await fetchAndStoreProfile(pubkey)
    console.log('✅ Login complete:', userData.profile?.name || userData.npub, '- picture:', userData.profile?.picture ? 'YES' : 'NO')

    // Background tasks
    startUserEventListener(pubkey)
    updateRelaysFromNip65(pubkey).catch(() => {})

    return userData
  } catch (error) {
    console.error('❌ Login error:', error)
    authError.value = error.message || 'Login failed'
    throw error
  } finally {
    isLoading.value = false
  }
}

// Schedule a profile refresh when relay manager becomes ready
const scheduleProfileRefresh = async (pubkey) => {
  await nostrRelayManager.ready()
  try {
    await fetchAndStoreProfile(pubkey)
  } catch (e) {
    console.warn('Failed scheduled profile refresh:', e)
  }
}

// Logout function
const logout = () => {
  try {
    console.log('👋 Logging out...')

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

    // Reset initialization flag for clean re-initialization after reload
    isInitialized = false

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

// Helper function to restore session from window.nostr
const restoreSessionFromWindowNostr = async () => {
  if (!window.nostr || !window.nostr.getPublicKey) {
    return false
  }

  try {
    console.log('🔑 Attempting to restore session from window.nostr...')
    const pubkey = await window.nostr.getPublicKey()
    console.log('Got pubkey from nostr:', pubkey.substring(0, 16) + '...')

    // Check if this user is already stored
    const existingUser = localStorage.getItem(NOSTR_USER_KEY)
    if (existingUser) {
      try {
        const userData = JSON.parse(existingUser)
        if (userData.pubkey === pubkey) {
          console.log('♻️ Restoring user from stored data:', userData.npub)
          currentUser.value = userData

          // Fetch and update user's NIP-65 relay list
          console.log('Fetching user\'s NIP-65 relay list...')
          await updateRelaysFromNip65(pubkey)

          // Start listening for user events
          startUserEventListener(pubkey)

          console.log('Session restored successfully!')
          return true
        } else {
          console.log('Different user detected, fetching new profile...')
        }
      } catch (error) {
        console.warn('Failed to parse existing user data:', error)
      }
    }

    // Fetch and store profile for new/different user
    console.log('Fetching user profile...')
    const userData = await fetchAndStoreProfile(pubkey)
    console.log('Profile fetched successfully:', userData.npub)

    // Fetch and update user's NIP-65 relay list
    console.log('Fetching user\'s NIP-65 relay list...')
    await updateRelaysFromNip65(pubkey)

    // Start listening for user events
    startUserEventListener(pubkey)

    console.log('Session restored successfully!')
    return true
  } catch (error) {
    console.warn('Failed to restore session from window.nostr:', error)
    return false
  }
}

// Initialize auth and relays - simplified for NIP-07 only
const initAuthAndRelays = async () => {
  if (isInitialized) {
    console.log('Auth already initialized, skipping...')
    return
  }
  isInitialized = true
  console.log('🚀 Initializing Nostr auth and relays...')

  try {
    // Load user from storage first
    const hasUser = loadUserFromStorage()

    // Log what we loaded
    if (hasUser) {
      console.log('📦 Loaded user from storage:', {
        npub: currentUser.value?.npub,
        name: currentUser.value?.profile?.name,
        hasPicture: !!currentUser.value?.profile?.picture
      })
    }

    // Load or initialize relays
    if (!loadRelaysFromStorage()) {
      console.log('No saved relays found, using defaults')
      userRelays.value = [...DEFAULT_RELAYS]
      saveRelaysToStorage(userRelays.value)
    }

    // Initialize relay manager
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

    // If user is stored and extension is available, verify/restore session
    if (hasUser && window.nostr?.getPublicKey) {
      console.log('🔑 Extension available, verifying session...')
      try {
        const pubkey = await window.nostr.getPublicKey()
        if (currentUser.value?.pubkey === pubkey) {
          console.log('✅ Session verified for:', currentUser.value.npub)

          // Check if profile is complete (has picture)
          if (!isProfileComplete(currentUser.value)) {
            console.log('⚠️ Profile incomplete (missing picture), fetching fresh profile...')
            // Fetch fresh profile - this will update currentUser and save to storage
            try {
              await fetchAndStoreProfile(pubkey)
              console.log('✅ Profile refreshed:', {
                name: currentUser.value?.profile?.name,
                hasPicture: !!currentUser.value?.profile?.picture
              })
            } catch (e) {
              console.warn('Failed to refresh profile:', e)
            }
          } else {
            console.log('✅ Profile complete with picture')
          }

          startUserEventListener(pubkey)
          updateRelaysFromNip65(pubkey).catch(() => {})
        } else {
          console.log('🔄 Different user in extension, clearing stored user')
          currentUser.value = null
          localStorage.removeItem(NOSTR_USER_KEY)
        }
      } catch (e) {
        console.log('ℹ️ Could not verify session (extension may need unlock)')
      }
    } else if (hasUser) {
      // User stored but no extension - keep for display, login required for actions
      console.log('ℹ️ User loaded from storage (extension needed for signing)')

      // Even without extension, try to refresh profile if incomplete
      if (!isProfileComplete(currentUser.value) && currentUser.value?.pubkey) {
        console.log('⚠️ Profile incomplete, attempting background refresh...')
        fetchAndStoreProfile(currentUser.value.pubkey).catch((e) => {
          console.warn('Background profile refresh failed:', e)
        })
      }
    }

    // Start event listener if user exists
    if (currentUser.value) {
      setTimeout(() => {
        startUserEventListener(currentUser.value.pubkey)
      }, 2000)
    }
  } catch (error) {
    console.error('Failed to initialize auth and relays:', error)
    authError.value = 'Failed to initialize Nostr connection'
    isInitialized = false
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
    fetchUserRelayList,
    updateRelaysFromNip65,
    
    // Utilities
    syncRelayStatuses
  }
}
