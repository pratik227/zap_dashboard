<script setup>
import { ref, computed, watch } from 'vue'
import {
  IconX,
  IconList,
  IconPlus,
  IconTrash,
  IconSearch,
  IconUser,
  IconCheck,
  IconLoader,
  IconPhoto,
  IconAlertCircle,
  IconUsers,
  IconUserPlus,
  IconArrowRight,
  IconArrowLeft
} from '@iconify-prerendered/vue-tabler'
import { useAudience } from '../composables/useAudience.js'
import { useFollowLists } from '../composables/useFollowLists.js'
import { generateAvatar } from '../utils/avatarGenerator.js'

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

const emit = defineEmits(['close', 'save'])

const { following, getProfile, fetchProfile } = useAudience()
const { } = useFollowLists()

// Form state
const form = ref({
  title: '',
  description: '',
  image: '',
  members: []
})

// UI state
const searchQuery = ref('')
const isLoading = ref(false)
const error = ref('')
const currentStep = ref(1) // 1: Details, 2: Members, 3: Preview
const memberSearchQuery = ref('')

// Initialize form when list prop changes
watch(() => props.list, (list) => {
  if (list) {
    form.value = {
      title: list.title || '',
      description: list.description || '',
      image: list.image || '',
      members: [...(list.members || [])]
    }
  } else {
    form.value = {
      title: '',
      description: '',
      image: '',
      members: []
    }
  }
  currentStep.value = 1
  searchQuery.value = ''
  error.value = ''
}, { immediate: true })

// Computed properties
const isEditing = computed(() => !!props.list)

const isFormValid = computed(() => {
  return form.value.title.trim() && form.value.members.length > 0
})

const availableUsers = computed(() => {
  // Show users from following list that aren't already in the list
  return following.value.filter(pubkey => {
    if (form.value.members.includes(pubkey)) return false
    
    if (memberSearchQuery.value) {
      const profile = getProfile(pubkey)
      const query = memberSearchQuery.value.toLowerCase()
      return profile?.name?.toLowerCase().includes(query) ||
             profile?.about?.toLowerCase().includes(query) ||
             pubkey.toLowerCase().includes(query)
    }
    
    return true
  })
})

const selectedMembers = computed(() => {
  return form.value.members.map(pubkey => ({
    pubkey,
    profile: getProfile(pubkey)
  }))
})

// Get member display info
const getMemberDisplayName = (pubkey) => {
  const profile = getProfile(pubkey)
  return profile?.name || `user:${pubkey.substring(0, 8)}`
}

const getMemberAvatar = (pubkey) => {
  const profile = getProfile(pubkey)
  return profile?.picture || generateAvatar(pubkey)
}

// Add member to list
const addMember = (pubkey) => {
  if (!form.value.members.includes(pubkey)) {
    form.value.members.push(pubkey)
    
    // Fetch profile if we don't have it
    if (!getProfile(pubkey)) {
      fetchProfile(pubkey)
    }
  }
}

// Remove member from list
const removeMember = (pubkey) => {
  const index = form.value.members.indexOf(pubkey)
  if (index !== -1) {
    form.value.members.splice(index, 1)
  }
}

// Navigation
const nextStep = () => {
  if (currentStep.value === 1 && !form.value.title.trim()) {
    error.value = 'Title is required'
    return
  }
  
  if (currentStep.value === 2 && form.value.members.length === 0) {
    error.value = 'Add at least one member to the list'
    return
  }
  
  if (currentStep.value < 3) {
    currentStep.value++
    error.value = ''
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    error.value = ''
  }
}

// Save list
const saveList = async () => {
  if (!isFormValid.value) {
    error.value = 'Please fill in all required fields'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    // Emit save event - parent will handle the actual saving
    emit('save', props.list?.id, form.value)
    // Don't close immediately - let parent close on success
  } catch (err) {
    error.value = err.message || 'Failed to save list'
    isLoading.value = false
  }
}

