<template>
  <div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 p-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center shadow-sm">
              <IconShare class="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">Share Campaign</h3>
              <p class="text-sm text-gray-600">Spread the word and get support</p>
            </div>
          </div>
          <button
            @click="$emit('close')"
            class="w-8 h-8 bg-white/60 hover:bg-white/80 rounded-full flex items-center justify-center transition-all duration-200 text-gray-600 hover:text-gray-800"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="p-8 text-center">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconCheck class="w-8 h-8 text-green-600" />
        </div>
        <h4 class="text-xl font-bold text-gray-900 mb-2">Posted Successfully! 🎉</h4>
        <p class="text-gray-600 mb-4">Your campaign is now shared on Nostr</p>
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p class="text-sm text-orange-800">
            <IconBolt class="w-4 h-4 inline mr-1" />
            Zaps to your post will count towards your goal
          </p>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else class="p-6 space-y-6">
        <!-- Campaign Preview -->
        <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div class="flex items-start space-x-3">
            <div v-if="campaign.image" class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                :src="campaign.image" 
                :alt="campaign.title"
                class="w-full h-full object-cover"
                @error="$event.target.style.display = 'none'"
              />
            </div>
            <div v-else class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconTarget class="w-6 h-6 text-white" />
            </div>
            
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-gray-900 mb-1 line-clamp-1">{{ campaign.title }}</h4>
              <p class="text-sm text-gray-600 mb-2 line-clamp-2">{{ campaign.summary }}</p>
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-500">Goal</span>
                <span class="font-bold text-orange-600 text-sm">{{ formatAmount(campaign.goalAmount) }} sats</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Primary Action - Share on Nostr -->
        <div class="space-y-3">
          <button
            @click="shareOnNostr"
            :disabled="!isAuthenticated || isSharing"
            class="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
            <IconBolt v-else class="w-5 h-5" />
            <span class="text-lg">{{ isSharing ? 'Posting...' : 'Share on Nostr' }}</span>
          </button>
          
          <!-- Authentication Notice -->
          <div v-if="!isAuthenticated" class="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-4 h-4 text-amber-600" />
              <p class="text-sm text-amber-800">Connect your Nostr identity to share</p>
            </div>
          </div>
        </div>

        <!-- Copy Link -->
        <div class="space-y-3">
          <button
            @click="copyAndShare"
            class="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <IconCheck v-if="copySuccess" class="w-5 h-5 text-white" />
            <IconShare v-else class="w-5 h-5" />
            <span>{{ copySuccess ? 'Copied!' : 'Copy & Share Link' }}</span>
          </button>
          
          <!-- URL Preview -->
          <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div class="flex items-center space-x-2">
              <input
                :value="shareUrl"
                readonly
                class="flex-1 px-2 py-1 bg-transparent text-xs text-gray-600 font-mono border-none focus:outline-none"
              />
              <button
                @click="copyToClipboard(shareUrl)"
                class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <IconCopy class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Custom Message (Collapsible) -->
        <div class="border-t border-gray-100 pt-4">
          <button
            @click="showCustomMessage = !showCustomMessage"
            class="flex items-center justify-between w-full p-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div class="flex items-center space-x-2">
              <IconEdit class="w-4 h-4 text-gray-500" />
              <span class="text-sm font-medium text-gray-700">Custom Message</span>
            </div>
            <IconChevronDown :class="[
              'w-4 h-4 text-gray-500 transition-transform duration-200',
              showCustomMessage ? 'rotate-180' : ''
            ]" />
          </button>
          
          <transition name="slide-down">
            <div v-if="showCustomMessage" class="mt-3 space-y-3">
              <textarea
                v-model="customMessage"
                rows="3"
                :placeholder="defaultMessagePlaceholder"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-colors resize-none"
              ></textarea>
              <p class="text-xs text-gray-500">Leave empty to use the default message</p>
            </div>
          </transition>
        </div>

        <!-- Zap Info -->
        <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <div class="w-6 h-6 bg-gradient-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconBolt class="w-3 h-3 text-white" />
            </div>
            <div>
              <h4 class="font-medium text-orange-900 text-sm mb-1">Zap Tracking</h4>
              <p class="text-orange-800 text-xs leading-relaxed">
                Zaps sent to your shared post will automatically count towards your campaign goal.
              </p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-lg p-3">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-4 h-4 text-red-600" />
            <span class="text-sm text-red-600">{{ shareError }}</span>
          </div>
        </div>
      </div>

      <!-- Footer Branding -->
      <div class="bg-gray-50 border-t border-gray-100 px-6 py-3">
        <div class="flex items-center justify-center space-x-2 text-gray-500">
          <img 
            src="/new_logo3.png"
            alt="ZapTracker" 
            class="w-4 h-4 object-contain"
          />
          <span class="text-xs font-medium">Powered by ZapTracker</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  IconShare, 
  IconX, 
  IconCopy, 
  IconCheck, 
  IconBolt,
  IconLoader,
  IconAlertCircle,
  IconChevronDown,
  IconEdit,
  IconTarget
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { shareCampaignOnNostr } = useCampaigns()
const { currentUser } = useNostrAuth()

