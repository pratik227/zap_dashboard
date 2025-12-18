import { ref, reactive, computed, triggerRef } from 'vue'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'

// Global badge cache
const badgeDefinitions = ref(new Map()) // Map<badgeId, badgeDefinition>
const badgeAwards = ref(new Map()) // Map<pubkey, Array<badgeAward>>
const profileBadges = ref(new Map()) // Map<pubkey, Array<profileBadge>>
const isLoading = ref(false)
const error = ref('')

// Reactivity trigger counter - increment to force computed properties to re-evaluate
const badgeUpdateTrigger = ref(0)

// Badge event kinds from NIP-58
const BADGE_DEFINITION_KIND = 30009
const BADGE_AWARD_KIND = 8
const PROFILE_BADGES_KIND = 30008

/**
 * Parse badge definition event (kind 30009)
 */
const parseBadgeDefinition = (event) => {
  const badge = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    d: null,
    name: null,
    description: null,
    image: null,
    imageSize: null,
    thumbnails: []
  }

  // Parse tags
  event.tags.forEach(tag => {
    switch (tag[0]) {
      case 'd':
        badge.d = tag[1]
        break
      case 'name':
        badge.name = tag[1]
        break
      case 'description':
        badge.description = tag[1]
        break
      case 'image':
        badge.image = tag[1]
        if (tag[2]) {
          badge.imageSize = tag[2]
        }
        break
      case 'thumb':
        if (tag[1]) {
          badge.thumbnails.push({
            url: tag[1],
            size: tag[2] || null
          })
        }
        break
    }
  })

  return badge
}

/**
 * Parse badge award event (kind 8)
 */
const parseBadgeAward = (event) => {
  const award = {
    id: event.id,
    pubkey: event.pubkey, // issuer
    created_at: event.created_at,
    badgeDefinition: null,
    awardedTo: []
  }

  // Parse tags
  event.tags.forEach(tag => {
    switch (tag[0]) {
      case 'a':
        award.badgeDefinition = tag[1] // format: "30009:pubkey:d"
        break
      case 'p':
        if (tag[1]) {
          award.awardedTo.push({
            pubkey: tag[1],
            relay: tag[2] || null
          })
        }
        break
    }
  })

  return award
}

/**
 * Parse profile badges event (kind 30008)
 */
const parseProfileBadges = (event) => {
  const profileBadge = {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    badges: []
  }

  // Parse consecutive pairs of 'a' and 'e' tags
  const tags = event.tags
  for (let i = 0; i < tags.length - 1; i++) {
    const currentTag = tags[i]
    const nextTag = tags[i + 1]

    if (currentTag[0] === 'a' && nextTag[0] === 'e') {
      profileBadge.badges.push({
        badgeDefinition: currentTag[1], // "30009:pubkey:d"
        badgeAward: nextTag[1], // badge award event id
        relay: nextTag[2] || null
      })
      i++ // Skip the next tag since we processed it
    }
  }

  return profileBadge
}

/**
 * Fetch badge definitions for given badge references
 */
const fetchBadgeDefinitions = async (badgeRefs) => {
  if (!badgeRefs || badgeRefs.length === 0) return

  const uniqueRefs = [...new Set(badgeRefs)]
  const missingRefs = uniqueRefs.filter(ref => !badgeDefinitions.value.has(ref))

  if (missingRefs.length === 0) return

  try {
    isLoading.value = true
    error.value = ''

    // Parse badge references to get pubkeys and d tags
    const filters = missingRefs.map(ref => {
      const parts = ref.split(':')
      if (parts.length === 3 && parts[0] === '30009') {
        return {
          kinds: [BADGE_DEFINITION_KIND],
          authors: [parts[1]],
          '#d': [parts[2]]
        }
      }
      return null
    }).filter(Boolean)

    if (filters.length === 0) return

    // Subscribe to badge definition events
    const sub = nostrRelayManager.subscribeToEvents(filters, {
      onevent: (event) => {
        try {
          const badge = parseBadgeDefinition(event)
          if (badge.d) {
            const badgeRef = `30009:${event.pubkey}:${badge.d}`
            badgeDefinitions.value.set(badgeRef, badge)
            // Trigger reactivity update
            badgeUpdateTrigger.value++
          }
        } catch (err) {
          console.error('Error parsing badge definition:', err)
        }
      },
      oneose: () => {
        console.log('Badge definitions fetch completed')
      },
      onclose: (reasons) => {
        console.log('Badge definitions subscription closed:', reasons)
      }
    })

    // Auto-close subscription after 10 seconds
    setTimeout(() => {
      if (sub && sub.close) {
        sub.close()
      }
    }, 10000)

  } catch (err) {
    console.error('Error fetching badge definitions:', err)
    error.value = 'Failed to fetch badge definitions'
  } finally {
    isLoading.value = false
  }
}

/**
 * Fetch badge awards for a specific badge definition
 */
const fetchBadgeAwards = async (badgeRef) => {
  if (!badgeRef) return

  try {
    const filter = {
      kinds: [BADGE_AWARD_KIND],
      '#a': [badgeRef]
    }

    const sub = nostrRelayManager.subscribeToEvents([filter], {
      onevent: (event) => {
        try {
          const award = parseBadgeAward(event)
          
          // Store awards for each awarded pubkey
          award.awardedTo.forEach(({ pubkey }) => {
            if (!badgeAwards.value.has(pubkey)) {
              badgeAwards.value.set(pubkey, [])
            }
            
            // Check if this award already exists
            const existingAwards = badgeAwards.value.get(pubkey)
            const exists = existingAwards.some(a => a.id === award.id)
            
            if (!exists) {
              existingAwards.push(award)
              // Trigger reactivity update
              badgeUpdateTrigger.value++
            }
          })
        } catch (err) {
          console.error('Error parsing badge award:', err)
        }
      },
      oneose: () => {
        console.log('Badge awards fetch completed')
      },
      onclose: (reasons) => {
        console.log('Badge awards subscription closed:', reasons)
      }
    })

    // Auto-close subscription after 10 seconds
    setTimeout(() => {
      if (sub && sub.close) {
        sub.close()
      }
    }, 10000)

  } catch (err) {
    console.error('Error fetching badge awards:', err)
  }
}