</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
          <!-- Header -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center">
                  <IconList class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 class="text-xl font-bold text-gray-900">
                    {{ isEditing ? 'Edit Follow Pack' : 'Create Follow Pack' }}
                  </h3>
                  <p class="text-sm text-gray-600">Step {{ currentStep }} of 3</p>
                </div>
              </div>
              <button
                @click="emit('close')"
                class="w-8 h-8 bg-white/60 hover:bg-white/80 rounded-full flex items-center justify-center transition-colors text-gray-600"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>
            
            <!-- Progress Bar -->
            <div class="mt-4">
              <div class="w-full bg-orange-200 rounded-full h-2">
                <div 
                  class="bg-gradient-to-r from-orange-400 to-amber-400 h-2 rounded-full transition-all duration-500"
                  :style="{ width: `${(currentStep / 3) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="overflow-y-auto max-h-[calc(90vh-200px)]">
            <!-- Step 1: List Details -->
            <div v-if="currentStep === 1" class="p-6">
              <div class="space-y-6">
                <div class="text-center mb-6">
                  <h4 class="text-xl font-bold text-gray-900 mb-2">Pack Details</h4>
                  <p class="text-gray-600">Give your follow pack a name and description</p>
                </div>

                <!-- Title -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">
                    Pack Title <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="form.title"
                    type="text"
                    placeholder="e.g., Bitcoin Developers"
                    class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                    maxlength="50"
                  />
                  <div class="flex justify-between mt-1">
                    <p class="text-xs text-gray-500">Make it descriptive and clear</p>
                    <p class="text-xs text-gray-400">{{ form.title.length }}/50</p>
                  </div>
                </div>

                <!-- Description -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    v-model="form.description"
                    rows="3"
                    placeholder="Describe what this pack is about..."
                    class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base resize-none"
                    maxlength="600"
                  ></textarea>
                  <div class="flex justify-between mt-1">
                    <p class="text-xs text-gray-500">Help others understand the purpose</p>
                    <p class="text-xs text-gray-400">{{ form.description.length }}/600</p>
                  </div>
                </div>

                <!-- Image URL -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Cover Image (optional)</label>
                  <input
                    v-model="form.image"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                  />
                  <p class="text-xs text-gray-500 mt-1">URL to an image that represents this pack</p>
                  
                  <!-- Image Preview -->
                  <div v-if="form.image" class="mt-3 rounded-lg overflow-hidden border border-gray-200 h-24">
                    <img 
                      :src="form.image" 
                      class="w-full h-full object-cover"
                      @error="$event.target.style.display = 'none'"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2: Add Members -->
            <div v-if="currentStep === 2" class="p-6">
              <div class="text-center mb-6">
                <h4 class="text-xl font-bold text-gray-900 mb-2">Add Members</h4>
                <p class="text-gray-600">Choose who to include in this follow pack</p>
              </div>

              <!-- Search -->
              <div class="relative mb-6">
                <input
                  v-model="memberSearchQuery"
                  type="text"
                  placeholder="Search users..."
                  class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
                <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              </div>

              <!-- Selected Members -->
              <div v-if="selectedMembers.length > 0" class="mb-6">
                <h5 class="text-sm font-medium text-gray-700 mb-3">
                  Selected ({{ selectedMembers.length }})
                </h5>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="member in selectedMembers"
                    :key="member.pubkey"
                    class="flex items-center space-x-2 bg-orange-100 text-orange-800 px-3 py-2 rounded-full text-sm"
                  >
                    <img
                      :src="member.profile?.picture || generateAvatar(member.pubkey)"
                      :alt="member.profile?.name || 'User'"
                      class="w-4 h-4 rounded-full"
                    />
                    <span>{{ member.profile?.name || `user:${member.pubkey.substring(0, 8)}` }}</span>
                    <button
                      @click="removeMember(member.pubkey)"
                      class="text-orange-600 hover:text-orange-800"
                    >
                      <IconX class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Available Users -->
              <div>
                <h5 class="text-sm font-medium text-gray-700 mb-3">
                  Available Users ({{ availableUsers.length }})
                </h5>
                
                <div v-if="availableUsers.length === 0" class="text-center py-8">
                  <IconUser class="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p class="text-gray-600">
                    {{ memberSearchQuery ? 'No matching users found' : 'All users are already in the pack' }}
                  </p>
                </div>

                <div v-else class="space-y-2 max-h-64 overflow-y-auto">
                  <div
                    v-for="pubkey in availableUsers.slice(0, 20)"
                    :key="pubkey"
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div class="flex items-center space-x-3">
                      <img
                        :src="getProfile(pubkey)?.picture || generateAvatar(pubkey)"
                        :alt="getProfile(pubkey)?.name || 'User'"
                        class="w-8 h-8 rounded-full"
                      />
                      <div>
                        <p class="font-medium text-gray-900">
                          {{ getMemberDisplayName(pubkey) }}
                        </p>
                        <p v-if="getProfile(pubkey)?.about" class="text-xs text-gray-600 line-clamp-1">
                          {{ getProfile(pubkey).about }}
                        </p>
                      </div>
                    </div>
                    <button
                      @click="addMember(pubkey)"
                      class="btn-secondary text-sm"
                    >
                      <IconPlus class="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Preview -->
            <div v-if="currentStep === 3" class="p-6">
              <div class="text-center mb-6">
                <h4 class="text-xl font-bold text-gray-900 mb-2">Preview & Publish</h4>
                <p class="text-gray-600">Review your pack before publishing</p>
              </div>

              <!-- Pack Preview -->
              <div class="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 mb-6">
                <!-- Image Preview -->
                <div v-if="form.image" class="h-32 rounded-lg overflow-hidden mb-4">
                  <img 
                    :src="form.image" 
                    :alt="form.title"
                    class="w-full h-full object-cover"
                  />
                </div>

                <div class="flex items-center space-x-3 mb-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center">
                    <IconList class="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 class="text-xl font-bold text-gray-900">{{ form.title }}</h3>
                    <p class="text-sm text-gray-600">{{ form.members.length }} member{{ form.members.length !== 1 ? 's' : '' }}</p>
                  </div>
                </div>
                
                <p v-if="form.description" class="text-gray-700 mb-4">{{ form.description }}</p>
                
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                  <span class="flex items-center space-x-1">
                    <IconUsers class="w-4 h-4" />
                    <span>{{ form.members.length }} members</span>
                  </span>
                </div>
              </div>
            
              <!-- Member Preview -->
              <div v-if="form.members.length > 0" class="bg-white/60 rounded-lg p-4">
                <h4 class="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <IconUsers class="w-4 h-4" />
                  <span>Members Preview</span>
                </h4>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="pubkey in form.members.slice(0, 8)"
                    :key="pubkey"
                    class="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <img
                      :src="getMemberAvatar(pubkey)"
                      :alt="getMemberDisplayName(pubkey)"
                      class="w-6 h-6 rounded-full"
                    />
                    <span class="text-sm font-medium text-gray-900">
                      {{ getMemberDisplayName(pubkey) }}
                    </span>
                  </div>
                  <div v-if="form.members.length > 8" class="flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                    <span class="text-sm text-gray-600">+{{ form.members.length - 8 }} more</span>
                  </div>
                </div>
              </div>

              <!-- Publishing Info -->
              <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div class="flex items-start space-x-3">
                  <IconList class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="font-medium text-gray-900 text-sm">
                      Your follow pack will be published to the Nostr network where others can discover and use it.
                    </p>
                    <p class="text-xs text-gray-500 mt-1">
                      Packs are stored on the decentralized network and can be shared with others.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="px-6 pb-4">
            <div class="bg-red-50 border border-red-200 rounded-lg p-3">
              <div class="flex items-center space-x-2">
                <IconAlertCircle class="w-4 h-4 text-red-600" />
                <span class="text-sm text-red-600">{{ error }}</span>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="bg-gray-50 border-t border-gray-100 p-6">
            <div class="flex items-center justify-between">
              <!-- Back Button -->
              <button
                v-if="currentStep > 1"
                @click="prevStep"
                class="btn-secondary flex items-center space-x-2"
              >
                <IconArrowLeft class="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                v-else
                @click="emit('close')"
                class="btn-secondary"
              >
                Cancel
              </button>

              <!-- Next/Save Button -->
              <button
                v-if="currentStep < 3"
                @click="nextStep"
                class="btn-primary flex items-center space-x-2"
              >
                <span>{{ currentStep === 1 ? 'Add Members' : 'Preview' }}</span>
                <IconArrowRight class="w-4 h-4" />
              </button>
              <button
                v-else
                @click="saveList"
                :disabled="!isFormValid || isLoading"
                class="btn-primary disabled:opacity-50"
              >
                <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                <IconCheck v-else class="w-4 h-4" />
                <span>{{ isLoading ? 'Publishing...' : (isEditing ? 'Update Pack' : 'Publish Pack') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

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
</style>
