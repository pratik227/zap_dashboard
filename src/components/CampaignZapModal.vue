<script setup>
import { ref, computed, onMounted } from 'vue'
import { 
  IconBolt, 
  IconX, 
  IconSend, 
  IconAlertCircle,
  IconCheck,
  IconLoader,
  IconMessageCircle
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrConnections } from '../composables/useNostrConnections.js'
import { useNotifications } from '../composables/useNotifications.js'
import { makeZapRequest, getZapEndpoint } from 'nostr-tools/nip57'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { payInvoice } from '../utils/nwcClient.js'

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
const { isAuthenticated, currentUser } = useNostrAuth()
const { isWalletConnected } = useNostrConnections()
const { handleZapSent, handlePaymentSuccess, handlePaymentError } = useNotifications()

// Form state
const amount = ref(1000) // Default 1000 sats
const comment = ref('')
const isLoading = ref(false)
const error = ref('')
const success = ref(false)
const zapInvoice = ref('')

// Predefined amounts
const predefinedAmounts = [100, 1000, 5000, 10000, 21000, 50000]

// Computed properties
const isFormValid = computed(() => {
  return amount.value > 0
})

const canZap = computed(() => {
  return isAuthenticated.value && isWalletConnected.value
})

// Set predefined amount
const setAmount = (value) => {
  amount.value = value
}

// Send zap
const sendZap = async () => {
  if (!isFormValid.value) return
  if (!canZap.value) {
    error.value = 'You need to connect both Nostr and a Lightning wallet to zap'
    return
  }
  
  isLoading.value = true
  error.value = ''
  zapInvoice.value = ''
  
  try {
    // 1. Get author's zap endpoint from metadata
    const zapEndpoint = await getAuthorZapEndpoint()
    if (!zapEndpoint) {
      throw new Error('Campaign creator does not have a zap endpoint configured')
    }
    
    // 2. Create zap request
    const zapRequest = makeZapRequest({
      profile: props.author.pubkey,
      event: props.campaign.rawEvent,
      amount: amount.value * 1000, // Convert to millisats
      relays: props.campaign.relays || nostrRelayManager.getReadRelays().map(r => r.url),
      comment: comment.value
    })
    
    // 3. Get invoice from zap endpoint
    const response = await fetch(zapEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zap_request: JSON.stringify(zapRequest)
      })
    })
    
    if (!response.ok) {
      throw new Error(`Zap endpoint returned ${response.status}`)
    }
    
    const data = await response.json()
    
    if (!data.pr) {
      throw new Error('No payment request in response')
    }
    
    zapInvoice.value = data.pr
    
    // 4. Pay invoice using NWC
    const paymentResult = await payInvoice({
      invoice: data.pr
    })
    
    // 5. Handle success
    handlePaymentSuccess(paymentResult)
    handleZapSent({ amount: amount.value })
    
    success.value = true
    
    // Close modal after 3 seconds
    setTimeout(() => {
      emit('close')
    }, 3000)
    
  } catch (err) {
    console.error('Failed to send zap:', err)
    error.value = err.message
    handlePaymentError(err)
  } finally {
    isLoading.value = false
  }
}

// Get author's zap endpoint
const getAuthorZapEndpoint = async () => {
  try {
    // First check if we already have the endpoint in the author profile
    if (props.author.lud16) {
      // Convert Lightning Address to LNURL endpoint
      return `https://api.getalby.com/lnurlp/${props.author.lud16}`
    }
    
    // Otherwise, fetch author's profile metadata
    const metadata = await nostrRelayManager.getEvent({
      kinds: [0],
      authors: [props.author.pubkey],
      limit: 1
    })
    
    if (!metadata) {
      throw new Error('Author profile not found')
    }
    
    // Get zap endpoint from metadata
    const zapEndpoint = await getZapEndpoint(metadata)
    if (!zapEndpoint) {
      throw new Error('Author does not have a zap endpoint configured')
    }
    
    return zapEndpoint
  } catch (error) {
    console.error('Failed to get zap endpoint:', error)
    throw error
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <IconBolt class="w-5 h-5 text-orange-600" />
          <span>Zap Campaign</span>
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
        >
          <IconX class="w-5 h-5" />
        </button>
      </div>
      
      <!-- Success State -->
      <div v-if="success" class="text-center py-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCheck class="w-8 h-8 text-green-600" />
        </div>
        <h4 class="text-xl font-semibold text-green-700 mb-2">Zap Sent Successfully!</h4>
        <p class="text-gray-600 mb-4">Thank you for supporting this campaign.</p>
        <p class="text-sm text-gray-500">This window will close automatically...</p>
      </div>
      
      <!-- Zap Form -->
      <div v-else>
        <!-- Campaign Info -->
        <div class="bg-orange-50 rounded-lg p-4 mb-6">
          <h4 class="font-medium text-gray-900 mb-2">{{ campaign.title }}</h4>
          <div class="flex items-center space-x-2">
            <img 
              :src="author.picture" 
              :alt="author.name"
              class="w-6 h-6 rounded-full object-cover"
              @error="$event.target.src = generateFallbackAvatar(author.pubkey)"
            />
            <span class="text-sm text-gray-600">{{ author.name }}</span>
          </div>
        </div>
        
        <!-- Authentication Warning -->
        <div v-if="!canZap" class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div class="flex items-start space-x-3">
            <IconAlertCircle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-medium text-amber-800 mb-1">Connection Required</h4>
              <p class="text-sm text-amber-700">
                You need to connect both your Nostr identity and Lightning wallet to send zaps.
              </p>
            </div>
          </div>
        </div>
        
        <!-- Amount Selection -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Amount (sats)</label>
          <div class="grid grid-cols-3 gap-2 mb-3">
            <button
              v-for="value in predefinedAmounts"
              :key="value"
              @click="setAmount(value)"
              :class="[
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                amount === value
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              ]"
            >
              {{ value.toLocaleString() }}
            </button>
          </div>
          <div class="relative">
            <input
              v-model.number="amount"
              type="number"
              min="1"
              placeholder="Custom amount"
              class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <IconBolt class="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        <!-- Comment -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">Comment (optional)</label>
          <div class="relative">
            <textarea
              v-model="comment"
              rows="3"
              placeholder="Add a message with your zap..."
              class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            ></textarea>
            <div class="absolute top-3 right-3">
              <IconMessageCircle class="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-red-600">{{ error }}</span>
          </div>
        </div>
        
        <!-- Send Button -->
        <button
          @click="sendZap"
          :disabled="!isFormValid || isLoading || !canZap"
          class="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
          <IconBolt v-else class="w-4 h-4" />
          {{ isLoading ? 'Processing...' : 'Send Zap' }}
        </button>
      </div>
    </div>
  </div>
</template>