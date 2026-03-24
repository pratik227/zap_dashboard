<script setup>
import { computed, inject, ref, watch, onUnmounted } from 'vue'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import { formatSatsShort } from '../utils/format.js'
import {
  IconBolt,
  IconFileText,
  IconMessageCircle,
  IconRepeat,
  IconDeviceMobile,
  IconUser,
  IconWallet,
  IconAlertCircle,
  IconSearch,
  IconFilter,
  IconX,
  IconChevronDown,
  IconTrash,
  IconInfoCircle,
  IconUsers,
  IconHeart,
  IconBulb,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh
} from '@iconify-prerendered/vue-tabler'
import { filterZapsByTimeRange } from '../utils/core/timeFilter.js'
import ZapEventModal from '../components/modals/ZapEventModal.vue'
import { useContentZaps } from '../composables/content/useContentZaps.js'
import Filters from '../components/shared/Filters.vue'
import SkeletonList from '../components/shared/SkeletonList.vue'
import ThreadsPromo from '../components/shared/ThreadsPromo.vue'

const zapData = inject('zapData')
const combinedZapData = inject('combinedZapData')
const searchQuery = inject('searchQuery')
const selectedFilters = inject('selectedFilters')
const selectedTimeRange = inject('selectedTimeRange')
const isWalletConnected = inject('isWalletConnected')
const isAuthenticated = inject('isAuthenticated')
const refreshZapData = inject('refreshZapData', null)

// Refresh state
const isRefreshing = ref(false)
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    if (refreshZapData) await refreshZapData()
  } finally {
    isRefreshing.value = false
  }
}

// Get zap data from useContentZaps
const { getAllContentZaps } = useContentZaps()

// State for event modal
const showEventModal = ref(false)
const selectedEventId = ref(null)
const selectedZapId = ref(null)

// UI state
const showFilters = ref(false)
const viewMode = ref('feed') // 'feed' or 'compact'
const isInitialLoading = ref(true)

// Pagination state
const currentPage = ref(1)
const itemsPerPage = 20

// Threads promo - always show, component handles dismissal internally
const showThreadsPromo = ref(true)

// Simulate initial data load
setTimeout(() => {
  isInitialLoading.value = false
}, 1000)

// Connection status for messaging
const connectionStatus = computed(() => {
  const hasNWC = isWalletConnected.value
  const hasNostr = isAuthenticated.value
  
  if (hasNWC && hasNostr) {
    return {
      type: 'both',
      dataLabel: 'payments and zaps',
      emptyMessage: 'No zaps or payments found yet. Zaps are Lightning micropayments that people send to support your Nostr content. Try publishing a note or article to start receiving them.'
    }
  } else if (hasNostr) {
    return {
      type: 'nostr-only',
      dataLabel: 'Nostr zaps',
      emptyMessage: 'No Nostr zaps found yet. Zaps will appear here when people send Lightning payments to your content. Connect a wallet via Settings to also track outgoing payments.'
    }
  } else if (hasNWC) {
    return {
      type: 'nwc-only',
      dataLabel: 'NWC payments',
      emptyMessage: 'No wallet payments found yet. Payments you send and receive will appear here. Connect your Nostr account to also track zaps on your content.'
    }
  } else {
    return {
      type: 'none',
      dataLabel: 'data',
      emptyMessage: 'Connect your Nostr account or Lightning wallet to start tracking zaps and payments. Zaps are Lightning micropayments used on the Nostr network to support creators.'
    }
  }
})

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
         selectedFilters.value.minAmount > 0 ||
         selectedFilters.value.maxAmount !== null ||
         selectedFilters.value.noteType !== 'all' ||
         selectedFilters.value.sender.trim() !== '' ||
         selectedTimeRange.value !== 'all'
})

// Clear all filters
const clearAllFilters = () => {
  searchQuery.value = ''
  selectedFilters.value.minAmount = 0
  selectedFilters.value.maxAmount = null
  selectedFilters.value.noteType = 'all'
  selectedFilters.value.sender = ''
  selectedTimeRange.value = 'all'
}

