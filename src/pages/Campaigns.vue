<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { formatMsatsToSats } from '../utils/format.js'
import {
  IconTarget,
  IconPlus, 
  IconList, 
  IconChartBar, 
  IconShare,
  IconTrash,
  IconEdit,
  IconExternalLink,
  IconRefresh,
  IconLoader,
  IconAlertCircle,
  IconSearch,
  IconFilter,
  IconX,
  IconChevronRight,
  IconBolt,
  IconCalendar,
  IconClock,
  IconUsers,
  IconArrowRight,
  IconEye,
  IconCheck,
  IconGrid,
  IconChevronDown,
  IconInfoCircle,
  IconFileText,
  IconCode,
  IconHeart
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import { useCampaigns } from '../composables/campaigns/useCampaigns.js'
import CampaignCard from '../components/campaigns/CampaignCard.vue'
import CampaignCreateModal from '../components/campaigns/CampaignCreateModal.vue'
import CampaignDeleteModal from '../components/campaigns/CampaignDeleteModal.vue'
import CampaignShareModal from '../components/campaigns/CampaignShareModal.vue'
import SkeletonCard from '../components/shared/SkeletonCard.vue'

// Use composables
const auth = useNostrAuth()
const { login } = auth
const isAuthenticated = auth.isAuthenticated

const {
  userCampaigns,
  isLoading,
  error,
  fetchUserCampaigns,
  editCampaign,
  deleteCampaign,
  publishCampaign,
  getCampaignProgress,
  isCampaignExpired,
  isCampaignCompleted
} = useCampaigns()

// UI state
const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const showShareModal = ref(false)
const selectedCampaign = ref(null)
const searchQuery = ref('')
const isRefreshing = ref(false)
const activeView = ref('grid') // 'grid' or 'list'
const sortOption = ref('newest') // 'newest', 'oldest', 'progress', 'goal'

// Filter campaigns based on search
const filteredCampaigns = computed(() => {
  if (!searchQuery.value) return sortedCampaigns.value
  
  const query = searchQuery.value.toLowerCase()
  return sortedCampaigns.value.filter(campaign => 
    campaign.title.toLowerCase().includes(query) ||
    (campaign.content && campaign.content.toLowerCase().includes(query)) ||
    (campaign.summary && campaign.summary.toLowerCase().includes(query))
  )
})

// Sort campaigns based on selected option
const sortedCampaigns = computed(() => {
  const campaigns = [...userCampaigns.value]
  
  switch (sortOption.value) {
    case 'newest':
      return campaigns.sort((a, b) => b.createdAt - a.createdAt)
    case 'oldest':
      return campaigns.sort((a, b) => a.createdAt - b.createdAt)
    case 'progress':
      return campaigns.sort((a, b) => {
        const progressA = getCampaignProgress(a.id).percentage
        const progressB = getCampaignProgress(b.id).percentage
        return progressB - progressA
      })
    case 'goal':
      return campaigns.sort((a, b) => b.goalAmount - a.goalAmount)
    default:
      return campaigns
  }
})

// Campaign stats
const campaignStats = computed(() => {
  const total = userCampaigns.value.length
  const active = userCampaigns.value.filter(c => !isCampaignExpired(c) && !isCampaignCompleted(c.id)).length
  const completed = userCampaigns.value.filter(c => isCampaignCompleted(c.id)).length
  const expired = userCampaigns.value.filter(c => isCampaignExpired(c)).length
  
  const totalRaised = userCampaigns.value.reduce((sum, campaign) => {
    return sum + getCampaignProgress(campaign.id).current
  }, 0)
  
  return { total, active, completed, expired, totalRaised }
})

// Inline status for login errors
const inlineStatus = ref(null)
let _statusTimer = null
const showStatus = (message, type = 'error') => {
  clearTimeout(_statusTimer)
  inlineStatus.value = { message, type }
  _statusTimer = setTimeout(() => { inlineStatus.value = null }, 4000)
}

onUnmounted(() => {
  clearTimeout(_statusTimer)
})

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
    if (error.message.includes('No Nostr extension')) {
      showStatus('No Nostr extension found. Please install a NIP-07 browser extension — we recommend Jump by Buho (from the ZapTracker founders, available for Firefox & Chrome), or Alby, nos2x, or Flamingo — and refresh this page.')
    } else {
      showStatus(getUserFriendlyError(error))
    }
  }
}

