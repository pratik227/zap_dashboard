<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { 
  IconTarget, 
  IconBolt, 
  IconCalendar, 
  IconUsers, 
  IconShare,
  IconArrowLeft,
  IconLoader,
  IconAlertCircle,
  IconClock,
  IconCheck,
  IconX,
  IconExternalLink,
  IconCopy,
  IconUser,
  IconMessageCircle
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNotifications } from '../composables/useNotifications.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import * as nip19 from 'nostr-tools/nip19'
import { makeZapRequest, getZapEndpoint } from 'nostr-tools/nip57'
import CampaignZapModal from '../components/CampaignZapModal.vue'
import CampaignShareModal from '../components/CampaignShareModal.vue'
import UserProfileModal from '../components/UserProfileModal.vue'

// Get changePage function from parent
const changePage = inject('changePage')

// Use composables
const { 
  fetchCampaignById, 
  getCampaignProgress, 
  isCampaignExpired, 
  isCampaignCompleted, 
  getCampaignStatus,
  campaignAggregatedZaps,
  isLoading,
  error
} = useCampaigns()
const { isAuthenticated, currentUser } = useNostrAuth()
const { handleZapReceived } = useNotifications()

// State
const campaign = ref(null)
const campaignAuthor = ref(null)
const showZapModal = ref(false)
const showShareModal = ref(false)
const showUserModal = ref(false)
const copySuccess = ref('')

// Get event ID from URL params
const getEventIdFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('eventId')
}

// Load campaign
const loadCampaign = async () => {
  const eventId = getEventIdFromUrl()
  
  if (!eventId) {
    console.error('No eventId found in URL parameters')
    changePage('campaign-not-found')
    return
  }
  
  console.log('Attempting to load campaign with eventId:', eventId)
  
  try {
    const loadedCampaign = await fetchCampaignById(eventId)
    console.log('Campaign loaded successfully:', loadedCampaign)
    campaign.value = loadedCampaign
    
    // Fetch author profile
    await fetchAuthorProfile(loadedCampaign.pubkey)
  } catch (err) {
    console.error('Failed to load campaign:', err)
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      eventId: eventId
    })
    changePage('campaign-not-found')
  }
}

// Fetch author profile
const fetchAuthorProfile = async (pubkey) => {
  try {
    const authorEvent = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [pubkey],
      limit: 1
    })
    
    if (authorEvent) {
      try {
        const profile = JSON.parse(authorEvent.content)
        campaignAuthor.value = {
          pubkey,
          name: profile.name || profile.display_name || `user:${pubkey.substring(0, 8)}`,
          picture: profile.picture || generateFallbackAvatar(pubkey),
          nip05: profile.nip05 || null,
          about: profile.about || null,
          lud16: profile.lud16 || null
        }
      } catch (err) {
        console.warn('Failed to parse author profile:', err)
        campaignAuthor.value = {
          pubkey,
          name: `user:${pubkey.substring(0, 8)}`,
          picture: generateFallbackAvatar(pubkey)
        }
      }
    } else {
      campaignAuthor.value = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateFallbackAvatar(pubkey)
      }
    }
  } catch (err) {
    console.warn('Failed to fetch author profile:', err)
    campaignAuthor.value = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateFallbackAvatar(pubkey)
    }
  }
}

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  // Create a hash from the pubkey to consistently select an avatar
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Calculate progress
const progress = computed(() => {
  if (!campaign.value) return { current: 0, goal: 0, percentage: 0 }
  return getCampaignProgress(campaign.value.id)
})

// Format amount in sats
const formatAmount = (amount) => {
  if (!amount) return '0'
  
  try {
    // Convert from millisats to sats
    const sats = Math.floor(amount / 1000)
    return sats ? sats.toLocaleString() : '0'
  } catch (error) {
    console.error('Error formatting amount:', error, amount)
    return '0'
  }
}

// Calculate days remaining
const daysRemaining = computed(() => {
  if (!campaign.value || !campaign.value.closedAt) return 'No deadline'
  
  const now = Math.floor(Date.now() / 1000)
  const remaining = campaign.value.closedAt - now
  console.log(`Days remaining calculation: now=${now}, closedAt=${campaign.value.closedAt}, remaining=${remaining} seconds`)
  console.log(`Current time: ${new Date(now * 1000).toLocaleString()}`)
  console.log(`End time: ${new Date(campaign.value.closedAt * 1000).toLocaleString()}`)
  
  if (remaining <= 0) return 'Ended'
  
  const days = Math.floor(remaining / (60 * 60 * 24))
  return days === 1 ? '1 day left' : `${days} days left`
})

// Get campaign status
const status = computed(() => {
  if (!campaign.value) return 'loading'
  return getCampaignStatus(campaign.value)
})

// Get status color
const statusColor = computed(() => {
  switch (status.value) {
    case 'completed':
      return 'bg-green-100 text-green-700'
    case 'expired':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-orange-100 text-orange-700'
  }
})

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

