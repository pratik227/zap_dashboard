<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[95vh] overflow-hidden shadow-2xl">
      <!-- Close Button -->
      <button
        @click="closeModal"
        class="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <IconX class="w-5 h-5 text-gray-600" />
      </button>

      <!-- Success State -->
      <div v-if="paymentStatus === 'success'" class="p-8 text-center">
        <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <IconCheck class="w-10 h-10 text-green-600" />
        </div>
        <h2 class="text-3xl font-bold text-gray-900 mb-4">Thank You! 🎉</h2>
        <p class="text-xl text-gray-700 mb-6">
          Your {{ effectiveAmount.toLocaleString() }} sats contribution makes a difference!
        </p>
        <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6">
          <p class="text-orange-800 font-medium">
            🚀 Your support helps bring this campaign closer to its goal
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else class="overflow-y-auto max-h-[95vh]">
        <!-- Hero Header Section -->
        <div class="relative">
          <!-- Campaign Image -->
          <div class="h-64 sm:h-80 w-full overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100">
            <img 
              v-if="campaign.image"
              :src="campaign.image" 
              :alt="campaign.title"
              class="w-full h-full object-cover"
              @error="$event.target.style.display = 'none'"
            />
            <img 
              v-else
              src="/ZapTracker_campaigns.png" 
              alt="ZapTracker Campaign"
              class="w-full h-full object-cover opacity-80"
            />
            
            <!-- Gradient Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
          </div>
          
          <!-- Campaign Info Overlay -->
          <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
            <div class="max-w-3xl">
              <h1 class="text-2xl sm:text-4xl font-bold mb-3 leading-tight">{{ campaign.title }}</h1>
              <p class="text-lg sm:text-xl text-white/90 leading-relaxed">{{ campaign.summary }}</p>
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 sm:p-8">
          <!-- Left Column: Campaign Details & Supporters -->
          <div class="lg:col-span-2 space-y-8">
            <!-- Progress Section -->
            <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 sm:p-8 border border-orange-200">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-2xl font-bold text-gray-900 flex items-center space-x-3">
                  <IconTarget class="w-7 h-7 text-orange-600" />
                  <span>Campaign Progress</span>
                </h2>
                <div class="text-right">
                  <div class="text-3xl font-bold text-orange-600">{{ progress.percentage }}%</div>
                  <div class="text-sm text-orange-700">Complete</div>
                </div>
              </div>
              
              <!-- Progress Bar -->
              <div class="mb-6">
                <div class="w-full bg-orange-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    class="bg-gradient-to-r from-orange-400 to-amber-400 h-4 rounded-full transition-all duration-1000 ease-out shadow-sm"
                    :style="{ width: `${Math.min(progress.percentage, 100)}%` }"
                  ></div>
                </div>
              </div>
              
              <!-- Progress Stats -->
              <div class="grid grid-cols-2 gap-6">
                <div class="text-center">
                  <div class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                    {{ progress.current.toLocaleString() }}
                  </div>
                  <div class="text-sm text-gray-600">Sats Raised</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                    {{ formatAmount(campaign.goalAmount) }}
                  </div>
                  <div class="text-sm text-gray-600">Goal</div>
                </div>
              </div>
              
              <!-- Time Remaining -->
              <div v-if="daysRemaining !== 'No deadline'" class="mt-6 text-center">
                <div class="inline-flex items-center space-x-2 bg-white/60 px-4 py-2 rounded-full">
                  <IconClock class="w-4 h-4 text-orange-600" />
                  <span class="text-sm font-medium text-orange-800">{{ daysRemaining }}</span>
                </div>
              </div>
            </div>

            <!-- Supporters Section -->
            <div class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 class="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-3">
                <IconUsers class="w-6 h-6 text-orange-600" />
                <span>Recent Supporters</span>
                <span v-if="totalZapCount > 0" class="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {{ totalZapCount }} supporter{{ totalZapCount !== 1 ? 's' : '' }}
                </span>
              </h3>
              
              <div v-if="recentZaps.length === 0" class="text-center py-12">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <IconUsers class="w-8 h-8 text-gray-400" />
                </div>
                <h4 class="text-lg font-medium text-gray-900 mb-2">Be the First Supporter!</h4>
                <p class="text-gray-600">Your contribution will help kickstart this campaign</p>
              </div>
              
              <div v-else class="space-y-4">
                <!-- Supporter Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                  <div 
                    v-for="(zap, index) in recentZaps.slice(0, 6)" 
                    :key="zap.id"
                    class="group relative"
                  >
                    <!-- Major Supporter (10k+ sats) -->
                    <div 
                      v-if="zap.amount >= 10000"
                      class="relative transform hover:scale-105 transition-all duration-300"
                    >
                      <div class="w-20 h-20 rounded-full overflow-hidden border-4 border-gradient-to-r from-yellow-400 to-orange-400 shadow-lg mx-auto">
                        <img 
                          :src="zap.sender?.picture || zap.sender?.avatar" 
                          :alt="zap.sender?.name || 'Supporter'"
                          class="w-full h-full object-cover"
                          @error="$event.target.src = generateFallbackAvatar(zap.zapperPubkey)"
                        />
                      </div>
                      <div class="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                        <IconBolt class="w-3 h-3 text-yellow-800" />
                      </div>
                      <div class="text-center mt-2">
                        <div class="font-bold text-yellow-600 text-sm">{{ formatZapAmount(zap.amount) }}</div>
                        <div class="text-xs text-gray-600 truncate">{{ zap.sender?.name || 'Major Supporter' }}</div>
                      </div>
                    </div>
                    
                    <!-- Regular Supporter -->
                    <div 
                      v-else
                      class="relative transform hover:scale-105 transition-all duration-300"
                    >
                      <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-orange-200 shadow-md mx-auto">
                        <img 
                          :src="zap.sender?.picture || zap.sender?.avatar || generateFallbackAvatar(zap.zapperPubkey)" 
                          :alt="zap.sender?.name || 'Supporter'"
                          class="w-full h-full object-cover"
                          @error="$event.target.src = generateFallbackAvatar(zap.zapperPubkey)"
                        />
                      </div>
                      <div class="text-center mt-2">
                        <div class="font-medium text-orange-600 text-sm">{{ formatZapAmount(zap.amount) }}</div>
                        <div class="text-xs text-gray-600 truncate">{{ zap.sender?.name || 'Supporter' }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Total Support Summary -->
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-lg font-bold text-green-800">{{ totalZapAmount.toLocaleString() }} sats</div>
                      <div class="text-sm text-green-600">Total Support Received</div>
                    </div>
                    <div class="text-right">
                      <div class="text-lg font-bold text-green-800">{{ totalZapCount }}</div>
                      <div class="text-sm text-green-600">Supporters</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Campaign Description -->
            <div v-if="campaign.descriptionLong" class="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
              <h3 class="text-xl font-bold text-gray-900 mb-4">About This Campaign</h3>
              <div class="prose prose-gray max-w-none">
                <p class="text-gray-700 leading-relaxed whitespace-pre-wrap">{{ campaign.descriptionLong }}</p>
              </div>
            </div>
          </div>

          <!-- Right Column: Payment Section -->
          <div class="lg:col-span-1">
            <div class="sticky top-6">
              <!-- Payment Card -->
              <div class="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                <!-- Payment Header -->
                <div class="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6">
                  <h3 class="text-xl font-bold mb-2 flex items-center space-x-2">
                    <IconBolt class="w-6 h-6" />
                    <span>Support This Campaign</span>
                  </h3>
                  <p class="text-orange-100">Every sat counts towards the goal</p>
                </div>

                <!-- Payment Content -->
                <div class="p-6">
                  <!-- Amount Selection (Step 1) -->
                  <div v-if="currentStep === 'amount'" class="space-y-6">
                    <!-- Quick Amount Selection -->
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-4">Choose Amount</label>
                      <div class="grid grid-cols-2 gap-3 mb-4">
                        <button
                          v-for="amount in predefinedAmounts"
                          :key="amount.value"
                          @click="selectAmount(amount.value)"
                          :class="[
                            'p-4 rounded-xl border-2 text-center transition-all duration-200 hover:scale-105',
                            !isCustomAmount && zapAmount === amount.value
                              ? 'border-orange-400 bg-orange-50 shadow-md'
                              : 'border-gray-200 hover:border-orange-300 hover:bg-orange-25'
                          ]"
                        >
                          <div class="font-bold text-gray-900">{{ amount.label }}</div>
                          <div class="text-xs text-gray-500">{{ amount.description }}</div>
                        </button>
                      </div>
                      
                      <!-- Custom Amount -->
                      <div class="space-y-3">
                        <div class="flex items-center">
                          <input
                            type="checkbox"
                            :checked="isCustomAmount"
                            @change="toggleCustomAmount"
                            class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <label class="ml-2 text-sm font-medium text-gray-700">Custom amount</label>
                        </div>
                        
                        <div v-if="isCustomAmount" class="relative">
                          <input
                            v-model.number="customAmount"
                            type="number"
                            min="1"
                            placeholder="Enter sats"
                            class="w-full px-4 py-3 pr-16 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-0 transition-colors text-lg font-medium"
                          />
                          <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                            <span class="text-sm font-medium text-gray-500">sats</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Comment -->
                    <div>
                      <label class="block text-sm font-semibold text-gray-900 mb-3">Message (optional)</label>
                      <textarea
                        v-model="zapComment"
                        rows="3"
                        placeholder="Add an encouraging message..."
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-0 transition-colors resize-none"
                      ></textarea>
                    </div>
                    
                    <!-- Continue Button -->
                    <button
                      @click="generateInvoice"
                      :disabled="!canProceed || isLoading"
                      class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <IconLoader v-if="isLoading" class="w-5 h-5 animate-spin" />
                      <IconBolt v-else class="w-5 h-5" />
                      <span>{{ isLoading ? 'Creating Invoice...' : `Support with ${effectiveAmount.toLocaleString()} sats` }}</span>
                    </button>
                  </div>

                  <!-- Payment Options (Step 2) -->
                  <div v-else-if="currentStep === 'payment' && invoice" class="space-y-6">
                    <!-- Amount Summary -->
                    <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
                      <div class="flex items-center justify-between">
                        <span class="text-sm font-medium text-orange-800">Supporting with:</span>
                        <span class="text-xl font-bold text-orange-600">{{ effectiveAmount.toLocaleString() }} sats</span>
                      </div>
                      <div v-if="zapComment" class="mt-2 pt-2 border-t border-orange-200">
                        <p class="text-xs text-orange-700 italic">"{{ zapComment }}"</p>
                      </div>
                    </div>

                    <!-- QR Code -->
                    <div class="text-center">
                      <div class="bg-white p-6 rounded-xl border-2 border-gray-200 inline-block shadow-sm">
                        <QRCodeVue3
                          :value="`lightning:${invoice}`"
                          :size="200"
                          color="#000000"
                          background-color="#ffffff"
                          error-correction-level="M"
                        />
                      </div>
                      <p class="text-sm text-gray-600 mt-3">Scan with any Lightning wallet</p>
                    </div>
                    
                    <!-- Payment Buttons -->
                    <div class="space-y-3">
                      <!-- Pay with ZapTracker Wallet -->
                      <button
                        v-if="isWalletConnected"
                        @click="payWithInternalNWC"
                        :disabled="isProcessingPayment"
                        class="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <IconLoader v-if="isProcessingPayment" class="w-5 h-5 animate-spin" />
                        <IconWallet v-else class="w-5 h-5" />
                        <span>{{ isProcessingPayment ? 'Processing Payment...' : 'Pay with ZapTracker Wallet' }}</span>
                      </button>
                      
                      <!-- Open in External Wallet -->
                      <button
                        @click="openExternalWallet"
                        class="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <IconExternalLink class="w-5 h-5" />
                        <span>Open in Wallet</span>
                      </button>
                    </div>
                    
                    <!-- Back Button -->
                    <div class="text-center pt-4 border-t border-gray-200">
                      <button 
                        @click="resetToAmountSelection" 
                        class="text-gray-600 hover:text-gray-800 text-sm font-medium flex items-center space-x-1 mx-auto"
                      >
                        <IconArrowLeft class="w-4 h-4" />
                        <span>Change Amount</span>
                      </button>
                    </div>
                  </div>

                  <!-- Error State -->
                  <div v-else-if="paymentStatus === 'error'" class="space-y-6">
                    <div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconAlertCircle class="w-8 h-8 text-red-600" />
                      </div>
                      <h4 class="text-lg font-semibold text-red-800 mb-2">Payment Failed</h4>
                      <p class="text-sm text-red-700 mb-4">{{ error }}</p>
                      <button 
                        @click="resetToAmountSelection" 
                        class="btn-primary"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Trust Indicators -->
              <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div class="flex items-start space-x-3">
                  <IconShield class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 class="font-semibold text-blue-900 text-sm mb-1">Secure Lightning Payments</h4>
                    <p class="text-blue-800 text-xs leading-relaxed">
                      Powered by Bitcoin Lightning Network. Your payment is processed instantly and securely.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconBolt, 
  IconX, 
  IconCheck, 
  IconAlertCircle,
  IconLoader,
  IconTarget,
  IconUsers,
  IconClock,
  IconWallet,
  IconExternalLink,
  IconArrowLeft,
  IconShield
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useNostrConnections } from '../composables/useNostrConnections.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNotifications } from '../composables/useNotifications.js'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { makeZapRequest } from 'nostr-tools/nip57'
import { payInvoice } from '../utils/nwcClient.js'
import { bech32 } from 'bech32'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  },
  author: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

