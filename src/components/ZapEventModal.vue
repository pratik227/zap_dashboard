<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
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
  IconChevronDown
} from '@iconify-prerendered/vue-tabler'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  eventId: {
    type: String,
    required: true
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
const showClientDropdown = ref(false)
const dropdownRef = ref(null)
const showClientDropdown = ref(false)
const dropdownRef = ref(null)

// Use Nostr auth to get user profile
const { isAuthenticated } = useNostrAuth()

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
})

// Fetch event from Nostr relays
const fetchEvent = async () => {
  if (!props.eventId) return
  
  isLoading.value = true
  error.value = ''
  event.value = null
  eventAuthor.value = null
  
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

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const toggleClientDropdown = () => {
  showClientDropdown.value = !showClientDropdown.value
}

// Get URL for different Nostr clients
const getNostrClientUrl = (client) => {
  if (!event.value) return '#'
  
  try {
    // Determine if this is a regular note or long-form content
    const isLongForm = event.value.kind === 30023
    
    if (isLongForm) {
      // For long-form content, use naddr encoding
      const identifier = event.value.tags.find(tag => tag[0] === 'd')?.[1] || ''
      const naddr = nip19.naddrEncode({
        kind: 30023,
        pubkey: event.value.pubkey,
        identifier,
        relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']
      })
      
      switch (client) {
        case 'primal':
          return `https://primal.net/a/${naddr}`
        case 'yakihonne':
          return `https://www.yakihonne.com/notes/${naddr}`
        case 'highlighter':
          return `https://highlighter.com/a/${naddr}`
        default:
          return `https://primal.net/a/${naddr}`
      }
    } else {
      // For regular notes, use nevent encoding
      const nevent = nip19.neventEncode({
        id: event.value.id,
        relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.snort.social']
      })
      
      switch (client) {
        case 'primal':
          return `https://primal.net/e/${nevent}`
        case 'yakihonne':
          return `https://www.yakihonne.com/notes/${nevent}`
        case 'highlighter':
          return `https://highlighter.com/e/${nevent}`
        default:
          return `https://primal.net/e/${nevent}`
      }
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
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

// // Get event engagement stats
// const getEngagementStats = () => {
//   // In a real app, you would fetch actual engagement stats
//   // For now, we'll return mock data
//   return {
//     replies: Math.floor(Math.random() * 20),
//     reposts: Math.floor(Math.random() * 10),
//     likes: Math.floor(Math.random() * 50),
//     zaps: Math.floor(Math.random() * 5) + 1 // At least 1 zap since we're viewing a zapped event
//   }
// }
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity" @click="closeModal"></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <div class="flex items-center space-x-2">
            <component :is="getEventKindIcon(event?.kind)" class="w-5 h-5 text-orange-600" />
            <h3 class="text-lg font-semibold text-gray-900">{{ getEventKindName(event?.kind) }}</h3>
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
        <div v-if="isLoading" class="p-6 text-center">
          <IconLoader class="w-8 h-8 text-orange-600 animate-spin mx-auto mb-4" />
          <p class="text-gray-600">Loading event...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="p-6">
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
          <!-- Author Info -->
          <div class="p-4 border-b border-gray-100">
            <div class="flex items-center space-x-3">
              <img 
                :src="eventAuthor?.picture" 
                :alt="eventAuthor?.name"
                class="w-10 h-10 rounded-full border-2 border-orange-200"
                @error="$event.target.src = generateFallbackAvatar(eventAuthor?.pubkey)"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <h4 class="font-medium text-gray-900 truncate">{{ eventAuthor?.name }}</h4>
                  <span v-if="eventAuthor?.nip05" class="text-xs text-gray-500">{{ eventAuthor?.nip05 }}</span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-500">
                  <span class="flex items-center space-x-1">
                    <IconCalendar class="w-3 h-3" />
                    <span>{{ formatDate(event.created_at) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Main Content -->
          <div class="p-4">
            <!-- Content -->
            <div class="mb-4 prose prose-sm max-w-none">
              <div v-html="getEventContent()"></div>
            </div>
            
            <!-- Media Attachments -->
            <div v-if="getMediaAttachments().length > 0" class="mb-4 space-y-2">
              <div v-for="(attachment, index) in getMediaAttachments()" :key="index" class="rounded-lg overflow-hidden">
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
            <div v-if="getEventHashtags().length > 0" class="mb-4">
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
            
            <!-- Engagement Stats -->
            <!-- <div class="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
              <div class="flex items-center space-x-6 text-sm text-gray-500">
                <div class="flex items-center space-x-1">
                  <IconMessageCircle class="w-4 h-4" />
                  <span>{{ getEngagementStats().replies }}</span>
                </div>
                <div class="flex items-center space-x-1">
                  <IconRepeat class="w-4 h-4" />
                  <span>{{ getEngagementStats().reposts }}</span>
                </div>
                <div class="flex items-center space-x-1">
                  <IconHeart class="w-4 h-4" />
                  <span>{{ getEngagementStats().likes }}</span>
                </div>
                <div class="flex items-center space-x-1 text-orange-600">
                  <IconBolt class="w-4 h-4" />
                  <span>{{ getEngagementStats().zaps }}</span>
                </div>
              </div> -->
              
            <div class="flex items-center justify-end border-t border-gray-100 pt-4 mt-4">
              
              <a 
                v-if="isAuthenticated && event" 
                class="relative"
                ref="dropdownRef"
                ref="dropdownRef"
              >
                <button
                  @click.prevent="toggleClientDropdown"
                  @click.prevent="toggleClientDropdown"
                  class="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center space-x-1"
                >
                  <span>Open in Nostr client</span>
                  <IconChevronDown :class="['w-3 h-3 transition-transform', showClientDropdown ? 'rotate-180' : '']" />
                  <IconChevronDown :class="['w-3 h-3 transition-transform', showClientDropdown ? 'rotate-180' : '']" />
                </button>
                
                <!-- Client Dropdown -->
                <div 
                  v-if="showClientDropdown"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                >
                  <div class="py-1">
                    <a 
                      :href="getNostrClientUrl('primal')"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                    >
                      Primal.net
                    </a>
                    <a 
                      :href="getNostrClientUrl('yakihonne')"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                    >
                      Yakihonne
                    </a>
                    <a 
                      :href="getNostrClientUrl('highlighter')"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                    >
                      Highlighter
                    </a>
                  </div>
                </div>
                
                <!-- Client Dropdown -->
                <div 
                  v-if="showClientDropdown"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                >
                  <div class="py-1">
                    <a 
                      :href="getNostrClientUrl('primal')"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                    >
                      Primal.net
                    </a>
                    <a 
                      :href="getNostrClientUrl('yakihonne')"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                    >
                      Yakihonne
                    </a>
                    <a 
                      :href="getNostrClientUrl('highlighter')"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700"
                    >
                      Highlighter
                    </a>
                  </div>
                </div>
              </a>
            </div>
          </div>
          
          <!-- Event Tags (Debug/Advanced Info) -->
          <div class="p-4 border-t border-gray-100 bg-gray-50">
            <details class="text-sm">
              <summary class="font-medium text-gray-700 cursor-pointer">Event Details</summary>
              <div class="mt-2 space-y-2">
                <div class="bg-gray-100 p-2 rounded">
                  <p class="font-mono text-xs break-all">ID: {{ event.id }}</p>
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

/* Dropdown styling */
.z-10 {
  z-index: 10;
}

/* Dropdown styling */
.z-10 {
  z-index: 10;
}
}
</style>