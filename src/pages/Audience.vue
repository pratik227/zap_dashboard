<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import {
  IconUsers,
  IconUserPlus,
  IconUserCheck,
  IconList,
  IconSearch,
  IconPlus,
  IconRefresh,
  IconLoader,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconEye,
  IconShare,
  IconTrash,
  IconEdit,
  IconCopy,
  IconExternalLink,
  IconShield,
  IconBolt,
  IconChevronDown,
  IconChevronRight,
  IconFilter,
  IconSortAscending,
  IconUserX,
  IconHeart,
  IconStar,
  IconTarget,
  IconGlobe,
  IconWifi,
  IconWifiOff
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useAudience } from '../composables/useAudience.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import * as nip19 from 'nostr-tools/nip19'
import ProfileCard from '../components/ProfileCard.vue'
import ProfileModal from '../components/ProfileModal.vue'
import FollowListModal from '../components/FollowListModal.vue'
import FollowListCard from '../components/FollowListCard.vue'
import AudienceOverview from '../components/AudienceOverview.vue'
import FollowListManager from '../components/FollowListManager.vue'

// Authentication
const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

// Audience functionality
const {
  // State
  following,
  followers,
  myLists,
  profiles,
  isLoading,
  error,
  syncStatus,
  
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
  
  // Getters
  getProfile,
  isFollowing,
  getMutualFollows,
  getFollowersCount,
  getFollowingCount
} = useAudience()

// UI State
const activeTab = ref('overview')
const searchQuery = ref('')
const selectedProfile = ref(null)
const showProfileModal = ref(false)
const showListModal = ref(false)
const selectedList = ref(null)
const showBulkActions = ref(false)
const selectedUsers = ref(new Set())
const filterBy = ref('all') // all, mutuals, new, not-followed-back
const sortBy = ref('recent') // recent, alphabetical, popular
const showRelayStatus = ref(false)

// Tabs configuration
const tabs = [
  {
    id: 'overview', label: 'Overview', icon: IconTarget, count: null },
  { id: 'following', label: 'Following', icon: IconUserCheck, count: computed(() => getFollowingCount()) },
  { id: 'lists', label: 'Follow Packs', icon: IconList, count: computed(() => myLists.value.length) },
  { id: 'suggestions', label: 'Suggestions', icon: IconUserPlus, count: computed(() => suggestedUsers.value.length) }
]

// Computed properties
const suggestedUsers = ref([])
const isLoadingSuggestions = ref(false)
const suggestionsError = ref('')

const filteredFollowing = computed(() => {
  let users = following.value
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    users = users.filter(pubkey => {
      const profile = getProfile(pubkey)
      return profile?.name?.toLowerCase().includes(query) ||
             profile?.about?.toLowerCase().includes(query) ||
             pubkey.toLowerCase().includes(query)
    })
  }
  
  // Apply filters
  switch (filterBy.value) {
    case 'mutuals':
      users = users.filter(pubkey => getMutualFollows(pubkey).length > 0)
      break
    case 'new':
      // Users followed in last 7 days (simplified)
      break
    case 'not-followed-back':
      users = users.filter(pubkey => !followers.value.includes(pubkey))
      break
  }
  
  // Apply sorting
  switch (sortBy.value) {
    case 'alphabetical':
      users.sort((a, b) => {
        const profileA = getProfile(a)
        const profileB = getProfile(b)
        return (profileA?.name || '').localeCompare(profileB?.name || '')
      })
      break
    case 'popular':
      // Sort by how many lists they appear in (simplified)
      break
    default: // recent
      // Keep original order (most recent first)
      break
  }
  
  return users
})

const filteredFollowers = computed(() => {
  let users = followers.value
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    users = users.filter(pubkey => {
      const profile = getProfile(pubkey)
      return profile?.name?.toLowerCase().includes(query) ||
             profile?.about?.toLowerCase().includes(query) ||
             pubkey.toLowerCase().includes(query)
    })
  }
  
  return users
})