// Use composables
const { isWalletConnected } = useNostrConnections()
const { isAuthenticated, currentUser } = useNostrAuth()
const { handleZapSent, handlePaymentSuccess, handlePaymentError } = useNotifications()

// State
const zapAmount = ref(1000) // Default 1000 sats
const customAmount = ref(null)
const zapComment = ref('')
const isCustomAmount = ref(false)
const isLoading = ref(false)
const isProcessingPayment = ref(false)
const error = ref('')
const invoice = ref('')
const paymentStatus = ref('') // pending, success, error
const currentStep = ref('amount') // amount, payment

// Predefined amounts
const predefinedAmounts = [
  { value: 1000, label: '1K', description: 'Small boost' },
  { value: 5000, label: '5K', description: 'Good support' },
  { value: 10000, label: '10K', description: 'Strong support' },
  { value: 21000, label: '21K', description: 'Bitcoin tribute' }
]

// Get real campaign zap data from the campaigns composable
const { campaignAggregatedZaps } = useCampaigns()

// Get real zaps for this campaign
const recentZaps = computed(() => {
  if (!props.campaign?.id) return []
  
  const campaignZaps = campaignAggregatedZaps.value.get(props.campaign.id) || []
  console.log(`🔍 Campaign ${props.campaign.id.substring(0, 8)}... has ${campaignZaps.length} zaps`)
  
  return campaignZaps
    .slice(0, 10) // Show up to 10 recent supporters
    .map(zap => ({
      ...zap,
      timeAgo: formatTimeAgo(zap.timestamp)
    }))
})

