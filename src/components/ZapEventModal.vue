<script setup>
import { ref, onMounted, watch, onUnmounted, computed, inject } from 'vue'
import * as nip19 from 'nostr-tools/nip19'
import { generateAvatar } from '../utils/avatarGenerator.js'
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
  IconCheck,
  IconCopy,
  IconShare,
  IconBookmark,
  IconEye,
  IconClock,
  IconCode,
  IconBraces,
  IconDownload
} from '@iconify-prerendered/vue-tabler'
import { nostrRelayManager } from '../utils/nostrRelayManager.js'
import { useNostrAuth } from '../composables/useNostrAuth.js' 
import { useContentZaps } from '../composables/useContentZaps.js'

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
const activeTab = ref('content') // 'content', 'zaps', 'details'
const jsonViewMode = ref('formatted') // 'formatted', 'raw'

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
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${event.value.id}`
      case 'yakihonne':
        return `https://yakihonne.com/${nip19.neventEncode({ id: event.value.id })}`
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
    
    const fetchedEvent = await nostrRelayManager.getEvent({
      ids: [props.eventId]
    })
    
    if (!fetchedEvent) {
      throw new Error('Event not found')
    }
    
    event.value = fetchedEvent
    console.log('Event fetched:', fetchedEvent)
    
    await fetchAuthorProfile(fetchedEvent.pubkey)

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
          picture: profile.picture || generateAvatar(pubkey),
          nip05: profile.nip05 || null,
          about: profile.about || null
        }
      } catch (err) {
        console.warn('Failed to parse author profile:', err)
        eventAuthor.value = {
          pubkey,
          name: `user:${pubkey.substring(0, 8)}`,
          picture: generateAvatar(pubkey)
        }
      }
    } else {
      eventAuthor.value = {
        pubkey,
        name: `user:${pubkey.substring(0, 8)}`,
        picture: generateAvatar(pubkey)
      }
    }
  } catch (err) {
    console.warn('Failed to fetch author profile:', err)
    eventAuthor.value = {
      pubkey,
      name: `user:${pubkey.substring(0, 8)}`,
      picture: generateAvatar(pubkey)
    }
  }
}


// Copy to clipboard with feedback
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedItem.value = type
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
    case 9041: return 'Campaign'
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
  
  let formatted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  formatted = formatted.replace(/\n/g, '<br>')
  
  const urlRegex = /(https?:\/\/[^\s]+)/g
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-600 hover:underline">$1</a>')
  
  const hashtagRegex = /#(\w+)/g
  formatted = formatted.replace(hashtagRegex, '<span class="text-orange-600">#$1</span>')
  
  const mentionRegex = /@(\w+)/g
  formatted = formatted.replace(mentionRegex, '<span class="text-blue-600">@$1</span>')
  
  return formatted
}

// Get event tags
const getEventTags = () => {
  if (!event.value) return []
  
  return event.value.tags.filter(tag => {
    const excludedTags = ['d', 'published_at']
    return !excludedTags.includes(tag[0])
  })
}

// Close modal
const closeModal = () => {
  activeTab.value = 'content'
  emit('close')
}