const filteredSuggestions = computed(() => {
  let suggestions = suggestedUsers.value
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    suggestions = suggestions.filter(suggestion =>
      suggestion.profile?.name?.toLowerCase().includes(query) ||
      suggestion.profile?.about?.toLowerCase().includes(query) ||
      suggestion.pubkey.toLowerCase().includes(query)
    )
  }
  
  // Limit results if not showing all
  if (!showAllSuggestions.value) {
    suggestions = suggestions.slice(0, 12)
  }
  
  return suggestions
})

const relayStats = computed(() => {
  return nostrRelayManager.getConnectionStats()
})

// Generate smart suggestions based on mutual follows
const generateSmartSuggestions = async () => {
  if (following.value.length === 0) {
    console.log('No following list available for suggestions')
    return
  }

  isLoadingSuggestions.value = true
  suggestionsError.value = ''

  try {
    console.log('Generating smart suggestions based on mutual follows...')
    
    const mutualConnections = new Map() // pubkey -> count
    const followedPubkeys = new Set(following.value)

    // Fetch contact lists of people we follow (limit to first 15 for performance)
    const contactPromises = following.value.slice(0, 15).map(async (pubkey) => {
      try {
        const contactEvent = await nostrRelayManager.getEvent({
          kinds: [3],
          authors: [pubkey],
          limit: 1
        })

        if (contactEvent) {
          const theirFollows = contactEvent.tags
            .filter(tag => tag[0] === 'p' && tag[1])
            .map(tag => tag[1])

          // Count mutual connections
          theirFollows.forEach(theirFollowPubkey => {
            if (!followedPubkeys.has(theirFollowPubkey) && theirFollowPubkey !== currentUser.value.pubkey) {
              mutualConnections.set(theirFollowPubkey, (mutualConnections.get(theirFollowPubkey) || 0) + 1)
            }
          })
        }
      } catch (error) {
        console.warn('Failed to fetch contact list for:', pubkey.substring(0, 8))
      }
    })

    await Promise.allSettled(contactPromises)

    // Sort by mutual connection count and take top suggestions
    const suggestions = Array.from(mutualConnections.entries())
      .filter(([, mutualCount]) => mutualCount >= 2) // At least 2 mutual connections
      .sort(([,a], [,b]) => b - a)
      .slice(0, 12)
      .map(([pubkey, mutualCount]) => ({
        pubkey,
        mutualCount,
        profile: null
      }))

    // Fetch profiles for suggestions
    const profilePromises = suggestions.map(async (suggestion) => {
      try {
        suggestion.profile = await fetchProfile(suggestion.pubkey)
        return suggestion
      } catch (error) {
        console.warn('Failed to fetch profile for suggestion:', suggestion.pubkey.substring(0, 8))
        return null
      }
    })

    const suggestionsWithProfiles = await Promise.allSettled(profilePromises)
    suggestedUsers.value = suggestionsWithProfiles
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .filter(suggestion => suggestion.profile) // Only include suggestions with valid profiles

    console.log('Generated smart suggestions:', suggestedUsers.value.length)
  } catch (error) {
    console.error('Failed to generate smart suggestions:', error)
    suggestionsError.value = 'Failed to generate suggestions'
  } finally {
    isLoadingSuggestions.value = false
  }
}

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Handle profile click
const handleProfileClick = (pubkey) => {
  selectedProfile.value = pubkey
  showProfileModal.value = true
}

// Handle list creation
const handleCreateList = () => {
  selectedList.value = null
  showListModal.value = true
}

// Handle list edit
const handleEditList = (list) => {
  selectedList.value = list
  showListModal.value = true
}

// Handle unfollow with better error handling
const handleUnfollow = async (pubkey) => {
  try {
    const result = await unfollowUser(pubkey)
    
    if (result.localOnly) {
      // Show a warning that the change was local only
      console.warn('Unfollow succeeded locally but may not have synced to all relays')
      // You could show a toast notification here if desired
    }
  } catch (error) {
    console.error('Failed to unfollow user:', error)
    error.value = `Failed to unfollow user: ${error.message}`
  }
}

