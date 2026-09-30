/**
 * CacheManager — centralized cache with namespaces, TTL, and LRU eviction.
 *
 * Replaces the scattered caching in nostrRelayManager (event cache),
 * profileFetcher (profile cache), and ad-hoc Maps across composables.
 *
 * Each namespace has its own max-entries and TTL config.
 * Eviction is LRU within a namespace.
 */

import {
  EVENT_CACHE_TTL, EVENT_CACHE_MAX,
  PROFILE_CACHE_TTL, PROFILE_CACHE_MAX
} from '../../utils/constants.js'

// ── Namespace configs ─────────────────────────────────────────────
const NAMESPACE_DEFAULTS = {
  events:   { maxEntries: EVENT_CACHE_MAX,   ttl: EVENT_CACHE_TTL },
  profiles: { maxEntries: PROFILE_CACHE_MAX, ttl: PROFILE_CACHE_TTL },
  contacts: { maxEntries: 500,               ttl: 5 * 60 * 1000 },
  search:   { maxEntries: 200,               ttl: 2 * 60 * 1000 },
  badges:   { maxEntries: 500,               ttl: 10 * 60 * 1000 },
}

class CacheManager {
  constructor() {
    /** @type {Map<string, Map<string, object>>} namespace → entries */
    this._namespaces = new Map()

    for (const ns of Object.keys(NAMESPACE_DEFAULTS)) {
      this._namespaces.set(ns, new Map())
    }
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * Get a cached value. Returns undefined if missing or expired.
   * Updates lastAccessed for LRU tracking.
   */
  get(namespace, key) {
    const store = this._getStore(namespace)
    const entry = store.get(key)
    if (!entry) return undefined

    const ttl = entry.ttl ?? this._getTtl(namespace)
    if (Date.now() - entry.createdAt > ttl) {
      store.delete(key)
      return undefined
    }

    entry.lastAccessed = Date.now()
    return entry.value
  }

  /**
   * Store a value. Optionally override the namespace TTL.
   * Triggers eviction if namespace is at capacity.
   */
  set(namespace, key, value, ttl) {
    const store = this._getStore(namespace)

    store.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      ...(ttl !== undefined ? { ttl } : {}),
    })

    this._evictIfNeeded(namespace)
  }

  /**
   * Check if a non-expired entry exists.
   * Note: this updates the LRU access time (delegates to get()).
   */
  has(namespace, key) {
    return this.get(namespace, key) !== undefined
  }

  /**
   * Remove a specific entry.
   */
  invalidate(namespace, key) {
    const store = this._getStore(namespace)
    store.delete(key)
  }

  /**
   * Clear entries. If namespace is provided, clears only that namespace.
   * If omitted, clears all namespaces.
   */
  clear(namespace) {
    if (namespace) {
      const store = this._namespaces.get(namespace)
      if (store) store.clear()
    } else {
      for (const store of this._namespaces.values()) {
        store.clear()
      }
    }
  }

  /**
   * Return cache stats per namespace (for debugging / monitoring).
   * Note: counts may include expired-but-not-yet-evicted entries.
   */
  stats() {
    const result = {}
    for (const [ns, store] of this._namespaces) {
      const config = NAMESPACE_DEFAULTS[ns] || {}
      result[ns] = {
        entries: store.size,
        maxEntries: config.maxEntries || 500,
        ttl: config.ttl || 60_000,
      }
    }
    return result
  }

  // ── Internals ───────────────────────────────────────────────────

  _getStore(namespace) {
    let store = this._namespaces.get(namespace)
    if (!store) {
      store = new Map()
      this._namespaces.set(namespace, store)
    }
    return store
  }

  _getTtl(namespace) {
    return NAMESPACE_DEFAULTS[namespace]?.ttl ?? 60_000
  }

  _getMaxEntries(namespace) {
    return NAMESPACE_DEFAULTS[namespace]?.maxEntries ?? 500
  }

  /**
   * Evict LRU entries when a namespace exceeds capacity.
   * Only sorts when eviction is actually needed.
   * Evicts ~20% of max to amortize the cost.
   */
  _evictIfNeeded(namespace) {
    const store = this._getStore(namespace)
    const max = this._getMaxEntries(namespace)
    if (store.size <= max) return

    const evictCount = Math.max(1, Math.ceil(max * 0.2))
    const entries = Array.from(store.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    for (let i = 0; i < evictCount && i < entries.length; i++) {
      store.delete(entries[i][0])
    }
  }
}

// Singleton
export const cacheManager = new CacheManager()
