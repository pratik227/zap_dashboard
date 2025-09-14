<script setup>
import { ref, computed, onMounted, inject, watch, toRefs } from 'vue'
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
  IconChevronDown
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNotifications } from '../composables/useNotifications.js'
import { formatDate } from '../utils/dateUtils.js'
import CampaignCard from '../components/CampaignCard.vue'
import CampaignCreateModal from '../components/CampaignCreateModal.vue'
import CampaignDeleteModal from '../components/CampaignDeleteModal.vue'
import CampaignShareModal from '../components/CampaignShareModal.vue'

// Get changePage function from parent
const changePage = inject('changePage')

// Use composables
const auth = useNostrAuth()
const { currentUser, login } = auth
const isAuthenticated = auth.isAuthenticated

const { 
  userCampaigns, 
  isLoading, 
  error, 
  fetchUserCampaigns, 
  editCampaign,
  deleteCampaign,
  publishCampaign,
  getCampaignProgress
} = useCampaigns()
const { handleConnectionSuccess } = useNotifications()

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

// Check if campaign is expired
const isCampaignExpired = (campaign) => {
  if (!campaign.closedAt) return false
  
  const now = Math.floor(Date.now() / 1000)
  
  // Only log if the campaign is close to expiration (within 24 hours)
  const diff = campaign.closedAt - now
  if (Math.abs(diff) < 24 * 60 * 60) {
    console.log(`Campaign "${campaign.title}" expiration check:`)
    console.log(`- Now: ${new Date(now * 1000).toLocaleString()}`)
    console.log(`- Closes: ${new Date(campaign.closedAt * 1000).toLocaleString()}`)
    console.log(`- Diff: ${diff} seconds (${Math.floor(diff / 3600)} hours)`)
    console.log(`- Status: ${campaign.closedAt < now ? 'EXPIRED' : 'ACTIVE'}`)
  }
  
  return campaign.closedAt < now
}

// Check if campaign is completed
const isCampaignCompleted = (campaignId) => {
  const progress = getCampaignProgress(campaignId)
  return progress.percentage >= 100
}

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
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
  console.log('Refreshing campaigns...')
  try {
    await fetchUserCampaigns()
    console.log(`Refreshed campaigns, found ${userCampaigns.value.length} campaigns`)
  } catch (error) {
    console.error('Failed to refresh campaigns:', error)
  } finally {
    isRefreshing.value = false
  }
}

// Format amount in sats
const formatAmount = (amount) => {
  if (amount === undefined || amount === null) return '0'
  // Convert from millisats to sats
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
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

// Initialize on mount
onMounted(async () => {
  if (isAuthenticated.value) {
    await fetchUserCampaigns()
  }
})

// Watch for authentication changes
watch(isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await fetchUserCampaigns()
  }
})
</script>

