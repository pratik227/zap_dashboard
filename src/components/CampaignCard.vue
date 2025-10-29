<script setup>
import { computed } from 'vue'
import { 
  IconTarget, 
  IconBolt, 
  IconCalendar, 
  IconUsers, 
  IconShare,
  IconTrash,
  IconEdit,
  IconExternalLink,
  IconChevronRight,
  IconClock,
  IconArrowRight,
  IconEye
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  },
  showActions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['view', 'edit', 'delete', 'share'])

const { getCampaignProgress, isCampaignExpired, isCampaignCompleted, getCampaignStatus } = useCampaigns()

// Calculate progress
const progress = computed(() => {
  return getCampaignProgress(props.campaign.id)
})

// Format amount in sats
const formatAmount = (amount) => {
  if (amount === undefined || amount === null) return '0'
  
  try {
    // Convert from millisats to sats
    const sats = Math.floor(amount / 1000)
    return sats ? sats.toLocaleString() : '0'
  } catch (error) {
    console.error('Error formatting amount:', error, amount)
    return '0'
  }
}

// Format amount safely
const formatAmountSafe = (amount) => {
  if (amount === undefined || amount === null) return '0'
  
  try {
    // Convert from millisats to sats
    const sats = Math.floor(amount / 1000)
    return sats ? sats.toLocaleString() : '0'
  } catch (error) {
    console.error('Error formatting amount:', error, amount)
    return '0'
  }
}

// Get campaign ID for display
const getCampaignId = (campaign) => {
  if (!campaign || !campaign.id) return 'Unknown ID'
  return campaign.id
}

// Calculate days remaining
const daysRemaining = computed(() => {
  if (!props.campaign.closedAt) return 'No deadline'
  
  const now = Math.floor(Date.now() / 1000)
  const remaining = props.campaign.closedAt - now
  
  if (remaining <= 0) return 'Ended'
  
  const days = Math.floor(remaining / (60 * 60 * 24))
  return days === 1 ? '1 day left' : `${days} days left`
})

// Get campaign status
const status = computed(() => {
  return getCampaignStatus(props.campaign)
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
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="bg-white rounded-xl border border-orange-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden transform hover:-translate-y-1">
    <!-- Campaign Image with Overlay -->
    <div v-if="campaign.image" class="relative h-48 w-full overflow-hidden group">
      <img 
        :src="campaign.image" 
        :alt="campaign.title"
        class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        @error="$event.target.style.display = 'none'"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
        <button 
          @click="$emit('view', campaign)"
          class="text-white bg-orange-500/80 hover:bg-orange-500 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-all duration-200"
        >
          <IconEye class="w-4 h-4" />
          <span>View Details</span>
        </button>
      </div>
      
      <!-- Status Badge -->
      <div class="absolute top-3 right-3">
        <span :class="[
          'px-2.5 py-1 rounded-full text-xs font-medium shadow-sm',
          statusColor
        ]">
          {{ status.charAt(0).toUpperCase() + status.slice(1) }}
        </span>
      </div>
    </div>
    <div v-else class="relative h-48 w-full overflow-hidden group bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
      <img
        src="/ZapTracker_campaigns.png"
        alt="ZapTracker Default Campaign Image"
        class="w-full h-full object-cover opacity-80"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
        <button 
          @click="$emit('view', campaign)"
          class="text-white bg-orange-500/80 hover:bg-orange-500 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center space-x-1 transition-all duration-200"
        >
          <IconEye class="w-4 h-4" />
          <span>View Details</span>
        </button>
      </div>
    </div>
    
    <!-- Campaign Content -->
    <div class="p-5">
      <!-- Header -->
      <div class="mb-4">
        <!-- Status and Date (only show if no image) -->
        <div v-if="!campaign.image" class="flex items-center space-x-2 mb-2">
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
        
        <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-orange-600 transition-colors duration-200">
          {{ campaign.title }}
          <span class="text-xs text-gray-400 font-normal ml-1">#{{ campaign.id.substring(0, 6) }}</span>
        </h3>
        <p v-if="campaign.summary" class="text-sm text-gray-600 mb-4 line-clamp-3">{{ campaign.summary }}</p>
      </div>
      
      <!-- Progress Bar -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-sm font-medium text-gray-700">Progress</span>
          <span class="text-sm font-medium text-orange-600">{{ progress.percentage }}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
          <div 
            class="bg-gradient-to-r from-orange-400 to-amber-400 h-2.5 rounded-full transition-all duration-500"
            :style="{ width: `${progress.percentage}%` }"
          ></div>
        </div>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-xs text-gray-500">{{ progress.current.toLocaleString() }} sats raised</span>
          <span class="text-xs text-gray-500">Goal: {{ formatAmountSafe(campaign.goalAmount) }} sats</span>
        </div>
      </div>
      
      <!-- Campaign Info -->
      <div class="flex items-center space-x-4 mb-4 text-sm">
        <div class="flex items-center space-x-1.5 text-gray-600">
          <div class="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
            <IconClock class="w-3.5 h-3.5 text-orange-600" />
          </div>
          <span>{{ daysRemaining }}</span>
        </div>
      </div>
      
      <!-- Actions -->
      <div v-if="showActions" class="flex items-center justify-between pt-4 border-t border-orange-100">
        <button
          @click="$emit('view', campaign)"
          class="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center space-x-1 group"
        >
          <span>View Details</span>
          <IconArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
        
        <div class="flex items-center space-x-1">
<!--          <button-->
<!--            v-if="status === 'active'"-->
<!--            @click="$emit('edit', campaign)"-->
<!--            class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"-->
<!--            title="Edit campaign"-->
<!--          >-->
<!--            <IconEdit class="w-4 h-4" />-->
<!--          </button>-->
          
          <button
            @click="$emit('share', campaign)"
            class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Share campaign"
          >
            <IconShare class="w-4 h-4" />
          </button>
          
          <button
            @click="$emit('delete', campaign)"
            class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete campaign"
          >
            <IconTrash class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
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

/* Smooth hover transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>