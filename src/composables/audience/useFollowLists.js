import { ref, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { getFollowedPubkeys } from '../../services/nostr/nostrImports.js'
import { mergeFollowLists } from '../../utils/profile/followMergeUtils.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { storageService } from '../../services/StorageService.js'
import { fetchCurrentContactList, publishContactList } from './useAudience.js'

// Global state for follow lists
const myLists = ref([]) // Lists created by current user
const discoveredLists = ref([]) // Lists discovered from network
const isLoading = ref(false)
const error = ref('')
const syncStatus = ref('idle') // idle, syncing, error

// Subscriptions tracking
let myListsSubscription = null
let discoveredListsSubscription = null
const processedEventIds = new Set()

// Storage keys
const MY_LISTS_STORAGE_KEY = 'follow_lists_my'
const DISCOVERED_LISTS_STORAGE_KEY = 'follow_lists_discovered'
const PROFILES_STORAGE_KEY = 'follow_lists_profiles'

// NIP-39089 Follow List Kind
const FOLLOW_LIST_KIND = 39089


// Load data from storage
const loadFromStorage = () => {
  const storedMyLists = storageService.get(MY_LISTS_STORAGE_KEY, null)
  if (storedMyLists) {
    myLists.value = storedMyLists.map(list => ({ ...list, members: (list.members || []) }))
  }

  const storedDiscovered = storageService.get(DISCOVERED_LISTS_STORAGE_KEY, null)
  if (storedDiscovered) {
    discoveredLists.value = storedDiscovered.map(list => ({ ...list, members: (list.members || []) }))
  }

  const profileData = storageService.get(PROFILES_STORAGE_KEY, null)
  if (profileData) {
    Object.entries(profileData).forEach(([pubkey, profile]) => {
      profileService.seed(pubkey, profile)
    })
  }

  // Storage loaded successfully
}

// Save data to storage
const saveToStorage = () => {
  storageService.set(MY_LISTS_STORAGE_KEY, myLists.value)
  storageService.set(DISCOVERED_LISTS_STORAGE_KEY, discoveredLists.value)

  // Only save profiles that belong to list members (not entire shared cache)
  const listPubkeys = new Set()
  ;[...myLists.value, ...discoveredLists.value].forEach(list => {
    (list.members || []).forEach(m => { if (m.pubkey) listPubkeys.add(m.pubkey) })
  })
  const profilesObj = {}
  listPubkeys.forEach(pubkey => {
    const cached = profileService.getCached(pubkey)
    if (cached) profilesObj[pubkey] = cached
  })
  storageService.set(PROFILES_STORAGE_KEY, profilesObj)
}

// Process follow list event according to NIP-39089
const processFollowListEvent = (event) => {
  try {
    const titleTag = event.tags.find(tag => tag[0] === 'title')
    const dTag = event.tags.find(tag => tag[0] === 'd')
    const descriptionTag = event.tags.find(tag => tag[0] === 'description')
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    
    // Extract members from 'p' tags using nip02 helper
    const members = getFollowedPubkeys(event)

    const list = {
      id: event.id,
      d: dTag ? dTag[1] : event.id, // Unique identifier for replaceability
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

    // Fetch profiles for all members in batch for efficiency
    profileService.batch(members) // Removed individual fetchProfile for batch efficiency

    return list
  } catch (error) {
    console.error('Failed to process follow list event:', error)
    return null
  }
}

// Load cached data immediately so UI can show lists/profiles on page refresh
try {
  loadFromStorage()
} catch (e) {
  console.warn('Failed to load follow lists from storage at startup:', e)
}

// Background refresh: once relay manager is initialized, refresh profiles for cached members
const _startBackgroundRefresh = async () => {
  const memberPubkeys = new Set()
  myLists.value.forEach(list => (list.members || []).forEach(pk => pk && memberPubkeys.add(pk)))
  discoveredLists.value.forEach(list => (list.members || []).forEach(pk => pk && memberPubkeys.add(pk)))
  const pubkeys = Array.from(memberPubkeys)
  if (pubkeys.length === 0) return

  try {
    await nostrService.ready()
    profileService.batch(pubkeys)
  } catch (err) {
    console.warn('Follow lists background profile refresh failed:', err.message)
  }
}

// Kick off background refresh without blocking import
setTimeout(() => { _startBackgroundRefresh().catch(err => console.warn('Background refresh error:', err)) }, 0)

/**
 * Internal helper: fetch current kind 3 → merge with new pubkeys → validate.
 * Returns { mergedFollows, currentFollows, existingContent } ready for publishContactList.
 */
const _mergeWithCurrentFollows = async (authorPubkey, newPubkeys) => {
  const currentFollowingEvent = await fetchCurrentContactList(authorPubkey)

  let currentFollows = []
  const existingContent = currentFollowingEvent?.content || ''
  if (currentFollowingEvent) {
    currentFollows = getFollowedPubkeys(currentFollowingEvent)
  }

  const { mergedFollows } = mergeFollowLists(currentFollows, newPubkeys)

  // Safety check: merged list must not be smaller than current
  if (mergedFollows.length < currentFollows.length) {
    throw new Error(`Safety check failed: follow operation would reduce list from ${currentFollows.length} to ${mergedFollows.length}`)
  }

  return { mergedFollows, currentFollows, existingContent }
}

export function useFollowLists() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  // Computed properties
  const myListsCount = computed(() => myLists.value.length)
  const discoveredListsCount = computed(() => discoveredLists.value.length)

  const getProfile = (pubkey) => {
    return profileService.getCached(pubkey) || null
  }

  // Fetch user's own follow lists
  const fetchMyLists = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return
    }

    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useFollowLists] Relay manager not ready:', err.message)
      return
    }

    processedEventIds.clear()
    isLoading.value = true
    error.value = ''
    syncStatus.value = 'syncing'

    try {
      // Close existing subscription
      if (myListsSubscription) {
        myListsSubscription.close()
      }

      myListsSubscription = nostrService.subscribe([
        {
          kinds: [FOLLOW_LIST_KIND], // Follow lists
          authors: [currentUser.value.pubkey],
          limit: 100
        },
        {
          kinds: [5], // Deletion events
          authors: [currentUser.value.pubkey],
          '#e': myLists.value.map(list => list.id), // Only deletions for our lists
          limit: 50
        }
      ], {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          if (event.kind === FOLLOW_LIST_KIND) {
            const list = processFollowListEvent(event)
            if (list) {
              // Check if we already have this list (by d tag for replaceability)
              const existingIndex = myLists.value.findIndex(l => l.d === list.d)
              
              if (existingIndex !== -1) {
                // Update existing list (newer created_at wins)
                if (event.created_at > myLists.value[existingIndex].created_at) {
                  myLists.value[existingIndex] = list
                }
              } else {
                myLists.value.push(list)
              }
            }
          } else if (event.kind === 5) {
            // Handle deletion events
            const deletedEventIds = event.tags
              .filter(tag => tag[0] === 'e')
              .map(tag => tag[1])
            
            deletedEventIds.forEach(id => {
              const index = myLists.value.findIndex(l => l.id === id)
              if (index !== -1) myLists.value.splice(index, 1)
            })
          }

          syncStatus.value = 'idle'
        },
        oneose: () => {
          isLoading.value = false
          if (syncStatus.value === 'syncing') {
            syncStatus.value = 'idle'
          }
          if (myListsSubscription) {
            myListsSubscription.close()
            myListsSubscription = null
          }
        },
        onclose: () => {
          isLoading.value = false
          myListsSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to fetch my lists:', err)
      error.value = getUserFriendlyError(err)
      syncStatus.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  // Discover public follow lists from the network
  const discoverLists = async (searchQuery = '', limit = 50) => {
    try {
      await nostrService.ready()
    } catch (err) {
      console.warn('[useFollowLists] Relay manager not ready:', err.message)
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      // Close existing subscription
      if (discoveredListsSubscription) {
        discoveredListsSubscription.close()
      }

      // Build filter for discovery
      const filters = [{
        kinds: [FOLLOW_LIST_KIND],
        limit: limit
      }]

      // If search query provided, we'll filter client-side since Nostr doesn't support content search
      discoveredListsSubscription = nostrService.subscribe(filters, {
        onevent: (event) => {
          if (processedEventIds.has(event.id)) return
          processedEventIds.add(event.id)

          // Skip our own lists
          if (event.pubkey === currentUser.value?.pubkey) return

          const list = processFollowListEvent(event)
          if (list) {
            // Apply search filter if provided
            if (searchQuery) {
              const query = searchQuery.toLowerCase()
              const matchesTitle = list.title.toLowerCase().includes(query)
              const matchesDescription = list.description.toLowerCase().includes(query)
              
              if (!matchesTitle && !matchesDescription) {
                return
              }
            }

            // Check if we already have this list
            const existingIndex = discoveredLists.value.findIndex(l => l.id === event.id)
            
            if (existingIndex !== -1) {
              // Update existing list
              discoveredLists.value[existingIndex] = list
            } else {
              discoveredLists.value.push(list)
            }
          }
        },
        oneose: () => {
          isLoading.value = false
          // Close subscription after grace period to avoid indefinite relay connection
          setTimeout(() => {
            if (discoveredListsSubscription) {
              discoveredListsSubscription.close()
              discoveredListsSubscription = null
            }
          }, 5000)
        },
        onclose: () => {
          isLoading.value = false
          discoveredListsSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to discover lists:', err)
      error.value = getUserFriendlyError(err)
    } finally {
      isLoading.value = false
    }
  }

  // Create a new follow list according to NIP-39089
  const createFollowPack = async (listData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!listData.title?.trim()) {
      throw new Error('Pack title is required')
    }

    if (!Array.isArray(listData.members) || listData.members.length === 0) {
      throw new Error('Pack must have at least one member')
    }

    isLoading.value = true
    error.value = ''

    try {
      // Generate unique identifier for replaceability
      const d = crypto.randomUUID()
      
      // Build tags according to NIP-39089
      const tags = [
        ['d', d], // Unique identifier for replaceability
        ['title', listData.title.trim()]
      ]
      
      // Add optional fields
      if (listData.description?.trim()) {
        tags.push(['description', listData.description.trim()])
      }
      
      if (listData.image?.trim()) {
        tags.push(['image', listData.image.trim()])
      }
      
      // Add members as 'p' tags
      listData.members.forEach(pubkey => {
        if (pubkey && typeof pubkey === 'string' && pubkey.length === 64) {
          tags.push(['p', pubkey])
        }
      })

      // Create event template
      const eventTemplate = {
        kind: FOLLOW_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '' // Usually empty for follow lists
      }

      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      // Mark this event as processed to prevent duplicate processing via subscription
      processedEventIds.add(signedEvent.id)

      // Process and add to local state manually (since we marked it as processed)
      const newList = processFollowListEvent(signedEvent)
      if (newList) {
        const existingIndex = myLists.value.findIndex(l => l.id === newList.id || l.d === newList.d)
        if (existingIndex === -1) {
          myLists.value.push(newList)
        } else {
          myLists.value[existingIndex] = newList
        }
      }

      return newList

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('Follow pack creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update an existing follow list (creates new version due to replaceability)
  const updateFollowPack = async (listId, listData) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    const existingList = myLists.value.find(l => l.id === listId)
    if (!existingList) {
      throw new Error('Pack not found')
    }

    isLoading.value = true
    error.value = ''

    try {
      // Use same 'd' tag for replaceability
      const tags = [
        ['d', existingList.d], // Same identifier for replaceability
        ['title', listData.title.trim()]
      ]
      
      // Add optional fields
      if (listData.description?.trim()) {
        tags.push(['description', listData.description.trim()])
      }
      
      if (listData.image?.trim()) {
        tags.push(['image', listData.image.trim()])
      }
      
      // Add members as 'p' tags
      listData.members.forEach(pubkey => {
        if (pubkey && typeof pubkey === 'string' && pubkey.length === 64) {
          tags.push(['p', pubkey])
        }
      })

      // Create event template with newer timestamp
      const eventTemplate = {
        kind: FOLLOW_LIST_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: ''
      }

      const { event: signedEvent, result } = await publishService.signAndPublish(eventTemplate)

      // Mark this event as processed to prevent duplicate processing via subscription
      processedEventIds.add(signedEvent.id)

      // Process and update local state manually (since we marked it as processed)
      const updatedList = processFollowListEvent(signedEvent)
      if (updatedList) {
        const index = myLists.value.findIndex(l => l.id === listId)
        if (index !== -1) {
          myLists.value[index] = updatedList
        } else {
          const dIndex = myLists.value.findIndex(l => l.d === updatedList.d)
          if (dIndex !== -1) {
            myLists.value[dIndex] = updatedList
          } else {
            myLists.value.push(updatedList)
          }
        }
      }

      return updatedList

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('Follow pack update error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete a follow list (publish kind 5 deletion event)
  const deleteFollowPack = async (listId) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    const list = myLists.value.find(l => l.id === listId)
    if (!list) {
      throw new Error('Pack not found')
    }

    isLoading.value = true
    error.value = ''

    // Store the list and its index for potential rollback
    const listIndex = myLists.value.findIndex(l => l.id === listId)
    const listBackup = { ...list }

    // Optimistic update: remove from local state immediately
    myLists.value.splice(listIndex, 1)
    try {
      // Create deletion event
      const eventTemplate = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', listId]], // Reference to the event being deleted
        content: 'Deleting follow pack'
      }

      const { result } = await publishService.signAndPublish(eventTemplate)

      return true

    } catch (err) {
      // Rollback: re-add the list to local state if publishing failed
      myLists.value.splice(listIndex, 0, listBackup)
      
      error.value = getUserFriendlyError(err)
      console.error('Follow pack deletion error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Follow all members from a list (merges with existing follows)
  const followEntirePack = async (list) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!list.members || list.members.length === 0) {
      throw new Error('Pack has no members to follow')
    }

    // Sanity bound: reject absurdly large packs
    if (list.members.length > 1000) {
      throw new Error(`Pack has ${list.members.length} members which exceeds the 1000 member safety limit`)
    }

    isLoading.value = true
    error.value = ''

    try {
      // Fetch current contact list and merge
      const { mergedFollows, currentFollows, existingContent } = await _mergeWithCurrentFollows(
        currentUser.value.pubkey, list.members
      )

      const stats = { actuallyNew: mergedFollows.length - currentFollows.length }

      if (stats.actuallyNew === 0) {
        return {
          success: true,
          newFollows: 0,
          totalFollows: mergedFollows.length,
          alreadyFollowingAll: true,
          message: `You're already following all ${list.members.length} members of "${list.title}"`,
          updatedFollows: mergedFollows
        }
      }

      // Publish via shared helper
      await publishContactList(mergedFollows, { existingContent })

      const newFollows = mergedFollows.filter(pk => !currentFollows.includes(pk))
      profileService.batch(newFollows)

      return {
        success: true,
        newFollows: newFollows.length,
        totalFollows: mergedFollows.length,
        updatedFollows: mergedFollows,
        addedMembers: newFollows,
        alreadyFollowingAll: false,
        message: `Successfully followed ${newFollows.length} new people from "${list.title}"`
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('Follow pack error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Follow selected members from a list
  const followSelectedMembers = async (list, selectedPubkeys) => {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Nostr authentication required')
    }

    if (!Array.isArray(selectedPubkeys) || selectedPubkeys.length === 0) {
      throw new Error('No members selected')
    }

    // Sanity bound: reject absurdly large selections
    if (selectedPubkeys.length > 1000) {
      throw new Error(`Selection has ${selectedPubkeys.length} members which exceeds the 1000 member safety limit`)
    }

    isLoading.value = true
    error.value = ''

    try {
      // Fetch current contact list and merge
      const { mergedFollows, currentFollows, existingContent } = await _mergeWithCurrentFollows(
        currentUser.value.pubkey, selectedPubkeys
      )

      const stats = { actuallyNew: mergedFollows.length - currentFollows.length }

      if (stats.actuallyNew === 0) {
        return {
          success: true,
          newFollows: 0,
          totalFollows: mergedFollows.length,
          alreadyFollowingAll: true,
          message: `You're already following all ${selectedPubkeys.length} selected members`,
          updatedFollows: mergedFollows
        }
      }

      // Publish via shared helper
      await publishContactList(mergedFollows, { existingContent })

      const newFollows = mergedFollows.filter(pk => !currentFollows.includes(pk))
      profileService.batch(newFollows)

      return {
        success: true,
        newFollows: newFollows.length,
        totalFollows: mergedFollows.length,
        updatedFollows: mergedFollows,
        addedMembers: newFollows,
        alreadyFollowingAll: false,
        message: `Successfully followed ${newFollows.length} new people from "${list.title}"`
      }

    } catch (err) {
      error.value = getUserFriendlyError(err)
      console.error('Follow selected members error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Get list by ID
  const getListById = (listId) => {
    return myLists.value.find(l => l.id === listId) || 
           discoveredLists.value.find(l => l.id === listId)
  }

  // Cached follow set — refreshed once, reused for all isFollowingMember checks
  let _cachedFollowSet = null
  let _cachedFollowTimestamp = 0
  const FOLLOW_CACHE_TTL = 30000 // 30 seconds

  // Check if user is following a list member (uses cache to avoid relay spam)
  const isFollowingMember = async (pubkey) => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return false
    }

    const now = Date.now()
    if (!_cachedFollowSet || now - _cachedFollowTimestamp > FOLLOW_CACHE_TTL) {
      try {
        const currentFollowingEvent = await fetchCurrentContactList(currentUser.value.pubkey)

        if (currentFollowingEvent) {
          _cachedFollowSet = new Set(getFollowedPubkeys(currentFollowingEvent))
        } else {
          _cachedFollowSet = new Set()
        }
        _cachedFollowTimestamp = now
      } catch (err) {
        console.warn('Failed to fetch following list:', err)
        return false
      }
    }

    return _cachedFollowSet.has(pubkey)
  }

  // Filter lists by search query
  const filterLists = (lists, searchQuery) => {
    if (!searchQuery) return lists
    
    const query = searchQuery.toLowerCase()
    return lists.filter(list => 
      list.title.toLowerCase().includes(query) ||
      list.description.toLowerCase().includes(query)
    )
  }

  // Watch for data changes and save to storage (debounced to avoid localStorage thrashing)
  let _listsSaveTimer = null
  const debouncedSaveToStorage = () => {
    if (_listsSaveTimer) clearTimeout(_listsSaveTimer)
    _listsSaveTimer = setTimeout(saveToStorage, 2000)
  }
  watch(() => myLists.value.length + discoveredLists.value.length, debouncedSaveToStorage)

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      // Load cached data first for instant UI display
      loadFromStorage()
      // Then fetch fresh data from relays
      setTimeout(() => {
        fetchMyLists().catch(err => console.warn('[useFollowLists] Fetch lists failed:', err.message))
        discoverLists().catch(err => console.warn('[useFollowLists] Discover lists failed:', err.message))
      }, 1000)
    } else {
      // NOTE: We intentionally DO NOT clear cached data on logout
      // This allows the data to be restored immediately on re-login
      // The data will be refreshed from relays after authentication
      // Only close active subscriptions
      if (myListsSubscription) {
        myListsSubscription.close()
        myListsSubscription = null
      }
      if (discoveredListsSubscription) {
        discoveredListsSubscription.close()
        discoveredListsSubscription = null
      }
      processedEventIds.clear()
      _cachedFollowSet = null
      _cachedFollowTimestamp = 0
    }
  }, { immediate: true })

  return {
    // State
    myLists,
    discoveredLists,
    isLoading,
    error,
    syncStatus,
    
    // Computed
    myListsCount,
    discoveredListsCount,
    
    // Actions
    fetchMyLists,
    discoverLists,
    createFollowPack,
    updateFollowPack,
    deleteFollowPack,
    followEntirePack,
    followSelectedMembers,
    
    // Utilities
    getProfile,
    getListById,
    isFollowingMember,
    filterLists,
    fetchProfile: (pubkey) => profileService.get(pubkey),
    generateAvatar,
    
    // Constants
    FOLLOW_LIST_KIND
  }
}