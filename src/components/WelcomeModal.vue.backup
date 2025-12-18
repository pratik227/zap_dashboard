<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  IconBolt,
  IconX,
  IconChevronRight,
  IconChevronLeft,
  IconChartBar,
  IconWallet,
  IconFileText,
  IconCalendar,
  IconMessageCircle,
  IconTarget
} from '@iconify-prerendered/vue-tabler'

const emit = defineEmits(['close'])

const currentSlide = ref(0)
const totalSlides = 5

// Check if user has seen welcome before
const hasSeenWelcome = () => {
  return localStorage.getItem('zaptracker_welcome_seen') === 'true'
}

// Mark welcome as seen
const markWelcomeSeen = () => {
  localStorage.setItem('zaptracker_welcome_seen', 'true')
}

const slides = [
  {
    id: 'hero',
    title: 'Welcome to ZapTracker',
    subtitle: 'Your Lightning Network Command Center',
    description: 'Track every zap, analyze your earnings, and grow your Lightning presence - all in one beautiful dashboard.',
    image: null,
    showLogo: true
  },
  {
    id: 'analytics',
    title: 'Powerful Analytics at Your Fingertips',
    description: 'Real-time insights into your zap activity, earnings trends, and supporter engagement. Make data-driven decisions to maximize your Lightning income.',
    image: '/analytics.png',
    features: [
      { icon: IconBolt, text: 'Real-time zap tracking' },
      { icon: IconChartBar, text: 'Earnings analytics' },
      { icon: IconTarget, text: 'Supporter insights' }
    ]
  },
  {
    id: 'wallet-content',
    title: 'Manage Everything in One Place',
    description: 'Connect your Lightning wallet, share content, and engage with your community seamlessly.',
    image: '/wallet.png',
    features: [
      { icon: IconWallet, text: 'NWC wallet integration' },
      { icon: IconFileText, text: 'Content monetization' },
      { icon: IconTarget, text: 'Campaign management' }
    ]
  },
  {
    id: 'calendar-chat',
    title: 'Stay Connected & Organized',
    description: 'Schedule events, chat with supporters, and never miss a zap notification.',
    image: '/chat_zap_2.png',
    features: [
      { icon: IconCalendar, text: 'Event calendar' },
      { icon: IconMessageCircle, text: 'Live chat with zap integration' },
      { icon: IconBolt, text: 'Real-time notifications' }
    ]
  },
  {
    id: 'cta',
    title: 'Ready to Level Up Your Lightning Game?',
    description: 'Join creators and builders using ZapTracker to track their Lightning earnings',
    image: null,
    showLogo: true,
    isFinal: true
  }
]

const currentSlideData = computed(() => slides[currentSlide.value])

const canGoNext = computed(() => currentSlide.value < totalSlides - 1)
const canGoPrev = computed(() => currentSlide.value > 0)

const nextSlide = () => {
  if (canGoNext.value) {
    currentSlide.value++
  }
}

const prevSlide = () => {
  if (canGoPrev.value) {
    currentSlide.value--
  }
}

const goToSlide = (index) => {
  currentSlide.value = index
}

const handleSkip = () => {
  markWelcomeSeen()
  emit('close')
}

const handleGetStarted = () => {
  markWelcomeSeen()
  emit('close')
  // Trigger nostr-login widget
  console.log('🚀 Triggering nostr-login widget from WelcomeModal...')
  setTimeout(() => {
    document.dispatchEvent(new Event('nlLaunch'))
  }, 300)
}

const handleExplore = () => {
  markWelcomeSeen()
  emit('close')
}