/**
 * Fetch profile badges for a specific pubkey
 */
const fetchProfileBadges = async (pubkey) => {
  if (!pubkey) return

  try {
    isLoading.value = true
    error.value = ''

    const filter = {
      kinds: [PROFILE_BADGES_KIND],
      authors: [pubkey],
      '#d': ['profile_badges']
    }

    const sub = nostrRelayManager.subscribeToEvents([filter], {
      onevent: (event) => {
        try {
          const profileBadge = parseProfileBadges(event)
          profileBadges.value.set(pubkey, profileBadge.badges)
          // Trigger reactivity update
          badgeUpdateTrigger.value++

          // Fetch badge definitions for all referenced badges
          const badgeRefs = profileBadge.badges.map(b => b.badgeDefinition)
          if (badgeRefs.length > 0) {
            fetchBadgeDefinitions(badgeRefs)
          }
        } catch (err) {
          console.error('Error parsing profile badges:', err)
        }
      },
      oneose: () => {
        console.log('Profile badges fetch completed')
      },
      onclose: (reasons) => {
        console.log('Profile badges subscription closed:', reasons)
      }
    })

    // Auto-close subscription after 10 seconds
    setTimeout(() => {
      if (sub && sub.close) {
        sub.close()
      }
    }, 10000)

  } catch (err) {
    console.error('Error fetching profile badges:', err)
    error.value = 'Failed to fetch profile badges'
  } finally {
    isLoading.value = false
  }
}

/**
 * Get badges for a specific user
 * Returns a new array to ensure Vue reactivity
 */
const getUserBadges = (pubkey) => {
  if (!pubkey) return []

  // Access the trigger to make this function reactive to badge updates
  badgeUpdateTrigger.value // eslint-disable-line no-unused-expressions

  const userProfileBadges = profileBadges.value.get(pubkey) || []
  
  // Create a new array to ensure Vue reactivity triggers
  return [...userProfileBadges].map(profileBadge => {
    const definition = badgeDefinitions.value.get(profileBadge.badgeDefinition)
    return {
      ...profileBadge,
      definition,
      isLoaded: !!definition
    }
  }).filter(badge => badge.isLoaded)
}

/**
 * Get the best thumbnail for a badge based on desired size
 */
const getBadgeThumbnail = (badge, preferredSize = 'medium') => {
  if (!badge || !badge.definition) return null

  const definition = badge.definition
  
  // If no thumbnails, use main image
  if (!definition.thumbnails || definition.thumbnails.length === 0) {
    return definition.image
  }

  // Size preferences
  const sizePreferences = {
    small: ['32x32', '16x16', '64x64', '256x256'],
    medium: ['64x64', '32x32', '256x256', '512x512'],
    large: ['256x256', '512x512', '64x64', '1024x1024']
  }

  const preferences = sizePreferences[preferredSize] || sizePreferences.medium

  // Try to find thumbnail matching preferred sizes
  for (const prefSize of preferences) {
    const thumbnail = definition.thumbnails.find(t => t.size === prefSize)
    if (thumbnail) {
      return thumbnail.url
    }
  }

  // Fallback to first thumbnail or main image
  return definition.thumbnails[0]?.url || definition.image
}

/**
 * Check if a user has a specific badge
 */
const userHasBadge = (pubkey, badgeRef) => {
  if (!pubkey || !badgeRef) return false
  
  const userBadges = getUserBadges(pubkey)
  return userBadges.some(badge => badge.badgeDefinition === badgeRef)
}

/**
 * Get badge count for a user
 */
const getUserBadgeCount = (pubkey) => {
  if (!pubkey) return 0
  return getUserBadges(pubkey).length
}

/**
 * Clear badge cache
 */
const clearBadgeCache = () => {
  badgeDefinitions.value.clear()
  badgeAwards.value.clear()
  profileBadges.value.clear()
  error.value = ''
}

/**
 * Initialize badges for a user (fetch their profile badges)
 */
const initUserBadges = async (pubkey) => {
  if (!pubkey) return
  
  // Check if we already have this user's badges
  if (profileBadges.value.has(pubkey)) {
    return getUserBadges(pubkey)
  }

  await fetchProfileBadges(pubkey)
  return getUserBadges(pubkey)
}

// Computed properties
const totalBadgeDefinitions = computed(() => badgeDefinitions.value.size)
const totalProfileBadges = computed(() => profileBadges.value.size)

export function useBadges() {
  return {
    // State
    badgeDefinitions: computed(() => badgeDefinitions.value),
    badgeAwards: computed(() => badgeAwards.value),
    profileBadges: computed(() => profileBadges.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    badgeUpdateTrigger: computed(() => badgeUpdateTrigger.value),
    
    // Computed
    totalBadgeDefinitions,
    totalProfileBadges,
    
    // Actions
    fetchBadgeDefinitions,
    fetchBadgeAwards,
    fetchProfileBadges,
    initUserBadges,
    getUserBadges,
    getBadgeThumbnail,
    userHasBadge,
    getUserBadgeCount,
    clearBadgeCache,
    
    // Parsers (exposed for testing)
    parseBadgeDefinition,
    parseBadgeAward,
    parseProfileBadges
  }
}
