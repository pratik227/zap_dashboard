/**
 * ProfileService — centralized profile fetching and caching.
 *
 * Replaces profileFetcher.js with a service that:
 * - Uses CacheManager (namespace: 'profiles') instead of a standalone Map
 * - Deduplicates in-flight requests
 * - Provides batch fetching with configurable batch size
 * - Normalizes profile data consistently
 *
 * Phase 1: delegates relay calls to NostrService.
 */

import { nostrService } from './NostrService.js'
import { cacheManager } from './CacheManager.js'
import {
  PROFILE_BATCH_SIZE, PROFILE_FETCH_TIMEOUT, PROFILE_EOSE_GRACE
} from '../../utils/constants.js'

/**
 * Normalize raw profile JSON into a consistent shape.
 * Uses nullish coalescing (??) to preserve falsy-but-valid values.
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

/**
 * Create a fallback profile (used when fetch fails or profile doesn't exist).
 */
function fallbackProfile(pubkey) {
  return normalizeProfile(pubkey, {})
}

class ProfileService {
  constructor() {
    /** @type {Map<string, Promise>} — deduplicates in-flight fetches */
    this._fetchPromises = new Map()
  }

  /**
   * Get a single profile by pubkey.
   * Returns cached version if available, fresh, and has a picture.
   * Deduplicates concurrent requests for the same pubkey.
   *
   * @param {string} pubkey — 64-char hex public key
   * @param {object} [opts] — { forceFresh: false }
   * @returns {Promise<object>} normalized profile
   */
  async get(pubkey, { forceFresh = false } = {}) {
    if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) {
      return fallbackProfile(pubkey || 'unknown')
    }

    // Check cache (unless forced fresh). Require picture for cache hit.
    if (!forceFresh) {
      const cached = cacheManager.get('profiles', pubkey)
      if (cached?.picture) return cached
    }

    // Deduplicate in-flight requests
    if (this._fetchPromises.has(pubkey)) {
      return this._fetchPromises.get(pubkey)
    }

    const promise = this._fetchFromRelays(pubkey)
    this._fetchPromises.set(pubkey, promise)

    try {
      return await promise
    } finally {
      this._fetchPromises.delete(pubkey)
    }
  }

  /**
   * Batch-fetch profiles for multiple pubkeys.
   * Only fetches pubkeys not already cached (with picture).
   * Updates cache as results arrive.
   *
   * @param {string[]} pubkeys
   * @param {object} [opts]
   * @returns {Promise<number>} count of profiles fetched
   */
  async batch(pubkeys = [], { batchSize = PROFILE_BATCH_SIZE, timeout = PROFILE_FETCH_TIMEOUT } = {}) {
    const valid = pubkeys.filter(pk => pk && typeof pk === 'string' && pk.length === 64)

    // Consistent with get(): skip if cached AND has picture
    const missing = valid.filter(pk => {
      const cached = cacheManager.get('profiles', pk)
      return !cached?.picture
    })

    if (missing.length === 0) return 0

    let fetchedCount = 0

    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize)

      // Use outbox model — fetch profiles from users' write relays for better discovery
      const events = await nostrService.queryOutbox(
        [{ kinds: [0], authors: batch, limit: batch.length }],
        { timeout, eoseGrace: PROFILE_EOSE_GRACE }
      )

      for (const event of events) {
        try {
          const data = JSON.parse(event.content || '{}')
          const profile = normalizeProfile(event.pubkey, data)
          cacheManager.set('profiles', event.pubkey, profile)
          fetchedCount++
        } catch {
          // skip invalid JSON
        }
      }
    }

    return fetchedCount
  }

  /**
   * Invalidate a cached profile (forces re-fetch on next get()).
   */
  invalidate(pubkey) {
    cacheManager.invalidate('profiles', pubkey)
  }

  /**
   * Get a cached profile without fetching. Returns undefined if not cached.
   */
  getCached(pubkey) {
    return cacheManager.get('profiles', pubkey)
  }

  /**
   * Seed the cache with a pre-loaded profile (e.g. from localStorage).
   * @param {string} pubkey
   * @param {object} profile — already-normalized profile object
   */
  seed(pubkey, profile) {
    cacheManager.set('profiles', pubkey, profile)
  }

  /**
   * Return the number of cached profiles.
   */
  get cacheSize() {
    const store = cacheManager._namespaces.get('profiles')
    return store ? store.size : 0
  }

  // ── Internal ────────────────────────────────────────────────────

  async _fetchFromRelays(pubkey) {
    try {
      // Use outbox model — query the user's own write relays
      const events = await nostrService.queryOutbox(
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        { timeout: 10_000, eoseGrace: 1_500 }
      )
      const event = events?.[0] ?? null

      if (!event) {
        const fb = fallbackProfile(pubkey)
        // Cache fallback with half TTL so we retry sooner
        cacheManager.set('profiles', pubkey, fb, 12 * 60 * 60 * 1000)
        return fb
      }

      const data = JSON.parse(event.content || '{}')
      const profile = normalizeProfile(event.pubkey || pubkey, data)
      cacheManager.set('profiles', pubkey, profile)
      return profile
    } catch (err) {
      console.error('ProfileService.get error:', pubkey.substring(0, 16), err.message)
      const fb = fallbackProfile(pubkey)
      cacheManager.set('profiles', pubkey, fb)
      return fb
    }
  }
}

// Singleton
export const profileService = new ProfileService()
