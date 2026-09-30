import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock NostrService before importing the composable
const mockGetConnectionHealth = vi.fn()
const mockAddEventListener = vi.fn()
let mockIsInitialized = true

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    getConnectionHealth: mockGetConnectionHealth,
    addEventListener: mockAddEventListener,
    get isInitialized() { return mockIsInitialized }
  }
}))

// Mock Vue lifecycle hooks — onMounted fires immediately in tests
vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    onMounted: (fn) => fn(), // execute immediately
    onUnmounted: vi.fn()
  }
})

// Reset module-scoped state between tests by re-importing
let useConnectionStatus

beforeEach(async () => {
  vi.clearAllMocks()
  // Default healthy response
  mockGetConnectionHealth.mockReturnValue({ connected: 4, total: 8, healthyPercentage: 50 })
  mockAddEventListener.mockReturnValue(vi.fn()) // returns unsubscribe fn
  mockIsInitialized = true

  // Reset module-level state by clearing the module cache and re-importing
  vi.resetModules()

  // Re-mock after resetModules
  vi.doMock('../../src/services/nostr/NostrService.js', () => ({
    nostrService: {
      getConnectionHealth: mockGetConnectionHealth,
      addEventListener: mockAddEventListener,
      get isInitialized() { return mockIsInitialized }
    }
  }))

  vi.doMock('vue', async (importOriginal) => {
    const actual = await importOriginal()
    return {
      ...actual,
      onMounted: (fn) => fn(),
      onUnmounted: vi.fn()
    }
  })

  const mod = await import('../../src/composables/core/useConnectionStatus.js')
  useConnectionStatus = mod.useConnectionStatus
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useConnectionStatus', () => {
  describe('status computation', () => {
    it('returns "online" when healthyPercentage >= 50', () => {
      mockIsInitialized = true
      mockGetConnectionHealth.mockReturnValue({ connected: 5, total: 8, healthyPercentage: 62.5 })

      const { status, refresh } = useConnectionStatus()
      refresh()

      expect(status.value).toBe('online')
    })

    it('returns "online" when healthyPercentage is exactly 50', () => {
      mockIsInitialized = true
      mockGetConnectionHealth.mockReturnValue({ connected: 4, total: 8, healthyPercentage: 50 })

      const { status, refresh } = useConnectionStatus()
      refresh()

      expect(status.value).toBe('online')
    })

    it('returns "degraded" when healthyPercentage < 50 but connected > 0', () => {
      mockIsInitialized = true
      mockGetConnectionHealth.mockReturnValue({ connected: 2, total: 8, healthyPercentage: 25 })

      const { status, refresh } = useConnectionStatus()
      refresh()

      expect(status.value).toBe('degraded')
    })

    it('returns "offline" when connected is 0 and service is initialized', () => {
      mockIsInitialized = true
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 8, healthyPercentage: 0 })

      const { status, refresh } = useConnectionStatus()
      refresh()

      expect(status.value).toBe('offline')
    })

    it('returns "connecting" when service is not yet initialized', () => {
      mockIsInitialized = false
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 0, healthyPercentage: 0 })

      const { status, refresh } = useConnectionStatus()
      refresh()

      expect(status.value).toBe('connecting')
    })
  })

  describe('connectionLabel', () => {
    it('formats as "connected/total"', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 3, total: 8, healthyPercentage: 37.5 })

      const { connectionLabel, refresh } = useConnectionStatus()
      refresh()

      expect(connectionLabel.value).toBe('3/8')
    })

    it('shows "0/0" when there are no relays', () => {
      mockIsInitialized = false
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 0, healthyPercentage: 0 })

      const { connectionLabel, refresh } = useConnectionStatus()
      refresh()

      expect(connectionLabel.value).toBe('0/0')
    })

    it('shows "5/5" when all relays are connected', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 5, total: 5, healthyPercentage: 100 })

      const { connectionLabel, refresh } = useConnectionStatus()
      refresh()

      expect(connectionLabel.value).toBe('5/5')
    })
  })

  describe('boolean computeds', () => {
    it('isOnline is true when status is "online"', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 6, total: 8, healthyPercentage: 75 })

      const { isOnline, refresh } = useConnectionStatus()
      refresh()

      expect(isOnline.value).toBe(true)
    })

    it('isOnline is true when status is "degraded"', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 2, total: 8, healthyPercentage: 25 })

      const { isOnline, refresh } = useConnectionStatus()
      refresh()

      expect(isOnline.value).toBe(true)
    })

    it('isOnline is false when status is "offline"', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 8, healthyPercentage: 0 })

      const { isOnline, refresh } = useConnectionStatus()
      refresh()

      expect(isOnline.value).toBe(false)
    })

    it('isOffline is true only when status is "offline"', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 8, healthyPercentage: 0 })

      const { isOffline, refresh } = useConnectionStatus()
      refresh()

      expect(isOffline.value).toBe(true)
    })

    it('isOffline is false when status is "degraded"', () => {
      mockGetConnectionHealth.mockReturnValue({ connected: 1, total: 8, healthyPercentage: 12.5 })

      const { isOffline, refresh } = useConnectionStatus()
      refresh()

      expect(isOffline.value).toBe(false)
    })

    it('isConnecting is true only when status is "connecting"', () => {
      mockIsInitialized = false
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 0, healthyPercentage: 0 })

      const { isConnecting, refresh } = useConnectionStatus()
      refresh()

      expect(isConnecting.value).toBe(true)
    })

    it('isConnecting is false once initialized', () => {
      mockIsInitialized = true
      mockGetConnectionHealth.mockReturnValue({ connected: 4, total: 8, healthyPercentage: 50 })

      const { isConnecting, refresh } = useConnectionStatus()
      refresh()

      expect(isConnecting.value).toBe(false)
    })
  })

  describe('refresh()', () => {
    it('re-reads connection health from service', () => {
      const { status, refresh } = useConnectionStatus()

      // Start online
      mockGetConnectionHealth.mockReturnValue({ connected: 4, total: 8, healthyPercentage: 50 })
      refresh()
      expect(status.value).toBe('online')

      // Change to offline
      mockGetConnectionHealth.mockReturnValue({ connected: 0, total: 8, healthyPercentage: 0 })
      refresh()
      expect(status.value).toBe('offline')
    })
  })

  describe('event listener setup', () => {
    it('registers an event listener on mount', () => {
      useConnectionStatus()

      expect(mockAddEventListener).toHaveBeenCalledTimes(1)
      expect(typeof mockAddEventListener.mock.calls[0][0]).toBe('function')
    })

    it('syncs from service on initial mount', () => {
      useConnectionStatus()

      // _syncFromService is called inside _startListening
      expect(mockGetConnectionHealth).toHaveBeenCalled()
    })
  })
})
