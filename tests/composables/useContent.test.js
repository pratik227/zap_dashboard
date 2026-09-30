import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock storageService
const mockStorageGet = vi.fn()
const mockStorageSet = vi.fn()

vi.mock('../../src/services/StorageService.js', () => ({
  storageService: {
    get: mockStorageGet,
    set: mockStorageSet,
    getRaw: vi.fn(),
    setRaw: vi.fn(),
    remove: vi.fn()
  },
  STORAGE_KEYS: {
    CONTENT_ITEMS: 'user_content_items',
    CONNECTIONS: 'nostr_connections',
    ACTIVE_CONNECTION: 'active_connection_id',
    NWC_URL: 'nwc_url'
  }
}))

// Mock nostrService
vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    getConnectionHealth: vi.fn(() => ({ connected: 0, total: 0, healthyPercentage: 0 })),
    getConnectionStats: vi.fn(() => ({ writeEnabled: 0 })),
    addEventListener: vi.fn(() => vi.fn()),
    isInitialized: false
  }
}))

// Mock signerService
vi.mock('../../src/services/nostr/SignerService.js', () => ({
  signerService: {
    isConnected: false
  }
}))

// Mock publishService
vi.mock('../../src/services/nostr/PublishService.js', () => ({
  publishService: {
    signAndPublish: vi.fn()
  }
}))

// Mock useNostrAuth
vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({
    currentUser: { value: { pubkey: 'testpubkey123' } },
    isAuthenticated: { value: true },
    userProfile: { value: { name: 'Test User' } }
  })
}))

// Mock useContentZaps
vi.mock('../../src/composables/content/useContentZaps.js', () => ({
  useContentZaps: () => ({
    startZapTracking: vi.fn(),
    getZapsForContent: vi.fn(),
    getTotalZapAmount: vi.fn(),
    getZapCount: vi.fn(),
    getAllContentZaps: { value: {} },
    initializeZapTracking: vi.fn(),
    clearZapsForContent: vi.fn()
  })
}))

// Mock useNostrLongForm
vi.mock('../../src/composables/content/useNostrLongForm.js', () => ({
  useNostrLongForm: () => ({
    fetchUserLongFormContent: vi.fn(),
    longFormContent: { value: [] }
  })
}))

// Mock useMentions
vi.mock('../../src/composables/content/useMentions.js', () => ({
  useMentions: () => ({
    extractPTags: vi.fn(() => [])
  })
}))

// Mock errors utility
vi.mock('../../src/services/nostr/errors.js', () => ({
  getUserFriendlyError: (err) => err.message || 'Unknown error'
}))

// Mock nwcClient (needed by useNostrConnections which may be pulled in)
vi.mock('../../src/utils/wallet/nwcClient.js', () => ({
  initializeNWC: vi.fn(),
  fetchTransactions: vi.fn(),
  getWalletInfo: vi.fn(),
  getBalance: vi.fn()
}))

// Mock dataMapper
vi.mock('../../src/utils/core/dataMapper.js', () => ({
  processTransactions: vi.fn(() => [])
}))

let getContentItems, getPublishedContentEventIds, upsertContentItem, removeContentItem

