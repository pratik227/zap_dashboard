<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconUser,
  IconEdit,
  IconDeviceFloppy,
  IconX, 
  IconCheck, 
  IconAlertTriangle,
  IconLoader,
  IconKey,
  IconBolt,
  IconGlobe,
  IconPhoto,
  IconFileDescription,
  IconId
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'

const props = defineProps({
  isEditing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close-editor', 'profile-updated'])

const { currentUser, userProfile, refreshUserProfile } = useNostrAuth()

// Form state
const form = ref({
  name: '',
  display_name: '',
  about: '',
  picture: '',
  banner: '',
  website: '',
  lud16: '',
  nip05: ''
})

// UI state
const isLoading = ref(false)
const error = ref('')
const success = ref(false)
const previewImage = ref(null)
const previewBanner = ref(null)

// Initialize form with current profile data
const initializeForm = () => {
  if (userProfile.value) {
    form.value = {
      name: userProfile.value.name || '',
      display_name: userProfile.value.display_name || '',
      about: userProfile.value.about || '',
      picture: userProfile.value.picture || '',
      banner: userProfile.value.banner || '',
      website: userProfile.value.website || '',
      lud16: userProfile.value.lud16 || '',
      nip05: userProfile.value.nip05 || ''
    }
    
    // Set preview images
    previewImage.value = form.value.picture
    previewBanner.value = form.value.banner
  }
}

// Watch for profile changes
watch(() => userProfile.value, initializeForm, { immediate: true })

// Watch for image URL changes to update previews
watch(() => form.value.picture, (newUrl) => {
  previewImage.value = newUrl
})

watch(() => form.value.banner, (newUrl) => {
  previewBanner.value = newUrl
})

// Validate form
const validateForm = () => {
  if (!form.value.name.trim()) {
    error.value = 'Name is required'
    return false
  }
  
  // Validate Lightning Address format (if provided)
  if (form.value.lud16 && !form.value.lud16.includes('@')) {
    error.value = 'Lightning Address should be in the format username@domain.com'
    return false
  }
  
  // Validate website URL format (if provided)
  if (form.value.website) {
    try {
      new URL(form.value.website)
    } catch (e) {
      error.value = 'Website must be a valid URL (include https://)'
      return false
    }
  }
  
  // Validate image URLs
  if (form.value.picture) {
    try {
      new URL(form.value.picture)
    } catch (e) {
      error.value = 'Profile picture must be a valid URL'
      return false
    }
  }
  
  if (form.value.banner) {
    try {
      new URL(form.value.banner)
    } catch (e) {
      error.value = 'Banner must be a valid URL'
      return false
    }
  }
  
  return true
}

// Save profile
const saveProfile = async () => {
  if (!validateForm()) return
  
  isLoading.value = true
  error.value = ''
  success.value = false
  
  try {
    // Create profile content object
    const profileContent = {
      name: form.value.name.trim(),
      display_name: form.value.display_name.trim() || undefined,
      about: form.value.about.trim() || undefined,
      picture: form.value.picture.trim() || undefined,
      banner: form.value.banner.trim() || undefined,
      website: form.value.website.trim() || undefined,
      lud16: form.value.lud16.trim() || undefined,
      nip05: form.value.nip05.trim() || undefined
    }
    
    // Remove undefined fields
    Object.keys(profileContent).forEach(key => {
      if (profileContent[key] === undefined) {
        delete profileContent[key]
      }
    })
    
    // Create event template
    const eventTemplate = {
      kind: 0, // Profile metadata
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profileContent)
    }
    
    // Sign the event
    let signedEvent
    if (window.nostr?.signEvent) {
      signedEvent = await window.nostr.signEvent(eventTemplate)
    } else {
      throw new Error('Nostr extension not available for signing')
    }
    
    // Verify the signed event
    const isValid = verifyEvent(signedEvent)
    if (!isValid) {
      throw new Error('Event signature verification failed')
    }
    
    // Publish to relays
    const result = await nostrRelayManager.publishEvent(signedEvent)
    
    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays')
    }
    
    console.log('Profile updated successfully:', result)
    
    // Refresh profile data
    await refreshUserProfile()
    
    success.value = true
    setTimeout(() => {
      emit('profile-updated')
      emit('close-editor')
    }, 2000)
    
  } catch (err) {
    console.error('Failed to update profile:', err)
    error.value = `Failed to update profile: ${err.message}`
  } finally {
    isLoading.value = false
  }
}

// Reset form
const resetForm = () => {
  initializeForm()
  error.value = ''
  success.value = false
}

// Handle cancel
const handleCancel = () => {
  resetForm()
  emit('close-editor')
}

// Get avatar with fallback
const getAvatarUrl = computed(() => {
  return previewImage.value || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
})

// Get banner with fallback
const getBannerUrl = computed(() => {
  return previewBanner.value || 'https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
})

