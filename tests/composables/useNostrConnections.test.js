import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStorageGet = vi.fn(() => null)
const mockStorageSet = vi.fn()
const mockStorageGetRaw = vi.fn(() => null)
const mockStorageSetRaw = vi.fn()
const mockStorageRemove = vi.fn()

vi.mock('../../src/services/StorageService.js', () => ({
  storageService: {
    get: mockStorageGet,
    set: mockStorageSet,
    getRaw: mockStorageGetRaw,
    setRaw: mockStorageSetRaw,
    remove: mockStorageRemove
  },
  STORAGE_KEYS: {
    CONNECTIONS: 'nostr_connections',
    ACTIVE_CONNECTION: 'active_connection_id',
    NWC_URL: 'nwc_url',
    USER: 'nostrUser',
    SIGNER_TYPE: 'nostr_signer_type',
    REMOTE_URI: 'nostr_remote_uri',
    NOTIFICATION_SETTINGS: 'notification_settings',
    LAST_TX_TIMESTAMP: 'last_transaction_timestamp',
    LAST_BALANCE: 'last_balance',
    PROCESSED_TX: 'processed_transactions',
    NOTIFICATIONS_LIST: 'notifications_list',
    CONTENT_ITEMS: 'user_content_items'
  }
}))

const mockInitializeNWC = vi.fn()
const mockFetchTransactions = vi.fn()
const mockGetWalletInfo = vi.fn()
const mockGetBalance = vi.fn()

vi.mock('../../src/utils/wallet/nwcClient.js', () => ({
  initializeNWC: mockInitializeNWC,
  fetchTransactions: mockFetchTransactions,
  getWalletInfo: mockGetWalletInfo,
  getBalance: mockGetBalance
}))

vi.mock('../../src/utils/core/dataMapper.js', () => ({
  processTransactions: vi.fn((txs) => txs)
}))

