<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  IconUserPlus,
  IconUsers,
  IconLoader,
  IconAlertCircle,
  IconRefresh,
  IconCheck,
  IconStar,
  IconBolt,
  IconShield,
  IconExternalLink,
  IconSearch,
  IconX,
  IconSparkles,
  IconTarget,
  IconHeart
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useAudience } from '../composables/useAudience.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import * as nip19 from 'nostr-tools/nip19'
import { generateAvatar } from '../utils/avatarGenerator.js'

const emit = defineEmits(['follow-user', 'profile-click'])

const { currentUser, isAuthenticated } = useNostrAuth()
const { following, getProfile, fetchProfile, isFollowing } = useAudience()

// State
const suggestions = ref([])
const isLoading = ref(false)
const error = ref('')
const followingInProgress = ref(new Set())

// Computed properties
const filteredSuggestions = computed(() => {
  return suggestions.value.slice(0, 12) // Limit to 12 suggestions for clean UI
})

const hasFollowing = computed(() => following.value.length > 0)

// Generate smart suggestions based on friends of friends
const generateSuggestions = async () => {
  if (!isAuthenticated.value || !currentUser.value?.pubkey) {
    console.log('Not authenticated, cannot generate suggestions')
    return
  }

  if (following.value.length === 0) {
    console.log('No following list available for suggestions')
    error.value = 'Follow some people first to get personalized suggestions'
    return
  }

  isLoading.value = true
  error.value = ''
  suggestions.value = []

  try {
    console.log('🔍 Generating smart suggestions based on friends of friends...')
    
    const mutualConnections = new Map() // pubkey -> { count, connectedThrough }
    const followedPubkeys = new Set([...following.value, currentUser.value.pubkey]) // Include self

    // Fetch contact lists of people we follow (limit to first 10 for performance)
    const contactPromises = following.value.slice(0, 10).map(async (pubkey) => {
      try {
        console.log(`Fetching contact list for: ${pubkey.substring(0, 8)}...`)
        
        const contactEvent = await nostrRelayManager.getEvent({
          kinds: [3], // Contact lists
          authors: [pubkey],
          limit: 1
        })

        if (contactEvent) {
          const theirFollows = contactEvent.tags
            .filter(tag => tag[0] === 'p' && tag[1])
            .map(tag => tag[1])

          console.log(`Found ${theirFollows.length} follows for ${pubkey.substring(0, 8)}...`)

          // Count mutual connections
          theirFollows.forEach(theirFollowPubkey => {
            if (!followedPubkeys.has(theirFollowPubkey)) {
              const current = mutualConnections.get(theirFollowPubkey) || { count: 0, connectedThrough: [] }
              current.count += 1
              current.connectedThrough.push(pubkey)
              mutualConnections.set(theirFollowPubkey, current)
            }
          })
        }
      } catch (error) {
        console.warn(`Failed to fetch contact list for ${pubkey.substring(0, 8)}:`, error)
      }
    })

    await Promise.allSettled(contactPromises)

    console.log(`Found ${mutualConnections.size} potential suggestions`)

    // Sort by mutual connection count and take top suggestions
    const topSuggestions = Array.from(mutualConnections.entries())
      .filter(([, data]) => data.count >= 2) // At least 2 mutual connections
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 20) // Get top 20 for profile fetching
      .map(([pubkey, data]) => ({
        pubkey,
        mutualCount: data.count,
        connectedThrough: data.connectedThrough,
        profile: null,
        score: data.count // Simple scoring based on mutual connections
      }))

    console.log(`Processing ${topSuggestions.length} top suggestions...`)

    // Fetch profiles for suggestions
    const profilePromises = topSuggestions.map(async (suggestion) => {
      try {
        const profile = await fetchProfile(suggestion.pubkey)
        suggestion.profile = profile
        return suggestion
      } catch (error) {
        console.warn(`Failed to fetch profile for suggestion ${suggestion.pubkey.substring(0, 8)}:`, error)
        return null
      }
    })

    const suggestionsWithProfiles = await Promise.allSettled(profilePromises)
    const validSuggestions = suggestionsWithProfiles
      .filter(result => result.status === 'fulfilled' && result.value && result.value.profile)
      .map(result => result.value)

    // Sort by score and profile completeness
    validSuggestions.sort((a, b) => {
      // Prioritize users with more complete profiles
      const scoreA = a.score + (a.profile?.about ? 1 : 0) + (a.profile?.nip05 ? 1 : 0) + (a.profile?.lud16 ? 1 : 0)
      const scoreB = b.score + (b.profile?.about ? 1 : 0) + (b.profile?.nip05 ? 1 : 0) + (b.profile?.lud16 ? 1 : 0)
      return scoreB - scoreA
    })

    suggestions.value = validSuggestions
    console.log(`✅ Generated ${suggestions.value.length} smart suggestions`)

  } catch (err) {
    console.error('Failed to generate suggestions:', err)
    error.value = 'Failed to generate suggestions. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Handle follow user with proper merging
const handleFollowUser = async (pubkey) => {
  if (followingInProgress.value.has(pubkey)) return
  
  followingInProgress.value.add(pubkey)
  
  try {
    const result = await emit('follow-user', pubkey)
    
    // Remove from suggestions after successful follow
    suggestions.value = suggestions.value.filter(s => s.pubkey !== pubkey)
    
    // Show success feedback
    if (result && !result.alreadyFollowing) {
      console.log('Successfully followed user, total follows:', result.totalFollows)
    }
    
  } catch (error) {
    console.error('Failed to follow user:', error)
  } finally {
    followingInProgress.value.delete(pubkey)
  }
}

// Handle profile click
const handleProfileClick = (pubkey) => {
  emit('profile-click', pubkey)
}


// Get mutual connection names for display
const getMutualConnectionNames = (suggestion) => {
  if (!suggestion.connectedThrough || suggestion.connectedThrough.length === 0) {
    return 'Suggested for you'
  }
  
  const names = suggestion.connectedThrough
    .slice(0, 2) // Show max 2 names
    .map(pubkey => {
      const profile = getProfile(pubkey)
      return profile?.name || `user:${pubkey.substring(0, 8)}`
    })
  
  if (suggestion.connectedThrough.length > 2) {
    return `Followed by ${names.join(', ')} and ${suggestion.connectedThrough.length - 2} others`
  } else if (names.length === 2) {
    return `Followed by ${names.join(' and ')}`
  } else {
    return `Followed by ${names[0]}`
  }
}

// Initialize suggestions when component mounts
onMounted(() => {
  if (isAuthenticated.value && hasFollowing.value) {
    generateSuggestions()
  }
})

// Watch for changes in following list to regenerate suggestions
watch(following, (newFollowing) => {
  if (isAuthenticated.value && newFollowing.length > 0) {
    // Regenerate suggestions when following list changes
    setTimeout(() => {
      generateSuggestions()
    }, 2000)
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-gray-900 flex items-center space-x-2">
          <IconSparkles class="w-5 h-5 text-orange-600" />
          <span>Suggested for You</span>
        </h2>
        <p class="text-gray-600 text-sm">
          Discover people through your network connections
        </p>
      </div>
      
      <button
        @click="generateSuggestions"
        :disabled="isLoading || !hasFollowing"
        class="btn-secondary"
      >
        <IconRefresh :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
        <span>Refresh</span>
      </button>
    </div>

    <!-- No Following State -->
    <div v-if="!hasFollowing" class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 text-center">
      <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <IconUsers class="w-8 h-8 text-blue-600" />
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-3">Start Building Your Network</h3>
      <p class="text-gray-600 mb-6 max-w-md mx-auto">
        Follow some people first, and we'll suggest friends of friends to help you discover more interesting accounts.
      </p>
      <button
        @click="$emit('switch-tab', 'lists')"
        class="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105"
      >
        <IconTarget class="w-5 h-5" />
        <span>Discover Follow Packs</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-else-if="isLoading && suggestions.length === 0" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-8 text-center">
      <div class="inline-block p-3 bg-orange-100 rounded-full mb-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Finding Suggestions...</h3>
      <p class="text-gray-600">Analyzing your network to find interesting people</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-6">
      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconAlertCircle class="w-4 h-4 text-red-600" />
        </div>
        <div>
          <h4 class="font-medium text-red-900 mb-1">Unable to Generate Suggestions</h4>
          <p class="text-red-700 text-sm">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Empty Suggestions State -->
    <div v-else-if="filteredSuggestions.length === 0 && !isLoading" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-8 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <IconSearch class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        {{ searchQuery ? 'No matching suggestions' : 'No suggestions available' }}
      </h3>
      <p class="text-gray-600 mb-4">
        Follow more people to get better suggestions
      </p>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <button 
          @click="generateSuggestions" 
          class="btn-primary"
        >
          <IconRefresh class="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>

    <!-- Suggestions Grid -->
    <div v-else class="space-y-6">
      <!-- Stats Header -->
      <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <IconSparkles class="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h3 class="font-medium text-orange-900">Smart Suggestions</h3>
              <p class="text-sm text-orange-700">Based on {{ following.length }} people you follow</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold text-orange-600">{{ filteredSuggestions.length }}</div>
            <div class="text-xs text-orange-700">suggestions</div>
          </div>
        </div>
      </div>

      <!-- Suggestions Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="suggestion in filteredSuggestions"
          :key="suggestion.pubkey"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all duration-200 p-5 group"
        >
          <!-- Profile Header -->
          <div class="flex items-start space-x-4 mb-4">
            <!-- Avatar -->
            <div 
              class="relative cursor-pointer"
              @click="handleProfileClick(suggestion.pubkey)"
            >
              <div class="w-14 h-14 rounded-xl overflow-hidden border-2 border-orange-200 group-hover:border-orange-300 transition-colors">
                <img
                  :src="suggestion.profile?.picture || generateAvatar(suggestion.pubkey)"
                  :alt="suggestion.profile?.name || 'User'"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(suggestion.pubkey)"
                />
              </div>
              <!-- Mutual connection indicator -->
              <div class="absolute -top-1 -right-1 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center shadow-sm">
                <span class="text-xs font-bold text-white">{{ suggestion.mutualCount }}</span>
              </div>
            </div>
            
            <!-- Profile Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-1">
                <h3 
                  class="font-semibold text-gray-900 truncate cursor-pointer hover:text-orange-600 transition-colors"
                  @click="handleProfileClick(suggestion.pubkey)"
                >
                  {{ suggestion.profile?.name || `user:${suggestion.pubkey.substring(0, 8)}` }}
                </h3>
                
                <!-- Verification Badges -->
                <div class="flex items-center space-x-1">
                  <IconShield v-if="suggestion.profile?.nip05" class="w-4 h-4 text-blue-600" title="NIP-05 Verified" />
                  <IconBolt v-if="suggestion.profile?.lud16" class="w-4 h-4 text-yellow-500" title="Lightning Address" />
                </div>
              </div>
              
              <!-- About -->
              <p v-if="suggestion.profile?.about" class="text-sm text-gray-600 line-clamp-2 mb-2">
                {{ suggestion.profile.about }}
              </p>
              
              <!-- Mutual Connection Info -->
              <p class="text-xs text-orange-600 font-medium">
                {{ getMutualConnectionNames(suggestion) }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between pt-3 border-t border-gray-100">
            <!-- Follow Button -->
            <button
              @click="handleFollowUser(suggestion.pubkey)"
              :disabled="followingInProgress.has(suggestion.pubkey) || isFollowing(suggestion.pubkey)"
              class="btn-primary flex-1 mr-3 disabled:opacity-50"
            >
              <IconLoader v-if="followingInProgress.has(suggestion.pubkey)" class="w-4 h-4 animate-spin" />
              <IconCheck v-else-if="isFollowing(suggestion.pubkey)" class="w-4 h-4" />
              <IconUserPlus v-else class="w-4 h-4" />
              <span>
                {{ followingInProgress.has(suggestion.pubkey) ? 'Following...' :
                   isFollowing(suggestion.pubkey) ? 'Following' : 'Follow' }}
              </span>
            </button>
            
            <!-- View Profile -->
            <button
              @click="handleProfileClick(suggestion.pubkey)"
              class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title="View profile"
            >
              <IconExternalLink class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Smooth hover effects */
.group:hover .group-hover\:border-orange-300 {
  border-color: rgb(253 186 116);
}

/* Loading animation */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Button transitions */
button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* Focus states for accessibility */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .grid-cols-1 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
  
  button {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>