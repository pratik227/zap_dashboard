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
  IconFilter,
  IconShare,
  IconExternalLink,
  IconShield,
  IconBolt,
  IconGlobe,
  IconCalendar,
  IconUser
} from '@iconify-prerendered/vue-tabler'
import { useFollowLists } from '../composables/useFollowLists.js'
import { useAudience } from '../composables/useAudience.js'
import * as nip19 from 'nostr-tools/nip19'

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
const followingStatus = ref(new Map()) // Track following status for each member

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

const someSelected = computed(() => {
  return selectedMembers.value.size > 0 && !allSelected.value
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
    
    // Enhanced feedback based on result
    if (result && result.success) {
      // Update following status for newly followed members only
      if (result.addedMembers && result.addedMembers.length > 0) {
        result.addedMembers.forEach(pubkey => {
          followingStatus.value.set(pubkey, true)
        })
      }
      
      // Show appropriate feedback
      if (result.alreadyFollowingAll) {
        alert(`✅ ${result.message}`)
      } else {
        alert(`🎉 ${result.message}\n\nTotal people you're now following: ${result.totalFollows.toLocaleString()}`)
      }
    }
    
    // Clear selection
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
    
    // Enhanced feedback based on result
    if (result && result.success) {
      // Update following status for newly followed members only
      if (result.addedMembers && result.addedMembers.length > 0) {
        result.addedMembers.forEach(pubkey => {
          followingStatus.value.set(pubkey, true)
        })
      }
      
      // Show appropriate feedback
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
  return profile?.picture || generateFallbackAvatar(pubkey)
}

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
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
      <div v-if="show && list" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
          <!-- Header -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <!-- List Image or Icon -->
                <div class="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center shadow-lg">
                  <img 
                    v-if="list.image"
                    :src="list.image" 
                    :alt="list.title"
                    class="w-full h-full object-cover"
                    @error="$event.target.style.display = 'none'"
                  />
                  <IconList v-else class="w-8 h-8 text-white" />
                </div>
                
                <!-- List Info -->
                <div>
                  <h3 class="text-2xl font-bold text-gray-900 mb-1">{{ list.title }}</h3>
                  <p v-if="list.description" class="text-gray-600 mb-2">{{ list.description }}</p>
                  <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <span class="flex items-center space-x-1">
                      <IconUsers class="w-4 h-4" />
                      <span>{{ list.memberCount }} members</span>
                    </span>
                    <span class="flex items-center space-x-1">
                      <IconCalendar class="w-4 h-4" />
                      <span>{{ new Date(list.created_at * 1000).toLocaleDateString() }}</span>
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                @click="closeModal"
                class="w-10 h-10 bg-white/60 hover:bg-white/80 rounded-full flex items-center justify-center transition-colors text-gray-600"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex flex-col h-[calc(90vh-200px)]">
            <!-- Controls -->
            <div class="p-6 border-b border-gray-100 bg-white">
              <div class="flex flex-col sm:flex-row gap-4">
                <!-- Search -->
                <div class="relative flex-1">
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search members..."
                    class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                  <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                </div>
                
                <!-- Bulk Actions -->
                <div class="flex items-center space-x-3">
                  <!-- Select All Checkbox -->
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="allSelected"
                      :indeterminate="someSelected"
                      @change="toggleSelectAll"
                      class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span class="text-sm font-medium text-gray-700">
                      {{ selectedCount > 0 ? `${selectedCount} selected` : 'Select all' }}
                    </span>
                  </label>
                  
                  <!-- Follow Actions -->
                  <button
                    v-if="selectedCount > 0"
                    @click="followSelected"
                    :disabled="isProcessing"
                    class="btn-primary text-sm"
                  >
                    <IconLoader v-if="isProcessing" class="w-4 h-4 animate-spin" />
                    <IconUserPlus v-else class="w-4 h-4" />
                    Follow Selected
                  </button>
                  
                  <button
                    @click="followAll"
                    :disabled="isProcessing"
                    class="btn-secondary text-sm"
                  >
                    <IconLoader v-if="isProcessing" class="w-4 h-4 animate-spin" />
                    <IconUsers v-else class="w-4 h-4" />
                    Follow All
                  </button>
                </div>
              </div>
            </div>

            <!-- Members List -->
            <div class="flex-1 overflow-y-auto p-6">
              <div v-if="filteredMembers.length === 0" class="text-center py-12">
                <IconUsers class="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h4 class="text-lg font-medium text-gray-900 mb-2">
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
                  class="bg-gray-50 rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
                >
                  <div class="flex items-center space-x-3">
                    <!-- Selection Checkbox -->
                    <input
                      type="checkbox"
                      :checked="selectedMembers.has(pubkey)"
                      @change="toggleMemberSelection(pubkey)"
                      class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
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
                      <div class="flex items-center space-x-2 mb-1">
                        <h4 class="font-semibold text-gray-900 truncate">
                          {{ getMemberDisplayName(pubkey) }}
                        </h4>
                        
                        <!-- Status Badges -->
                        <div class="flex items-center space-x-1">
                          <IconShield v-if="getProfile(pubkey)?.nip05" class="w-3 h-3 text-blue-600" title="NIP-05 Verified" />
                          <IconBolt v-if="getProfile(pubkey)?.lud16" class="w-3 h-3 text-yellow-500" title="Lightning Address" />
                          <IconUserCheck v-if="followingStatus.get(pubkey)" class="w-3 h-3 text-green-600" title="Following" />
                        </div>
                      </div>
                      
                      <p v-if="getProfile(pubkey)?.about" class="text-sm text-gray-600 line-clamp-2">
                        {{ getProfile(pubkey).about }}
                      </p>
                      
                      <div class="flex items-center justify-between mt-2">
                        <span class="text-xs text-gray-500">
                          {{ pubkey.substring(0, 8) }}...{{ pubkey.substring(pubkey.length - 8) }}
                        </span>
                        
                        <!-- External Profile Link -->
                        <a
                          :href="getProfileUrl(pubkey)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-gray-400 hover:text-purple-600 transition-colors"
                          title="View on Yakihonne"
                        >
                          <IconExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                    </div>
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

/* Modal transitions */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s ease-out;
}

.modal-transition-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-transition-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}
</style>