import { nostrRelayManager } from '../network/nostrRelayManager.js'
import { subscribe } from '../network/subscribe.js'

// Shared profile cache and in-flight promises
export const profileCache = new Map()
const profileFetchPromises = new Map()

// Normalize fetched profile according to schema
export const normalizeProfileData = (pubkey, profileData) => {
  return {
    pubkey,
    name: profileData.name || profileData.display_name || `user:${pubkey.substring(0, 8)}`,
    display_name: profileData.display_name || null,
    about: profileData.about || null,
    picture: profileData.picture || null,
    banner: profileData.banner || null,
    website: profileData.website || null,
    nip05: profileData.nip05 || null,
    bot: profileData.bot || false,
    birthday: profileData.birthday || null,
    lud06: profileData.lud06 || null,
    lud16: profileData.lud16 || null,
    updated_at: Date.now()
  }
}

// Fetch single profile (caches result). Returns profile object.
export const fetchProfile = async (pubkey, { ttl = 24 * 60 * 60 * 1000 } = {}) => {
  if (!pubkey) return null

  // Return cached if fresh AND has picture
  const cached = profileCache.get(pubkey)
  if (cached && (Date.now() - cached.timestamp) < ttl && cached.profile?.picture) {
    return cached.profile
  }

  // Deduplicate in-flight
  if (profileFetchPromises.has(pubkey)) {
    return profileFetchPromises.get(pubkey)
  }

  const p = _fetchProfileFromRelays(pubkey)
  profileFetchPromises.set(pubkey, p)

  try {
    const profile = await p

    if (!profile) {
      const fallback = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        display_name: null,
        about: null,
        picture: null,
        banner: null,
        website: null,
        nip05: null,
        bot: false,
        birthday: null,
        lud06: null,
        lud16: null,
        updated_at: Date.now()
      }
      // Cache with shorter TTL so we retry sooner
      profileCache.set(pubkey, { profile: fallback, timestamp: Date.now() - (ttl / 2) })
      return fallback
    }

    profileCache.set(pubkey, { profile, timestamp: Date.now() })
    return profile
  } catch (err) {
    console.error('fetchProfile error for', pubkey.substring(0, 16), '-', err.message)
    const fallback = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      display_name: null,
      about: null,
      picture: null,
      banner: null,
      website: null,
      nip05: null,
      bot: false,
      birthday: null,
      lud06: null,
      lud16: null,
      updated_at: Date.now()
    }
    profileCache.set(pubkey, { profile: fallback, timestamp: Date.now() })
    return fallback
  } finally {
    profileFetchPromises.delete(pubkey)
  }
}

// Internal single-profile fetch via getEvent (one-shot, no relay spam)
const _fetchProfileFromRelays = async (pubkey) => {
  if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) {
    throw new Error(`Invalid pubkey for profile fetch: ${pubkey}`)
  }

  const event = await nostrRelayManager.getEvent({
    kinds: [0], authors: [pubkey], limit: 1
  })

  if (!event) return null

  const data = JSON.parse(event.content || '{}')
  return normalizeProfileData(event.pubkey || pubkey, data)
}

// Batch fetch profiles for many pubkeys using subscribe helper.
// Updates profileCache as results arrive.
export const batchFetchProfiles = async (pubkeys = [], { batchSize = 50, timeoutMs = 15000 } = {}) => {
  const validPubkeys = pubkeys.filter(pk => pk && typeof pk === 'string' && pk.length === 64)
  const missing = validPubkeys.filter(pk => !profileCache.has(pk))

  if (missing.length === 0) return

  // Split into batches to avoid overly long author lists
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize)

    const events = await subscribe(
      [{ kinds: [0], authors: batch, limit: batch.length }],
      { timeout: timeoutMs, eoseGrace: 1500 }
    )

    for (const event of events) {
      try {
        const data = JSON.parse(event.content || '{}')
        const profile = normalizeProfileData(event.pubkey, data)
        profileCache.set(event.pubkey, { profile, timestamp: Date.now() })
      } catch {
        // skip invalid profiles
      }
    }
  }
}
