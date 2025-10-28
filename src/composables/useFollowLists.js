import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from './useNostrAuth.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { fetchProfile, batchFetchProfiles, profileCache } from '../utils/profileFetcher.js'
import { generateAvatar } from '../utils/avatarGenerator.js'

// Global state for follow lists
const myLists = ref([]) // Lists created by current user
const discoveredLists = ref([]) // Lists discovered from network
const isLoading = ref(false)
const error = ref('')
const syncStatus = ref('idle') // idle, syncing, error

// Subscriptions tracking
let myListsSubscription = null
let discoveredListsSubscription = null
let profileSubscriptions = new Map()
const processedEventIds = new Set()

// Profile cache for list members (re-export local reference to shared cache)
// const profileCache = new Map() // replaced by shared profileCache imported
const profileFetchPromises = new Map()

// Storage keys
const MY_LISTS_STORAGE_KEY = 'follow_lists_my'
const DISCOVERED_LISTS_STORAGE_KEY = 'follow_lists_discovered'
const PROFILES_STORAGE_KEY = 'follow_lists_profiles'

// NIP-39089 Follow List Kind
const FOLLOW_LIST_KIND = 39089


// Load data from localStorage
const loadFromStorage = () => {
  try {
    const storedMyLists = localStorage.getItem(MY_LISTS_STORAGE_KEY)
    if (storedMyLists) {
      const parsed = JSON.parse(storedMyLists)
      // ensure members arrays exist
      myLists.value = parsed.map(list => ({ ...list, members: (list.members || []) }))
    }
    
    const storedDiscovered = localStorage.getItem(DISCOVERED_LISTS_STORAGE_KEY)
    if (storedDiscovered) {
      const parsed = JSON.parse(storedDiscovered)
      discoveredLists.value = parsed.map(list => ({ ...list, members: (list.members || []) }))
    }
    
    const storedProfiles = localStorage.getItem(PROFILES_STORAGE_KEY)
    if (storedProfiles) {
      const profileData = JSON.parse(storedProfiles)
      Object.entries(profileData).forEach(([pubkey, profile]) => {
        profileCache.set(pubkey, { profile, timestamp: Date.now() })
      })
    }
    
    console.log('Loaded follow lists from storage:', {
      myLists: myLists.value.length,
      discovered: discoveredLists.value.length,
      profiles: profileCache.size
    })
  } catch (error) {
    console.error('Failed to load follow lists from storage:', error)
  }
}

// Save data to localStorage
const saveToStorage = () => {
  try {
    localStorage.setItem(MY_LISTS_STORAGE_KEY, JSON.stringify(myLists.value))
    localStorage.setItem(DISCOVERED_LISTS_STORAGE_KEY, JSON.stringify(discoveredLists.value))
    
    // Convert profiles Map to object for storage
    const profilesObj = {}
    profileCache.forEach((data, pubkey) => {
      profilesObj[pubkey] = data.profile
    })
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profilesObj))
  } catch (error) {
    console.error('Failed to save follow lists to storage:', error)
  }
}

// Process follow list event according to NIP-39089
const processFollowListEvent = (event) => {
  try {
    const titleTag = event.tags.find(tag => tag[0] === 'title')
    const dTag = event.tags.find(tag => tag[0] === 'd')
    const descriptionTag = event.tags.find(tag => tag[0] === 'description')
    const imageTag = event.tags.find(tag => tag[0] === 'image')
    
    // Extract members from 'p' tags (raw pubkeys)
    const members = event.tags
      .filter(tag => tag[0] === 'p' && tag[1])
      .map(tag => tag[1])

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
    batchFetchProfiles(members) // Removed individual fetchProfile for batch efficiency

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
  // collect all member pubkeys from cached lists
  const memberPubkeys = new Set()
  myLists.value.forEach(list => (list.members || []).forEach(pk => pk && memberPubkeys.add(pk)))
  discoveredLists.value.forEach(list => (list.members || []).forEach(pk => pk && memberPubkeys.add(pk)))
  const pubkeys = Array.from(memberPubkeys)
  if (pubkeys.length === 0) return

  // wait for relay manager init with timeout
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
    // batch fetch profiles in background
    batchFetchProfiles(pubkeys)
  } catch (err) {
    console.warn('Background batchFetchProfiles failed:', err)
  }
}