const totalZapCount = computed(() => recentZaps.value.length)
const totalZapAmount = computed(() => recentZaps.value.reduce((sum, zap) => sum + zap.amount, 0))

// Computed properties
const effectiveAmount = computed(() => {
  return isCustomAmount.value ? (customAmount.value || 0) : zapAmount.value
})

const isValidAmount = computed(() => {
  return effectiveAmount.value > 0
})

const canProceed = computed(() => {
  return isAuthenticated.value && isValidAmount.value
})

// Calculate progress
const progress = computed(() => {
  const current = totalZapAmount.value
  const goal = Math.floor(props.campaign.goalAmount / 1000) // Convert millisats to sats
  const percentage = goal > 0 ? Math.min(100, Math.floor((current / goal) * 100)) : 0
  
  return {
    current,
    goal,
    percentage
  }
})

// Calculate days remaining
const daysRemaining = computed(() => {
  if (!props.campaign.closedAt) return 'No deadline'
  
  const now = Math.floor(Date.now() / 1000)
  const remaining = props.campaign.closedAt - now
  
  if (remaining <= 0) return 'Campaign ended'
  
  const days = Math.floor(remaining / (60 * 60 * 24))
  return days === 1 ? '1 day left' : `${days} days left`
})

// Watch for custom amount changes
watch(customAmount, (newValue) => {
  if (newValue) {
    isCustomAmount.value = true
  }
})

