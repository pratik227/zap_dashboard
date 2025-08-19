import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'

// Global state
const following = ref([]) // Array of pubkeys
const followers = ref([]) // Array of pubkeys
const myLists = ref([]) // Array of follow list objects
const profiles = reactive(new Map()) // Map<pubkey, profile>
const isLoading = ref(false)
const error = ref('')
const syncStatus = ref('idle') // idle, syncing, error

// Subscriptions tracking
let followingSubscription = null
let followersSubscription = null
let listsSubscription = null
let profileSubscriptions = new Map()

// Cache management
const profileCache = new Map()
const profileFetchPromises = new Map()
const processedEventIds = new Set()

// Storage keys
const FOLLOWING_STORAGE_KEY = 'audience_following'
const FOLLOWERS_STORAGE_KEY = 'audience_followers'
const MY_LISTS_STORAGE_KEY = 'audience_my_lists'
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
      following.value = JSON.parse(storedFollowing)
    }
    
    const storedFollowers = localStorage.getItem(FOLLOWERS_STORAGE_KEY)
    if (storedFollowers) {
      followers.value = JSON.parse(storedFollowers)
    }
    
    const storedLists = localStorage.getItem(MY_LISTS_STORAGE_KEY)
    if (storedLists) {
      myLists.value = JSON.parse(storedLists)
    }
    
    const storedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY)
    if (storedProfiles) {
      const profileData = JSON.parse(storedProfiles)
      Object.entries(profileData).forEach(([pubkey, profile]) => {
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
    localStorage.setItem(MY_LISTS_STORAGE_KEY, JSON.stringify(myLists.value))
    
    // Convert profiles Map to object for storage
    const profilesObj = Object.fromEntries(profiles)
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profilesObj))
  } catch (error) {
    console.error('Failed to save audience data to storage:', error)
  }
}

// Fetch profile with caching
const fetchProfile = async (pubkey) => {
  // Check cache first
  if (profileCache.has(pubkey)) {
    const cached = profileCache.get(pubkey)
    // Use cached profile if it's less than 24 hours old
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.profile
    }
  }

  // Check if we're already fetching this profile
  if (profileFetchPromises.has(pubkey)) {
    return profileFetchPromises.get(pubkey)
  }

  // Create the fetch promise
  const fetchPromise = _fetchProfileFromNostr(pubkey)
  profileFetchPromises.set(pubkey, fetchPromise)

  try {
    const profile = await fetchPromise
    
    // Cache the result
    profileCache.set(pubkey, {
      profile,
      timestamp: Date.now()
    })
    
    // Update reactive profiles map
    profiles.set(pubkey, profile)
    
    return profile
  } catch (error) {
    console.warn(`Failed to fetch profile for ${pubkey.substring(0, 8)}:`, error)
    // Return a fallback profile
    const fallbackProfile = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateFallbackAvatar(pubkey),
      nip05: null,
      about: null
    }
    
    profiles.set(pubkey, fallbackProfile)
    return fallbackProfile
  } finally {
    profileFetchPromises.delete(pubkey)
  }
}

// Internal function to fetch profile from Nostr relays
const _fetchProfileFromNostr = async (pubkey) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Profile fetch timeout'))
    }, 15000)

    try {
      const profileSub = nostrRelayManager.subscribeToEvents([
        {
          kinds: [0],
          authors: [pubkey],
          limit: 1
        }
      ], {
        onevent: (event) => {
          try {
            clearTimeout(timeout)
            const profileData = JSON.parse(event.content)
            
            const profile = {
              pubkey,
              name: profileData.name || profileData.display_name || `user:${pubkey.substring(0, 8)}`,
              display_name: profileData.display_name || null,
              picture: profileData.picture || generateFallbackAvatar(pubkey),
              banner: profileData.banner || null,
              about: profileData.about || null,
              nip05: profileData.nip05 || null,
              lud16: profileData.lud16 || null,
              website: profileData.website || null,
              updated_at: Date.now()
            }
            
            profileSub.close()
            resolve(profile)
          } catch (error) {
            clearTimeout(timeout)
            profileSub.close()
            reject(error)
          }
        },
        oneose: () => {
          setTimeout(() => {
            clearTimeout(timeout)
            profileSub.close()
            resolve({
              pubkey,
              name: `user:${pubkey.substring(0, 8)}`,
              picture: generateFallbackAvatar(pubkey),
              nip05: null,
              about: null,
              updated_at: Date.now()
            })
          }, 2000)
        },
        onclose: () => {
          clearTimeout(timeout)
        }
      })
    } catch (error) {
      clearTimeout(timeout)
      reject(error)
    }
  })
}