// Auto-show modal on first visit
onMounted(() => {
  if (hasSeenWelcome()) {
    emit('close')
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-fade-in">
    <!-- Modal Container -->
    <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
      <!-- Header -->
      <div class="relative p-4 border-b border-gray-200">
        <button
          @click="handleSkip"
          class="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
        >
          <IconX class="w-5 h-5" />
        </button>

        <!-- Progress Dots -->
        <div class="flex justify-center space-x-2">
          <button
            v-for="(slide, index) in slides"
            :key="index"
            @click="goToSlide(index)"
            :class="[
              'h-2 rounded-full transition-all duration-300',
              currentSlide === index
                ? 'w-8 bg-gradient-to-r from-orange-500 to-amber-500'
                : 'w-2 bg-gray-300 hover:bg-gray-400'
            ]"
          />
        </div>
      </div>

      <!-- Slide Content -->
      <div class="relative overflow-hidden" style="min-height: 400px;">
        <transition name="slide-fade" mode="out-in">
          <div :key="currentSlide" class="p-8 sm:p-12">
            <!-- Hero Slide (Slide 1) -->
            <div v-if="currentSlideData.id === 'hero'" class="text-center space-y-6">
              <!-- Animated Logo -->
              <div class="flex justify-center mb-6">
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                  <div class="relative w-24 h-24 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
                    <IconBolt class="w-16 h-16 text-white animate-pulse-subtle" />
                  </div>
                </div>
              </div>

              <h1 class="text-4xl sm:text-5xl font-bold text-gray-900">
                {{ currentSlideData.title }}
              </h1>

              <p class="text-xl sm:text-2xl text-orange-600 font-semibold">
                {{ currentSlideData.subtitle }}
              </p>

              <p class="text-lg text-gray-600 max-w-2xl mx-auto">
                {{ currentSlideData.description }}
              </p>

              <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button
                  @click="nextSlide"
                  class="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <span>Take a Quick Tour</span>
                  <IconChevronRight class="w-5 h-5" />
                </button>
                <button
                  @click="handleGetStarted"
                  class="px-8 py-4 bg-white border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all duration-200"
                >
                  Get Started Now
                </button>
              </div>
            </div>

            <!-- Feature Slides (Slides 2-4) -->
            <div v-else-if="currentSlideData.features" class="space-y-8">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-lg text-gray-600 max-w-2xl mx-auto">
                  {{ currentSlideData.description }}
                </p>
              </div>

              <!-- Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center">
                <div class="relative max-w-2xl w-full">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-xl blur-xl opacity-20"></div>
                  <img
                    :src="currentSlideData.image"
                    :alt="currentSlideData.title"
                    class="relative w-full h-auto rounded-xl shadow-2xl border border-gray-200"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Features List -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div
                  v-for="(feature, index) in currentSlideData.features"
                  :key="index"
                  class="flex items-start space-x-3 p-4 bg-orange-50 rounded-lg"
                >
                  <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <component :is="feature.icon" class="w-5 h-5 text-white" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 pt-2">{{ feature.text }}</span>
                </div>
              </div>
            </div>

            <!-- Final CTA Slide (Slide 5) -->
            <div v-else-if="currentSlideData.isFinal" class="text-center space-y-6">
              <!-- Logo -->
              <div class="flex justify-center mb-6">
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-2xl opacity-40 animate-pulse"></div>
                  <img
                    src="/new_logo3.png"
                    alt="ZapTracker Logo"
                    class="relative w-32 h-32 object-contain"
                  />
                </div>
              </div>

              <h2 class="text-3xl sm:text-4xl font-bold text-gray-900">
                {{ currentSlideData.title }}
              </h2>

              <p class="text-lg text-gray-600 max-w-2xl mx-auto">
                {{ currentSlideData.description }}
              </p>

              <!-- CTAs -->
              <div class="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button
                  @click="handleGetStarted"
                  class="px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-lg rounded-xl font-bold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <IconBolt class="w-6 h-6" />
                  <span>Connect with Nostr</span>
                </button>
                <button
                  @click="handleExplore"
                  class="px-10 py-5 bg-white border-2 border-gray-300 text-gray-700 text-lg rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200"
                >
                  Explore Without Account
                </button>
              </div>

              <div class="mt-8 pt-8 border-t border-gray-200">
                <a
                  href="https://usenostr.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-orange-600 hover:text-orange-700 hover:underline"
                >
                  Learn more about Nostr →
                </a>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Navigation Footer -->
      <div class="border-t border-gray-200 p-4 bg-gray-50">
        <div class="flex justify-between items-center">
          <button
            @click="prevSlide"
            :disabled="!canGoPrev"
            :class="[
              'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2',
              canGoPrev
                ? 'text-gray-700 hover:bg-gray-200'
                : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            <IconChevronLeft class="w-5 h-5" />
            <span>Back</span>
          </button>

          <div class="text-sm text-gray-500">
            {{ currentSlide + 1 }} of {{ totalSlides }}
          </div>

          <button
            v-if="canGoNext"
            @click="nextSlide"
            class="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
          >
            <span>Next</span>
            <IconChevronRight class="w-5 h-5" />
          </button>
          <button
            v-else
            @click="handleGetStarted"
            class="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-200"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Animations */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse-subtle {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}

/* Slide transitions */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
