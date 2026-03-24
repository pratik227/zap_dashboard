import { ref, reactive, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useFollowLists } from './useFollowLists.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { getFollowedPubkeys, createFollowListEventTemplate } from '../../services/nostr/nostrImports.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { storageService } from '../../services/StorageService.js'

// ── Shared kind 3 publish helper ────────────────────────────────────
// Single place that owns: build event template → preserve relay prefs → sign → publish.
// Both useAudience and useFollowLists use this instead of duplicating the pattern.

/**
 * Fetch the current kind 3 contact list event for a pubkey.
 * Returns the event or null.
 */
export const fetchCurrentContactList = async (pubkey) => {
  return nostrService.queryOne({ kinds: [3], authors: [pubkey], limit: 1 })
}

/**
 * Publish a new kind 3 contact list.
 *
 * @param {string[]} pubkeys — full set of pubkeys for the new contact list
 * @param {object}   [opts]
 * @param {string}   [opts.existingContent] — relay-preference JSON from a prior kind 3 event.
 *                    When omitted the helper fetches the current kind 3 to preserve it.
 * @param {string}   [opts.authorPubkey] — used to fetch current kind 3 when existingContent is not supplied.
 * @returns {Promise<{ event: object, result: import('../../services/nostr/PublishService.js').PublishResult }>}
 */
export const publishContactList = async (pubkeys, { existingContent, authorPubkey } = {}) => {
  // If caller didn't supply the content field, fetch the latest kind 3 to preserve relay prefs
  let content = existingContent ?? null
  if (content === null && authorPubkey) {
    const currentEvent = await fetchCurrentContactList(authorPubkey)
    content = currentEvent?.content || ''
  }

  const eventTemplate = createFollowListEventTemplate(pubkeys.map(pk => ({ pubkey: pk })))
  eventTemplate.content = content || ''

  return publishService.signAndPublish(eventTemplate)
}

// Global state
const following = ref([]) // Array of pubkeys
const followers = ref([]) // Array of pubkeys
const myLists = ref([]) // Array of follow list objects
const profiles = reactive(new Map()) // Map<pubkey, profile> -- keep for backwards compat with components
const isLoading = ref(false)
const error = ref('')
const syncStatus = ref('idle')
const FOLLOWERS_QUERY_LIMIT = 500
const followersLimitReached = ref(false)

// Subscriptions tracking
let followingSubscription = null
let followersSubscription = null

const processedEventIds = new Set()

// Storage keys
const FOLLOWING_STORAGE_KEY = 'audience_following'
const FOLLOWERS_STORAGE_KEY = 'audience_followers'
const PROFILES_STORAGE_KEY = 'audience_profiles'


// Load data from storage
const loadFromStorage = () => {
  const storedFollowing = storageService.get(FOLLOWING_STORAGE_KEY, null)
  if (storedFollowing) {
    following.value = storedFollowing
  }

  const storedFollowers = storageService.get(FOLLOWERS_STORAGE_KEY, null)
  if (storedFollowers) {
    followers.value = storedFollowers
  }

  const profileData = storageService.get(PROFILES_STORAGE_KEY, null)
  if (profileData) {
    Object.entries(profileData).forEach(([pubkey, profile]) => {
      profileService.seed(pubkey, profile)
      profiles.set(pubkey, profile)
    })
  }

  // Storage loaded successfully
}

// Save data to storage
const saveToStorage = () => {
  storageService.set(FOLLOWING_STORAGE_KEY, following.value)
  storageService.set(FOLLOWERS_STORAGE_KEY, followers.value)

  // Convert profiles Map to object for storage
  const profilesObj = Object.fromEntries(profiles)
  storageService.set(PROFILES_STORAGE_KEY, profilesObj)
}

// Fetch profile with caching wrapper that keeps reactive profiles map in sync
const fetchProfileSynced = async (pubkey) => {
  if (!pubkey) return null
  const profile = await profileService.get(pubkey)
  if (profile) profiles.set(pubkey, profile)
  return profile
}

// Immediately load cached data so UI can show audience/followers/profiles on page refresh
try {
  loadFromStorage()
} catch (e) {
  console.warn('Failed to load audience data from storage at startup:', e)
}

