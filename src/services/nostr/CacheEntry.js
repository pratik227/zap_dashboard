/**
 * CacheEntry — typed envelope for async fetch-through caching.
 *
 * Every cached result is wrapped in an envelope that records the fetch outcome
 * (hit / miss / error). This eliminates the "infinite re-fetch" anti-pattern
 * where empty results are never cached, causing repeated network calls.
 *
 * Two orchestrators are provided:
 *   fetchWithCache   — single-key fetch with promise coalescing
 *   batchFetchWithCache — multi-key batch fetch (e.g., badge definitions)
 *
 * Both accept a `store` object with { get(ns, key), set(ns, key, val, ttl), has(ns, key) }.
 * This matches CacheManager's API and the useReactiveCache adapter.
 */

// ── Envelope factories ────────────────────────────────────────

export function cacheHit(value) {
  return { status: 'hit', value, fetchedAt: Date.now(), error: null }
}

export function cacheMiss(fallback = null) {
  return { status: 'miss', value: fallback, fetchedAt: Date.now(), error: null }
}

export function cacheError(fallback = null, errorMessage = '') {
  return { status: 'error', value: fallback, fetchedAt: Date.now(), error: errorMessage }
}

// ── Type guard & unwrapper ────────────────────────────────────

export function isCacheEntry(obj) {
  return obj != null
    && typeof obj === 'object'
    && typeof obj.fetchedAt === 'number'
    && (obj.status === 'hit' || obj.status === 'miss' || obj.status === 'error')
}

export function unwrap(entry) {
  if (entry === undefined || entry === null) return undefined
  if (isCacheEntry(entry)) return entry.value
  return entry // pass through non-envelope values for backward compat
}

// ── TTL helpers ───────────────────────────────────────────────

function getTtlForStatus(status, ttl = {}) {
  if (status === 'hit') return ttl.hit
  if (status === 'miss') return ttl.miss ?? ttl.hit
  if (status === 'error') return ttl.error ?? 30_000
  return ttl.hit
}

function isExpired(entry, ttl) {
  if (!isCacheEntry(entry)) return true
  const entryTtl = getTtlForStatus(entry.status, ttl)
  if (entryTtl === undefined) return false // no TTL = never expires (store handles it)
  return Date.now() - entry.fetchedAt > entryTtl
}

// ── Promise coalescing (module-level singleton) ───────────────

const _inflight = new Map()

function inflightKey(namespace, key) {
  return `${namespace}:${key}`
}

// ── fetchWithCache ────────────────────────────────────────────

/**
 * Async fetch-through-cache for a single key.
 *
 * @param {object} opts
 * @param {string} opts.namespace — logical namespace (CacheManager ns or arbitrary string)
 * @param {string} opts.key — cache key
 * @param {Function} opts.fetcher — async () => value (return null/undefined for "not found")
 * @param {Function} [opts.isEmpty] — (value) => boolean — treat result as "miss"? Default: v => v == null
 * @param {*} [opts.fallback] — value stored for miss/error entries (default: null)
 * @param {object} [opts.ttl] — { hit?: ms, miss?: ms, error?: ms }
 * @param {object} opts.store — { get(ns, key), set(ns, key, val, ttl?), has(ns, key) }
 * @returns {Promise<*>} the unwrapped value
 */
export async function fetchWithCache(opts) {
  const {
    namespace,
    key,
    fetcher,
    isEmpty = (v) => v == null,
    fallback = null,
    ttl = {},
    store
  } = opts

  // 1. Check cache
  const cached = store.get(namespace, key)
  if (isCacheEntry(cached) && !isExpired(cached, ttl)) {
    return cached.value
  }

  // 2. Promise coalescing
  const fk = inflightKey(namespace, key)
  if (_inflight.has(fk)) {
    return _inflight.get(fk)
  }

  // 3. Fetch
  const promise = _executeFetch(namespace, key, fetcher, isEmpty, fallback, ttl, store)
  _inflight.set(fk, promise)

  try {
    return await promise
  } finally {
    _inflight.delete(fk)
  }
}

async function _executeFetch(namespace, key, fetcher, isEmpty, fallback, ttl, store) {
  try {
    const result = await fetcher()
    let entry
    if (isEmpty(result)) {
      entry = cacheMiss(fallback)
      store.set(namespace, key, entry, getTtlForStatus('miss', ttl))
    } else {
      entry = cacheHit(result)
      store.set(namespace, key, entry, getTtlForStatus('hit', ttl))
    }
    return entry.value
  } catch (err) {
    const entry = cacheError(fallback, err?.message || 'Unknown error')
    store.set(namespace, key, entry, getTtlForStatus('error', ttl))
    return entry.value
  }
}

// ── batchFetchWithCache ───────────────────────────────────────

/**
 * Batch variant: check cache for multiple keys, fetch missing ones
 * in a single network call, store results individually.
 *
 * @param {object} opts
 * @param {string} opts.namespace
 * @param {string[]} opts.keys — all keys to resolve
 * @param {Function} opts.batchFetcher — async (missingKeys: string[]) => Map<key, value>
 * @param {Function} [opts.isEmpty] — (value) => boolean
 * @param {*} [opts.fallback] — value for unresolved keys
 * @param {object} [opts.ttl] — { hit?, miss?, error? }
 * @param {object} opts.store — { get, set, has }
 */
export async function batchFetchWithCache(opts) {
  const {
    namespace,
    keys,
    batchFetcher,
    isEmpty = (v) => v == null,
    fallback = null,
    ttl = {},
    store
  } = opts

  if (!keys || keys.length === 0) return

  // 1. Find keys that need fetching (not cached or expired)
  const missingKeys = keys.filter(k => {
    const cached = store.get(namespace, k)
    return !isCacheEntry(cached) || isExpired(cached, ttl)
  })

  if (missingKeys.length === 0) return

  // 2. Check if a batch for these exact keys is already inflight
  // Use per-key coalescing: skip keys that are individually inflight
  const trulyMissing = missingKeys.filter(k => !_inflight.has(inflightKey(namespace, k)))

  if (trulyMissing.length === 0) {
    // All missing keys are being fetched by other callers — wait for them
    await Promise.allSettled(
      missingKeys.map(k => _inflight.get(inflightKey(namespace, k))).filter(Boolean)
    )
    return
  }

  // 3. Create individual inflight entries so concurrent callers can coalesce
  let resolve
  const batchPromise = new Promise(r => { resolve = r })

  for (const k of trulyMissing) {
    _inflight.set(inflightKey(namespace, k), batchPromise)
  }

  try {
    const results = await batchFetcher(trulyMissing)

    // 4. Store results per key
    for (const k of trulyMissing) {
      const value = results?.get(k)
      if (value !== undefined && !isEmpty(value)) {
        store.set(namespace, k, cacheHit(value), getTtlForStatus('hit', ttl))
      } else {
        store.set(namespace, k, cacheMiss(fallback), getTtlForStatus('miss', ttl))
      }
    }
  } catch (err) {
    // 5. Mark all missing keys as errored
    const errorMsg = err?.message || 'Batch fetch failed'
    for (const k of trulyMissing) {
      store.set(namespace, k, cacheError(fallback, errorMsg), getTtlForStatus('error', ttl))
    }
  } finally {
    // 6. Clean up inflight entries
    for (const k of trulyMissing) {
      _inflight.delete(inflightKey(namespace, k))
    }
    resolve()
  }
}
