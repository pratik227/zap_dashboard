/**
 * ProfileService — centralized profile fetching and caching.
 *
 * Uses CacheEntry envelopes so cache correctly distinguishes between
 * "never fetched," "fetched but no profile," and "fetched with profile."
 * This eliminates the infinite re-fetch bug for users without a profile picture.
 */

import { nostrService } from './NostrService.js'
import { cacheManager } from './CacheManager.js'
import { fetchWithCache, cacheHit, isCacheEntry, unwrap } from './CacheEntry.js'
import {
  PROFILE_BATCH_SIZE, PROFILE_FETCH_TIMEOUT, PROFILE_EOSE_GRACE
} from '../../utils/constants.js'

/**
 * Normalize raw profile JSON into a consistent shape.
 */
export function normalizeProfile(pubkey, data = {}) {
  return {
    pubkey,
    name: data.name || data.display_name || `user:${pubkey.substring(0, 8)}`,
    display_name: data.display_name ?? null,
    about: data.about ?? null,
    picture: data.picture ?? null,
    banner: data.banner ?? null,
    website: data.website ?? null,
    nip05: data.nip05 ?? null,
    bot: data.bot ?? false,
    birthday: data.birthday ?? null,
    lud06: data.lud06 ?? null,
    lud16: data.lud16 ?? null,
    updated_at: Date.now()
  }
}

function fallbackProfile(pubkey) {
  return normalizeProfile(pubkey, {})
}

// Store adapter that delegates to CacheManager
const profileStore = {
  get: (_ns, key) => cacheManager.get('profiles', key),
  set: (_ns, key, value, ttl) => cacheManager.set('profiles', key, value, ttl),
  has: (_ns, key) => cacheManager.has('profiles', key)
}

class ProfileService {
  /**
   * Get a single profile by pubkey.
   * Cached results (including "no profile found") are returned immediately.
   * Concurrent requests for the same pubkey are coalesced.
   */
  async get(pubkey, { forceFresh = false } = {}) {
    if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) {
      return fallbackProfile(pubkey || 'unknown')
    }

    if (forceFresh) {
      cacheManager.invalidate('profiles', pubkey)
    }

    return fetchWithCache({
      namespace: 'profiles',
      key: pubkey,
      store: profileStore,
      fetcher: async () => {
        const events = await nostrService.queryOutbox(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { timeout: 10_000, eoseGrace: 1_500 }
        )
        const event = events?.[0] ?? null
        if (!event) return null

        const data = JSON.parse(event.content || '{}')
        return normalizeProfile(event.pubkey || pubkey, data)
      },
      isEmpty: (v) => v == null,
      fallback: fallbackProfile(pubkey),
      ttl: {
        hit: undefined,             // use CacheManager's default (24h)
        miss: 12 * 60 * 60 * 1000, // 12h — retry sooner for "no profile"
        error: 30_000               // 30s — quick retry on network error
      }
    })
  }

  /**
   * Batch-fetch profiles for multiple pubkeys.
   * Only fetches pubkeys not already cached.
   */
  async batch(pubkeys = [], { batchSize = PROFILE_BATCH_SIZE, timeout = PROFILE_FETCH_TIMEOUT } = {}) {
    const valid = pubkeys.filter(pk => pk && typeof pk === 'string' && pk.length === 64)

    // Skip pubkeys that have any cached entry (hit, miss, or error)
    const missing = valid.filter(pk => {
      const cached = cacheManager.get('profiles', pk)
      return !isCacheEntry(cached)
    })

    if (missing.length === 0) return 0

    let fetchedCount = 0
    const fetchedPubkeys = new Set()

    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize)

      const events = await nostrService.queryOutbox(
        [{ kinds: [0], authors: batch, limit: batch.length }],
        { timeout, eoseGrace: PROFILE_EOSE_GRACE }
      )

      for (const event of events) {
        try {
          const data = JSON.parse(event.content || '{}')
          const profile = normalizeProfile(event.pubkey, data)
          cacheManager.set('profiles', event.pubkey, cacheHit(profile))
          fetchedPubkeys.add(event.pubkey)
          fetchedCount++
        } catch {
          // skip invalid JSON
        }
      }

      // Mark unfetched pubkeys in this batch as miss
      for (const pk of batch) {
        if (!fetchedPubkeys.has(pk) && !isCacheEntry(cacheManager.get('profiles', pk))) {
          cacheManager.set('profiles', pk, cacheHit(fallbackProfile(pk)), 12 * 60 * 60 * 1000)
        }
      }
    }

    return fetchedCount
  }

  invalidate(pubkey) {
    cacheManager.invalidate('profiles', pubkey)
  }

  /**
   * Get a cached profile without fetching. Returns undefined if not cached.
   */
  getCached(pubkey) {
    return unwrap(cacheManager.get('profiles', pubkey))
  }

  /**
   * Seed the cache with a pre-loaded profile.
   */
  seed(pubkey, profile) {
    cacheManager.set('profiles', pubkey, cacheHit(profile))
  }

  get cacheSize() {
    const store = cacheManager._namespaces.get('profiles')
    return store ? store.size : 0
  }
}

// Singleton
export const profileService = new ProfileService()
