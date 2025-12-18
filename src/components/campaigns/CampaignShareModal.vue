<template>
  <div class="fixed inset-0 bg-black/50 z-50 md:flex md:items-center md:justify-center md:p-4" @click="handleBackdropClick">
    <div class="bg-white w-full max-w-md shadow-xl md:rounded-lg fixed bottom-0 left-0 right-0 md:relative rounded-t-2xl max-h-[90vh] overflow-y-auto" @click.stop>

      <!-- Mobile Bottom Sheet Handle -->
      <div class="md:hidden flex justify-center pt-3 pb-2">
        <div class="w-12 h-1 bg-gray-300 rounded-full"></div>
      </div>

      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">Share Campaign</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <IconX class="w-5 h-5" />
        </button>
      </div>

      <!-- Success State -->
      <div v-if="shareSuccess" class="p-6 text-center">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <IconCheck class="w-6 h-6 text-green-600" />
        </div>
        <h4 class="text-lg font-semibold text-gray-900 mb-2">Posted Successfully!</h4>
        <p class="text-sm text-gray-600">Your campaign is now shared on Nostr</p>
      </div>

      <!-- Main Content -->
      <div v-else class="p-6 space-y-4">

        <!-- Campaign Preview -->
        <div class="bg-gray-50 rounded-lg p-3 border">
          <div class="flex items-start gap-3">
            <div v-if="campaign.image" class="w-12 h-12 rounded overflow-hidden flex-shrink-0">
              <img :src="campaign.image" :alt="campaign.title" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-12 h-12 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
              <IconTarget class="w-6 h-6 text-orange-600" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-gray-900 text-sm truncate">{{ campaign.title }}</h4>
              <p class="text-xs text-gray-600 line-clamp-2">{{ campaign.summary }}</p>
              <div class="flex items-center justify-between mt-2">
                <span class="text-xs text-gray-500">Goal</span>
                <span class="text-xs font-semibold text-orange-600">{{ formatAmount(campaign.goalAmount) }} sats</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Share on Nostr -->
        <button
          @click="shareOnNostr"
          :disabled="!isAuthenticated || isSharing"
          class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
          <IconBolt v-else class="w-5 h-5" />
          <span>{{ isSharing ? 'Posting...' : 'Share on Nostr' }}</span>
        </button>

        <!-- Auth Warning -->
        <div v-if="!isAuthenticated" class="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <IconAlertCircle class="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p class="text-sm text-amber-800">Connect your Nostr identity to share</p>
        </div>

        <!-- Copy Link -->
        <div class="space-y-2">
          <button
            @click="copyAndShare"
            class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <IconCheck v-if="copySuccess" class="w-5 h-5 text-green-600" />
            <IconCopy v-else class="w-5 h-5" />
            <span>{{ copySuccess ? 'Copied!' : 'Copy Link' }}</span>
          </button>

          <div class="bg-gray-50 border rounded-lg p-2 flex items-center gap-2">
            <input :value="shareUrl" readonly class="flex-1 bg-transparent text-xs text-gray-600 border-none outline-none" />
            <button @click="copyToClipboard(shareUrl)" class="text-gray-400 hover:text-gray-600">
              <IconCopy class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Custom Message -->
        <details class="border rounded-lg">
          <summary class="p-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <IconEdit class="w-4 h-4 text-gray-500" />
              <span class="text-sm font-medium text-gray-700">Customize Message</span>
              <span v-if="mentionCount > 0" class="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                {{ mentionCount }}
              </span>
            </div>
          </summary>
          <div class="p-3 pt-0 space-y-2">
            <MentionInput
              v-model="customMessage"
              placeholder="Add your personal message... Type @ to mention"
              min-height="80px"
              max-height="160px"
              @mention-added="handleMentionAdded"
            />
            <p class="text-xs text-gray-500">Leave empty for default message</p>
          </div>
        </details>

        <!-- Info -->
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
          <IconBolt class="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-xs font-medium text-gray-900">Automatic Zap Tracking</p>
            <p class="text-xs text-gray-600">Zaps to your shared post count towards your goal</p>
          </div>
        </div>

        <!-- Error -->
        <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <IconAlertCircle class="w-4 h-4 text-red-600 flex-shrink-0" />
          <span class="text-sm text-red-700">{{ shareError }}</span>
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
  IconEdit,
  IconTarget,
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../../composables/campaigns/useCampaigns.js'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useMentions } from '../../composables/content/useMentions.js'
import { verifyEvent } from 'nostr-tools/pure'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import MentionInput from '../content/MentionInput.vue'

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
const { extractPTags, parseMentions } = useMentions()

const shareUrl = ref('')
const customMessage = ref('')
const copySuccess = ref(false)
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')

const defaultTags = ['ZapTracker', 'Bitcoin', 'Lightning', 'Nostr']

const generateShareUrl = () => {
  return `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
}

shareUrl.value = generateShareUrl()

const mentionCount = computed(() => {
  return parseMentions(customMessage.value || '').length
})

const handleMentionAdded = (user) => {
  console.log('Mention added to campaign share:', user)
}

const copyAndShare = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copySuccess.value = true

    setTimeout(() => {
      copySuccess.value = false
    }, 2000)

    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: `Support: ${props.campaign.title}`,
          text: `Help me reach my goal! ${props.campaign.summary}`,
          url: shareUrl.value
        })
      } catch (e) {
        console.log('Share cancelled')
      }
    }
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy:', error)
  }
}

const shareOnNostr = async () => {
  if (!props.isAuthenticated) {
    shareError.value = 'Please connect your Nostr identity to share'
    return
  }

  isSharing.value = true
  shareError.value = ''

  try {
    console.log('🔗 Sharing campaign on Nostr with goal tag...')

    const hashtagString = defaultTags.map(tag => `#${tag}`).join(' ')

    const content = customMessage.value.trim() ||
      `Support my campaign: ${props.campaign.title}\n\n${shareUrl.value}\n\n${hashtagString}`

    const mentionPTags = extractPTags(content)

    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['goal', props.campaign.id],
        ['e', props.campaign.id],
        ['p', props.campaign.pubkey],
        ...mentionPTags,
        ...defaultTags.map(tag => ['t', tag])
      ],
      content
    }

    let signedEvent
    if (window.nostr?.signEvent) {
      signedEvent = await window.nostr.signEvent(eventTemplate)
    } else {
      throw new Error('Nostr extension not available for signing')
    }

    const isValid = verifyEvent(signedEvent)
    if (!isValid) {
      throw new Error('Event signature verification failed')
    }

    const result = await nostrRelayManager.publishEvent(signedEvent)

    if (result.successful === 0) {
      throw new Error('Failed to publish to any relays')
    }

    console.log('✅ Campaign shared successfully')

    shareSuccess.value = true

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

const formatAmount = (amount) => {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats ? sats.toLocaleString() : '0'
}

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

details summary::-webkit-details-marker {
  display: none;
}

details[open] summary {
  border-bottom: 1px solid #e5e7eb;
}
</style>
