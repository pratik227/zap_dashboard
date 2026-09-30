import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'

const mockSubscribe = vi.fn()
const currentUser = ref({ pubkey: 'my-pubkey' })

vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    subscribe: mockSubscribe
  }
}))

vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({
    currentUser
  })
}))

function makeHarness(useDeskInteractions) {
  let api
  const Harness = defineComponent({
    setup() {
      api = useDeskInteractions()
      return () => h('div')
    }
  })

  return {
    wrapper: mount(Harness),
    api: () => api
  }
}

function makeEvent({
  id,
  kind,
  pubkey = 'other-pubkey',
  tags = []
}) {
  return { id, kind, pubkey, tags }
}

describe('useDeskInteractions', () => {
  let useDeskInteractions
  let subscriptions

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.resetModules()

    currentUser.value = { pubkey: 'my-pubkey' }
    subscriptions = []

    mockSubscribe.mockImplementation((filters, callbacks) => {
      const sub = {
        filters,
        callbacks,
        close: vi.fn(() => {
          callbacks.onclose?.()
        })
      }
      subscriptions.push(sub)
      return sub
    })

    ;({ useDeskInteractions } = await import('../../src/composables/social/useDeskInteractions.js'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not double-count replayed events after resubscribe', () => {
    const harness = makeHarness(useDeskInteractions)
    const api = harness.api()

    api.trackPosts(['post-1'])
    vi.advanceTimersByTime(1500)

    const reaction = makeEvent({
      id: 'reaction-1',
      kind: 7,
      pubkey: 'alice',
      tags: [['e', 'post-1']]
    })

    subscriptions[0].callbacks.onevent(reaction)
    expect(api.getInteractions('post-1')).toMatchObject({
      reactions: 1,
      myReaction: false
    })

    api.trackPosts(['post-2'])
    vi.advanceTimersByTime(1500)

    subscriptions[1].callbacks.onevent(reaction)
    expect(api.getInteractions('post-1')).toMatchObject({
      reactions: 1,
      myReaction: false
    })

    harness.wrapper.unmount()
  })

  it('keeps a shared post tracked until the last owner releases it', () => {
    const harnessA = makeHarness(useDeskInteractions)
    const harnessB = makeHarness(useDeskInteractions)
    const apiA = harnessA.api()
    const apiB = harnessB.api()

    apiA.trackPosts(['shared-post'])
    apiB.trackPosts(['shared-post'])
    vi.advanceTimersByTime(1500)

    const reaction = makeEvent({
      id: 'reaction-shared-1',
      kind: 7,
      pubkey: 'alice',
      tags: [['e', 'shared-post']]
    })
    subscriptions[0].callbacks.onevent(reaction)

    expect(apiA.getInteractions('shared-post').reactions).toBe(1)
    expect(apiB.getInteractions('shared-post').reactions).toBe(1)

    apiA.untrackPosts(['shared-post'])

    const repost = makeEvent({
      id: 'repost-shared-1',
      kind: 6,
      pubkey: 'bob',
      tags: [['e', 'shared-post']]
    })
    subscriptions[0].callbacks.onevent(repost)

    expect(apiB.getInteractions('shared-post')).toMatchObject({
      reactions: 1,
      reposts: 1
    })

    apiB.untrackPosts(['shared-post'])
    vi.advanceTimersByTime(1500)

    expect(subscriptions[0].close).toHaveBeenCalled()

    harnessA.wrapper.unmount()
    harnessB.wrapper.unmount()
  })

  it('counts only real replies and ignores mention-only kind:1 events', () => {
    const harness = makeHarness(useDeskInteractions)
    const api = harness.api()

    api.trackPosts(['post-1'])
    vi.advanceTimersByTime(1500)

    subscriptions[0].callbacks.onevent(makeEvent({
      id: 'mention-only',
      kind: 1,
      tags: [['e', 'post-1', '', 'mention']]
    }))

    expect(api.getInteractions('post-1').replies).toBe(0)

    subscriptions[0].callbacks.onevent(makeEvent({
      id: 'reply-1',
      kind: 1,
      tags: [['e', 'post-1', '', 'reply']]
    }))

    subscriptions[0].callbacks.onevent(makeEvent({
      id: 'legacy-reply',
      kind: 1,
      tags: [['e', 'root-post'], ['e', 'post-1']]
    }))

    expect(api.getInteractions('post-1').replies).toBe(2)

    harness.wrapper.unmount()
  })

  it('counts quote notes with q-tags as reposts', () => {
    const harness = makeHarness(useDeskInteractions)
    const api = harness.api()

    api.trackPosts(['post-1'])
    vi.advanceTimersByTime(1500)

    subscriptions[0].callbacks.onevent(makeEvent({
      id: 'quote-1',
      kind: 1,
      pubkey: 'alice',
      tags: [['q', 'post-1'], ['p', 'author-pubkey']]
    }))

    expect(api.getInteractions('post-1')).toMatchObject({
      reposts: 1,
      myRepost: false
    })

    harness.wrapper.unmount()
  })

  it('records local events optimistically without double-counting subscription replay', () => {
    const harness = makeHarness(useDeskInteractions)
    const api = harness.api()

    api.trackPosts(['post-1'])
    api.recordLocalEvent('post-1', 7, 'local-reaction-1')

    expect(api.getInteractions('post-1')).toMatchObject({
      reactions: 1,
      myReaction: true
    })

    vi.advanceTimersByTime(1500)
    subscriptions[0].callbacks.onevent(makeEvent({
      id: 'local-reaction-1',
      kind: 7,
      pubkey: 'my-pubkey',
      tags: [['e', 'post-1']]
    }))

    expect(api.getInteractions('post-1')).toMatchObject({
      reactions: 1,
      myReaction: true
    })

    harness.wrapper.unmount()
  })

  it('keeps the shared subscription alive until the last consumer unmounts', () => {
    const harnessA = makeHarness(useDeskInteractions)
    const harnessB = makeHarness(useDeskInteractions)
    const apiA = harnessA.api()

    apiA.trackPosts(['post-1'])
    vi.advanceTimersByTime(1500)

    expect(subscriptions).toHaveLength(1)

    harnessA.wrapper.unmount()
    expect(subscriptions[0].close).not.toHaveBeenCalled()

    harnessB.wrapper.unmount()
    expect(subscriptions[0].close).toHaveBeenCalledTimes(1)
  })
})
