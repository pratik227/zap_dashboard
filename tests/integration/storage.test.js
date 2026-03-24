/**
 * Step 7 — Storage Verification (Integration)
 *
 * Verifies that:
 * 1. StorageService persists and retrieves data correctly (simulating page reload)
 * 2. clearAuthData() removes auth keys but preserves campaigns/follow-lists
 * 3. performCompleteReset() clears everything from localStorage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock constants before any imports
vi.mock('../../src/utils/constants.js', () => ({
  STORAGE_KEYS: {
    USER: 'nostrUser',
    RELAYS: 'nostrRelays',
    SIGNER_TYPE: 'nostr_signer_type',
    REMOTE_URI: 'nostr_remote_uri',
    CONNECTIONS: 'nostr_connections',
    ACTIVE_CONNECTION: 'active_connection_id',
    NWC_URL: 'nwc_url',
    NOTIFICATION_SETTINGS: 'notification_settings',
    LAST_TX_TIMESTAMP: 'last_transaction_timestamp',
    LAST_BALANCE: 'last_balance',
    PROCESSED_TX: 'processed_transactions',
    NOTIFICATIONS_LIST: 'notifications_list',
    CONTENT_ITEMS: 'user_content_items',
    CAMPAIGNS: 'user_campaigns',
    CAMPAIGN_ZAPS: 'campaign_aggregated_zaps',
    FOLLOW_LISTS_MY: 'follow_lists_my',
    FOLLOW_LISTS_DISCOVERED: 'follow_lists_discovered',
    FOLLOW_LISTS_PROFILES: 'follow_lists_profiles',
  },
  DEFAULT_RELAY_CONFIGS: [],
  DEFAULT_RELAY_URLS: [],
}))

/** Create a fresh localStorage mock backed by a plain object store. */
function createLocalStorageMock() {
  const store = {}
  return {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    get length() { return Object.keys(store).length },
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
    _store: store,
  }
}

let storageService
let STORAGE_KEYS

beforeEach(async () => {
  vi.stubGlobal('localStorage', createLocalStorageMock())
  vi.resetModules()
  const mod = await import('../../src/services/StorageService.js')
  storageService = mod.storageService
  STORAGE_KEYS = mod.STORAGE_KEYS
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ────────────────────────────────────────────────────────────────
// 1. Data persists across page reloads
// ────────────────────────────────────────────────────────────────

describe('Step 7.1 — StorageService get/set round-trips (simulating persistence)', () => {
  it('stores and retrieves a plain object', () => {
    const data = { pubkey: 'abc123', name: 'Alice' }
    storageService.set('test_obj', data)
    expect(storageService.get('test_obj')).toEqual(data)
  })

  it('stores and retrieves an array', () => {
    const data = [1, 2, 3, 'four', { five: 5 }]
    storageService.set('test_arr', data)
    expect(storageService.get('test_arr')).toEqual(data)
  })

  it('stores and retrieves primitive types', () => {
    storageService.set('test_number', 42)
    storageService.set('test_string', 'hello')
    storageService.set('test_bool', true)
    storageService.set('test_null', null)

    expect(storageService.get('test_number')).toBe(42)
    expect(storageService.get('test_string')).toBe('hello')
    expect(storageService.get('test_bool')).toBe(true)
    expect(storageService.get('test_null')).toBe(null)
  })

  it('returns defaultValue when key does not exist', () => {
    expect(storageService.get('nonexistent')).toBeNull()
    expect(storageService.get('nonexistent', 'fallback')).toBe('fallback')
  })

  it('survives a simulated page reload (data is in localStorage)', () => {
    const campaign = { id: 'c1', name: 'My Campaign', goal: 100_000 }
    storageService.set(STORAGE_KEYS.CAMPAIGNS, [campaign])

    // Simulate "page reload": read directly from the backing store
    const raw = localStorage.getItem(STORAGE_KEYS.CAMPAIGNS)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw)).toEqual([campaign])

    // And the service still reads it back
    expect(storageService.get(STORAGE_KEYS.CAMPAIGNS)).toEqual([campaign])
  })

  it('setRaw / getRaw works for string values', () => {
    storageService.setRaw('raw_key', 'raw_value')
    expect(storageService.getRaw('raw_key')).toBe('raw_value')
  })

  it('has() returns true for existing keys and false for missing', () => {
    storageService.set('exists', 'yes')
    expect(storageService.has('exists')).toBe(true)
    expect(storageService.has('does_not_exist')).toBe(false)
  })

  it('remove() deletes a single key', () => {
    storageService.set('to_remove', 'gone')
    expect(storageService.has('to_remove')).toBe(true)

    storageService.remove('to_remove')
    expect(storageService.has('to_remove')).toBe(false)
    expect(storageService.get('to_remove')).toBeNull()
  })

  it('handles corrupted JSON gracefully (returns default)', () => {
    localStorage._store['bad_json'] = '{not valid json'
    expect(storageService.get('bad_json', 'default')).toBe('default')
  })
})

