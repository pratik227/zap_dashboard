import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock constants before importing StorageService
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
}))

// We need a fresh instance per test, so import the class indirectly
let storageService
let STORAGE_KEYS

beforeEach(async () => {
  // Reset localStorage mock
  const store = {}
  const localStorageMock = {
    getItem: vi.fn((key) => (key in store ? store[key] : null)),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    key: vi.fn((index) => Object.keys(store)[index] ?? null),
    get length() { return Object.keys(store).length },
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
    _store: store,
  }
  vi.stubGlobal('localStorage', localStorageMock)

  // Re-import to get a fresh singleton (module cache is reset by vi.resetModules)
  vi.resetModules()
  const mod = await import('../../src/services/StorageService.js')
  storageService = mod.storageService
  STORAGE_KEYS = mod.STORAGE_KEYS
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── get() ──────────────────────────────────────────────────────

describe('StorageService.get()', () => {
  it('returns parsed JSON value', () => {
    localStorage._store['testKey'] = JSON.stringify({ hello: 'world' })
    expect(storageService.get('testKey')).toEqual({ hello: 'world' })
  })

  it('returns default value (null) when key does not exist', () => {
    expect(storageService.get('missing')).toBeNull()
  })

  it('returns custom default value when key does not exist', () => {
    expect(storageService.get('missing', 42)).toBe(42)
  })

  it('returns default value when JSON is corrupted', () => {
    localStorage._store['bad'] = '{not valid json'
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(storageService.get('bad', 'fallback')).toBe('fallback')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('parses primitive JSON values correctly', () => {
    localStorage._store['num'] = '123'
    localStorage._store['bool'] = 'true'
    localStorage._store['str'] = '"hello"'
    localStorage._store['nil'] = 'null'

    expect(storageService.get('num')).toBe(123)
    expect(storageService.get('bool')).toBe(true)
    expect(storageService.get('str')).toBe('hello')
    expect(storageService.get('nil')).toBeNull()
  })

  it('parses arrays', () => {
    localStorage._store['arr'] = '[1,2,3]'
    expect(storageService.get('arr')).toEqual([1, 2, 3])
  })
})

// ── set() ──────────────────────────────────────────────────────

describe('StorageService.set()', () => {
  it('serializes and stores JSON value', () => {
    storageService.set('key1', { a: 1 })
    expect(localStorage.setItem).toHaveBeenCalledWith('key1', '{"a":1}')
  })

  it('stores primitive values as JSON', () => {
    storageService.set('num', 42)
    expect(localStorage.setItem).toHaveBeenCalledWith('num', '42')
  })

  it('handles QuotaExceededError gracefully', () => {
    const err = new DOMException('quota', 'QuotaExceededError')
    localStorage.setItem.mockImplementationOnce(() => { throw err })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => storageService.set('big', 'data')).not.toThrow()
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('quota exceeded'),
      // no second arg for quota path
    )
  })

  it('handles generic setItem errors gracefully', () => {
    const err = new Error('disk full')
    localStorage.setItem.mockImplementationOnce(() => { throw err })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => storageService.set('x', 'y')).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()
  })
})

// ── getRaw() ───────────────────────────────────────────────────

describe('StorageService.getRaw()', () => {
  it('returns the raw string from localStorage', () => {
    localStorage._store['raw'] = 'some-raw-string'
    expect(storageService.getRaw('raw')).toBe('some-raw-string')
  })

  it('returns default value (null) when key does not exist', () => {
    expect(storageService.getRaw('nope')).toBeNull()
  })

  it('returns custom default value when key does not exist', () => {
    expect(storageService.getRaw('nope', 'default')).toBe('default')
  })

  it('does not parse JSON — returns the raw string', () => {
    localStorage._store['json'] = '{"a":1}'
    expect(storageService.getRaw('json')).toBe('{"a":1}')
  })
})

// ── setRaw() ───────────────────────────────────────────────────

describe('StorageService.setRaw()', () => {
  it('stores raw string without JSON serialization', () => {
    storageService.setRaw('rk', 'raw-value')
    expect(localStorage.setItem).toHaveBeenCalledWith('rk', 'raw-value')
  })

  it('handles errors gracefully', () => {
    localStorage.setItem.mockImplementationOnce(() => { throw new Error('fail') })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => storageService.setRaw('k', 'v')).not.toThrow()
    expect(errorSpy).toHaveBeenCalled()
  })
})

// ── remove() ───────────────────────────────────────────────────