// Reset form to initial state
const resetForm = () => {
  zapAmount.value = 1000
  customAmount.value = null
  zapComment.value = ''
  isCustomAmount.value = false
  error.value = ''
  invoice.value = ''
  paymentStatus.value = ''
  currentStep.value = 'amount'
  isLoading.value = false
  isProcessingPayment.value = false
}

// Reset to amount selection (from payment view)
const resetToAmountSelection = () => {
  currentStep.value = 'amount'
  error.value = ''
  paymentStatus.value = ''
  invoice.value = ''
  isLoading.value = false
  isProcessingPayment.value = false
}

// Select predefined amount
const selectAmount = (amount) => {
  zapAmount.value = amount
  isCustomAmount.value = false
  customAmount.value = null
}

// Toggle custom amount
const toggleCustomAmount = () => {
  isCustomAmount.value = !isCustomAmount.value
  if (isCustomAmount.value && !customAmount.value) {
    customAmount.value = zapAmount.value
  }
}

// Generate Lightning invoice via NIP-57
const generateInvoice = async () => {
  if (!canProceed.value) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    console.log('Generating zap invoice for campaign:', props.campaign.id)
    
    // Get author's profile metadata to extract zap endpoint
    const profileEvent = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [props.author.pubkey],
      limit: 1
    })
    
    if (!profileEvent) {
      throw new Error('Could not find author profile')
    }
    
    // Get zap endpoint using proper nostr-tools implementation
    const zapEndpoint = await getZapEndpoint(profileEvent)
    
    if (!zapEndpoint) {
      throw new Error('Author does not have a zap endpoint configured')
    }
    
    console.log('Using zap endpoint:', zapEndpoint)
    
    // Create zap request
    const zapRequest = makeZapRequest({
      profile: props.author.pubkey,
      event: props.campaign.rawEvent,
      amount: effectiveAmount.value * 1000, // Convert to millisats
      comment: zapComment.value || `Zap for campaign: ${props.campaign.title}`,
      relays: props.campaign.relays || [
        'wss://relay.damus.io',
        'wss://nos.lol',
        'wss://relay.snort.social'
      ]
    })
    
    // CRITICAL: Add goal and event tags for proper campaign tracking
    if (!zapRequest.tags) {
      zapRequest.tags = []
    }
    
    // Add goal tag for NIP-75 campaign tracking
    zapRequest.tags.push(['goal', props.campaign.id])
    
    // Add event tag to reference the campaign
    zapRequest.tags.push(['e', props.campaign.id])
    
    console.log('Created zap request:', zapRequest)
    
    // Get invoice from zap endpoint
    const zapRequestString = JSON.stringify(zapRequest)
    const encodedZapRequest = encodeURIComponent(zapRequestString)
    const zapEndpointUrl = `${zapEndpoint}?amount=${effectiveAmount.value * 1000}&nostr=${encodedZapRequest}`
    
    console.log('Requesting invoice from zap endpoint:', zapEndpointUrl)
    
    const response = await fetch(zapEndpointUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Zap endpoint error response:', errorText)
      throw new Error(`Zap endpoint returned ${response.status}: ${errorText}`)
    }
    
    const zapEndpointResponse = await response.json()
    console.log('Zap endpoint response:', zapEndpointResponse)
    
    if (!zapEndpointResponse.pr) {
      console.error('Zap endpoint response:', zapEndpointResponse)
      throw new Error('No payment request in zap endpoint response')
    }
    
    invoice.value = zapEndpointResponse.pr
    currentStep.value = 'payment'
    console.log('Invoice generated successfully, transitioning to payment view')
    
  } catch (err) {
    console.error('Failed to generate invoice:', err)
    error.value = err.message || 'Failed to generate invoice'
    paymentStatus.value = 'error'
  } finally {
    isLoading.value = false
  }
}

