<template>
  <Teleport to="#modal-root">
    <transition name="slide-up">
      <div
        v-if="show"
        class="fixed inset-0 z-[9999]"
        @click.self="handleBackdropClick"
      >
        <!-- Backdrop -->
        <div class="success-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm" @click="handleBackdropClick"></div>

        <!-- Bottom Sheet on Mobile, Center Modal on Desktop -->
        <div class="success-modal-panel absolute sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[520px] bottom-0 sm:bottom-auto left-0 right-0 sm:right-auto bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl sm:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.4)] sm:border sm:border-gray-200/50 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
          <!-- Drag Handle (Mobile Only) -->
          <div class="flex sm:hidden justify-center pt-3 pb-2">
            <div class="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          <!-- Close Button (Desktop) -->
          <button
            @click="closeModal"
            class="hidden sm:flex absolute top-5 right-5 z-10 w-10 h-10 bg-white hover:bg-gray-100 rounded-full items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
            aria-label="Close"
          >
            <IconX class="w-5 h-5 text-gray-600" />
          </button>

          <!-- Success Header with Gradient Background -->
          <div class="relative bg-gradient-to-br from-orange-500 to-amber-500 px-6 sm:px-8 pt-8 pb-10 text-center overflow-hidden">
            <!-- Decorative elements -->
            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div class="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>

            <!-- Animated Success Icon -->
            <div class="relative mx-auto mb-4 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl animate-bounce-in">
              <div class="absolute inset-0 bg-white rounded-full animate-ping opacity-20"></div>
              <IconCheck class="w-10 h-10 text-orange-500 animate-check" />
            </div>

            <!-- Success Message -->
            <h2 class="text-2xl sm:text-3xl font-bold text-white mb-2 drop-shadow-md">
              {{ contentType === 'article' ? 'Article Published!' : 'Post is Live!' }}
            </h2>
            <p class="text-white/90 text-base font-medium">
              Successfully published to {{ publishResult?.successfulRelays || 0 }} relay{{ publishResult?.successfulRelays !== 1 ? 's' : '' }}
            </p>
          </div>

          <!-- Content Area -->
          <div class="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
            <!-- Content Preview Card -->
            <div class="bg-gradient-to-br from-gray-50 to-white border border-gray-200/70 rounded-2xl p-5 mb-6 shadow-sm">
              <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0 shadow-md">
                  <img
                    :src="userProfile?.picture || generateAvatar(currentUser?.pubkey)"
                    :alt="userProfile?.name || 'You'"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-gray-900 mb-2">{{ userProfile?.name || 'You' }}</div>
                  <div v-if="contentType === 'article'" class="mb-1">
                    <h4 class="font-bold text-gray-900 text-lg mb-2 leading-tight">{{ title }}</h4>
                    <p class="text-gray-700 text-sm leading-relaxed line-clamp-3">{{ content }}</p>
                  </div>
                  <p v-else class="text-gray-700 text-base leading-relaxed line-clamp-4">
                    {{ content }}
                  </p>
                </div>
              </div>
            </div>

            <!-- View on Clients Section -->
            <div class="mb-6">
              <h3 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <IconExternalLink class="w-4 h-4 text-orange-500" />
                View on Nostr clients
              </h3>
              <div class="grid grid-cols-2 gap-3">
                <a
                  :href="getNostrClientUrl('primal', publishResult?.event?.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group bg-gradient-to-br from-white to-gray-50 hover:from-orange-50 hover:to-amber-50 border border-gray-200 hover:border-orange-300 px-4 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md active:scale-95"
                >
                  <span class="text-lg">🌐</span>
                  <span class="text-gray-700 group-hover:text-orange-600">Primal</span>
                  <IconArrowUpRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                </a>

                <a
                  :href="getNostrClientUrl('yakihonne', publishResult?.event?.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group bg-gradient-to-br from-white to-gray-50 hover:from-orange-50 hover:to-amber-50 border border-gray-200 hover:border-orange-300 px-4 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-sm hover:shadow-md active:scale-95"
                >
                  <span class="text-lg">🍜</span>
                  <span class="text-gray-700 group-hover:text-orange-600">Yakihonne</span>
                  <IconArrowUpRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                </a>
              </div>
            </div>
          </div>

          <!-- Footer with Auto-close Indicator -->
          <div class="px-5 sm:px-8 py-5 border-t border-gray-200/70 bg-gradient-to-r from-gray-50/50 to-white backdrop-blur-sm">
            <!-- Auto-close Progress -->
            <div class="mb-4">
              <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div class="bg-gradient-to-r from-orange-500 to-amber-500 h-1.5 rounded-full animate-countdown shadow-sm"></div>
              </div>
              <p class="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1.5">
                <IconClock class="w-3.5 h-3.5" />
                Closing automatically in {{ remainingSeconds }}s
              </p>
            </div>

            <!-- Action Button (Mobile) -->
            <button
              @click="closeModal"
              class="sm:hidden w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
            >
              <IconCheck class="w-5 h-5" />
              Done
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { IconCheck, IconX, IconExternalLink, IconArrowUpRight, IconClock } from '@iconify-prerendered/vue-tabler'
import { neventEncode, naddrEncode } from 'nostr-tools/nip19'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  content: {
    type: String,
    default: ''
  },
  contentType: {
    type: String,
    default: 'note',
    validator: (value) => ['note', 'article'].includes(value)
  },
  title: {
    type: String,
    default: ''
  },
  publishResult: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const { userProfile, currentUser } = useNostrAuth()