// Handle bulk follow
const handleBulkFollow = async () => {
  if (selectedUsers.value.size === 0) return
  
  try {
    console.log('Starting bulk follow operation for', selectedUsers.value.size, 'users')
    
    // Get current following list first to ensure we have the latest data
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
    }

    // Filter out users we're already following
    const selectedArray = Array.from(selectedUsers.value)
    const newFollows = selectedArray.filter(pubkey => !currentFollows.includes(pubkey))
    const mergedFollows = [...new Set([...currentFollows, ...newFollows])]
    
    console.log('Bulk follow merge analysis:', {
      existingFollows: currentFollows.length,
      selectedUsers: selectedArray.length,
      newFollows: newFollows.length,
      mergedTotal: mergedFollows.length
    })

    if (newFollows.length === 0) {
      alert(`✅ You're already following all ${selectedArray.length} selected users`)
      selectedUsers.value.clear()
      showBulkActions.value = false
      return
    }

    // Create new contact list event with merged follows
    const contactTags = mergedFollows.map(pubkey => ['p', pubkey])
    
    const eventTemplate = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags: contactTags,
      content: `Updated via ZapTracker - bulk followed ${newFollows.length} users`
    }

    // Sign and publish the event
    const signedEvent = await window.nostr.signEvent(eventTemplate)
    
    if (!verifyEvent(signedEvent)) {
      throw new Error('Event signature verification failed')
    }

    const result = await nostrRelayManager.publishEvent(signedEvent)
    
    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays')
    }

    // Update local state
    following.value = mergedFollows
    
    // Fetch profiles for new follows
    newFollows.forEach(pubkey => {
      fetchProfile(pubkey).catch(error => {
        console.warn(`Failed to fetch profile for ${pubkey.substring(0, 8)}:`, error)
      })
    })

    console.log('✅ Bulk follow completed successfully:', {
      newFollows: newFollows.length,
      totalFollows: mergedFollows.length,
      successfulRelays: result.successful
    })

    // Show success message
    alert(`🎉 Successfully followed ${newFollows.length} new people!\n\nTotal people you're now following: ${mergedFollows.length.toLocaleString()}`)
    
    selectedUsers.value.clear()
    showBulkActions.value = false
  } catch (error) {
    console.error('Bulk follow failed:', error)
    alert(`❌ Bulk follow failed: ${error.message}\n\nYour existing follows remain safe.`)
  }
}

// Handle bulk unfollow
const handleBulkUnfollow = async () => {
  if (selectedUsers.value.size === 0) return
  
  if (!confirm(`Unfollow ${selectedUsers.value.size} users?`)) return
  
  try {
    const promises = Array.from(selectedUsers.value).map(pubkey => unfollowUser(pubkey))
    await Promise.all(promises)
    selectedUsers.value.clear()
    showBulkActions.value = false
  } catch (error) {
    console.error('Bulk unfollow failed:', error)
  }
}

// Toggle user selection
const toggleUserSelection = (pubkey) => {
  if (selectedUsers.value.has(pubkey)) {
    selectedUsers.value.delete(pubkey)
  } else {
    selectedUsers.value.add(pubkey)
  }
  
  showBulkActions.value = selectedUsers.value.size > 0
}

// Clear selection
const clearSelection = () => {
  selectedUsers.value.clear()
  showBulkActions.value = false
}

// Format count for display
const formatCount = (count) => {
  if (!count) return '0'
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return count.toString()
}

// Initialize on mount
onMounted(() => {
  if (isAuthenticated.value) {
    // Start with overview for first-time users
    refreshFollowing()
    
    // Generate suggestions after following list is loaded
    setTimeout(() => {
      generateSmartSuggestions()
    }, 3000)
  }
})

// Watch for authentication changes
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    refreshFollowing()
    
    // Generate suggestions after following list is loaded
    setTimeout(() => {
      generateSmartSuggestions()
    }, 3000)
  } else {
    // Clear data when logged out
    activeTab.value = 'overview'
    searchQuery.value = ''
    suggestedUsers.value = []
    clearSelection()
  }
})

