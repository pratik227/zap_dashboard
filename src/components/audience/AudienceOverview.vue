<script setup>
import { computed, ref, onMounted } from 'vue'
import {
  IconUsers,
  IconList,
  IconUserPlus,
  IconSearch,
  IconBolt,
  IconShield,
  IconGlobe,
  IconArrowRight,
  IconTarget,
  IconHeart,
  IconStar,
  IconRocket,
  IconTrendingUp,
  IconEye,
  IconCheck,
  IconChevronRight,
  IconSparkles,
  IconNetwork,
  IconShare
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useAudience } from '../../composables/audience/useAudience.js'
import NostrProfileShareModal from '../modals/NostrProfileShareModal.vue'

const emit = defineEmits(['create-list', 'switch-tab', 'follow-suggestions'])

const { userProfile } = useNostrAuth()
const { getFollowingCount, getFollowersCount, myLists } = useAudience()

// UI state
const showQuickStart = ref(true)
const completedSteps = ref(new Set())
const showShareModal = ref(false)

// Check user's progress
const userProgress = computed(() => {
  const following = getFollowingCount()
  const followers = getFollowersCount()
  const lists = myLists.value.length
  
  return {
    hasFollowing: following > 0,
    hasFollowers: followers > 0,
    hasLists: lists > 0,
    isNewUser: following === 0 && followers === 0 && lists === 0
  }
})

// Onboarding steps for new users
const onboardingSteps = computed(() => [
  {
    id: 'discover',
    title: 'Discover People',
    description: 'Find interesting people to follow',
    icon: IconSearch,
    color: 'from-blue-400 to-cyan-400',
    action: () => emit('switch-tab', 'suggestions'),
    completed: userProgress.value.hasFollowing,
    priority: 1
  },
  {
    id: 'organize',
    title: 'Create Lists',
    title: 'Create Follow Packs',
    description: 'Organize your network into themed packs',
    icon: IconList,
    color: 'from-green-400 to-emerald-400',
    action: () => emit('create-list'),
    completed: userProgress.value.hasLists,
    priority: 2
  },
  {
    id: 'engage',
    title: 'Share Profile',
    description: 'Share your Nostr profile to gain followers',
    icon: IconShare,
    color: 'from-purple-400 to-pink-400',
    action: () => showShareModal.value = true,
    completed: userProgress.value.hasFollowers,
    priority: 3
  }
])

// Quick stats for existing users
const quickStats = computed(() => [
  {
    label: 'Following',
    value: getFollowingCount(),
    icon: IconUserPlus,
    color: 'text-orange-600 bg-orange-100',
    action: () => emit('switch-tab', 'following')
  },
  {
    label: 'Followers',
    value: getFollowersCount(),
    icon: IconUsers,
    color: 'text-blue-600 bg-blue-100',
    action: () => emit('switch-tab', 'followers')
  },
  {
    label: 'Lists',
    label: 'Follow Packs',
    value: myLists.value.length,
    icon: IconList,
    color: 'text-green-600 bg-green-100',
    action: () => emit('switch-tab', 'lists')
  }
])

// Mark step as completed
const markStepCompleted = (stepId) => {
  completedSteps.value.add(stepId)
}

// Get next recommended action
const nextAction = computed(() => {
  const incompleteSteps = onboardingSteps.value.filter(step => !step.completed)
  return incompleteSteps.length > 0 ? incompleteSteps[0] : null
})

// Open share modal
const openShareModal = () => {
  showShareModal.value = true
}

// Close share modal
const closeShareModal = () => {
  showShareModal.value = false
}

onMounted(() => {
  // Auto-hide quick start for experienced users
  if (!userProgress.value.isNewUser) {
    showQuickStart.value = false
  }
})
</script>

