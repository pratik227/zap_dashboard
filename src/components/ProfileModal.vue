<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  IconX,
  IconUser,
  IconShield,
  IconBolt,
  IconGlobe,
  IconUserPlus,
  IconUserCheck,
  IconUserX,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconKey,
  IconChevronDown,
  IconChevronUp,
  IconLoader,
  IconAlertCircle
} from '@iconify-prerendered/vue-tabler'
import * as nip19 from 'nostr-tools/nip19'
import BadgeList from './BadgeList.vue'
import BadgeDetailModal from './BadgeDetailModal.vue'
import UserProfileModal from './UserProfileModal.vue'
import { generateAvatar } from '../utils/avatarGenerator.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  pubkey: {
    type: String,
    required: true
  },
  profile: {
    type: Object,
    default: null
  },
  isFollowing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'follow', 'unfollow'])

// UI state
const copySuccess = ref('')
const showFullDescription = ref(false)
const isDescriptionLong = ref(false)
const selectedBadge = ref(null)
const showBadgeModal = ref(false)
const showUserProfileModal = ref(false)

// Computed properties
const displayName = computed(() => {
  return props.profile?.name || 
         props.profile?.display_name || 
         `user:${props.pubkey.substring(0, 8)}`
})

const avatar = computed(() => {
  return props.profile?.picture || generateAvatar(props.pubkey)
})

const banner = computed(() => {
  return props.profile?.banner || null
})

const npub = computed(() => {
  try {
    return nip19.npubEncode(props.pubkey)
  } catch {
    return props.pubkey
  }
})

const shortNpub = computed(() => {
  const full = npub.value
  return `${full.substring(0, 12)}...${full.substring(full.length - 8)}`
})

const truncatedDescription = computed(() => {
  if (!props.profile?.about) return ''
  
  const maxLength = 200
  const description = props.profile.about
  
  if (description.length <= maxLength) {
    isDescriptionLong.value = false
    return description
  }
  
  isDescriptionLong.value = true
  return showFullDescription.value ? description : description.substring(0, maxLength) + '...'
})


// Copy to clipboard with enhanced feedback
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Get profile URL for different clients
const getProfileUrl = (client) => {
  try {
    const npubValue = npub.value
    switch (client) {
      case 'primal':
        return `https://primal.net/p/${npubValue}`
      case 'yakihonne':
        return `https://yakihonne.com/${npubValue}`
      default:
        return `https://primal.net/p/${npubValue}`
    }
  } catch (error) {
    return '#'
  }
}

// Handle follow/unfollow
const handleFollowToggle = () => {
  if (props.isFollowing) {
    emit('unfollow', props.pubkey)
  } else {
    emit('follow', props.pubkey)
  }
}

// Handle badge click
const handleBadgeClick = (badge) => {
  selectedBadge.value = badge
  showBadgeModal.value = true
}

// Handle view all badges
const handleViewAllBadges = () => {
  showUserProfileModal.value = true
}

// Close modal
const closeModal = () => {
  emit('close')
}

