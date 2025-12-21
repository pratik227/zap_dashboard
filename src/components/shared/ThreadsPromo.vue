<script setup>
import { ref, computed, onMounted } from 'vue'
import { IconX, IconSparkles, IconMessage2, IconCalendarEvent } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  variant: {
    type: String,
    required: true,
    validator: (value) => ['notes', 'zapfeed', 'menu'].includes(value)
  }
})

const isDismissed = ref(false)
const isVisible = ref(false)
const isHovered = ref(false)

const storageKey = computed(() => {
  return `threads_promo_dismissed_${props.variant}`
})

const showDismissButton = computed(() => {
  return props.variant !== 'menu'
})

onMounted(() => {
  if (props.variant !== 'menu') {
    const dismissed = localStorage.getItem(storageKey.value)
    isDismissed.value = dismissed === 'true'
  }

  setTimeout(() => {
    isVisible.value = true
  }, 100)
})

const handleDismiss = () => {
  isVisible.value = false
  setTimeout(() => {
    isDismissed.value = true
    localStorage.setItem(storageKey.value, 'true')
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
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      class="relative overflow-hidden bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 border-2 border-orange-200/60 rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 group"
    >
      <div class="absolute inset-0 bg-gradient-to-r from-orange-100/20 to-amber-100/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      <div class="relative flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <div class="relative flex-shrink-0">
            <div class="absolute inset-0 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl blur-md opacity-50 group-hover:opacity-70 transition-opacity duration-300"></div>
            <div class="relative w-14 h-14 bg-white rounded-2xl p-2 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <img src="/threads_logo.png" alt="Threads" class="w-full h-full object-contain" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="text-base font-bold text-gray-900">Organize your notes into Threads</h4>
              <IconSparkles class="w-4 h-4 text-orange-500 animate-pulse" />
            </div>
            <p class="text-sm text-gray-600 leading-snug">Connect conversations, schedule your notes, and grow your audience</p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            @click="handleClick"
            class="relative px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-bold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl shadow-lg overflow-hidden group/btn whitespace-nowrap"
          >
            <span class="relative z-10 flex items-center gap-2">
              Try Threads
              <svg class="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </span>
            <div class="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
          </button>

          <button
            v-if="showDismissButton"
            @click.stop="handleDismiss"
            class="p-2 text-gray-400 hover:text-gray-700 hover:bg-white/80 rounded-xl transition-all duration-200 hover:scale-110"
            title="Dismiss"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- ZapFeed Variant: Integrated card in feed -->
  <transition name="fade-slide">
    <div
      v-if="variant === 'zapfeed' && !isDismissed && isVisible"
      @click="handleClick"
      @mouseenter="isHovered = true"
      @mouseleave="isHovered = false"
      class="relative bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-3xl border-2 border-orange-300/50 shadow-2xl hover:shadow-3xl transition-all duration-500 cursor-pointer overflow-hidden hover:-translate-y-2 hover:scale-[1.02] group"
    >
      <div class="absolute inset-0 bg-gradient-to-tr from-orange-500/30 via-transparent to-yellow-300/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32 group-hover:scale-150 transition-transform duration-700"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/20 rounded-full blur-2xl transform -translate-x-24 translate-y-24 group-hover:scale-150 transition-transform duration-700"></div>

      <button
        v-if="showDismissButton"
        @click.stop="handleDismiss"
        class="absolute top-4 right-4 p-2.5 text-white/80 hover:text-white hover:bg-white/25 rounded-xl transition-all duration-200 z-20 backdrop-blur-md hover:scale-110 hover:rotate-90"
        title="Dismiss"
      >
        <IconX class="w-5 h-5" />
      </button>

      <div class="relative p-8">
        <div class="flex items-start gap-5 mb-6">
          <div class="relative flex-shrink-0">
            <div class="absolute inset-0 bg-white rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity animate-pulse"></div>
            <div class="relative w-20 h-20 bg-white rounded-3xl p-3 shadow-2xl transform group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500">
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
              Organize notes into Threds, schedule, and grow your Nostr presence like never before
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between mt-8">
          <div class="flex items-center gap-5 text-white/95">
            <div class="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl transform group-hover:scale-105 transition-transform">
              <IconMessage2 class="w-5 h-5" />
              <span class="text-sm font-bold drop-shadow-sm">Thread Management</span>
            </div>
            <div class="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl transform group-hover:scale-105 transition-transform">
              <IconCalendarEvent class="w-5 h-5" />
              <span class="text-sm font-bold drop-shadow-sm">Scheduling</span>
            </div>
          </div>

          <button
            class="relative px-6 py-3.5 bg-white text-orange-600 font-black text-base rounded-2xl hover:bg-orange-50 transition-all duration-300 shadow-2xl hover:shadow-3xl flex items-center gap-3 overflow-hidden group/btn transform hover:scale-110"
          >
            <span class="relative z-10">Explore Threads</span>
            <svg class="relative z-10 w-5 h-5 transform group-hover/btn:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
            <div class="absolute inset-0 bg-gradient-to-r from-orange-100 to-yellow-100 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
          </button>
        </div>
      </div>
    </div>
  </transition>

  <!-- Menu Variant: Dropdown menu item -->
  <button
    v-if="variant === 'menu'"
    @click="handleClick"
    class="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-300 group rounded-lg mx-1"
  >
    <div class="flex items-center space-x-3">
      <div class="relative w-6 h-6 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
        <div class="absolute inset-0 bg-orange-400 rounded-lg blur-sm opacity-0 group-hover:opacity-50 transition-opacity"></div>
        <img src="/threads_logo.png" alt="Threads" class="relative w-full h-full object-contain" />
      </div>
      <span class="font-bold text-gray-700 group-hover:text-orange-700 transition-colors">Try Threads</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="px-2.5 py-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 text-xs font-black rounded-full group-hover:from-orange-200 group-hover:to-amber-200 transition-all shadow-sm group-hover:shadow-md transform group-hover:scale-110">
        NEW
      </span>
      <IconSparkles class="w-3.5 h-3.5 text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
    </div>
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
