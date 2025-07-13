<script setup>
import { ref, onMounted, watch, onUnmounted, computed, inject } from 'vue'
import {
  IconX, 
  IconBolt, 
  IconUser, 
  IconCalendar, 
  IconMessageCircle, 
  IconRepeat, 
  IconHeart,
  IconExternalLink,
  IconLoader,
  IconAlertCircle,
  IconFileText,
  IconPhoto,
  IconVideo,
  IconMicrophone, 
  IconLink, 
  IconHash,
  IconChevronDown,
  IconCheck
} from '@iconify-prerendered/vue-tabler'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { useNostrAuth } from '../composables/useNostrAuth.js' 
import { useContentZaps } from '../composables/useContentZaps.js'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  eventId: {
    type: String,
    required: true
  },
  specificZapId: {
    type: String,
    required: false,
    default: null
  },
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

// State
const isLoading = ref(false)
const error = ref('')
const event = ref(null)
const eventAuthor = ref(null)
const specificZap = ref(null)
const showClientDropdown = ref(false)
const dropdownRef = ref(null)
const copiedItem = ref(null)

// Use Nostr auth to get user profile
const { isAuthenticated } = useNostrAuth()
const { getTotalZapAmount, getZapsForContent } = useContentZaps()
const combinedZapData = inject('combinedZapData')

// Fetch event when modal is shown
watch(() => props.show, async (show) => {
  if (show && props.eventId) {
    await fetchEvent()
  }
})

// Fetch event when eventId changes
watch(() => props.eventId, async (newId, oldId) => {
  if (newId && newId !== oldId && props.show) {
    await fetchEvent()
  }
})

