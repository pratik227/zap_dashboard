<script setup>
import { ref, onMounted, watch, onUnmounted, computed, inject } from 'vue'
import { neventEncode, naddrEncode } from 'nostr-tools/nip19'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { formatSatsShort } from '../../utils/format.js'
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
  IconDownload,
  IconArrowUpRight,
  IconDots
} from '@iconify-prerendered/vue-tabler'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useContentZaps } from '../../composables/content/useContentZaps.js'

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
const showShareMenu = ref(false)
const showMoreMenu = ref(false)
const shareMenuRef = ref(null)
const moreMenuRef = ref(null)
const copiedItem = ref(null)
const activeTab = ref('content') // 'content', 'zaps'
const jsonViewMode = ref('formatted') // 'formatted', 'raw'
const showJsonModal = ref(false)

// Use Nostr auth to get user profile
const { isAuthenticated, currentUser } = useNostrAuth()
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
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// Handle escape key
const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    if (showJsonModal.value) {
      showJsonModal.value = false
    } else if (props.show) {
      closeModal()
    }
  }
}

// Close menus when clicking outside
const handleClickOutside = (event) => {
  if (shareMenuRef.value && !shareMenuRef.value.contains(event.target)) {
    showShareMenu.value = false
  }
  if (moreMenuRef.value && !moreMenuRef.value.contains(event.target)) {
    showMoreMenu.value = false
  }
}

const toggleShareMenu = (e) => {
  e.stopPropagation()
  showShareMenu.value = !showShareMenu.value
  showMoreMenu.value = false
}

const toggleMoreMenu = (e) => {
  e.stopPropagation()
  showMoreMenu.value = !showMoreMenu.value
  showShareMenu.value = false
}

