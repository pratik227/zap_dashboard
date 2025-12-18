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
  IconTarget,
  IconHelp,
  IconLogin,
  IconKey,
  IconShieldCheck
} from '@iconify-prerendered/vue-tabler'

const emit = defineEmits(['close', 'trigger-login'])

const props = defineProps({
  autoShow: {
    type: Boolean,
    default: false
  }
})

const currentSlide = ref(0)
const totalSlides = 7
const activeTab = ref('getting-started')

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
    title: 'Powerful Analytics',
    description: 'Real-time insights into your zap activity, earnings trends, and supporter engagement.',
    image: '/analytics.png',
    features: [
      { icon: IconBolt, text: 'Real-time zap tracking' },
      { icon: IconChartBar, text: 'Earnings analytics' },
      { icon: IconTarget, text: 'Supporter insights' }
    ]
  },
  {
    id: 'wallet-content',
    title: 'Wallet & Content',
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
    title: 'Stay Connected',
    description: 'Schedule events, chat with supporters, and never miss a zap notification.',
    image: '/chat_zap_2.png',
    features: [
      { icon: IconCalendar, text: 'Event calendar' },
      { icon: IconMessageCircle, text: 'Live chat with zaps' },
      { icon: IconBolt, text: 'Real-time notifications' }
    ]
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    showFAQ: true
  },
  {
    id: 'getting-started',
    title: 'How to Get Started',
    showGettingStarted: true
  },
  {
    id: 'cta',
    title: 'Ready to Start?',
    description: 'Join creators and builders using ZapTracker to track their Lightning earnings',
    image: null,
    showLogo: true,
    isFinal: true
  }
]

const faqItems = [
  {
    question: 'What is ZapTracker?',
    answer: 'ZapTracker is a comprehensive dashboard for tracking Lightning Network zaps and payments. It helps creators, businesses, and node operators monitor their Lightning activity, analyze earnings, and grow their presence on the Lightning Network.'
  },
  {
    question: 'Do I need to login to use ZapTracker?',
    answer: 'You can explore Lightning Network statistics without logging in. However, to track your personal zaps, earnings, and use features like wallet management and content creation, you need to connect with your Nostr account.'
  },
  {
    question: 'What is Nostr and why do I need it?',
    answer: 'Nostr is a decentralized protocol for social networking. ZapTracker uses Nostr for authentication because it\'s permissionless, censorship-resistant, and integrates natively with Lightning Network zaps. Your Nostr key is your identity across the network.'
  },
  {
    question: 'Is my wallet safe with ZapTracker?',
    answer: 'Yes! ZapTracker uses NWC (Nostr Wallet Connect) which means your wallet stays in your control. We never have access to your funds - we only read transaction data that you explicitly authorize through NWC.'
  },
  {
    question: 'What features are available without login?',
    answer: 'Without logging in, you can view Lightning Network statistics, explore global node distribution, see network capacity by country, and learn about ZapTracker\'s features. Personal tracking and wallet features require authentication.'
  },
  {
    question: 'How do I connect my wallet?',
    answer: 'After logging in with Nostr, navigate to Settings > Wallet and connect using NWC (Nostr Wallet Connect). You\'ll get a connection string from your Lightning wallet provider (like Alby, Mutiny, or Zeus).'
  }
]

const gettingStartedSteps = [
  {
    number: 1,
    icon: IconLogin,
    title: 'Connect with Nostr',
    description: 'Click the "Connect with Nostr" button and use your Nostr extension (like nos2x or Alby) or paste your public key.',
    required: true
  },
  {
    number: 2,
    icon: IconWallet,
    title: 'Connect Your Wallet (Optional)',
    description: 'Go to Settings > Wallet and connect your Lightning wallet using NWC to track payments and enable advanced features.',
    required: false
  },
  {
    number: 3,
    icon: IconChartBar,
    title: 'Explore Your Dashboard',
    description: 'View your zaps, analyze earnings trends, and discover insights about your Lightning activity.',
    required: false
  },
  {
    number: 4,
    icon: IconTarget,
    title: 'Create Campaigns & Content',
    description: 'Use the Campaigns and Content sections to monetize your work and engage with supporters.',
    required: false
  }
]

const nextSlide = () => {
  if (currentSlide.value < totalSlides - 1) {
    currentSlide.value++
  }
}

const prevSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--
  }
}

const goToSlide = (index) => {
  currentSlide.value = index
}

const handleConnect = () => {
  emit('trigger-login')
  markWelcomeSeen()
  emit('close')
}

const handleExplore = () => {
  markWelcomeSeen()
  emit('close')
}

const markWelcomeSeen = () => {
  localStorage.setItem('zaptracker_welcome_seen', 'true')
}