// Open create campaign modal
const openCreateModal = () => {
  showCreateModal.value = true
  selectedCampaign.value = null // Ensure we're creating a new campaign, not editing
}

// Open delete campaign modal
const openDeleteModal = (campaign) => {
  selectedCampaign.value = campaign
  showDeleteModal.value = true
}

// Open share campaign modal
const openShareModal = (campaign) => {
  selectedCampaign.value = campaign
  showShareModal.value = true
}

// Handle campaign deletion
const handleDeleteCampaign = async () => {
  if (!selectedCampaign.value) return
  
  try {
    await deleteCampaign(selectedCampaign.value.id)
    showDeleteModal.value = false
    selectedCampaign.value = null
  } catch (error) {
    console.error('Failed to delete campaign:', error)
  }
}

// View campaign details
const viewCampaign = (campaign) => {
  // Navigate to standalone campaign view with eventId parameter
  const campaignUrl = `${window.location.origin}?page=campaign-view&eventId=${campaign.id}`
  window.open(campaignUrl, '_blank')
}

// Edit campaign
const handleEditCampaign = async (campaign) => {
  // For now, we'll just open the create modal with the campaign data
  selectedCampaign.value = campaign
  showCreateModal.value = true
}

// Refresh campaigns
const refreshCampaigns = async () => {
  isRefreshing.value = true
  try {
    await fetchUserCampaigns()
  } catch (error) {
    console.error('Failed to refresh campaigns:', error)
  } finally {
    isRefreshing.value = false
  }
}



