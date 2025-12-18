// Account Reset Utility
// Handles atomic clearing and re-initialization of NWC and Nostr account data

import { initializeNWC } from '../wallet/nwcClient.js'
import { nostrRelayManager } from '../network/nostrRelayManager.js'
import { npubEncode } from 'nostr-tools/nip19'

// Default reliable relays for fresh initialization
const DEFAULT_RELAYS = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.snort.social', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://nostr.wine', read: true, write: true }
]

/**
 * Clear all NWC related data from localStorage
 * @returns {boolean} Success status
 */
export const clearNWCData = () => {
  try {
    console.log('🧹 Clearing all NWC data...')
    
    // NWC specific storage keys
    const nwcKeys = [
      'nwc_url',
      'nostr_connections',
      'active_connection_id',
      'last_transaction_timestamp',
      'last_balance',
      'processed_transactions'
    ]
    
    // Clear NWC client
    initializeNWC(null)
    
    // Remove all NWC related keys
    nwcKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ Removed ${key} from localStorage`)
    })
    
    console.log('✅ All NWC data cleared successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to clear NWC data:', error)
    return false
  }
}

/**
 * Clear all Nostr related data from localStorage
 * @returns {boolean} Success status
 */
export const clearNostrData = () => {
  try {
    console.log('🧹 Clearing all Nostr data...')
    
    // Nostr specific storage keys
    const nostrKeys = [
      'nostrUser',
      'nostrRelays',
      'user_content_items',
      'notifications_list'
    ]
    
    // Close all relay connections
    nostrRelayManager.cleanup()
    
    // Remove all Nostr related keys
    nostrKeys.forEach(key => {
      localStorage.removeItem(key)
      console.log(`✅ Removed ${key} from localStorage`)
    })
    
    console.log('✅ All Nostr data cleared successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to clear Nostr data:', error)
    return false
  }
}

/**
 * Initialize a new NWC session with provided credentials
 * @param {string} nwcUrl - The NWC URL for the new connection
 * @param {string} name - Optional name for the connection
 * @returns {Promise<object>} Connection result
 */
export const initializeNewNWCSession = async (nwcUrl, name = 'My Lightning Wallet') => {
  if (!nwcUrl) {
    throw new Error('NWC URL is required')
  }
  
  if (!nwcUrl.startsWith('nostr+walletconnect://')) {
    throw new Error('Invalid NWC URL format. Must start with nostr+walletconnect://')
  }
  
  try {
    console.log('🔌 Initializing new NWC session...')
    
    // Create connection data structure
    const connection = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      name: name.trim(),
      nwcUrl: nwcUrl.trim(),
      isActive: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    }
    
    // Save to localStorage
    localStorage.setItem('nostr_connections', JSON.stringify([connection]))
    localStorage.setItem('active_connection_id', connection.id)
    
    // Initialize NWC client
    const client = initializeNWC(nwcUrl)
    if (!client) {
      throw new Error('Failed to initialize NWC client')
    }
    
    console.log('✅ NWC session initialized successfully')
    return { success: true, connection }
  } catch (error) {
    console.error('❌ Failed to initialize NWC session:', error)
    throw error
  }
}

/**
 * Initialize a new Nostr account with provided public key
 * @param {string} pubkey - The Nostr public key (hex)
 * @param {Array} customRelays - Optional custom relays to use
 * @returns {Promise<object>} Initialization result
 */
export const initializeNostrAccount = async (pubkey, customRelays = null) => {
  if (!pubkey) {
    throw new Error('Nostr public key is required')
  }
  
  try {
    console.log('🔑 Initializing new Nostr account...')
    
    // Create minimal user data
    const npub = npubEncode(pubkey)
    
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
    
    // Save user data
    localStorage.setItem('nostrUser', JSON.stringify(userData))
    
    // Initialize relays
    const relays = customRelays || DEFAULT_RELAYS
    localStorage.setItem('nostrRelays', JSON.stringify(relays))
    
    // Initialize relay manager with the relays
    await nostrRelayManager.initialize(relays)
    
    console.log('✅ Nostr account initialized successfully')
    return { success: true, userData, relays }
  } catch (error) {
    console.error('❌ Failed to initialize Nostr account:', error)
    throw error
  }
}

/**
 * Perform a complete reset of all account data
 * @returns {Promise<object>} Reset result
 */
export const performCompleteReset = async () => {
  try {
    console.log('🔄 Starting complete account reset...')
    
    // List of all storage keys to clear
    const keysToRemove = [
      // NWC related
      'nwc_url',
      'nostr_connections',
      'active_connection_id',
      'last_transaction_timestamp',
      'last_balance',
      'processed_transactions',
      
      // Nostr related
      'nostrUser',
      'nostrRelays',
      'user_content_items',
      'notifications_list',
      'notification_settings',
      
      // Content related
      'user_content_items',
      
      // Other app data
      'btc_price_data',
      
      // Metrics cache
      'zap_metrics_cache'
    ]
    
    // Clear all keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key)
        console.log(`✅ Removed ${key} from localStorage`)
      } catch (err) {
        console.warn(`⚠️ Failed to remove ${key}:`, err)
      }
    })
    
    // Clear NWC client
    try {
      initializeNWC(null)
      console.log('✅ Cleared NWC client')
    } catch (err) {
      console.warn('⚠️ Failed to clear NWC client:', err)
    }
    
    // Clean up relay manager
    try {
      nostrRelayManager.cleanup()
      console.log('✅ Cleaned up relay manager')
    } catch (err) {
      console.warn('⚠️ Failed to clean up relay manager:', err)
    }
    
    console.log('✅ Complete account reset successful')
    return { success: true, message: 'All account data has been reset' }
  } catch (error) {
    console.error('❌ Failed to perform complete reset:', error)
    throw error
  }
}

/**
 * Verify the current connection status
 * @returns {Promise<object>} Status information
 */
export const verifyConnectionStatus = async () => {
  try {
    console.log('🔍 Verifying connection status...')

    // Check if localStorage is empty for key items
    const criticalKeys = [
      'nostr_connections',
      'nostrUser',
      'active_connection_id'
    ]
    
    const remainingKeys = criticalKeys.filter(key => localStorage.getItem(key) !== null)
    if (remainingKeys.length > 0) {
      console.warn('⚠️ Some keys still exist after reset:', remainingKeys)
    }
    
    // Check NWC connection
    const nwcConnections = []
    try {
      const stored = localStorage.getItem('nostr_connections')
      if (stored) nwcConnections.push(...JSON.parse(stored))
    } catch (e) {
      console.warn('Failed to parse NWC connections:', e)
    }
    
    const activeConnectionId = localStorage.getItem('active_connection_id')
    const hasActiveNWC = activeConnectionId && nwcConnections.some(conn => conn.id === activeConnectionId)
    
    // Check Nostr connection
    let nostrUser = null
    try {
      const stored = localStorage.getItem('nostrUser')
      if (stored) nostrUser = JSON.parse(stored)
    } catch (e) {
      console.warn('Failed to parse Nostr user:', e)
    }
    
    let nostrRelays = []
    try {
      const stored = localStorage.getItem('nostrRelays')
      if (stored) nostrRelays = JSON.parse(stored)
    } catch (e) {
      console.warn('Failed to parse Nostr relays:', e)
    }
    
    // Check relay manager status
    const relayStats = nostrRelayManager.getConnectionStats()
    
    return {
      nwc: {
        connected: hasActiveNWC,
        connections: nwcConnections.length,
        activeId: activeConnectionId
      },
      nostr: {
        authenticated: !!nostrUser,
        pubkey: nostrUser?.pubkey,
        npub: nostrUser?.npub,
        relays: nostrRelays.length
      },
      relayManager: {
        initialized: nostrRelayManager.isInitialized,
        connectedRelays: relayStats.connected,
        totalRelays: relayStats.total,
        writeEnabled: relayStats.writeEnabled,
        readEnabled: relayStats.readEnabled
      }
    }
  } catch (error) {
    console.error('❌ Failed to verify connection status:', error)
    throw error
  }
}

/**
 * Validate that all storage operations completed successfully
 * @returns {Promise<boolean>} Validation result
 */
export const validateStorageIntegrity = async () => {
  try {
    console.log('🔍 Validating storage integrity...')
    
    // Check that cleared items are actually gone
    const keysToCheck = [
      'nwc_url',
      'nostrUser',
      'nostrRelays'
    ]
    
    const missingKeys = keysToCheck.filter(key => localStorage.getItem(key) !== null)
    
    if (missingKeys.length > 0) {
      console.warn('⚠️ Some keys were not properly cleared:', missingKeys)
      return false
    }
    
    console.log('✅ Storage integrity validated successfully')
    return true
  } catch (error) {
    console.error('❌ Failed to validate storage integrity:', error)
    return false
  }
}