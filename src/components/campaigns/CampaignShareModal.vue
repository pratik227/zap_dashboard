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

      <!-- ── Success State ────────────────────────────────────────────── -->
      <div v-if="shareSuccess" class="p-6 space-y-4">
        <div class="text-center">
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <IconCheck class="w-6 h-6 text-green-600" />
          </div>
          <h4 class="text-lg font-semibold text-gray-900 mb-1">Posted to Nostr!</h4>
          <p class="text-sm text-gray-600">Your campaign is now visible on the Nostr network</p>
        </div>

        <!-- View on Nostr -->
        <a
          v-if="viewUrl"
          :href="viewUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          View on Nostr
          <IconExternalLink class="w-4 h-4" />
        </a>

        <!-- Remove post -->
        <div class="text-center">
          <template v-if="!postDeleted">
            <button
              @click="deleteSharedPost"
              :disabled="isDeleting"
              class="text-sm text-gray-400 hover:text-red-500 transition-colors inline-flex items-center gap-1"
            >
              <IconLoader v-if="isDeleting" class="w-3.5 h-3.5 animate-spin" />
              <IconTrash v-else class="w-3.5 h-3.5" />
              {{ isDeleting ? 'Removing...' : 'Remove this post' }}
            </button>
          </template>
          <p v-else class="text-sm text-green-600 inline-flex items-center gap-1">
            <IconCheck class="w-4 h-4" />
            Post removed
          </p>
        </div>

        <!-- Error in success state -->
        <div v-if="shareError" class="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <IconAlertCircle class="w-4 h-4 text-red-600 flex-shrink-0" />
          <span class="text-sm text-red-700">{{ shareError }}</span>
        </div>

        <!-- Done button -->
        <button
          @click="$emit('close')"
          class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-colors"
        >
          Done
        </button>
      </div>

      <!-- ── Compose State ────────────────────────────────────────────── -->
      <div v-else class="p-6 space-y-4">

        <!-- Campaign Preview -->
        <div class="bg-gray-50 rounded-lg p-3 border">
          <div class="flex items-start gap-3">
            <div v-if="campaign.image" class="w-12 h-12 rounded overflow-hidden flex-shrink-0">
              <img :src="campaign.image" :alt="campaign.title" class="w-full h-full object-cover" @error="$event.target.parentElement.style.display = 'none'" />
            </div>
            <div v-else class="w-12 h-12 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
              <IconTarget class="w-6 h-6 text-orange-600" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-medium text-gray-900 text-sm truncate">{{ campaign.title }}</h4>
              <p class="text-xs text-gray-600 line-clamp-2">{{ campaign.summary }}</p>
              <div class="flex items-center justify-between mt-2">
                <span class="text-xs text-gray-500">Goal</span>
                <span class="text-xs font-semibold text-orange-600">{{ formatMsatsToSats(campaign.goalAmount) }} sats</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Recently shared warning -->
        <div v-if="recentShareInfo" class="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <IconAlertCircle class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p class="text-sm text-amber-700">
            You posted this campaign {{ timeAgoText }}. Posting again creates a duplicate.
          </p>
        </div>

        <!-- Message -->
        <div class="space-y-1.5">
          <label class="text-sm font-medium text-gray-700">Message</label>
          <MentionInput
            v-model="composedMessage"
            placeholder="Write your message..."
            min-height="100px"
            max-height="200px"
            @mention-added="handleMentionAdded"
          />
          <p class="text-xs text-gray-500">Type @ to mention someone. #hashtags are included as tags.</p>
        </div>

        <!-- Post to Nostr -->
        <button
          @click="shareOnNostr"
          :disabled="!isAuthenticated || isSharing"
          class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <IconLoader v-if="isSharing" class="w-5 h-5 animate-spin" />
          <IconBolt v-else class="w-5 h-5" />
          <span>{{ isSharing ? 'Posting...' : 'Post to Nostr' }}</span>
        </button>

        <!-- Auth Warning -->
        <div v-if="!isAuthenticated" class="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
          <IconAlertCircle class="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p class="text-sm text-amber-800">Sign in with Nostr to post</p>
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

        <!-- Info -->
        <div class="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
          <IconBolt class="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-xs font-medium text-gray-900">Automatic Zap Tracking</p>
            <p class="text-xs text-gray-600">Zaps to your shared post count towards your campaign goal</p>
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

<!-- Module-scope: persists across component instances -->
<script>
// Track recent shares for cooldown warning (resets on page refresh)
const recentShares = new Map() // campaignId -> { eventId, timestamp }
const SHARE_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