// Pay with internal NWC wallet
const payWithInternalNWC = async () => {
  if (!invoice.value || !isWalletConnected.value) return
  
  isProcessingPayment.value = true
  error.value = ''
  
  try {
    console.log('Paying with internal NWC wallet...')
    
    const paymentResult = await payInvoice({
      invoice: invoice.value
    })
    
    console.log('Internal NWC payment successful:', paymentResult)
    paymentStatus.value = 'success'
    
    // Notify about successful payment
    handlePaymentSuccess(paymentResult)
    handleZapSent({ 
      amount: effectiveAmount.value,
      recipient: props.author.name || 'Campaign Author'
    })
    
    // Close modal after 4 seconds
    setTimeout(() => {
      emit('close')
    }, 4000)
    
  } catch (err) {
    console.error('Internal NWC payment failed:', err)
    error.value = err.message || 'Payment failed'
    paymentStatus.value = 'error'
    handlePaymentError(err)
  } finally {
    isProcessingPayment.value = false
  }
}

// Open in external wallet
const openExternalWallet = () => {
  if (!invoice.value) return
  
  try {
    console.log('Opening invoice in external wallet...')
    
    // Create lightning: URI and attempt to open it
    const lightningUri = `lightning:${invoice.value}`
    window.open(lightningUri, '_blank')
    
    console.log('Lightning URI opened:', lightningUri)
    
  } catch (err) {
    console.error('Failed to open external wallet:', err)
    error.value = 'Failed to open external wallet'
  }
}