// Background refresh: once relay manager is initialized, refresh profiles for cached following/followers
const _startAudienceBackgroundRefresh = async () => {
  const pubkeys = Array.from(new Set([
    ...(Array.isArray(following.value) ? following.value : []),
    ...(Array.isArray(followers.value) ? followers.value : [])
  ]))
  if (pubkeys.length === 0) return

  try {
    await nostrService.ready()
    profileService.batch(pubkeys)
  } catch (err) {
    console.warn('Audience background profile refresh failed:', err.message)
  }
}

setTimeout(() => { _startAudienceBackgroundRefresh().catch(err => console.warn('Audience background refresh error:', err)) }, 0)

export function useAudience() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  const followLists = useFollowLists()

  // Computed properties
  const getFollowingCount = () => following.value.length
  const getFollowersCount = () => followers.value.length

  const getProfile = (pubkey) => {
    // Prefer reactive profiles map, fall back to shared cache
    return profiles.get(pubkey) || profileService.getCached(pubkey) || null
  }

  const isFollowing = (pubkey) => {
    return following.value.includes(pubkey)
  }

  // Fetch user's following list (kind 3)
  const refreshFollowing = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return
    }

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useAudience] Relay manager not ready:', err.message)
      return
    }

    processedEventIds.clear()
    isLoading.value = true
    error.value = ''
    syncStatus.value = 'syncing'

    try {

      // Close existing subscription if any
      if (followingSubscription) {
        followingSubscription.close()
        followingSubscription = null
      }

      // Use outbox model — fetch the user's contact list from their write relays
      const events = await nostrService.queryOutbox(
        [{ kinds: [3], authors: [currentUser.value.pubkey], limit: 1 }],
        { timeout: 15000, eoseGrace: 2000 }
      )

      // Take the most recent event (highest created_at)
      const event = events.sort((a, b) => b.created_at - a.created_at)[0]

      if (event && !processedEventIds.has(event.id)) {
        processedEventIds.add(event.id)

        // Extract pubkeys from p tags using nip02 helper
        const followingPubkeys = getFollowedPubkeys(event)

        following.value = followingPubkeys

        // Fetch profiles for all following users in batch
        profileService.batch(followingPubkeys)
      }

      syncStatus.value = 'idle'

    } catch (err) {
      console.error('Failed to fetch following:', err)
      error.value = getUserFriendlyError(err)
      syncStatus.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  // Fetch user's followers (reverse lookup)
  const refreshFollowers = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return
    }

    await nostrService.ready()

    isLoading.value = true
    error.value = ''

    try {
      // Close existing subscription
      if (followersSubscription) {
        followersSubscription.close()
      }

      const newFollowerPubkeys = []
      followersLimitReached.value = false
      followersSubscription = nostrService.subscribe([
        { kinds: [3], '#p': [currentUser.value.pubkey], limit: FOLLOWERS_QUERY_LIMIT }
      ], {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          const pub = event.pubkey
          if (!followers.value.includes(pub)) {
            followers.value.push(pub)
            newFollowerPubkeys.push(pub)
          }
        },
        oneose: () => {
          followersLimitReached.value = newFollowerPubkeys.length >= FOLLOWERS_QUERY_LIMIT
          isLoading.value = false
          if (followersSubscription) {
            followersSubscription.close()
            followersSubscription = null
          }
          // Batch fetch all new follower profiles at once
          if (newFollowerPubkeys.length > 0) {
            profileService.batch(newFollowerPubkeys).then(() => {
              newFollowerPubkeys.forEach(pub => {
                const cached = profileService.getCached(pub)
                if (cached) profiles.set(pub, cached)
              })
              saveToStorage()
            }).catch(e => {
              console.warn('Follower profile batch fetch failed:', e.message)
            })
          }
        },
        onclose: () => {
          isLoading.value = false
          followersSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to fetch followers:', err)
      error.value = getUserFriendlyError(err)
    } finally {
      isLoading.value = false
    }
  }

  // Follow a user
  const followUser = async (pubkey) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (following.value.includes(pubkey)) {
      return { success: true, alreadyFollowing: true }
    }

    // Store the current state before making changes (for potential rollback)
    const previousFollowing = [...following.value]
    const previousCount = previousFollowing.length

    try {
      // Trust local state instead of refetching from Nostr —
      // it is already up-to-date from refreshFollowing().
      const mergedFollows = [...new Set([...previousFollowing, pubkey])]

      // Safety check: must not shrink the list
      if (mergedFollows.length < previousCount) {
        throw new Error(`Safety check failed: Follow operation would reduce list from ${previousCount} to ${mergedFollows.length}`)
      }

      // Optimistic update
      following.value = mergedFollows

      // Publish via shared helper (preserves relay prefs)
      await publishContactList(mergedFollows, { authorPubkey: currentUser.value.pubkey })

      // Fetch their profile if we don't have it
      if (!profiles.has(pubkey)) {
        fetchProfileSynced(pubkey)
      }

      saveToStorage()

      return {
        success: true,
        newFollows: 1,
        totalFollows: mergedFollows.length,
        alreadyFollowing: false
      }

    } catch (err) {
      // Revert optimistic update on error
      console.error('Failed to follow user:', err)
      following.value = previousFollowing
      throw err
    }
  }

  // Unfollow a user
  const unfollowUser = async (pubkey) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    const index = following.value.indexOf(pubkey)
    if (index === -1) {
      return { success: true, notFollowing: true }
    }

    try {
      // Optimistic update: remove from local state immediately
      following.value.splice(index, 1)

      // Publish via shared helper (preserves relay prefs)
      let publishError = null
      try {
        const { result } = await publishContactList(
          [...following.value],
          { authorPubkey: currentUser.value.pubkey }
        )
        return { success: true, localOnly: false, relaysUpdated: result.successful }
      } catch (err) {
        publishError = err
      }

      // Publishing failed but local state was updated — don't throw
      console.warn('Unfollow succeeded locally but failed to publish:', publishError.userMessage || publishError.message)
      return {
        success: true,
        localOnly: true,
        publishError: publishError.userMessage || publishError.message
      }

    } catch (err) {
      following.value.splice(index, 0, pubkey)
      console.error('Failed to unfollow user:', err)
      throw err
    }
  }

  // Follow all members from a list (delegates to followLists)
  const followEntirePack = async (list) => {
    const result = await followLists.followEntirePack(list)
    if (result.success && result.updatedFollows) following.value = result.updatedFollows
    return result
  }

  // Follow selected members from a list
  const followSelectedMembers = async (list, selectedPubkeys) => {
    const result = await followLists.followSelectedMembers(list, selectedPubkeys)
    if (result.success && result.updatedFollows) following.value = result.updatedFollows
    return result
  }

  // Search helpers (stubs — to be implemented)
  const searchProfiles = async () => []
  const searchLists = async () => []

  // Watch for data changes and save to storage (debounced to avoid localStorage thrashing)
  let _audienceSaveTimer = null
  const debouncedSaveToStorage = () => {
    if (_audienceSaveTimer) clearTimeout(_audienceSaveTimer)
    _audienceSaveTimer = setTimeout(saveToStorage, 2000)
  }
  watch(() => following.value.length + followers.value.length + profiles.size, debouncedSaveToStorage)

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      loadFromStorage()
      setTimeout(() => { refreshFollowing().catch(err => console.warn('[useAudience] Refresh following failed:', err.message)) }, 1000)
      registerRefresh('audience', async () => {
        await refreshFollowing()
        await refreshFollowers()
      }, 'audience')
    } else {
      // Close active subscriptions
      if (followingSubscription) { followingSubscription.close(); followingSubscription = null }
      if (followersSubscription) { followersSubscription.close(); followersSubscription = null }
      if (_audienceSaveTimer) { clearTimeout(_audienceSaveTimer); _audienceSaveTimer = null }
      following.value = []
      followers.value = []
      profiles.clear()
      processedEventIds.clear()
      unregisterRefresh('audience')
    }
  }, { immediate: true })

  return {
    // Spread followLists first so our wrappers below override followEntirePack/followSelectedMembers
    ...followLists,
    following, followers, profiles, isLoading, error, syncStatus, followersLimitReached,
    followUser, unfollowUser, searchProfiles, searchLists, refreshFollowing, refreshFollowers,
    getProfile, isFollowing, getFollowersCount, getFollowingCount,
    fetchProfile: fetchProfileSynced, generateAvatar,
    followEntirePack, followSelectedMembers
  }
}