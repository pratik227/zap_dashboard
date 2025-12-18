<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  IconX,
  IconList,
  IconUsers,
  IconUserPlus,
  IconUserCheck,
  IconCheck,
  IconLoader,
  IconAlertCircle,
  IconSearch,
  IconExternalLink,
  IconShield,
  IconBolt,
  IconCalendar,
  IconSparkles
} from '@iconify-prerendered/vue-tabler'
import { useFollowLists } from '../../composables/audience/useFollowLists.js'
import { useAudience } from '../../composables/audience/useAudience.js'
import * as nip19 from 'nostr-tools/nip19'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  list: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'follow-all', 'follow-selected'])

const { getProfile, isFollowingMember } = useFollowLists()
const { isFollowing } = useAudience()

// UI state
const searchQuery = ref('')
const selectedMembers = ref(new Set())
const showBulkActions = ref(false)
const isProcessing = ref(false)
const followingStatus = ref(new Map())
const startY = ref(0)
const currentY = ref(0)
const isDragging = ref(false)

// Computed properties
const filteredMembers = computed(() => {
  if (!props.list?.members) return []

  let members = props.list.members

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    members = members.filter(pubkey => {
      const profile = getProfile(pubkey)
      return profile?.name?.toLowerCase().includes(query) ||
             profile?.about?.toLowerCase().includes(query) ||
             pubkey.toLowerCase().includes(query)
    })
  }

  return members
})

const selectedCount = computed(() => selectedMembers.value.size)

const allSelected = computed(() => {
  return filteredMembers.value.length > 0 &&
         filteredMembers.value.every(pubkey => selectedMembers.value.has(pubkey))
})

// Check following status for all members
const checkFollowingStatus = async () => {
  if (!props.list?.members) return

  const statusPromises = props.list.members.map(async (pubkey) => {
    try {
      const isFollowingUser = await isFollowingMember(pubkey)
      followingStatus.value.set(pubkey, isFollowingUser)
    } catch (error) {
      console.warn(`Failed to check following status for ${pubkey.substring(0, 8)}:`, error)
      followingStatus.value.set(pubkey, false)
    }
  })

  await Promise.allSettled(statusPromises)
}

// Toggle member selection
const toggleMemberSelection = (pubkey) => {
  if (selectedMembers.value.has(pubkey)) {
    selectedMembers.value.delete(pubkey)
  } else {
    selectedMembers.value.add(pubkey)
  }

  showBulkActions.value = selectedMembers.value.size > 0
}

// Select all filtered members
const selectAll = () => {
  filteredMembers.value.forEach(pubkey => {
    selectedMembers.value.add(pubkey)
  })
  showBulkActions.value = true
}

// Deselect all members
const deselectAll = () => {
  selectedMembers.value.clear()
  showBulkActions.value = false
}

// Toggle all selection
const toggleSelectAll = () => {
  if (allSelected.value) {
    deselectAll()
  } else {
    selectAll()
  }
}

// Follow selected members
const followSelected = async () => {
  if (selectedMembers.value.size === 0) return

  isProcessing.value = true

  try {
    const selectedArray = Array.from(selectedMembers.value)
    const result = await emit('follow-selected', props.list, selectedArray)

    if (result && result.success) {
      if (result.addedMembers && result.addedMembers.length > 0) {
        result.addedMembers.forEach(pubkey => {
          followingStatus.value.set(pubkey, true)
        })
      }

      if (result.alreadyFollowingAll) {
        alert(`✅ ${result.message}`)
      } else {
        alert(`🎉 ${result.message}\n\nTotal people you're now following: ${result.totalFollows.toLocaleString()}`)
      }
    }

    selectedMembers.value.clear()
    showBulkActions.value = false

  } catch (error) {
    console.error('Failed to follow selected members:', error)
    alert(`❌ Failed to follow selected members: ${error.message}\n\nYour existing follows remain safe.`)
  } finally {
    isProcessing.value = false
  }
}

// Follow entire list
const followAll = async () => {
  isProcessing.value = true

  try {
    const result = await emit('follow-all', props.list)

    if (result && result.success) {
      if (result.addedMembers && result.addedMembers.length > 0) {
        result.addedMembers.forEach(pubkey => {
          followingStatus.value.set(pubkey, true)
        })
      }

      if (result.alreadyFollowingAll) {
        alert(`✅ ${result.message}`)
      } else {
        alert(`🎉 ${result.message}\n\nTotal people you're now following: ${result.totalFollows.toLocaleString()}`)
      }
    }

  } catch (error) {
    console.error('Failed to follow entire list:', error)
    alert(`❌ Failed to follow pack: ${error.message}\n\nYour existing follows remain safe.`)
  } finally {
    isProcessing.value = false
  }
}

