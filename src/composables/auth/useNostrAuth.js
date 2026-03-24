import { ref, computed, watch, onMounted } from 'vue'
import { nip19, parseRelayList } from '../../services/nostr/nostrImports.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { initializeNWC } from '../../utils/wallet/nwcClient.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { DEFAULT_RELAY_CONFIGS_WITH_STATUS } from '../../utils/constants.js'
import { stopRefreshCycle } from '../../utils/refreshCycle.js'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'

// Global state for Nostr authentication
const currentUser = ref(null)
const isLoading = ref(false)
const authError = ref('')
const userRelays = ref([])
const relayError = ref('')

// Initialization guard to prevent multiple setups
let isInitialized = false

// Module-scoped subscription for user event listener
let userEventSub = null

// Default relays (from shared constants)
const DEFAULT_RELAYS = DEFAULT_RELAY_CONFIGS_WITH_STATUS

// Load user from localStorage
const loadUserFromStorage = () => {
  const userData = storageService.get(STORAGE_KEYS.USER)
  if (userData) {
    currentUser.value = userData
    return true
  }
  return false
}

// Save user to localStorage
const saveUserToStorage = (userData) => {
  storageService.set(STORAGE_KEYS.USER, userData)
}

// Load relays from localStorage
const loadRelaysFromStorage = () => {
  const relayData = storageService.get(STORAGE_KEYS.RELAYS)
  if (relayData) {
    userRelays.value = relayData
    return true
  }
  return false
}

// Save relays to localStorage
const saveRelaysToStorage = (relayData) => {
  storageService.set(STORAGE_KEYS.RELAYS, relayData)
}