// Watch for changes in following list to regenerate suggestions
watch(following, (newFollowing, oldFollowing) => {
  if (isAuthenticated.value && newFollowing.length !== oldFollowing?.length) {
    // Regenerate suggestions when following list changes
    setTimeout(() => {
      generateSmartSuggestions()
    }, 2000)
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconUsers class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
            <p class="text-purple-100 text-sm">
              Connect your Nostr identity to manage your audience, create follow lists, and discover new people in the network.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
        >
          <IconBolt class="w-4 h-4" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Authenticated Content -->
    <div v-else>
      <!-- Header with Relay Status -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
            <IconUsers class="w-6 h-6 text-orange-600" />
            <span>Audience</span>
          </h1>
          <p class="text-gray-600">
            Manage your Nostr network and create follow lists
          </p>
        </div>

        <!-- Relay Status & Actions -->
        <div class="flex items-center space-x-3">
          <!-- Relay Status Pill -->
          <div class="relative">
            <button
              @click="showRelayStatus = !showRelayStatus"
              :class="[
                'flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                relayStats.connected > 0 
                  ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' 
                  : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
              ]"
            >
              <IconWifi v-if="relayStats.connected > 0" class="w-4 h-4" />
              <IconWifiOff v-else class="w-4 h-4" />
              <span>{{ relayStats.connected }}/{{ relayStats.total }} relays</span>
              <IconChevronDown :class="['w-3 h-3 transition-transform', showRelayStatus ? 'rotate-180' : '']" />
            </button>
            
            <!-- Relay Status Dropdown -->
            <div v-if="showRelayStatus" class="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
              <div class="px-3 py-2 border-b border-gray-100">
                <h4 class="font-medium text-gray-900 text-sm">Relay Status</h4>
              </div>
              <div class="px-3 py-2 space-y-1">
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Connected:</span>
                  <span class="font-medium text-green-600">{{ relayStats.connected }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Write enabled:</span>
                  <span class="font-medium text-blue-600">{{ relayStats.writeEnabled }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-gray-600">Read enabled:</span>
                  <span class="font-medium text-purple-600">{{ relayStats.readEnabled }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sync Button -->
          <!-- Sync Button - Commented out for later proper integration -->
          <!-- <button
            @click="refreshFollowing"
            :disabled="isLoading"
            class="btn-secondary"
          >
            <IconRefresh :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
            <span class="hidden sm:inline">Sync</span>
          </button> -->

        </div>
      </div>

      <!-- Tab Navigation -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <nav class="flex space-x-8 px-6" aria-label="Audience tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id; clearSelection()"
            :class="[
              'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200',
              activeTab === tab.id
                ? 'border-orange-400 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <component :is="tab.icon" class="w-4 h-4" />
            <span>{{ tab.label }}</span>
            <span v-if="tab.count?.value" class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {{ formatCount(tab.count.value) }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>

      <!-- Bulk Actions Bar -->
      <transition name="slide-down">
        <div v-if="showBulkActions" class="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <span class="text-sm font-medium text-orange-800">
                {{ selectedUsers.size }} user{{ selectedUsers.size !== 1 ? 's' : '' }} selected
              </span>
            </div>
            <div class="flex items-center space-x-2">
              <button
                @click="handleBulkFollow"
                class="btn-primary text-sm"
              >
                <IconUserPlus class="w-4 h-4" />
                Follow All
              </button>
              <button
                @click="handleBulkUnfollow"
                class="btn-secondary text-sm text-red-600 hover:text-red-700"
              >
                <IconUserX class="w-4 h-4" />
                Unfollow All
              </button>
              <button
                @click="clearSelection"
                class="btn-secondary text-sm"
              >
                <IconX class="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- Tab Content -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
        <!-- Overview Tab -->
        <div v-if="activeTab === 'overview'" class="p-6">
          <AudienceOverview 
            @create-list="handleCreateList"
            @switch-tab="activeTab = $event"
          />
        </div>

        <!-- Following Tab -->
        <div v-if="activeTab === 'following'" class="p-6">
          <!-- Search and Filters -->
          <div class="flex flex-col sm:flex-row gap-4 mb-6">
            <div class="relative flex-1">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search people you follow..."
                class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
              />
              <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            </div>
            
            <div class="flex space-x-2">
              <select
                v-model="filterBy"
                class="px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-white"
              >
                <option value="all">All</option>
                <option value="mutuals">Mutuals</option>
                <option value="new">New (7d)</option>
                <option value="not-followed-back">Not followed back</option>
              </select>
              
              <select
                v-model="sortBy"
                class="px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-white"
              >
                <option value="recent">Recent</option>
                <option value="alphabetical">A-Z</option>
                <option value="popular">Popular</option>
              </select>
            </div>
          </div>

          <!-- Following List -->
          <div v-if="isLoading && following.length === 0" class="text-center py-12">
            <IconLoader class="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
            <p class="text-gray-600">Loading people you follow...</p>
          </div>

          <div v-else-if="filteredFollowing.length === 0" class="text-center py-12">
            <IconUsers class="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              {{ searchQuery ? 'No matching users' : 'Not following anyone yet' }}
            </h3>
            <p class="text-gray-600 mb-4">
              {{ searchQuery ? 'Try adjusting your search terms' : 'Discover and follow interesting people on Nostr' }}
            </p>
            <button
              v-if="!searchQuery"
              @click="activeTab = 'following'"
              class="btn-primary"
            >
              <IconSearch class="w-4 h-4" />
              Browse Following
            </button>
          </div>

          <div v-else class="space-y-3">
            <ProfileCard
              v-for="pubkey in filteredFollowing"
              :key="pubkey"
              :pubkey="pubkey"
              :profile="getProfile(pubkey)"
              :is-following="true"
              :is-selected="selectedUsers.has(pubkey)"
              :show-selection="showBulkActions"
              @click="handleProfileClick(pubkey)"
              @follow="followUser(pubkey)"
              @unfollow="unfollowUser(pubkey)"
              @toggle-selection="toggleUserSelection(pubkey)"
            />
          </div>
        </div>

        <!-- Followers Tab -->
        <div v-if="activeTab === 'followers'" class="p-6">
          <!-- Search -->
          <div class="relative mb-6">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search your followers..."
              class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
            <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
          </div>

          <!-- Followers List -->
          <div v-if="isLoading && followers.length === 0" class="text-center py-12">
            <IconLoader class="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
            <p class="text-gray-600">Finding your followers...</p>
          </div>

          <div v-else-if="filteredFollowers.length === 0" class="text-center py-12">
            <IconUsers class="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">
              {{ searchQuery ? 'No matching followers' : 'No followers yet' }}
            </h3>
            <p class="text-gray-600">
              {{ searchQuery ? 'Try adjusting your search terms' : 'Share your profile to gain followers' }}
            </p>
          </div>

          <div v-else class="space-y-3">
            <ProfileCard
              v-for="pubkey in filteredFollowers"
              :key="pubkey"
              :pubkey="pubkey"
              :profile="getProfile(pubkey)"
              :is-following="isFollowing(pubkey)"
              @click="handleProfileClick(pubkey)"
              @follow="followUser(pubkey)"
              @unfollow="unfollowUser(pubkey)"
            />
          </div>
        </div>

        <!-- Lists Tab -->
        <div v-if="activeTab === 'lists'" class="p-6">
          <FollowListManager />
        </div>

        <!-- Discover Tab -->
      </div>
    </div>
  </div>

  <!-- Profile Modal -->
  <ProfileModal
    :show="showProfileModal"
    :pubkey="selectedProfile"
    :profile="selectedProfile ? getProfile(selectedProfile) : null"
    @close="showProfileModal = false; selectedProfile = null"
    @follow="followUser"
    @unfollow="unfollowUser"
  />

  <!-- Follow List Modal -->
  <FollowListModal
    :show="showListModal"
    :list="selectedList"
    @close="showListModal = false; selectedList = null"
    @save="selectedList ? updateFollowList : createFollowList"
  />
</template>

<style scoped>
/* Slide down animation for bulk actions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Ensure proper touch targets */
@media (max-width: 640px) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>