// Get member display name
const getMemberDisplayName = (pubkey) => {
  const profile = getProfile(pubkey)
  return profile?.name || `user:${pubkey.substring(0, 8)}`
}

// Get member avatar
const getMemberAvatar = (pubkey) => {
  const profile = getProfile(pubkey)
  return profile?.picture || generateAvatar(pubkey)
}

// Get profile URL for external viewing
const getProfileUrl = (pubkey) => {
  try {
    const npub = nip19.npubEncode(pubkey)
    return `https://yakihonne.com/${npub}`
  } catch (error) {
    return '#'
  }
}

// Touch handlers for mobile bottom sheet
const handleTouchStart = (e) => {
  startY.value = e.touches[0].clientY
  isDragging.value = true
}

const handleTouchMove = (e) => {
  if (!isDragging.value) return
  currentY.value = e.touches[0].clientY - startY.value
  if (currentY.value < 0) currentY.value = 0
}

const handleTouchEnd = () => {
  if (currentY.value > 100) {
    closeModal()
  }
  currentY.value = 0
  isDragging.value = false
}

// Close modal
const closeModal = () => {
  selectedMembers.value.clear()
  showBulkActions.value = false
  searchQuery.value = ''
  emit('close')
}

// Initialize when modal opens
watch(() => props.show, (show) => {
  if (show && props.list) {
    checkFollowingStatus()
  }
})

