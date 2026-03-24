<script setup>
import { ref, computed, onMounted } from 'vue'
import { IconX, IconSparkles, IconMessage2, IconCalendarEvent } from '@iconify-prerendered/vue-tabler'
import { storageService } from '../../services/StorageService.js'

const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (value) => ['notes', 'zapfeed', 'zapfeed-compact', 'menu'].includes(value)
  }
})

const isDismissed = ref(false)
const isVisible = ref(false)

const storageKey = computed(() => {
  const key = props.variant === 'zapfeed-compact' ? 'zapfeed' : props.variant
  return `threads_promo_dismissed_${key}`
})

const showDismissButton = computed(() => {
  return props.variant === 'notes'
})

onMounted(() => {
  const dismissed = storageService.getRaw(storageKey.value)
  isDismissed.value = dismissed === 'true'

  setTimeout(() => {
    isVisible.value = true
  }, 100)
})

const handleDismiss = () => {
  isVisible.value = false
  setTimeout(() => {
    isDismissed.value = true
    storageService.setRaw(storageKey.value, 'true')
  }, 300)
}

const handleClick = () => {
  window.open('https://nostrthreads.com', '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <!-- Notes Variant: Compact banner below compose area -->
  <transition name="fade-slide">
    <div
      v-if="variant === 'notes' && !isDismissed && isVisible"
      class="relative overflow-hidden bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 border border-orange-200/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group"
    >
      <!-- Dismiss button - absolute positioned -->
      <button
        v-if="showDismissButton"
        @click.stop="handleDismiss"
        class="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-lg transition-all duration-200 z-10"
        title="Dismiss"
      >
        <IconX class="w-4 h-4" />
      </button>

      <div class="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <!-- Logo and Text -->
        <div class="flex items-start sm:items-center gap-3 flex-1 min-w-0 pr-6 sm:pr-0">
          <div class="relative flex-shrink-0">
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl p-1.5 shadow-sm">
              <img src="/threads_logo.png" alt="Threads" class="w-full h-full object-contain" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <h4 class="text-sm sm:text-base font-semibold text-gray-900 leading-tight">Organize your notes into Threads</h4>
            <p class="text-xs sm:text-sm text-gray-500 mt-0.5 leading-snug">Connect conversations, schedule, and grow your audience</p>
          </div>
        </div>

        <!-- Button -->
        <button
          @click="handleClick"
          class="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          Try Threads
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
          </svg>
        </button>
      </div>
    </div>
  </transition>

  <!-- ZapFeed Variant: Integrated card in feed (no hover effects) -->
  <transition name="fade-slide">
    <div
      v-if="variant === 'zapfeed' && !isDismissed && isVisible"
      @click="handleClick"
      class="relative bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-3xl border-2 border-orange-300/50 shadow-2xl cursor-pointer overflow-hidden"
    >
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/20 rounded-full blur-2xl transform -translate-x-24 translate-y-24"></div>

      <div class="relative p-8">
        <div class="flex items-start gap-5 mb-6">
          <div class="relative flex-shrink-0">
            <div class="absolute inset-0 bg-white rounded-3xl blur-xl opacity-50 animate-pulse"></div>
            <div class="relative w-20 h-20 bg-white rounded-3xl p-3 shadow-2xl">
              <img src="/threads_logo.png" alt="Threads" class="w-full h-full object-contain" />
            </div>
          </div>

          <div class="flex-1 min-w-0 pt-2">
            <div class="flex items-center gap-3 mb-3">
              <h3 class="text-2xl font-black text-white drop-shadow-lg tracking-tight">Discover Threads</h3>
              <div class="relative">
                <span class="px-3 py-1.5 bg-white text-orange-600 text-xs font-black rounded-full shadow-xl animate-bounce-subtle">NEW</span>
                <IconSparkles class="absolute -top-1 -right-1 w-4 h-4 text-yellow-200 animate-ping" />
              </div>
            </div>
            <p class="text-white/95 text-base leading-relaxed drop-shadow-md font-medium">
              Organize notes into Threads, schedule, and grow your Nostr presence like never before
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between mt-8">
          <div class="flex items-center gap-5 text-white/95">
            <div class="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl">
              <IconMessage2 class="w-5 h-5" />
              <span class="text-sm font-bold drop-shadow-sm">Thread Management</span>
            </div>
            <div class="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl">
              <IconCalendarEvent class="w-5 h-5" />
              <span class="text-sm font-bold drop-shadow-sm">Scheduling</span>
            </div>
          </div>

          <button
            class="relative px-6 py-3.5 bg-white text-orange-600 font-black text-base rounded-2xl shadow-2xl flex items-center gap-3 overflow-hidden"
          >
            <span class="relative z-10">Explore Threads</span>
            <svg class="relative z-10 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- ZapFeed Compact Variant: Smaller card for compact view -->
  <transition name="fade-slide">
    <div
      v-if="variant === 'zapfeed-compact' && !isDismissed && isVisible"
      @click="handleClick"
      class="relative bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-xl border border-orange-300/50 shadow-lg cursor-pointer overflow-hidden"
    >
      <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-16 -translate-y-16"></div>

      <div class="relative px-4 py-3 flex items-center gap-4">
        <div class="relative flex-shrink-0">
          <div class="w-10 h-10 bg-white rounded-xl p-1.5 shadow-lg">
            <img src="/threads_logo.png" alt="Threads" class="w-full h-full object-contain" />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-bold text-white drop-shadow-md">Discover Threads</h4>
            <span class="px-2 py-0.5 bg-white text-orange-600 text-[10px] font-black rounded-full shadow-md">NEW</span>
          </div>
          <p class="text-white/90 text-xs leading-snug drop-shadow-sm mt-0.5">
            Organize notes, schedule, and grow your Nostr presence
          </p>
        </div>

        <button
          class="flex-shrink-0 px-3 py-1.5 bg-white text-orange-600 font-bold text-xs rounded-lg shadow-lg flex items-center gap-1.5"
        >
          <span>Try it</span>
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
          </svg>
        </button>
      </div>
    </div>
  </transition>

  <!-- Menu Variant: Dropdown menu item -->
  <button
    v-if="variant === 'menu'"
    @click="handleClick"
    class="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-orange-50 transition-colors duration-200 group"
  >
    <div class="flex items-center space-x-3">
      <img src="/threads_logo.png" alt="Threads" class="w-6 h-6 object-contain" />
      <span class="font-medium text-gray-700 group-hover:text-orange-700 transition-colors">Try Threads</span>
    </div>
    <span class="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs font-semibold rounded-full">
      NEW
    </span>
  </button>
</template>

<style scoped>
.fade-slide-enter-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

@keyframes bounce-subtle {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-4px);
  }
}

.animate-bounce-subtle {
  animation: bounce-subtle 2s ease-in-out infinite;
}

.shadow-3xl {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 60px rgba(251, 146, 60, 0.3);
}

.hover\:shadow-3xl:hover {
  box-shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.3), 0 0 80px rgba(251, 146, 60, 0.4);
}
</style>
