import { ref, computed } from 'vue'
import * as nip19 from 'nostr-tools/nip19'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

export function useNostrContent() {
  // Regular expressions for different content types
  const NOSTR_URI_REGEX = /nostr:(npub|nprofile|note|nevent|naddr|nsec)[a-zA-Z0-9]+/g
  const IMAGE_REGEX = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico|heic|heif)(\?[^\s]*)?/gi
  const VIDEO_REGEX = /https?:\/\/[^\s]+\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|m4v)(\?[^\s]*)?/gi
  const AUDIO_REGEX = /https?:\/\/[^\s]+\.(mp3|wav|ogg|aac|flac|m4a|wma)(\?[^\s]*)?/gi
  const URL_REGEX = /https?:\/\/[^\s]+/gi

  /**
   * Parse Nostr URI and extract information
   * @param {string} uri - The nostr: URI to parse
   * @returns {Object|null} Parsed URI information or null if invalid
   */
  const parseNostrUri = (uri) => {
    try {
      // Remove 'nostr:' prefix
      const identifier = uri.replace('nostr:', '')
      
      // Determine the type
      const type = identifier.substring(0, identifier.indexOf('1'))
      
      let decoded
      switch (type) {
        case 'npub':
          decoded = nip19.decode(identifier)
          return {
            type: 'profile',
            identifier,
            pubkey: decoded.data,
            displayType: 'Profile'
          }
          
        case 'nprofile':
          decoded = nip19.decode(identifier)
          return {
            type: 'profile',
            identifier,
            pubkey: decoded.data.pubkey,
            relays: decoded.data.relays,
            displayType: 'Profile'
          }
          
        case 'note':
          decoded = nip19.decode(identifier)
          return {
            type: 'note',
            identifier,
            eventId: decoded.data,
            displayType: 'Note'
          }
          
        case 'nevent':
          decoded = nip19.decode(identifier)
          return {
            type: 'event',
            identifier,
            eventId: decoded.data.id,
            relays: decoded.data.relays,
            author: decoded.data.author,
            kind: decoded.data.kind,
            displayType: 'Event'
          }
          
        case 'naddr':
          decoded = nip19.decode(identifier)
          // identifier,
          return {
            type: 'address',
            kind: decoded.data.kind,
            pubkey: decoded.data.pubkey,
            identifier: decoded.data.identifier,
            relays: decoded.data.relays,
            displayType: 'Address'
          }
          
        default:
          return null
      }
    } catch (error) {
      console.error('Failed to parse Nostr URI:', uri, error)
      return null
    }
  }

  /**
   * Extract all Nostr URIs from text content
   * @param {string} content - Text content to parse
   * @returns {Array} Array of parsed URI objects
   */
  const extractNostrUris = (content) => {
    if (!content) return []
    
    const matches = content.match(NOSTR_URI_REGEX) || []
    return matches.map(parseNostrUri).filter(Boolean)
  }

  /**
   * Extract media URLs from content
   * @param {string} content - Text content to parse
   * @returns {Object} Object containing arrays of different media types
   */
  const extractMediaUrls = (content) => {
    if (!content) return { images: [], videos: [], audio: [] }
    
    return {
      images: content.match(IMAGE_REGEX) || [],
      videos: content.match(VIDEO_REGEX) || [],
      audio: content.match(AUDIO_REGEX) || []
    }
  }

  /**
   * Check if URL is a media URL
   * @param {string} url - URL to check
   * @returns {Object} Object with media type and boolean
   */
  const getMediaType = (url) => {
    if (IMAGE_REGEX.test(url)) return { type: 'image', isMedia: true }
    if (VIDEO_REGEX.test(url)) return { type: 'video', isMedia: true }
    if (AUDIO_REGEX.test(url)) return { type: 'audio', isMedia: true }
    return { type: 'url', isMedia: false }
  }

  /**
   * Parse content and return structured data for rendering
   * @param {string} content - Text content to parse
   * @returns {Object} Structured content data
   */
  const parseContent = (content) => {
    if (!content) return { segments: [], nostrUris: [], media: { images: [], videos: [], audio: [] } }
    
    const nostrUris = extractNostrUris(content)
    const media = extractMediaUrls(content)
    
    // Split content into segments for rendering
    let remainingContent = content
    const segments = []
    
    // Replace Nostr URIs with placeholders and create segments
    const allMatches = []
    
    // Find all Nostr URIs
    let match
    const nostrRegex = new RegExp(NOSTR_URI_REGEX.source, 'g')
    while ((match = nostrRegex.exec(content)) !== null) {
      allMatches.push({
        type: 'nostr',
        match: match[0],
        index: match.index,
        data: parseNostrUri(match[0])
      })
    }
    
    // Find all media URLs
    const mediaRegex = new RegExp(`(${IMAGE_REGEX.source})|(${VIDEO_REGEX.source})|(${AUDIO_REGEX.source})`, 'gi')
    while ((match = mediaRegex.exec(content)) !== null) {
      const url = match[0]
      const mediaType = getMediaType(url)
      allMatches.push({
        type: 'media',
        match: url,
        index: match.index,
        data: { url, ...mediaType }
      })
    }
    
    // Sort matches by index
    allMatches.sort((a, b) => a.index - b.index)
    
    // Create segments
    let lastIndex = 0
    allMatches.forEach(match => {
      // Add text before this match
      if (match.index > lastIndex) {
        const textSegment = content.substring(lastIndex, match.index)
        if (textSegment.trim()) {
          segments.push({
            type: 'text',
            content: textSegment
          })
        }
      }
      
      // Add the match segment
      segments.push({
        type: match.type,
        content: match.match,
        data: match.data
      })
      
      lastIndex = match.index + match.match.length
    })
    
    // Add remaining text
    if (lastIndex < content.length) {
      const textSegment = content.substring(lastIndex)
      if (textSegment.trim()) {
        segments.push({
          type: 'text',
          content: textSegment
        })
      }
    }
    
    // If no matches found, return the entire content as text
    if (segments.length === 0) {
      segments.push({
        type: 'text',
        content: content
      })
    }
    
    return {
      segments,
      nostrUris,
      media
    }
  }

  /**
   * Generate a client URL for a Nostr entity
   * @param {string} client - Client name ('primal', 'yakihonne', etc.)
   * @param {Object} nostrData - Parsed Nostr URI data
   * @returns {string} Client URL
   */
  const getClientUrl = (client, nostrData) => {
    if (!nostrData) return '#'
    
    try {
      switch (client) {
        case 'primal':
          if (nostrData.type === 'profile') {
            return `https://primal.net/p/${nip19.npubEncode(nostrData.pubkey)}`
          } else if (nostrData.type === 'note' || nostrData.type === 'event') {
            return `https://primal.net/e/${nostrData.eventId}`
          }
          break
          
        case 'yakihonne':
          if (nostrData.type === 'profile') {
            return `https://yakihonne.com/p/${nip19.npubEncode(nostrData.pubkey)}`
          } else if (nostrData.type === 'note' || nostrData.type === 'event') {
            return `https://yakihonne.com/e/${nip19.neventEncode({ id: nostrData.eventId })}`
          }
          break
          
        case 'highlighter':
          if (nostrData.type === 'profile') {
            return `https://highlighter.com/p/${nip19.npubEncode(nostrData.pubkey)}`
          } else if (nostrData.type === 'note' || nostrData.type === 'event') {
            return `https://highlighter.com/a/${nip19.noteEncode(nostrData.eventId)}`
          }
          break
          
        default:
          return '#'
      }
    } catch (error) {
      console.error('Failed to generate client URL:', error)
      return '#'
    }
    
    return '#'
  }

  /**
   * Format pubkey for display
   * @param {string} pubkey - Public key to format
   * @returns {string} Formatted pubkey
   */
  const formatPubkey = (pubkey) => {
    if (!pubkey) return 'Unknown'
    return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
  }

  // generateAvatar is imported from avatarGenerator.js

  return {
    parseNostrUri,
    extractNostrUris,
    extractMediaUrls,
    getMediaType,
    parseContent,
    getClientUrl,
    formatPubkey,
    generateAvatar,
    // Regex patterns for external use
    NOSTR_URI_REGEX,
    IMAGE_REGEX,
    VIDEO_REGEX,
    AUDIO_REGEX,
    URL_REGEX
  }
}