// Extract #hashtags from content for t-tags
const extractHashtags = (content) => {
  const tags = new Set()
  for (const match of content.matchAll(/#(\w+)/g)) {
    tags.add(match[1].toLowerCase())
  }
  return [...tags]
}
</script>

<script setup>
import { ref, computed } from 'vue'
import { formatMsatsToSats } from '../../utils/format.js'
import {
  IconX,
  IconCopy,
  IconCheck,
  IconBolt,
  IconLoader,
  IconAlertCircle,
  IconTarget,
  IconExternalLink,
  IconTrash,
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useMentions } from '../../composables/content/useMentions.js'
import { nip19 } from '../../services/nostr/nostrImports.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { publishService } from '../../services/nostr/PublishService.js'
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

const { currentUser } = useNostrAuth()
const { extractPTags } = useMentions()

// ── State ──────────────────────────────────────────────────────────────────

const shareUrl = computed(() =>
  `${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}`
)

const composedMessage = ref(
  `Support my campaign: ${props.campaign.title}\n\n${window.location.origin}?page=campaign-view&eventId=${props.campaign.id}\n\n#ZapTracker #Bitcoin #Lightning #Nostr`
)

const copySuccess = ref(false)
const isSharing = ref(false)
const shareSuccess = ref(false)
const shareError = ref('')

// Post-share state
const publishedEventId = ref(null)
const isDeleting = ref(false)
const postDeleted = ref(false)

// ── Recent share check (evaluated once at mount) ───────────────────────────

const recentShareInfo = ref(null)
{
  const recent = recentShares.get(props.campaign.id)
  if (recent && Date.now() - recent.timestamp < SHARE_COOLDOWN_MS) {
    recentShareInfo.value = recent
  }
}

const timeAgoText = computed(() => {
  if (!recentShareInfo.value) return ''
  const minutes = Math.floor((Date.now() - recentShareInfo.value.timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 minute ago'
  return `${minutes} minutes ago`
})

// ── View URL (njump.me with nevent encoding) ───────────────────────────────

const viewUrl = computed(() => {
  if (!publishedEventId.value) return ''
  try {
    const relays = nostrService.getReadRelays().map(r => r.url).slice(0, 3)
    const nevent = nip19.neventEncode({ id: publishedEventId.value, relays })
    return `https://njump.me/${nevent}`
  } catch {
    return ''
  }
})

// ── Actions ────────────────────────────────────────────────────────────────

const handleMentionAdded = (user) => {
  // Mention tracking handled by composable
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
      } catch {
        // User cancelled the share dialog
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
    shareError.value = 'Sign in with Nostr to post'
    return
  }

  const content = composedMessage.value.trim()
  if (!content) {
    shareError.value = 'Please enter a message'
    return
  }

  isSharing.value = true
  shareError.value = ''

  try {
    // Extract hashtags from the actual content for t-tags
    const hashtags = extractHashtags(content)

    // Extract @mention p-tags from NIP-21 URIs in content
    const mentionPTags = extractPTags(content)

    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['goal', props.campaign.id],
        ['e', props.campaign.id],
        ['p', props.campaign.pubkey],
        ...mentionPTags,
        ...hashtags.map(tag => ['t', tag])
      ],
      content
    }

    if (!signerService.isConnected) {
      throw new Error('Nostr signer not available')
    }

    const { event: signedEvent } = await publishService.signAndPublish(eventTemplate)

    // Track for cooldown and post-share actions
    publishedEventId.value = signedEvent.id
    recentShares.set(props.campaign.id, {
      eventId: signedEvent.id,
      timestamp: Date.now()
    })

    shareSuccess.value = true
  } catch (error) {
    console.error('Failed to share campaign:', error)
    shareError.value = error.userMessage || error.message || 'Failed to post'
  } finally {
    isSharing.value = false
  }
}

const deleteSharedPost = async () => {
  if (!publishedEventId.value) return

  isDeleting.value = true
  shareError.value = ''

  try {
    const eventTemplate = {
      kind: 5, // NIP-09 deletion
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', publishedEventId.value]],
      content: ''
    }

    await publishService.signAndPublish(eventTemplate)

    postDeleted.value = true
    recentShares.delete(props.campaign.id)
  } catch (error) {
    console.error('Failed to delete shared post:', error)
    shareError.value = error.userMessage || error.message || 'Failed to remove post'
  } finally {
    isDeleting.value = false
  }
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
</style>
