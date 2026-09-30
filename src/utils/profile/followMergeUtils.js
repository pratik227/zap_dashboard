// Utility functions for safely merging follow lists
// Ensures data integrity and prevents duplicates during follow operations

/**
 * Safely merge new follows with existing follows
 * @param {Array} existingFollows - Current follow list (pubkeys)
 * @param {Array} newFollows - New pubkeys to follow
 * @returns {Object} Merge result with statistics
 */
export const mergeFollowLists = (existingFollows = [], newFollows = []) => {
  // Validate inputs
  if (!Array.isArray(existingFollows)) {
    console.warn('existingFollows is not an array, treating as empty')
    existingFollows = []
  }
  
  if (!Array.isArray(newFollows)) {
    console.warn('newFollows is not an array, treating as empty')
    newFollows = []
  }
  
  // Filter out invalid pubkeys (must be 64-character hex strings)
  const validExisting = existingFollows.filter(pubkey => 
    typeof pubkey === 'string' && /^[a-f0-9]{64}$/i.test(pubkey)
  )
  
  const validNew = newFollows.filter(pubkey => 
    typeof pubkey === 'string' && /^[a-f0-9]{64}$/i.test(pubkey)
  )
  
  // Use Set to automatically handle duplicates
  const mergedSet = new Set([...validExisting, ...validNew])
  const mergedFollows = Array.from(mergedSet)
  
  // Calculate statistics
  const stats = {
    existingCount: validExisting.length,
    newCount: validNew.length,
    mergedCount: mergedFollows.length,
    actuallyNew: mergedFollows.length - validExisting.length,
    duplicatesAvoided: (validExisting.length + validNew.length) - mergedFollows.length,
    invalidFiltered: (existingFollows.length - validExisting.length) + (newFollows.length - validNew.length)
  }
  
  // merge completed
  
  return {
    mergedFollows,
    stats,
    hasNewFollows: stats.actuallyNew > 0,
    isValid: mergedFollows.length > 0
  }
}

/**
 * Validate a follow list for integrity
 * @param {Array} followList - Array of pubkeys to validate
 * @returns {Object} Validation result
 */
export const validateFollowList = (followList) => {
  if (!Array.isArray(followList)) {
    return {
      isValid: false,
      error: 'Follow list must be an array',
      validCount: 0,
      invalidCount: 0
    }
  }
  
  const validPubkeys = []
  const invalidPubkeys = []
  
  followList.forEach(pubkey => {
    if (typeof pubkey === 'string' && /^[a-f0-9]{64}$/i.test(pubkey)) {
      validPubkeys.push(pubkey)
    } else {
      invalidPubkeys.push(pubkey)
    }
  })
  
  return {
    isValid: invalidPubkeys.length === 0,
    validPubkeys,
    invalidPubkeys,
    validCount: validPubkeys.length,
    invalidCount: invalidPubkeys.length,
    error: invalidPubkeys.length > 0 ? `${invalidPubkeys.length} invalid pubkeys found` : null
  }
}

/**
 * Create a contact list event with proper structure
 * @param {Array} followList - Array of pubkeys
 * @param {string} content - Optional content for the event
 * @returns {Object} Event template ready for signing
 */
export const createContactListEvent = (followList, content = '') => {
  const validation = validateFollowList(followList)
  
  if (!validation.isValid) {
    throw new Error(`Invalid follow list: ${validation.error}`)
  }
  
  const contactTags = validation.validPubkeys.map(pubkey => ['p', pubkey])
  
  return {
    kind: 3, // Contact list
    created_at: Math.floor(Date.now() / 1000),
    tags: contactTags,
    content: content || ''
  }
}

/**
 * Safely extract follows from a contact list event
 * @param {Object} contactEvent - Nostr contact list event (kind 3)
 * @returns {Array} Array of valid pubkeys
 */
export const extractFollowsFromEvent = (contactEvent) => {
  if (!contactEvent || contactEvent.kind !== 3) {
    console.warn('Invalid contact event provided')
    return []
  }
  
  if (!Array.isArray(contactEvent.tags)) {
    console.warn('Contact event has no tags array')
    return []
  }
  
  const follows = contactEvent.tags
    .filter(tag => Array.isArray(tag) && tag[0] === 'p' && tag[1])
    .map(tag => tag[1])
    .filter(pubkey => typeof pubkey === 'string' && /^[a-f0-9]{64}$/i.test(pubkey))
  
  // Remove duplicates
  return [...new Set(follows)]
}

/**
 * Generate user-friendly follow operation messages
 * @param {Object} result - Result from follow operation
 * @returns {Object} Formatted messages for user feedback
 */
export const generateFollowMessages = (result) => {
  if (!result || !result.success) {
    return {
      title: 'Follow Failed',
      message: 'Unable to complete follow operation',
      type: 'error'
    }
  }
  
  if (result.alreadyFollowingAll) {
    return {
      title: 'Already Following',
      message: result.message || 'You\'re already following all selected users',
      type: 'info'
    }
  }
  
  if (result.newFollows === 0) {
    return {
      title: 'No New Follows',
      message: 'No new people were added to your follow list',
      type: 'info'
    }
  }
  
  const newCount = result.newFollows
  const totalCount = result.totalFollows
  
  return {
    title: 'Follow Successful',
    message: `Successfully followed ${newCount} new ${newCount === 1 ? 'person' : 'people'}! You're now following ${totalCount.toLocaleString()} ${totalCount === 1 ? 'person' : 'people'} total.`,
    type: 'success'
  }
}

/**
 * Batch follow operation with progress tracking
 * @param {Array} pubkeysToFollow - Array of pubkeys to follow
 * @param {Function} followFunction - Function to call for each follow
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Object} Batch operation result
 */
export const batchFollowOperation = async (pubkeysToFollow, followFunction, progressCallback = null) => {
  const results = {
    successful: [],
    failed: [],
    alreadyFollowing: [],
    total: pubkeysToFollow.length
  }
  
  for (let i = 0; i < pubkeysToFollow.length; i++) {
    const pubkey = pubkeysToFollow[i]
    
    try {
      const result = await followFunction(pubkey)
      
      if (result && result.alreadyFollowing) {
        results.alreadyFollowing.push(pubkey)
      } else {
        results.successful.push(pubkey)
      }
      
      // Call progress callback if provided
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: pubkeysToFollow.length,
          percentage: Math.round(((i + 1) / pubkeysToFollow.length) * 100)
        })
      }
      
    } catch (error) {
      console.error(`Failed to follow ${pubkey.substring(0, 8)}:`, error)
      results.failed.push({ pubkey, error: error.message })
    }
  }
  
  return results
}