// Proper getZapEndpoint implementation based on nostr-tools
async function getZapEndpoint(metadata) {
  try {
    let lnurl = ''
    const profile = JSON.parse(metadata.content)
    const { lud06, lud16 } = profile
    
    if (lud06) {
      // Decode bech32 lud06 to get LNURL
      try {
        const { words } = bech32.decode(lud06, 1000)
        const data = bech32.fromWords(words)
        lnurl = new TextDecoder().decode(new Uint8Array(data))
      } catch (decodeError) {
        console.error('Failed to decode lud06:', decodeError)
        throw new Error('Invalid lud06 format')
      }
    } else if (lud16) {
      // Convert lightning address to LNURL
      const [name, domain] = lud16.split('@')
      if (!name || !domain) {
        throw new Error('Invalid lightning address format')
      }
      lnurl = `https://${domain}/.well-known/lnurlp/${name}`
    } else {
      return null
    }
    
    console.log('Resolved LNURL:', lnurl)
    
    // Fetch LNURL metadata
    const response = await fetch(lnurl)
    if (!response.ok) {
      throw new Error(`LNURL endpoint returned ${response.status}`)
    }
    
    const body = await response.json()
    console.log('LNURL response:', body)
    
    // Check for NIP-57 zap compatibility
    if (body.allowsNostr && body.nostrPubkey) {
      console.log('Zap endpoint found:', body.callback)
      return body.callback
    } else {
      console.log('LNURL endpoint does not support zaps')
      return null
    }
  } catch (err) {
    console.error('Failed to get zap endpoint:', err)
    throw err
  }
}

// Format amount in sats
const formatAmount = (amount) => {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
}

// Format zap amount for display
const formatZapAmount = (amount) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toString()
}

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Close modal
const closeModal = () => {
  resetForm()
  emit('close')
}
</script>

<style scoped>
/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Button Styles */
.btn-primary {
  @apply bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    font-size: 16px; /* Prevent zoom on iOS */
  }
  
  .btn-primary {
    min-height: 44px;
  }
}

/* Gradient border effect for major supporters */
.border-gradient-to-r {
  border: 4px solid;
  border-image: linear-gradient(45deg, #fbbf24, #f97316) 1;
}

/* Animation for progress bar */
@keyframes fillProgress {
  from { width: 0%; }
  to { width: var(--progress-width); }
}

/* Smooth hover effects */
.transform {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}
</style>