<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IconX,
  IconShare,
  IconCopy,
  IconCheck,
  IconArrowLeft,
  IconBrandTwitter,
  IconBrandWhatsapp,
  IconBrandTelegram,
  IconBrandReddit
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { nip19 } from '../../services/nostr/nostrImports.js'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { currentUser, userProfile } = useNostrAuth()

// UI state
const currentView = ref('main') // 'main', 'social', 'copy'
const copySuccess = ref('')

// Generate share URLs and content
const shareData = computed(() => {
  if (!currentUser.value?.pubkey) return null

  const npub = nip19.npubEncode(currentUser.value.pubkey)
  const profileName = userProfile.value?.name || 'Nostr User'
  const yakihonneUrl = `https://yakihonne.com/${npub}`
  
  const shareText = `Check out my Nostr profile: ${profileName}`
  const shareTextWithUrl = `${shareText}\n\n${yakihonneUrl}`
  
  return {
    npub,
    profileName,
    yakihonneUrl,
    shareText,
    shareTextWithUrl,
    platforms: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareTextWithUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(yakihonneUrl)}&text=${encodeURIComponent(shareText)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTextWithUrl)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(yakihonneUrl)}&title=${encodeURIComponent(shareText)}`
    }
  }
})

// Platform configurations
const platforms = [
  {
    id: 'twitter',
    name: 'X (former Twitter)',
    icon: IconBrandTwitter,
    color: 'bg-black hover:bg-gray-800',
    textColor: 'text-white'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: IconBrandWhatsapp,
    color: 'bg-green-500 hover:bg-green-600',
    textColor: 'text-white'
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: IconBrandTelegram,
    color: 'bg-blue-500 hover:bg-blue-600',
    textColor: 'text-white'
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: IconBrandReddit,
    color: 'bg-orange-600 hover:bg-orange-700',
    textColor: 'text-white'
  }
]

// Copy to clipboard
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

// Share on platform
const shareOnPlatform = (platformId) => {
  if (!shareData.value) return
  
  const url = shareData.value.platforms[platformId]
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Navigation
const goToSocial = () => {
  currentView.value = 'social'
}

const goToCopy = () => {
  currentView.value = 'copy'
}

const goBack = () => {
  currentView.value = 'main'
}

// Close modal
const closeModal = () => {
  currentView.value = 'main'
  copySuccess.value = ''
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
      <div v-if="show" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4" @click.self="$emit('close')" @keydown.escape="$emit('close')" tabindex="-1">
        <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all duration-300">
          <!-- Header -->
          <div class="bg-gray-900 text-white p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Share</h3>
              <button
                @click="closeModal"
                class="w-8 h-8 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Main View -->
          <div v-if="currentView === 'main'" class="p-4">
            <div class="space-y-3">
              <!-- Share on Social Button -->
              <button
                @click="goToSocial"
                class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <IconShare class="w-5 h-5" />
                <span>Share on social</span>
              </button>

              <!-- Copy Link Button -->
              <button
                @click="goToCopy"
                class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <IconCopy class="w-5 h-5" />
                <span>Copy link</span>
              </button>
            </div>
          </div>

          <!-- Social Platforms View -->
          <div v-else-if="currentView === 'social'" class="p-4">
            <div class="space-y-3 mb-4">
              <button
                v-for="platform in platforms"
                :key="platform.id"
                @click="shareOnPlatform(platform.id)"
                :class="[
                  'w-full px-6 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-3 shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]',
                  platform.color,
                  platform.textColor
                ]"
              >
                <component :is="platform.icon" class="w-5 h-5" />
                <span>{{ platform.name }}</span>
              </button>
            </div>

            <!-- Back Button -->
            <button
              @click="goBack"
              class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <IconArrowLeft class="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>

          <!-- Copy Links View -->
          <div v-else-if="currentView === 'copy'" class="p-4">
            <div class="space-y-4 mb-4">
              <!-- Human-readable URL -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-orange-600">Human-readable URL</label>
                </div>
                <div class="bg-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <code class="text-sm text-gray-700 truncate flex-1 mr-2">
                    {{ shareData?.yakihonneUrl }}
                  </code>
                  <button
                    @click="copyToClipboard(shareData?.yakihonneUrl, 'yakihonne')"
                    class="p-1 text-gray-500 hover:text-orange-600 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'yakihonne'" class="w-4 h-4 text-green-600" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Nostr URL -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-orange-600">Nostr npub</label>
                </div>
                <div class="bg-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <code class="text-sm text-gray-700 truncate flex-1 mr-2">
                    {{ shareData?.npub }}
                  </code>
                  <button
                    @click="copyToClipboard(shareData?.npub, 'npub')"
                    class="p-1 text-gray-500 hover:text-orange-600 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'npub'" class="w-4 h-4 text-green-600" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Back Button -->
            <button
              @click="goBack"
              class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <IconArrowLeft class="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
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

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Smooth transitions for all interactive elements */
button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Code text styling */
code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
}

/* Truncate text properly */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>