// ────────────────────────────────────────────────────────────────
// 2. Logout clears correct keys
// ────────────────────────────────────────────────────────────────

describe('Step 7.2 — clearAuthData() removes auth keys, preserves others', () => {
  beforeEach(() => {
    // Seed auth-related keys
    storageService.set(STORAGE_KEYS.USER, { pubkey: 'abc' })
    storageService.setRaw(STORAGE_KEYS.SIGNER_TYPE, 'nip07')
    storageService.setRaw(STORAGE_KEYS.REMOTE_URI, 'bunker://...')
    storageService.set(STORAGE_KEYS.CONNECTIONS, [{ id: '1' }])
    storageService.setRaw(STORAGE_KEYS.ACTIVE_CONNECTION, 'conn1')
    storageService.setRaw(STORAGE_KEYS.NWC_URL, 'nostr+walletconnect://...')
    storageService.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, { enabled: true })
    storageService.set(STORAGE_KEYS.LAST_TX_TIMESTAMP, 12345)
    storageService.set(STORAGE_KEYS.LAST_BALANCE, 50000)
    storageService.set(STORAGE_KEYS.PROCESSED_TX, ['tx1', 'tx2'])
    storageService.set(STORAGE_KEYS.NOTIFICATIONS_LIST, [{ id: 'n1' }])
    storageService.set(STORAGE_KEYS.CONTENT_ITEMS, [{ id: 'i1' }])

    // Seed preserved keys
    storageService.set(STORAGE_KEYS.CAMPAIGNS, [{ id: 'camp1', name: 'Test' }])
    storageService.set(STORAGE_KEYS.CAMPAIGN_ZAPS, { camp1: 5000 })
    storageService.set(STORAGE_KEYS.FOLLOW_LISTS_MY, [{ id: 'fl1' }])
    storageService.set(STORAGE_KEYS.FOLLOW_LISTS_DISCOVERED, [{ id: 'fl2' }])
  })

  it('removes all auth-related keys after clearAuthData()', () => {
    storageService.clearAuthData()

    const clearedKeys = [
      STORAGE_KEYS.USER,
      STORAGE_KEYS.SIGNER_TYPE,
      STORAGE_KEYS.REMOTE_URI,
      STORAGE_KEYS.CONNECTIONS,
      STORAGE_KEYS.ACTIVE_CONNECTION,
      STORAGE_KEYS.NWC_URL,
      STORAGE_KEYS.NOTIFICATION_SETTINGS,
      STORAGE_KEYS.LAST_TX_TIMESTAMP,
      STORAGE_KEYS.LAST_BALANCE,
      STORAGE_KEYS.PROCESSED_TX,
      STORAGE_KEYS.NOTIFICATIONS_LIST,
      STORAGE_KEYS.CONTENT_ITEMS,
    ]

    for (const key of clearedKeys) {
      expect(storageService.has(key), `Key "${key}" should be removed`).toBe(false)
    }
  })

  it('preserves campaigns after clearAuthData()', () => {
    storageService.clearAuthData()

    expect(storageService.get(STORAGE_KEYS.CAMPAIGNS)).toEqual([
      { id: 'camp1', name: 'Test' },
    ])
    expect(storageService.get(STORAGE_KEYS.CAMPAIGN_ZAPS)).toEqual({ camp1: 5000 })
  })

  it('preserves follow lists after clearAuthData()', () => {
    storageService.clearAuthData()

    expect(storageService.get(STORAGE_KEYS.FOLLOW_LISTS_MY)).toEqual([{ id: 'fl1' }])
    expect(storageService.get(STORAGE_KEYS.FOLLOW_LISTS_DISCOVERED)).toEqual([{ id: 'fl2' }])
  })
})

