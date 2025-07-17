<script setup>
import { ref, computed } from 'vue'
import { 
  IconShare, 
  IconX, 
  IconCopy, 
  IconCheck, 
  IconBrandTwitter,
  IconBrandFacebook,
  IconExternalLink,
  IconMessageCircle,
  IconLoader
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'
import QRCodeVue3 from 'qrcode-vue3'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const { shareCampaignOnNostr } = useCampaigns()

// UI state
const copySuccess = ref('')
const customMessage = ref('')
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')

// Generate share URL
const shareUrl = computed(() => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
})

// Generate share text
const shareText = computed(() => {
  return `⚡ I'm raising sats! Support my campaign: ${props.campaign.title}`
})

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

// Share on Nostr
const shareOnNostr = async () => {
  isSharing.value = true
  shareError.value = ''
  
  try {
    await shareCampaignOnNostr(props.campaign.id, customMessage.value)
    shareSuccess.value = true
    
    // Reset form
    customMessage.value = ''
    
    // Close modal after 2 seconds
    setTimeout(() => {
      emit('close')
    }, 2000)
  } catch (error) {
    shareError.value = error.message
    console.error('Failed to share on Nostr:', error)
  } finally {
    isSharing.value = false
  }
}

// Share on Twitter
const shareOnTwitter = () => {
  const text = encodeURIComponent(`${shareText.value}\n\n${shareUrl.value}`)
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
}

// Share on Facebook
const shareOnFacebook = () => {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl.value)}`, '_blank')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
          <IconShare class="w-5 h-5 text-orange-600" />
          <span>Share Campaign</span>
        </h3>
        <button
          @click="$emit('close')"
          class="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
        >
          <IconX class="w-5 h-5" />
        </button>
      </div>
      
      <!-- Campaign Info -->
      <div class="bg-orange-50 rounded-lg p-4 mb-6">
        <h4 class="font-medium text-gray-900 mb-2">{{ campaign.title }}</h4>
        <p class="text-sm text-gray-600">{{ campaign.summary }}</p>
      </div>
      
      <!-- QR Code -->
      <div class="mb-6 text-center">
        <div class="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
          <QRCodeVue3
            :value="shareUrl"
            :size="200"
            color="#000000"
            background-color="#ffffff"
            error-correction-level="M"
          />
        </div>
      </div>
      
      <!-- Share URL -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Campaign URL</label>
        <div class="flex items-center">
          <input
            type="text"
            :value="shareUrl"
            readonly
            class="flex-1 px-3 py-2 border border-orange-200/50 rounded-l-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-gray-50"
          />
          <button
            @click="copyToClipboard(shareUrl, 'url')"
            class="px-3 py-2 bg-orange-100 text-orange-700 rounded-r-lg hover:bg-orange-200 transition-colors"
          >
            <IconCheck v-if="copySuccess === 'url'" class="w-4 h-4 text-green-600" />
            <IconCopy v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <!-- Share on Nostr -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Share on Nostr</label>
        <textarea
          v-model="customMessage"
          rows="3"
          :placeholder="shareText"
          class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
        ></textarea>
        <button
          @click="shareOnNostr"
          :disabled="isSharing"
          class="mt-2 w-full btn-primary"
        >
          <IconLoader v-if="isSharing" class="w-4 h-4 animate-spin" />
          <IconMessageCircle v-else class="w-4 h-4" />
          {{ isSharing ? 'Sharing...' : 'Post to Nostr' }}
        </button>
        
        <!-- Share Success -->
        <div v-if="shareSuccess" class="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <div class="flex items-center space-x-2">
            <IconCheck class="w-4 h-4 text-green-600" />
            <span class="text-sm text-green-800">Shared successfully on Nostr!</span>
          </div>
        </div>
        
        <!-- Share Error -->
        <div v-if="shareError" class="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <div class="flex items-center space-x-2">
            <IconX class="w-4 h-4 text-red-600" />
            <span class="text-sm text-red-800">{{ shareError }}</span>
          </div>
        </div>
      </div>
      
      <!-- Social Media Sharing -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Share on Social Media</label>
        <div class="flex space-x-2">
          <button
            @click="shareOnTwitter"
            class="flex-1 bg-[#1DA1F2] hover:bg-[#1a94df] text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <IconBrandTwitter class="w-4 h-4" />
            <span>Twitter</span>
          </button>
          <button
            @click="shareOnFacebook"
            class="flex-1 bg-[#4267B2] hover:bg-[#365899] text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <IconBrandFacebook class="w-4 h-4" />
            <span>Facebook</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>