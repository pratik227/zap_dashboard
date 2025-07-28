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



// Helper function to get Nostr profile using smart-widget-handler
const getSmartWidgetProfile = () => {
  return new Promise((resolve, reject) => {
    // Set a timeout to reject after 5 seconds
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout waiting for smart widget profile'));
    }, 5000);
    
    try {
      // Notify the parent that the widget is ready
      SWHandler.client.ready();
      console.log('Sent ready signal to smart widget parent');
      
      // Listen for messages from parent
      const listener = SWHandler.client.listen((data) => {
        console.log('Received message from smart widget parent:', data);
        
        if (data.kind === 'user-metadata' && data.data && data.data.user) {
          // When user-metadata is received, clear timeout and resolve
          clearTimeout(timeoutId);
          if (listener) listener.close();
          
          console.log('User data received from smart widget:', data.data.user);
          resolve(data.data.user);
        }
      });
    } catch (error) {
      console.error('Error setting up SWHandler listener:', error);
      clearTimeout(timeoutId);
      reject(error);
    }
  });
};

// Login function - handles both smart widget and standard Nostr extension auth
const login = () => {
  return new Promise((resolve, reject) => {
    isLoading.value = true;
    authError.value = '';
    
    console.log('Login function called, checking authentication state...');

    // Check if user is already logged in (from previous session)
    if (isAuthenticated.value && currentUser.value) {
      console.log('User already logged in:', currentUser.value.npub);
      isLoading.value = false;
      resolve(currentUser.value);
      return;
    }
    
    // Try smart widget authentication first, then fall back to standard auth
    getSmartWidgetProfile()
      .then(profile => {
        console.log('Successfully received profile via smart-widget-handler:', profile);
        return processSmartWidgetProfile(profile);
      })
      .then(userData => resolve(userData))
      .catch(error => {
        console.log('Smart widget auth failed, falling back to standard Nostr extension auth:', error.message);
        // Fall back to standard Nostr extension auth
        startStandardNostrAuth(resolve, reject);
      });
  });
};

// Helper function to process smart widget profile
const processSmartWidgetProfile = async (profile) => {
  console.log('Processing smart widget profile:', profile);
  
  // Check if this user is already stored locally
  const existingUser = localStorage.getItem(NOSTR_USER_KEY);
  if (existingUser) {
    try {
      const userData = JSON.parse(existingUser);
      if (userData.pubkey === profile.pubkey) {
        console.log('Smart widget user already exists in storage, using stored data:', userData.npub);
        currentUser.value = userData;
        startUserEventListener(profile.pubkey);
        isLoading.value = false;
        return userData;
      }
    } catch (error) {
      console.warn('Failed to parse existing user data during smart widget login attempt:', error);
    }
  }
  
  // Create user data from smart widget profile
  try {
    // If profile has all needed data, create user directly without fetching
    const npub = profile.npub || nip19.npubEncode(profile.pubkey);
    
    const userData = {
      pubkey: profile.pubkey,
      npub: npub,
      profile: {
        name: profile.name || profile.display_name || `User ${profile.pubkey.substring(0, 8)}`,
        display_name: profile.display_name || profile.name || null,
        about: profile.about || 'Nostr user',
        picture: profile.picture || null,
        nip05: profile.nip05 || null,
        lud16: profile.lud16 || null,
        lud06: profile.lud06 || null,
        website: profile.website || null,
        banner: profile.banner || null
      },
      lastUpdated: new Date().toISOString(),
      profileEvent: null,
      source: 'smart-widget' // Mark the source for tracking
    };
    
    console.log('Created user data from smart widget profile:', userData);
    currentUser.value = userData;
    saveUserToStorage(userData);
    startUserEventListener(profile.pubkey);
    isLoading.value = false;
    return userData;
  } catch (error) {
    console.error('Error creating user from smart widget profile:', error);
    
    // Fall back to fetching profile from relays
    console.log('Falling back to fetching profile from relays for pubkey:', profile.pubkey);
    const userData = await fetchAndStoreProfile(profile.pubkey);
    userData.source = 'smart-widget'; // Mark the source
    currentUser.value = userData;
    startUserEventListener(userData.pubkey);
    isLoading.value = false;
    return userData;
  }
};