<template>
  <div class="space-y-6">
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

    <!-- Stats Cards (Only show when authenticated and has campaigns) -->
    <div v-if="isAuthenticated && userCampaigns.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- Mobile: 2x2 Grid, Desktop: 1x4 Grid -->
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg shadow-orange-100/20 p-4 sm:p-5 hover:shadow-xl hover:shadow-orange-100/30 transition-all duration-300 hover:border-orange-200/60 transform hover:-translate-y-1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs sm:text-sm text-gray-500 mb-1 font-medium">Total</p>
            <p class="text-xl sm:text-2xl font-bold text-gray-900">{{ campaignStats.total }}</p>
          </div>
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center shadow-sm">
            <IconTarget class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          </div>
        </div>
      </div>
      
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-green-100/50 shadow-lg shadow-green-100/20 p-4 sm:p-5 hover:shadow-xl hover:shadow-green-100/30 transition-all duration-300 hover:border-green-200/60 transform hover:-translate-y-1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs sm:text-sm text-gray-500 mb-1 font-medium">Active</p>
            <p class="text-xl sm:text-2xl font-bold text-green-600">{{ campaignStats.active }}</p>
          </div>
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center shadow-sm">
            <IconBolt class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
          </div>
        </div>
      </div>
      
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-blue-100/50 shadow-lg shadow-blue-100/20 p-4 sm:p-5 hover:shadow-xl hover:shadow-blue-100/30 transition-all duration-300 hover:border-blue-200/60 transform hover:-translate-y-1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs sm:text-sm text-gray-500 mb-1 font-medium">Done</p>
            <p class="text-xl sm:text-2xl font-bold text-blue-600">{{ campaignStats.completed }}</p>
          </div>
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl flex items-center justify-center shadow-sm">
            <IconCheck class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>
        </div>
      </div>
      
      <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg shadow-orange-100/20 p-4 sm:p-5 hover:shadow-xl hover:shadow-orange-100/30 transition-all duration-300 hover:border-orange-200/60 transform hover:-translate-y-1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs sm:text-sm text-gray-500 mb-1 font-medium">Raised</p>
            <p class="text-lg sm:text-2xl font-bold text-orange-600">{{ campaignStats.totalRaised.toLocaleString() }} <span class="text-xs sm:text-sm font-normal text-orange-500">sats</span></p>
          </div>
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center shadow-sm">
            <IconBolt class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          </div>
        </div>
      </div>
    </div>

    <!-- Search and Filters -->
    <!-- Mobile-First Controls Section -->
    <div v-if="isAuthenticated" class="space-y-4 mb-6">
      <!-- Mobile Layout: Stacked Cards -->
      <div class="block sm:hidden space-y-3">
        <!-- Search Card -->
        <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg shadow-gray-200/20 p-4">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search campaigns..."
              class="w-full pl-10 pr-10 py-3 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200 shadow-sm"
            />
            <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''" 
              class="absolute right-3 top-3.5 w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconX class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Controls Card -->
        <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg shadow-gray-200/20 p-4">
          <div class="grid grid-cols-2 gap-3">
            <!-- View Toggle -->
            <div class="bg-gray-50/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-200/50">
              <button 
                @click="activeView = 'grid'" 
                :class="[
                  'w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-out flex items-center justify-center space-x-1.5',
                  activeView === 'grid' 
                    ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
                ]"
              >
                <span class="text-xs opacity-70">⊞</span>
                <span>Grid</span>
              </button>
            </div>
            
            <div class="bg-gray-50/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-200/50">
              <button 
                @click="activeView = 'list'" 
                :class="[
                  'w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ease-out flex items-center justify-center space-x-1.5',
                  activeView === 'list' 
                    ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
                ]"
              >
                <span class="text-xs opacity-70">☰</span>
                <span>List</span>
              </button>
            </div>
          </div>
          
          <!-- Sort and Create Row -->
          <div class="flex items-center space-x-3 mt-3">
            <!-- Sort Dropdown -->
            <div class="relative flex-1">
              <select 
                v-model="sortOption"
                class="w-full appearance-none pl-3 pr-8 py-2.5 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm shadow-sm transition-all duration-200"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="progress">Progress</option>
                <option value="goal">Goal</option>
              </select>
              <IconChevronDown class="absolute right-3 top-3 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
            
            <!-- Create Button -->
            <button
              @click="openCreateModal"
              class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              <IconPlus class="w-4 h-4" />
              <span>New</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Desktop Layout: Single Card -->
      <div class="hidden sm:block">
        <div class="bg-white/95 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-xl shadow-gray-200/40 overflow-hidden">
          <!-- ZapTracker Brand Accent Line -->
          <div class="h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400"></div>
          
          <!-- Header Content -->
          <div class="px-6 py-5">
            <div class="flex items-center justify-between">
              <!-- Left: Search -->
              <div class="relative flex-1 max-w-md">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search campaigns..."
                  class="w-full pl-10 pr-10 py-3 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200 shadow-sm"
                />
                <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <button 
                  v-if="searchQuery" 
                  @click="searchQuery = ''" 
                  class="absolute right-3 top-3.5 w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <IconX class="w-4 h-4" />
                </button>
              </div>
              
              <!-- Right: Controls -->
              <div class="flex items-center space-x-4">
                <!-- View Toggle -->
                <div class="flex items-center bg-gray-50/80 backdrop-blur-sm rounded-2xl p-1 shadow-sm border border-gray-200/50">
                  <button 
                    @click="activeView = 'grid'" 
                    :class="[
                      'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out flex items-center space-x-1.5',
                      activeView === 'grid' 
                        ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
                    ]"
                  >
                    <span class="text-xs opacity-70">⊞</span>
                    <span>Grid</span>
                  </button>
                  <button 
                    @click="activeView = 'list'" 
                    :class="[
                      'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out flex items-center space-x-1.5',
                      activeView === 'list' 
                        ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30' 
                        : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
                    ]"
                  >
                    <span class="text-xs opacity-70">☰</span>
                    <span>List</span>
                  </button>
                </div>

                <!-- Sort Dropdown -->
                <div class="relative">
                  <select 
                    v-model="sortOption"
                    class="appearance-none pl-3 pr-8 py-2.5 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm shadow-sm transition-all duration-200"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="progress">Highest Progress</option>
                    <option value="goal">Highest Goal</option>
                  </select>
                  <IconChevronDown class="absolute right-3 top-3 w-3 h-3 text-gray-400 pointer-events-none" />
                </div>
                
                <!-- Create Button -->
                <button
                  @click="openCreateModal"
                  class="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                >
                  <IconPlus class="w-4 h-4" />
                  <span>New Campaign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
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
      <!-- Loading State -->
      <div v-if="isLoading && !userCampaigns.length" class="bg-white rounded-xl border border-orange-100 shadow-sm p-8 text-center">
        <div class="inline-block p-3 bg-orange-100 rounded-full mb-4">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">Loading your campaigns...</h3>
        <p class="text-gray-600">Please wait while we fetch your campaign data</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!userCampaigns.length" class="bg-white rounded-xl border border-orange-100 shadow-sm p-8 text-center">
        <div class="inline-block p-4 bg-orange-100 rounded-full mb-4">
          <IconTarget class="w-16 h-16 text-orange-500" />
        </div>
        <h3 class="text-2xl font-semibold text-gray-900 mb-3">No Campaigns Yet</h3>
        <p class="text-gray-600 mb-6 max-w-md mx-auto">Create your first funding campaign to start collecting sats for your goals. It only takes a minute to get started!</p>
        <button @click="openCreateModal" class="btn-primary px-6 py-3 text-base shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200">
          <IconPlus class="w-5 h-5" />
          <span>Create First Campaign</span>
        </button>
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
          @edit="editCampaignHandler"
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
            @click="viewCampaign(campaign)"
            class="p-3 sm:p-4 hover:bg-gray-50/80 transition-all duration-200 cursor-pointer group"
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
                  <span class="font-medium text-orange-600">{{ formatAmount(campaign.goalAmount) }} sats</span>
                </div>

                <!-- Meta Info Row -->
                <div class="flex items-center justify-between text-xs text-gray-400">
                  <span>{{ getCampaignProgress(campaign.id).current.toLocaleString() }} raised</span>
                  <span>{{ getDaysRemaining(campaign.closedAt) }}</span>
                </div>
              </div>

              <!-- Action Arrow -->
              <div class="flex-shrink-0">
                <IconChevronRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all duration-200" />
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