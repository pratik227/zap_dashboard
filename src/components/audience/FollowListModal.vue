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
  IconArrowLeft,
  IconSparkles
} from '@iconify-prerendered/vue-tabler'
import { useAudience } from '../../composables/audience/useAudience.js'
import { useFollowLists } from '../../composables/audience/useFollowLists.js'
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
const currentStep = ref(1)
const memberSearchQuery = ref('')
const startY = ref(0)
const currentY = ref(0)
const isDragging = ref(false)

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
    emit('close')
  }
  currentY.value = 0
  isDragging.value = false
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
    emit('save', props.list?.id, form.value)
  } catch (err) {
    error.value = err.message || 'Failed to save list'
    isLoading.value = false
  }
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show" class="modal-overlay fixed inset-0 z-[9999] md:flex md:items-center md:justify-center md:p-4">
        <!-- Desktop: Centered Modal -->
        <div class="hidden md:block bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-300">
          <!-- Header -->
          <div class="relative bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 px-8 py-6">
            <button
              @click="emit('close')"
              class="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-md hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 text-white hover:scale-110 shadow-lg"
              aria-label="Close"
            >
              <IconX class="w-5 h-5" />
            </button>

            <div class="flex items-center gap-4">
              <div class="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg">
                <IconList class="w-7 h-7 text-white" />
              </div>
              <div class="text-white">
                <h3 class="text-2xl font-bold mb-1">
                  {{ isEditing ? 'Edit Follow Pack' : 'Create Follow Pack' }}
                </h3>
                <p class="text-sm text-white/80">Step {{ currentStep }} of 3</p>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4">
              <div class="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div
                  class="bg-white h-full rounded-full transition-all duration-500 shadow-lg"
                  :style="{ width: `${(currentStep / 3) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="overflow-y-auto max-h-[calc(90vh-220px)] px-8 py-6">
            <!-- Step 1: Pack Details -->
            <div v-if="currentStep === 1" class="space-y-6">
              <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconSparkles class="w-8 h-8 text-orange-500" />
                </div>
                <h4 class="text-xl font-bold text-gray-900 mb-2">Pack Details</h4>
                <p class="text-gray-600">Give your follow pack a name and description</p>
              </div>

              <!-- Title -->
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">
                  Pack Title <span class="text-orange-500">*</span>
                </label>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="e.g., Bitcoin Developers"
                  class="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-base"
                  maxlength="50"
                />
                <div class="flex justify-between mt-1.5">
                  <p class="text-xs text-gray-500">Make it descriptive and clear</p>
                  <p class="text-xs text-gray-400">{{ form.title.length }}/50</p>
                </div>
              </div>

              <!-- Description -->
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  v-model="form.description"
                  rows="3"
                  placeholder="Describe what this pack is about..."
                  class="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-base resize-none"
                  maxlength="600"
                ></textarea>
                <div class="flex justify-between mt-1.5">
                  <p class="text-xs text-gray-500">Help others understand the purpose</p>
                  <p class="text-xs text-gray-400">{{ form.description.length }}/600</p>
                </div>
              </div>

              <!-- Image URL -->
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">
                  <span class="flex items-center gap-2">
                    <IconPhoto class="w-4 h-4" />
                    Cover Image (optional)
                  </span>
                </label>
                <input
                  v-model="form.image"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  class="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-base"
                />
                <p class="text-xs text-gray-500 mt-1.5">URL to an image that represents this pack</p>

                <!-- Image Preview -->
                <div v-if="form.image" class="mt-3 rounded-xl overflow-hidden border-2 border-gray-100 h-32">
                  <img
                    :src="form.image"
                    class="w-full h-full object-cover"
                    @error="$event.target.style.display = 'none'"
                  />
                </div>
              </div>
            </div>

            <!-- Step 2: Add Members -->
            <div v-if="currentStep === 2" class="space-y-6">
              <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconUserPlus class="w-8 h-8 text-orange-500" />
                </div>
                <h4 class="text-xl font-bold text-gray-900 mb-2">Add Members</h4>
                <p class="text-gray-600">Choose who to include in this follow pack</p>
              </div>

              <!-- Search -->
              <div class="relative">
                <input
                  v-model="memberSearchQuery"
                  type="text"
                  placeholder="Search users..."
                  class="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all text-base"
                />
                <IconSearch class="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
              </div>

              <!-- Selected Members -->
              <div v-if="selectedMembers.length > 0">
                <div class="flex items-center justify-between mb-3">
                  <h5 class="text-sm font-semibold text-gray-700">
                    Selected ({{ selectedMembers.length }})
                  </h5>
                  <button
                    @click="form.members = []"
                    class="text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Clear all
                  </button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="member in selectedMembers"
                    :key="member.pubkey"
                    class="flex items-center gap-2 bg-orange-50 text-orange-800 pl-1 pr-3 py-1.5 rounded-full text-sm border border-orange-200"
                  >
                    <img
                      :src="member.profile?.picture || generateAvatar(member.pubkey)"
                      :alt="member.profile?.name || 'User'"
                      class="w-6 h-6 rounded-full"
                    />
                    <span class="font-medium">{{ member.profile?.name || `user:${member.pubkey.substring(0, 8)}` }}</span>
                    <button
                      @click="removeMember(member.pubkey)"
                      class="text-orange-600 hover:text-orange-800 p-0.5"
                    >
                      <IconX class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Available Users -->
              <div>
                <h5 class="text-sm font-semibold text-gray-700 mb-3">
                  Available Users ({{ availableUsers.length }})
                </h5>

                <div v-if="availableUsers.length === 0" class="text-center py-12">
                  <div class="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <IconUser class="w-7 h-7 text-gray-400" />
                  </div>
                  <p class="text-gray-600 text-sm">
                    {{ memberSearchQuery ? 'No matching users found' : 'All users are already in the pack' }}
                  </p>
                </div>

                <div v-else class="space-y-2 max-h-80 overflow-y-auto pr-2">
                  <div
                    v-for="pubkey in availableUsers.slice(0, 20)"
                    :key="pubkey"
                    class="flex items-center justify-between p-3 bg-white hover:bg-gray-50 rounded-2xl border border-gray-100 transition-all duration-200"
                  >
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <img
                        :src="getProfile(pubkey)?.picture || generateAvatar(pubkey)"
                        :alt="getProfile(pubkey)?.name || 'User'"
                        class="w-10 h-10 rounded-xl flex-shrink-0"
                      />
                      <div class="min-w-0">
                        <p class="font-semibold text-gray-900 truncate text-sm">
                          {{ getMemberDisplayName(pubkey) }}
                        </p>
                        <p v-if="getProfile(pubkey)?.about" class="text-xs text-gray-600 line-clamp-1">
                          {{ getProfile(pubkey).about }}
                        </p>
                      </div>
                    </div>
                    <button
                      @click="addMember(pubkey)"
                      class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 flex-shrink-0 ml-2"
                    >
                      <IconPlus class="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Preview -->
            <div v-if="currentStep === 3" class="space-y-6">
              <div class="text-center mb-6">
                <div class="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconCheck class="w-8 h-8 text-orange-500" />
                </div>
                <h4 class="text-xl font-bold text-gray-900 mb-2">Preview & Publish</h4>
                <p class="text-gray-600">Review your pack before publishing</p>
              </div>

              <!-- Pack Preview Card -->
              <div class="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6">
                <!-- Image Preview -->
                <div v-if="form.image" class="h-32 rounded-xl overflow-hidden mb-4 border-2 border-white shadow-sm">
                  <img
                    :src="form.image"
                    :alt="form.title"
                    class="w-full h-full object-cover"
                  />
                </div>

                <div class="flex items-center gap-3 mb-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center shadow-sm">
                    <IconList class="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 class="text-xl font-bold text-gray-900">{{ form.title }}</h3>
                    <p class="text-sm text-gray-600">{{ form.members.length }} member{{ form.members.length !== 1 ? 's' : '' }}</p>
                  </div>
                </div>

                <p v-if="form.description" class="text-gray-700 mb-4 text-sm">{{ form.description }}</p>

                <div class="flex items-center gap-2 text-sm text-gray-600">
                  <IconUsers class="w-4 h-4" />
                  <span>{{ form.members.length }} members included</span>
                </div>
              </div>

              <!-- Member Preview -->
              <div class="bg-white border-2 border-gray-100 rounded-2xl p-5">
                <h4 class="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <IconUsers class="w-4 h-4" />
                  <span>Members Preview</span>
                </h4>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="pubkey in form.members.slice(0, 8)"
                    :key="pubkey"
                    class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2"
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
                  <div v-if="form.members.length > 8" class="flex items-center justify-center bg-gray-100 border border-gray-200 rounded-xl px-3 py-2">
                    <span class="text-sm text-gray-600">+{{ form.members.length - 8 }} more</span>
                  </div>
                </div>
              </div>

              <!-- Info Banner -->
              <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <div class="flex gap-3">
                  <IconList class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="font-medium text-gray-900 text-sm mb-1">
                      Your follow pack will be published to the Nostr network
                    </p>
                    <p class="text-xs text-gray-600">
                      Others can discover and use your pack to expand their network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="px-8 pb-4">
            <div class="bg-red-50 border-2 border-red-200 rounded-xl p-3">
              <div class="flex items-center gap-2">
                <IconAlertCircle class="w-4 h-4 text-red-600" />
                <span class="text-sm text-red-600 font-medium">{{ error }}</span>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="bg-gray-50 border-t border-gray-100 px-8 py-5">
            <div class="flex items-center justify-between gap-4">
              <!-- Back/Cancel Button -->
              <button
                v-if="currentStep > 1"
                @click="prevStep"
                class="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border border-gray-200"
              >
                <IconArrowLeft class="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                v-else
                @click="emit('close')"
                class="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-semibold transition-all duration-200 border border-gray-200"
              >
                Cancel
              </button>

              <!-- Next/Save Button -->
              <button
                v-if="currentStep < 3"
                @click="nextStep"
                class="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm"
              >
                <span>{{ currentStep === 1 ? 'Add Members' : 'Preview' }}</span>
                <IconArrowRight class="w-4 h-4" />
              </button>
              <button
                v-else
                @click="saveList"
                :disabled="!isFormValid || isLoading"
                class="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                <IconCheck v-else class="w-4 h-4" />
                <span>{{ isLoading ? 'Publishing...' : (isEditing ? 'Update Pack' : 'Publish Pack') }}</span>
              </button>
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
          <div class="relative bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 px-4 py-5 flex-shrink-0">
            <button
              @click="emit('close')"
              class="absolute top-3 right-3 w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white"
            >
              <IconX class="w-4 h-4" />
            </button>

            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                <IconList class="w-6 h-6 text-white" />
              </div>
              <div class="text-white">
                <h3 class="text-xl font-bold mb-0.5">
                  {{ isEditing ? 'Edit Pack' : 'Create Pack' }}
                </h3>
                <p class="text-xs text-white/80">Step {{ currentStep }} of 3</p>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="mt-4">
              <div class="w-full bg-white/20 rounded-full h-1 overflow-hidden">
                <div
                  class="bg-white h-full rounded-full transition-all duration-500"
                  :style="{ width: `${(currentStep / 3) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto px-4 py-6">
            <!-- Step 1: Pack Details -->
            <div v-if="currentStep === 1" class="space-y-5">
              <div class="text-center mb-5">
                <div class="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconSparkles class="w-7 h-7 text-orange-500" />
                </div>
                <h4 class="text-lg font-bold text-gray-900 mb-1">Pack Details</h4>
                <p class="text-sm text-gray-600">Name and describe your pack</p>
              </div>

              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">
                  Title <span class="text-orange-500">*</span>
                </label>
                <input
                  v-model="form.title"
                  type="text"
                  placeholder="e.g., Bitcoin Developers"
                  class="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-orange-400 text-base"
                  maxlength="50"
                />
                <div class="flex justify-between mt-1.5">
                  <p class="text-xs text-gray-500">Make it clear</p>
                  <p class="text-xs text-gray-400">{{ form.title.length }}/50</p>
                </div>
              </div>

              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  v-model="form.description"
                  rows="3"
                  placeholder="What is this pack about..."
                  class="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-orange-400 text-base resize-none"
                  maxlength="600"
                ></textarea>
                <div class="flex justify-between mt-1.5">
                  <p class="text-xs text-gray-500">Help others understand</p>
                  <p class="text-xs text-gray-400">{{ form.description.length }}/600</p>
                </div>
              </div>

              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-2">
                  Cover Image (optional)
                </label>
                <input
                  v-model="form.image"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  class="w-full px-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-orange-400 text-base"
                />
                <div v-if="form.image" class="mt-3 rounded-2xl overflow-hidden border-2 border-gray-100 h-28">
                  <img :src="form.image" class="w-full h-full object-cover" @error="$event.target.style.display = 'none'" />
                </div>
              </div>
            </div>

            <!-- Step 2: Add Members -->
            <div v-if="currentStep === 2" class="space-y-5">
              <div class="text-center mb-5">
                <div class="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconUserPlus class="w-7 h-7 text-orange-500" />
                </div>
                <h4 class="text-lg font-bold text-gray-900 mb-1">Add Members</h4>
                <p class="text-sm text-gray-600">Choose who to include</p>
              </div>

              <div class="relative">
                <input
                  v-model="memberSearchQuery"
                  type="text"
                  placeholder="Search..."
                  class="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-orange-400 text-base"
                />
                <IconSearch class="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
              </div>

              <div v-if="selectedMembers.length > 0">
                <div class="flex items-center justify-between mb-2">
                  <h5 class="text-sm font-semibold text-gray-700">
                    Selected ({{ selectedMembers.length }})
                  </h5>
                  <button @click="form.members = []" class="text-xs text-orange-600 font-medium">
                    Clear
                  </button>
                </div>
                <div class="flex flex-wrap gap-2">
                  <div
                    v-for="member in selectedMembers"
                    :key="member.pubkey"
                    class="flex items-center gap-1.5 bg-orange-50 text-orange-800 pl-1 pr-2 py-1 rounded-full text-xs border border-orange-200"
                  >
                    <img
                      :src="member.profile?.picture || generateAvatar(member.pubkey)"
                      class="w-5 h-5 rounded-full"
                    />
                    <span class="font-medium">{{ member.profile?.name || `user:${member.pubkey.substring(0, 8)}` }}</span>
                    <button @click="removeMember(member.pubkey)" class="text-orange-600">
                      <IconX class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h5 class="text-sm font-semibold text-gray-700 mb-2">
                  Available ({{ availableUsers.length }})
                </h5>

                <div v-if="availableUsers.length === 0" class="text-center py-10">
                  <div class="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <IconUser class="w-6 h-6 text-gray-400" />
                  </div>
                  <p class="text-sm text-gray-600">
                    {{ memberSearchQuery ? 'No matches' : 'All added' }}
                  </p>
                </div>

                <div v-else class="space-y-2 max-h-64 overflow-y-auto">
                  <div
                    v-for="pubkey in availableUsers.slice(0, 20)"
                    :key="pubkey"
                    class="flex items-center justify-between p-2.5 bg-gray-50 rounded-2xl"
                  >
                    <div class="flex items-center gap-2.5 flex-1 min-w-0">
                      <img
                        :src="getProfile(pubkey)?.picture || generateAvatar(pubkey)"
                        class="w-9 h-9 rounded-xl flex-shrink-0"
                      />
                      <div class="min-w-0">
                        <p class="font-semibold text-gray-900 truncate text-sm">
                          {{ getMemberDisplayName(pubkey) }}
                        </p>
                        <p v-if="getProfile(pubkey)?.about" class="text-xs text-gray-600 line-clamp-1">
                          {{ getProfile(pubkey).about }}
                        </p>
                      </div>
                    </div>
                    <button
                      @click="addMember(pubkey)"
                      class="px-2.5 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium flex-shrink-0"
                    >
                      <IconPlus class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Preview -->
            <div v-if="currentStep === 3" class="space-y-5">
              <div class="text-center mb-5">
                <div class="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <IconCheck class="w-7 h-7 text-orange-500" />
                </div>
                <h4 class="text-lg font-bold text-gray-900 mb-1">Ready to Publish</h4>
                <p class="text-sm text-gray-600">Review before publishing</p>
              </div>

              <div class="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-4">
                <div v-if="form.image" class="h-24 rounded-xl overflow-hidden mb-3 border-2 border-white">
                  <img :src="form.image" class="w-full h-full object-cover" />
                </div>

                <div class="flex items-center gap-2.5 mb-3">
                  <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center">
                    <IconList class="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 class="text-lg font-bold text-gray-900">{{ form.title }}</h3>
                    <p class="text-xs text-gray-600">{{ form.members.length }} members</p>
                  </div>
                </div>

                <p v-if="form.description" class="text-sm text-gray-700">{{ form.description }}</p>
              </div>

              <div class="bg-white border-2 border-gray-100 rounded-2xl p-4">
                <h4 class="font-semibold text-gray-900 mb-2.5 flex items-center gap-2 text-sm">
                  <IconUsers class="w-4 h-4" />
                  <span>Members</span>
                </h4>
                <div class="flex flex-wrap gap-1.5">
                  <div
                    v-for="pubkey in form.members.slice(0, 6)"
                    :key="pubkey"
                    class="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5"
                  >
                    <img :src="getMemberAvatar(pubkey)" class="w-5 h-5 rounded-full" />
                    <span class="text-xs font-medium text-gray-900">
                      {{ getMemberDisplayName(pubkey) }}
                    </span>
                  </div>
                  <div v-if="form.members.length > 6" class="flex items-center bg-gray-100 rounded-xl px-2 py-1.5">
                    <span class="text-xs text-gray-600">+{{ form.members.length - 6 }}</span>
                  </div>
                </div>
              </div>

              <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3">
                <div class="flex gap-2.5">
                  <IconList class="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p class="font-medium text-gray-900 text-xs mb-0.5">
                      Publishing to Nostr network
                    </p>
                    <p class="text-xs text-gray-600">
                      Others can discover and use your pack
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="px-4 pb-4">
            <div class="bg-red-50 border-2 border-red-200 rounded-2xl p-3">
              <div class="flex items-center gap-2">
                <IconAlertCircle class="w-4 h-4 text-red-600" />
                <span class="text-xs text-red-600 font-medium">{{ error }}</span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="bg-gray-50 border-t border-gray-200 px-4 py-4 flex-shrink-0">
            <div class="flex items-center justify-between gap-3">
              <button
                v-if="currentStep > 1"
                @click="prevStep"
                class="px-4 py-2.5 bg-white text-gray-700 rounded-2xl font-semibold text-sm border-2 border-gray-200 flex items-center gap-1.5"
              >
                <IconArrowLeft class="w-4 h-4" />
                Back
              </button>
              <button
                v-else
                @click="emit('close')"
                class="px-4 py-2.5 bg-white text-gray-700 rounded-2xl font-semibold text-sm border-2 border-gray-200"
              >
                Cancel
              </button>

              <button
                v-if="currentStep < 3"
                @click="nextStep"
                class="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                {{ currentStep === 1 ? 'Add Members' : 'Preview' }}
                <IconArrowRight class="w-4 h-4" />
              </button>
              <button
                v-else
                @click="saveList"
                :disabled="!isFormValid || isLoading"
                class="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                <IconCheck v-else class="w-4 h-4" />
                {{ isLoading ? 'Publishing...' : (isEditing ? 'Update' : 'Publish') }}
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

/* Focus states */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile touch targets */
@media (max-width: 640px) {
  button {
    min-height: 44px;
    font-size: 16px;
  }
}
</style>