// Auto-close timer management
let autoCloseTimer = null
let countdownInterval = null
const remainingSeconds = ref(5)

// Set up auto-close timer
const startAutoCloseTimer = () => {
  // Reset countdown
  remainingSeconds.value = 5

  // Clear any existing timers
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }

  // Countdown interval for display
  countdownInterval = setInterval(() => {
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      clearInterval(countdownInterval)
    }
  }, 1000)

  // Auto-close timer
  autoCloseTimer = setTimeout(() => {
    emit('close')
  }, 5000) // 5 seconds
}

// Clear the auto-close timer
const clearAutoCloseTimer = () => {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

// Manual close function
const closeModal = () => {
  clearAutoCloseTimer()
  emit('close')
}

// Handle backdrop click (close when clicking outside)
const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget || event.target.classList.contains('success-modal-backdrop')) {
    closeModal()
  }
}

// Handle escape key
const handleKeydown = (event) => {
  if (event.key === 'Escape' && props.show) {
    closeModal()
  }
}

// Watch for show prop changes to start/stop timer
watch(() => props.show, (show) => {
  if (show) {
    startAutoCloseTimer()
  } else {
    clearAutoCloseTimer()
  }
})

// Get URL for different Nostr clients
const getNostrClientUrl = (client, noteId) => {
  if (!noteId) return '#'

  try {
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${noteId}`
      case 'yakihonne':
        if (props.contentType === 'article') {
          // For long-form articles (kind 30023), use naddr with d-tag identifier
          const naddrData = {
            identifier: noteId, // Using the d-tag (contentId) as identifier
            pubkey: currentUser.value?.pubkey || '',
            kind: 30023,
            relays: []
          }
          return `https://yakihonne.com/article/${naddrEncode(naddrData)}`
        } else {
          // For notes (kind 1), use nevent
          return `https://yakihonne.com/note/${neventEncode({ id: noteId })}`
        }
      default:
        return `https://primal.net/e/${noteId}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  if (props.show) {
    startAutoCloseTimer()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  clearAutoCloseTimer()
})
</script>

<style scoped>
/* Slide-up transition for mobile, fade & scale for desktop */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Mobile: Slide up from bottom */
.slide-up-enter-from .success-modal-panel,
.slide-up-leave-to .success-modal-panel {
  transform: translateY(100%);
}

/* Desktop: Fade and scale from center */
@media (min-width: 640px) {
  .slide-up-enter-from .success-modal-panel,
  .slide-up-leave-to .success-modal-panel {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 0;
  }

  .slide-up-enter-active .success-modal-panel,
  .slide-up-leave-active .success-modal-panel {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

/* Backdrop fade */
.slide-up-enter-from .success-modal-backdrop,
.slide-up-leave-to .success-modal-backdrop {
  opacity: 0;
}

/* Auto-close countdown animation */
.animate-countdown {
  animation: countdown 5s linear forwards;
}

@keyframes countdown {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

/* Bounce-in animation for success icon */
.animate-bounce-in {
  animation: bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes bounceIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Check mark draw animation */
.animate-check {
  animation: checkDraw 0.5s ease-out 0.3s backwards;
}

@keyframes checkDraw {
  from {
    transform: scale(0) rotate(-45deg);
    opacity: 0;
  }
  to {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

/* Line clamp utility */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Focus states for accessibility */
button:focus-visible,
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Prevent body scroll when modal is open */
body:has(.success-modal-panel) {
  overflow: hidden;
}
</style>
