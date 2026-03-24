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
  IconUserX,
  IconHeart,
  IconStar,
  IconTarget,
  IconGlobe,
  IconInfoCircle,
  IconBulb
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useAudience } from '../composables/audience/useAudience.js'
import { nostrService } from '../services/nostr/NostrService.js'
import { publishService } from '../services/nostr/PublishService.js'
import ProfileCard from '../components/profile/ProfileCard.vue'
import ProfileModal from '../components/modals/ProfileModal.vue'
import FollowListModal from '../components/audience/FollowListModal.vue'
import FollowListCard from '../components/audience/FollowListCard.vue'
import AudienceOverview from '../components/audience/AudienceOverview.vue'
import FollowListManager from '../components/audience/FollowListManager.vue'
import SuggestionsTab from '../components/shared/SuggestionsTab.vue'
import BadgeDetailModal from '../components/badges/BadgeDetailModal.vue'

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
  getFollowersCount,
  getFollowingCount,
  fetchProfile,
  followersLimitReached
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
const selectedBadge = ref(null)
const showBadgeModal = ref(false)

// Pagination for large lists
const followersVisible = ref(50)
const followingVisible = ref(50)

// Inline status banner
const statusMessage = ref(null)
let statusTimer = null

const showStatus = (type, text, duration = 5000) => {
  clearTimeout(statusTimer)
  statusMessage.value = { type, text }
  statusTimer = setTimeout(() => { statusMessage.value = null }, duration)
}

// Tabs configuration
const tabs = [
  {
    id: 'overview', label: 'Overview', icon: IconTarget, count: null },
  { id: 'following', label: 'Following', icon: IconUserCheck, count: computed(() => getFollowingCount()) },
  { id: 'followers', label: 'Followers', icon: IconUsers, count: computed(() => getFollowersCount()) },
  { id: 'lists', label: 'Follow Packs', icon: IconList, count: computed(() => myLists.value.length) },
  { id: 'suggestions', label: 'Suggestions', icon: IconUserPlus, count: null }
]

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

const paginatedFollowers = computed(() => {
  return filteredFollowers.value.slice(0, followersVisible.value)
})

const paginatedFollowing = computed(() => {
  return filteredFollowing.value.slice(0, followingVisible.value)
})

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
    if (error.message.includes('No Nostr extension')) {
      showStatus('error', 'No Nostr extension found. Please install a NIP-07 browser extension (Alby, nos2x, or Flamingo) and refresh this page.')
    } else {
      showStatus('error', 'Login failed: ' + error.message)
    }
  }
}

// Handle profile click
const handleProfileClick = (pubkey) => {
  selectedProfile.value = pubkey
  showProfileModal.value = true
}

// Handle badge click
const handleBadgeClick = (badge) => {
  selectedBadge.value = badge
  showBadgeModal.value = true
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
    const kind3Filters = { kinds: [3], authors: [currentUser.value.pubkey], limit: 1 }
    const currentFollowingEvent = await nostrService.queryOne(kind3Filters)

    // Extract current follows and preserve relay config in content field
    let currentFollows = []
    const existingContent = currentFollowingEvent?.content || ''
    if (currentFollowingEvent) {
      currentFollows = currentFollowingEvent.tags
        .filter(tag => tag[0] === 'p' && tag[1])
        .map(tag => tag[1])
    }

    const selectedArray = Array.from(selectedUsers.value)
    const newFollows = selectedArray.filter(pubkey => !currentFollows.includes(pubkey))
    const mergedFollows = [...new Set([...currentFollows, ...newFollows])]

    if (newFollows.length === 0) {
      showStatus('success', `Already following all ${selectedArray.length} selected users`)
      selectedUsers.value.clear()
      showBulkActions.value = false
      return
    }

    const contactTags = mergedFollows.map(pubkey => ['p', pubkey])

    const eventTemplate = {
      kind: 3,
      created_at: Math.floor(Date.now() / 1000),
      tags: contactTags,
      content: existingContent
    }

    // Sign and publish the event
    const { result } = await publishService.signAndPublish(eventTemplate)

    // Invalidate cached kind 3 so subsequent operations see updated list
    nostrService.clearEventCache(kind3Filters)

    // Update local state
    following.value = mergedFollows

    showStatus('success', `Followed ${newFollows.length} new people — now following ${mergedFollows.length.toLocaleString()} total`)

    selectedUsers.value.clear()
    showBulkActions.value = false
  } catch (err) {
    console.error('Bulk follow failed:', err)
    showStatus('error', `Bulk follow failed: ${err.message}`)
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
    refreshFollowing()
    refreshFollowers()
  }
})

