import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cacheHit,
  cacheMiss,
  cacheError,
  isCacheEntry,
  unwrap,
  fetchWithCache,
  batchFetchWithCache
} from '../../src/services/nostr/CacheEntry.js'

// ── Envelope factories ────────────────────────────────────────

describe('cacheHit', () => {
  it('creates envelope with status hit', () => {
    const entry = cacheHit({ name: 'Alice' })
    expect(entry.status).toBe('hit')
    expect(entry.value).toEqual({ name: 'Alice' })
    expect(entry.error).toBeNull()
    expect(typeof entry.fetchedAt).toBe('number')
  })

  it('wraps falsy values without treating them as miss', () => {
    const entry = cacheHit(0)
    expect(entry.status).toBe('hit')
    expect(entry.value).toBe(0)
  })
})

describe('cacheMiss', () => {
  it('creates envelope with status miss and fallback', () => {
    const entry = cacheMiss([])
    expect(entry.status).toBe('miss')
    expect(entry.value).toEqual([])
    expect(entry.error).toBeNull()
  })

  it('defaults fallback to null', () => {
    expect(cacheMiss().value).toBeNull()
  })
})

describe('cacheError', () => {
  it('creates envelope with status error and message', () => {
    const entry = cacheError([], 'Network timeout')
    expect(entry.status).toBe('error')
    expect(entry.value).toEqual([])
    expect(entry.error).toBe('Network timeout')
  })
})

// ── Type guard ────────────────────────────────────────────────

describe('isCacheEntry', () => {
  it('returns true for valid envelopes', () => {
    expect(isCacheEntry(cacheHit('x'))).toBe(true)
    expect(isCacheEntry(cacheMiss())).toBe(true)
    expect(isCacheEntry(cacheError())).toBe(true)
  })

  it('returns false for non-envelopes', () => {
    expect(isCacheEntry(null)).toBe(false)
    expect(isCacheEntry(undefined)).toBe(false)
    expect(isCacheEntry('string')).toBe(false)
    expect(isCacheEntry({ name: 'Alice' })).toBe(false)
    expect(isCacheEntry({ status: 'hit' })).toBe(false) // missing fetchedAt
  })
})

// ── Unwrap ────────────────────────────────────────────────────

describe('unwrap', () => {
  it('extracts value from envelope', () => {
    expect(unwrap(cacheHit('data'))).toBe('data')
    expect(unwrap(cacheMiss([]))).toEqual([])
    expect(unwrap(cacheError(null, 'err'))).toBeNull()
  })

  it('returns undefined for null/undefined input', () => {
    expect(unwrap(null)).toBeUndefined()
    expect(unwrap(undefined)).toBeUndefined()
  })

  it('passes through non-envelope values', () => {
    expect(unwrap('raw')).toBe('raw')
    expect(unwrap({ name: 'Alice' })).toEqual({ name: 'Alice' })
  })
})

// ── fetchWithCache ────────────────────────────────────────────

function createMockStore() {
  const data = new Map()
  return {
    get: (_ns, key) => data.get(key),
    set: (_ns, key, value) => data.set(key, value),
    has: (_ns, key) => data.has(key),
    _data: data
  }
}

