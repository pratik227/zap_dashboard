<script setup>
import { computed, inject, ref } from 'vue'
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
  IconTrash
} from '@iconify-prerendered/vue-tabler'
import { filterZapsByTimeRange } from '../utils/timeFilter.js'
import ZapEventModal from '../components/ZapEventModal.vue'
import { useContentZaps } from '../composables/useContentZaps.js'
import Filters from '../components/Filters.vue'

const zapData = inject('zapData')
const combinedZapData = inject('combinedZapData')
const searchQuery = inject('searchQuery')
const selectedFilters = inject('selectedFilters')
const selectedTimeRange = inject('selectedTimeRange')

// Get zap data from useContentZaps
const { getAllContentZaps } = useContentZaps()

// State for event modal
const showEventModal = ref(false)
const selectedEventId = ref(null)
const selectedZapId = ref(null)

// UI state
const showFilters = ref(false)
const viewMode = ref('feed') // 'feed' or 'compact'

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
  
  // Filter to only show zaps with eventId (NIP-57 zaps)
  zaps = zaps.filter(zap => zap.eventId)
  
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
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Inject profile store from parent
const profileStore = inject('profileStore', ref(new Map()))

// Dynamic avatar generation with profile integration
const generateAvatar = (sender, index) => {
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
    return generateFallbackAvatar(pubkey)
  }
  
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const identifier = sender?.name || `user-${index}`
  const hash = identifier.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
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

// Format amount for display
const formatAmount = (amount) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Clean Apple-like Header with Blue Accent -->
    <div class="bg-white/95 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-xl shadow-gray-200/40 overflow-hidden">
      <!-- Blue Accent Line -->
      <div class="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600"></div>
      
      <!-- Header Content -->
      <div class="px-6 py-5">
        <div class="flex items-center justify-between">
          <!-- Left: Zap Count with Clean Typography -->
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span class="text-sm font-medium text-gray-700">
              {{ filteredZaps.length }} zap{{ filteredZaps.length !== 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Center: Clean Time Filter Buttons -->
          <div class="flex items-center bg-gray-50/80 backdrop-blur-sm rounded-2xl p-1 shadow-sm border border-gray-200/50">
            <button
              v-for="range in [
                { value: '24h', label: '24h', icon: '🕐' },
                { value: '7d', label: '7d', icon: '📅' },
                { value: '30d', label: '30d', icon: '📊' },
                { value: 'all', label: 'All', icon: '∞' }
              ]"
              :key="range.value"
              @click="selectedTimeRange = range.value"
              :class="[
                'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out min-w-[70px] flex items-center justify-center space-x-1.5',
                selectedTimeRange === range.value
                  ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
              ]"
            >
              <span class="text-xs opacity-70">{{ range.icon }}</span>
              <span>{{ range.label }}</span>
            </button>
          </div>

          <!-- Right: View Mode Toggle -->
          <div class="flex items-center bg-gray-50/80 backdrop-blur-sm rounded-2xl p-1 shadow-sm border border-gray-200/50">
            <button
              @click="viewMode = 'feed'"
              :class="[
                'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out',
                viewMode === 'feed' 
                  ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
              ]"
            >
              Feed
            </button>
            <button
              @click="viewMode = 'compact'"
              :class="[
                'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-out',
                viewMode === 'compact' 
                  ? 'bg-white text-orange-600 shadow-md shadow-orange-100/50 transform scale-105 border border-orange-200/30' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-white/60 hover:shadow-sm'
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
      <!-- Empty State -->
      <div v-if="!filteredZaps.length" class="text-center py-16">
        <div class="w-16 h-16 bg-gray-100/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <IconBolt class="w-8 h-8 text-gray-400" />
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No zaps found</h3>
        <p class="text-gray-500 text-sm max-w-sm mx-auto">
          {{ zapData.length === 0 ? 'Connect your wallet to see real zap data' : 'Try adjusting your filters or search terms.' }}
        </p>
        <!-- Clear filters button in empty state -->
        <div v-if="hasActiveFilters" class="mt-4">
          <button
            @click="clearAllFilters"
            class="bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 px-4 py-2 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <IconTrash class="w-4 h-4" />
            Clear all filters
          </button>
        </div>
      </div>

      <!-- Feed View -->
      <div v-else-if="viewMode === 'feed'" class="space-y-4">
        <div
          v-for="(zap, index) in filteredZaps"
          :key="zap.id"
          @click="handleZapClick(zap)"
          class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/40 hover:border-gray-300/60 hover:shadow-lg hover:shadow-gray-200/30 transition-all duration-200 cursor-pointer overflow-hidden hover:-translate-y-0.5"
        >
          <div class="p-5 sm:p-6">
            <!-- Header -->
            <div class="flex items-start space-x-3 mb-4">
              <!-- Avatar -->
              <div class="w-11 h-11 rounded-2xl overflow-hidden border border-gray-200/60 flex-shrink-0 shadow-sm">
                <img
                  :src="generateAvatar(zap.sender, index)"
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
                  <span class="font-bold text-orange-700">{{ formatAmount(zap.amount) }}</span>
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
      </div>

      <!-- Compact View -->
      <div v-else class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/40 shadow-lg shadow-gray-200/30 overflow-hidden">
        <div class="divide-y divide-gray-100/60">
          <div
            v-for="(zap, index) in filteredZaps"
            :key="zap.id"
            @click="handleZapClick(zap)"
            class="p-4 hover:bg-gray-50/80 transition-all duration-150 cursor-pointer"
          >
            <div class="flex items-center space-x-3">
              <!-- Avatar -->
              <div class="w-9 h-9 rounded-xl overflow-hidden border border-gray-200/60 flex-shrink-0 shadow-sm">
                <img
                  :src="generateAvatar(zap.sender, index)"
                  :alt="getSenderName(zap.sender)"
                  class="w-full h-full object-cover"
                />
              </div>

              <!-- Content -->
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
                    <span class="font-bold text-orange-700 text-sm">{{ formatAmount(zap.amount) }}</span>
                  </div>
                </div>
                
                <p class="text-sm text-gray-600 truncate leading-relaxed">
                  {{ truncateNote(zap.note, 80) }}
                </p>
              </div>
            </div>
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