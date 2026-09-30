import { ref, computed, shallowRef, triggerRef } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { batchFetchWithCache, fetchWithCache, isCacheEntry, unwrap } from '../../services/nostr/CacheEntry.js'
import { useReactiveCache } from '../core/useReactiveCache.js'

// ── Global badge cache (singleton) ────────────────────────────
const { mapRef: badgeDefinitions, store: badgeDefStore } = useReactiveCache()
const profileBadges = shallowRef(new Map())    // Map<pubkey, Array<profileBadge>>
const loadingPubkeys = ref(new Set())          // per-pubkey loading state
const error = ref('')

// NIP-58 badge event kinds
const BADGE_DEFINITION_KIND = 30009
const PROFILE_BADGES_KIND = 30008

// ── Parsers ───────────────────────────────────────────────────

/**
 * Parse badge definition event (kind 30009)
 */
const parseBadgeDefinition = (event) => {
  const badge = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    d: null,
    name: null,
    description: null,
    image: null,
    imageSize: null,
    thumbnails: []
  }

  event.tags.forEach(tag => {
    switch (tag[0]) {
      case 'd':
        badge.d = tag[1]
        break
      case 'name':
        badge.name = tag[1]
        break
      case 'description':
        badge.description = tag[1]
        break
      case 'image':
        badge.image = tag[1]
        if (tag[2]) badge.imageSize = tag[2]
        break
      case 'thumb':
        if (tag[1]) {
          badge.thumbnails.push({ url: tag[1], size: tag[2] || null })
        }
        break
    }
  })

  return badge
}

/**
 * Parse badge award event (kind 8)
 */
const parseBadgeAward = (event) => {
  const award = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    badgeDefinition: null,
    awardedTo: []
  }

  event.tags.forEach(tag => {
    switch (tag[0]) {
      case 'a':
        award.badgeDefinition = tag[1]
        break
      case 'p':
        if (tag[1]) {
          award.awardedTo.push({ pubkey: tag[1], relay: tag[2] || null })
        }
        break
    }
  })

  return award
}

/**
 * Parse profile badges event (kind 30008)
 * NIP-58: consecutive pairs of 'a' and 'e' tags
 */
const parseProfileBadges = (event) => {
  const profileBadge = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    badges: []
  }

  const tags = event.tags
  for (let i = 0; i < tags.length - 1; i++) {
    if (tags[i][0] === 'a' && tags[i + 1][0] === 'e') {
      profileBadge.badges.push({
        badgeDefinition: tags[i][1],
        badgeAward: tags[i + 1][1],
        relay: tags[i + 1][2] || null
      })
      i++ // skip consumed 'e' tag
    }
  }

  return profileBadge
}

// ── Per-pubkey loading helpers ────────────────────────────────

function setLoading(pubkey, loading) {
  const next = new Set(loadingPubkeys.value)
  if (loading) next.add(pubkey)
  else next.delete(pubkey)
  loadingPubkeys.value = next
}

const isLoadingPubkey = (pubkey) => {
  return loadingPubkeys.value.has(pubkey)
}

// ── Fetch badge definitions (kind 30009, replaceable) ─────────

const fetchBadgeDefinitions = async (badgeRefs) => {
  if (!badgeRefs || badgeRefs.length === 0) return

  try {
    error.value = ''

    await batchFetchWithCache({
      namespace: 'badgeDefs',
      keys: [...new Set(badgeRefs)],
      store: badgeDefStore,
      batchFetcher: async (missingRefs) => {
        const filters = missingRefs.map(r => {
          const parts = r.split(':')
          if (parts.length === 3 && parts[0] === '30009') {
            return { kinds: [BADGE_DEFINITION_KIND], authors: [parts[1]], '#d': [parts[2]] }
          }
          return null
        }).filter(Boolean)

        if (filters.length === 0) return new Map()

        const events = await nostrService.queryOutbox(filters, { timeout: 15000, eoseGrace: 2000 })
        const results = new Map()

        for (const event of events) {
          try {
            const badge = parseBadgeDefinition(event)
            if (!badge.d) continue

            const badgeRef = `30009:${event.pubkey}:${badge.d}`
            const existing = results.get(badgeRef)

            // Replaceable-event dedup: only keep the newest version
            if (!existing || event.created_at > existing.created_at) {
              results.set(badgeRef, badge)
            }
          } catch (err) {
            console.error('Error parsing badge definition:', err)
          }
        }

        return results
      },
      isEmpty: (v) => v == null,
      fallback: null,
      ttl: {
        hit: 10 * 60 * 1000,   // 10min
        miss: 10 * 60 * 1000,  // 10min — don't re-query missing defs
        error: 30_000           // 30s retry on error
      }
    })
  } catch (err) {
    console.error('Error fetching badge definitions:', err)
    error.value = getUserFriendlyError(err)
  }
}

// ── Fetch profile badges (kind 30008, replaceable) ────────────

