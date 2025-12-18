<template>
  <!-- Modal Overlay with Apple-inspired backdrop -->
  <Teleport to="#modal-root">
    <transition name="modal-fade" appear>
      <div
        v-if="show"
        class="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-md"
        @click="handleBackdropClick"
        @keydown.escape="handleCancel"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
      >
        <!-- Modal Container -->
        <div
          ref="modalRef"
          class="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300"
          @click.stop
        >
          <!-- Header with ZapTracker Branding -->
          <div class="relative bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 px-5 sm:px-6 py-5 sm:py-6">
            <!-- Subtle pattern overlay -->
            <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
            
            <div class="relative flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <IconUser class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 id="profile-editor-title" class="text-xl font-bold text-white">
                    Edit Profile
                  </h1>
                  <p class="text-white/80 text-sm">Update your Nostr identity</p>
                </div>
              </div>
              
              <!-- Close Button -->
              <button
                @click="handleCancel"
                class="w-10 h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors touch-target"
                aria-label="Close profile editor"
              >
                <IconX class="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          <!-- Scrollable Content -->
          <div class="overflow-y-auto max-h-[calc(90vh-220px)] sm:max-h-[calc(90vh-180px)] scrollbar-thin">
            <!-- Form Content -->
            <div class="p-5 sm:p-6 space-y-6">

              <!-- Lightning Address - Priority Section -->
              <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                <div class="flex items-start space-x-3 mb-3">
                  <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                    <IconBolt class="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-orange-900">Lightning Address</h3>
                    <p class="text-sm text-orange-700">Required to receive zaps</p>
                  </div>
                </div>
                
                <div class="space-y-2">
                  <input
                    v-model="form.lud16"
                    type="text"
                    placeholder="you@getalby.com"
                    class="w-full px-4 py-3 bg-white border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base font-medium touch-target"
                    :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.lud16 }"
                    aria-describedby="lud16-help"
                  />
                  <p id="lud16-help" class="text-xs text-orange-700">
                    {{ fieldErrors.lud16 || 'This enables Lightning payments to your profile' }}
                  </p>
                </div>
              </div>

              <!-- Basic Information -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <IconUser class="w-5 h-5 text-orange-500" />
                  <span>Basic Information</span>
                </h3>
                
                <div class="bg-gray-50 rounded-xl p-4 space-y-4">
                  <!-- Name Field -->
                  <div class="space-y-2">
                    <label for="name-input" class="block text-sm font-medium text-gray-700">
                      Display Name <span class="text-red-500">*</span>
                    </label>
                    <input
                      id="name-input"
                      v-model="form.name"
                      type="text"
                      placeholder="Enter your display name"
                      maxlength="50"
                      required
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base touch-target"
                      :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.name }"
                      aria-describedby="name-help"
                    />
                    <div class="flex justify-between items-center">
                      <p id="name-help" class="text-xs text-red-600">{{ fieldErrors.name }}</p>
                      <span class="text-xs text-gray-500">{{ form.name.length }}/50</span>
                    </div>
                  </div>
                  
                  <!-- Display Name Field -->
                  <div class="space-y-2">
                    <label for="display-name-input" class="block text-sm font-medium text-gray-700">
                      Alternative Display Name
                    </label>
                    <input
                      id="display-name-input"
                      v-model="form.display_name"
                      type="text"
                      placeholder="Optional alternative name"
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base touch-target"
                    />
                    <p class="text-xs text-gray-500">Shown as subtitle under your main name</p>
                  </div>
                  
                  <!-- About Field -->
                  <div class="space-y-2">
                    <label for="about-input" class="block text-sm font-medium text-gray-700">
                      About
                    </label>
                    <textarea
                      id="about-input"
                      v-model="form.about"
                      rows="3"
                      placeholder="Tell people about yourself..."
                      maxlength="500"
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 resize-none text-base touch-target"
                      :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.about }"
                      aria-describedby="about-help"
                    ></textarea>
                    <div class="flex justify-between items-center">
                      <p id="about-help" class="text-xs text-red-600">{{ fieldErrors.about }}</p>
                      <span class="text-xs text-gray-500">{{ form.about.length }}/500</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Visual Identity -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <IconPhoto class="w-5 h-5 text-purple-500" />
                  <span>Visual Identity</span>
                </h3>
                
                <div class="bg-gray-50 rounded-xl p-4 space-y-4">
                  <!-- Profile Picture -->
                  <div class="space-y-2">
                    <label for="picture-input" class="block text-sm font-medium text-gray-700">
                      Profile Picture URL
                    </label>
                    <input
                      id="picture-input"
                      v-model="form.picture"
                      type="url"
                      placeholder="https://example.com/your-avatar.jpg"
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base touch-target"
                      :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.picture }"
                      aria-describedby="picture-help"
                    />
                    <p id="picture-help" class="text-xs text-gray-500">
                      {{ fieldErrors.picture || 'Square image recommended, at least 400x400px' }}
                    </p>
                  </div>
                  
                  <!-- Banner -->
                  <div class="space-y-2">
                    <label for="banner-input" class="block text-sm font-medium text-gray-700">
                      Banner URL
                    </label>
                    <input
                      id="banner-input"
                      v-model="form.banner"
                      type="url"
                      placeholder="https://example.com/your-banner.jpg"
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base touch-target"
                      :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.banner }"
                      aria-describedby="banner-help"
                    />
                    <p id="banner-help" class="text-xs text-gray-500">
                      {{ fieldErrors.banner || '1200x400px recommended for best results' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Additional Information -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <IconShield class="w-5 h-5 text-blue-500" />
                  <span>Verification & Links</span>
                </h3>
                
                <div class="bg-gray-50 rounded-xl p-4 space-y-4">
                  <!-- NIP-05 -->
                  <div class="space-y-2">
                    <label for="nip05-input" class="block text-sm font-medium text-gray-700">
                      NIP-05 Verification
                    </label>
                    <input
                      id="nip05-input"
                      v-model="form.nip05"
                      type="text"
                      placeholder="you@domain.com"
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base touch-target"
                      :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.nip05 }"
                      aria-describedby="nip05-help"
                    />
                    <p id="nip05-help" class="text-xs text-gray-500">
                      {{ fieldErrors.nip05 || 'Verifies your identity on the Nostr network' }}
                    </p>
                  </div>
                  
                  <!-- Website -->
                  <div class="space-y-2">
                    <label for="website-input" class="block text-sm font-medium text-gray-700">
                      Website
                    </label>
                    <input
                      id="website-input"
                      v-model="form.website"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      class="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-base touch-target"
                      :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': fieldErrors.website }"
                      aria-describedby="website-help"
                    />
                    <p id="website-help" class="text-xs text-gray-500">
                      {{ fieldErrors.website || 'Your personal or professional website' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Status Messages -->
              <transition name="slide-in">
                <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <IconAlertTriangle class="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <h4 class="font-medium text-red-900">Validation Error</h4>
                      <p class="text-sm text-red-700 mt-1">{{ error }}</p>
                    </div>
                  </div>
                </div>
              </transition>

              <transition name="slide-in">
                <div v-if="success" class="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <IconCheck class="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <h4 class="font-medium text-green-900">Profile Updated!</h4>
                      <p class="text-sm text-green-700 mt-1">Your changes have been published to the Nostr network</p>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <!-- Fixed Footer with Action Buttons -->
          <div class="sticky bottom-0 bg-white border-t border-gray-200 px-5 sm:px-6 py-4">
            <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <!-- Cancel Button -->
              <button
                @click="handleCancel"
                class="w-full sm:w-auto px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors rounded-xl touch-target flex items-center justify-center"
                :disabled="isLoading"
              >
                Cancel
              </button>

              <!-- Update Button -->
              <button
                @click="saveProfile"
                :disabled="isLoading || !isFormValid"
                class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg touch-target"
              >
                <IconLoader v-if="isLoading" class="w-5 h-5 animate-spin" />
                <IconDeviceFloppy v-else class="w-5 h-5" />
                <span>{{ isLoading ? 'Updating...' : 'Update Profile' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
  IconUser,
  IconDeviceFloppy,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconLoader,
  IconBolt,
  IconGlobe,
  IconPhoto,
  IconShield
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'

// Props
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['close-editor', 'profile-updated'])

// Composables
const { currentUser, userProfile, refreshUserProfile } = useNostrAuth()

// Refs
const modalRef = ref(null)

// Form state with proper initialization
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

// Field-specific error tracking
const fieldErrors = ref({
  name: '',
  about: '',
  lud16: '',
  nip05: '',
  website: '',
  picture: '',
  banner: ''
})

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
  }
  
  // Clear all errors when initializing
  Object.keys(fieldErrors.value).forEach(key => {
    fieldErrors.value[key] = ''
  })
  error.value = ''
  success.value = false
}

// Watch for profile changes and modal show state
watch(() => userProfile.value, initializeForm, { immediate: true })
watch(() => props.show, (newShow) => {
  console.log('NostrProfileEditor show prop changed:', newShow);
  if (newShow) {
    initializeForm();
    nextTick(() => {
      // Focus management for accessibility
      if (modalRef.value) {
        modalRef.value.focus();
      }
    });
  }
}, { immediate: true }); // Added immediate: true to watch for initial show state

// Real-time field validation
const validateField = (fieldName, value) => {
  switch (fieldName) {
    case 'name':
      if (!value.trim()) return 'Name is required';
      if (value.trim().length > 50) return 'Name must be 50 characters or less';
      return '';
      
    case 'about':
      if (value.length > 500) return 'About section must be 500 characters or less';
      return '';
      
    case 'lud16':
      if (value && value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return 'Must be in format username@domain.com';
        }
      }
      return '';
      
    case 'nip05':
      if (value && value.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return 'Must be in format username@domain.com';
        }
      }
      return '';
      
    case 'website':
    case 'picture':
    case 'banner':
      if (value && value.trim()) {
        if (!value.trim().startsWith('http://') && !value.trim().startsWith('https://')) {
          return 'Must start with http:// or https://';
        }
        try {
          new URL(value.trim());
        } catch (e) {
          return 'Must be a valid URL';
        }
      }
      return '';
      
    default:
      return '';
  }
};

