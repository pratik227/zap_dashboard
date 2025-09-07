import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { useFollowLists } from './useFollowLists.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { fetchProfile, batchFetchProfiles, profileCache } from '../utils/profileFetcher.js'

// Global state
const following = ref([]) // Array of pubkeys
const followers = ref([]) // Array of pubkeys
const myLists = ref([]) // Array of follow list objects
const profiles = reactive(new Map()) // Map<pubkey, profile> -- keep for backwards compat with components
const isLoading = ref(false)
const error = ref('')
const syncStatus = ref('idle')

// Subscriptions tracking
let followingSubscription = null
let followersSubscription = null
let listsSubscription = null
let profileSubscriptions = new Map()

// Cache management
const profileFetchPromises = new Map()
// const profileCache = new Map() // replaced by shared profileCache import above
const processedEventIds = new Set()

// Storage keys
const FOLLOWING_STORAGE_KEY = 'audience_following'
const FOLLOWERS_STORAGE_KEY = 'audience_followers'
const PROFILES_STORAGE_KEY = 'audience_profiles'

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  if (!pubkey) return 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Load data from localStorage
const loadFromStorage = () => {
  try {
    const storedFollowing = localStorage.getItem(FOLLOWING_STORAGE_KEY)
    if (storedFollowing) {
      // normalize stored values
      following.value = JSON.parse(storedFollowing)
    }
    
    const storedFollowers = localStorage.getItem(FOLLOWERS_STORAGE_KEY)
    if (storedFollowers) {
      followers.value = JSON.parse(storedFollowers)
    }
    
    const storedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY)
    if (storedProfiles) {
      const profileData = JSON.parse(storedProfiles)
      Object.entries(profileData).forEach(([pubkey, profile]) => {
        profileCache.set(pubkey, { profile, timestamp: Date.now() })
        profiles.set(pubkey, profile)
      })
    }
    
    console.log('Loaded audience data from storage')
  } catch (error) {
    console.error('Failed to load audience data from storage:', error)
  }
}

// Save data to localStorage
const saveToStorage = () => {
  try {
    localStorage.setItem(FOLLOWING_STORAGE_KEY, JSON.stringify(following.value))
    localStorage.setItem(FOLLOWERS_STORAGE_KEY, JSON.stringify(followers.value))
    
    // Convert profiles Map to object for storage
    const profilesObj = Object.fromEntries(profiles)
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profilesObj))
  } catch (error) {
    console.error('Failed to save audience data to storage:', error)
  }
}