// State
const shareUrl = ref('')
const customMessage = ref('')
const copySuccess = ref(false)
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')
const showCustomMessage = ref(false)

// Default tags
const defaultTags = ['ZapTracker', 'Bitcoin', 'Lightning', 'Nostr']

// Generate share URL
const generateShareUrl = () => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
}

// Initialize share URL
shareUrl.value = generateShareUrl()

// Default message placeholder
const defaultMessagePlaceholder = computed(() => {
  return `Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n#ZapTracker #Lightning #Nostr`
})

// Copy to clipboard and trigger native share if available
const copyAndShare = async () => {
  try {
    // First copy to clipboard
    await navigator.clipboard.writeText(shareUrl.value)
    copySuccess.value = true
    
    // Reset copy success after 2 seconds
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
    
    // Try native share API (mobile)
    if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: `Support: ${props.campaign.title}`,
          text: `Help me reach my goal! ${props.campaign.summary}`,
          url: shareUrl.value
        })
      } catch (shareError) {
        // User cancelled share or share not supported, but clipboard copy succeeded
        console.log('Native share cancelled or not supported')
      }
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Copy to clipboard
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Share on Nostr
const shareOnNostr = async () => {
  if (!props.isAuthenticated) {
    shareError.value = 'Please connect your Nostr identity to share'
    return
  }

  isSharing.value = true
  shareError.value = ''

  try {
    console.log('🔗 Sharing campaign on Nostr with goal tag...')
    
    // Combine default tags with custom tags
    const hashtagString = defaultTags.map(tag => `#${tag}`).join(' ')
    
    // Create content with custom message or default
    const content = customMessage.value.trim() || 
      `Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n${hashtagString}`
    
    console.log('Share content:', content)
    
    // Create event template with proper goal tag
    const eventTemplate = {
      kind: 1, // Text note
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        // CRITICAL: Reference the campaign as a zapgoal with the "goal" tag (NIP-75)
        ['goal', props.campaign.id],
        
        // Also reference the campaign with an "e" tag for better client compatibility
        ['e', props.campaign.id],
        
        // Reference the campaign creator
        ['p', props.campaign.pubkey],
        
        // Add hashtags as t tags
        ...defaultTags.map(tag => ['t', tag])
      ],
      content
    }
    
    console.log('Event template with goal tag:', eventTemplate)
    
    // Sign the event
    let signedEvent
    if (window.nostr?.signEvent) {
      signedEvent = await window.nostr.signEvent(eventTemplate)
    } else {
      throw new Error('Nostr extension not available for signing')
    }
    
    console.log('Signed event with goal tag:', signedEvent)
    
    // Verify the signed event
    const isValid = verifyEvent(signedEvent)
    if (!isValid) {
      throw new Error('Event signature verification failed')
    }
    
    // Publish to relays
    const result = await nostrRelayManager.publishEvent(signedEvent)
    
    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays')
    }
    
    console.log('✅ Campaign shared successfully with goal tag:', {
      eventId: signedEvent.id,
      successfulRelays: result.successful,
      failedRelays: result.failed,
      goalTag: signedEvent.tags.find(tag => tag[0] === 'goal')
    })
    
    shareSuccess.value = true
    
    // Close modal after 3 seconds
    setTimeout(() => {
      emit('close')
    }, 3000)
    
  } catch (error) {
    console.error('Failed to share campaign:', error)
    shareError.value = error.message || 'Failed to share campaign'
  } finally {
    isSharing.value = false
  }
}

// Format amount in sats
const formatAmount = (amount) => {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
}
</script>

<style scoped>
/* Line clamp utilities */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Slide down animation for custom message */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
  overflow: hidden;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 200px;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Smooth micro-interactions */
button:not(:disabled) {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}
</style>