<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  IconUserPlus,
  IconUsers,
  IconLoader,
  IconAlertCircle,
  IconRefresh,
  IconCheck,
  IconBolt,
  IconShield,
  IconSearch,
  IconSparkles,
  IconTarget,
  IconX
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useAudience } from '../../composables/audience/useAudience.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const emit = defineEmits(['profile-click', 'switch-tab'])

const { currentUser, isAuthenticated } = useNostrAuth()
const { following, getProfile, fetchProfile, isFollowing, followUser } = useAudience()

// State
const suggestions = ref([])
const isLoading = ref(false)
const error = ref('')
const followingInProgress = ref(new Set())
const recentlyFollowed = ref(new Set())

// Inline status banner
const statusMessage = ref(null) // { type: 'success'|'error', text: '' }
let statusTimer = null

const showStatus = (type, text, duration = 4000) => {
  clearTimeout(statusTimer)
  statusMessage.value = { type, text }
  statusTimer = setTimeout(() => { statusMessage.value = null }, duration)
}

// Computed properties
const filteredSuggestions = computed(() => {
  return suggestions.value
    .filter(s => !isFollowing(s.pubkey) || recentlyFollowed.value.has(s.pubkey))
    .slice(0, 12)
})

const hasFollowing = computed(() => following.value.length > 0)

// Generate smart suggestions based on friends of friends
const generateSuggestions = async () => {
  if (!isAuthenticated.value || !currentUser.value?.pubkey) return

  if (following.value.length === 0) {
    error.value = 'Follow some people first to get personalized suggestions'
    return
  }

  isLoading.value = true
  error.value = ''
  suggestions.value = []

  try {
    const mutualConnections = new Map()
    const followedPubkeys = new Set([...following.value, currentUser.value.pubkey])

    const sampleSize = Math.min(5, following.value.length)
    const contactPromises = following.value.slice(0, sampleSize).map(async (pubkey) => {
      try {
        const contactEvent = await nostrService.queryOne({
          kinds: [3],
          authors: [pubkey],
          limit: 1
        })

        if (contactEvent) {
          const theirFollows = contactEvent.tags
            .filter(tag => tag[0] === 'p' && tag[1])
            .map(tag => tag[1])

          theirFollows.forEach(theirFollowPubkey => {
            if (!followedPubkeys.has(theirFollowPubkey)) {
              const current = mutualConnections.get(theirFollowPubkey) || { count: 0, connectedThrough: [] }
              current.count += 1
              current.connectedThrough.push(pubkey)
              mutualConnections.set(theirFollowPubkey, current)
            }
          })
        }
      } catch (err) {
        console.warn(`Failed to fetch contact list for ${pubkey.substring(0, 8)}:`, err)
      }
    })

    await Promise.allSettled(contactPromises)

    const topSuggestions = Array.from(mutualConnections.entries())
      .filter(([, data]) => data.count >= 1)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 15)
      .map(([pubkey, data]) => ({
        pubkey,
        mutualCount: data.count,
        connectedThrough: data.connectedThrough,
        profile: null,
        score: data.count
      }))

    const profilePromises = topSuggestions.map(async (suggestion) => {
      try {
        suggestion.profile = await fetchProfile(suggestion.pubkey)
        return suggestion
      } catch (err) {
        console.warn(`Failed to fetch profile for ${suggestion.pubkey.substring(0, 8)}:`, err)
        return null
      }
    })

    const results = await Promise.allSettled(profilePromises)
    const validSuggestions = results
      .filter(r => r.status === 'fulfilled' && r.value?.profile)
      .map(r => r.value)

    validSuggestions.sort((a, b) => {
      const scoreA = a.score + (a.profile?.about ? 1 : 0) + (a.profile?.nip05 ? 1 : 0) + (a.profile?.lud16 ? 1 : 0)
      const scoreB = b.score + (b.profile?.about ? 1 : 0) + (b.profile?.nip05 ? 1 : 0) + (b.profile?.lud16 ? 1 : 0)
      return scoreB - scoreA
    })

    suggestions.value = validSuggestions
  } catch (err) {
    console.error('Failed to generate suggestions:', err)
    error.value = 'Failed to generate suggestions. Please try again.'
  } finally {
    isLoading.value = false
  }
}

// Handle follow
const handleFollowUser = async (pubkey) => {
  if (followingInProgress.value.has(pubkey)) return

  followingInProgress.value.add(pubkey)

  try {
    await followUser(pubkey)

    // Get display name for status
    const suggestion = suggestions.value.find(s => s.pubkey === pubkey)
    const displayName = suggestion?.profile?.name || pubkey.substring(0, 8)
    showStatus('success', `Now following ${displayName}`)

    // Keep card visible briefly with "followed" state, then let it slide out
    recentlyFollowed.value.add(pubkey)
    setTimeout(() => {
      recentlyFollowed.value.delete(pubkey)
    }, 1500)
  } catch (err) {
    console.error('Failed to follow user:', err)
    showStatus('error', 'Failed to follow user. Please try again.')
  } finally {
    followingInProgress.value.delete(pubkey)
  }
}

const handleProfileClick = (pubkey) => {
  emit('profile-click', pubkey)
}