const filteredZaps = computed(() => {
  let zaps = combinedZapData.value
  
  // Apply connection-aware filtering
  if (connectionStatus.value.type === 'nostr-only') {
    // Only Nostr connected: show only Nostr zaps
    zaps = zaps.filter(zap => zap.source === 'nip57')
  } else if (connectionStatus.value.type === 'nwc-only') {
    // Only NWC connected: show only NWC payments
    zaps = zaps.filter(zap => zap.source === 'nwc')
  } else if (connectionStatus.value.type === 'none') {
    // No connections: show nothing
    zaps = []
  }
  // For 'both' type, show all data (no additional filtering needed)
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    zaps = zaps.filter(zap => {
      const noteContent = parseNoteContent(zap.note).toLowerCase()
      const senderName = (zap.sender?.name || '').toLowerCase()
      const senderNip05 = (zap.sender?.nip05 || '').toLowerCase()
      
      return noteContent.includes(query) || senderName.includes(query) || senderNip05.includes(query)
    })
  }
  
  // Apply amount filters
  if (selectedFilters.value.minAmount > 0) {
    zaps = zaps.filter(zap => zap.amount >= selectedFilters.value.minAmount)
  }
  if (selectedFilters.value.maxAmount) {
    zaps = zaps.filter(zap => zap.amount <= selectedFilters.value.maxAmount)
  }
  
  // Apply note type filter
  if (selectedFilters.value.noteType !== 'all') {
    zaps = zaps.filter(zap => zap.noteType === selectedFilters.value.noteType)
  }
  
  // Apply time range filter using centralized utility
  zaps = filterZapsByTimeRange(zaps, selectedTimeRange.value)
  
  return zaps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
})

// Pagination computed properties
const totalPages = computed(() => {
  return Math.ceil(filteredZaps.value.length / itemsPerPage)
})

const paginatedZaps = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredZaps.value.slice(start, end)
})

// Reset to page 1 when filters change
watch(filteredZaps, () => {
  currentPage.value = 1
})

// Pagination controls
const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Get visible page numbers for pagination
const visiblePageNumbers = computed(() => {
  const pages = []
  const maxVisible = 7

  if (totalPages.value <= maxVisible) {
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i)
    }
  } else {
    if (currentPage.value <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(totalPages.value)
    } else if (currentPage.value >= totalPages.value - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = totalPages.value - 4; i <= totalPages.value; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = currentPage.value - 1; i <= currentPage.value + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(totalPages.value)
    }
  }

  return pages
})

// Handle click on zap item
const handleZapClick = (zap) => {
  if (zap.eventId) {
    selectedEventId.value = zap.eventId
    selectedZapId.value = zap.id
    showEventModal.value = true
  }
}

