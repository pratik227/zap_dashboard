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
  IconUsers,
  IconLogin
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'

const emit = defineEmits(['close'])

const { login, loginWithRemote, isLoading, authError } = useNostrAuth()
const showBunkerInput = ref(false)
const bunkerUri = ref('')

const currentSlide = ref(0)
const totalSlides = 10

const hasSeenWelcome = () => {
  return storageService.getRaw(STORAGE_KEYS.WELCOME_SEEN) === 'true'
}

const markWelcomeSeen = () => {
  storageService.setRaw(STORAGE_KEYS.WELCOME_SEEN, 'true')
}

const slides = [
  {
    id: 'welcome',
    title: 'Welcome to ZapTracker',
    subtitle: 'Your Lightning Network Command Center',
    description: 'Track, analyze, and grow your Lightning Network presence with powerful analytics and insights.',
    showLogo: true
  },
  {
    id: 'analytics',
    title: 'Powerful Analytics',
    description: 'Get real-time insights into your zap activity, earnings trends, and supporter engagement. Visualize your growth with beautiful charts and detailed metrics.',
    image: '/analytics.png',
    features: [
      { icon: IconChartBar, text: 'Real-time zap tracking' },
      { icon: IconBolt, text: 'Earnings analytics' },
      { icon: IconTarget, text: 'Engagement metrics' }
    ]
  },
  {
    id: 'wallet',
    title: 'Lightning Wallet Integration',
    description: 'Connect your Lightning wallet via NWC (Nostr Wallet Connect) for seamless payment tracking and management. Monitor your balance and transactions in real-time.',
    image: '/wallet.png',
    features: [
      { icon: IconWallet, text: 'NWC wallet support' },
      { icon: IconBolt, text: 'Balance tracking' },
      { icon: IconTarget, text: 'Transaction history' }
    ]
  },
  {
    id: 'content',
    title: 'Long-Form Content & Short Notes',
    description: 'Publish long-form articles and short notes directly to Nostr. Monetize your content with zaps and track which posts resonate with your audience.',
    image: '/dashboard.png',
    features: [
      { icon: IconFileText, text: 'Long-form articles (NIP-23)' },
      { icon: IconMessageCircle, text: 'Short notes & tweets' },
      { icon: IconBolt, text: 'Content monetization' }
    ]
  },
  {
    id: 'zapfeed',
    title: 'Zap Feed & Profile Cards',
    description: 'See every zap in real-time with detailed profile cards. Discover who supports you, track top contributors, and engage with your community effectively.',
    image: '/zaps.png',
    features: [
      { icon: IconBolt, text: 'Live zap feed' },
      { icon: IconUsers, text: 'Supporter profiles' },
      { icon: IconTarget, text: 'Top contributors' }
    ]
  },
  {
    id: 'audience',
    title: 'Stay Connected with Your Audience',
    description: 'Build relationships with your supporters through integrated chat and audience insights. Track follower growth and engagement patterns to optimize your content strategy.',
    image: '/chat_zap_2.png',
    features: [
      { icon: IconUsers, text: 'Audience analytics' },
      { icon: IconMessageCircle, text: 'Integrated chat' },
      { icon: IconCalendar, text: 'Event scheduling' }
    ]
  },
  {
    id: 'zapgoals',
    title: 'Set and Track Zap Goals',
    description: 'Create fundraising campaigns with customizable goals. Share campaign links, track progress in real-time, and celebrate milestones with your community.',
    image: '/ZapTracker_campaigns.png',
    features: [
      { icon: IconTarget, text: 'Campaign creation' },
      { icon: IconBolt, text: 'Goal tracking' },
      { icon: IconChartBar, text: 'Progress analytics' }
    ]
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    faqs: [
      {
        q: 'What is ZapTracker?',
        a: 'ZapTracker is a comprehensive analytics platform for Lightning Network zaps on Nostr. Track earnings, analyze engagement, and grow your Lightning presence.'
      },
      {
        q: 'Do I need a Nostr account?',
        a: 'For full features, yes. However, you can explore with view-only mode using any public npub to see what ZapTracker offers.'
      },
      {
        q: 'How do I connect my Lightning wallet?',
        a: 'Connect via NWC (Nostr Wallet Connect). We support all major Lightning wallets that offer NWC connections for secure payment tracking.'
      },
      {
        q: 'Is my data private?',
        a: 'Yes! ZapTracker only reads public Nostr data and never stores your private keys. Your wallet connection uses secure NWC protocol.'
      },
      {
        q: 'Can I publish content from ZapTracker?',
        a: 'Absolutely! Create long-form articles (NIP-23) and short notes directly to Nostr, all with built-in monetization tracking.'
      },
      {
        q: 'How much does it cost?',
        a: 'ZapTracker is free to use! Built with open-source principles for the Nostr ecosystem.'
      }
    ]
  },
  {
    id: 'howto',
    title: 'How to Get Started',
    steps: [
      {
        number: '1',
        title: 'Connect Your Account',
        description: 'Sign in with your Nostr account using any compatible extension or app.'
      },
      {
        number: '2',
        title: 'Link Your Lightning Wallet',
        description: 'Connect via NWC to enable payment tracking and wallet features.'
      },
      {
        number: '3',
        title: 'Explore Your Dashboard',
        description: 'View your analytics, check your zap feed, and discover insights about your audience.'
      },
      {
        number: '4',
        title: 'Create & Share Content',
        description: 'Publish articles or notes and track how they perform with your community.'
      }
    ]
  },
  {
    id: 'cta',
    title: 'Let\'s Dive In!',
    subtitle: 'Choose how you want to explore ZapTracker',
    description: 'Connect with your Nostr account for full features, or try view-only mode to explore the platform.',
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

const handleGetStarted = async () => {
  markWelcomeSeen()
  emit('close')
  setTimeout(async () => {
    try {
      await login()
    } catch (error) {
      console.error('Extension login failed:', error)
    }
  }, 300)
}

const handleBunkerLogin = async () => {
  if (!bunkerUri.value.trim()) return
  markWelcomeSeen()
  emit('close')
  setTimeout(async () => {
    try {
      await loginWithRemote(bunkerUri.value.trim())
    } catch (error) {
      console.error('Remote login failed:', error)
    }
  }, 300)
}

onMounted(() => {
  if (hasSeenWelcome()) {
    emit('close')
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-fade-in" @keydown.escape="handleSkip">
    <div class="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
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
      <div class="relative overflow-y-auto" style="max-height: calc(90vh - 140px);">
        <transition name="slide-fade" mode="out-in">
          <div :key="currentSlide" class="p-8 sm:p-12">
            <!-- Page 1: Welcome -->
            <div v-if="currentSlideData.id === 'welcome'" class="text-center space-y-6">
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
                  <span>Take a Tour</span>
                  <IconChevronRight class="w-5 h-5" />
                </button>
                <button
                  @click="handleGetStarted"
                  class="px-8 py-4 bg-white border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all duration-200"
                >
                  Connect Now
                </button>
              </div>
            </div>

            <!-- Pages 2-7: Features with Screenshots -->
            <div v-else-if="currentSlideData.features" class="space-y-6">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  {{ currentSlideData.description }}
                </p>
              </div>

              <!-- Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center my-6">
                <div class="relative max-w-3xl w-full">
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
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-6">
                <div
                  v-for="(feature, index) in currentSlideData.features"
                  :key="index"
                  class="flex items-start space-x-3 p-4 bg-orange-50 rounded-xl"
                >
                  <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <component :is="feature.icon" class="w-5 h-5 text-white" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 pt-2">{{ feature.text }}</span>
                </div>
              </div>
            </div>

            <!-- Page 8: FAQ -->
            <div v-else-if="currentSlideData.id === 'faq'" class="space-y-6">
              <div class="text-center mb-8">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Everything you need to know about ZapTracker
                </p>
              </div>

              <div class="max-w-3xl mx-auto space-y-4">
                <div
                  v-for="(faq, index) in currentSlideData.faqs"
                  :key="index"
                  class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100"
                >
                  <h3 class="font-bold text-gray-900 mb-2 flex items-start">
                    <span class="text-orange-500 mr-2">Q:</span>
                    <span>{{ faq.q }}</span>
                  </h3>
                  <p class="text-gray-600 text-sm leading-relaxed ml-6">
                    {{ faq.a }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Page 9: How to Get Started -->
            <div v-else-if="currentSlideData.id === 'howto'" class="space-y-8">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Follow these simple steps to unlock all features
                </p>
              </div>

              <div class="max-w-2xl mx-auto space-y-6">
                <div
                  v-for="step in currentSlideData.steps"
                  :key="step.number"
                  class="flex items-start space-x-4 p-5 bg-white rounded-xl border-2 border-orange-100 hover:border-orange-300 transition-all"
                >
                  <div class="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="text-white text-xl font-bold">{{ step.number }}</span>
                  </div>
                  <div class="flex-1 pt-1">
                    <h3 class="font-bold text-gray-900 mb-1">{{ step.title }}</h3>
                    <p class="text-sm text-gray-600 leading-relaxed">{{ step.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page 10: Final CTA -->
            <div v-else-if="currentSlideData.isFinal" class="text-center space-y-6">
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

              <p class="text-xl text-orange-600 font-semibold">
                {{ currentSlideData.subtitle }}
              </p>

              <p class="text-base text-gray-600 max-w-2xl mx-auto">
                {{ currentSlideData.description }}
              </p>

              <!-- CTAs -->
              <div v-if="!showBunkerInput" class="flex flex-col gap-3 justify-center mt-8 max-w-md mx-auto">
                <button
                  @click="handleGetStarted"
                  class="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base rounded-xl font-bold hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-3"
                >
                  <IconLogin class="w-5 h-5" />
                  <span>Browser Extension</span>
                </button>
                <button
                  @click="showBunkerInput = true"
                  class="px-8 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-base rounded-xl font-bold hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-3"
                >
                  <IconBolt class="w-5 h-5" />
                  <span>Amber / Remote Signer</span>
                </button>
              </div>

              <!-- Bunker URI Input -->
              <div v-else class="mt-8 max-w-md mx-auto space-y-3">
                <p class="text-sm font-semibold text-gray-900">Connect with Remote Signer (NIP-46)</p>
                <p class="text-xs text-gray-500">Paste your bunker:// URI from Amber, nsec.app, or another signer</p>
                <input
                  v-model="bunkerUri"
                  type="text"
                  placeholder="bunker://... or nostrconnect://..."
                  class="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  @keyup.enter="handleBunkerLogin"
                />
                <div class="flex gap-2">
                  <button
                    @click="showBunkerInput = false; bunkerUri = ''"
                    class="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    @click="handleBunkerLogin"
                    :disabled="!bunkerUri.trim()"
                    class="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl text-sm font-bold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    Connect
                  </button>
                </div>
              </div>

              <div class="mt-8 pt-6 border-t border-gray-200">
                <a
                  href="https://usenostr.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-orange-600 hover:text-orange-700 hover:underline inline-block"
                >
                  New to Nostr? Learn more →
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

          <div class="text-sm text-gray-500 font-medium">
            {{ currentSlide + 1 }} / {{ totalSlides }}
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

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}

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