describe('fetchWithCache', () => {
  let store

  beforeEach(() => {
    store = createMockStore()
  })

  it('calls fetcher and caches hit', async () => {
    const fetcher = vi.fn().mockResolvedValue({ name: 'Alice' })

    const result = await fetchWithCache({
      namespace: 'test', key: 'pk1', fetcher, store
    })

    expect(result).toEqual({ name: 'Alice' })
    expect(fetcher).toHaveBeenCalledOnce()

    const cached = store._data.get('pk1')
    expect(isCacheEntry(cached)).toBe(true)
    expect(cached.status).toBe('hit')
  })

  it('returns cached value without re-fetching', async () => {
    const fetcher = vi.fn().mockResolvedValue('fresh')

    await fetchWithCache({ namespace: 'test', key: 'k', fetcher, store })
    const result = await fetchWithCache({ namespace: 'test', key: 'k', fetcher, store })

    expect(result).toBe('fresh')
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('caches miss when isEmpty returns true', async () => {
    const fetcher = vi.fn().mockResolvedValue(null)

    const result = await fetchWithCache({
      namespace: 'test', key: 'k', fetcher, store,
      isEmpty: (v) => v == null,
      fallback: 'default'
    })

    expect(result).toBe('default')
    const cached = store._data.get('k')
    expect(cached.status).toBe('miss')
  })

  it('caches error on fetcher rejection', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network failed'))

    const result = await fetchWithCache({
      namespace: 'test', key: 'k', fetcher, store,
      fallback: []
    })

    expect(result).toEqual([])
    const cached = store._data.get('k')
    expect(cached.status).toBe('error')
    expect(cached.error).toBe('Network failed')
  })

  it('re-fetches after TTL expires', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2')

    await fetchWithCache({
      namespace: 'test', key: 'k', fetcher, store,
      ttl: { hit: 50 }
    })

    // Manually expire the entry
    store._data.get('k').fetchedAt = Date.now() - 100

    const result = await fetchWithCache({
      namespace: 'test', key: 'k', fetcher, store,
      ttl: { hit: 50 }
    })

    expect(result).toBe('v2')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('re-fetches miss entries after miss TTL', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('found')

    await fetchWithCache({
      namespace: 'test', key: 'k', fetcher, store,
      ttl: { miss: 50 }
    })

    // Expire the miss
    store._data.get('k').fetchedAt = Date.now() - 100

    const result = await fetchWithCache({
      namespace: 'test', key: 'k', fetcher, store,
      ttl: { miss: 50 }
    })

    expect(result).toBe('found')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent calls for same key', async () => {
    let resolvePromise
    const fetcher = vi.fn().mockImplementation(() =>
      new Promise(r => { resolvePromise = r })
    )

    const p1 = fetchWithCache({ namespace: 'test', key: 'k', fetcher, store })
    const p2 = fetchWithCache({ namespace: 'test', key: 'k', fetcher, store })

    resolvePromise('shared')

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('shared')
    expect(r2).toBe('shared')
    expect(fetcher).toHaveBeenCalledOnce()
  })
})

// ── batchFetchWithCache ───────────────────────────────────────

describe('batchFetchWithCache', () => {
  let store

  beforeEach(() => {
    store = createMockStore()
  })

  it('fetches missing keys and caches results', async () => {
    const batchFetcher = vi.fn().mockResolvedValue(
      new Map([['a', 'valA'], ['b', 'valB']])
    )

    await batchFetchWithCache({
      namespace: 'test',
      keys: ['a', 'b'],
      batchFetcher,
      store
    })

    expect(batchFetcher).toHaveBeenCalledWith(['a', 'b'])
    expect(unwrap(store._data.get('a'))).toBe('valA')
    expect(unwrap(store._data.get('b'))).toBe('valB')
    expect(store._data.get('a').status).toBe('hit')
  })

  it('marks unresolved keys as miss', async () => {
    const batchFetcher = vi.fn().mockResolvedValue(
      new Map([['a', 'valA']]) // 'b' is missing
    )

    await batchFetchWithCache({
      namespace: 'test',
      keys: ['a', 'b'],
      batchFetcher,
      fallback: 'default',
      store
    })

    expect(store._data.get('b').status).toBe('miss')
    expect(unwrap(store._data.get('b'))).toBe('default')
  })

  it('skips already cached keys', async () => {
    // Pre-cache 'a'
    store.set('test', 'a', cacheHit('cached'))

    const batchFetcher = vi.fn().mockResolvedValue(
      new Map([['b', 'valB']])
    )

    await batchFetchWithCache({
      namespace: 'test',
      keys: ['a', 'b'],
      batchFetcher,
      store
    })

    expect(batchFetcher).toHaveBeenCalledWith(['b'])
  })

  it('marks all keys as error on batch failure', async () => {
    const batchFetcher = vi.fn().mockRejectedValue(new Error('Relay down'))

    await batchFetchWithCache({
      namespace: 'test',
      keys: ['a', 'b'],
      batchFetcher,
      fallback: null,
      store
    })

    expect(store._data.get('a').status).toBe('error')
    expect(store._data.get('b').status).toBe('error')
    expect(store._data.get('a').error).toBe('Relay down')
  })

  it('does nothing when all keys are cached', async () => {
    store.set('test', 'a', cacheHit('x'))
    store.set('test', 'b', cacheHit('y'))

    const batchFetcher = vi.fn()

    await batchFetchWithCache({
      namespace: 'test',
      keys: ['a', 'b'],
      batchFetcher,
      store
    })

    expect(batchFetcher).not.toHaveBeenCalled()
  })
})