// Handle escape key
const handleKeydown = (event) => {
  if (event.key === 'Escape' && props.show) {
    closeModal()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show && list" class="modal-overlay fixed inset-0 z-[9999] md:flex md:items-center md:justify-center md:p-4">
        <!-- Desktop: Centered Modal -->
        <div class="hidden md:block bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-300">
          <!-- Header -->
          <div class="relative">
            <!-- Cover Image or Gradient -->
            <div class="h-40 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 relative overflow-hidden">
              <img
                v-if="list.image"
                :src="list.image"
                :alt="list.title"
                class="w-full h-full object-cover"
                @error="$event.target.style.display = 'none'"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
            </div>

            <!-- Close Button -->
            <button
              @click="closeModal"
              class="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 text-white hover:scale-110 shadow-lg"
              aria-label="Close"
            >
              <IconX class="w-5 h-5" />
            </button>

            <!-- List Icon/Image Overlay -->
            <div class="absolute -bottom-8 left-8">
              <div class="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white">
                <img
                  v-if="list.image"
                  :src="list.image"
                  :alt="list.title"
                  class="w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'"
                />
                <div v-else class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center">
                  <IconList class="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="pt-12 px-8 pb-8">
            <!-- Pack Info -->
            <div class="mb-8">
              <h2 class="text-3xl font-bold text-gray-900 mb-2">{{ list.title }}</h2>
              <p v-if="list.description" class="text-gray-600 mb-4">{{ list.description }}</p>
              <div class="flex items-center space-x-6 text-sm text-gray-500">
                <span class="flex items-center space-x-2">
                  <IconUsers class="w-4 h-4" />
                  <span>{{ list.memberCount }} members</span>
                </span>
                <span class="flex items-center space-x-2">
                  <IconCalendar class="w-4 h-4" />
                  <span>{{ new Date(list.created_at * 1000).toLocaleDateString() }}</span>
                </span>
              </div>
            </div>

            <!-- Actions Bar -->
            <div class="flex flex-col sm:flex-row gap-4 mb-8">
              <!-- Search -->
              <div class="relative flex-1">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search members..."
                  class="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-base"
                />
                <IconSearch class="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
              </div>

              <!-- Follow Actions -->
              <div class="flex items-center gap-3">
                <button
                  v-if="selectedCount > 0"
                  @click="followSelected"
                  :disabled="isProcessing"
                  class="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <IconLoader v-if="isProcessing" class="w-5 h-5 animate-spin" />
                  <IconUserPlus v-else class="w-5 h-5" />
                  Follow {{ selectedCount }}
                </button>

                <button
                  @click="followAll"
                  :disabled="isProcessing"
                  class="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border border-gray-200 shadow-sm disabled:opacity-50"
                >
                  <IconLoader v-if="isProcessing" class="w-5 h-5 animate-spin" />
                  <IconUsers v-else class="w-5 h-5" />
                  Follow All
                </button>
              </div>
            </div>

            <!-- Members Grid -->
            <div class="max-h-[calc(90vh-420px)] overflow-y-auto pr-2">
              <div v-if="filteredMembers.length === 0" class="text-center py-16">
                <div class="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconUsers class="w-8 h-8 text-gray-400" />
                </div>
                <h4 class="text-lg font-semibold text-gray-900 mb-2">
                  {{ searchQuery ? 'No matching members' : 'No members in this pack' }}
                </h4>
                <p class="text-gray-600">
                  {{ searchQuery ? 'Try adjusting your search terms' : 'This pack appears to be empty' }}
                </p>
              </div>

              <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="pubkey in filteredMembers"
                  :key="pubkey"
                  class="bg-white hover:bg-gray-50 rounded-2xl border border-gray-100 p-4 transition-all duration-200 group cursor-pointer"
                  @click="toggleMemberSelection(pubkey)"
                >
                  <div class="flex items-start space-x-3">
                    <!-- Selection Checkbox -->
                    <input
                      type="checkbox"
                      :checked="selectedMembers.has(pubkey)"
                      @change="toggleMemberSelection(pubkey)"
                      @click.stop
                      class="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded-md focus:ring-orange-500"
                    />

                    <!-- Avatar -->
                    <div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-orange-200 flex-shrink-0">
                      <img
                        :src="getMemberAvatar(pubkey)"
                        :alt="getMemberDisplayName(pubkey)"
                        class="w-full h-full object-cover"
                      />
                    </div>

                    <!-- Member Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-1">
                        <h4 class="font-semibold text-gray-900 truncate text-sm">
                          {{ getMemberDisplayName(pubkey) }}
                        </h4>

                        <!-- Status Badges -->
                        <div class="flex items-center gap-1">
                          <IconShield v-if="getProfile(pubkey)?.nip05" class="w-3.5 h-3.5 text-blue-600" title="Verified" />
                          <IconBolt v-if="getProfile(pubkey)?.lud16" class="w-3.5 h-3.5 text-yellow-500" title="Lightning" />
                          <IconUserCheck v-if="followingStatus.get(pubkey)" class="w-3.5 h-3.5 text-green-600" title="Following" />
                        </div>
                      </div>

                      <p v-if="getProfile(pubkey)?.about" class="text-xs text-gray-600 line-clamp-2 mb-2">
                        {{ getProfile(pubkey).about }}
                      </p>

                      <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-400 font-mono">
                          {{ pubkey.substring(0, 8) }}...
                        </span>

                        <!-- External Profile Link -->
                        <a
                          :href="getProfileUrl(pubkey)"
                          target="_blank"
                          rel="noopener noreferrer"
                          @click.stop
                          class="text-gray-400 hover:text-purple-600 transition-colors p-1"
                          title="View profile"
                        >
                          <IconExternalLink class="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Mobile: Bottom Sheet -->
        <div
          class="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-[2rem] shadow-2xl transform transition-transform duration-300 max-h-[92vh] flex flex-col"
          :style="{ transform: `translateY(${currentY}px)` }"
        >
          <!-- Drag Handle -->
          <div
            class="flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing"
            @touchstart="handleTouchStart"
            @touchmove="handleTouchMove"
            @touchend="handleTouchEnd"
          >
            <div class="w-10 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          <!-- Header -->
          <div class="relative flex-shrink-0">
            <!-- Cover Image -->
            <div class="h-28 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 relative overflow-hidden">
              <img
                v-if="list.image"
                :src="list.image"
                :alt="list.title"
                class="w-full h-full object-cover"
                @error="$event.target.style.display = 'none'"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
            </div>

            <!-- Close Button -->
            <button
              @click="closeModal"
              class="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
            >
              <IconX class="w-4 h-4" />
            </button>

            <!-- Pack Icon -->
            <div class="absolute -bottom-10 left-4">
              <div class="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white">
                <img
                  v-if="list.image"
                  :src="list.image"
                  :alt="list.title"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center">
                  <IconList class="w-10 h-10 text-white" />
                </div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto pt-12 px-4 pb-6">
            <!-- Pack Info -->
            <div class="mb-6">
              <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ list.title }}</h2>
              <p v-if="list.description" class="text-gray-600 text-sm mb-3">{{ list.description }}</p>
              <div class="flex items-center gap-4 text-xs text-gray-500">
                <span class="flex items-center gap-1.5">
                  <IconUsers class="w-3.5 h-3.5" />
                  <span>{{ list.memberCount }} members</span>
                </span>
                <span class="flex items-center gap-1.5">
                  <IconCalendar class="w-3.5 h-3.5" />
                  <span>{{ new Date(list.created_at * 1000).toLocaleDateString() }}</span>
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="mb-6 space-y-3">
              <button
                v-if="selectedCount > 0"
                @click="followSelected"
                :disabled="isProcessing"
                class="w-full px-4 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                <IconLoader v-if="isProcessing" class="w-5 h-5 animate-spin" />
                <IconUserPlus v-else class="w-5 h-5" />
                Follow {{ selectedCount }} Selected
              </button>

              <button
                @click="followAll"
                :disabled="isProcessing"
                class="w-full px-4 py-3.5 bg-white hover:bg-gray-50 text-gray-700 rounded-2xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 border-2 border-gray-200 disabled:opacity-50"
              >
                <IconLoader v-if="isProcessing" class="w-5 h-5 animate-spin" />
                <IconUsers v-else class="w-5 h-5" />
                Follow All Members
              </button>

              <!-- Search -->
              <div class="relative">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search members..."
                  class="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-orange-400 text-base"
                />
                <IconSearch class="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
              </div>
            </div>

            <!-- Members List -->
            <div v-if="filteredMembers.length === 0" class="text-center py-12">
              <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <IconUsers class="w-7 h-7 text-gray-400" />
              </div>
              <h4 class="font-semibold text-gray-900 mb-1">
                {{ searchQuery ? 'No matches' : 'No members' }}
              </h4>
              <p class="text-sm text-gray-600">
                {{ searchQuery ? 'Try different keywords' : 'Pack is empty' }}
              </p>
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="pubkey in filteredMembers"
                :key="pubkey"
                class="bg-gray-50 hover:bg-gray-100 rounded-2xl p-3 transition-all duration-200"
                @click="toggleMemberSelection(pubkey)"
              >
                <div class="flex items-start gap-3">
                  <input
                    type="checkbox"
                    :checked="selectedMembers.has(pubkey)"
                    @click.stop
                    @change="toggleMemberSelection(pubkey)"
                    class="mt-1 w-5 h-5 text-orange-500 border-gray-300 rounded-md"
                  />

                  <div class="w-11 h-11 rounded-xl overflow-hidden border-2 border-orange-200 flex-shrink-0">
                    <img
                      :src="getMemberAvatar(pubkey)"
                      :alt="getMemberDisplayName(pubkey)"
                      class="w-full h-full object-cover"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <h4 class="font-semibold text-gray-900 truncate text-sm">
                        {{ getMemberDisplayName(pubkey) }}
                      </h4>
                      <div class="flex items-center gap-1">
                        <IconShield v-if="getProfile(pubkey)?.nip05" class="w-3 h-3 text-blue-600" />
                        <IconBolt v-if="getProfile(pubkey)?.lud16" class="w-3 h-3 text-yellow-500" />
                        <IconUserCheck v-if="followingStatus.get(pubkey)" class="w-3 h-3 text-green-600" />
                      </div>
                    </div>

                    <p v-if="getProfile(pubkey)?.about" class="text-xs text-gray-600 line-clamp-2 mb-1">
                      {{ getProfile(pubkey).about }}
                    </p>

                    <span class="text-xs text-gray-400 font-mono">
                      {{ pubkey.substring(0, 8) }}...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Modal overlay with smooth backdrop */
.modal-overlay {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* Modal transitions */
.modal-transition-enter-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-transition-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-transition-enter-from .modal-overlay {
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
}

.modal-transition-leave-to .modal-overlay {
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
}

/* Desktop modal animation */
@media (min-width: 768px) {
  .modal-transition-enter-from {
    transform: scale(0.95) translateY(-20px);
  }

  .modal-transition-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
}

/* Mobile bottom sheet animation */
@media (max-width: 767px) {
  .modal-transition-enter-from .md\:hidden {
    transform: translateY(100%);
  }

  .modal-transition-leave-to .md\:hidden {
    transform: translateY(100%);
  }
}

.modal-transition-leave-to {
  opacity: 0;
}

/* Focus states for accessibility */
button:focus-visible, a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>