// Handle escape key
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
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
      <div v-if="show" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg max-h-[95vh] overflow-hidden shadow-2xl transform transition-all duration-300">
          <!-- Header with Banner -->
          <div class="relative">
            <!-- Banner Background -->
            <div class="h-32 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 relative overflow-hidden">
              <img 
                v-if="banner"
                :src="banner" 
                :alt="displayName + ' banner'"
                class="w-full h-full object-cover"
                @error="$event.target.style.display = 'none'"
              />
              <!-- Subtle overlay for better text readability -->
              <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
            </div>
            
            <!-- Close Button -->
            <button
              @click="closeModal"
              class="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 text-white hover:scale-110 shadow-lg"
              aria-label="Close profile"
            >
              <IconX class="w-5 h-5" />
            </button>
            
            <!-- Profile Avatar Overlay -->
            <div class="absolute -bottom-12 left-6">
              <div class="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white">
                <img
                  :src="avatar"
                  :alt="displayName"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(pubkey)"
                />
              </div>
            </div>
          </div>

          <!-- Content Area -->
          <div class="pt-16 pb-6 px-6 overflow-y-auto max-h-[calc(95vh-128px)]">
            <!-- Profile Header -->
            <div class="mb-6">
              <!-- Name and Display Name -->
              <div class="mb-3">
                <h2 class="text-2xl font-bold text-gray-900 mb-1">{{ displayName }}</h2>
                <p v-if="profile?.display_name && profile?.display_name !== profile?.name" 
                   class="text-lg text-gray-600">
                  {{ profile.display_name }}
                </p>
              </div>

              <!-- Status Badges -->
              <div class="flex flex-wrap gap-2 mb-4">
                <span v-if="profile?.nip05" class="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-200 shadow-sm">
                  <IconShield class="w-4 h-4 mr-1.5" />
                  NIP-05 Verified
                </span>
                <span v-if="profile?.lud16" class="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-200 shadow-sm">
                  <IconBolt class="w-4 h-4 mr-1.5" />
                  Lightning Ready
                </span>
                <span v-if="profile?.website" class="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200 shadow-sm">
                  <IconGlobe class="w-4 h-4 mr-1.5" />
                  Website
                </span>
              </div>

              <!-- NIP-58 Badges -->
              <div class="mb-4">
                <BadgeList
                  :pubkey="pubkey"
                  size="medium"
                  :max-display="6"
                  :show-count="true"
                  :show-view-all="true"
                  layout="horizontal"
                  @badge-click="handleBadgeClick"
                  @view-all="handleViewAllBadges"
                />
              </div>

              <!-- Description -->
              <div v-if="profile?.about" class="mb-6">
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {{ truncatedDescription }}
                  </p>
                  <button
                    v-if="isDescriptionLong"
                    @click="showFullDescription = !showFullDescription"
                    class="mt-3 text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center space-x-1 transition-colors"
                  >
                    <span>{{ showFullDescription ? 'Show less' : 'Show more' }}</span>
                    <IconChevronDown v-if="!showFullDescription" class="w-4 h-4" />
                    <IconChevronUp v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Contact Information -->
            <div class="space-y-3 mb-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              
              <!-- Public Key -->
              <div class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <IconKey class="w-5 h-5 text-gray-600" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900">Public Key</p>
                      <code class="text-xs text-gray-500 font-mono truncate block">{{ shortNpub }}</code>
                    </div>
                  </div>
                  <button
                    @click="copyToClipboard(npub, 'npub')"
                    class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 hover:scale-110"
                    title="Copy public key"
                  >
                    <IconCheck v-if="copySuccess === 'npub'" class="w-4 h-4 text-green-600" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Lightning Address -->
              <div v-if="profile?.lud16" class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <IconBolt class="w-5 h-5 text-orange-600" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900">Lightning Address</p>
                      <code class="text-xs text-orange-600 font-mono truncate block">{{ profile.lud16 }}</code>
                    </div>
                  </div>
                  <button
                    @click="copyToClipboard(profile.lud16, 'lud16')"
                    class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 hover:scale-110"
                    title="Copy Lightning address"
                  >
                    <IconCheck v-if="copySuccess === 'lud16'" class="w-4 h-4 text-green-600" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- NIP-05 Verification -->
              <div v-if="profile?.nip05" class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <IconShield class="w-5 h-5 text-blue-600" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900">NIP-05 Verified</p>
                      <code class="text-xs text-blue-600 font-mono truncate block">{{ profile.nip05 }}</code>
                    </div>
                  </div>
                  <button
                    @click="copyToClipboard(profile.nip05, 'nip05')"
                    class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 hover:scale-110"
                    title="Copy NIP-05"
                  >
                    <IconCheck v-if="copySuccess === 'nip05'" class="w-4 h-4 text-green-600" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Website -->
              <div v-if="profile?.website" class="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-200">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3 flex-1 min-w-0">
                    <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <IconGlobe class="w-5 h-5 text-green-600" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900">Website</p>
                      <p class="text-xs text-green-600 truncate">{{ profile.website }}</p>
                    </div>
                  </div>
                  <a
                    :href="profile.website"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 hover:scale-110"
                    title="Visit website"
                  >
                    <IconExternalLink class="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="space-y-3">
              <!-- Primary Action: Follow/Unfollow -->
              <button
                @click="handleFollowToggle"
                :class="[
                  'w-full px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]',
                  isFollowing 
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white' 
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white'
                ]"
              >
                <IconUserX v-if="isFollowing" class="w-5 h-5" />
                <IconUserPlus v-else class="w-5 h-5" />
                <span>{{ isFollowing ? 'Unfollow' : 'Follow' }}</span>
              </button>
              
              <!-- Secondary Actions -->
              <div class="grid grid-cols-2 gap-3">
                <!-- View on Primal -->
                <a
                  :href="getProfileUrl('primal')"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bg-white border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-700 hover:text-orange-700 px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span class="text-orange-600">🌐</span>
                  <span>Primal</span>
                </a>
                
                <!-- View on Yakihonne -->
                <a
                  :href="getProfileUrl('yakihonne')"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="bg-white border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 hover:text-purple-700 px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span class="text-purple-600">🍜</span>
                  <span>Yakihonne</span>
                </a>
              </div>
            </div>

            <!-- Copy Success Feedback -->
            <transition name="slide-up">
              <div v-if="copySuccess" class="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                <div class="flex items-center space-x-2">
                  <IconCheck class="w-4 h-4 text-green-600" />
                  <span class="text-sm text-green-800 font-medium">
                    {{ copySuccess === 'npub' ? 'Public key copied!' :
                       copySuccess === 'lud16' ? 'Lightning address copied!' :
                       copySuccess === 'nip05' ? 'NIP-05 copied!' : 'Copied!' }}
                  </span>
                </div>
              </div>
            </transition>
          </div>

          <!-- ZapTracker Branding Footer -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border-t border-orange-100 px-6 py-3">
            <div class="flex items-center justify-center space-x-2 text-gray-600">
              <img 
                src="/new_logo3.png"
                alt="ZapTracker" 
                class="w-4 h-4 object-contain"
              />
              <span class="text-xs font-medium">ZapTracker Profile</span>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Badge Detail Modal -->
  <BadgeDetailModal
    :show="showBadgeModal"
    :badge="selectedBadge"
    @close="showBadgeModal = false; selectedBadge = null"
  />

  <!-- User Profile Modal (for viewing all badges) -->
  <UserProfileModal
    :show="showUserProfileModal"
    :user-profile-data="{ pubkey, profile }"
    initial-tab="badges"
    @close="showUserProfileModal = false"
    @badge-click="handleBadgeClick"
  />
</template>

<style scoped>
/* Modal transitions */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-transition-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-transition-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}

/* Slide up animation for copy feedback */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
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

/* Enhanced button interactions */
button:not(:disabled) {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

a {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible,
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, a {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Responsive text sizing */
@media (max-width: 640px) {
  .text-2xl {
    font-size: 1.5rem;
  }
  
  .text-lg {
    font-size: 1.125rem;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .bg-gradient-to-br {
    background: #f97316; /* Solid orange for high contrast */
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .modal-transition-enter-active,
  .modal-transition-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: none;
  }
  
  button:hover:not(:disabled),
  a:hover {
    transform: none;
  }
}

/* Improved text readability */
.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Enhanced shadow effects */
.shadow-2xl {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.shadow-xl {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
</style>