// Fetch event on mount if show is true
onMounted(async () => {
  if (props.show && props.eventId) {
    await fetchEvent()
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

const toggleClientDropdown = () => {
  showClientDropdown.value = !showClientDropdown.value
}

// Get URL for different Nostr clients
const getNostrClientUrl = (client) => {
  if (!event.value) return '#'
  
  try {
    // For all clients, use the event ID directly
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${event.value.id}`
      case 'yakihonne':
        return `https://yakihonne.com/e/${event.value.id}`
      default:
        return `https://primal.net/e/${event.value.id}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

// Fetch event from Nostr relays
const fetchEvent = async () => {
  if (!props.eventId) return
  
  isLoading.value = true
  error.value = ''
  event.value = null
  eventAuthor.value = null
  specificZap.value = null
  
  try {
    console.log(`Fetching event: ${props.eventId}`)
    
    // Fetch the event
    const fetchedEvent = await nostrRelayManager.getEvent({
      ids: [props.eventId]
    })
    
    if (!fetchedEvent) {
      throw new Error('Event not found')
    }
    
    event.value = fetchedEvent
    console.log('Event fetched:', fetchedEvent)
    
    // Fetch author profile
    await fetchAuthorProfile(fetchedEvent.pubkey)

    // Find the specific zap if specificZapId is provided
    if (props.specificZapId) {
      console.log('Looking for specific zap:', props.specificZapId)
      const zap = combinedZapData.value.find(z => z.id === props.specificZapId)
      if (zap) {
        console.log('Found specific zap:', zap)
        specificZap.value = zap
      } else {
        console.warn('Specific zap not found:', props.specificZapId)
      }
    }
    
    
  } catch (err) {
    console.error('Failed to fetch event:', err)
    error.value = `Failed to load event: ${err.message}`
  } finally {
    isLoading.value = false
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
        eventAuthor.value = {
          pubkey,
          name: profile.name || profile.display_name || `user:${pubkey.substring(0, 8)}`,
          picture: profile.picture || generateFallbackAvatar(pubkey),
          nip05: profile.nip05 || null,
          about: profile.about || null
        }
      } catch (err) {
        console.warn('Failed to parse author profile:', err)
        eventAuthor.value = {
          pubkey,
          name: `user:${pubkey.substring(0, 8)}`,
          picture: generateFallbackAvatar(pubkey)
        }
      }
    } else {
      eventAuthor.value = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateFallbackAvatar(pubkey)
      }
    }
  } catch (err) {
    console.warn('Failed to fetch author profile:', err)
    eventAuthor.value = {
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

// Copy to clipboard with feedback
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedItem.value = 'eventId'
    setTimeout(() => {
      copiedItem.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Get zaps for this event
const zapsForEvent = computed(() => {
  return getZapsForContent(props.eventId) || []
})

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return ''
  
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  
  return date.toLocaleDateString()
}

// Get event kind name
const getEventKindName = (kind) => {
  switch (kind) {
    case 0: return 'Profile'
    case 1: return 'Note'
    case 3: return 'Contact List'
    case 4: return 'Direct Message'
    case 5: return 'Deletion'
    case 6: return 'Repost'
    case 7: return 'Reaction'
    case 9735: return 'Zap Receipt'
    case 30023: return 'Long-form Content'
    default: return `Kind ${kind}`
  }
}

// Get event kind icon
const getEventKindIcon = (kind) => {
  switch (kind) {
    case 0: return IconUser
    case 1: return IconFileText
    case 3: return IconUser
    case 4: return IconMessageCircle
    case 5: return IconX
    case 6: return IconRepeat
    case 7: return IconHeart
    case 9735: return IconBolt
    case 30023: return IconFileText
    default: return IconFileText
  }
}

// Get event content
const getEventContent = () => {
  if (!event.value) return ''
  
  // For long-form content, check for title tag
  if (event.value.kind === 30023) {
    const title = event.value.tags.find(tag => tag[0] === 'title')?.[1]
    const summary = event.value.tags.find(tag => tag[0] === 'summary')?.[1]
    
    if (title) {
      return `<h2 class="text-xl font-bold mb-2">${title}</h2>` + 
             (summary ? `<p class="text-gray-600 mb-4">${summary}</p>` : '') +
             formatContent(event.value.content)
    }
  }
  
  return formatContent(event.value.content)
}

// Format content with basic markdown-like processing
const formatContent = (content) => {
  if (!content) return ''
  
  // Escape HTML
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Convert line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>')
  
  // Convert URLs to links
  const urlRegex = /(https?:\/\/[^\s]+)/g
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-600 hover:underline">$1</a>')
  
  // Convert #hashtags
  const hashtagRegex = /#(\w+)/g
  formatted = formatted.replace(hashtagRegex, '<span class="text-orange-600">#$1</span>')
  
  // Convert @mentions (simplified)
  const mentionRegex = /@(\w+)/g
  formatted = formatted.replace(mentionRegex, '<span class="text-blue-600">@$1</span>')
  
  return formatted
}

// Get event tags
const getEventTags = () => {
  if (!event.value) return []
  
  return event.value.tags.filter(tag => {
    // Filter out some internal tags
    const excludedTags = ['d', 'published_at']
    return !excludedTags.includes(tag[0])
  })
}

// Close modal
const closeModal = () => {
  emit('close')
}

// Get media attachments
const getMediaAttachments = () => {
  if (!event.value) return []
  
  const attachments = []
  
  // Check for image tag
  const imageTag = event.value.tags.find(tag => tag[0] === 'image')
  if (imageTag && imageTag[1]) {
    attachments.push({
      type: 'image',
      url: imageTag[1],
      icon: IconPhoto
    })
  }
  
  // Check for media tags
  event.value.tags.forEach(tag => {
    if (tag[0] === 'media' && tag[1]) {
      let type = 'file'
      let icon = IconLink
      
      // Try to determine media type
      if (tag[1].match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        type = 'image'
        icon = IconPhoto
      } else if (tag[1].match(/\.(mp4|webm|mov)$/i)) {
        type = 'video'
        icon = IconVideo
      } else if (tag[1].match(/\.(mp3|wav|ogg)$/i)) {
        type = 'audio'
        icon = IconMicrophone
      }
      
      attachments.push({
        type,
        url: tag[1],
        icon
      })
    }
  })
  
  return attachments
}

// Get event hashtags
const getEventHashtags = () => {
  if (!event.value) return []
  
  const hashtags = []
  
  // Check for t tags (NIP-12 hashtags)
  event.value.tags.forEach(tag => {
    if (tag[0] === 't' && tag[1]) {
      hashtags.push(tag[1])
    }
  })
  
  // Also extract hashtags from content
  const content = event.value?.content || ''
  const hashtagRegex = /#(\w+)/g
  let match
  
  while ((match = hashtagRegex.exec(content)) !== null) {
    if (!hashtags.includes(match[1])) {
      hashtags.push(match[1])
    }
  }
  
  return hashtags
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

// Get sender name with fallback
const getSenderName = (sender) => {
  // Check for display_name first (Nostr standard)
  if (sender?.display_name) {
    return sender.display_name
  }
  
  // Then check for name
  if (sender?.name) {
    return sender.name
  }
  
  // Fallback to pubkey
  const pubkey = sender?.pubkey || sender?.zapperPubkey
  if (pubkey) {
    return `user:${pubkey.substring(0, 8)}`
  }
  
  return 'Anonymous'
}

// Get zap amount for this event
const zapAmount = computed(() => {
  return getTotalZapAmount(props.eventId) || 0
})
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop with blur effect -->
    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-2 sm:p-4">
      <div class="relative bg-white rounded-xl shadow-xl max-w-md sm:max-w-lg md:max-w-xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-3 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <div class="flex items-center space-x-2 relative">
            <component :is="getEventKindIcon(event?.kind)" class="w-5 h-5 text-orange-600" />
            <h3 class="text-lg font-semibold text-gray-900">{{ getEventKindName(event?.kind) }}</h3>
            
            <!-- Open in Nostr Client (moved from separate section) -->
            <div v-if="isAuthenticated && event" class="relative ml-2" ref="dropdownRef">
              <button
                @click="toggleClientDropdown"
                class="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center space-x-1 bg-orange-50 px-2 py-0.5 rounded-lg hover:bg-orange-100 transition-colors"
              >
                <span>Open in client</span>
                <IconChevronDown :class="['w-3 h-3 transition-transform', showClientDropdown ? 'rotate-180' : '']" />
              </button>
              
              <!-- Client Dropdown -->
              <div 
                v-if="showClientDropdown"
                class="absolute left-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
              >
                <a :href="getNostrClientUrl('primal')" target="_blank" rel="noopener noreferrer" 
                   class="block px-2 py-0.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center space-x-1">
                  <span class="w-3 h-3 flex items-center justify-center text-orange-600">🌐</span>
                  <span>Primal.net</span>
                </a>
                <a :href="getNostrClientUrl('yakihonne')" target="_blank" rel="noopener noreferrer"
                   class="block px-2 py-0.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center space-x-1">
                  <span class="w-3 h-3 flex items-center justify-center text-purple-600">🍜</span>
                  <span>Yakihonne</span>
                </a>
              </div>
            </div>
          </div>
          <button
            @click="closeModal"
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="p-4 text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p class="text-gray-600">Loading event...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-4">
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex items-start space-x-3">
              <IconAlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-medium text-red-800 mb-1">Error Loading Event</h4>
                <p class="text-sm text-red-700">{{ error }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Event Content -->
        <div v-else-if="event" class="overflow-y-auto max-h-[calc(90vh-120px)]">
          <!-- Zapper Info -->
          <!-- Single Zapper Info (Specific Zap) -->
          <div v-if="specificZap" class="p-4 border-b border-gray-100 bg-white">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-4">
                <img 
                  :src="specificZap.sender?.picture || specificZap.sender?.avatar" 
                  :alt="getSenderName(specificZap.sender)"
                  class="w-12 h-12 rounded-full border-2 border-orange-200 object-cover"
                  @error="$event.target.src = generateFallbackAvatar(specificZap.zapperPubkey)"
                />
                <div>
                  <div class="font-medium text-gray-900 text-lg">{{ getSenderName(specificZap.sender) }}</div>
                <!--  <div class="text-sm text-gray-500">{{ formatDate(specificZap.timestamp) }}</div> -->
                </div>
              </div>
              <div class="bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-2 rounded-lg">
                <div class="font-bold text-orange-600 text-lg">{{ formatZapAmount(specificZap.amount) }} sats</div>
              </div>
            </div>
          </div>
          
          <!-- Main Content -->
          <div class="p-3">
            <!-- Content -->
            <div class="mb-2 prose prose-sm max-w-none bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
              <div v-html="getEventContent()"></div>
            </div>
            
            <!-- Media Attachments -->
            <div v-if="getMediaAttachments().length > 0" class="mb-2 space-y-2">
              <div v-for="(attachment, index) in getMediaAttachments()" :key="index" class="rounded-lg overflow-hidden border border-gray-200">
                <img 
                  v-if="attachment.type === 'image'" 
                  :src="attachment.url" 
                  alt="Attachment" 
                  class="w-full h-auto max-h-96 object-contain bg-gray-100"
                  @error="$event.target.style.display = 'none'"
                />
                <video 
                  v-else-if="attachment.type === 'video'"
                  :src="attachment.url"
                  controls
                  class="w-full max-h-96"
                  @error="$event.target.style.display = 'none'"
                ></video>
                <audio
                  v-else-if="attachment.type === 'audio'"
                  :src="attachment.url"
                  controls
                  class="w-full"
                  @error="$event.target.style.display = 'none'"
                ></audio>
                <div v-else class="bg-gray-100 p-3 rounded-lg">
                  <a 
                    :href="attachment.url" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="flex items-center space-x-2 text-blue-600 hover:underline"
                  >
                    <component :is="attachment.icon" class="w-4 h-4" />
                    <span>View attachment</span>
                    <IconExternalLink class="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
            
            <!-- Hashtags -->
            <div v-if="getEventHashtags().length > 0" class="mb-2">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in getEventHashtags()"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                </span>
              </div>
            </div>
          </div>
          
          <!-- Event Tags (Debug/Advanced Info) -->
          <div class="p-3 border-t border-gray-100 bg-gray-50">
            <details class="text-sm">
              <summary class="font-medium text-gray-700 cursor-pointer flex items-center space-x-1">
                <span>Event Details</span>
                <IconChevronDown class="w-3 h-3 transition-transform ui-open:rotate-180" />
              </summary>
              <div class="mt-2 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Event ID:</span>
                  <div class="flex items-center space-x-2">
                    <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs cursor-pointer hover:bg-gray-300 transition-colors" @click="copyToClipboard(event.id)" title="Click to copy">
                      {{ event.id.substring(0, 16) }}...
                    </code>
                    <span v-if="copiedItem === 'eventId'" class="text-xs text-green-600 flex items-center">
                      <IconCheck class="w-3 h-3 mr-1" />Copied!
                    </span>
                  </div>
                </div>
                <div v-for="(tag, index) in getEventTags()" :key="index" class="bg-gray-100 p-2 rounded">
                  <p class="font-mono text-xs break-all">{{ tag[0] }}: {{ tag[1] }}</p>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure modal appears above other content */
.z-50 {
  z-index: 50;
}

/* Smooth transitions */
.transition-opacity {
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Ensure proper text wrapping */
.break-all {
  word-break: break-all;
}

/* Prose styling for content */
:deep(.prose) {
  max-width: none;
}

:deep(.prose a) {
  color: #2563eb;
  text-decoration: none;
}

:deep(.prose a:hover) {
  text-decoration: underline;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .max-w-2xl {
    max-width: 100%;
  }
}

/* Dropdown styling */
.z-10 {
  z-index: 10;
}

/* Transition for dropdown */
.transition-transform {
  transition: transform 0.2s ease;
}

/* Rotate animation for details summary */
.ui-open\:rotate-180[open] > summary > .transition-transform {
  transform: rotate(180deg);
}
</style>