beforeEach(async () => {
  vi.clearAllMocks()
  vi.useFakeTimers()

  // Default: storage returns empty array
  mockStorageGet.mockReturnValue([])

  // Reset module state
  vi.resetModules()

  // Re-apply mocks after resetModules
  vi.doMock('../../src/services/StorageService.js', () => ({
    storageService: {
      get: mockStorageGet,
      set: mockStorageSet,
      getRaw: vi.fn(),
      setRaw: vi.fn(),
      remove: vi.fn()
    },
    STORAGE_KEYS: {
      CONTENT_ITEMS: 'user_content_items',
      CONNECTIONS: 'nostr_connections',
      ACTIVE_CONNECTION: 'active_connection_id',
      NWC_URL: 'nwc_url'
    }
  }))

  vi.doMock('../../src/services/nostr/NostrService.js', () => ({
    nostrService: {
      getConnectionHealth: vi.fn(() => ({ connected: 0, total: 0, healthyPercentage: 0 })),
      getConnectionStats: vi.fn(() => ({ writeEnabled: 0 })),
      addEventListener: vi.fn(() => vi.fn()),
      isInitialized: false
    }
  }))

  vi.doMock('../../src/services/nostr/SignerService.js', () => ({
    signerService: { isConnected: false }
  }))

  vi.doMock('../../src/services/nostr/PublishService.js', () => ({
    publishService: { signAndPublish: vi.fn() }
  }))

  vi.doMock('../../src/composables/auth/useNostrAuth.js', () => ({
    useNostrAuth: () => ({
      currentUser: { value: { pubkey: 'testpubkey123' } },
      isAuthenticated: { value: true },
      userProfile: { value: { name: 'Test User' } }
    })
  }))

  vi.doMock('../../src/composables/content/useContentZaps.js', () => ({
    useContentZaps: () => ({
      startZapTracking: vi.fn(),
      getZapsForContent: vi.fn(),
      getTotalZapAmount: vi.fn(),
      getZapCount: vi.fn(),
      getAllContentZaps: { value: {} },
      initializeZapTracking: vi.fn(),
      clearZapsForContent: vi.fn()
    })
  }))

  vi.doMock('../../src/composables/content/useNostrLongForm.js', () => ({
    useNostrLongForm: () => ({
      fetchUserLongFormContent: vi.fn(),
      longFormContent: { value: [] }
    })
  }))

  vi.doMock('../../src/composables/content/useMentions.js', () => ({
    useMentions: () => ({ extractPTags: vi.fn(() => []) })
  }))

  vi.doMock('../../src/services/nostr/errors.js', () => ({
    getUserFriendlyError: (err) => err.message || 'Unknown error'
  }))

  vi.doMock('../../src/utils/wallet/nwcClient.js', () => ({
    initializeNWC: vi.fn(),
    fetchTransactions: vi.fn(),
    getWalletInfo: vi.fn(),
    getBalance: vi.fn()
  }))

  vi.doMock('../../src/utils/core/dataMapper.js', () => ({
    processTransactions: vi.fn(() => [])
  }))

  const mod = await import('../../src/composables/content/useContent.js')
  getContentItems = mod.getContentItems
  getPublishedContentEventIds = mod.getPublishedContentEventIds
  upsertContentItem = mod.upsertContentItem
  removeContentItem = mod.removeContentItem
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useContent — shared accessors', () => {
  describe('getContentItems()', () => {
    it('returns an empty array when storage is empty', () => {
      const items = getContentItems()
      expect(items).toEqual([])
    })

    it('returns content loaded from storage', async () => {
      vi.resetModules()

      const storedItems = [
        { id: '1', title: 'Article One', status: 'published', nostrEventId: 'evt1' },
        { id: '2', title: 'Article Two', status: 'draft' }
      ]
      mockStorageGet.mockReturnValue(storedItems)

      // Re-apply all mocks after resetModules
      vi.doMock('../../src/services/StorageService.js', () => ({
        storageService: { get: mockStorageGet, set: mockStorageSet, getRaw: vi.fn(), setRaw: vi.fn(), remove: vi.fn() },
        STORAGE_KEYS: { CONTENT_ITEMS: 'user_content_items', CONNECTIONS: 'nostr_connections', ACTIVE_CONNECTION: 'active_connection_id', NWC_URL: 'nwc_url' }
      }))
      vi.doMock('../../src/services/nostr/NostrService.js', () => ({
        nostrService: { getConnectionHealth: vi.fn(() => ({ connected: 0, total: 0, healthyPercentage: 0 })), getConnectionStats: vi.fn(() => ({ writeEnabled: 0 })), addEventListener: vi.fn(() => vi.fn()), isInitialized: false }
      }))
      vi.doMock('../../src/services/nostr/SignerService.js', () => ({ signerService: { isConnected: false } }))
      vi.doMock('../../src/services/nostr/PublishService.js', () => ({ publishService: { signAndPublish: vi.fn() } }))
      vi.doMock('../../src/composables/auth/useNostrAuth.js', () => ({
        useNostrAuth: () => ({ currentUser: { value: { pubkey: 'testpubkey123' } }, isAuthenticated: { value: true }, userProfile: { value: { name: 'Test User' } } })
      }))
      vi.doMock('../../src/composables/content/useContentZaps.js', () => ({
        useContentZaps: () => ({ startZapTracking: vi.fn(), getZapsForContent: vi.fn(), getTotalZapAmount: vi.fn(), getZapCount: vi.fn(), getAllContentZaps: { value: {} }, initializeZapTracking: vi.fn(), clearZapsForContent: vi.fn() })
      }))
      vi.doMock('../../src/composables/content/useNostrLongForm.js', () => ({
        useNostrLongForm: () => ({ fetchUserLongFormContent: vi.fn(), longFormContent: { value: [] } })
      }))
      vi.doMock('../../src/composables/content/useMentions.js', () => ({ useMentions: () => ({ extractPTags: vi.fn(() => []) }) }))
      vi.doMock('../../src/services/nostr/errors.js', () => ({ getUserFriendlyError: (err) => err.message || 'Unknown error' }))
      vi.doMock('../../src/utils/wallet/nwcClient.js', () => ({ initializeNWC: vi.fn(), fetchTransactions: vi.fn(), getWalletInfo: vi.fn(), getBalance: vi.fn() }))
      vi.doMock('../../src/utils/core/dataMapper.js', () => ({ processTransactions: vi.fn(() => []) }))

      const mod = await import('../../src/composables/content/useContent.js')
      const items = mod.getContentItems()

      expect(items).toHaveLength(2)
      expect(items[0].title).toBe('Article One')
    })
  })

  describe('getPublishedContentEventIds()', () => {
    it('returns only event IDs from published items that have nostrEventId', async () => {
      vi.resetModules()

      const storedItems = [
        { id: '1', title: 'Published', status: 'published', nostrEventId: 'evt_aaa' },
        { id: '2', title: 'Draft', status: 'draft', nostrEventId: 'evt_bbb' },
        { id: '3', title: 'Published No ID', status: 'published', nostrEventId: null },
        { id: '4', title: 'Also Published', status: 'published', nostrEventId: 'evt_ccc' }
      ]
      mockStorageGet.mockReturnValue(storedItems)

      vi.doMock('../../src/services/StorageService.js', () => ({
        storageService: { get: mockStorageGet, set: mockStorageSet, getRaw: vi.fn(), setRaw: vi.fn(), remove: vi.fn() },
        STORAGE_KEYS: { CONTENT_ITEMS: 'user_content_items', CONNECTIONS: 'nostr_connections', ACTIVE_CONNECTION: 'active_connection_id', NWC_URL: 'nwc_url' }
      }))
      vi.doMock('../../src/services/nostr/NostrService.js', () => ({
        nostrService: { getConnectionHealth: vi.fn(() => ({ connected: 0, total: 0, healthyPercentage: 0 })), getConnectionStats: vi.fn(() => ({ writeEnabled: 0 })), addEventListener: vi.fn(() => vi.fn()), isInitialized: false }
      }))
      vi.doMock('../../src/services/nostr/SignerService.js', () => ({ signerService: { isConnected: false } }))
      vi.doMock('../../src/services/nostr/PublishService.js', () => ({ publishService: { signAndPublish: vi.fn() } }))
      vi.doMock('../../src/composables/auth/useNostrAuth.js', () => ({
        useNostrAuth: () => ({ currentUser: { value: { pubkey: 'testpubkey123' } }, isAuthenticated: { value: true }, userProfile: { value: { name: 'Test User' } } })
      }))
      vi.doMock('../../src/composables/content/useContentZaps.js', () => ({
        useContentZaps: () => ({ startZapTracking: vi.fn(), getZapsForContent: vi.fn(), getTotalZapAmount: vi.fn(), getZapCount: vi.fn(), getAllContentZaps: { value: {} }, initializeZapTracking: vi.fn(), clearZapsForContent: vi.fn() })
      }))
      vi.doMock('../../src/composables/content/useNostrLongForm.js', () => ({
        useNostrLongForm: () => ({ fetchUserLongFormContent: vi.fn(), longFormContent: { value: [] } })
      }))
      vi.doMock('../../src/composables/content/useMentions.js', () => ({ useMentions: () => ({ extractPTags: vi.fn(() => []) }) }))
      vi.doMock('../../src/services/nostr/errors.js', () => ({ getUserFriendlyError: (err) => err.message || 'Unknown error' }))
      vi.doMock('../../src/utils/wallet/nwcClient.js', () => ({ initializeNWC: vi.fn(), fetchTransactions: vi.fn(), getWalletInfo: vi.fn(), getBalance: vi.fn() }))
      vi.doMock('../../src/utils/core/dataMapper.js', () => ({ processTransactions: vi.fn(() => []) }))

      const mod = await import('../../src/composables/content/useContent.js')
      const eventIds = mod.getPublishedContentEventIds()

      expect(eventIds).toEqual(['evt_aaa', 'evt_ccc'])
    })

    it('returns empty array when no published items exist', () => {
      const eventIds = getPublishedContentEventIds()
      expect(eventIds).toEqual([])
    })
  })

  describe('upsertContentItem()', () => {
    it('inserts a new item when no matching item exists', () => {
      const newItem = {
        id: 'new_evt_1',
        title: 'New Article',
        description: 'Desc',
        type: 'article',
        tags: ['test'],
        coverImage: '',
        monetizationModel: 'free',
        price: 0,
        previewText: '',
        fullContent: 'Body text',
        publishedAt: '2026-01-01',
        publishedToRelays: 3
      }

      upsertContentItem(newItem)

      const items = getContentItems()
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('new_evt_1')
      expect(items[0].title).toBe('New Article')
    })

    it('updates an existing item matched by nostrEventId', () => {
      // Insert first
      upsertContentItem({
        id: 'evt_100',
        title: 'Original Title',
        description: 'Original',
        type: 'article',
        tags: [],
        coverImage: '',
        monetizationModel: 'free',
        price: 0,
        previewText: '',
        fullContent: 'Original body',
        publishedAt: '2026-01-01',
        publishedToRelays: 2
      })

      expect(getContentItems()).toHaveLength(1)

      // Update with same ID
      upsertContentItem({
        id: 'evt_100',
        title: 'Updated Title',
        description: 'Updated',
        type: 'article',
        tags: ['updated'],
        coverImage: 'img.png',
        monetizationModel: 'free',
        price: 0,
        previewText: '',
        fullContent: 'Updated body',
        publishedAt: '2026-01-02',
        publishedToRelays: 5
      })

      const items = getContentItems()
      expect(items).toHaveLength(1)
      expect(items[0].title).toBe('Updated Title')
      expect(items[0].description).toBe('Updated')
      expect(items[0].publishedToRelays).toBe(5)
      expect(items[0].status).toBe('published')
    })

    it('triggers a debounced save to storage', () => {
      upsertContentItem({
        id: 'evt_200',
        title: 'Save Test',
        description: '',
        type: 'article',
        tags: [],
        coverImage: '',
        monetizationModel: 'free',
        price: 0,
        previewText: '',
        fullContent: '',
        publishedAt: '2026-01-01',
        publishedToRelays: 1
      })

      // Debounced — should not have saved immediately
      expect(mockStorageSet).not.toHaveBeenCalledWith('user_content_items', expect.anything())

      // Advance past the 2000ms debounce
      vi.advanceTimersByTime(2500)

      expect(mockStorageSet).toHaveBeenCalledWith('user_content_items', expect.any(Array))
    })
  })

  describe('removeContentItem()', () => {
    it('removes an item by its id', () => {
      // Insert two items
      upsertContentItem({ id: 'evt_a', title: 'A', description: '', type: 'article', tags: [], coverImage: '', monetizationModel: 'free', price: 0, previewText: '', fullContent: '', publishedAt: '', publishedToRelays: 1 })
      upsertContentItem({ id: 'evt_b', title: 'B', description: '', type: 'article', tags: [], coverImage: '', monetizationModel: 'free', price: 0, previewText: '', fullContent: '', publishedAt: '', publishedToRelays: 1 })

      expect(getContentItems()).toHaveLength(2)

      removeContentItem('evt_a')

      const items = getContentItems()
      expect(items).toHaveLength(1)
      expect(items[0].id).toBe('evt_b')
    })

    it('removes an item by its nostrEventId', () => {
      // Manually build an item with a different nostrEventId
      upsertContentItem({ id: 'evt_x', title: 'X', description: '', type: 'article', tags: [], coverImage: '', monetizationModel: 'free', price: 0, previewText: '', fullContent: '', publishedAt: '', publishedToRelays: 1 })

      expect(getContentItems()).toHaveLength(1)

      // removeContentItem checks both item.nostrEventId and item.id
      removeContentItem('evt_x')
      expect(getContentItems()).toHaveLength(0)
    })

    it('does nothing when id does not match any item', () => {
      upsertContentItem({ id: 'evt_keep', title: 'Keep', description: '', type: 'article', tags: [], coverImage: '', monetizationModel: 'free', price: 0, previewText: '', fullContent: '', publishedAt: '', publishedToRelays: 1 })

      removeContentItem('nonexistent_id')

      expect(getContentItems()).toHaveLength(1)
    })
  })
})