// Sync relay statuses from relay manager
const syncRelayStatuses = () => {
  const managerStatuses = nostrService.getRelayStatuses()
  
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

// Fetch user profile using ProfileService
const fetchAndStoreProfile = async (pubkey) => {
  if (!pubkey) {
    throw new Error('No pubkey provided')
  }
  isLoading.value = true
  authError.value = ''

  // First, check what we have stored (so we don't overwrite good data with bad)
  let existingProfile = null
  const existing = storageService.get(STORAGE_KEYS.USER)
  if (existing?.pubkey === pubkey && existing?.profile?.picture) {
    existingProfile = existing
  }

  try {
    const profile = await profileService.get(pubkey)

    // If fetched profile has no picture but we have existing with picture, keep existing
    if (!profile?.picture && existingProfile) {
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
    return userData
  } catch (error) {
    console.error('fetchAndStoreProfile failed:', error.message)
    authError.value = `Failed to fetch profile: ${error.message}`

    // If we have a profile with picture, keep it
    if (existingProfile) {
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
    return userData
  } finally {
    isLoading.value = false
  }
}

// Check relay status using relay manager
const checkRelayStatus = async (url) => {
  const relay = userRelays.value.find(r => r.url === url)
  if (!relay) return false

  try {
    // The relay manager handles connection checking
    await nostrService.addRelay(url, { read: relay.read, write: relay.write })
    return true
  } catch (error) {
    console.error(`Failed to check relay ${url}:`, error.message || error)
    return false
  }
}

// Check all relay statuses
const checkAllRelayStatuses = async () => {
  relayError.value = ''

  try {
    // Initialize relay manager with current relays
    await nostrService.initialize(userRelays.value)

    // Sync statuses back to our state
    syncRelayStatuses()

    const stats = nostrService.getConnectionStats()
    
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
    await nostrService.addRelay(url, options)
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
  nostrService.removeRelay(url)
  
  return true
}

// Fetch user's NIP-65 relay list (kind 10002) from Nostr
// Uses nostr-core's parseRelayList for spec-correct parsing.
const fetchUserRelayList = async (pubkey) => {
  if (!pubkey) return null

  try {
    const relayListEvent = await nostrService.queryOne({
      kinds: [10002],
      authors: [pubkey],
      limit: 1
    })

    if (!relayListEvent) {
      return null
    }

    // nostr-core parseRelayList returns [{url, read, write}]
    const parsed = parseRelayList(relayListEvent)
    return parsed.map(r => ({
      url: r.url,
      read: r.read,
      write: r.write,
      status: 'disconnected'
    }))
  } catch (error) {
    console.error('Failed to fetch NIP-65 relay list:', error)
    return null
  }
}

// Update relay manager with user's relays
const updateRelaysFromNip65 = async (pubkey) => {
  const nip65Relays = await fetchUserRelayList(pubkey)
  
  if (nip65Relays && nip65Relays.length > 0) {
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
    }

    // Save updated relays
    saveRelaysToStorage(userRelays.value)

    // Update relay manager with new relays (don't re-initialize, just add new ones)
    try {
      await nostrService.updateRelays(nip65Relays)
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

  // Close any existing user event subscription first
  if (userEventSub) {
    userEventSub.close()
    userEventSub = null
  }

  try {
    // Subscribe to user's events using relay manager
    const sub = nostrService.subscribe([
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
      oneose: () => {},
      onclose: () => {}
    })

    userEventSub = sub
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
    nostrService.ready().then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), timeoutMs))
  ])
  if (!result) console.warn('Timeout waiting for relay manager')
  return result
}

// Login function - NIP-07 browser extension
const login = async () => {
  // Check if user is already logged in with complete profile
  if (isAuthenticated.value && currentUser.value && isProfileComplete(currentUser.value)) {
    return currentUser.value
  }

  // Check for NIP-07 extension
  if (!signerService.isExtensionAvailable()) {
    const error = 'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 browser extension.'
    authError.value = error
    throw new Error(error)
  }

  isLoading.value = true
  authError.value = ''

  try {
    // Connect to browser extension and get public key
    const pubkey = await signerService.connectExtension()

    // Check if this user is already stored with complete profile
    const storedUser = storageService.get(STORAGE_KEYS.USER)
    if (storedUser) {
      if (storedUser.pubkey === pubkey && isProfileComplete(storedUser)) {
        currentUser.value = storedUser

        // Background tasks (don't block — relay manager ready() is awaited internally)
        nostrService.ready().then(() => {
          startUserEventListener(pubkey)
          updateRelaysFromNip65(pubkey).catch(e => {
            console.warn('NIP-65 relay update failed:', e.message)
          })
        }).catch(() => {
          console.warn('Relay manager failed to become ready, skipping NIP-65 + listener')
        })
        return storedUser
      } else if (storedUser.pubkey === pubkey) {
        // Set the incomplete profile for now so UI shows something
        currentUser.value = storedUser
      }
    }

    // Check if relay manager is ready before fetching
    if (!nostrService.isInitialized) {
      const ready = await waitForRelayManager(5000)
      if (!ready) {
        // If we have a stored user (even incomplete), return it
        if (currentUser.value) {
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
    const userData = await fetchAndStoreProfile(pubkey)

    // Background tasks
    startUserEventListener(pubkey)
    updateRelaysFromNip65(pubkey).catch(e => {
      console.warn('NIP-65 relay update failed:', e.message)
    })

    return userData
  } catch (error) {
    console.error('Login error:', error)
    authError.value = error.message || 'Login failed'
    throw error
  } finally {
    isLoading.value = false
  }
}

// Login with NIP-46 remote signer (Amber, nsec.app, etc.)
const loginWithRemote = async (connectionUri) => {
  if (!connectionUri?.trim()) {
    const error = 'Please enter a bunker:// or nostrconnect:// URI'
    authError.value = error
    throw new Error(error)
  }

  isLoading.value = true
  authError.value = ''

  try {
    // Connect via NIP-46
    const pubkey = await signerService.connectRemote(connectionUri.trim())

    // Store connection type for session restore
    storageService.setRaw(STORAGE_KEYS.SIGNER_TYPE, 'remote')
    storageService.setRaw(STORAGE_KEYS.REMOTE_URI, connectionUri.trim())

    // Check if relay manager is ready
    if (!nostrService.isInitialized) {
      await waitForRelayManager(5000)
    }

    // Fetch profile
    const userData = await fetchAndStoreProfile(pubkey)

    // Background tasks
    startUserEventListener(pubkey)
    updateRelaysFromNip65(pubkey).catch(e => {
      console.warn('NIP-65 relay update failed:', e.message)
    })

    return userData
  } catch (error) {
    console.error('Remote login error:', error)
    authError.value = error.message || 'Remote signer connection failed'
    throw error
  } finally {
    isLoading.value = false
  }
}

// Schedule a profile refresh when relay manager becomes ready
const scheduleProfileRefresh = async (pubkey) => {
  try {
    await nostrService.ready()
    await fetchAndStoreProfile(pubkey)
  } catch (e) {
    console.warn('Failed scheduled profile refresh:', e.message)
  }
}

// Logout function
const logout = () => {
  try {
    // Clear state (but preserve relays)
    currentUser.value = null
    authError.value = ''
    // NOTE: We intentionally DO NOT clear userRelays.value here
    // Relays should persist across logout/login sessions
    
    // Clear authentication-related localStorage data
    // NOTE: We intentionally preserve user-created content (campaigns, follow packs, relays)
    // so they can be restored after re-login
    // PRESERVE these keys across logout/login:
    // - 'user_campaigns' (campaigns persist in Nostr relays)
    // - 'campaign_aggregated_zaps' (zap data for campaigns)
    // - 'follow_lists_my' (user's follow packs)
    // - 'follow_lists_discovered' (discovered follow packs)
    // - 'follow_lists_profiles' (cached profiles for follow pack members)
    storageService.clearAuthData()
    
    // Close user event listener subscription
    if (userEventSub) {
      userEventSub.close()
      userEventSub = null
    }

    // Disconnect signer, stop refresh cycle, NWC client, and relay manager
    signerService.disconnect().catch(() => {})
    stopRefreshCycle()
    initializeNWC(null)
    nostrService.cleanup()

    // Reset initialization flag for clean re-initialization after reload
    isInitialized = false

    // Reload the page to reset all components
    window.location.reload()
    
    return true
  } catch (error) {
    console.error('Logout error:', error)
    authError.value = 'Failed to logout'
    return false
  }
}

// Initialize auth and relays - simplified for NIP-07 only
const initAuthAndRelays = async () => {
  if (isInitialized) return
  isInitialized = true

  try {
    // Load user from storage first
    const hasUser = loadUserFromStorage()

    // Load or initialize relays
    if (!loadRelaysFromStorage()) {
      userRelays.value = [...DEFAULT_RELAYS]
      saveRelaysToStorage(userRelays.value)
    }

    // Initialize relay manager
    await nostrService.initialize(userRelays.value)

    // Set up relay manager event listeners
    nostrService.addEventListener((event) => {
      if (event.type === 'relayConnected' || event.type === 'relayDisconnected' ||
          event.type === 'relayHealthy' || event.type === 'relayUnhealthy') {
        syncRelayStatuses()
      }
    })

    // Sync initial statuses
    syncRelayStatuses()

    // Restore signer session — supports NIP-07 extension and NIP-46 remote signer
    if (hasUser) {
      const storedSignerType = storageService.getRaw(STORAGE_KEYS.SIGNER_TYPE)
      const storedRemoteUri = storageService.getRaw(STORAGE_KEYS.REMOTE_URI)
      let restoredPubkey = null

      try {
        if (storedSignerType === 'remote' && storedRemoteUri) {
          // NIP-46: reconnect to remote signer
          restoredPubkey = await signerService.connectRemote(storedRemoteUri)
        } else if (signerService.isExtensionAvailable()) {
          // NIP-07: reconnect to browser extension
          restoredPubkey = await signerService.connectExtension()
        }
      } catch (e) {
        // Signer may need unlock or be unavailable — keep stored profile for display
        console.warn('Signer session restore failed:', e.message)
      }

      if (restoredPubkey && currentUser.value?.pubkey === restoredPubkey) {
        // Signer matched stored user — refresh profile if incomplete
        if (!isProfileComplete(currentUser.value)) {
          fetchAndStoreProfile(restoredPubkey).catch(e => {
            console.warn('Failed to refresh profile:', e)
          })
        }

        startUserEventListener(restoredPubkey)
        updateRelaysFromNip65(restoredPubkey).catch(e => {
          console.warn('NIP-65 relay update failed:', e.message)
        })
      } else if (restoredPubkey && currentUser.value?.pubkey !== restoredPubkey) {
        // Different pubkey from signer — clear stale user
        currentUser.value = null
        storageService.remove(STORAGE_KEYS.USER)
      } else {
        // No signer available — keep profile for display, fetch if incomplete
        if (!isProfileComplete(currentUser.value) && currentUser.value?.pubkey) {
          fetchAndStoreProfile(currentUser.value.pubkey).catch(e => {
            console.warn('Background profile fetch failed:', e.message)
          })
        }
        // Start event listener with delay for display-only mode
        if (currentUser.value) {
          setTimeout(() => {
            startUserEventListener(currentUser.value.pubkey)
          }, 2000)
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize auth and relays:', error)
    authError.value = 'Failed to initialize Nostr connection'
    isInitialized = false
  }
}

// Computed properties
const isAuthenticated = computed(() => !!currentUser.value)
const userProfile = computed(() => currentUser.value?.profile || null)
const connectedRelays = computed(() => userRelays.value.filter(relay => relay.status === 'connected'))
const readRelays = computed(() => userRelays.value.filter(relay => relay.read && relay.status === 'connected'))
const writeRelays = computed(() => userRelays.value.filter(relay => relay.write && relay.status === 'connected'))

// Watch for changes and save to storage (debounced to avoid localStorage thrashing)
let _authSaveTimer = null
const debouncedSaveUser = () => {
  if (_authSaveTimer) clearTimeout(_authSaveTimer)
  _authSaveTimer = setTimeout(() => {
    if (currentUser.value) saveUserToStorage(currentUser.value)
  }, 2000)
}
// Watch specific user properties that matter for storage (avoid deep watch on entire user object)
watch(
  () => currentUser.value && `${currentUser.value.pubkey}|${currentUser.value.profile?.name}|${currentUser.value.profile?.picture}|${currentUser.value.profile?.nip05}|${currentUser.value.profile?.about}|${currentUser.value.profile?.display_name}`,
  debouncedSaveUser
)

watch(() => userRelays.value.length, () => {
  saveRelaysToStorage(userRelays.value)
})

export function useNostrAuth() {
  // Initialize auth and relays when the composable is first used
  onMounted(async () => {
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
    loginWithRemote,
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