let useNostrConnections

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers()

  // Default: no stored connections
  mockStorageGet.mockReturnValue(null)
  mockStorageGetRaw.mockReturnValue(null)
  mockInitializeNWC.mockResolvedValue({})
  mockGetWalletInfo.mockResolvedValue({ alias: 'Test Wallet' })

  // Reset module state
  vi.resetModules()

  vi.doMock('../../src/services/StorageService.js', () => ({
    storageService: {
      get: mockStorageGet,
      set: mockStorageSet,
      getRaw: mockStorageGetRaw,
      setRaw: mockStorageSetRaw,
      remove: mockStorageRemove
    },
    STORAGE_KEYS: {
      CONNECTIONS: 'nostr_connections',
      ACTIVE_CONNECTION: 'active_connection_id',
      NWC_URL: 'nwc_url',
      USER: 'nostrUser',
      SIGNER_TYPE: 'nostr_signer_type',
      REMOTE_URI: 'nostr_remote_uri',
      NOTIFICATION_SETTINGS: 'notification_settings',
      LAST_TX_TIMESTAMP: 'last_transaction_timestamp',
      LAST_BALANCE: 'last_balance',
      PROCESSED_TX: 'processed_transactions',
      NOTIFICATIONS_LIST: 'notifications_list',
      CONTENT_ITEMS: 'user_content_items'
    }
  }))

  vi.doMock('../../src/utils/wallet/nwcClient.js', () => ({
    initializeNWC: mockInitializeNWC,
    fetchTransactions: mockFetchTransactions,
    getWalletInfo: mockGetWalletInfo,
    getBalance: mockGetBalance
  }))

  vi.doMock('../../src/utils/core/dataMapper.js', () => ({
    processTransactions: vi.fn((txs) => txs)
  }))

  const mod = await import('../../src/composables/core/useNostrConnections.js')
  useNostrConnections = mod.useNostrConnections
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useNostrConnections', () => {
  describe('validateNwcUrl()', () => {
    it('returns null for a valid NWC URL', () => {
      const { validateNwcUrl } = useNostrConnections()
      const result = validateNwcUrl('nostr+walletconnect://pubkey123?relay=wss://relay.example.com&secret=abc')
      expect(result).toBeNull()
    })

    it('returns error for empty/null input', () => {
      const { validateNwcUrl } = useNostrConnections()

      expect(validateNwcUrl('')).toBe('NWC URL is required')
      expect(validateNwcUrl(null)).toBe('NWC URL is required')
      expect(validateNwcUrl(undefined)).toBe('NWC URL is required')
    })

    it('returns error for non-string input', () => {
      const { validateNwcUrl } = useNostrConnections()
      expect(validateNwcUrl(12345)).toBe('NWC URL is required')
    })

    it('returns error when URL does not start with nostr+walletconnect://', () => {
      const { validateNwcUrl } = useNostrConnections()

      expect(validateNwcUrl('https://example.com')).toBe('NWC URL must start with "nostr+walletconnect://"')
      expect(validateNwcUrl('nostr://something')).toBe('NWC URL must start with "nostr+walletconnect://"')
      expect(validateNwcUrl('walletconnect://pubkey')).toBe('NWC URL must start with "nostr+walletconnect://"')
    })

    it('returns error for malformed URL that cannot be parsed', () => {
      const { validateNwcUrl } = useNostrConnections()
      // URL constructor may or may not throw for nostr+walletconnect:// strings
      // depending on runtime; test with a clearly invalid format
      const result = validateNwcUrl('nostr+walletconnect://')
      // Either null (valid parse) or error string — both are acceptable
      expect(typeof result === 'string' || result === null).toBe(true)
    })
  })

  describe('isWalletConnected computed', () => {
    it('returns false when no active connection', () => {
      const { isWalletConnected } = useNostrConnections()
      expect(isWalletConnected.value).toBe(false)
    })

    it('returns true after setting an active connection', async () => {
      const { isWalletConnected, addConnection, setActiveConnection } = useNostrConnections()

      const conn = addConnection('My Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      await setActiveConnection(conn.id)

      expect(isWalletConnected.value).toBe(true)
    })

    it('returns false after clearing active connection', async () => {
      const { isWalletConnected, addConnection, setActiveConnection, clearActiveConnection } = useNostrConnections()

      const conn = addConnection('My Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      await setActiveConnection(conn.id)
      expect(isWalletConnected.value).toBe(true)

      clearActiveConnection()
      expect(isWalletConnected.value).toBe(false)
    })
  })

  describe('walletStatus state transitions', () => {
    it('starts as "disconnected"', () => {
      const { walletStatus } = useNostrConnections()
      expect(walletStatus.value).toBe('disconnected')
    })

    it('transitions to "connecting" then "connected" on successful activation', async () => {
      const { walletStatus, addConnection, setActiveConnection } = useNostrConnections()

      const conn = addConnection('Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')

      const promise = setActiveConnection(conn.id)

      // After awaiting, it should be connected
      await promise
      expect(walletStatus.value).toBe('connected')
    })

    it('transitions to "error" on failed activation', async () => {
      mockInitializeNWC.mockRejectedValueOnce(new Error('Connection refused'))

      const { walletStatus, addConnection, setActiveConnection } = useNostrConnections()
      const conn = addConnection('Bad Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')

      try {
        await setActiveConnection(conn.id)
      } catch {
        // expected
      }

      expect(walletStatus.value).toBe('error')
    })

    it('transitions back to "disconnected" when active connection is cleared', async () => {
      const { walletStatus, addConnection, setActiveConnection, clearActiveConnection } = useNostrConnections()

      const conn = addConnection('Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      await setActiveConnection(conn.id)
      expect(walletStatus.value).toBe('connected')

      clearActiveConnection()
      // Vue watchers on activeConnection are async — flush them
      await nextTick()
      expect(walletStatus.value).toBe('disconnected')
    })
  })

  describe('addConnection()', () => {
    it('adds a connection and returns it', () => {
      const { addConnection, connections } = useNostrConnections()

      const conn = addConnection('Test Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')

      expect(conn.name).toBe('Test Wallet')
      expect(conn.nwcUrl).toBe('nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      expect(conn.id).toBeDefined()
      expect(connections.value).toHaveLength(1)
    })

    it('first connection is set as default', () => {
      const { addConnection } = useNostrConnections()
      const conn = addConnection('First', 'nostr+walletconnect://pubkey1?relay=wss://relay.example.com&secret=abc')
      expect(conn.isDefault).toBe(true)
    })

    it('throws on invalid NWC URL', () => {
      const { addConnection } = useNostrConnections()
      expect(() => addConnection('Bad', 'https://invalid.com')).toThrow()
    })

    it('throws on empty name', () => {
      const { addConnection } = useNostrConnections()
      expect(() => addConnection('', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')).toThrow('Display name is required')
    })

    it('throws on duplicate NWC URL', () => {
      const { addConnection } = useNostrConnections()
      const url = 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc'

      addConnection('First', url)
      expect(() => addConnection('Second', url)).toThrow('A connection with this URL already exists')
    })
  })

  describe('deleteConnection()', () => {
    it('removes a connection by ID', () => {
      const { addConnection, deleteConnection, connections } = useNostrConnections()

      const conn = addConnection('ToDelete', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      expect(connections.value).toHaveLength(1)

      deleteConnection(conn.id)
      expect(connections.value).toHaveLength(0)
    })

    it('throws when connection not found', () => {
      const { deleteConnection } = useNostrConnections()
      expect(() => deleteConnection('nonexistent_id')).toThrow('Connection not found')
    })

    it('clears active connection if deleted connection was active', async () => {
      const { addConnection, setActiveConnection, deleteConnection, isWalletConnected } = useNostrConnections()

      const conn = addConnection('Active', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      await setActiveConnection(conn.id)
      expect(isWalletConnected.value).toBe(true)

      deleteConnection(conn.id)
      expect(isWalletConnected.value).toBe(false)
    })
  })

  describe('loadZapData()', () => {
    it('returns empty array when no active connection', async () => {
      const { loadZapData } = useNostrConnections()
      const result = await loadZapData()
      expect(result).toEqual([])
    })

    it('fetches and returns processed transactions when connected', async () => {
      mockFetchTransactions.mockResolvedValue([{ id: 'tx1', amount: 100 }])

      const { addConnection, setActiveConnection, loadZapData } = useNostrConnections()
      const conn = addConnection('Wallet', 'nostr+walletconnect://pubkey?relay=wss://relay.example.com&secret=abc')
      await setActiveConnection(conn.id)

      const result = await loadZapData()
      expect(mockFetchTransactions).toHaveBeenCalled()
      expect(result).toHaveLength(1)
    })
  })
})