// Get URL for different Nostr clients with correct encoding
const getNostrClientUrl = (client) => {
  if (!event.value) return '#'

  try {
    const eventKind = event.value.kind
    const eventId = event.value.id

    switch (client) {
      case 'primal':
        return `https://primal.net/e/${eventId}`
      case 'yakihonne':
        // For long-form articles (kind 30023), use naddr
        if (eventKind === 30023) {
          const dTag = event.value.tags.find(tag => tag[0] === 'd')?.[1] || eventId
          const naddrData = {
            identifier: dTag,
            pubkey: event.value.pubkey,
            kind: 30023,
            relays: []
          }
          return `https://yakihonne.com/article/${naddrEncode(naddrData)}`
        }
        // For notes (kind 1) and other events, use nevent
        else {
          return `https://yakihonne.com/note/${neventEncode({ id: eventId })}`
        }
      default:
        return `https://primal.net/e/${eventId}`
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
    case 30023: return 'Article'
    default: return `Kind ${kind}`
  }
}

// Get event kind icon
const getEventKindIcon = (kind) => {
  switch (kind) {
    case 0: return IconUser
    case 1: return IconMessageCircle
    case 3: return IconUser
    case 4: return IconMessageCircle
    case 5: return IconX
    case 6: return IconRepeat
    case 7: return IconHeart
    case 9041: return IconBolt
    case 9735: return IconBolt
    case 30023: return IconFileText
    default: return IconFileText
  }
}

// Escape HTML entities to prevent XSS
const escapeHtml = (str) => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Get event content
const getEventContent = () => {
  if (!event.value) return ''

  if (event.value.kind === 30023) {
    const title = event.value.tags.find(tag => tag[0] === 'title')?.[1]
    const summary = event.value.tags.find(tag => tag[0] === 'summary')?.[1]

    if (title) {
      return `<h2 class="text-2xl font-semibold mb-3 text-gray-900">${escapeHtml(title)}</h2>` +
             (summary ? `<p class="text-gray-600 mb-6 text-base leading-relaxed">${escapeHtml(summary)}</p>` : '') +
             formatContent(event.value.content)
    }
  }

  return formatContent(event.value.content)
}

// Format content with basic markdown-like processing
const formatContent = (content) => {
  if (!content) return ''

  let formatted = escapeHtml(content)

  formatted = formatted.replace(/\n/g, '<br>')

  const urlRegex = /(https?:\/\/[^\s]+)/g
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" class="text-orange-600 hover:text-orange-700 underline font-medium transition-colors">$1</a>')

  const hashtagRegex = /#(\w+)/g
  formatted = formatted.replace(hashtagRegex, '<span class="text-orange-600 font-medium">#$1</span>')

  const mentionRegex = /@(\w+)/g
  formatted = formatted.replace(mentionRegex, '<span class="text-orange-600 font-medium">@$1</span>')

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
  showShareMenu.value = false
  showMoreMenu.value = false
  showJsonModal.value = false
  emit('close')
}

// Handle backdrop click
const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    closeModal()
  }
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
      <div v-if="show" class="fixed inset-0 z-[9999]" @click="handleBackdropClick">
        <!-- Elegant Backdrop -->
        <div class="modal-backdrop absolute inset-0 bg-black/40 backdrop-blur-xl transition-all duration-300"></div>

        <!-- Modal Container - Bottom Sheet on Mobile, Center on Desktop -->
        <div class="modal-panel absolute sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[92vw] sm:max-w-4xl bottom-0 sm:bottom-auto left-0 right-0 sm:right-auto bg-white sm:rounded-[28px] rounded-t-[28px] shadow-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden">

          <!-- Drag Handle (Mobile Only) -->
          <div class="flex sm:hidden justify-center pt-2 pb-1 bg-gray-50/50">
            <div class="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>

          <!-- Clean Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <component :is="getEventKindIcon(event?.kind)" class="w-5 h-5 text-white" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-base font-semibold text-gray-900 truncate">{{ getEventKindName(event?.kind) }}</h3>
                <p class="text-xs text-gray-500">{{ formatDate(event?.created_at) }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Share Button -->
              <div v-if="event" class="relative" ref="shareMenuRef">
                <button
                  @click="toggleShareMenu"
                  class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <IconShare class="w-4 h-4 text-gray-700" />
                </button>

                <!-- Share Dropdown -->
                <transition name="menu-fade">
                  <div
                    v-if="showShareMenu"
                    class="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[99999] overflow-hidden"
                  >
                    <a
                      :href="getNostrClientUrl('primal')"
                      target="_blank"
                      rel="noopener noreferrer"
                      @click="showShareMenu = false"
                      class="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <div class="flex items-center gap-3">
                        <span class="text-lg">🌐</span>
                        <span class="font-medium">View on Primal</span>
                      </div>
                      <IconArrowUpRight class="w-4 h-4 text-gray-400" />
                    </a>
                    <a
                      :href="getNostrClientUrl('yakihonne')"
                      target="_blank"
                      rel="noopener noreferrer"
                      @click="showShareMenu = false"
                      class="flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <div class="flex items-center gap-3">
                        <span class="text-lg">🍜</span>
                        <span class="font-medium">View on Yakihonne</span>
                      </div>
                      <IconArrowUpRight class="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </transition>
              </div>

              <!-- More Menu -->
              <div v-if="event" class="relative" ref="moreMenuRef">
                <button
                  @click="toggleMoreMenu"
                  class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <IconDots class="w-4 h-4 text-gray-700" />
                </button>

                <!-- More Dropdown -->
                <transition name="menu-fade">
                  <div
                    v-if="showMoreMenu"
                    class="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[99999] overflow-hidden"
                  >
                    <button
                      @click="showJsonModal = true; showMoreMenu = false"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IconCode class="w-4 h-4 text-gray-500" />
                      <span class="font-medium">View Details</span>
                    </button>
                    <button
                      @click="copyToClipboard(event.id, 'eventId'); showMoreMenu = false"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <IconCopy class="w-4 h-4 text-gray-500" />
                      <span class="font-medium">Copy Event ID</span>
                    </button>
                  </div>
                </transition>
              </div>

              <!-- Close Button -->
              <button
                @click="closeModal"
                class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <IconX class="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoading" class="flex-1 flex items-center justify-center p-12">
            <div class="text-center">
              <div class="relative w-16 h-16 mx-auto mb-4">
                <div class="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                <div class="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin"></div>
              </div>
              <p class="text-sm text-gray-600">Loading event...</p>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="flex-1 flex items-center justify-center p-12">
            <div class="text-center max-w-md">
              <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconAlertCircle class="w-8 h-8 text-red-600" />
              </div>
              <h4 class="text-lg font-semibold text-gray-900 mb-2">Failed to Load Event</h4>
              <p class="text-sm text-red-600">{{ error }}</p>
            </div>
          </div>

          <!-- Event Content -->
          <div v-else-if="event" class="flex flex-col flex-1 min-h-0">
            <!-- Specific Zap Highlight -->
            <div v-if="specificZap" class="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 px-6 py-4">
              <div class="flex items-center gap-3">
                <img
                  :src="specificZap.sender?.picture || specificZap.sender?.avatar"
                  :alt="getSenderName(specificZap.sender)"
                  class="w-12 h-12 rounded-full border-2 border-white object-cover shadow-sm flex-shrink-0"
                  @error="$event.target.src = generateAvatar(specificZap.zapperPubkey)"
                />
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-gray-900 text-sm truncate">{{ getSenderName(specificZap.sender) }}</div>
                  <div class="text-xs text-gray-600">{{ formatZapTime(specificZap.timestamp) }}</div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="font-bold text-orange-600 text-xl">{{ formatSatsShort(specificZap.amount) }}</div>
                  <div class="text-xs text-orange-700">sats</div>
                </div>
              </div>
            </div>

            <!-- Tab Navigation -->
            <div class="border-b border-gray-100 bg-gray-50/50">
              <nav class="flex px-6">
                <button
                  @click="activeTab = 'content'"
                  :class="[
                    'relative py-3 px-4 text-sm font-medium transition-colors',
                    activeTab === 'content'
                      ? 'text-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  ]"
                >
                  Content
                  <div v-if="activeTab === 'content'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600"></div>
                </button>
                <button
                  @click="activeTab = 'zaps'"
                  :class="[
                    'relative py-3 px-4 text-sm font-medium transition-colors flex items-center gap-2',
                    activeTab === 'zaps'
                      ? 'text-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  ]"
                >
                  Zaps
                  <span v-if="zapsForEvent.length > 0" class="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                    {{ zapsForEvent.length }}
                  </span>
                  <div v-if="activeTab === 'zaps'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600"></div>
                </button>
              </nav>
            </div>

            <!-- Tab Content -->
            <div class="flex-1 overflow-y-auto">
              <!-- Content Tab -->
              <div v-if="activeTab === 'content'" class="p-6">
                <!-- Author Info -->
                <div v-if="eventAuthor" class="flex items-start gap-4 mb-6 pb-6 border-b border-gray-100">
                  <img
                    :src="eventAuthor.picture"
                    :alt="eventAuthor.name"
                    class="w-14 h-14 rounded-full border border-gray-200 shadow-sm object-cover flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-semibold text-gray-900 mb-0.5">{{ eventAuthor.name }}</div>
                    <div v-if="eventAuthor.nip05" class="text-sm text-orange-600 mb-2">{{ eventAuthor.nip05 }}</div>
                    <div v-if="eventAuthor.about" class="text-sm text-gray-600 line-clamp-2">{{ eventAuthor.about }}</div>
                  </div>
                </div>

                <!-- Main Content -->
                <div class="prose prose-sm max-w-none text-gray-800 mb-6">
                  <div v-html="getEventContent()"></div>
                </div>

                <!-- Media Attachments -->
                <div v-if="getMediaAttachments().length > 0" class="space-y-4 mb-6">
                  <div v-for="(attachment, index) in getMediaAttachments()" :key="index" class="rounded-2xl overflow-hidden border border-gray-200">
                    <img
                      v-if="attachment.type === 'image'"
                      :src="attachment.url"
                      alt="Attachment"
                      class="w-full h-auto max-h-96 object-cover bg-gray-50"
                      @error="$event.target.style.display = 'none'"
                    />
                    <video
                      v-else-if="attachment.type === 'video'"
                      :src="attachment.url"
                      controls
                      class="w-full max-h-96 bg-gray-900"
                      @error="$event.target.style.display = 'none'"
                    ></video>
                    <audio
                      v-else-if="attachment.type === 'audio'"
                      :src="attachment.url"
                      controls
                      class="w-full"
                      @error="$event.target.style.display = 'none'"
                    ></audio>
                    <div v-else class="bg-gray-50 p-4">
                      <a
                        :href="attachment.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center justify-between text-orange-600 hover:text-orange-700 font-medium text-sm"
                      >
                        <div class="flex items-center gap-2">
                          <component :is="attachment.icon" class="w-4 h-4" />
                          <span>View attachment</span>
                        </div>
                        <IconExternalLink class="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <!-- Hashtags -->
                <div v-if="getEventHashtags().length > 0" class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in getEventHashtags()"
                    :key="tag"
                    class="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-xs font-medium border border-orange-100"
                  >
                    <IconHash class="w-3 h-3" />
                    <span>{{ tag }}</span>
                  </span>
                </div>
              </div>

              <!-- Zaps Tab -->
              <div v-else-if="activeTab === 'zaps'" class="p-6">
                <div v-if="zapsForEvent.length === 0" class="text-center py-12">
                  <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconBolt class="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 class="text-base font-semibold text-gray-900 mb-2">No Zaps Yet</h4>
                  <p class="text-sm text-gray-500">Be the first to zap this content!</p>
                </div>

                <div v-else class="space-y-4">
                  <!-- Zaps Summary -->
                  <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-3xl font-bold text-orange-600">{{ zapAmount.toLocaleString() }}</div>
                        <div class="text-sm text-orange-700 mt-0.5">Total sats</div>
                      </div>
                      <div class="text-right">
                        <div class="text-2xl font-bold text-gray-900">{{ zapsForEvent.length }}</div>
                        <div class="text-sm text-gray-600 mt-0.5">Zaps</div>
                      </div>
                    </div>
                  </div>

                  <!-- Zaps List -->
                  <div class="space-y-3">
                    <div
                      v-for="zap in zapsForEvent"
                      :key="zap.id"
                      class="bg-white border border-gray-100 rounded-2xl p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-all"
                    >
                      <div class="flex items-center gap-3">
                        <img
                          :src="zap.sender?.avatar || zap.sender?.picture"
                          :alt="zap.sender?.name || 'User'"
                          class="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
                          @error="$event.target.src = generateAvatar(zap.zapperPubkey)"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between mb-1">
                            <div class="font-semibold text-gray-900 truncate text-sm">
                              {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                            </div>
                            <div class="text-xs text-gray-500 flex-shrink-0 ml-2">{{ formatZapTime(zap.timestamp) }}</div>
                          </div>
                          <div v-if="zap.message" class="text-sm text-gray-700 bg-gray-50 rounded-lg p-2 mt-2">{{ zap.message }}</div>
                        </div>
                        <div class="text-right flex-shrink-0">
                          <div class="font-bold text-orange-600 text-lg">{{ formatSatsShort(zap.amount) }}</div>
                          <div class="text-xs text-orange-700">sats</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- JSON Details Modal -->
        <transition name="modal-fade">
          <div v-if="showJsonModal" class="fixed inset-0 z-[99999] flex items-center justify-center p-4" @click.self="showJsonModal = false">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
              <!-- JSON Modal Header -->
              <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <IconCode class="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 class="text-base font-semibold text-gray-900">Event Details</h4>
                    <p class="text-xs text-gray-500">JSON data for developers</p>
                  </div>
                </div>

                <!-- View Mode Toggle -->
                <div class="flex items-center gap-2">
                  <div class="flex items-center bg-gray-100 rounded-xl p-1">
                    <button
                      @click="jsonViewMode = 'formatted'"
                      :class="[
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        jsonViewMode === 'formatted'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      ]"
                    >
                      Formatted
                    </button>
                    <button
                      @click="jsonViewMode = 'raw'"
                      :class="[
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                        jsonViewMode === 'raw'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      ]"
                    >
                      Raw
                    </button>
                  </div>

                  <button
                    @click="showJsonModal = false"
                    class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <IconX class="w-4 h-4 text-gray-700" />
                  </button>
                </div>
              </div>

              <!-- JSON Actions -->
              <div class="flex gap-2 px-6 py-3 bg-gray-50 border-b border-gray-100">
                <button
                  @click="copyEventJson"
                  class="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <IconCheck v-if="copiedItem === 'json'" class="w-4 h-4" />
                  <IconCopy v-else class="w-4 h-4" />
                  <span>{{ copiedItem === 'json' ? 'Copied!' : 'Copy' }}</span>
                </button>

                <button
                  @click="downloadEventJson"
                  class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <IconDownload class="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>

              <!-- JSON Content -->
              <div class="flex-1 overflow-y-auto p-6">
                <div class="bg-gray-900 rounded-2xl p-4 overflow-hidden">
                  <pre class="text-xs text-green-400 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words"><code>{{ formatEventJson }}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Smooth fade transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from .modal-backdrop,
.modal-fade-leave-to .modal-backdrop {
  opacity: 0;
}

/* Mobile: Slide up from bottom */
.modal-fade-enter-from .modal-panel,
.modal-fade-leave-to .modal-panel {
  transform: translateY(100%);
}

/* Desktop: Fade and slight scale */
@media (min-width: 640px) {
  .modal-fade-enter-from .modal-panel,
  .modal-fade-leave-to .modal-panel {
    transform: translate(-50%, -50%) scale(0.96);
    opacity: 0;
  }
}

/* Menu transitions */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

/* Custom Scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(209, 213, 219, 0.5);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}

/* Prose Styling */
:deep(.prose) {
  max-width: none;
  color: #374151;
  line-height: 1.7;
}

:deep(.prose a) {
  color: #ea580c;
  text-decoration: underline;
  font-weight: 500;
}

:deep(.prose h1) {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 1rem;
  line-height: 1.3;
}

:deep(.prose h2) {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

:deep(.prose p) {
  margin-bottom: 1rem;
  line-height: 1.7;
}

/* Line clamp */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Code styling */
pre code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.8125rem;
  line-height: 1.6;
}

.break-words {
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
}
</style>