// Format raised amount with smart units
const formatRaisedAmount = (sats) => {
  if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(1)}M`
  } else if (sats >= 1000) {
    return `${(sats / 1000).toFixed(1)}K`
  } else {
    return sats.toLocaleString()
  }
}

// Calculate days remaining
const getDaysRemaining = (closedAt) => {
  if (!closedAt) return 'No deadline'
  
  const now = Math.floor(Date.now() / 1000)
  const remaining = closedAt - now
  
  if (remaining <= 0) return 'Ended'
  
  const days = Math.floor(remaining / (60 * 60 * 24))
  return days === 1 ? '1 day left' : `${days} days left`
}

// Campaign fetching is handled by the composable's watch(isAuthenticated, ..., { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Inline Status Banner -->
    <transition name="slide-down">
      <div v-if="inlineStatus" role="status" aria-live="polite" :class="[
        'mb-4 px-4 py-3 rounded-lg text-sm font-medium',
        inlineStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
        inlineStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
        'bg-blue-50 text-blue-800 border border-blue-200'
      ]">
        {{ inlineStatus.message }}
      </div>
    </transition>

    <!-- Hero Section with Animated Gradient Background -->
    <div class="relative overflow-hidden rounded-2xl shadow-xl mb-8">
      <div class="absolute inset-0 bg-gradient-to-br from-orange-400 via-amber-300 to-yellow-400 opacity-90"></div>
      <div class="absolute inset-0 bg-[url('https://images.pexels.com/photos/7130560/pexels-photo-7130560.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')] bg-cover bg-center mix-blend-overlay opacity-20"></div>
      
      <div class="relative px-6 py-12 sm:px-12 sm:py-16 text-center sm:text-left">
        <div class="max-w-3xl mx-auto sm:mx-0">
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Fund Your <span class="text-amber-100">Bitcoin</span> Projects
          </h1>
          <p class="text-lg sm:text-xl text-white/90 mb-8 max-w-2xl">
            Create campaigns, share with your community, and collect sats to fund your next big idea.
          </p>
          
          <div class="flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
            <button
              v-if="isAuthenticated"
              @click="openCreateModal"
              class="btn-primary group px-6 py-3 text-base"
            >
              <IconPlus class="w-5 h-5" />
              <span>Start a Campaign</span>
              <IconArrowRight class="w-5 h-5 ml-1 transition-transform group-hover:translate-x-1" />
            </button>
            
            <button
              v-else
              @click="handleNostrLogin"
              class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 whitespace-nowrap text-white border border-white/30 shadow-lg"
            >
              <IconBolt class="w-5 h-5" />
              <span>Connect with Nostr</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Dashboard Controls -->
    <div v-if="isAuthenticated && userCampaigns.length > 0" class="mb-8">
      <!-- Mobile Layout -->
      <div class="block lg:hidden space-y-4">
        <!-- Stats Grid -->
        <div class="grid grid-cols-4 gap-2">
          <div class="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-gray-900">{{ campaignStats.total }}</div>
            <div class="text-xs text-gray-500 mt-1">Total</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-green-600">{{ campaignStats.active }}</div>
            <div class="text-xs text-gray-500 mt-1">Active</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div class="text-2xl font-bold text-blue-600">{{ campaignStats.completed }}</div>
            <div class="text-xs text-gray-500 mt-1">Done</div>
          </div>
          <div class="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div class="text-xl font-bold text-orange-600">{{ formatRaisedAmount(campaignStats.totalRaised) }}</div>
            <div class="text-xs text-gray-500 mt-1">Sats</div>
          </div>
        </div>

        <!-- Controls -->
        <div class="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search campaigns..."
                class="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all"
              />
              <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-3.5 text-gray-400">
                <IconX class="w-4 h-4" />
              </button>
            </div>

            <div class="relative flex-shrink-0">
              <select v-model="sortOption" class="appearance-none pl-3 pr-8 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm transition-all text-gray-600 min-w-[100px]">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="progress">Progress</option>
                <option value="goal">Goal</option>
              </select>
              <IconChevronDown class="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <button
            @click="openCreateModal"
            class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
          >
            <IconPlus class="w-4 h-4" />
            New Campaign
          </button>
        </div>
      </div>

      <!-- Desktop Layout -->
      <div class="hidden lg:block">
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <!-- Stats Bar -->
          <div class="border-b border-gray-200 px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-8">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                    <IconTarget class="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div class="text-2xl font-bold text-gray-900">{{ campaignStats.total }}</div>
                    <div class="text-xs text-gray-500">Total Campaigns</div>
                  </div>
                </div>

                <div class="h-10 w-px bg-gray-200"></div>

                <div class="flex items-center gap-6">
                  <div>
                    <div class="text-xl font-bold text-green-600">{{ campaignStats.active }}</div>
                    <div class="text-xs text-gray-500">Active</div>
                  </div>
                  <div>
                    <div class="text-xl font-bold text-blue-600">{{ campaignStats.completed }}</div>
                    <div class="text-xs text-gray-500">Completed</div>
                  </div>
                  <div>
                    <div class="text-xl font-bold text-orange-600">{{ formatRaisedAmount(campaignStats.totalRaised) }}</div>
                    <div class="text-xs text-gray-500">Sats Raised</div>
                  </div>
                </div>
              </div>

              <button
                @click="openCreateModal"
                class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-5 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                <IconPlus class="w-4 h-4" />
                New Campaign
              </button>
            </div>
          </div>

          <!-- Controls Bar -->
          <div class="px-6 py-4">
            <div class="flex items-center justify-between">
              <div class="relative flex-1 max-w-md">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search campaigns..."
                  class="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all text-sm"
                />
                <IconSearch class="absolute left-3 top-3 w-3.5 h-3.5 text-gray-400" />
                <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  <IconX class="w-3.5 h-3.5" />
                </button>
              </div>

              <div class="flex items-center gap-2">
                <div class="relative">
                  <select v-model="sortOption" class="appearance-none pl-3 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm transition-all text-gray-600 min-w-[130px]">
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="progress">By Progress</option>
                    <option value="goal">By Goal</option>
                  </select>
                  <IconChevronDown class="absolute right-2.5 top-3.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Campaigns Header with View Controls -->
    <div v-if="isAuthenticated && filteredCampaigns.length > 0" class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">Your Campaigns</h2>
      <div class="flex bg-white border border-gray-200 rounded-lg p-0.5">
        <button
          @click="activeView = 'grid'"
          :class="['px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-1.5', activeView === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700']"
        >
          <IconGrid class="w-4 h-4" />
          Grid
        </button>
        <button
          @click="activeView = 'list'"
          :class="['px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-1.5', activeView === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-700']"
        >
          <IconList class="w-4 h-4" />
          List
        </button>
      </div>
    </div>

    <!-- Simple Controls for Empty State -->
    <div v-else-if="isAuthenticated" class="mb-8">
      <div class="bg-white border border-gray-200 rounded-xl p-4">
        <button
          @click="openCreateModal"
          class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
        >
          <IconPlus class="w-5 h-5" />
          Create Your First Campaign
        </button>
      </div>
    </div>
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-white rounded-xl border border-orange-100 shadow-lg p-6 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <IconTarget class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 mb-2">Nostr Login Required</h2>
            <p class="text-gray-600 text-base">
              Connect your Nostr identity to create and manage funding campaigns.
              Your campaigns will be published to the Nostr network.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 whitespace-nowrap text-white shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
        >
          <IconBolt class="w-5 h-5" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm animate-pulse">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 class="font-medium text-red-800 mb-1">Error Loading Campaigns</h3>
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Campaigns Dashboard -->
    <div v-if="isAuthenticated">
      <!-- Loading State with Skeleton Cards -->
      <div v-if="isLoading && !userCampaigns.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <SkeletonCard v-for="i in 3" :key="i" />
      </div>

      <!-- Empty State -->
      <div v-else-if="!userCampaigns.length" class="max-w-4xl mx-auto py-8 px-4">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-3xl shadow-lg mb-6">
            <IconTarget class="w-10 h-10 text-white" />
          </div>
          <h3 class="text-2xl font-bold text-gray-900 mb-3">Launch Your First Campaign</h3>
          <p class="text-lg text-gray-600">
            Campaigns help you raise sats for projects, goals, or causes through Lightning Network payments!
          </p>
        </div>

        <!-- Why Campaigns -->
        <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
          <div class="flex items-start space-x-4">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <IconInfoCircle class="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h4 class="text-lg font-semibold text-gray-900 mb-2">What Are Campaigns?</h4>
              <p class="text-gray-700 leading-relaxed">
                Campaigns are fundraising pages where supporters can send you sats toward a specific goal.
                Perfect for projects, events, content creation, or any initiative that needs community support!
              </p>
            </div>
          </div>
        </div>

        <!-- Campaign Ideas -->
        <div class="space-y-4 mb-8">
          <h4 class="text-xl font-bold text-gray-900 text-center mb-6">Great Campaign Ideas</h4>

          <div class="grid md:grid-cols-2 gap-4">
            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 transition-all">
              <div class="flex items-start space-x-3 mb-3">
                <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IconFileText class="w-5 h-5 text-orange-600" />
                </div>
                <h5 class="font-semibold text-gray-900">Content Creation</h5>
              </div>
              <p class="text-sm text-gray-600">
                Fund a podcast series, video project, article collection, or creative work
              </p>
            </div>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 transition-all">
              <div class="flex items-start space-x-3 mb-3">
                <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IconCode class="w-5 h-5 text-orange-600" />
                </div>
                <h5 class="font-semibold text-gray-900">Open Source Project</h5>
              </div>
              <p class="text-sm text-gray-600">
                Raise funds to build tools, apps, or contribute to the Nostr ecosystem
              </p>
            </div>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 transition-all">
              <div class="flex items-start space-x-3 mb-3">
                <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IconCalendar class="w-5 h-5 text-orange-600" />
                </div>
                <h5 class="font-semibold text-gray-900">Event or Meetup</h5>
              </div>
              <p class="text-sm text-gray-600">
                Cover costs for organizing Bitcoin or Nostr events, conferences, or workshops
              </p>
            </div>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 transition-all">
              <div class="flex items-start space-x-3 mb-3">
                <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IconHeart class="w-5 h-5 text-orange-600" />
                </div>
                <h5 class="font-semibold text-gray-900">Community Support</h5>
              </div>
              <p class="text-sm text-gray-600">
                Help with personal goals, education, or support causes that matter to your audience
              </p>
            </div>
          </div>
        </div>

        <!-- What to Include -->
        <div class="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6 mb-8">
          <h5 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <IconCheck class="w-5 h-5 text-orange-600" />
            <span>Make Your Campaign Successful</span>
          </h5>
          <ul class="space-y-3 text-sm text-gray-700">
            <li class="flex items-start space-x-3">
              <div class="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-bold text-orange-700">1</span>
              </div>
              <span><strong>Clear goal:</strong> Set a specific target amount and explain exactly what the funds will be used for</span>
            </li>
            <li class="flex items-start space-x-3">
              <div class="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-bold text-orange-700">2</span>
              </div>
              <span><strong>Compelling story:</strong> Share why this matters and how it will benefit the community</span>
            </li>
            <li class="flex items-start space-x-3">
              <div class="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-bold text-orange-700">3</span>
              </div>
              <span><strong>Regular updates:</strong> Keep supporters informed about progress and milestones</span>
            </li>
            <li class="flex items-start space-x-3">
              <div class="w-6 h-6 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span class="text-xs font-bold text-orange-700">4</span>
              </div>
              <span><strong>Share widely:</strong> Post about your campaign on Nostr and engage with your community</span>
            </li>
          </ul>
        </div>

        <!-- CTA -->
        <div class="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-8 text-white text-center shadow-xl">
          <h4 class="text-2xl font-bold mb-3">Ready to Launch Your Campaign?</h4>
          <p class="text-orange-50 mb-6">
            Create your campaign in minutes and start raising sats for your project
          </p>
          <button @click="openCreateModal" class="bg-white text-orange-600 px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 inline-flex items-center space-x-2">
            <IconPlus class="w-5 h-5" />
            <span>Create Your First Campaign</span>
          </button>
        </div>
      </div>

      <!-- No Results State -->
      <div v-else-if="filteredCampaigns.length === 0" class="bg-white rounded-xl border border-orange-100 shadow-sm p-8 text-center">
        <div class="inline-block p-4 bg-orange-100 rounded-full mb-4">
          <IconSearch class="w-12 h-12 text-orange-500" />
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">No Matching Campaigns</h3>
        <p class="text-gray-600 mb-4">We couldn't find any campaigns matching your search criteria.</p>
        <button @click="searchQuery = ''" class="btn-secondary">
          <IconX class="w-4 h-4" />
          <span>Clear Search</span>
        </button>
      </div>

      <!-- Grid View -->
      <div v-else-if="activeView === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CampaignCard
          v-for="campaign in filteredCampaigns"
          :key="campaign.id"
          :campaign="campaign"
          @view="viewCampaign"
          @edit="handleEditCampaign"
          @delete="openDeleteModal"
          @share="openShareModal"
        />
      </div>

      <!-- List View -->
      <div v-else class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
        <div class="divide-y divide-gray-100/60">
          <div
            v-for="campaign in filteredCampaigns"
            :key="campaign.id"
            class="relative group"
          >
            <!-- Main Row - Clickable -->
            <div
              @click="viewCampaign(campaign)"
              class="p-3 sm:p-4 hover:bg-gray-50/80 transition-all duration-200 cursor-pointer"
            >
              <div class="flex items-center space-x-3">
                <!-- Compact Campaign Icon/Image -->
                <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <img
                    v-if="campaign.image"
                    :src="campaign.image"
                    :alt="campaign.title"
                    class="w-full h-full object-cover"
                    @error="$event.target.style.display = 'none'"
                  />
                  <IconTarget v-else class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>

                <!-- Campaign Info -->
                <div class="flex-1 min-w-0">
                  <!-- Title and Status Row -->
                  <div class="flex items-center justify-between mb-1">
                    <h3 class="font-semibold text-gray-900 text-sm sm:text-base truncate mr-2 group-hover:text-orange-600 transition-colors">
                      {{ campaign.title }}
                    </h3>
                    <span :class="[
                      'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                      isCampaignExpired(campaign) ? 'bg-red-100 text-red-700' :
                      isCampaignCompleted(campaign.id) ? 'bg-green-100 text-green-700' :
                      'bg-orange-100 text-orange-700'
                    ]">
                      {{ isCampaignExpired(campaign) ? 'Expired' :
                         isCampaignCompleted(campaign.id) ? 'Done' : 'Active' }}
                    </span>
                  </div>

                  <!-- Progress and Goal Row -->
                  <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <div class="flex items-center space-x-2">
                      <span class="font-medium">{{ getCampaignProgress(campaign.id).percentage }}%</span>
                      <div class="w-16 sm:w-20 bg-gray-200 rounded-full h-1.5">
                        <div
                          class="bg-gradient-to-r from-orange-400 to-amber-400 h-1.5 rounded-full transition-all duration-300"
                          :style="{ width: `${getCampaignProgress(campaign.id).percentage}%` }"
                        ></div>
                      </div>
                    </div>

                    <!-- Goal Amount + Action Buttons -->
                    <div class="flex items-center gap-2">
                      <!-- Desktop: Share + Delete (on hover) -->
                      <div class="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          @click.stop="openShareModal(campaign)"
                          class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Share"
                        >
                          <IconShare class="w-3.5 h-3.5" />
                        </button>
                        <button
                          @click.stop="openDeleteModal(campaign)"
                          class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <IconTrash class="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <!-- Mobile: Share only (always visible) -->
                      <button
                        @click.stop="openShareModal(campaign)"
                        class="sm:hidden w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Share"
                      >
                        <IconShare class="w-3.5 h-3.5" />
                      </button>

                      <span class="font-medium text-orange-600">{{ formatMsatsToSats(campaign.goalAmount) }} sats</span>
                    </div>
                  </div>

                  <!-- Meta Info Row -->
                  <div class="flex items-center justify-between text-xs text-gray-400">
                    <span>{{ getCampaignProgress(campaign.id).current.toLocaleString() }} raised</span>
                    <span>{{ getDaysRemaining(campaign.closedAt) }}</span>
                  </div>
                </div>

                <!-- Chevron -->
                <div class="flex-shrink-0 transition-transform group-hover:translate-x-1">
                  <IconChevronRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Campaign Modal -->
  <CampaignCreateModal
    v-if="showCreateModal"
    :campaign="selectedCampaign"
    :isAuthenticated="isAuthenticated"
    @close="showCreateModal = false; selectedCampaign = null"
  />

  <!-- Delete Campaign Modal -->
  <CampaignDeleteModal
    v-if="showDeleteModal"
    :campaign="selectedCampaign"
    @close="showDeleteModal = false; selectedCampaign = null"
    @confirm="handleDeleteCampaign"
  />

  <!-- Share Campaign Modal -->
  <CampaignShareModal
    v-if="showShareModal"
    :campaign="selectedCampaign"
    :isAuthenticated="isAuthenticated"
    @close="showShareModal = false; selectedCampaign = null"
  />
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Button Styles */
.btn-primary {
  @apply bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md transform hover:translate-y-[-2px];
}

.btn-secondary {
  @apply bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md transform hover:translate-y-[-2px];
}

/* Card hover effects */
.campaign-card-hover {
  @apply transition-all duration-300 hover:shadow-lg hover:border-orange-200 transform hover:translate-y-[-2px];
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .btn-primary, .btn-secondary {
    @apply px-3 py-2 text-sm;
  }
}
</style>