const fetchProfileBadges = async (pubkey) => {
  if (!pubkey) return

  setLoading(pubkey, true)
  try {
    error.value = ''

    const filter = {
      kinds: [PROFILE_BADGES_KIND],
      authors: [pubkey],
      '#d': ['profile_badges']
    }

    const events = await nostrService.queryOutbox([filter], { timeout: 15000, eoseGrace: 2000 })

    // Replaceable-event dedup: pick the event with the highest created_at
    let latest = null
    for (const event of events) {
      if (!latest || event.created_at > latest.created_at) {
        latest = event
      }
    }

    if (latest) {
      try {
        const profileBadge = parseProfileBadges(latest)
        profileBadges.value.set(pubkey, profileBadge.badges)
        triggerRef(profileBadges)

        const badgeRefs = profileBadge.badges.map(b => b.badgeDefinition)
        if (badgeRefs.length > 0) {
          await fetchBadgeDefinitions(badgeRefs)
        }
      } catch (err) {
        console.error('Error parsing profile badges:', err)
      }
    } else {
      // Mark as fetched (empty) so we don't re-query every time
      profileBadges.value.set(pubkey, [])
      triggerRef(profileBadges)
    }
  } catch (err) {
    console.error('Error fetching profile badges:', err)
    error.value = getUserFriendlyError(err)
  } finally {
    setLoading(pubkey, false)
  }
}

// ── Public getters ────────────────────────────────────────────

/**
 * Get resolved badges for a user.
 * Filters to only badges whose definition has loaded and passes NIP-58 issuer validation.
 */
const getUserBadges = (pubkey) => {
  if (!pubkey) return []

  // Access shallowRefs to establish reactive dependency
  const defs = badgeDefinitions.value
  const profiles = profileBadges.value

  const userProfileBadges = profiles.get(pubkey) || []

  return userProfileBadges
    .map(pb => {
      const raw = defs.get(pb.badgeDefinition)
      const definition = isCacheEntry(raw) ? unwrap(raw) : raw
      if (!definition) return null

      // NIP-58 issuer validation: definition pubkey must match the a-tag reference
      const refParts = pb.badgeDefinition.split(':')
      if (refParts.length === 3 && definition.pubkey !== refParts[1]) {
        return null
      }

      return { ...pb, definition, isLoaded: true }
    })
    .filter(Boolean)
}

/**
 * Raw profile badge count (before definition loading).
 * Used for dynamic sizing so size doesn't jitter as definitions arrive.
 */
const getProfileBadgeCount = (pubkey) => {
  if (!pubkey) return 0
  const entries = profileBadges.value.get(pubkey)
  return entries ? entries.length : 0
}

const getBadgeThumbnail = (badge, preferredSize = 'medium') => {
  if (!badge?.definition) return null

  const definition = badge.definition
  if (!definition.thumbnails || definition.thumbnails.length === 0) {
    return definition.image
  }

  const sizePreferences = {
    small: ['32x32', '16x16', '64x64', '256x256'],
    medium: ['64x64', '32x32', '256x256', '512x512'],
    large: ['256x256', '512x512', '64x64', '1024x1024']
  }

  const preferences = sizePreferences[preferredSize] || sizePreferences.medium
  for (const prefSize of preferences) {
    const thumbnail = definition.thumbnails.find(t => t.size === prefSize)
    if (thumbnail) return thumbnail.url
  }

  return definition.thumbnails[0]?.url || definition.image
}

const userHasBadge = (pubkey, badgeRef) => {
  if (!pubkey || !badgeRef) return false
  return getUserBadges(pubkey).some(b => b.badgeDefinition === badgeRef)
}

const getUserBadgeCount = (pubkey) => {
  if (!pubkey) return 0
  return getUserBadges(pubkey).length
}

// ── Cache management ──────────────────────────────────────────

const clearBadgeCache = () => {
  badgeDefinitions.value.clear()
  triggerRef(badgeDefinitions)
  profileBadges.value.clear()
  triggerRef(profileBadges)
  error.value = ''
}

// ── Init (with fetch dedup via CacheEntry inflight coalescing) ─

// Adapter: profileBadges shallowRef as a store for fetchWithCache
const profileBadgesStore = {
  get: (_ns, key) => profileBadges.value.has(key) ? { status: 'hit', value: key, fetchedAt: Date.now() } : undefined,
  set: () => {}, // profileBadges is written by fetchProfileBadges directly
  has: (_ns, key) => profileBadges.value.has(key)
}

const initUserBadges = async (pubkey) => {
  if (!pubkey) return

  // Already cached
  if (profileBadges.value.has(pubkey)) {
    return getUserBadges(pubkey)
  }

  // fetchWithCache handles promise coalescing — concurrent calls
  // for the same pubkey await the same promise instead of re-fetching
  await fetchWithCache({
    namespace: 'profileBadges',
    key: pubkey,
    store: profileBadgesStore,
    fetcher: async () => {
      await fetchProfileBadges(pubkey)
      return pubkey // value doesn't matter — profileBadges is written directly
    },
    isEmpty: () => false,
    ttl: {}
  })

  return getUserBadges(pubkey)
}

// ── Export ─────────────────────────────────────────────────────

export function useBadges() {
  return {
    // State
    badgeDefinitions: computed(() => badgeDefinitions.value),
    profileBadges: computed(() => profileBadges.value),
    error: computed(() => error.value),
    isLoadingPubkey,

    // Actions
    fetchBadgeDefinitions,
    fetchProfileBadges,
    initUserBadges,
    getUserBadges,
    getProfileBadgeCount,
    getBadgeThumbnail,
    userHasBadge,
    getUserBadgeCount,
    clearBadgeCache,

    // Parsers (exposed for testing)
    parseBadgeDefinition,
    parseBadgeAward,
    parseProfileBadges
  }
}