// Helper function to start standard Nostr extension auth
const startStandardNostrAuth = (resolve, reject) => {
  console.log('Starting standard Nostr extension auth flow...');
  
  // Listen for auth events from Nostr extension
  const handleAuth = async (event) => {
    try {
      console.log('Nostr auth event received from extension:', event.detail);

      if (window.nostr && window.nostr.getPublicKey) {
        const pubkey = await window.nostr.getPublicKey();
        console.log('Got pubkey from nostr extension:', pubkey);

        // Check if this user is already stored from extension login
        const existingUser = localStorage.getItem(NOSTR_USER_KEY);
        if (existingUser) {
          try {
            const userData = JSON.parse(existingUser);
            if (userData.pubkey === pubkey) {
              console.log('User from extension already exists, using stored data:', userData.npub);
              currentUser.value = userData;
              startUserEventListener(pubkey);
              document.removeEventListener('nlAuth', handleAuth);
              resolve(userData);
              return;
            }
          } catch (error) {
            console.warn('Failed to parse existing user data during extension login:', error);
          }
        }

        // Fetch and store profile for new user from extension
        const userData = await fetchAndStoreProfile(pubkey);
        currentUser.value = userData;
        startUserEventListener(pubkey);
        document.removeEventListener('nlAuth', handleAuth);
        resolve(userData);
      } else {
        throw new Error('Nostr extension not available for sign-in');
      }
    } catch (error) {
      console.error('Auth error during extension login:', error);
      authError.value = error.message;
      document.removeEventListener('nlAuth', handleAuth);
      reject(error);
    } finally {
      isLoading.value = false;
    }
  };

  // Add event listener for extension login
  document.addEventListener('nlAuth', handleAuth);

  // Dispatch login event to trigger extension interaction
  document.dispatchEvent(new Event('nlLaunch'));

  // Timeout for extension login
  setTimeout(() => {
    if (isLoading.value) {
      document.removeEventListener('nlAuth', handleAuth);
      isLoading.value = false;
      authError.value = 'Login timeout (Nostr extension) - please try again';
      reject(new Error('Login timeout (Nostr extension)'));
    }
  }, 60000);
};

// Logout function
const logout = () => {
  try {
    // Dispatch logout event
    document.dispatchEvent(new Event('nlLogout'))

    // Clear state
    currentUser.value = null
    authError.value = ''
    userRelays.value = []

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
const initAuthAndRelays = () => {
  console.log('Initializing auth and relays...');
  
  // Load relays from storage or use defaults
  if (!loadRelaysFromStorage()) {
    console.log('No relays in storage, using defaults');
    userRelays.value = DEFAULT_RELAYS;
    saveRelaysToStorage(userRelays.value);
  }
  
  // Initialize relay manager with relays
  nostrRelayManager.initialize(userRelays.value)
    .then(() => {
      syncRelayStatuses();
      console.log('Relay manager initialized with', userRelays.value.length, 'relays');
    })
    .catch(error => {
      console.error('Failed to initialize relay manager:', error);
      relayError.value = 'Failed to initialize relays';
    });
  
  // Try to load user from storage
  if (loadUserFromStorage()) {
    console.log('User loaded from storage, attempting to connect to relays...');
    
    // Start listening for user events
    if (currentUser.value && currentUser.value.pubkey) {
      startUserEventListener(currentUser.value.pubkey);
    }
    
    // Initialize NWC if user has wallet
    if (currentUser.value && currentUser.value.nwcUrl) {
      initializeNWC(currentUser.value.nwcUrl);
    }
  } else {
    console.log('No user in storage');
    
    // Check if we're in Yakihonne iframe and attempt auto-login
    if (isInYakihonneIframe()) {
      console.log('In Yakihonne iframe with no stored user, attempting auto-login...');
      
      // Set up message listener for Yakihonne profile
      window.addEventListener('message', (event) => {
        console.log('Received message in iframe during initialization:', event.data);
        
        // Verify origin (in production, be more strict with allowed origins)
        if (event.origin && !event.origin.includes('yakihonne')) {
          console.warn('Ignoring message from untrusted origin:', event.origin);
          return;
        }
        
        // Check if the message contains a Nostr profile
        if (event.data && event.data.pubkey) {
          console.log('Yakihonne Nostr profile received during initialization:', event.data);
          
          // Store in window for future reference
          window.yakihonneUser = event.data;
          
          // Auto-login if not already authenticated
          if (!isAuthenticated.value) {
            console.log('Auto-logging in with received Yakihonne profile...');
            login()
              .then(user => console.log('Auto-login successful:', user.npub))
              .catch(error => console.error('Auto-login failed:', error));
          }
        }
      });
      
      // Request profile from parent
      try {
        console.log('Requesting Nostr profile from Yakihonne parent during initialization...');
        window.parent.postMessage({ type: 'REQUEST_NOSTR_PROFILE' }, '*');
      } catch (error) {
        console.error('Error requesting Nostr profile from parent during initialization:', error);
      }
    }
  }
};

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
