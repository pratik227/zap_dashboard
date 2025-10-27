import { nostrRelayManager } from './nostrRelayManager.js'

// Shared profile cache and in-flight promises
export const profileCache = new Map()
const profileFetchPromises = new Map()

// Normalize fetched profile according to schema
const normalizeProfileData = (pubkey, profileData) => {
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

  // Return cached if fresh
  const cached = profileCache.get(pubkey)
  if (cached && (Date.now() - cached.timestamp) < ttl) {
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
    profileCache.set(pubkey, { profile, timestamp: Date.now() })
    return profile
  } catch (err) {
    // Fallback profile
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

// Internal single-profile fetch via subscription (uses nostrRelayManager)
const _fetchProfileFromRelays = async (pubkey) => {
  if (!pubkey || typeof pubkey !== 'string' || pubkey.length !== 64) {
    throw new Error(`Invalid pubkey for profile fetch: ${pubkey}`)
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)

    try {
      const sub = nostrRelayManager.subscribeToEvents([
        { kinds: [0], authors: [pubkey], limit: 1 }
      ], {
        onevent: (event) => {
          try {
            clearTimeout(timeout)
            const data = JSON.parse(event.content || '{}')
            const profile = normalizeProfileData(event.pubkey || pubkey, data)
            sub.close()
            resolve(profile)
          } catch (e) {
            clearTimeout(timeout)
            sub.close()
            reject(e)
          }
        },
        oneose: () => {
          setTimeout(() => {
            clearTimeout(timeout)
            sub.close()
            resolve(null)
          }, 1000)
        },
        onclose: () => {
          clearTimeout(timeout)
        }
      })
    } catch (e) {
      clearTimeout(timeout)
      reject(e)
    }
  })
}

// Batch fetch profiles for many pubkeys. Updates profileCache as results arrive.
export const batchFetchProfiles = async (pubkeys = [], { batchSize = 50, timeoutMs = 10000 } = {}) => {
  // Filter out invalid pubkeys
  const validPubkeys = pubkeys.filter(pk => pk && typeof pk === 'string' && pk.length === 64)
  const missing = validPubkeys.filter(pk => !profileCache.has(pk))

  if (missing.length === 0) return

  // Split into batches to avoid overly long author lists
  const batches = []
  for (let i = 0; i < missing.length; i += batchSize) {
    batches.push(missing.slice(i, i + batchSize))
  }

  const promises = batches.map(batch => new Promise((resolve) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; resolve() }
    }, timeoutMs)

    try {
      const sub = nostrRelayManager.subscribeToEvents([
        { kinds: [0], authors: batch, limit: batch.length }
      ], {
        onevent: (event) => {
          try {
            const data = JSON.parse(event.content || '{}')
            const profile = normalizeProfileData(event.pubkey, data)
            profileCache.set(event.pubkey, { profile, timestamp: Date.now() })
          } catch (e) {
            // ignore
          }
        },
        oneose: () => {
          if (!resolved) { resolved = true; clearTimeout(timeout); resolve() }
        },
        onclose: () => {
          if (!resolved) { resolved = true; clearTimeout(timeout); resolve() }
        }
      })
    } catch (e) {
      clearTimeout(timeout)
      if (!resolved) { resolved = true; resolve() }
    }
  }))

  await Promise.all(promises)
}