// Get recent zaps from campaign aggregated zaps
const recentZaps = computed(() => {
  if (!campaign.value) return []
  
  // Get zaps from the campaign aggregated zaps system
  const campaignZaps = campaignAggregatedZaps.value.get(campaign.value.id) || []
  
  return campaignZaps
    .slice(0, 5)
    .map(zap => ({
      ...zap,
      // Add sender info for display
      sender: {
        name: `User ${zap.zapperPubkey?.substring(0, 8)}` || 'Anonymous',
        picture: generateFallbackAvatar(zap.zapperPubkey),
        avatar: generateFallbackAvatar(zap.zapperPubkey)
      },
      timeAgo: formatTimeAgo(zap.timestamp)
    }))
})

// Get total zap count for this campaign
const totalZapCount = computed(() => {
  if (!campaign.value) return 0
  const campaignZaps = campaignAggregatedZaps.value.get(campaign.value.id) || []
  return campaignZaps.length
})

// Get total zap amount for this campaign
const totalZapAmount = computed(() => {
  if (!campaign.value) return 0
  const campaignZaps = campaignAggregatedZaps.value.get(campaign.value.id) || []
  return campaignZaps.reduce((sum, zap) => sum + zap.amount, 0)
})

const formatTimeAgo = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Copy to clipboard
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Open zap modal
const openZapModal = () => {
  showZapModal.value = true
}

// Open share modal
const openShareModal = () => {
  showShareModal.value = true
}

// Open user profile modal
const openUserProfile = () => {
  if (!campaignAuthor.value) return
  
  showUserModal.value = true
}

// Go back to campaigns list
const goBack = () => {
  changePage('campaigns')
}