// Watch for authentication changes
watch(isAuthenticated, (authenticated) => {
  if (authenticated) {
    refreshFollowing()
    refreshFollowers()
  } else {
    activeTab.value = 'overview'
    searchQuery.value = ''
    clearSelection()
  }
})

onUnmounted(() => {
  clearTimeout(statusTimer)
})

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

      <!-- Tab Navigation -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <nav class="flex space-x-8 px-6 min-w-max" role="tablist" aria-label="Audience tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              role="tab"
              :aria-selected="activeTab === tab.id"
              :aria-controls="`tabpanel-${tab.id}`"
              @click="activeTab = tab.id; clearSelection()"
              :class="[
                'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap',
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
      </div>

      <!-- Status Banner -->
      <transition name="slide-down">
        <div
          v-if="statusMessage"
          role="status"
          aria-live="polite"
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
            aria-label="Dismiss status message"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
      </transition>

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
        <div v-if="activeTab === 'overview'" id="tabpanel-overview" role="tabpanel" class="p-6">
          <AudienceOverview 
            @create-list="handleCreateList"
            @switch-tab="activeTab = $event"
          />
        </div>

        <!-- Following Tab -->
        <div v-if="activeTab === 'following'" id="tabpanel-following" role="tabpanel" class="p-6">
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
          </div>

          <!-- Following List -->
          <div v-if="isLoading && following.length === 0" class="text-center py-12">
            <IconLoader class="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
            <p class="text-gray-600">Loading people you follow...</p>
          </div>

          <div v-else-if="filteredFollowing.length === 0" class="max-w-2xl mx-auto">
            <!-- Search No Results -->
            <div v-if="searchQuery" class="text-center py-12">
              <IconSearch class="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 class="text-xl font-semibold text-gray-900 mb-2">No Matching Users</h3>
              <p class="text-gray-600 mb-4">Try adjusting your search terms</p>
            </div>

            <!-- Not Following Anyone Yet -->
            <div v-else class="py-8">
              <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-3xl shadow-lg mb-6">
                  <IconUsers class="w-10 h-10 text-white" />
                </div>
                <h3 class="text-2xl font-bold text-gray-900 mb-3">Build Your Network</h3>
                <p class="text-lg text-gray-600">
                  You're not following anyone yet. Let's connect you with interesting people!
                </p>
              </div>

              <!-- Why Empty -->
              <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
                <div class="flex items-start space-x-4">
                  <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <IconInfoCircle class="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 class="text-lg font-semibold text-gray-900 mb-2">Growing Your Audience Starts Here</h4>
                    <p class="text-gray-700 leading-relaxed">
                      Following people on Nostr helps you discover content, build relationships, and grow your own audience.
                      When you support others, they're more likely to discover and support you too.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Action Steps -->
              <div class="space-y-4 mb-8">
                <h4 class="text-xl font-bold text-gray-900 text-center mb-6">How to Find People to Follow</h4>

                <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
                  <div class="flex items-start space-x-4">
                    <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                      1
                    </div>
                    <div class="flex-1">
                      <h5 class="font-semibold text-gray-900 mb-2">Use Nostr Clients to Discover</h5>
                      <p class="text-gray-600 text-sm mb-3">
                        Browse Primal, Damus, Amethyst, or Nostrudel to find users posting interesting content. Look for hashtags you care about and follow the creators.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
                  <div class="flex items-start space-x-4">
                    <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                      2
                    </div>
                    <div class="flex-1">
                      <h5 class="font-semibold text-gray-900 mb-2">Follow People Who Zap You</h5>
                      <p class="text-gray-600 text-sm mb-3">
                        Check your ZapFeed to see who's supporting your content. Following your supporters builds community and encourages more engagement.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
                  <div class="flex items-start space-x-4">
                    <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                      3
                    </div>
                    <div class="flex-1">
                      <h5 class="font-semibold text-gray-900 mb-2">Join Conversations & Communities</h5>
                      <p class="text-gray-600 text-sm mb-3">
                        Engage with posts that interest you. Reply, share thoughts, and follow people whose perspectives you value.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tips -->
              <div class="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-2xl p-6">
                <h5 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <IconBulb class="w-5 h-5 text-amber-500" />
                  <span>Networking Tips</span>
                </h5>
                <ul class="space-y-2 text-sm text-gray-700">
                  <li class="flex items-start space-x-2">
                    <span class="text-purple-600 font-bold mt-0.5">•</span>
                    <span>Follow people with similar interests first - quality connections matter more than quantity</span>
                  </li>
                  <li class="flex items-start space-x-2">
                    <span class="text-purple-600 font-bold mt-0.5">•</span>
                    <span>Engage before you expect engagement - support others to build genuine relationships</span>
                  </li>
                  <li class="flex items-start space-x-2">
                    <span class="text-purple-600 font-bold mt-0.5">•</span>
                    <span>Start small - follow 10-20 people you genuinely want to hear from, then grow naturally</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div v-else>
            <div class="space-y-3">
              <ProfileCard
                v-for="pubkey in paginatedFollowing"
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
                @badge-click="handleBadgeClick"
              />
            </div>

            <!-- Load More for following -->
            <div v-if="filteredFollowing.length > followingVisible" class="text-center mt-4">
              <button
                @click="followingVisible += 50"
                class="text-sm text-orange-600 hover:text-orange-800 font-medium px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Show more ({{ filteredFollowing.length - followingVisible }} remaining)
              </button>
            </div>
          </div>
        </div>

        <!-- Followers Tab -->
        <div v-if="activeTab === 'followers'" id="tabpanel-followers" role="tabpanel" class="p-6">
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

          <div v-else>
            <!-- Data cap indicator -->
            <div v-if="followersLimitReached" class="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span class="text-blue-800 text-xs">Showing {{ followers.length }}+ followers (query limit reached — actual count may be higher)</span>
            </div>

            <!-- Paginated followers list -->
            <div class="space-y-3">
              <ProfileCard
                v-for="pubkey in paginatedFollowers"
                :key="pubkey"
                :pubkey="pubkey"
                :profile="getProfile(pubkey)"
                :is-following="isFollowing(pubkey)"
                @click="handleProfileClick(pubkey)"
                @follow="followUser(pubkey)"
                @unfollow="unfollowUser(pubkey)"
                @badge-click="handleBadgeClick"
              />
            </div>

            <!-- Load More / pagination -->
            <div v-if="filteredFollowers.length > followersVisible" class="text-center mt-4">
              <button
                @click="followersVisible += 50"
                class="text-sm text-orange-600 hover:text-orange-800 font-medium px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Show more ({{ filteredFollowers.length - followersVisible }} remaining)
              </button>
            </div>
            <div v-else-if="filteredFollowers.length > 50" class="text-center mt-3">
              <span class="text-xs text-gray-400">Showing all {{ filteredFollowers.length }} followers</span>
            </div>
          </div>
        </div>

        <!-- Lists Tab -->
        <div v-if="activeTab === 'lists'" id="tabpanel-lists" role="tabpanel" class="p-6">
          <FollowListManager />
        </div>

        <div v-if="activeTab === 'suggestions'" id="tabpanel-suggestions" role="tabpanel" class="p-6">
          <SuggestionsTab
            @profile-click="handleProfileClick"
            @switch-tab="activeTab = $event"
          />
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
    :isFollowing="selectedProfile ? isFollowing(selectedProfile) : false"
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

  <!-- Badge Detail Modal -->
  <BadgeDetailModal
    :show="showBadgeModal"
    :badge="selectedBadge"
    @close="showBadgeModal = false; selectedBadge = null"
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