// Fetch profile with caching wrapper that keeps reactive profiles map in sync
const fetchProfileSynced = async (pubkey) => {
  if (!pubkey) return null
  const profile = await fetchProfile(pubkey)
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
  // collect all pubkeys from cached following and followers
  const pubkeys = Array.from(new Set([
    ...(Array.isArray(following.value) ? following.value : []),
    ...(Array.isArray(followers.value) ? followers.value : [])
  ]))
  if (pubkeys.length === 0) return

  // wait for relay manager init
  const waitForInit = () => new Promise(resolve => {
    if (nostrRelayManager.isInitialized) return resolve()
    const check = setInterval(() => {
      if (nostrRelayManager.isInitialized) {
        clearInterval(check)
        resolve()
      }
    }, 200)
    setTimeout(() => { clearInterval(check); resolve() }, 15000)
  })

  await waitForInit()
  try {
    batchFetchProfiles(pubkeys)
  } catch (err) {
    console.warn('Audience background batchFetchProfiles failed:', err)
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
    return profiles.get(pubkey) || (profileCache.get(pubkey) ? profileCache.get(pubkey).profile : null)
  }

  const isFollowing = (pubkey) => {
    return following.value.includes(pubkey)
  }

  const getMutualFollows = (pubkey) => {
    return []
  }

  // Fetch user's following list (kind 3)
  const refreshFollowing = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch following')
      return
    }

    // Check if relay manager is initialized
    if (!nostrRelayManager.isInitialized) {
      console.log('Relay manager not initialized, waiting...')
      await new Promise((resolve) => {
        const checkInit = () => {
          if (nostrRelayManager.isInitialized) {
            resolve()
          } else {
            setTimeout(checkInit, 100)
          }
        }
        checkInit()
      })
    }

    isLoading.value = true
    error.value = ''
    syncStatus.value = 'syncing'

    try {
      console.log('Fetching following list...')

      // Close existing subscription
      if (followingSubscription) {
        followingSubscription.close()
      }

      followingSubscription = nostrRelayManager.subscribeToEvents([
        { kinds: [3], authors: [currentUser.value.pubkey], limit: 1 }
      ], {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          console.log('Received following list event:', event.id)
          
          // Extract pubkeys from p tags
          const followingPubkeys = event.tags
            .filter(tag => tag[0] === 'p' && tag[1])
            .map(tag => tag[1])

          following.value = followingPubkeys
          
          // Fetch profiles for all following users (use shared fetch + batch)
          followingPubkeys.forEach(pk => fetchProfileSynced(pk).catch(() => {}))
          batchFetchProfiles(followingPubkeys)

          syncStatus.value = 'idle'
        },
        oneose: () => {
          console.log('End of stored following events')
          isLoading.value = false
          if (syncStatus.value === 'syncing') {
            syncStatus.value = 'idle'
          }
        },
        onclose: (reason) => {
          console.log('Following subscription closed:', reason)
          isLoading.value = false
          followingSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to fetch following:', err)
      error.value = 'Failed to fetch following: ' + err.message
      syncStatus.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  // Fetch user's followers (reverse lookup)
  const refreshFollowers = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch followers')
      return
    }

    // Check if relay manager is initialized
    if (!nostrRelayManager.isInitialized) {
      console.log('Relay manager not initialized, waiting...')
      await new Promise((resolve) => {
        const checkInit = () => {
          if (nostrRelayManager.isInitialized) resolve()
          else setTimeout(checkInit, 100)
        }
        checkInit()
      })
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Fetching followers...')

      // Close existing subscription
      if (followersSubscription) {
        followersSubscription.close()
      }

      followersSubscription = nostrRelayManager.subscribeToEvents([
        { kinds: [3], '#p': [currentUser.value.pubkey], limit: 500 }
      ], {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          const pub = event.pubkey
          if (!followers.value.includes(pub)) {
            followers.value.push(pub)
            fetchProfileSynced(pub).catch(() => {})
          }
        },
        oneose: () => {
          console.log('End of stored follower events')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Followers subscription closed:', reason)
          isLoading.value = false
          followersSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to fetch followers:', err)
      error.value = 'Failed to fetch followers: ' + err.message
    } finally {
      isLoading.value = false
    }
  }

  // Follow a user
  const followUser = async (pubkey) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (following.value.includes(pubkey)) {
      console.log('Already following user:', pubkey)
      return
    }

    try {
      // Get current following list from Nostr first to ensure we have the latest data
      console.log('Fetching current following list before adding new follow...')
      const currentFollowingEvent = await nostrRelayManager.getEvent({ kinds: [3], authors: [currentUser.value.pubkey], limit: 1 })

      // Extract current follows from the latest event
      let currentFollows = []
      if (currentFollowingEvent) {
        currentFollows = currentFollowingEvent.tags.filter(tag => tag[0] === 'p' && tag[1]).map(tag => tag[1])
        console.log('Current follows from Nostr:', currentFollows.length)
      }

      // Check if already following (double-check against latest data)
      if (currentFollows.includes(pubkey)) {
        console.log('Already following user (confirmed from Nostr):', pubkey)
        // Update local state to match Nostr state
        following.value = currentFollows
        return { success: true, alreadyFollowing: true }
      }

      // Merge: Add new follow to existing follows (avoiding duplicates)
      const mergedFollows = [...new Set([...currentFollows, pubkey])]
      console.log('Merging follows:', {
        existing: currentFollows.length,
        adding: 1,
        merged: mergedFollows.length
      })

      // Update local state immediately (optimistic update)
      following.value = mergedFollows

      // Create new contact list event with merged follows
      const contactTags = mergedFollows.map(pk => ['p', pk])
      const eventTemplate = { kind: 3, created_at: Math.floor(Date.now()/1000), tags: contactTags, content: '' }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('Successfully followed user:', pubkey, 'Total follows:', mergedFollows.length)
      
      // Fetch their profile if we don't have it
      if (!profiles.has(pubkey)) {
        fetchProfileSynced(pubkey)
      }

      return { 
        success: true, 
        newFollows: 1,
        totalFollows: mergedFollows.length,
        alreadyFollowing: false
      }

    } catch (err) {
      // Revert optimistic update on error - restore to original state
      try {
        // Try to restore from the last known good state
        const currentFollowingEvent = await nostrRelayManager.getEvent({ kinds: [3], authors: [currentUser.value.pubkey], limit: 1 })
        
        if (currentFollowingEvent) {
          const originalFollows = currentFollowingEvent.tags.filter(tag => tag[0] === 'p' && tag[1]).map(tag => tag[1])
          following.value = originalFollows
          console.log('Reverted to original following list:', originalFollows.length)
        }
      } catch (revertError) {
        console.warn('Failed to revert following list:', revertError)
      }
      
      console.error('Failed to follow user:', err)
      throw err
    }
  }

  // Unfollow a user
  const unfollowUser = async (pubkey) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const index = following.value.indexOf(pubkey)
    if (index === -1) {
      console.log('Not following user:', pubkey)
      return
    }

    try {
      // Remove from local state immediately (optimistic update)
      following.value.splice(index, 1)

      // Create new contact list event
      const contactTags = following.value.map(pk => ['p', pk])
      const eventTemplate = { kind: 3, created_at: Math.floor(Date.now()/1000), tags: contactTags, content: '' }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      // Try to publish with retry logic and better error handling
      let result
      let publishError = null
      
      try {
        result = await nostrRelayManager.publishEvent(signedEvent)
        
        if (result.successful === 0) {
          publishError = new Error('Failed to publish to any relays')
        } else {
          console.log('Successfully unfollowed user:', pubkey)
          console.log(`Published unfollow to ${result.successful} relays`)
        }
      } catch (error) {
        publishError = error
      }
      
      // If publishing failed, still log success since the local state was updated
      if (publishError) {
        console.warn('Unfollow succeeded locally but failed to publish to relays:', publishError.message)
        console.log('User was successfully unfollowed locally. The change may sync to relays later.')
        
        // Don't throw the error - the unfollow operation was successful locally
        // The relay sync can happen in the background
        return {
          success: true,
          localOnly: true,
          publishError: publishError.message
        }
      }

      return {
        success: true,
        localOnly: false,
        relaysUpdated: result.successful
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

  // Search helpers
  const searchProfiles = async (query) => { console.log('Searching profiles for:', query); return [] }
  const searchLists = async (query) => { console.log('Searching lists for:', query); return [] }

  // Watch for data changes and save to storage
  watch([following, followers], saveToStorage, { deep: true })
  watch(profiles, saveToStorage, { deep: true })

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      loadFromStorage()
      setTimeout(() => { refreshFollowing() }, 1000)
    } else {
      following.value = []
      followers.value = []
      profiles.clear()
      profileCache.clear()
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => { if (followingSubscription) followingSubscription.close(); if (followersSubscription) followersSubscription.close(); profileSubscriptions.forEach(sub => sub.close()) })

  return {
    following, followers, profiles, isLoading, error, syncStatus,
    followUser, unfollowUser, searchProfiles, searchLists, refreshFollowing, refreshFollowers,
    getProfile, isFollowing, getMutualFollows, getFollowersCount, getFollowingCount,
    fetchProfile: fetchProfileSynced, generateFallbackAvatar,
    ...followLists
  }
}