// Watch form fields for real-time validation
watch(() => form.value.name, (newValue) => {
  fieldErrors.value.name = validateField('name', newValue);
});

watch(() => form.value.about, (newValue) => {
  fieldErrors.value.about = validateField('about', newValue);
});

watch(() => form.value.lud16, (newValue) => {
  fieldErrors.value.lud16 = validateField('lud16', newValue);
});

watch(() => form.value.nip05, (newValue) => {
  fieldErrors.value.nip05 = validateField('nip05', newValue);
});

watch(() => form.value.website, (newValue) => {
  fieldErrors.value.website = validateField('website', newValue);
});

watch(() => form.value.picture, (newValue) => {
  fieldErrors.value.picture = validateField('picture', newValue);
});

watch(() => form.value.banner, (newValue) => {
  fieldErrors.value.banner = validateField('banner', newValue);
});

// Form validation
const isFormValid = computed(() => {
  // Check if name is provided and no field errors exist
  const hasName = form.value.name.trim().length > 0;
  const hasErrors = Object.values(fieldErrors.value).some(error => error !== '');
  return hasName && !hasErrors;
});

// Save profile to Nostr network
const saveProfile = async () => {
  // Final validation before saving
  if (!isFormValid.value) {
    error.value = 'Please fix the validation errors before saving';
    return;
  }
  
  isLoading.value = true;
  error.value = '';
  success.value = false;
  
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
    };
    
    // Remove undefined fields
    Object.keys(profileContent).forEach(key => {
      if (profileContent[key] === undefined) {
        delete profileContent[key];
      }
    });
    
    // Create event template
    const eventTemplate = {
      kind: 0, // Profile metadata
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profileContent)
    };
    
    // Sign the event
    if (!window.nostr?.signEvent) {
      throw new Error('Nostr extension not available for signing');
    }
    
    const signedEvent = await window.nostr.signEvent(eventTemplate);
    
    // Verify the signed event
    const isValid = verifyEvent(signedEvent);
    if (!isValid) {
      throw new Error('Event signature verification failed');
    }
    
    // Publish to relays
    const result = await nostrRelayManager.publishEvent(signedEvent);
    
    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays');
    }
    
    console.log('Profile updated successfully:', result);
    
    // Refresh profile data
    await refreshUserProfile();
    
    success.value = true;
    
    // Auto-close after success
    setTimeout(() => {
      emit('profile-updated');
      emit('close-editor');
    }, 2000);
    
  } catch (err) {
    console.error('Failed to update profile:', err);
    error.value = `Failed to update profile: ${err.message}`;
  } finally {
    isLoading.value = false;
  }
};