// Initialize on mount
onMounted(async () => {
  await loadCampaign()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back Button -->
    <div>
      <button
        @click="goBack"
        class="btn-secondary inline-flex items-center space-x-2"
      >
        <IconArrowLeft class="w-4 h-4" />
        <span>Back to Campaigns</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && !campaign" class="bg-white/90 backdrop-blur-sm p-6 rounded-xl border border-orange-100/50 shadow-sm text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
      <p class="text-gray-600">Loading campaign...</p>
    </div>

    <!-- Error Message -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
      <div class="flex items-center space-x-3">
        <IconAlertCircle class="w-6 h-6 text-red-600" />
        <div>
          <h3 class="text-lg font-semibold text-red-800 mb-1">Error Loading Campaign</h3>
          <p class="text-red-700">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Campaign Details -->
    <div v-else-if="campaign" class="space-y-6">
      <!-- Campaign Header -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
        <!-- Campaign Image -->
        <div v-if="campaign.image" class="h-48 sm:h-64 w-full overflow-hidden">
          <img 
            :src="campaign.image" 
            :alt="campaign.title"
            class="w-full h-full object-cover"
            @error="$event.target.style.display = 'none'"
          />
        </div>
        
        <!-- Campaign Content -->
        <div class="p-6">
          <!-- Status and Author -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div class="flex items-center space-x-2">
              <span :class="[
                'px-2 py-1 rounded-full text-xs font-medium',
                statusColor
              ]">
                {{ status.charAt(0).toUpperCase() + status.slice(1) }}
              </span>
              <span class="text-xs text-gray-500">
                {{ formatDate(campaign.createdAt) }}
              </span>
            </div>
            
            <!-- Author -->
            <div 
              v-if="campaignAuthor"
              @click="openUserProfile"
              class="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded-lg transition-colors"
            >
              <img 
                :src="campaignAuthor.picture" 
                :alt="campaignAuthor.name"
                class="w-6 h-6 rounded-full object-cover"
                @error="$event.target.src = generateFallbackAvatar(campaignAuthor.pubkey)"
              />
              <span class="text-sm text-gray-700">{{ campaignAuthor.name }}</span>
            </div>
          </div>
          
          <!-- Title and Summary -->
          <h1 class="text-2xl font-bold text-gray-900 mb-3">{{ campaign.title }}</h1>
          <p class="text-gray-600 mb-6">{{ campaign.summary }}</p>
          
          <!-- Progress Bar -->
          <div class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700">Progress</span>
              <span class="text-sm font-medium text-orange-600">{{ progress.percentage }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-3">
              <div 
                class="bg-gradient-to-r from-orange-400 to-amber-400 h-3 rounded-full transition-all duration-500"
                :style="{ width: `${progress.percentage}%` }"
              ></div>
            </div>
            <div class="flex items-center justify-between mt-2">
              <span class="text-sm text-gray-600">{{ progress.current.toLocaleString() }} sats raised</span>
              <span class="text-sm text-gray-600">Goal: {{ formatAmount(campaign.goalAmount) }} sats</span>
            </div>
          </div>
          
          <!-- Campaign Info -->
          <div class="flex flex-wrap items-center gap-4 mb-6 text-sm">
            <div class="flex items-center space-x-1 text-gray-600">
              <IconClock class="w-4 h-4" />
              <span>{{ daysRemaining }}</span>
            </div>
            
            <div v-if="campaign.closedAt" class="flex items-center space-x-1 text-gray-600">
              <IconCalendar class="w-4 h-4" />
              <span>Ends {{ formatDate(campaign.closedAt) }}</span>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button
              @click="openZapModal"
              :disabled="status === 'expired' || status === 'completed' || !isAuthenticated" 
              class="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
              <IconBolt class="w-4 h-4" />
              <span class="font-medium">{{ isAuthenticated ? 'Zap Now' : 'Login to Zap' }}</span>
            </button>
            
            <button
              @click="openShareModal"
              class="btn-secondary flex-1 transform transition-all duration-300 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
            >
              <IconShare class="w-4 h-4" />
              <span class="font-medium">Share Campaign</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Recent Supporters -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-6 flex items-center space-x-2">
          <IconUsers class="w-5 h-5 text-orange-600" />
          <span>Recent Supporters</span>
          <span v-if="totalZapCount > 0" class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {{ totalZapCount }} zap{{ totalZapCount !== 1 ? 's' : '' }}
          </span>
        </h3>
        
        <div v-if="recentZaps.length === 0" class="text-center py-8">
          <IconBolt class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No Zaps Yet</h4>
          <p class="text-gray-600 text-sm">Be the first to support this campaign!</p>
        </div>
        
        <div v-else class="space-y-4">
          <!-- Total Stats -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-orange-700 font-medium">Total Support</p>
                <p class="text-2xl font-bold text-orange-600">{{ totalZapAmount.toLocaleString() }} sats</p>
              </div>
              <div class="text-right">
                <p class="text-sm text-orange-700 font-medium">Supporters</p>
                <p class="text-2xl font-bold text-orange-600">{{ totalZapCount }}</p>
              </div>
            </div>
          </div>
          
          <!-- Recent Zaps List -->
          <div v-for="zap in recentZaps" :key="zap.id" class="flex items-center space-x-3 p-3 bg-orange-50/50 rounded-lg">
            <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200 shadow-sm">
              <img 
                :src="zap.sender?.picture || zap.sender?.avatar" 
                :alt="zap.sender?.name || 'Anonymous'"
                class="w-full h-full object-cover"
                @error="$event.target.src = generateFallbackAvatar(zap.zapperPubkey)"
              />
            </div>
            <div class="flex-1 min-w-0 py-1">
              <p class="font-medium text-gray-900 truncate">
                {{ zap.sender?.name || 'Anonymous' }}
              </p>
              <p class="text-xs text-gray-500">{{ zap.timeAgo }}</p>
              <p v-if="zap.message" class="text-xs text-gray-600 italic mt-1 line-clamp-2">"{{ zap.message }}"</p>
            </div>
            <div class="text-right bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-2 rounded-lg shadow-sm">
              <p class="font-bold text-orange-600">{{ zap.amount.toLocaleString() }} sats</p>
            </div>
          </div>
          
          <!-- Show More Button (if there are more than 5 zaps) -->
          <div v-if="totalZapCount > 5" class="text-center pt-4 border-t border-orange-100">
            <p class="text-sm text-gray-600">
              Showing 5 of {{ totalZapCount }} supporters
            </p>
          </div>
        </div>
      </div>
      
      <!-- Campaign Details -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Campaign Details</h3>
        
        <div class="space-y-4">
          <!-- Event ID -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Event ID (NIP-75):</span>
            <div class="flex items-center space-x-2">
              <code class="text-xs bg-gray-100 px-2 py-1 rounded">{{ campaign.id.substring(0, 10) }}...{{ campaign.id.substring(campaign.id.length - 10) }}</code>
              <button
                @click="copyToClipboard(campaign.id, 'eventId')"
                class="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <IconCheck v-if="copySuccess === 'eventId'" class="w-4 h-4 text-green-600" />
                <IconCopy v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <!-- View in Nostr Client -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">View in Nostr client:</span>
            <div class="flex items-center space-x-2">
              <a 
                :href="`https://primal.net/e/${campaign.id}`" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-sm text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
              >
                <IconExternalLink class="w-4 h-4" />
                <span>Primal</span>
              </a>
              <a 
                :href="`https://yakihonne.com/e/${campaign.id}`" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-sm text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
              >
                <IconMessageCircle class="w-4 h-4" />
                <span>Yakihonne</span>
              </a>
            </div>
          </div>
          
          <!-- Relays -->
          <div>
            <span class="text-sm text-gray-600">Published to relays:</span>
            <div class="mt-2 space-y-2">
              <div v-for="(relay, index) in campaign.relays" :key="index" class="flex items-center justify-between">
                <code class="text-xs bg-gray-100 px-2 py-1 rounded">{{ relay }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Zap Modal -->
  <CampaignZapModal
    v-if="showZapModal && campaign"
    :campaign="campaign"
    :author="campaignAuthor"
    @close="showZapModal = false"
  />

  <!-- Share Modal -->
  <CampaignShareModal
    v-if="showShareModal && campaign"
    :campaign="campaign"
    @close="showShareModal = false"
  />

  <!-- User Profile Modal -->
  <UserProfileModal
    v-if="showUserModal && campaignAuthor"
    :show="showUserModal"
    :user-profile-data="{ pubkey: campaignAuthor.pubkey, profile: campaignAuthor }"
    @close="showUserModal = false"
  />
</template>