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
  IconEye,
  IconLogin,
  IconInfoCircle,
  IconDashboard,
  IconBook,
  IconExternalLink
} from '@iconify-prerendered/vue-tabler'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'

const props = defineProps({
  autoShow: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'trigger-login', 'trigger-view-only'])

const currentSlide = ref(0)
const totalSlides = 12

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
    showLogo: true
  },
  {
    id: 'requirements',
    title: 'What You\'ll Need',
    subtitle: 'Get set up in just a few minutes'
  },
  {
    id: 'dashboard',
    title: 'Your Command Center',
    description: 'Get a comprehensive overview of your Lightning Network activity. Track your zaps, earnings, and engagement all in one beautiful dashboard.',
    image: '/Onboarding-Pictures/dashboard.png',
    features: [
      { icon: IconDashboard, text: 'Real-time overview' },
      { icon: IconBolt, text: 'Earnings at a glance' },
      { icon: IconChartBar, text: 'Quick insights' }
    ]
  },
  {
    id: 'analytics',
    title: 'Powerful Analytics',
    description: 'Get real-time insights into your zap activity, earnings trends, and supporter engagement. Visualize your growth with beautiful charts and detailed metrics.',
    image: '/Onboarding-Pictures/analytics.png',
    features: [
      { icon: IconChartBar, text: 'Real-time zap tracking' },
      { icon: IconBolt, text: 'Earnings analytics' },
      { icon: IconTarget, text: 'Engagement metrics' }
    ]
  },
  {
    id: 'zapfeed',
    title: 'Zap Feed & Profile Cards',
    description: 'See every zap in real-time with detailed profile cards. Discover who supports you, track top contributors, and engage with your community effectively.',
    image: '/Onboarding-Pictures/zapfeed.png',
    features: [
      { icon: IconBolt, text: 'Live zap feed' },
      { icon: IconUsers, text: 'Supporter profiles' },
      { icon: IconTarget, text: 'Top contributors' }
    ]
  },
  {
    id: 'content',
    title: 'Long-Form Content & Short Notes',
    description: 'Publish long-form articles and short notes directly to Nostr. Monetize your content with zaps and track which posts resonate with your audience.',
    images: ['/Onboarding-Pictures/longform.png', '/Onboarding-Pictures/notes.png'],
    features: [
      { icon: IconFileText, text: 'Long-form articles (NIP-23)' },
      { icon: IconMessageCircle, text: 'Short notes & tweets' },
      { icon: IconBolt, text: 'Content monetization' }
    ]
  },
  {
    id: 'audience',
    title: 'Stay Connected with Your Audience',
    description: 'Build relationships with your supporters through integrated chat and audience insights. Track follower growth and engagement patterns to optimize your content strategy.',
    images: ['/Onboarding-Pictures/audiance.png', '/Onboarding-Pictures/chat.png'],
    features: [
      { icon: IconUsers, text: 'Audience analytics' },
      { icon: IconMessageCircle, text: 'Integrated chat' },
      { icon: IconCalendar, text: 'Event scheduling' }
    ]
  },
  {
    id: 'zapgoals',
    title: 'Set and Track Zap Goals',
    image: '/Onboarding-Pictures/campaigns.png'
  },
  {
    id: 'calendar',
    title: 'Schedule Events & Meetups',
    description: 'Create and share calendar events with your community. Organize online or in-person meetups, invite participants, and coordinate seamlessly using Nostr calendar events.',
    image: '/Onboarding-Pictures/calendar.png',
    features: [
      { icon: IconCalendar, text: 'Create calendar events' },
      { icon: IconUsers, text: 'Invite participants' },
      { icon: IconTarget, text: 'Share event links' }
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
    subtitle: 'Connect with your Nostr account for full features, or try view-only mode to explore the platform.',
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
  emit('trigger-login')
}

const handleViewOnly = () => {
  markWelcomeSeen()
  emit('close')
  emit('trigger-view-only')
}

const openDocs = () => {
  window.open('https://docs-zaptracker.netlify.app', '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fade-in">
    <div class="bg-white rounded-3xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden animate-scale-in">
      <!-- Header -->
      <div class="relative p-5 border-b border-gray-200">
        <button
          @click="handleSkip"
          class="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
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
              'h-1.5 rounded-full transition-all duration-300',
              currentSlide === index
                ? 'w-8 bg-gradient-to-r from-orange-500 to-amber-500'
                : 'w-1.5 bg-gray-300 hover:bg-gray-400'
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
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-3xl opacity-20"></div>
                  <img
                    src="/new_logo3.png"
                    alt="ZapTracker Logo"
                    class="relative w-28 h-28 object-contain"
                  />
                </div>
              </div>

              <h1 class="text-4xl sm:text-5xl font-semibold text-gray-900 tracking-tight">
                {{ currentSlideData.title }}
              </h1>

              <p class="text-xl sm:text-2xl text-orange-600 font-medium mb-12">
                {{ currentSlideData.subtitle }}
              </p>

              <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
                <button
                  @click="nextSlide"
                  class="flex-1 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <span>Take a Tour</span>
                  <IconChevronRight class="w-5 h-5" />
                </button>
                <button
                  @click="handleGetStarted"
                  class="flex-1 px-8 py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                >
                  Connect Now
                </button>
              </div>
            </div>

            <!-- Page 2: Requirements -->
            <div v-else-if="currentSlideData.id === 'requirements'" class="space-y-8">
              <div class="text-center max-w-2xl mx-auto">
                <h2 class="text-3xl sm:text-4xl font-semibold text-gray-900 mb-4 tracking-tight">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Two simple things to get started
                </p>
              </div>

              <div class="max-w-2xl mx-auto space-y-3">
                <!-- Nostr Identity - Required -->
                <div class="group bg-white rounded-xl p-6 border-2 border-orange-200 hover:border-orange-300 hover:shadow-md transition-all duration-200">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconLogin class="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900">Nostr Identity</h3>
                        <p class="text-xs text-orange-600 font-medium">Required to connect</p>
                      </div>
                    </div>
                    <div class="relative group/tooltip">
                      <IconInfoCircle class="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" />
                      <div class="absolute right-0 top-8 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-10 shadow-xl">
                        <p class="leading-relaxed">Your Nostr identity is like a universal login that works across all Nostr apps. No passwords or emails needed - just one key for everything.</p>
                      </div>
                    </div>
                  </div>
                  <p class="text-sm text-gray-600 mb-4">
                    Don't have one? Create yours in under a minute.
                  </p>
                  <a
                    href="https://nostrid.mybuho.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                  >
                    <span>Get Nostr Identity</span>
                    <IconChevronRight class="w-4 h-4" />
                  </a>
                </div>

                <!-- Lightning Wallet - Optional -->
                <div class="group bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconWallet class="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900">Lightning Wallet</h3>
                        <p class="text-xs text-gray-600 font-medium">Optional - add anytime</p>
                      </div>
                    </div>
                    <div class="relative group/tooltip">
                      <IconInfoCircle class="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-help" />
                      <div class="absolute right-0 top-8 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-10 shadow-xl">
                        <p class="leading-relaxed">Connect via NWC (Nostr Wallet Connect) to send and receive zaps. Your wallet stays secure - ZapTracker only tracks payments. You can explore without one and add it later in Settings.</p>
                      </div>
                    </div>
                  </div>
                  <p class="text-sm text-gray-600">
                    Explore ZapTracker now, connect your wallet later from Settings.
                  </p>
                </div>
              </div>
            </div>

            <!-- Pages 3-7: Features with Screenshots -->
            <div v-else-if="currentSlideData.features" class="space-y-6">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
                  {{ currentSlideData.description }}
                </p>
              </div>

              <!-- Single Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center my-8">
                <div class="relative max-w-3xl w-full">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl blur-2xl opacity-10"></div>
                  <img
                    :src="currentSlideData.image"
                    :alt="currentSlideData.title"
                    class="relative w-full h-auto rounded-2xl shadow-lg border border-gray-200"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Dual Screenshots Grid -->
              <div v-else-if="currentSlideData.images" class="grid grid-cols-1 md:grid-cols-2 gap-4 my-8 max-w-4xl mx-auto">
                <div
                  v-for="(image, index) in currentSlideData.images"
                  :key="index"
                  class="relative"
                >
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl blur-2xl opacity-10"></div>
                  <img
                    :src="image"
                    :alt="`${currentSlideData.title} ${index + 1}`"
                    class="relative w-full h-auto rounded-2xl shadow-lg border border-gray-200"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Features List -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto mt-8">
                <div
                  v-for="(feature, index) in currentSlideData.features"
                  :key="index"
                  class="flex items-start space-x-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <div class="w-9 h-9 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <component :is="feature.icon" class="w-4 h-4 text-white" />
                  </div>
                  <span class="text-sm font-medium text-gray-700 pt-2">{{ feature.text }}</span>
                </div>
              </div>
            </div>

            <!-- Page 8: Campaigns - Empty State Preview Style -->
            <div v-else-if="currentSlideData.id === 'zapgoals'" class="space-y-6">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed mb-6">
                  Create fundraising campaigns with customizable goals. Share campaign links, track progress in real-time, and celebrate milestones with your community.
                </p>
              </div>

              <!-- Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center my-8">
                <div class="relative max-w-3xl w-full">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl blur-2xl opacity-10"></div>
                  <img
                    :src="currentSlideData.image"
                    :alt="currentSlideData.title"
                    class="relative w-full h-auto rounded-2xl shadow-lg border border-gray-200"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Campaign Ideas Grid -->
              <div class="max-w-3xl mx-auto">
                <h4 class="text-lg font-semibold text-gray-900 text-center mb-6">Great Campaign Ideas</h4>

                <div class="grid md:grid-cols-2 gap-3 mb-6">
                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconFileText class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Content Creation</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Fund a podcast series, video project, or article collection
                    </p>
                  </div>

                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconBolt class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Open Source Project</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Raise funds to build tools, apps, or contribute to Nostr
                    </p>
                  </div>

                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconCalendar class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Event or Meetup</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Cover costs for Bitcoin or Nostr conferences and workshops
                    </p>
                  </div>

                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconUsers class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Community Support</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Help with education or support causes that matter
                    </p>
                  </div>
                </div>

                <!-- Success Tips -->
                <div class="bg-orange-50/50 border border-orange-200 rounded-xl p-5">
                  <h5 class="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <IconChartBar class="w-4 h-4 text-orange-600" />
                    <span>Make Your Campaign Successful</span>
                  </h5>
                  <ul class="space-y-2 text-sm text-gray-700">
                    <li class="flex items-start space-x-2">
                      <span class="text-orange-600 font-medium mt-0.5">•</span>
                      <span>Set a specific target amount and explain what funds will be used for</span>
                    </li>
                    <li class="flex items-start space-x-2">
                      <span class="text-orange-600 font-medium mt-0.5">•</span>
                      <span>Share why this matters and how it will benefit the community</span>
                    </li>
                    <li class="flex items-start space-x-2">
                      <span class="text-orange-600 font-medium mt-0.5">•</span>
                      <span>Keep supporters informed about progress and milestones</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Page 9: Calendar Events -->
            <div v-else-if="currentSlideData.id === 'calendar'" class="space-y-6">
              <div class="text-center mb-6">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-4">
                  <IconCalendar class="w-8 h-8 text-white" />
                </div>
                <h2 class="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600 leading-relaxed max-w-2xl mx-auto">
                  {{ currentSlideData.description }}
                </p>
              </div>

              <!-- Screenshot -->
              <div v-if="currentSlideData.image" class="flex justify-center my-8">
                <div class="relative max-w-3xl w-full">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl blur-2xl opacity-10"></div>
                  <img
                    :src="currentSlideData.image"
                    :alt="currentSlideData.title"
                    class="relative w-full h-auto rounded-2xl shadow-lg border border-gray-200"
                    loading="lazy"
                  />
                </div>
              </div>

              <!-- Calendar Features Grid -->
              <div class="max-w-3xl mx-auto">
                <h4 class="text-lg font-semibold text-gray-900 text-center mb-6">What You Can Do</h4>

                <div class="grid md:grid-cols-2 gap-3 mb-6">
                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconCalendar class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Create Events</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Set up calendar events with date, time, location, and description
                    </p>
                  </div>

                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconUsers class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Invite Participants</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Share event invitations and see who's joining your meetup
                    </p>
                  </div>

                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconTarget class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Share Event Links</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      Generate shareable links for your events across Nostr
                    </p>
                  </div>

                  <div class="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:bg-gray-50 transition-all">
                    <div class="flex items-start space-x-3 mb-2">
                      <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <IconEye class="w-4 h-4 text-orange-600" />
                      </div>
                      <h5 class="font-medium text-gray-900">Track Attendance</h5>
                    </div>
                    <p class="text-sm text-gray-600">
                      See who's confirmed and manage your event participants
                    </p>
                  </div>
                </div>

                <!-- Event Types -->
                <div class="bg-orange-50/50 border border-orange-200 rounded-xl p-5">
                  <h5 class="font-medium text-gray-900 mb-3 flex items-center space-x-2">
                    <IconCalendar class="w-4 h-4 text-orange-600" />
                    <span>Perfect For</span>
                  </h5>
                  <ul class="space-y-2 text-sm text-gray-700">
                    <li class="flex items-start space-x-2">
                      <span class="text-orange-600 font-medium mt-0.5">•</span>
                      <span>Bitcoin and Nostr meetups in your city</span>
                    </li>
                    <li class="flex items-start space-x-2">
                      <span class="text-orange-600 font-medium mt-0.5">•</span>
                      <span>Online community calls, workshops, or discussions</span>
                    </li>
                    <li class="flex items-start space-x-2">
                      <span class="text-orange-600 font-medium mt-0.5">•</span>
                      <span>Conference coordination and networking events</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Page 10: FAQ -->
            <div v-else-if="currentSlideData.id === 'faq'" class="space-y-6">
              <div class="text-center mb-8">
                <h2 class="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Everything you need to know about ZapTracker
                </p>
              </div>

              <div class="max-w-3xl mx-auto space-y-3">
                <div
                  v-for="(faq, index) in currentSlideData.faqs"
                  :key="index"
                  class="bg-gray-50 rounded-xl p-5 border border-gray-200"
                >
                  <h3 class="font-medium text-gray-900 mb-2 flex items-start">
                    <span class="text-orange-500 mr-2 font-semibold">Q:</span>
                    <span>{{ faq.q }}</span>
                  </h3>
                  <p class="text-gray-600 text-sm leading-relaxed ml-6">
                    {{ faq.a }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Page 11: How to Get Started -->
            <div v-else-if="currentSlideData.id === 'howto'" class="space-y-8">
              <div class="text-center">
                <h2 class="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
                  {{ currentSlideData.title }}
                </h2>
                <p class="text-base text-gray-600">
                  Follow these simple steps to unlock all features
                </p>
              </div>

              <div class="max-w-2xl mx-auto space-y-4">
                <div
                  v-for="step in currentSlideData.steps"
                  :key="step.number"
                  class="flex items-start space-x-4 p-5 bg-gray-50 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-white transition-all"
                >
                  <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="text-white font-semibold">{{ step.number }}</span>
                  </div>
                  <div class="flex-1 pt-1">
                    <h3 class="font-medium text-gray-900 mb-1">{{ step.title }}</h3>
                    <p class="text-sm text-gray-600 leading-relaxed">{{ step.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Page 12: Final CTA -->
            <div v-else-if="currentSlideData.isFinal" class="text-center">
              <div class="flex justify-center mb-8">
                <div class="relative">
                  <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full blur-3xl opacity-20"></div>
                  <img
                    src="/new_logo3.png"
                    alt="ZapTracker Logo"
                    class="relative w-28 h-28 object-contain"
                  />
                </div>
              </div>

              <h2 class="text-4xl sm:text-5xl font-semibold text-gray-900 mb-6 tracking-tight">
                {{ currentSlideData.title }}
              </h2>

              <p class="text-base text-gray-600 max-w-2xl mx-auto mb-10">
                Connect your Nostr account to start tracking zaps, or visit our documentation to learn more about ZapTracker's features and use cases.
              </p>

              <!-- CTAs -->
              <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-2xl mx-auto mb-8">
                <button
                  @click="handleGetStarted"
                  class="flex-1 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <IconLogin class="w-5 h-5" />
                  <span>Connect with Nostr</span>
                </button>
                <button
                  @click="openDocs"
                  class="flex-1 px-8 py-4 bg-white border-2 border-orange-300 text-orange-700 rounded-xl font-medium hover:bg-orange-50 hover:border-orange-400 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <IconBook class="w-5 h-5" />
                  <span>Read Documentation</span>
                </button>
              </div>

              <!-- Documentation Info Card -->
              <div class="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-8 max-w-2xl mx-auto">
                <div class="flex items-start space-x-4 mb-6">
                  <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                    <IconBook class="w-6 h-6 text-white" />
                  </div>
                  <div class="flex-1 text-left">
                    <h4 class="font-semibold text-gray-900 mb-2 text-lg">Explore the Documentation</h4>
                    <p class="text-sm text-gray-700 leading-relaxed">
                      Get comprehensive guides, detailed feature explanations, and practical use cases. Perfect for understanding how to maximize ZapTracker's potential.
                    </p>
                  </div>
                </div>

                <div class="grid md:grid-cols-3 gap-3">
                  <div class="bg-white/70 rounded-lg p-4 border border-orange-200">
                    <div class="flex items-center space-x-2 mb-2">
                      <IconTarget class="w-4 h-4 text-orange-600" />
                      <h5 class="font-medium text-gray-900 text-sm">Use Cases</h5>
                    </div>
                    <p class="text-xs text-gray-600">Real-world examples and scenarios</p>
                  </div>

                  <div class="bg-white/70 rounded-lg p-4 border border-orange-200">
                    <div class="flex items-center space-x-2 mb-2">
                      <IconChartBar class="w-4 h-4 text-orange-600" />
                      <h5 class="font-medium text-gray-900 text-sm">Feature Guides</h5>
                    </div>
                    <p class="text-xs text-gray-600">Step-by-step tutorials</p>
                  </div>

                  <div class="bg-white/70 rounded-lg p-4 border border-orange-200">
                    <div class="flex items-center space-x-2 mb-2">
                      <IconInfoCircle class="w-4 h-4 text-orange-600" />
                      <h5 class="font-medium text-gray-900 text-sm">FAQ & Help</h5>
                    </div>
                    <p class="text-xs text-gray-600">Common questions answered</p>
                  </div>
                </div>
              </div>

              <div class="mt-8 flex items-center justify-center gap-6 text-sm">
                <a
                  href="https://usenostr.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-orange-600 hover:text-orange-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>New to Nostr?</span>
                  <IconExternalLink class="w-3.5 h-3.5" />
                </a>
                <span class="text-gray-300">•</span>
                <a
                  href="https://docs-zaptracker.netlify.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-orange-600 hover:text-orange-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>View Full Documentation</span>
                  <IconExternalLink class="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Navigation Footer -->
      <div class="border-t border-gray-200 p-5 bg-white">
        <div class="flex justify-between items-center">
          <button
            @click="prevSlide"
            :disabled="!canGoPrev"
            :class="[
              'px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-1.5',
              canGoPrev
                ? 'text-gray-700 hover:bg-gray-100'
                : 'text-gray-400 cursor-not-allowed'
            ]"
          >
            <IconChevronLeft class="w-4 h-4" />
            <span class="text-sm">Back</span>
          </button>

          <div class="text-sm text-gray-500 font-medium">
            {{ currentSlide + 1 }} / {{ totalSlides }}
          </div>

          <button
            v-if="canGoNext"
            @click="nextSlide"
            class="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-md transition-all duration-200 flex items-center space-x-1.5"
          >
            <span class="text-sm">Next</span>
            <IconChevronRight class="w-4 h-4" />
          </button>
          <button
            v-else
            @click="handleGetStarted"
            class="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:shadow-md transition-all duration-200 text-sm"
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