// Handle cancel action
const handleCancel = () => {
  if (isLoading.value) return; // Prevent closing during save
  
  initializeForm(); // Reset form
  emit('close-editor');
};

// Handle backdrop click
const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) {
    handleCancel();
  }
};

// Keyboard event handling
const handleKeydown = (event) => {
  if (event.key === 'Escape' && props.show) {
    handleCancel();
  }
};

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* Modal transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from > div,
.modal-fade-leave-to > div {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .modal-fade-enter-from > div,
  .modal-fade-leave-to > div {
    transform: scale(0.95) translateY(-20px);
  }
}

/* Slide in animation for status messages */
.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.3s ease-out;
}

.slide-in-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-in-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Custom scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Touch targets for mobile */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Focus states */
input:focus,
textarea:focus {
  outline: none;
}

/* Button states - removed excessive transforms for better mobile UX */
button:active:not(:disabled) {
  opacity: 0.9;
}

/* Loading state */
button:disabled {
  cursor: not-allowed;
}

/* Responsive design adjustments */
@media (max-width: 640px) {
  .touch-target {
    min-height: 48px; /* Larger touch targets on mobile */
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .bg-gradient-to-r {
    background: #f97316; /* Solid orange for high contrast */
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .slide-in-enter-active,
  .slide-in-leave-active {
    transition: none;
  }
}
</style>