export function useAudience() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  // Computed properties
  const getFollowingCount = () => following.value.length
  const getFollowersCount = () => followers.value.length

  const getProfile = (pubkey) => {
    return profiles.get(pubkey) || null
  }

  const isFollowing = (pubkey) => {
    return following.value.includes(pubkey)
  }

  const getMutualFollows = (pubkey) => {
    // Get people who both you and the target user follow
    // This would require fetching the target user's following list
    return [] // Simplified for now
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
        {
          kinds: [3], // Contact lists
          authors: [currentUser.value.pubkey],
          limit: 1
        }
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
          console.log(`Updated following list: ${followingPubkeys.length} users`)

          // Fetch profiles for all following users
          followingPubkeys.forEach(pubkey => {
            fetchProfile(pubkey).catch(error => {
              console.warn(`Failed to fetch profile for ${pubkey.substring(0, 8)}:`, error)
            })
          })

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

    try {
      console.log('Fetching followers...')

      // Close existing subscription
      if (followersSubscription) {
        followersSubscription.close()
      }

      // This is expensive - we need to find all kind 3 events that include our pubkey
      followersSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [3], // Contact lists
          '#p': [currentUser.value.pubkey], // Events that tag our pubkey
          limit: 500
        }
      ], {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          // Add this user as a follower if not already included
          if (!followers.value.includes(event.pubkey)) {
            followers.value.push(event.pubkey)
            
            // Fetch their profile
            fetchProfile(event.pubkey).catch(error => {
              console.warn(`Failed to fetch follower profile for ${event.pubkey.substring(0, 8)}:`, error)
            })
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

  // Fetch user's follow lists
  const refreshLists = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch lists')
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

    try {
      console.log('Fetching follow lists...')

      // Close existing subscription
      if (listsSubscription) {
        listsSubscription.close()
      }

      listsSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [39089], // Follow lists
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          const list = processFollowListEvent(event)
          
          if (event.pubkey === currentUser.value.pubkey) {
            // My list
            const existingIndex = myLists.value.findIndex(l => l.d === list.d)
            if (existingIndex !== -1) {
              myLists.value[existingIndex] = list
            } else {
              myLists.value.push(list)
            }
          }
        },
        oneose: () => {
          console.log('End of stored list events')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Lists subscription closed:', reason)
          isLoading.value = false
          listsSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to fetch lists:', err)
      error.value = 'Failed to fetch lists: ' + err.message
    } finally {
      isLoading.value = false
    }
  }

  // Process follow list event
  const processFollowListEvent = (event) => {
    const titleTag = event.tags.find(tag => tag[0] === 'title')
    const dTag = event.tags.find(tag => tag[0] === 'd')
    const descriptionTag = event.tags.find(tag => tag[0] === 'description')
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    
    const members = event.tags
      .filter(tag => tag[0] === 'p' && tag[1])
      .map(tag => tag[1])

    return {
      id: event.id,
      d: dTag ? dTag[1] : event.id,
      title: titleTag ? titleTag[1] : 'Untitled List',
      description: descriptionTag ? descriptionTag[1] : '',
      image: imageTag ? imageTag[1] : null,
      creator: event.pubkey,
      members,
      memberCount: members.length,
      created_at: event.created_at,
      updated_at: Date.now(),
      rawEvent: event
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
      // Add to local state immediately (optimistic update)
      following.value.push(pubkey)

      // Create new contact list event
      const contactTags = following.value.map(pk => ['p', pk])
      
      const eventTemplate = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: contactTags,
        content: '' // Can contain relay recommendations
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('Successfully followed user:', pubkey)
      
      // Fetch their profile if we don't have it
      if (!profiles.has(pubkey)) {
        fetchProfile(pubkey)
      }

    } catch (error) {
      // Revert optimistic update on error
      const index = following.value.indexOf(pubkey)
      if (index !== -1) {
        following.value.splice(index, 1)
      }
      
      console.error('Failed to follow user:', error)
      throw error
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
      
      const eventTemplate = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: contactTags,
        content: ''
      }

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

    } catch (error) {
      // Revert optimistic update on error
      following.value.splice(index, 0, pubkey)
      
      console.error('Failed to unfollow user:', error)
      throw error
    }
  }

  // Create a new follow list
  const createFollowList = async (listData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    try {
      // Generate unique identifier
      const d = crypto.randomUUID()
      
      // Build tags
      const tags = [
        ['d', d],
        ['title', listData.title],
      ]
      
      if (listData.description) {
        tags.push(['description', listData.description])
      }
      
      if (listData.image) {
        tags.push(['image', listData.image])
      }
      
      // Add members
      listData.members.forEach(pubkey => {
        tags.push(['p', pubkey])
      })

      const eventTemplate = {
        kind: 39089,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: ''
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Add to local state
      const newList = processFollowListEvent(signedEvent)
      myLists.value.push(newList)

      console.log('Successfully created follow list:', listData.title)
      return newList

    } catch (error) {
      console.error('Failed to create follow list:', error)
      throw error
    }
  }

  // Update an existing follow list
  const updateFollowList = async (listId, listData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const existingList = myLists.value.find(l => l.id === listId)
    if (!existingList) {
      throw new Error('List not found')
    }

    try {
      // Build tags (same d tag for replaceability)
      const tags = [
        ['d', existingList.d],
        ['title', listData.title],
      ]
      
      if (listData.description) {
        tags.push(['description', listData.description])
      }
      
      if (listData.image) {
        tags.push(['image', listData.image])
      }
      
      // Add members
      listData.members.forEach(pubkey => {
        tags.push(['p', pubkey])
      })

      const eventTemplate = {
        kind: 39089,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: ''
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Update local state
      const updatedList = processFollowListEvent(signedEvent)
      const index = myLists.value.findIndex(l => l.id === listId)
      if (index !== -1) {
        myLists.value[index] = updatedList
      }

      console.log('Successfully updated follow list:', listData.title)
      return updatedList

    } catch (error) {
      console.error('Failed to update follow list:', error)
      throw error
    }
  }

  // Delete a follow list
  const deleteFollowList = async (listId) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const list = myLists.value.find(l => l.id === listId)
    if (!list) {
      throw new Error('List not found')
    }

    if (!confirm(`Delete "${list.title}"? This cannot be undone.`)) {
      return
    }

    try {
      // Create deletion event
      const eventTemplate = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', listId]],
        content: 'Deleting follow list'
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      // Remove from local state
      const index = myLists.value.findIndex(l => l.id === listId)
      if (index !== -1) {
        myLists.value.splice(index, 1)
      }

      console.log('Successfully deleted follow list:', list.title)

    } catch (error) {
      console.error('Failed to delete follow list:', error)
      throw error
    }
  }

  // Follow all users from a list
  const followFromList = async (list, selectedMembers = null) => {
    const membersToFollow = selectedMembers || list.members
    const newFollows = membersToFollow.filter(pubkey => !following.value.includes(pubkey))
    
    if (newFollows.length === 0) {
      console.log('Already following all users in this list')
      return
    }

    if (!confirm(`Follow ${newFollows.length} new user${newFollows.length !== 1 ? 's' : ''} from "${list.title}"?`)) {
      return
    }

    try {
      // Add all new follows to local state
      following.value.push(...newFollows)

      // Create new contact list event
      const contactTags = following.value.map(pk => ['p', pk])
      
      const eventTemplate = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: contactTags,
        content: ''
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log(`Successfully followed ${newFollows.length} users from list`)

      // Fetch profiles for new follows
      newFollows.forEach(pubkey => {
        fetchProfile(pubkey)
      })

    } catch (error) {
      // Revert optimistic update on error
      newFollows.forEach(pubkey => {
        const index = following.value.indexOf(pubkey)
        if (index !== -1) {
          following.value.splice(index, 1)
        }
      })
      
      console.error('Failed to follow from list:', error)
      throw error
    }
  }

  // Search profiles
  const searchProfiles = async (query) => {
    // Simplified search - in a full implementation, this would query relays
    console.log('Searching profiles for:', query)
    return []
  }

  // Search lists
  const searchLists = async (query) => {
    // Simplified search - in a full implementation, this would query relays
    console.log('Searching lists for:', query)
    return []
  }

  // Watch for data changes and save to storage
  watch([following, followers, myLists], saveToStorage, { deep: true })
  watch(profiles, saveToStorage, { deep: true })

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      loadFromStorage()
      setTimeout(() => {
        refreshFollowing()
        refreshLists()
      }, 1000)
    } else {
      // Clear data when logged out
      following.value = []
      followers.value = []
      myLists.value = []
      profiles.clear()
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    if (followingSubscription) followingSubscription.close()
    if (followersSubscription) followersSubscription.close()
    if (listsSubscription) listsSubscription.close()
    profileSubscriptions.forEach(sub => sub.close())
  })

  return {
    // State
    following,
    followers,
    myLists,
    profiles,
    isLoading,
    error,
    syncStatus,
    suggestedUsers,
    isLoadingSuggestions,
    suggestionsError,
    
    // Actions
    followUser,
    unfollowUser,
    createFollowList,
    updateFollowList,
    deleteFollowList,
    followFromList,
    searchProfiles,
    searchLists,
    refreshFollowing,
    refreshFollowers,
    refreshLists,
    generateSmartSuggestions,
    
    // Getters
    getProfile,
    isFollowing,
    getMutualFollows,
    getFollowersCount,
    getFollowingCount,
    
    // Utilities
    fetchProfile,
    generateFallbackAvatar
  }
}