<template>
  <div class="space-y-10">
    <!-- New User Welcome & Quick Start -->
    <div v-if="userProgress.isNewUser" class="text-center py-8">
      <div class="w-24 h-24 bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-xl">
        <IconSparkles class="w-10 h-10 text-white" />
      </div>
      <h2 class="text-3xl font-bold text-gray-900 mb-6">
        Welcome to Nostr, {{ userProfile?.name || 'Creator' }}!
      </h2>
      <p class="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed mb-10">
        Let's help you build your decentralized social network. Follow these simple steps to get started.
      </p>
      
      <!-- Primary CTA for New Users -->
      <button
        @click="emit('switch-tab', 'suggestions')"
        class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-10 py-5 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center space-x-3 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
      >
        <IconRocket class="w-6 h-6" />
        <span>Start Building Your Network</span>
        <IconArrowRight class="w-6 h-6" />
      </button>
    </div>

    <!-- Existing User Dashboard -->

    <!-- Progress Steps for New Users -->
    <div v-if="userProgress.isNewUser" class="bg-white/90 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg p-8 sm:p-10">
      <div class="flex items-center justify-between mb-8">
        <h3 class="text-xl font-bold text-gray-900">Getting Started</h3>
        <div class="text-sm text-gray-500">
          {{ onboardingSteps.filter(s => s.completed).length }}/{{ onboardingSteps.length }} completed
        </div>
      </div>
      
      <div class="space-y-6">
        <div
          v-for="(step, index) in onboardingSteps"
          :key="step.id"
          class="group"
        >
          <button
            @click="step.action"
            :class="[
              'w-full p-6 rounded-xl border-2 transition-all duration-300 text-left',
              step.completed 
                ? 'border-green-200 bg-green-50 hover:bg-green-100' 
                : index === 0 || onboardingSteps[index - 1]?.completed
                  ? 'border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 hover:shadow-md transform hover:-translate-y-1'
                  : 'border-gray-200 bg-gray-50 opacity-60'
            ]"
            :disabled="!step.completed && index > 0 && !onboardingSteps[index - 1]?.completed"
          >
            <div class="flex items-center space-x-5">
              <!-- Step Number/Status -->
              <div :class="[
                'w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm',
                step.completed 
                  ? 'bg-green-500 text-white' 
                  : `bg-gradient-to-r ${step.color} text-white`
              ]">
                <IconCheck v-if="step.completed" class="w-6 h-6" />
                <component v-else :is="step.icon" class="w-6 h-6" />
              </div>
              
              <!-- Step Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-3 mb-2">
                  <h4 class="font-semibold text-gray-900 text-lg">{{ step.title }}</h4>
                  <span v-if="step.completed" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    ✓ Done
                  </span>
                  <span v-else-if="index === 0 || onboardingSteps[index - 1]?.completed" class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium animate-pulse">
                    Next
                  </span>
                </div>
                <p class="text-gray-600 text-base">{{ step.description }}</p>
              </div>
              
              <!-- Arrow -->
              <IconChevronRight :class="[
                'w-6 h-6 transition-all duration-200',
                step.completed ? 'text-green-500' : 'text-orange-500 group-hover:translate-x-1'
              ]" />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats for Existing Users -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <button
        v-for="stat in quickStats"
        :key="stat.label"
        @click="stat.action"
        class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-8 text-center group transform hover:-translate-y-1"
      >
        <div :class="['w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200', stat.color]">
          <component :is="stat.icon" class="w-6 h-6" />
        </div>
        <div class="text-3xl font-bold text-gray-900 mb-2">{{ stat.value.toLocaleString() }}</div>
        <div class="text-base text-gray-600">{{ stat.label }}</div>
      </button>
    </div>

    <!-- Next Recommended Action -->
    <div v-if="nextAction && !userProgress.isNewUser" class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-8">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div class="flex items-center space-x-5">
          <div class="w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-r from-orange-400 to-amber-400 shadow-lg">
            <component :is="nextAction.icon" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 class="font-semibold text-gray-900 mb-2 text-lg">{{ nextAction.title }}</h4>
            <p class="text-gray-600 text-base">{{ nextAction.description }}</p>
          </div>
        </div>
        <button
          @click="nextAction.action"
          class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-105 whitespace-nowrap"
        >
          <span>Get Started</span>
          <IconArrowRight class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Quick Actions Grid -->
    <div v-if="!userProgress.isNewUser">
      <h3 class="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-3">
        <IconTrendingUp class="w-5 h-5 text-orange-600" />
        <span>Quick Actions</span>
      </h3>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Discover New People -->
        <button
          @click="emit('switch-tab', 'suggestions')"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-8 text-left group transform hover:-translate-y-1"
        >
          <div class="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-r from-blue-400 to-cyan-400 group-hover:scale-110 transition-transform duration-200 shadow-lg">
            <IconUserPlus class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-3 text-lg group-hover:text-blue-600 transition-colors">
            Discover People
          </h4>
          <p class="text-base text-gray-600 mb-4 leading-relaxed">Find interesting people based on your network</p>
          <div class="flex items-center text-blue-600 text-base font-medium">
            <span>View Suggestions</span>
            <IconArrowRight class="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <!-- Create Follow List -->
        <button
          @click="emit('switch-tab', 'lists')"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-8 text-left group transform hover:-translate-y-1"
        >
          <div class="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-r from-green-400 to-emerald-400 group-hover:scale-110 transition-transform duration-200 shadow-lg">
            <IconList class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-3 text-lg group-hover:text-green-600 transition-colors">
            Discover Follow Packs
          </h4>
          <p class="text-base text-gray-600 mb-4 leading-relaxed">Find curated packs to follow instantly</p>
          <div class="flex items-center text-green-600 text-base font-medium">
            <span>Browse Packs</span>
            <IconArrowRight class="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <!-- Share Profile -->
        <button
          @click="openShareModal"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-lg transition-all duration-200 p-8 text-left group transform hover:-translate-y-1"
        >
          <div class="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-gradient-to-r from-purple-400 to-pink-400 group-hover:scale-110 transition-transform duration-200 shadow-lg">
            <IconShare class="w-6 h-6 text-white" />
          </div>
          <h4 class="font-semibold text-gray-900 mb-3 text-lg group-hover:text-purple-600 transition-colors">
            Share Profile
          </h4>
          <p class="text-base text-gray-600 mb-4 leading-relaxed">Share your Nostr profile to gain followers</p>
          <div class="flex items-center text-purple-600 text-base font-medium">
            <span>Share Now</span>
            <IconArrowRight class="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>
    </div>

    <!-- Tips for Better Networking -->
    <div class="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-8">
      <div class="flex items-start space-x-5">
        <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <IconSparkles class="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h4 class="font-semibold text-purple-900 mb-4 text-lg">Pro Tips for Building Your Audience</h4>
          <div class="space-y-3 text-base text-purple-800">
            <div class="flex items-start space-x-3">
              <IconCheck class="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span class="leading-relaxed">Follow people who share your interests to build a relevant network</span>
            </div>
            <div class="flex items-start space-x-3">
              <IconCheck class="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span class="leading-relaxed">Create themed packs to organize different communities</span>
            </div>
            <div class="flex items-start space-x-3">
              <IconCheck class="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
              <span class="leading-relaxed">Share your profile on social media to attract followers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Share Modal -->
  <NostrProfileShareModal 
    :show="showShareModal" 
    @close="closeShareModal" 
  />
</template>

<style scoped>
/* Enhanced hover effects */
.group:hover .group-hover\:scale-110 {
  transform: scale(1.1);
}

.group:hover .group-hover\:translate-x-1 {
  transform: translateX(0.25rem);
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

/* Mobile optimizations */
@media (max-width: 640px) {
  .text-3xl {
    font-size: 1.875rem;
  }
  
  .text-lg {
    font-size: 1.125rem;
  }
  
  button {
    min-height: 44px;
  }
}

/* Animation for pulse effect */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>