// ────────────────────────────────────────────────────────────────
// 3. performCompleteReset() clears everything
// ────────────────────────────────────────────────────────────────

describe('Step 7.3 — performCompleteReset() clears all localStorage', () => {
  it('performCompleteReset removes all known storage keys', async () => {
    // Mock external deps that performCompleteReset touches
    vi.doMock('../../src/utils/wallet/nwcClient.js', () => ({
      initializeNWC: vi.fn(),
    }))
    vi.doMock('../../src/services/nostr/NostrService.js', () => ({
      nostrService: {
        cleanup: vi.fn(),
        isInitialized: false,
        getConnectionHealth: () => ({ connected: 0, total: 0, healthyPercentage: 0 }),
        addEventListener: vi.fn(() => () => {}),
      },
    }))
    vi.doMock('../../src/services/nostr/nostrImports.js', () => ({
      npubEncode: vi.fn(() => 'npub1test'),
    }))

    // Seed keys that performCompleteReset should remove
    const keysToSeed = [
      'nwc_url', 'nostr_connections', 'active_connection_id',
      'last_transaction_timestamp', 'last_balance', 'processed_transactions',
      'nostrUser', 'nostrRelays', 'user_content_items',
      'notifications_list', 'notification_settings',
      'btc_price_data', 'zap_metrics_cache',
    ]
    keysToSeed.forEach(k => { localStorage._store[k] = '"data"' })

    const { performCompleteReset } = await import('../../src/utils/account/accountReset.js')
    await performCompleteReset()

    for (const key of keysToSeed) {
      expect(localStorage.removeItem).toHaveBeenCalledWith(key)
    }

    vi.doUnmock('../../src/utils/wallet/nwcClient.js')
    vi.doUnmock('../../src/services/nostr/NostrService.js')
    vi.doUnmock('../../src/services/nostr/nostrImports.js')
  })

  it('StorageService.clearAll() removes ALL keys including unknown ones', () => {
    // Seed known keys
    storageService.set(STORAGE_KEYS.USER, { pubkey: 'xyz' })
    storageService.set(STORAGE_KEYS.CAMPAIGNS, [])

    // Seed unknown/legacy keys
    localStorage._store['random_key_1'] = 'val1'
    localStorage._store['random_key_2'] = 'val2'
    localStorage._store['some_old_cache'] = 'val3'

    expect(localStorage.length).toBeGreaterThan(0)

    storageService.clearAll()

    expect(localStorage.length).toBe(0)
  })

  it('clearAll cancels pending debounced writes', () => {
    vi.useFakeTimers()

    // Queue a debounced write
    storageService.debouncedSet('debounce_key', { delayed: true }, 5000)

    // clearAll before the timer fires
    storageService.clearAll()

    // Advance time past the debounce delay
    vi.advanceTimersByTime(10000)

    // The debounced key should NOT have been written
    expect(localStorage._store['debounce_key']).toBeUndefined()
  })
})