// Get media attachments
const getMediaAttachments = () => {
  if (!event.value) return []
  
  const attachments = []
  
  const imageTag = event.value.tags.find(tag => tag[0] === 'image')
  if (imageTag && imageTag[1]) {
    attachments.push({
      type: 'image',
      url: imageTag[1],
      icon: IconPhoto
    })
  }
  
  event.value.tags.forEach(tag => {
    if (tag[0] === 'media' && tag[1]) {
      let type = 'file'
      let icon = IconLink
      
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
  
  event.value.tags.forEach(tag => {
    if (tag[0] === 't' && tag[1]) {
      hashtags.push(tag[1])
    }
  })
  
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
  if (sender?.display_name) {
    return sender.display_name
  }
  
  if (sender?.name) {
    return sender.name
  }
  
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

// Format time for zaps
const formatZapTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Tab configuration
const tabs = [
  { id: 'content', label: 'Content', icon: IconFileText },
  { id: 'zaps', label: 'Zaps', icon: IconBolt, count: computed(() => zapsForEvent.value.length) },
  { id: 'details', label: 'Details', icon: IconCode }
]

// Enhanced JSON formatting for developer view
const formatEventJson = computed(() => {
  if (!event.value) return ''
  
  if (jsonViewMode.value === 'raw') {
    return JSON.stringify(event.value, null, 2)
  }
  
  // Formatted view with better organization
  const formattedEvent = {
    // Core event data
    id: event.value.id,
    pubkey: event.value.pubkey,
    created_at: event.value.created_at,
    kind: event.value.kind,
    
    // Human-readable timestamp
    created_at_human: new Date(event.value.created_at * 1000).toISOString(),
    
    // Content
    content: event.value.content,
    
    // Tags organized by type
    tags: {
      raw: event.value.tags,
      organized: organizeTagsByType(event.value.tags)
    },
    
    // Signature
    sig: event.value.sig
  }
  
  return JSON.stringify(formattedEvent, null, 2)
})

// Organize tags by type for better readability
const organizeTagsByType = (tags) => {
  const organized = {}
  
  tags.forEach(tag => {
    const tagType = tag[0]
    if (!organized[tagType]) {
      organized[tagType] = []
    }
    organized[tagType].push(tag.slice(1))
  })
  
  return organized
}

// Copy entire JSON
const copyEventJson = async () => {
  await copyToClipboard(formatEventJson.value, 'json')
}

// Download JSON as file
const downloadEventJson = () => {
  try {
    const blob = new Blob([formatEventJson.value], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nostr-event-${event.value.id.substring(0, 8)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download JSON:', error)
  }
}

// Format zapper pubkey for display
const formatZapperPubkey = (pubkey) => {
  if (!pubkey) return 'Anonymous'
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-fade">
      <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
        <!-- Apple-like Backdrop -->
        <div class="fixed inset-0 bg-black/20 backdrop-blur-md transition-opacity" @click="closeModal"></div>
        
        <!-- Modal Container -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div class="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/10 max-w-4xl w-full max-h-[90vh] overflow-hidden border border-gray-200/50">
            <!-- ZapTracker Brand Accent Line -->
            <div class="h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400"></div>
            
            <!-- Clean Header -->
            <div class="bg-white/80 backdrop-blur-sm px-8 py-6 border-b border-gray-100/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200/50">
                    <component :is="getEventKindIcon(event?.kind)" class="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 class="text-2xl font-bold text-gray-900">{{ getEventKindName(event?.kind) }}</h3>
                    <p class="text-sm text-gray-500 font-medium">{{ formatDate(event?.created_at) }}</p>
                  </div>
                </div>
                
                <div class="flex items-center space-x-3">
                  <!-- Share Button -->
                  <div v-if="event" class="relative" ref="dropdownRef">
                    <button
                      @click="toggleClientDropdown"
                      class="w-10 h-10 bg-gray-100/80 hover:bg-gray-200/80 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm relative z-50"
                    >
                      <IconShare class="w-5 h-5 text-gray-600" />
                    </button>
                    
                    <!-- Clean Dropdown -->
                    <transition name="dropdown-fade">
                      <div 
                        v-if="showClientDropdown"
                        class="absolute right-0 mt-2 w-44 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/20 border border-gray-200/50 py-2 z-[99999]"
                      >
                        <a 
                          :href="getNostrClientUrl('primal')" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-orange-50/80 hover:text-orange-700 transition-all duration-200 rounded-xl mx-2"
                        >
                          <span class="text-orange-600 text-lg">🌐</span>
                          <span class="font-medium">Primal</span>
                        </a>
                        <a 
                          :href="getNostrClientUrl('yakihonne')" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          class="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-purple-50/80 hover:text-purple-700 transition-all duration-200 rounded-xl mx-2"
                        >
                          <span class="text-purple-600 text-lg">🍜</span>
                          <span class="font-medium">Yakihonne</span>
                        </a>
                      </div>
                    </transition>
                  </div>

                  <!-- Close Button -->
                  <button
                    @click="closeModal"
                    class="w-10 h-10 bg-gray-100/80 hover:bg-gray-200/80 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-sm"
                  >
                    <IconX class="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="isLoading" class="p-12 text-center">
              <div class="w-16 h-16 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-6"></div>
              <p class="text-gray-600 font-medium">Loading event...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-12">
              <div class="text-center">
                <div class="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <IconAlertCircle class="w-8 h-8 text-red-600" />
                </div>
                <h4 class="text-xl font-semibold text-gray-900 mb-3">Error Loading Event</h4>
                <p class="text-sm text-red-600">{{ error }}</p>
              </div>
            </div>

            <!-- Event Content -->
            <div v-else-if="event" class="flex flex-col max-h-[calc(90vh-140px)]">
              <!-- Specific Zap Info (if viewing specific zap) -->
              <div v-if="specificZap" class="bg-gradient-to-r from-orange-50/80 to-amber-50/80 backdrop-blur-sm border-b border-orange-100/50 p-6">
                <div class="flex items-center space-x-4">
                  <img 
                    :src="specificZap.sender?.picture || specificZap.sender?.avatar" 
                    :alt="getSenderName(specificZap.sender)"
                    class="w-14 h-14 rounded-2xl border-2 border-orange-200/50 object-cover shadow-lg"
                    @error="$event.target.src = generateAvatar(specificZap.zapperPubkey)"
                  />
                  <div class="flex-1">
                    <div class="font-semibold text-gray-900 text-lg">{{ getSenderName(specificZap.sender) }}</div>
                    <div class="text-sm text-gray-600">{{ formatZapTime(specificZap.timestamp) }}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold text-orange-600 text-2xl">{{ formatZapAmount(specificZap.amount) }}</div>
                    <div class="text-sm text-orange-700">sats</div>
                  </div>
                </div>
              </div>

              <!-- Clean Tab Navigation -->
              <div class="bg-white/80 backdrop-blur-sm border-b border-gray-100/50">
                <nav class="flex px-8">
                  <button
                    v-for="tab in tabs"
                    :key="tab.id"
                    @click="activeTab = tab.id"
                    :class="[
                      'flex items-center space-x-2 py-4 px-6 font-semibold text-sm border-b-2 transition-all duration-200',
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                    ]"
                  >
                    <component :is="tab.icon" class="w-4 h-4" />
                    <span>{{ tab.label }}</span>
                    <span v-if="tab.count?.value > 0" class="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs font-bold">
                      {{ tab.count.value }}
                    </span>
                  </button>
                </nav>
              </div>

              <!-- Tab Content -->
              <div class="flex-1 overflow-y-auto bg-white/50 backdrop-blur-sm">
                <!-- Content Tab -->
                <div v-if="activeTab === 'content'" class="p-8">
                  <!-- Author Info -->
                  <div v-if="eventAuthor" class="flex items-center space-x-4 mb-8 pb-6 border-b border-gray-100">
                    <img 
                      :src="eventAuthor.picture" 
                      :alt="eventAuthor.name"
                      class="w-16 h-16 rounded-2xl border-2 border-gray-200/50 shadow-lg"
                    />
                    <div>
                      <div class="font-semibold text-gray-900 text-lg">{{ eventAuthor.name }}</div>
                      <div v-if="eventAuthor.nip05" class="text-sm text-gray-500">{{ eventAuthor.nip05 }}</div>
                      <div v-if="eventAuthor.about" class="text-sm text-gray-600 mt-2 max-w-md">{{ eventAuthor.about }}</div>
                    </div>
                  </div>

                  <!-- Main Content -->
                  <div class="prose prose-lg max-w-none text-gray-800">
                    <div v-html="getEventContent()"></div>
                  </div>
                  
                  <!-- Media Attachments -->
                  <div v-if="getMediaAttachments().length > 0" class="mt-8 space-y-4">
                    <h4 class="font-semibold text-gray-900 text-lg">Attachments</h4>
                    <div class="grid grid-cols-1 gap-4">
                      <div v-for="(attachment, index) in getMediaAttachments()" :key="index" class="rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
                        <img 
                          v-if="attachment.type === 'image'" 
                          :src="attachment.url" 
                          alt="Attachment" 
                          class="w-full h-auto max-h-80 object-contain bg-gray-50"
                          @error="$event.target.style.display = 'none'"
                        />
                        <video 
                          v-else-if="attachment.type === 'video'"
                          :src="attachment.url"
                          controls
                          class="w-full max-h-80"
                          @error="$event.target.style.display = 'none'"
                        ></video>
                        <audio
                          v-else-if="attachment.type === 'audio'"
                          :src="attachment.url"
                          controls
                          class="w-full"
                          @error="$event.target.style.display = 'none'"
                        ></audio>
                        <div v-else class="bg-gray-50/80 p-6 rounded-2xl">
                          <a 
                            :href="attachment.url" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="flex items-center space-x-3 text-blue-600 hover:underline font-medium"
                          >
                            <component :is="attachment.icon" class="w-5 h-5" />
                            <span>View attachment</span>
                            <IconExternalLink class="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Hashtags -->
                  <div v-if="getEventHashtags().length > 0" class="mt-8">
                    <div class="flex flex-wrap gap-3">
                      <span
                        v-for="tag in getEventHashtags()"
                        :key="tag"
                        class="inline-flex items-center space-x-2 bg-orange-100/80 text-orange-700 px-4 py-2 rounded-full text-sm font-medium shadow-sm"
                      >
                        <IconHash class="w-3 h-3" />
                        <span>{{ tag }}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Zaps Tab -->
                <div v-else-if="activeTab === 'zaps'" class="p-8">
                  <div v-if="zapsForEvent.length === 0" class="text-center py-16">
                    <div class="w-20 h-20 bg-gray-100/80 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <IconBolt class="w-10 h-10 text-gray-400" />
                    </div>
                    <h4 class="text-xl font-semibold text-gray-900 mb-3">No zaps yet</h4>
                    <p class="text-gray-500">Be the first to zap this content!</p>
                  </div>

                  <div v-else class="space-y-6">
                    <!-- Zaps Summary -->
                    <div class="bg-gradient-to-r from-orange-50/80 to-amber-50/80 backdrop-blur-sm rounded-2xl p-6 border border-orange-200/30 shadow-lg shadow-orange-100/30">
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-3xl font-bold text-orange-600">{{ zapAmount.toLocaleString() }}</div>
                          <div class="text-sm text-orange-700 font-medium">Total sats received</div>
                        </div>
                        <div class="text-right">
                          <div class="text-2xl font-bold text-gray-900">{{ zapsForEvent.length }}</div>
                          <div class="text-sm text-gray-600 font-medium">Zaps</div>
                        </div>
                      </div>
                    </div>

                    <!-- Zaps List -->
                    <div class="space-y-4">
                      <div
                        v-for="zap in zapsForEvent"
                        :key="zap.id"
                        class="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 hover:bg-gray-50/80 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <div class="flex items-center space-x-4">
                          <img
                            :src="zap.sender?.avatar || zap.sender?.picture"
                            :alt="zap.sender?.name || 'User'"
                            class="w-14 h-14 rounded-2xl object-cover border-2 border-gray-200/50 shadow-md"
                            @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                          />
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-2">
                              <div class="font-semibold text-gray-900 truncate text-lg">
                                {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                              </div>
                              <div class="text-sm text-gray-500 font-medium">{{ formatZapTime(zap.timestamp) }}</div>
                            </div>
                            <div v-if="zap.message" class="text-sm text-gray-600 bg-gray-50/80 rounded-xl p-3 mt-2">{{ zap.message }}</div>
                          </div>
                          <div class="text-right flex-shrink-0">
                            <div class="font-bold text-orange-600 text-xl">{{ formatZapAmount(zap.amount) }}</div>
                            <div class="text-sm text-orange-700 font-medium">sats</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Enhanced Details Tab -->
                <div v-else-if="activeTab === 'details'" class="p-8">
                  <!-- Developer Tools Header -->
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                        <IconCode class="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 class="text-xl font-bold text-gray-900">Developer Tools</h4>
                        <p class="text-sm text-gray-600">Inspect and copy event data</p>
                      </div>
                    </div>
                    
                    <!-- View Mode Toggle -->
                    <div class="flex items-center bg-gray-100/80 backdrop-blur-sm rounded-2xl p-1 shadow-sm">
                      <button
                        @click="jsonViewMode = 'formatted'"
                        :class="[
                          'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
                          jsonViewMode === 'formatted' 
                            ? 'bg-white text-blue-600 shadow-md transform scale-105' 
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                        ]"
                      >
                        <IconBraces class="w-4 h-4 inline mr-2" />
                        Formatted
                      </button>
                      <button
                        @click="jsonViewMode = 'raw'"
                        :class="[
                          'px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200',
                          jsonViewMode === 'raw' 
                            ? 'bg-white text-blue-600 shadow-md transform scale-105' 
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                        ]"
                      >
                        <IconCode class="w-4 h-4 inline mr-2" />
                        Raw
                      </button>
                    </div>
                  </div>

                  <!-- Quick Actions -->
                  <div class="flex items-center space-x-3 mb-6">
                    <button
                      @click="copyEventJson"
                      class="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <IconCheck v-if="copiedItem === 'json'" class="w-4 h-4" />
                      <IconCopy v-else class="w-4 h-4" />
                      <span>{{ copiedItem === 'json' ? 'Copied!' : 'Copy JSON' }}</span>
                    </button>
                    
                    <button
                      @click="downloadEventJson"
                      class="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <IconDownload class="w-4 h-4" />
                      <span>Download</span>
                    </button>
                  </div>

                  <!-- Event Metadata Cards -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <!-- Basic Info Card -->
                    <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
                      <h5 class="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <IconFileText class="w-5 h-5 text-orange-600" />
                        <span>Event Info</span>
                      </h5>
                      <div class="space-y-3">
                        <div class="flex justify-between items-center">
                          <span class="text-sm text-gray-600 font-medium">Event ID:</span>
                          <div class="flex items-center space-x-2">
                            <code class="text-xs text-gray-800 bg-gray-100/80 px-3 py-1.5 rounded-lg font-mono">
                              {{ event.id.substring(0, 16) }}...
                            </code>
                            <button
                              @click="copyToClipboard(event.id, 'eventId')"
                              class="w-8 h-8 bg-gray-100/80 hover:bg-gray-200/80 rounded-lg flex items-center justify-center transition-colors"
                            >
                              <IconCheck v-if="copiedItem === 'eventId'" class="w-3 h-3 text-green-600" />
                              <IconCopy v-else class="w-3 h-3 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-sm text-gray-600 font-medium">Kind:</span>
                          <span class="text-sm text-gray-900 font-semibold">{{ event.kind }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-sm text-gray-600 font-medium">Created:</span>
                          <span class="text-sm text-gray-900">{{ new Date(event.created_at * 1000).toLocaleString() }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-sm text-gray-600 font-medium">Author:</span>
                          <code class="text-xs text-gray-800 bg-gray-100/80 px-2 py-1 rounded font-mono">
                            {{ event.pubkey.substring(0, 16) }}...
                          </code>
                        </div>
                      </div>
                    </div>

                    <!-- Tags Summary Card -->
                    <div class="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
                      <h5 class="font-bold text-gray-900 mb-4 flex items-center space-x-2">
                        <IconHash class="w-5 h-5 text-blue-600" />
                        <span>Tags Summary</span>
                      </h5>
                      <div class="space-y-2">
                        <div class="flex justify-between">
                          <span class="text-sm text-gray-600 font-medium">Total Tags:</span>
                          <span class="text-sm text-gray-900 font-semibold">{{ event.tags.length }}</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-sm text-gray-600 font-medium">Content Length:</span>
                          <span class="text-sm text-gray-900 font-semibold">{{ event.content.length }} chars</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-sm text-gray-600 font-medium">Signature:</span>
                          <span class="text-xs text-green-600 font-semibold">✓ Valid</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Enhanced JSON Inspector -->
                  <div class="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg overflow-hidden">
                    <div class="bg-gray-50/80 backdrop-blur-sm px-6 py-4 border-b border-gray-200/50">
                      <div class="flex items-center justify-between">
                        <h5 class="font-bold text-gray-900 flex items-center space-x-2">
                          <IconBraces class="w-5 h-5 text-indigo-600" />
                          <span>Event JSON</span>
                        </h5>
                        <div class="flex items-center space-x-2">
                          <span class="text-xs text-gray-500 bg-gray-200/80 px-3 py-1 rounded-full font-medium">
                            {{ jsonViewMode === 'formatted' ? 'Developer Friendly' : 'Raw Event' }}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div class="p-6">
                      <div class="bg-gray-900 rounded-2xl p-6 overflow-hidden shadow-inner">
                        <pre class="text-sm text-green-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"><code>{{ formatEventJson }}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Apple-like Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.modal-fade-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}

/* Dropdown Transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.dropdown-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

/* Custom Scrollbar (Apple-like) */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Enhanced Prose Styling */
:deep(.prose) {
  max-width: none;
  color: #374151;
  line-height: 1.7;
}

:deep(.prose a) {
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}

:deep(.prose a:hover) {
  text-decoration: underline;
}

:deep(.prose h1) {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 1.5rem;
  line-height: 1.3;
}

:deep(.prose h2) {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1rem;
  line-height: 1.4;
}

:deep(.prose p) {
  margin-bottom: 1.5rem;
  line-height: 1.7;
}

/* Apple-like Button Interactions */
button:not(:disabled) {
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}

/* Focus States (Apple-like) */
button:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Enhanced Shadow Effects */
.shadow-2xl {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.shadow-xl {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .max-w-4xl {
    max-width: 100%;
    margin: 0.5rem;
  }
  
  .p-8 {
    padding: 1.5rem;
  }
  
  .px-8 {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

/* Code Block Styling */
pre code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* JSON Syntax Highlighting */
.text-green-400 {
  color: #4ade80;
}

/* Ensure proper text wrapping */
.break-words {
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
}

/* Apple-like Card Hover Effects */
.hover\:shadow-md:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.hover\:shadow-lg:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Smooth Scale Animations */
.transform {
  transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Enhanced Border Radius */
.rounded-3xl {
  border-radius: 1.5rem;
}

.rounded-2xl {
  border-radius: 1rem;
}
</style>
