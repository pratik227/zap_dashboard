import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const { subscriptions, cached } = vi.hoisted(() => ({
  subscriptions: [],
  cached: {
    // Cached before quotes existed — no `quotes` array
    oldnote: { likes: [], reposts: [], bookmarks: [], zaps: [], lastFetched: null, isLoading: false }
  }
}))

vi.mock('../../src/services/StorageService.js', () => ({
  storageService: { get: vi.fn((key, d) => (key === 'engagement_metrics_cache' ? cached : d)), set: vi.fn() }
}))
vi.mock('../../src/services/nostr/NostrService.js', () => ({
  nostrService: {
    ready: vi.fn(() => new Promise(() => {})), // keep the background refresh idle
    subscribe: vi.fn((filters, callbacks) => {
      const sub = { filters, callbacks, close: vi.fn() }
      subscriptions.push(sub)
      return sub
    })
  }
}))
vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({ currentUser: ref({ pubkey: 'me' }), isAuthenticated: ref(true) })
}))

import { useEngagementMetrics } from '../../src/composables/analytics/useEngagementMetrics.js'

let n = 0
const quoteOf = (...targets) => ({
  id: `quote${++n}`, kind: 1, pubkey: 'fan', created_at: 1, content: 'look at this',
  tags: targets.map(t => ['q', t])
})

describe('useEngagementMetrics quotes', () => {
  let m

  beforeEach(() => {
    subscriptions.length = 0
    m = useEngagementMetrics()
  })

  it('counts quotes of a long-form article by its address', () => {
    m.startLongFormContentTracking('articleEvent', 'author', 'my-post')
    const aSub = subscriptions.find(s => s.filters.some(f => f['#q']?.[0] === '30023:author:my-post'))
    expect(aSub).toBeTruthy()

    aSub.callbacks.onevent(quoteOf('30023:author:my-post'))
    expect(m.getEngagementCounts('articleEvent').quotes).toBe(1)
  })

  it('counts a note quoting several tracked events for each of them', async () => {
    vi.useFakeTimers()
    m.startEngagementTracking('noteA')
    m.startEngagementTracking('noteB')
    await vi.advanceTimersByTimeAsync(1500)
    vi.useRealTimers()
    const batch = subscriptions.find(s => s.filters.some(f => f['#q']?.includes('noteA')))
    expect(batch).toBeTruthy()

    batch.callbacks.onevent(quoteOf('noteA', 'noteB', 'untracked'))
    expect(m.getEngagementCounts('noteA').quotes).toBe(1)
    expect(m.getEngagementCounts('noteB').quotes).toBe(1)
    expect(m.getEngagementMetrics('untracked')).toBeNull()
  })

  it('ignores kind 1 notes that do not quote the target', () => {
    m.startLongFormContentTracking('articleEvent2', 'author', 'other')
    const aSub = subscriptions.find(s => s.filters.some(f => f['#q']?.[0] === '30023:author:other'))
    aSub.callbacks.onevent(quoteOf('30023:someone:else'))
    expect(m.getEngagementCounts('articleEvent2').quotes).toBe(0)
  })

  it('records quotes for entries restored from an older cache', () => {
    expect(m.getEngagementMetrics('oldnote').quotes).toEqual([])
    m.startLongFormContentTracking('oldnote', 'author', 'legacy')
    const aSub = subscriptions.find(s => s.filters.some(f => f['#q']?.[0] === '30023:author:legacy'))
    aSub.callbacks.onevent(quoteOf('oldnote'))
    expect(m.getEngagementCounts('oldnote').quotes).toBe(1)
    expect(m.getEngagementCounts('oldnote').totalEngagement).toBe(1)
  })
})
