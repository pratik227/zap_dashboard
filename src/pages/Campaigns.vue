<script setup>
import { ref, computed, onMounted, inject } from 'vue'
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
  IconUsers
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
const { isAuthenticated, currentUser, login } = useNostrAuth()
const { 
  userCampaigns, 
  isLoading, 
  error, 
  fetchUserCampaigns, 
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

// Filter campaigns based on search
const filteredCampaigns = computed(() => {
  if (!searchQuery.value) return userCampaigns.value
  
  const query = searchQuery.value.toLowerCase()
  return userCampaigns.value.filter(campaign => 
    campaign.title.toLowerCase().includes(query) ||
    campaign.content.toLowerCase().includes(query) ||
    campaign.summary.toLowerCase().includes(query)
  )
})

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
  changePage('campaign-view', { eventId: campaign.id })
}

// Edit campaign
const editCampaign = (campaign) => {
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

// Format amount in sats
const formatAmount = (amount) => {
  // Convert from millisats to sats
  const sats = Math.floor(amount / 1000)
  return sats.toLocaleString()
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
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
          <IconTarget class="w-6 h-6 text-orange-600" />
          <span>Campaigns</span>
        </h1>
        <p class="text-gray-600">Create and manage your funding campaigns</p>
      </div>
      
      <div class="flex items-center space-x-3">
        <button
          v-if="isAuthenticated"
          @click="refreshCampaigns"
          :disabled="isRefreshing"
          class="btn-secondary text-sm"
          title="Refresh campaigns"
        >
          <IconRefresh :class="['w-4 h-4', isRefreshing ? 'animate-spin' : '']" />
          <span class="hidden sm:inline">Refresh</span>
        </button>
        
        <button
          v-if="isAuthenticated"
          @click="openCreateModal"
          class="btn-primary"
        >
          <IconPlus class="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>
    </div>

    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconTarget class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
            <p class="text-purple-100 text-sm">
              Connect your Nostr identity to create and manage funding campaigns.
              Your campaigns will be published to the Nostr network.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
        >
          <IconBolt class="w-4 h-4" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center space-x-2">
        <IconAlertCircle class="w-5 h-5 text-red-600" />
        <p class="text-red-600">{{ error }}</p>
      </div>
    </div>

    <!-- Campaigns Dashboard -->
    <div v-if="isAuthenticated">
      <!-- Search and Filters -->
      <div class="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-orange-100/50 shadow-sm mb-6">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search campaigns..."
            class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
          />
          <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && !userCampaigns.length" class="bg-white/90 backdrop-blur-sm p-6 rounded-xl border border-orange-100/50 shadow-sm text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading your campaigns...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!userCampaigns.length" class="bg-white/90 backdrop-blur-sm p-8 rounded-xl border border-orange-100/50 shadow-sm text-center">
        <IconTarget class="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 class="text-xl font-semibold text-gray-900 mb-2">No Campaigns Yet</h3>
        <p class="text-gray-600 mb-6">Create your first funding campaign to start collecting sats for your goals.</p>
        <button @click="openCreateModal" class="btn-primary">
          <IconPlus class="w-4 h-4" />
          Create First Campaign
        </button>
      </div>

      <!-- Campaigns List -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CampaignCard
          v-for="campaign in filteredCampaigns"
          :key="campaign.id"
          :campaign="campaign"
          @view="viewCampaign"
          @edit="editCampaign"
          @delete="openDeleteModal"
          @share="openShareModal"
        />
      </div>
    </div>
  </div>

  <!-- Create Campaign Modal -->
  <CampaignCreateModal
    v-if="showCreateModal"
    :campaign="selectedCampaign"
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
    @close="showShareModal = false; selectedCampaign = null"
  />
</template>