// Close event modal
const closeEventModal = () => {
  showEventModal.value = false
  selectedEventId.value = null
  selectedZapId.value = null
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

// Enhanced note content parsing
const parseNoteContent = (note) => {
  if (typeof note === 'string') {
    if (note.startsWith('{') && note.endsWith('}')) {
      try {
        const parsed = JSON.parse(note)
        if (parsed && typeof parsed === 'object') {
          if (parsed.kind === 9734) {
            const amountTag = parsed.tags?.find(tag => tag[0] === 'amount')
            const amount = amountTag ? amountTag[1] : null
            if (amount) {
              return `Zap: ${Math.floor(amount / 1000)} sats`
            }
            return 'Zap payment'
          }
          if (parsed.content) {
            return parsed.content
          }
          if (parsed.description) {
            return parsed.description
          }
          return `${parsed.kind ? `Event (kind ${parsed.kind})` : 'Event'}`
        }
      } catch (error) {
        return note
      }
    }
    else if (note.startsWith('[') && note.endsWith(']')) {
      try {
        const parsed = JSON.parse(note)
        if (Array.isArray(parsed)) {
          return extractTextFromArray(parsed)
        }
      } catch (error) {
        return note
      }
    }
    return note
  }

  if (Array.isArray(note)) {
    return extractTextFromArray(note)
  }

  if (typeof note === 'object' && note !== null) {
    try {
      return JSON.stringify(note.get('content'))
    } catch (error) {
      return 'Unable to display note content'
    }
  }
  
  return String(note || 'No note content')
}

const extractTextFromArray = (noteArray) => {
  try {
    const textPlain = noteArray.find(item => Array.isArray(item) && item[0] === 'text/plain')
    if (textPlain && textPlain[1]) {
      return textPlain[1]
    }
    
    const textIdentifier = noteArray.find(item => Array.isArray(item) && item[0] === 'text/identifier')
    if (textIdentifier && textIdentifier[1]) {
      return textIdentifier[1]
    }
    
    const firstText = noteArray.find(item => Array.isArray(item) && typeof item[1] === 'string')
    if (firstText && firstText[1]) {
      return firstText[1]
    }
    
    return 'Complex note content'
  } catch (error) {
    return 'Unable to parse note content'
  }
}


// Inject profile store from parent
const profileStore = inject('profileStore', ref(new Map()))

// Dynamic avatar generation with profile integration
const getSenderAvatar = (sender, index) => {
  const pubkey = sender?.pubkey || sender?.zapperPubkey

  if (pubkey && profileStore.value.has(pubkey)) {
    const profile = profileStore.value.get(pubkey)
    if (profile?.picture) {
      return profile.picture
    }
  }

  if (sender?.picture) {
    return sender.picture
  }

  if (sender?.avatar) {
    return sender.avatar
  }

  if (pubkey) {
    return generateAvatar(pubkey)
  }

  // Final fallback
  return generateAvatar(`fallback-${index}`)
}

// Get sender name with profile integration
const getSenderName = (sender) => {
  const pubkey = sender?.pubkey || sender?.zapperPubkey
  
  if (pubkey && profileStore.value.has(pubkey)) {
    const profile = profileStore.value.get(pubkey)
    if (profile?.name) {
      return profile.name
    }
  }
  
  if (sender?.display_name) {
    return sender.display_name
  }
  
  if (sender?.name) {
    return sender.name
  }
  
  if (pubkey) {
    return `user:${pubkey.substring(0, 8)}`
  }
  
  return 'Anonymous'
}

// Get transaction type display text
const getTransactionTypeText = (zap) => {
  return zap.type === 'outgoing' ? 'Sent' : 'Received'
}

// Get transaction type color class
const getTransactionTypeColor = (zap) => {
  return zap.type === 'outgoing' ? 'text-red-600' : 'text-green-600'
}

// Get source icon
const getSourceIcon = (zap) => {
  return zap.source === 'nip57' ? IconBolt : IconWallet
}

// Get source color
const getSourceColor = (zap) => {
  return zap.source === 'nip57' ? 'text-orange-600 bg-orange-100' : 'text-blue-600 bg-blue-100'
}

// Get transaction type background color class
const getTransactionTypeBgColor = (zap) => {
  return zap.type === 'outgoing' ? 'from-red-100 to-pink-100' : 'from-orange-100 to-amber-100'
}

// Get note type icon component
const getNoteTypeIcon = (type) => {
  switch (type) {
    case 'original': return IconFileText
    case 'reply': return IconMessageCircle
    case 'repost': return IconRepeat
    default: return IconFileText
  }
}

// Truncate note content for compact display
const truncateNote = (note, maxLength = 120) => {
  const content = parseNoteContent(note)
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + '...'
}



// Helper to check if we should show promo at this index (position 3 when there are 3+ items)
const shouldShowPromoAtIndex = (index) => {
  return index === 2 && showThreadsPromo.value && filteredZaps.value.length >= 3
}

// Show promo at top when few or no items
const showPromoAtTop = computed(() => {
  return showThreadsPromo.value && filteredZaps.value.length < 3
})

onUnmounted(() => {
  // Clean up state to prevent stale UI on remount
  isRefreshing.value = false
  isInitialLoading.value = true
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <!-- Orange Accent Line -->
      <div class="h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400"></div>

      <!-- Header Content -->
      <div class="p-4 sm:p-5">
        <!-- Mobile Layout -->
        <div class="flex flex-col gap-4 md:hidden">
          <!-- Top: Count + Refresh + View Toggle -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 bg-green-500 rounded-full"></span>
              <span class="text-sm font-medium text-gray-600">
                {{ filteredZaps.length }} zap{{ filteredZaps.length !== 1 ? 's' : '' }}
              </span>
              <button
                @click="handleRefresh"
                :disabled="isRefreshing"
                class="inline-flex items-center p-1.5 text-gray-500 hover:text-orange-600 bg-gray-100 hover:bg-orange-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh zap data"
                aria-label="Refresh zap data"
              >
                <IconRefresh :class="['w-4 h-4', isRefreshing ? 'animate-spin' : '']" />
              </button>
            </div>

            <!-- View Toggle -->
            <div class="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                @click="viewMode = 'feed'"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  viewMode === 'feed'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >
                Feed
              </button>
              <button
                @click="viewMode = 'compact'"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  viewMode === 'compact'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >
                Compact
              </button>
            </div>
          </div>

          <!-- Bottom: Time Filter -->
          <div class="flex justify-center">
            <div class="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                v-for="range in [
                  { value: '24h', label: '24h' },
                  { value: '7d', label: '7d' },
                  { value: '30d', label: '30d' },
                  { value: 'all', label: 'All' }
                ]"
                :key="range.value"
                @click="selectedTimeRange = range.value"
                :class="[
                  'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                  selectedTimeRange === range.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >
                {{ range.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Desktop Layout -->
        <div class="hidden md:flex items-center justify-between">
          <!-- Left: Zap Count + Refresh -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 bg-green-500 rounded-full"></span>
              <span class="text-sm font-medium text-gray-600">
                {{ filteredZaps.length }} zap{{ filteredZaps.length !== 1 ? 's' : '' }}
              </span>
            </div>
            <button
              @click="handleRefresh"
              :disabled="isRefreshing"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-gray-600 hover:text-orange-600 bg-gray-100 hover:bg-orange-50 rounded-lg border border-gray-200 hover:border-orange-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh zap data"
              aria-label="Refresh zap data"
            >
              <IconRefresh :class="['w-4 h-4', isRefreshing ? 'animate-spin' : '']" />
            </button>
          </div>

          <!-- Center: Time Filter -->
          <div class="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              v-for="range in [
                { value: '24h', label: '24h' },
                { value: '7d', label: '7d' },
                { value: '30d', label: '30d' },
                { value: 'all', label: 'All' }
              ]"
              :key="range.value"
              @click="selectedTimeRange = range.value"
              :class="[
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                selectedTimeRange === range.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
            >
              {{ range.label }}
            </button>
          </div>

          <!-- Right: View Toggle -->
          <div class="inline-flex bg-gray-100 rounded-lg p-1">
            <button
              @click="viewMode = 'feed'"
              :class="[
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                viewMode === 'feed'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
            >
              Feed
            </button>
            <button
              @click="viewMode = 'compact'"
              :class="[
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                viewMode === 'compact'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              ]"
            >
              Compact
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content with Proper Spacing -->
    <div class="">
      <!-- Loading State -->
      <SkeletonList v-if="isInitialLoading" :items="5" />

      <!-- Empty State -->
      <div v-else-if="filteredZaps.length === 0" class="max-w-3xl mx-auto">
        <!-- Filtered Results Empty -->
        <div v-if="hasActiveFilters" class="text-center py-12">
          <div class="text-gray-400 mb-4">
            <svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">No Results Found</h3>
          <p class="text-gray-600 mb-6">
            No zaps match your current search or filter criteria
          </p>
          <button
            @click="clearAllFilters"
            class="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Clear All Filters
          </button>
        </div>

        <!-- No Zaps Yet - Comprehensive Guide -->
        <div v-else class="py-8">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-400 to-pink-500 rounded-3xl shadow-lg mb-6">
              <IconBolt class="w-10 h-10 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-gray-900 mb-3">No Zaps Received Yet</h3>
            <p class="text-lg text-gray-600">
              Your feed is empty because you haven't received any zaps. Let's get you started!
            </p>
          </div>

          <!-- Why Empty -->
          <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
            <div class="flex items-start space-x-4">
              <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconInfoCircle class="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 class="text-lg font-semibold text-gray-900 mb-2">Why is this empty?</h4>
                <p class="text-gray-700 leading-relaxed">
                  This feed will show all the zaps (Lightning payments) you receive on your Nostr campaigns, notes and content.
                  Once people start zapping your content, you'll see them appear here in real-time.
                </p>
              </div>
            </div>
          </div>

          <!-- Action Steps -->
          <div class="space-y-4 mb-8">
            <h4 class="text-xl font-bold text-gray-900 text-center mb-6">How to Start Receiving Zaps</h4>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                  1
                </div>
                <div class="flex-1">
                  <h5 class="font-semibold text-gray-900 mb-2">Add a Lightning Address to Your Profile</h5>
                  <p class="text-gray-600 text-sm mb-3">
                    Get a Lightning address from Alby, Wallet of Satoshi, Zeus, or Strike. Add it to your Nostr profile so people can zap you.
                  </p>
                  <div class="flex items-center space-x-2 text-sm text-purple-600">
                    <IconBolt class="w-4 h-4" />
                    <span>Required to receive zaps</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                  2
                </div>
                <div class="flex-1">
                  <h5 class="font-semibold text-gray-900 mb-2">Create Valuable Content</h5>
                  <p class="text-gray-600 text-sm mb-3">
                    Post insightful notes, write articles, share helpful information, or create entertaining content. The more value you provide, the more likely people are to support you with zaps.
                  </p>
                  <button
                    @click="$emit('change-page', 'content')"
                    class="inline-flex items-center space-x-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    <IconFileText class="w-4 h-4" />
                    <span>Create content now →</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                  3
                </div>
                <div class="flex-1">
                  <h5 class="font-semibold text-gray-900 mb-2">Share on Nostr Network</h5>
                  <p class="text-gray-600 text-sm mb-3">
                    Post your content to Nostr using clients like Primal, Damus, Amethyst, or Nostrudel. Use relevant hashtags and engage with your audience.
                  </p>
                  <div class="flex items-center space-x-2 text-sm text-purple-600">
                    <IconUsers class="w-4 h-4" />
                    <span>Build your audience</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-purple-300 transition-all">
              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-purple-600">
                  4
                </div>
                <div class="flex-1">
                  <h5 class="font-semibold text-gray-900 mb-2">Engage & Support Others</h5>
                  <p class="text-gray-600 text-sm mb-3">
                    Reply to posts, join conversations, and zap content you enjoy. Building genuine connections and supporting others often leads to reciprocal support.
                  </p>
                  <div class="flex items-center space-x-2 text-sm text-purple-600">
                    <IconHeart class="w-4 h-4" />
                    <span>Community matters</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tips -->
          <div class="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-6">
            <h5 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <IconBulb class="w-5 h-5 text-amber-500" />
              <span>Pro Tips</span>
            </h5>
            <ul class="space-y-2 text-sm text-gray-700">
              <li class="flex items-start space-x-2">
                <span class="text-purple-600 font-bold mt-0.5">•</span>
                <span>Quality beats quantity - one great post is better than ten mediocre ones</span>
              </li>
              <li class="flex items-start space-x-2">
                <span class="text-purple-600 font-bold mt-0.5">•</span>
                <span>Be authentic and share your unique perspective</span>
              </li>
              <li class="flex items-start space-x-2">
                <span class="text-purple-600 font-bold mt-0.5">•</span>
                <span>Consistency helps - regular posting builds an engaged audience</span>
              </li>
              <li class="flex items-start space-x-2">
                <span class="text-purple-600 font-bold mt-0.5">•</span>
                <span>It takes time - don't get discouraged if zaps don't come immediately</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Feed View -->
      <div v-else-if="viewMode === 'feed'" class="space-y-4">
        <!-- Threads Promo at top when few items -->
        <ThreadsPromo v-if="showPromoAtTop && currentPage === 1" variant="zapfeed" />

        <template v-for="(zap, index) in paginatedZaps" :key="zap.id">
          <!-- Threads Promo Card at position 3 (only on first page) -->
          <ThreadsPromo v-if="shouldShowPromoAtIndex(index) && currentPage === 1" variant="zapfeed" class="mb-4" />

          <!-- Regular Zap Card -->
          <div
            @click="handleZapClick(zap)"
            class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/40 hover:border-gray-300/60 hover:shadow-lg hover:shadow-gray-200/30 transition-all duration-200 cursor-pointer overflow-hidden hover:-translate-y-0.5"
          >
          <div class="p-5 sm:p-6">
            <!-- Header -->
            <div class="flex items-start space-x-3 mb-4">
              <!-- Avatar -->
              <div class="w-11 h-11 rounded-2xl overflow-hidden border border-gray-200/60 flex-shrink-0 shadow-sm">
                <img
                  :src="getSenderAvatar(zap.sender, index)"
                  :alt="getSenderName(zap.sender)"
                  class="w-full h-full object-cover"
                />
              </div>

              <!-- User Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 mb-1">
                  <h3 class="font-semibold text-gray-900 truncate">
                    {{ getSenderName(zap.sender) }}
                  </h3>
                  <span v-if="zap.sender?.nip05" class="text-xs text-gray-500 truncate">
                    {{ zap.sender.nip05 }}
                  </span>
                </div>
                <div class="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{{ formatDate(zap.timestamp) }}</span>
                  <span>•</span>
                  <span :class="['font-medium', getTransactionTypeColor(zap)]">
                    {{ getTransactionTypeText(zap) }}
                  </span>
                  <div :class="['px-2 py-1 rounded-lg flex items-center space-x-1 shadow-sm', getSourceColor(zap)]">
                    <component :is="getSourceIcon(zap)" class="w-3 h-3" />
                  </div>
                </div>
              </div>

              <!-- Amount -->
              <div class="text-right flex-shrink-0">
                <div class="inline-flex items-center space-x-1.5 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2 rounded-2xl border border-orange-200/30 shadow-sm">
                  <IconBolt class="w-4 h-4 text-orange-600" />
                  <span class="font-bold text-orange-700">{{ formatSatsShort(zap.amount) }}</span>
                  <span class="text-xs text-orange-600">sats</span>
                </div>
              </div>
            </div>

            <!-- Content -->
            <div class="ml-13">
              <p class="text-gray-700 leading-relaxed text-sm">
                {{ parseNoteContent(zap.note) }}
              </p>
            </div>
          </div>
          </div>
        </template>
      </div>

      <!-- Compact View -->
      <div v-else class="space-y-4">
        <!-- Threads Promo at top when few items (compact view) -->
        <ThreadsPromo v-if="showPromoAtTop && currentPage === 1" variant="zapfeed-compact" />

        <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/40 shadow-lg shadow-gray-200/30 overflow-hidden">
          <div class="divide-y divide-gray-100/60">
            <template v-for="(zap, index) in paginatedZaps" :key="zap.id">
              <!-- Compact Threads Promo at position 3 (only on first page) -->
              <div v-if="shouldShowPromoAtIndex(index) && currentPage === 1" class="p-3 bg-gray-50/50">
                <ThreadsPromo variant="zapfeed-compact" />
              </div>

              <!-- Compact Zap Row -->
              <div
                @click="handleZapClick(zap)"
                class="p-4 hover:bg-gray-50/80 transition-all duration-150 cursor-pointer"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-9 h-9 rounded-xl overflow-hidden border border-gray-200/60 flex-shrink-0 shadow-sm">
                    <img
                      :src="getSenderAvatar(zap.sender, index)"
                      :alt="getSenderName(zap.sender)"
                      class="w-full h-full object-cover"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <div class="flex items-center space-x-2 min-w-0">
                        <span class="font-semibold text-gray-900 text-sm truncate">
                          {{ getSenderName(zap.sender) }}
                        </span>
                        <span class="text-xs text-gray-500">{{ formatDate(zap.timestamp) }}</span>
                      </div>

                      <div class="flex items-center space-x-1.5 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-1 rounded-xl border border-orange-200/30 shadow-sm flex-shrink-0">
                        <IconBolt class="w-3 h-3 text-orange-600" />
                        <span class="font-bold text-orange-700 text-sm">{{ formatSatsShort(zap.amount) }}</span>
                      </div>
                    </div>

                    <p class="text-sm text-gray-600 truncate leading-relaxed">
                      {{ truncateNote(zap.note, 80) }}
                    </p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Pagination Controls -->
      <div v-if="filteredZaps.length > itemsPerPage && !isInitialLoading" class="mt-8 flex items-center justify-center">
        <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/40 shadow-lg shadow-gray-200/30 p-4">
          <div class="flex items-center space-x-2">
            <!-- Previous Button -->
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'p-2.5 rounded-xl transition-all duration-200',
                currentPage === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-orange-600'
              ]"
            >
              <IconChevronLeft class="w-5 h-5" />
            </button>

            <!-- Page Numbers -->
            <div class="flex items-center space-x-1">
              <button
                v-for="(page, idx) in visiblePageNumbers"
                :key="idx"
                @click="page !== '...' && goToPage(page)"
                :disabled="page === '...'"
                :class="[
                  'min-w-[40px] h-10 rounded-xl text-sm font-semibold transition-all duration-200',
                  page === currentPage
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                    : page === '...'
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-orange-600'
                ]"
              >
                {{ page }}
              </button>
            </div>

            <!-- Next Button -->
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'p-2.5 rounded-xl transition-all duration-200',
                currentPage === totalPages
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-orange-600'
              ]"
            >
              <IconChevronRight class="w-5 h-5" />
            </button>
          </div>

          <!-- Page Info -->
          <div class="mt-3 text-center text-xs text-gray-500">
            Page {{ currentPage }} of {{ totalPages }} ({{ filteredZaps.length }} total zaps)
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Event Modal -->
  <ZapEventModal 
    :event-id="selectedEventId" 
    :specific-zap-id="selectedZapId"
    :show="showEventModal" 
    @close="closeEventModal" 
  />
</template>

<style scoped>
/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Hover effects */
.hover\:shadow-sm:hover {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

/* Focus states for accessibility */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .ml-13 {
    margin-left: 0;
    margin-top: 0.75rem;
  }
}

/* Ensure proper touch targets */
@media (max-width: 768px) {
  button {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Text truncation */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Line clamp for multi-line truncation */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