// Kick off background refresh without blocking import
setTimeout(() => { _startBackgroundRefresh().catch(err => console.warn('Background refresh error:', err)) }, 0)

export function useFollowLists() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  // Computed properties
  const myListsCount = computed(() => myLists.value.length)
  const discoveredListsCount = computed(() => discoveredLists.value.length)

  const getProfile = (pubkey) => {
    const cached = profileCache.get(pubkey)
    return cached ? cached.profile : null
  }

  // Fetch user's own follow lists
  const fetchMyLists = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot fetch my lists')
      return
    }

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
      console.log('Fetching my follow lists...')

      // Close existing subscription
      if (myListsSubscription) {
        myListsSubscription.close()
      }

      myListsSubscription = nostrRelayManager.subscribeToEvents([
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
            console.log('⚠️ Follow list event already processed, skipping:', event.id.substring(0, 16) + '...')
          processedEventIds.add(event.id)

          if (event.kind === FOLLOW_LIST_KIND) {
            const list = processFollowListEvent(event)
            if (list) {
              // Check if we already have this list (by d tag for replaceability)
              const existingIndex = myLists.value.findIndex(l => l.d === list.d)
              
              if (existingIndex !== -1) {
                // Update existing list (newer created_at wins)
                if (event.created_at > myLists.value[existingIndex].created_at) {
                  console.log('Updating existing list via subscription:', list.title)
                  myLists.value[existingIndex] = list
                }
              } else {
                // Add new list
                console.log('Adding new list via subscription:', list.title)
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
              if (index !== -1) {
                console.log('Removing deleted list:', myLists.value[index].title)
                myLists.value.splice(index, 1)
              }
            })
          }

          syncStatus.value = 'idle'
        },
        oneose: () => {
          console.log('End of stored my lists events')
          isLoading.value = false
          if (syncStatus.value === 'syncing') {
            syncStatus.value = 'idle'
          }
        },
        onclose: (reason) => {
          console.log('My lists subscription closed:', reason)
          isLoading.value = false
          myListsSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to fetch my lists:', err)
      error.value = 'Failed to fetch my lists: ' + err.message
      syncStatus.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  // Discover public follow lists from the network
  const discoverLists = async (searchQuery = '', limit = 50) => {
    if (!nostrRelayManager.isInitialized) {
      console.log('Relay manager not initialized, cannot discover lists')
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Discovering public follow lists...')

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
      discoveredListsSubscription = nostrRelayManager.subscribeToEvents(filters, {
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
              // Add new list
              discoveredLists.value.push(list)
              console.log('Discovered new list:', list.title, 'by', list.creator.substring(0, 8))
            }
          }
        },
        oneose: () => {
          console.log('End of discovered lists events')
          isLoading.value = false
        },
        onclose: (reason) => {
          console.log('Discovered lists subscription closed:', reason)
          isLoading.value = false
          discoveredListsSubscription = null
        }
      })

    } catch (err) {
      console.error('Failed to discover lists:', err)
      error.value = 'Failed to discover lists: ' + err.message
    } finally {
      isLoading.value = false
    }
  }

  // Create a new follow list according to NIP-39089
  const createFollowPack = async (listData) => {
    if (!isAuthenticated.value || !window.nostr) {
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
      console.log('Creating new follow pack:', listData.title)

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

      console.log('Signing follow list event...')
      
      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      console.log('Publishing follow list to relays...')

      // Mark this event as processed BEFORE publishing to prevent duplicate processing
      processedEventIds.add(signedEvent.id)
      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Follow list created successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

      // Process and add to local state manually (since we marked it as processed)
      const newList = processFollowListEvent(signedEvent)
      if (newList) {
        // Check if we already have this list (by event ID or d tag)
        const existingIndex = myLists.value.findIndex(l => l.id === newList.id || l.d === newList.d)
        
        if (existingIndex === -1) {
          console.log('Adding new pack to local state:', newList.title)
        myLists.value.push(newList)
        } else {
          console.log('Pack already exists in local state, updating:', newList.title)
          myLists.value[existingIndex] = newList
        }
      }

      return newList

    } catch (err) {
      error.value = 'Failed to create follow pack: ' + err.message
      console.error('❌ Follow pack creation error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Update an existing follow list (creates new version due to replaceability)
  const updateFollowPack = async (listId, listData) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    const existingList = myLists.value.find(l => l.id === listId)
    if (!existingList) {
      throw new Error('Pack not found')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Updating follow pack:', listData.title)

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

      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      // Mark this event as processed BEFORE publishing to prevent duplicate processing
      processedEventIds.add(signedEvent.id)
      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Follow list updated successfully:', {
        eventId: signedEvent.id,
        successfulRelays: result.successful,
        failedRelays: result.failed
      })

      // Process and update local state manually (since we marked it as processed)
      const updatedList = processFollowListEvent(signedEvent)
      if (updatedList) {
        const index = myLists.value.findIndex(l => l.id === listId)
        if (index !== -1) {
          console.log('Updating pack in local state:', updatedList.title)
          myLists.value[index] = updatedList
        } else {
          // If not found by old ID, try to find by d tag
          const dIndex = myLists.value.findIndex(l => l.d === updatedList.d)
          if (dIndex !== -1) {
            console.log('Updating pack by d tag in local state:', updatedList.title)
            myLists.value[dIndex] = updatedList
          } else {
            console.log('Adding updated pack as new to local state:', updatedList.title)
            myLists.value.push(updatedList)
          }
        }
      }

      return updatedList

    } catch (err) {
      error.value = 'Failed to update follow pack: ' + err.message
      console.error('❌ Follow pack update error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Delete a follow list (publish kind 5 deletion event)
  const deleteFollowPack = async (listId) => {
    if (!isAuthenticated.value || !window.nostr) {
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
      console.log('Deleting follow pack:', list.title)

      // Create deletion event
      const eventTemplate = {
        kind: 5, // Deletion
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', listId]], // Reference to the event being deleted
        content: 'Deleting follow pack'
      }

      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Follow pack deletion published successfully')


      return true

    } catch (err) {
      // Rollback: re-add the list to local state if publishing failed
      myLists.value.splice(listIndex, 0, listBackup)
      
      error.value = 'Failed to delete follow pack: ' + err.message
      console.error('❌ Follow pack deletion error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Follow all members from a list (merges with existing follows)
  const followEntirePack = async (list) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!list.members || list.members.length === 0) {
      throw new Error('Pack has no members to follow')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Following entire pack:', list.title, 'with', list.members.length, 'members')

      // Get current following list from Nostr to ensure we have the latest data
      console.log('Fetching current following list before bulk follow...')
      const currentFollowingEvent = await nostrRelayManager.getEvent({
        kinds: [3], // Contact lists
        authors: [currentUser.value.pubkey],
        limit: 1
      })

      // Extract current follows
      let currentFollows = []
      if (currentFollowingEvent) {
        currentFollows = currentFollowingEvent.tags
          .filter(tag => tag[0] === 'p' && tag[1])
          .map(tag => tag[1])
        console.log('Current follows from Nostr:', currentFollows.length)
      } else {
        console.log('No existing following list found, starting fresh')
      }

      // CRITICAL: Merge with new follows using Set to avoid duplicates
      const normalizedMembers = list.members || []
      const newFollows = normalizedMembers.filter(pubkey => !currentFollows.includes(pubkey))
      const mergedFollows = [...new Set([...currentFollows, ...newFollows])]
      
      console.log('Follow merge analysis:', {
        existingFollows: currentFollows.length,
        packMembers: list.members.length,
        newFollows: newFollows.length,
        mergedTotal: mergedFollows.length,
        duplicatesAvoided: (currentFollows.length + newFollows.length) - mergedFollows.length
      })

      if (newFollows.length === 0) {
        console.log('Already following all members of this pack')
        return { 
          success: true,
          newFollows: 0, 
          totalFollows: mergedFollows.length,
          alreadyFollowingAll: true,
          message: `You're already following all ${list.members.length} members of "${list.title}"`,
          updatedFollows: mergedFollows
        }
      }

      // Create new contact list event with merged follows
      const contactTags = mergedFollows.map(pubkey => ['p', pubkey])
      
      const eventTemplate = {
        kind: 3, // Contact list
        created_at: Math.floor(Date.now() / 1000),
        tags: contactTags,
        content: `Updated via ZapTracker - followed pack: ${list.title}` // Add context
      }

      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Successfully followed entire list:', {
        listTitle: list.title,
        newFollows: newFollows.length,
        totalFollows: mergedFollows.length,
        successfulRelays: result.successful
      })

      // Fetch profiles for new follows in batch for efficiency
      batchFetchProfiles(newFollows)

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
      error.value = 'Failed to follow pack: ' + err.message
      console.error('❌ Follow pack error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // Follow selected members from a list
  const followSelectedMembers = async (list, selectedPubkeys) => {
    if (!isAuthenticated.value || !window.nostr) {
      throw new Error('Nostr authentication required')
    }

    if (!Array.isArray(selectedPubkeys) || selectedPubkeys.length === 0) {
      throw new Error('No members selected')
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('Following selected members from list:', list.title, 'selected:', selectedPubkeys.length)

      // Get current following list from Nostr to ensure we have the latest data
      console.log('Fetching current following list before selective follow...')
      const currentFollowingEvent = await nostrRelayManager.getEvent({
        kinds: [3], // Contact lists
        authors: [currentUser.value.pubkey],
        limit: 1
      })

      // Extract current follows
      let currentFollows = []
      if (currentFollowingEvent) {
        currentFollows = currentFollows = currentFollowingEvent.tags
          .filter(tag => tag[0] === 'p' && tag[1])
          .map(tag => tag[1])
        console.log('Current follows from Nostr:', currentFollows.length)
      } else {
        console.log('No existing following list found, starting fresh')
      }

      // CRITICAL: Merge with selected follows using Set to avoid duplicates
      const normalizedSelected = selectedPubkeys || []
      const newFollows = normalizedSelected.filter(pubkey => !currentFollows.includes(pubkey))
      const mergedFollows = [...new Set([...currentFollows, ...newFollows])]
      
      console.log('Selective follow merge analysis:', {
        existingFollows: currentFollows.length,
        selectedMembers: selectedPubkeys.length,
        newFollows: newFollows.length,
        mergedTotal: mergedFollows.length,
        duplicatesAvoided: (currentFollows.length + newFollows.length) - mergedFollows.length
      })

      if (newFollows.length === 0) {
        console.log('Already following all selected members')
        return { 
          success: true,
          newFollows: 0, 
          totalFollows: mergedFollows.length,
          alreadyFollowingAll: true,
          message: `You're already following all ${selectedPubkeys.length} selected members`,
          updatedFollows: mergedFollows
        }
      }

      // Create new contact list event with merged follows
      const contactTags = mergedFollows.map(pubkey => ['p', pubkey])
      
      const eventTemplate = {
        kind: 3, // Contact list
        created_at: Math.floor(Date.now() / 1000),
        tags: contactTags,
        content: `Updated via ZapTracker - followed ${newFollows.length} selected from: ${list.title}`
      }

      // Sign the event
      const signedEvent = await window.nostr.signEvent(eventTemplate)
      
      // Verify the signed event
      const isValid = verifyEvent(signedEvent)
      if (!isValid) {
        throw new Error('Event signature verification failed')
      }

      // Publish to relays
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish to any relays')
      }

      console.log('✅ Successfully followed selected members:', {
        listTitle: list.title,
        newFollows: newFollows.length,
        totalFollows: mergedFollows.length,
        successfulRelays: result.successful
      })

      // Fetch profiles for new follows in batch for efficiency
      batchFetchProfiles(newFollows)

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
      error.value = 'Failed to follow selected members: ' + err.message
      console.error('❌ Follow selected members error:', err)
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

  // Check if user is following a list member
  const isFollowingMember = async (pubkey) => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return false
    }

    try {
      const currentFollowingEvent = await nostrRelayManager.getEvent({
        kinds: [3],
        authors: [currentUser.value.pubkey],
        limit: 1
      })

      if (currentFollowingEvent) {
        const currentFollows = currentFollowingEvent.tags
          .filter(tag => tag[0] === 'p' && tag[1])
          .map(tag => tag[1])
        
        return currentFollows.includes(pubkey)
      }

      return false
    } catch (error) {
      console.warn('Failed to check following status:', error)
      return false
    }
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

  // Watch for data changes and save to storage
  watch([myLists, discoveredLists], saveToStorage, { deep: true })

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      // Load cached data first for instant UI display
      loadFromStorage()
      // Then fetch fresh data from relays
      setTimeout(() => {
        fetchMyLists()
        discoverLists()
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
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    if (myListsSubscription) myListsSubscription.close()
    if (discoveredListsSubscription) discoveredListsSubscription.close()
    profileSubscriptions.forEach(sub => sub.close())
  })

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
    fetchProfile,
    generateAvatar,
    
    // Constants
    FOLLOW_LIST_KIND
  }
}