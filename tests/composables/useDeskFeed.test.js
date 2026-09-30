import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

const currentUser = ref({ pubkey: 'viewer-pubkey' })
const following = ref([])
const mockReady = vi.fn()
const mockSubscribe = vi.fn()

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    ready: mockReady,
    subscribe: mockSubscribe
  }
}))

vi.mock('../../src/services/nostr/ProfileService.js', () => ({
  profileService: {
    batch: vi.fn(),
    getCached: vi.fn(() => null)
  }
}))

vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({
    currentUser
  })
}))

vi.mock('../../src/composables/audience/useAudience.js', () => ({
  useAudience: () => ({
    following
  })
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  nip19: {
    decode: vi.fn()
  }
}))

vi.mock('../../src/services/nostr/errors.js', () => ({
  getUserFriendlyError: (err) => err.message || 'Unknown error'
}))

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

function mountHarness(useDeskFeed, columnRef) {
  let api
  const Harness = defineComponent({
    setup() {
      api = useDeskFeed(columnRef)
      return () => h('div')
    }
  })

  return {
    wrapper: mount(Harness),
    api: () => api
  }
}

describe('useDeskFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser.value = { pubkey: 'viewer-pubkey' }
    following.value = []
    mockReady.mockResolvedValue()
    mockSubscribe.mockImplementation((_filters, callbacks) => ({
      close: vi.fn(() => callbacks.onclose?.())
    }))
  })

  it('subscribes to followed pubkey strings with correct authors', async () => {
    following.value = ['alice', 'bob']

    vi.resetModules()
    const { useDeskFeed } = await import('../../src/composables/social/useDeskFeed.js')
    const columnRef = ref({ id: 'following', type: 'following', filter: '' })
    const harness = mountHarness(useDeskFeed, columnRef)

    await flushAsyncWork()

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledWith([
      expect.objectContaining({
        kinds: [1],
        authors: ['alice', 'bob'],
        limit: 40
      })
    ], expect.any(Object))

    harness.wrapper.unmount()
  })

  it('resubscribes when the following list loads after mount', async () => {
    vi.resetModules()
    const { useDeskFeed } = await import('../../src/composables/social/useDeskFeed.js')
    const columnRef = ref({ id: 'following', type: 'following', filter: '' })
    const harness = mountHarness(useDeskFeed, columnRef)

    await flushAsyncWork()
    // No following yet — should not subscribe (returns null filters)
    expect(mockSubscribe).not.toHaveBeenCalled()

    following.value = ['carol']
    await flushAsyncWork()

    // Now following has data — should subscribe
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
    expect(mockSubscribe).toHaveBeenCalledWith([
      expect.objectContaining({
        kinds: [1],
        authors: ['carol'],
        limit: 40
      })
    ], expect.any(Object))

    harness.wrapper.unmount()
  })

  it('subscribes to longform hashtag filters with kind 30023', async () => {
    vi.resetModules()
    const { useDeskFeed } = await import('../../src/composables/social/useDeskFeed.js')
    const columnRef = ref({ id: 'longform-tag', type: 'longform', filter: 'tag:nostr' })
    const harness = mountHarness(useDeskFeed, columnRef)

    await flushAsyncWork()

    expect(mockSubscribe).toHaveBeenCalledWith([
      expect.objectContaining({
        kinds: [30023],
        '#t': ['nostr'],
        limit: 40
      })
    ], expect.any(Object))

    harness.wrapper.unmount()
  })

  it('subscribes to longform user filters with kind 30023', async () => {
    vi.resetModules()
    const { useDeskFeed } = await import('../../src/composables/social/useDeskFeed.js')
    const columnRef = ref({ id: 'longform-user', type: 'longform', filter: 'user:author-pubkey' })
    const harness = mountHarness(useDeskFeed, columnRef)

    await flushAsyncWork()

    expect(mockSubscribe).toHaveBeenCalledWith([
      expect.objectContaining({
        kinds: [30023],
        authors: ['author-pubkey'],
        limit: 40
      })
    ], expect.any(Object))

    harness.wrapper.unmount()
  })

  it('inserts late historical events at correct position, not at top', async () => {
    vi.resetModules()
    const { useDeskFeed } = await import('../../src/composables/social/useDeskFeed.js')
    const columnRef = ref({ id: 'test', type: 'global', filter: '' })

    let eventCallback
    mockSubscribe.mockImplementation((_filters, callbacks) => {
      eventCallback = callbacks.onevent
      // Simulate EOSE after initial events
      setTimeout(() => callbacks.oneose?.(), 10)
      return { close: vi.fn() }
    })

    const harness = mountHarness(useDeskFeed, columnRef)
    await flushAsyncWork()

    // Send initial events
    eventCallback({ id: 'a', pubkey: 'p1', content: 'first', created_at: 100, tags: [] })
    eventCallback({ id: 'b', pubkey: 'p1', content: 'second', created_at: 200, tags: [] })

    // Wait for EOSE
    await new Promise(r => setTimeout(r, 20))
    await flushAsyncWork()

    const api = harness.api()
    // After EOSE, posts should be sorted desc: [200, 100]
    expect(api.posts.value[0].created_at).toBe(200)
    expect(api.posts.value[1].created_at).toBe(100)

    // Now simulate a late historical event (created_at: 150)
    eventCallback({ id: 'c', pubkey: 'p1', content: 'late', created_at: 150, tags: [] })
    await nextTick()

    // Should be inserted between 200 and 100, not at top
    expect(api.posts.value.length).toBe(3)
    expect(api.posts.value[0].created_at).toBe(200)
    expect(api.posts.value[1].created_at).toBe(150)
    expect(api.posts.value[2].created_at).toBe(100)

    harness.wrapper.unmount()
  })
})
