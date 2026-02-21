import { ref, computed } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import * as nip19 from 'nostr-tools/nip19'
import { queryProfile, isNip05 } from 'nostr-tools/nip05'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'

// Cache for user search results
const searchCache = new Map() // key: query, value: { results, timestamp }
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Cache for contact list
let contactListCache = null
let contactListTimestamp = 0
const CONTACT_LIST_TTL = 10 * 60 * 1000 // 10 minutes

export function useMentions() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  
  const isSearching = ref(false)
  const searchResults = ref([])
  const contactList = ref([])
  
  // Debounce timer
  let debounceTimer = null
  
  /**
   * Fetch user's contact list (NIP-02) for better suggestions
   */
  const fetchContactList = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      return []
    }
    
    // Return cached contact list if still valid
    const now = Date.now()
    if (contactListCache && (now - contactListTimestamp) < CONTACT_LIST_TTL) {
      contactList.value = contactListCache
      return contactListCache
    }
    
    try {
      
      const contactEvent = await nostrRelayManager.getEvent({
        kinds: [3], // Contact list (NIP-02)
        authors: [currentUser.value.pubkey],
        limit: 1
      })
      
      if (!contactEvent) {
        return []
      }
      
      // Extract pubkeys and petnames from p tags
      const contacts = contactEvent.tags
        .filter(tag => tag[0] === 'p' && tag[1])
        .map(tag => ({
          pubkey: tag[1],
          relay: tag[2] || '',
          petname: tag[3] || '',
          isContact: true
        }))
      
      
      // Fetch profiles for contacts
      const contactsWithProfiles = await Promise.all(
        contacts.slice(0, 50).map(async (contact) => { // Limit to 50 for performance
          try {
            const profile = await fetchUserProfile(contact.pubkey)
            return {
              ...contact,
              ...profile
            }
          } catch (err) {
            return contact
          }
        })
      )
      
      // Cache the results
      contactListCache = contactsWithProfiles
      contactListTimestamp = now
      contactList.value = contactsWithProfiles
      
      return contactsWithProfiles
    } catch (error) {
      console.error('Failed to fetch contact list:', error)
      return []
    }
  }
  
  /**
   * Fetch a single user profile using shared profileFetcher
   */
  const fetchUserProfile = async (pubkey) => {
    try {
      const profile = await fetchProfile(pubkey)
      if (!profile) return { pubkey }
      return {
        pubkey,
        name: profile.name || '',
        displayName: profile.display_name || profile.name || '',
        nip05: profile.nip05 || '',
        picture: profile.picture || '',
        about: profile.about || ''
      }
    } catch (error) {
      console.warn('Failed to fetch profile for', pubkey.substring(0, 8), error)
      return { pubkey }
    }
  }
  
  /**
   * Search for users using NIP-50 (if supported) or fallback to profile search
   */
  const searchUsers = async (query, options = {}) => {
    if (!query || query.length < 2) {
      searchResults.value = []
      return []
    }
    
    const {
      limit = 10,
      includeContacts = true,
      debounce = 300
    } = options
    
    // Check cache first
    const cacheKey = `${query.toLowerCase()}_${limit}`
    const cached = searchCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      searchResults.value = cached.results
      return cached.results
    }
    
    // Debounce the search — set isSearching immediately to prevent flicker
    if (debounce > 0) {
      isSearching.value = true
      return new Promise((resolve) => {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          const results = await performSearch(query, limit, includeContacts)
          resolve(results)
        }, debounce)
      })
    }
    
    return performSearch(query, limit, includeContacts)
  }
  
  /**
   * Perform the actual search
   */
  const performSearch = async (query, limit, includeContacts) => {
    isSearching.value = true
    
    try {
      const results = []
      const seenPubkeys = new Set()
      
      // 1. Check if query is an npub, hex pubkey, or nip-05
      const directMatch = await checkDirectMatch(query)
      if (directMatch) {
        results.push(directMatch)
        seenPubkeys.add(directMatch.pubkey)
      }
      
      // 2. Search in contact list first (NIP-02) for better UX
      if (includeContacts && contactList.value.length > 0) {
        const contactMatches = contactList.value.filter(contact => {
          if (seenPubkeys.has(contact.pubkey)) return false
          
          const q = query.toLowerCase()
          const matchesName = contact.name?.toLowerCase().includes(q)
          const matchesDisplayName = contact.displayName?.toLowerCase().includes(q)
          const matchesPetname = contact.petname?.toLowerCase().includes(q)
          const matchesNip05 = contact.nip05?.toLowerCase().includes(q)
          
          return matchesName || matchesDisplayName || matchesPetname || matchesNip05
        }).slice(0, 5) // Prioritize top 5 contacts
        
        contactMatches.forEach(contact => {
          results.push(contact)
          seenPubkeys.add(contact.pubkey)
        })
      }
      
      // 3. Try NIP-50 search (if relays support it)
      if (results.length < limit) {
        try {
          const nip50Results = await searchWithNIP50(query, limit - results.length)
          nip50Results.forEach(result => {
            if (!seenPubkeys.has(result.pubkey)) {
              results.push(result)
              seenPubkeys.add(result.pubkey)
            }
          })
        } catch (err) {
          console.warn('NIP-50 search failed, using fallback:', err)
        }
      }
      
      // Cache the results
      searchCache.set(`${query.toLowerCase()}_${limit}`, {
        results,
        timestamp: Date.now()
      })
      
      searchResults.value = results
      return results
      
    } catch (error) {
      console.error('Search failed:', error)
      return []
    } finally {
      isSearching.value = false
    }
  }
  
  /**
   * Check if query is a direct match (npub, hex, nip-05)
   */
  const checkDirectMatch = async (query) => {
    try {
      let pubkey = null
      
      // Try to decode as npub
      if (query.startsWith('npub1')) {
        try {
          const decoded = nip19.decode(query)
          if (decoded.type === 'npub') {
            pubkey = decoded.data
          }
        } catch (err) {
          // Not a valid npub
        }
      }
      
      // Try as hex pubkey (64 characters)
      if (!pubkey && /^[0-9a-f]{64}$/i.test(query)) {
        pubkey = query.toLowerCase()
      }
      
      // NIP-05 resolution via HTTP well-known
      let isNip05Match = false
      if (!pubkey && isNip05(query)) {
        try {
          const result = await Promise.race([
            queryProfile(query),
            new Promise((_, r) => setTimeout(() => r(new Error('NIP-05 timeout')), 5000))
          ])
          if (result?.pubkey) {
            pubkey = result.pubkey
            isNip05Match = true
          }
        } catch { /* timeout or fetch failure — silently continue */ }
      }

      // If we found a pubkey, fetch the profile
      if (pubkey) {
        const profile = await fetchUserProfile(pubkey)
        return {
          ...profile,
          isDirectMatch: true,
          isNip05Match
        }
      }
      
      return null
    } catch (error) {
      console.warn('Direct match check failed:', error)
      return null
    }
  }
  
  /**
   * Search using NIP-50 (if supported by relays)
   */
  const searchWithNIP50 = async (query, limit) => {
    try {
      
      const events = []
      
      // Subscribe with NIP-50 search filter
      const sub = nostrRelayManager.subscribeToEvents([{
        kinds: [0], // Profile metadata
        search: query, // NIP-50 search field
        limit: limit
      }], {
        onevent: (event) => {
          events.push(event)
        },
        oneose: () => {
          sub.close()
        }
      })
      
      // Wait for results with timeout
      await new Promise((resolve) => {
        setTimeout(() => {
          sub.close()
          resolve()
        }, 3000) // 3 second timeout
      })
      
      // Parse profile events
      const profiles = events.map(event => {
        try {
          const metadata = JSON.parse(event.content)
          return {
            pubkey: event.pubkey,
            name: metadata.name || '',
            displayName: metadata.display_name || metadata.name || '',
            nip05: metadata.nip05 || '',
            picture: metadata.picture || '',
            about: metadata.about || '',
            isNIP50Result: true
          }
        } catch (err) {
          return null
        }
      }).filter(Boolean)
      
      return profiles
      
    } catch (error) {
      console.warn('NIP-50 search error:', error)
      return []
    }
  }
  
  /**
   * Parse mentions from text content
   * Returns array of { pubkey, name, startIndex, endIndex }
   */
  const parseMentions = (content) => {
    const mentions = []
    
    // Match nostr: URIs (NIP-21)
    const nostrUriRegex = /nostr:(npub1[a-z0-9]{58,}|nprofile1[a-z0-9]+)/gi
    let match
    
    while ((match = nostrUriRegex.exec(content)) !== null) {
      try {
        const decoded = nip19.decode(match[1])
        if (decoded.type === 'npub') {
          mentions.push({
            pubkey: decoded.data,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            raw: match[0]
          })
        } else if (decoded.type === 'nprofile') {
          mentions.push({
            pubkey: decoded.data.pubkey,
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            raw: match[0]
          })
        }
      } catch (err) {
        // Invalid nostr URI
      }
    }
    
    return mentions
  }
  
  /**
   * Insert mention into text at cursor position
   * Returns { newContent, newCursorPosition }
   */
  const insertMention = (content, cursorPosition, user) => {
    // Find the @ symbol before cursor
    const beforeCursor = content.substring(0, cursorPosition)
    const lastAtIndex = beforeCursor.lastIndexOf('@')
    
    if (lastAtIndex === -1) {
      return { newContent: content, newCursorPosition: cursorPosition }
    }
    
    // Generate nostr URI (NIP-21)
    const npub = nip19.npubEncode(user.pubkey)
    const displayName = user.displayName || user.name || npub.substring(0, 16) + '...'
    const mention = `nostr:${npub}`
    
    // Replace from @ to cursor with mention
    const before = content.substring(0, lastAtIndex)
    const after = content.substring(cursorPosition)
    const newContent = before + mention + ' ' + after
    const newCursorPosition = (before + mention + ' ').length
    
    return { newContent, newCursorPosition }
  }
  
  /**
   * Extract p tags from content for NIP-10
   */
  const extractPTags = (content) => {
    const mentions = parseMentions(content)
    const pTags = []
    const seenPubkeys = new Set()
    
    mentions.forEach(mention => {
      if (!seenPubkeys.has(mention.pubkey)) {
        pTags.push(['p', mention.pubkey])
        seenPubkeys.add(mention.pubkey)
      }
    })
    
    return pTags
  }
  
  /**
   * Format display name for user
   */
  const formatDisplayName = (user) => {
    if (user.displayName) return user.displayName
    if (user.name) return user.name
    if (user.nip05) return user.nip05.split('@')[0]
    if (user.petname) return user.petname
    return user.pubkey.substring(0, 8) + '...'
  }
  
  /**
   * Clear search cache (useful for testing or manual refresh)
   */
  const clearCache = () => {
    searchCache.clear()
    contactListCache = null
    contactListTimestamp = 0
  }
  
  return {
    // State
    isSearching,
    searchResults,
    contactList,
    
    // Methods
    searchUsers,
    fetchContactList,
    fetchUserProfile,
    parseMentions,
    insertMention,
    extractPTags,
    formatDisplayName,
    clearCache
  }
}