onMounted(() => {
  if (props.autoShow) {
    const hasSeenWelcome = localStorage.getItem('zaptracker_welcome_seen') === 'true'
    if (hasSeenWelcome) {
      emit('close')
    }
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <!-- Modal Container -->
      <div class="relative w-full max-w-5xl h-[85vh] bg-white rounded-3xl shadow-2xl flex flex-col animate-scale-in overflow-hidden">
        <!-- Close Button -->
        <button
          @click="handleExplore"
          class="absolute top-4 right-4 z-50 p-2 text-gray-500 hover:text-gray-700 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-110 transition-all duration-200"
        >
          <IconX class="w-6 h-6" />
        </button>

        <!-- Slides Container -->
        <div class="relative flex-1 overflow-y-auto pb-24">
          <!-- Slide Content -->
          <div
            v-for="(slide, index) in slides"
            :key="slide.id"
            v-show="currentSlide === index"
            class="min-h-full p-10 sm:p-16 flex flex-col justify-center transition-all duration-500"
            :class="currentSlide === index ? 'animate-slide-in' : ''"
          >
            <!-- Logo for Hero & Final Slides -->
            <div v-if="slide.showLogo" class="flex justify-center mb-12">
              <div class="w-32 h-32 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse-glow">
                <IconBolt class="w-16 h-16 text-white" />
              </div>
            </div>

            <!-- Slide Title -->
            <div class="text-center mb-10">
              <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-5 leading-tight">
                {{ slide.title }}
              </h2>
              <p v-if="slide.subtitle" class="text-xl text-gray-600 mb-4 leading-relaxed">
                {{ slide.subtitle }}
              </p>
              <p v-if="slide.description && !slide.showFAQ && !slide.showGettingStarted" class="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                {{ slide.description }}
              </p>
            </div>

            <!-- FAQ Content -->
            <div v-if="slide.showFAQ" class="max-w-3xl mx-auto w-full space-y-3 pb-6">
              <div
                v-for="(item, idx) in faqItems"
                :key="idx"
                class="bg-orange-50/50 rounded-xl p-5 border border-orange-100 hover:border-orange-200 transition-all"
              >
                <div class="flex items-start space-x-3">
                  <IconHelp class="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-gray-900 mb-1.5 text-sm">{{ item.question }}</h3>
                    <p class="text-gray-600 text-sm leading-relaxed">{{ item.answer }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Getting Started Content -->
            <div v-if="slide.showGettingStarted" class="max-w-3xl mx-auto w-full space-y-4 pb-6">
              <div
                v-for="step in gettingStartedSteps"
                :key="step.number"
                class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100 hover:border-orange-300 transition-all"
              >
                <div class="flex items-start space-x-4">
                  <div class="flex-shrink-0">
                    <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md">
                      {{ step.number }}
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center flex-wrap gap-2 mb-2">
                      <component :is="step.icon" class="w-4 h-4 text-orange-600 flex-shrink-0" />
                      <h3 class="font-semibold text-gray-900 text-sm">{{ step.title }}</h3>
                      <span v-if="step.required" class="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">Required</span>
                      <span v-else class="text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full flex-shrink-0">Optional</span>
                    </div>
                    <p class="text-gray-600 text-sm leading-relaxed">{{ step.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Feature Image -->
            <div v-if="slide.image" class="flex justify-center my-8">
              <div class="relative max-w-2xl w-full rounded-xl overflow-hidden shadow-2xl border-4 border-orange-100">
                <img
                  :src="slide.image"
                  :alt="slide.title"
                  class="w-full h-auto"
                />
              </div>
            </div>

            <!-- Features List -->
            <div v-if="slide.features" class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div
                v-for="(feature, idx) in slide.features"
                :key="idx"
                class="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-100"
              >
                <component :is="feature.icon" class="w-6 h-6 text-orange-600 flex-shrink-0" />
                <span class="text-sm font-medium text-gray-800">{{ feature.text }}</span>
              </div>
            </div>

            <!-- CTA Buttons (Final Slide) -->
            <div v-if="slide.isFinal" class="flex flex-col sm:flex-row gap-5 justify-center mt-12 max-w-3xl mx-auto">
              <button
                @click="handleConnect"
                class="px-12 py-5 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 text-white text-lg font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
              >
                <IconLogin class="w-6 h-6" />
                <span>Connect with Nostr</span>
              </button>
              <button
                @click="handleExplore"
                class="px-12 py-5 bg-white border-2 border-orange-300 text-orange-600 text-lg font-semibold rounded-2xl hover:bg-orange-50 hover:border-orange-400 hover:scale-105 transition-all duration-200"
              >
                Explore Without Login
              </button>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-12 pb-6 px-8">
          <div class="flex items-center justify-between max-w-5xl mx-auto">
            <!-- Previous Button -->
            <button
              @click="prevSlide"
              :disabled="currentSlide === 0"
              class="p-3 rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 shadow-md"
            >
              <IconChevronLeft class="w-7 h-7" />
            </button>

            <!-- Slide Indicators -->
            <div class="flex space-x-2">
              <button
                v-for="(slide, index) in slides"
                :key="index"
                @click="goToSlide(index)"
                class="transition-all duration-300"
                :class="[
                  currentSlide === index
                    ? 'w-8 h-3 bg-gradient-to-r from-orange-500 to-amber-500'
                    : 'w-3 h-3 bg-gray-300 hover:bg-gray-400'
                ]"
                style="border-radius: 9999px;"
              />
            </div>

            <!-- Next Button -->
            <button
              @click="nextSlide"
              :disabled="currentSlide === totalSlides - 1"
              class="p-3 rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200 hover:scale-110 shadow-md"
            >
              <IconChevronRight class="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
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

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(251, 146, 60, 0.5);
  }
  50% {
    box-shadow: 0 0 40px rgba(251, 146, 60, 0.8);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

.animate-slide-in {
  animation: slide-in 0.4s ease-out;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
</style>