const getMutualConnectionNames = (suggestion) => {
  if (!suggestion.connectedThrough || suggestion.connectedThrough.length === 0) {
    return 'Suggested for you'
  }

  const names = suggestion.connectedThrough
    .slice(0, 2)
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

onMounted(() => {
  if (isAuthenticated.value && hasFollowing.value) {
    generateSuggestions()
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

    <!-- Status Banner -->
    <transition name="status-banner">
      <div
        v-if="statusMessage"
        :class="[
          'rounded-lg px-4 py-3 flex items-center gap-3',
          statusMessage.type === 'success'
            ? 'bg-green-50 border border-green-300 text-green-800'
            : 'bg-red-50 border border-red-300 text-red-800'
        ]"
      >
        <IconCheck v-if="statusMessage.type === 'success'" class="w-5 h-5 flex-shrink-0" />
        <IconAlertCircle v-else class="w-5 h-5 flex-shrink-0" />
        <span class="text-sm font-medium flex-1">{{ statusMessage.text }}</span>
        <button
          @click="statusMessage = null"
          class="p-1 rounded hover:bg-black/5 flex-shrink-0"
        >
          <IconX class="w-4 h-4" />
        </button>
      </div>
    </transition>

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
        @click="emit('switch-tab', 'lists')"
        class="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 mx-auto shadow-lg hover:shadow-xl"
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
      <h3 class="text-lg font-medium text-gray-900 mb-2">No suggestions available</h3>
      <p class="text-gray-600 mb-4">
        Follow more people to get better suggestions
      </p>
      <button @click="generateSuggestions" class="btn-primary">
        <IconRefresh class="w-4 h-4" />
        Try Again
      </button>
    </div>

    <!-- Suggestions Grid -->
    <div v-else class="space-y-4">
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
      <TransitionGroup
        name="suggestion-card"
        tag="div"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <div
          v-for="suggestion in filteredSuggestions"
          :key="suggestion.pubkey"
          :class="[
            'rounded-xl border shadow-sm transition-all duration-300 overflow-hidden',
            recentlyFollowed.has(suggestion.pubkey)
              ? 'bg-green-50 border-green-300'
              : 'bg-white/90 backdrop-blur-sm border-orange-100/50 hover:shadow-md'
          ]"
        >
          <!-- Followed overlay -->
          <div
            v-if="recentlyFollowed.has(suggestion.pubkey)"
            class="p-5 flex flex-col items-center justify-center text-center min-h-[180px]"
          >
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <IconCheck class="w-6 h-6 text-green-600" />
            </div>
            <p class="text-green-800 font-semibold text-base">Followed!</p>
            <p class="text-green-600 text-sm mt-1">
              {{ suggestion.profile?.name || suggestion.pubkey.substring(0, 8) }}
            </p>
          </div>

          <!-- Normal card content -->
          <div v-else class="p-5 group">
            <!-- Profile Header -->
            <div class="flex items-start space-x-3 mb-3">
              <!-- Avatar -->
              <div
                class="relative cursor-pointer flex-shrink-0"
                @click="handleProfileClick(suggestion.pubkey)"
              >
                <div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-orange-200 group-hover:border-orange-300 transition-colors">
                  <img
                    :src="suggestion.profile?.picture || generateAvatar(suggestion.pubkey)"
                    :alt="suggestion.profile?.name || 'User'"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = generateAvatar(suggestion.pubkey)"
                  />
                </div>
                <div class="absolute -top-1 -right-1 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center shadow-sm">
                  <span class="text-[10px] font-bold text-white">{{ suggestion.mutualCount }}</span>
                </div>
              </div>

              <!-- Profile Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-0.5">
                  <h3
                    class="font-semibold text-gray-900 truncate cursor-pointer hover:text-orange-600 transition-colors text-sm"
                    @click="handleProfileClick(suggestion.pubkey)"
                  >
                    {{ suggestion.profile?.name || `user:${suggestion.pubkey.substring(0, 8)}` }}
                  </h3>
                  <IconShield v-if="suggestion.profile?.nip05" class="w-3.5 h-3.5 text-blue-600 flex-shrink-0" title="NIP-05 Verified" />
                  <IconBolt v-if="suggestion.profile?.lud16" class="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" title="Lightning Address" />
                </div>

                <p v-if="suggestion.profile?.about" class="text-xs text-gray-500 line-clamp-2 mb-1.5">
                  {{ suggestion.profile.about }}
                </p>

                <p class="text-xs text-orange-600 font-medium">
                  {{ getMutualConnectionNames(suggestion) }}
                </p>
              </div>
            </div>

            <!-- Follow Button — full width, tall touch target -->
            <button
              @click="handleFollowUser(suggestion.pubkey)"
              :disabled="followingInProgress.has(suggestion.pubkey)"
              class="btn-primary w-full justify-center min-h-[44px]"
            >
              <IconLoader v-if="followingInProgress.has(suggestion.pubkey)" class="w-4 h-4 animate-spin" />
              <IconUserPlus v-else class="w-4 h-4" />
              <span>{{ followingInProgress.has(suggestion.pubkey) ? 'Following...' : 'Follow' }}</span>
            </button>
          </div>
        </div>
      </TransitionGroup>
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

/* Status banner */
.status-banner-enter-active {
  transition: all 0.25s ease-out;
}
.status-banner-leave-active {
  transition: all 0.2s ease-in;
}
.status-banner-enter-from,
.status-banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Card transitions */
.suggestion-card-enter-active {
  transition: all 0.3s ease-out;
}
.suggestion-card-leave-active {
  transition: all 0.4s ease-in;
  position: absolute;
}
.suggestion-card-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.suggestion-card-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.suggestion-card-move {
  transition: transform 0.3s ease;
}

/* Mobile touch targets */
@media (max-width: 640px) {
  button {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