describe('StorageService.remove()', () => {
  it('removes a key from localStorage', () => {
    localStorage._store['del'] = 'value'
    storageService.remove('del')
    expect(localStorage.removeItem).toHaveBeenCalledWith('del')
  })

  it('cancels pending debounced write for the removed key', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('dkey', 'val', 500)
    expect(storageService._timers.has('dkey')).toBe(true)

    storageService.remove('dkey')
    expect(storageService._timers.has('dkey')).toBe(false)

    // Advance past debounce — set should NOT have been called
    vi.advanceTimersByTime(1000)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})

// ── has() ──────────────────────────────────────────────────────

describe('StorageService.has()', () => {
  it('returns true when key exists', () => {
    localStorage._store['exists'] = 'yes'
    expect(storageService.has('exists')).toBe(true)
  })

  it('returns false when key does not exist', () => {
    expect(storageService.has('ghost')).toBe(false)
  })
})

// ── debouncedSet() ─────────────────────────────────────────────

describe('StorageService.debouncedSet()', () => {
  it('does not write immediately', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('dk', { x: 1 })

    expect(localStorage.setItem).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('writes after the default delay (2000ms)', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('dk', { x: 1 })

    vi.advanceTimersByTime(2000)
    expect(localStorage.setItem).toHaveBeenCalledWith('dk', '{"x":1}')
  })

  it('writes after a custom delay', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('dk', 'val', 500)

    vi.advanceTimersByTime(499)
    expect(localStorage.setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(localStorage.setItem).toHaveBeenCalledWith('dk', '"val"')
  })

  it('resets the timer on subsequent calls (only last value is written)', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('dk', 'first', 500)
    vi.advanceTimersByTime(300)

    storageService.debouncedSet('dk', 'second', 500)
    vi.advanceTimersByTime(300)
    expect(localStorage.setItem).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(localStorage.setItem).toHaveBeenCalledWith('dk', '"second"')
    expect(localStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it('cleans up timer map after writing', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('dk', 'val', 100)

    vi.advanceTimersByTime(100)
    expect(storageService._timers.has('dk')).toBe(false)
  })
})

// ── flush() ────────────────────────────────────────────────────

describe('StorageService.flush()', () => {
  it('cancels all pending debounced writes', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('a', 1, 500)
    storageService.debouncedSet('b', 2, 500)

    storageService.flush()

    vi.advanceTimersByTime(1000)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('clears the timer map', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('a', 1, 500)
    storageService.debouncedSet('b', 2, 500)

    storageService.flush()
    expect(storageService._timers.size).toBe(0)
  })
})

// ── clearAuthData() ────────────────────────────────────────────

describe('StorageService.clearAuthData()', () => {
  it('removes all auth-related keys', () => {
    const authKeys = [
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
    // Seed all keys
    authKeys.forEach((k) => { localStorage._store[k] = '"data"' })
    // Also seed a preserved key
    localStorage._store[STORAGE_KEYS.CAMPAIGNS] = '"keep"'

    storageService.clearAuthData()

    // Auth keys should be removed
    authKeys.forEach((k) => {
      expect(localStorage.removeItem).toHaveBeenCalledWith(k)
    })
    // Campaigns should still exist
    expect(localStorage._store[STORAGE_KEYS.CAMPAIGNS]).toBe('"keep"')
  })

  it('cancels debounced writes for cleared auth keys', () => {
    vi.useFakeTimers()
    storageService.debouncedSet(STORAGE_KEYS.USER, 'pending', 5000)

    storageService.clearAuthData()

    vi.advanceTimersByTime(10000)
    // The debounced write for USER should have been cancelled
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })
})

// ── clearAll() ─────────────────────────────────────────────────

describe('StorageService.clearAll()', () => {
  it('removes all known STORAGE_KEYS', () => {
    Object.values(STORAGE_KEYS).forEach((k) => { localStorage._store[k] = '"val"' })

    storageService.clearAll()

    Object.values(STORAGE_KEYS).forEach((k) => {
      expect(localStorage.removeItem).toHaveBeenCalledWith(k)
    })
  })

  it('also removes unknown/legacy keys', () => {
    localStorage._store['legacy_key'] = 'old'
    localStorage._store['another_legacy'] = 'old2'

    storageService.clearAll()

    expect(localStorage.removeItem).toHaveBeenCalledWith('legacy_key')
    expect(localStorage.removeItem).toHaveBeenCalledWith('another_legacy')
  })

  it('cancels all pending debounced writes', () => {
    vi.useFakeTimers()
    storageService.debouncedSet('x', 1, 500)
    storageService.debouncedSet('y', 2, 500)

    storageService.clearAll()

    expect(storageService._timers.size).toBe(0)
    vi.advanceTimersByTime(1000)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('leaves localStorage empty after clearing', () => {
    localStorage._store['a'] = '1'
    localStorage._store['b'] = '2'

    storageService.clearAll()

    expect(Object.keys(localStorage._store).length).toBe(0)
  })
})