// Initialize form on component mount
initializeForm()
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Edit Profile</h3>
      <button
        @click="handleCancel"
        class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <IconX class="w-5 h-5" />
      </button>
    </div>
    
    <!-- Profile Preview -->
    <div class="relative">
      <!-- Banner -->
      <div class="h-32 sm:h-40 rounded-lg overflow-hidden bg-gradient-to-r from-purple-400 to-pink-400">
        <img 
          v-if="getBannerUrl" 
          :src="getBannerUrl" 
          alt="Banner" 
          class="w-full h-full object-cover"
          @error="previewBanner = null"
        />
      </div>
      
      <!-- Avatar -->
      <div class="absolute left-4 -bottom-12 w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
        <img 
          :src="getAvatarUrl" 
          :alt="form.name || 'User'" 
          class="w-full h-full object-cover"
          @error="previewImage = null"
        />
      </div>
    </div>
    
    <!-- Form -->
    <div class="mt-14 space-y-4">
      <!-- Basic Info Section -->
      <div class="space-y-4">
        <h4 class="font-medium text-gray-700 flex items-center space-x-2">
          <IconUser class="w-4 h-4 text-gray-500" />
          <span>Basic Information</span>
        </h4>
        
        <!-- Name (Required) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name <span class="text-red-500">*</span></label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Your name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">Required - This is your primary display name</p>
        </div>
        
        <!-- Display Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <input
            v-model="form.display_name"
            type="text"
            placeholder="Your display name"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">Optional - Alternative display name</p>
        </div>
        
        <!-- About -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">About</label>
          <textarea
            v-model="form.about"
            rows="3"
            placeholder="Tell us about yourself"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">Optional - Your bio or description</p>
        </div>
      </div>
      
      <!-- Images Section -->
      <div class="space-y-4 pt-4 border-t border-gray-200">
        <h4 class="font-medium text-gray-700 flex items-center space-x-2">
          <IconPhoto class="w-4 h-4 text-gray-500" />
          <span>Profile Images</span>
        </h4>
        
        <!-- Profile Picture -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
          <input
            v-model="form.picture"
            type="url"
            placeholder="https://example.com/your-image.jpg"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">Optional - URL to your profile picture</p>
        </div>
        
        <!-- Banner -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Banner URL</label>
          <input
            v-model="form.banner"
            type="url"
            placeholder="https://example.com/your-banner.jpg"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">Optional - URL to your profile banner</p>
        </div>
      </div>
      
      <!-- Contact & Verification Section -->
      <div class="space-y-4 pt-4 border-t border-gray-200">
        <h4 class="font-medium text-gray-700 flex items-center space-x-2">
          <IconGlobe class="w-4 h-4 text-gray-500" />
          <span>Contact & Verification</span>
        </h4>
        
        <!-- Website -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input
            v-model="form.website"
            type="url"
            placeholder="https://yourwebsite.com"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
          />
          <p class="text-xs text-gray-500 mt-1">Optional - Your personal website</p>
        </div>
        
        <!-- Lightning Address -->
        <div>
          <label class="flex items-center space-x-2 text-sm font-medium text-orange-600 mb-1">
            <IconBolt class="w-4 h-4" />
            <span>Lightning Address</span>
            <span class="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">Important for Zaps</span>
          </label>
          <div class="relative group">
            <input
              v-model="form.lud16"
              type="text"
              placeholder="you@domain.com"
              class="w-full pl-9 pr-3 py-2 border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-500 text-sm bg-orange-50 transition-all duration-200 group-hover:border-orange-400"
            />
            <IconBolt class="absolute left-3 top-2.5 w-4 h-4 text-orange-500" />
          </div>
          <p class="text-xs text-orange-600 font-medium mt-1">Required for receiving zaps in ZapTracker</p>
          <p class="text-xs text-gray-600 mt-0.5">Format: your-name@lightning-provider.com (e.g., you@getalby.com)</p>
        </div>
        
        <!-- NIP-05 Verification -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">NIP-05 Identifier</label>
          <div class="relative">
            <input
              v-model="form.nip05"
              type="text"
              placeholder="you@domain.com"
              class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
            />
            <IconId class="absolute left-3 top-2.5 w-4 h-4 text-green-500" />
          </div>
          <p class="text-xs text-gray-500 mt-1">Optional - Your NIP-05 verification identifier</p>
        </div>
      </div>
      
      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
        <div class="flex items-center space-x-2">
          <IconAlertTriangle class="w-4 h-4 text-red-600" />
          <span class="text-sm text-red-600">{{ error }}</span>
        </div>
      </div>
      
      <!-- Success Message -->
      <div v-if="success" class="bg-green-50 border border-green-200 rounded-lg p-3">
        <div class="flex items-center space-x-2">
          <IconCheck class="w-4 h-4 text-green-600" />
          <span class="text-sm text-green-600">Profile updated successfully!</span>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex justify-end space-x-3 pt-4">
        <button
          @click="handleCancel" 
          class="p-2 sm:px-4 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2 min-w-[40px] sm:min-w-[80px]"
          title="Cancel"
        >
          <IconX class="w-4 h-4" />
          <span class="hidden sm:inline">Cancel</span>
        </button>
        <button
          @click="saveProfile"
          :disabled="isLoading"
          class="p-2 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors flex items-center justify-center sm:justify-start space-x-1 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[40px] sm:min-w-[120px]"
          title="Save Profile"
        >
          <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
          <IconDeviceFloppy v-else class="w-4 h-4" />
          <span class="hidden sm:inline">Save Profile</span>
        </button>
      </div>
    </div>
  </div>
</template>