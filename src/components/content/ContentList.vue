<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { formatSatsShort } from '../../utils/format.js'
import {
  IconFileText,
  IconMail, 
  IconMicrophone, 
  IconVideo, 
  IconPhoto, 
  IconFile,
  IconEdit, 
  IconShare, 
  IconTrash,
  IconEye,
  IconCopy,
  IconDots,
  IconBolt,
  IconUsers,
  IconMenu
} from '@iconify-prerendered/vue-tabler'
import { 
  IconHeart,
  IconRepeat,
  IconBookmark
} from '@iconify-prerendered/vue-tabler'
import EngagementMetrics from '../analytics/EngagementMetrics.vue'
import { useEngagementMetrics } from '../../composables/analytics/useEngagementMetrics.js'
import { useContentZaps } from '../../composables/content/useContentZaps.js'

const props = defineProps({
  items: {
    type: Array,
    required: true
  }
})

const {
  getEngagementCounts,
  startEngagementTracking,
  startLongFormContentTracking
} = useEngagementMetrics()

const { startZapTracking } = useContentZaps()

// Track which dropdown is currently open
const openDropdownId = ref(null)

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (openDropdownId.value && !event.target.closest('.dropdown-container')) {
    openDropdownId.value = null
  }
}

// Add/remove event listener
const tracked = new Set()

function ensureTrackingFor(item) {
  if (!item.nostrEventId || tracked.has(item.nostrEventId)) return
  tracked.add(item.nostrEventId)
  startZapTracking(item.nostrEventId)
  if (item.creatorPubkey && item.id) {
    startLongFormContentTracking(item.nostrEventId, item.creatorPubkey, item.id)
  } else {
    startEngagementTracking(item.nostrEventId)
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  props.items.forEach(ensureTrackingFor)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Shallow watch — only react when items array length changes
watch(() => props.items.length, () => {
  props.items.forEach(ensureTrackingFor)
})

const emit = defineEmits(['edit', 'delete', 'preview', 'duplicate', 'share', 'publish-nostr'])

const getTypeIcon = (type) => {
  const icons = {
    article: IconFileText,
    newsletter: IconMail,
    podcast: IconMicrophone,
    video: IconVideo,
    image: IconPhoto,
    document: IconFile
  }
  return icons[type] || IconFileText
}

const getStatusColor = (status) => {
  const colors = {
    published: 'text-green-600 bg-green-100',
    draft: 'text-yellow-600 bg-yellow-100',
    archived: 'text-gray-600 bg-gray-100'
  }
  return colors[status] || 'text-gray-600 bg-gray-100'
}

const getMonetizationColor = (model) => {
  const colors = {
    'one-time': 'text-orange-600 bg-orange-100',
    'subscription': 'text-purple-600 bg-purple-100',
    'free': 'text-gray-600 bg-gray-100'
  }
  return colors[model] || 'text-gray-600 bg-gray-100'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}



// Get total revenue for display
const getTotalRevenue = (item) => {
  return item.totalRevenue || 0
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="item in items"
      :key="item.id"
      class="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/40 shadow-sm hover:shadow-lg hover:shadow-gray-200/30 transition-all duration-200 overflow-hidden hover:-translate-y-0.5 group"
    >
      <div class="p-4">
        <!-- Mobile Layout -->
        <div class="block sm:hidden space-y-3">
          <!-- Header Row -->
          <div class="flex items-start justify-between">
            <div class="flex items-start space-x-3 flex-1 min-w-0">
              <!-- Type Icon -->
              <div :class="[
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                getStatusColor(item.status)
              ]">
                <component :is="getTypeIcon(item.type)" class="w-4 h-4" />
              </div>
              
              <!-- Title and Badges -->
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 text-base leading-tight mb-2 line-clamp-2">{{ item.title }}</h3>
                <div class="flex flex-wrap items-center gap-2">
                  <span :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    getStatusColor(item.status)
                  ]">
                    {{ item.status }}
                  </span>
                  <span v-if="item.nostrEventId" class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    On Nostr
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center space-x-1 flex-shrink-0">
              <button
                @click="$emit('preview', item)"
                class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Preview"
              >
                <IconEye class="w-4 h-4" />
              </button>
              
              <div class="relative dropdown-container">
                <button
                  @click="openDropdownId = openDropdownId === item.id ? null : item.id"
                  class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <IconDots class="w-4 h-4" />
                </button>
                
                <div 
                  v-if="openDropdownId === item.id"
                  class="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50"
                >
                  <button
                    @click="$emit('edit', item); openDropdownId = null"
                    class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2"
                  >
                    <IconEdit class="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  
                  <button
                    v-if="item.status === 'draft'"
                    @click="$emit('publish-nostr', item); openDropdownId = null"
                    class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center space-x-2"
                  >
                    <IconShare class="w-3 h-3" />
                    <span>Publish</span>
                  </button>
                  
                  <button
                    @click="$emit('delete', item); openDropdownId = null"
                    class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center space-x-2"
                  >
                    <IconTrash class="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Description -->
          <p v-if="item.description" class="text-sm text-gray-600 leading-relaxed line-clamp-2">{{ item.description }}</p>
          
          <!-- Revenue and Date Row -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-green-600 font-semibold relative tooltip-container cursor-help">
              {{ getTotalRevenue(item).toLocaleString() }} sats
              <div class="tooltip">
                Total amount received from Lightning zaps and paid content access.
              </div>
            </span>
            <span class="text-gray-500">{{ formatDate(item.updatedAt) }}</span>
          </div>
          
          <!-- Twitter-Style Engagement Row -->
          <div v-if="item.nostrEventId" class="flex items-center justify-between pt-3 border-t border-gray-100">
            <!-- Engagement Metrics -->
            <div class="flex items-center space-x-6">
              <!-- Likes -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors group relative tooltip-container">
                <IconHeart :class="[
                  'w-4 h-4 transition-colors',
                  getEngagementCounts(item.nostrEventId).likes > 0 ? 'text-red-500' : 'text-gray-400 group-hover:text-red-500'
                ]" />
                <span class="text-sm font-medium">{{ getEngagementCounts(item.nostrEventId).likes || 0 }}</span>
                <div class="tooltip">
                  {{ getEngagementCounts(item.nostrEventId).likes || 0 }} {{ (getEngagementCounts(item.nostrEventId).likes || 0) === 1 ? 'like' : 'likes' }} from Nostr users
                </div>
              </button>
              
              <!-- Reposts -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors group relative tooltip-container">
                <IconRepeat :class="[
                  'w-4 h-4 transition-colors',
                  getEngagementCounts(item.nostrEventId).reposts > 0 ? 'text-green-500' : 'text-gray-400 group-hover:text-green-500'
                ]" />
                <span class="text-sm font-medium">{{ getEngagementCounts(item.nostrEventId).reposts || 0 }}</span>
                <div class="tooltip">
                  {{ getEngagementCounts(item.nostrEventId).reposts || 0 }} {{ (getEngagementCounts(item.nostrEventId).reposts || 0) === 1 ? 'repost' : 'reposts' }} on Nostr
                </div>
              </button>
              
              <!-- Zaps -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-orange-500 transition-colors group relative tooltip-container">
                <IconBolt :class="[
                  'w-4 h-4 transition-colors',
                  (item.zapCount || 0) > 0 ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500'
                ]" />
                <span class="text-sm font-medium">{{ item.zapCount || 0 }}</span>
                <div class="tooltip">
                  {{ item.zapCount || 0 }} Lightning {{ (item.zapCount || 0) === 1 ? 'zap' : 'zaps' }} ({{ formatSatsShort(item.zapAmount || 0) }} sats total)
                </div>
              </button>
              
              <!-- Bookmarks -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors group relative tooltip-container">
                <IconBookmark :class="[
                  'w-4 h-4 transition-colors',
                  getEngagementCounts(item.nostrEventId).bookmarks > 0 ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'
                ]" />
                <span class="text-sm font-medium">{{ getEngagementCounts(item.nostrEventId).bookmarks || 0 }}</span>
                <div class="tooltip">
                  {{ getEngagementCounts(item.nostrEventId).bookmarks || 0 }} {{ (getEngagementCounts(item.nostrEventId).bookmarks || 0) === 1 ? 'bookmark' : 'bookmarks' }} on Nostr
                </div>
              </button>
            </div>
            
            <!-- Zap Amount Badge -->
            <div v-if="(item.zapAmount || 0) > 0" class="flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1 rounded-full relative tooltip-container cursor-help">
              <IconBolt class="w-3 h-3 text-orange-600" />
              <span class="text-xs font-bold text-orange-700">{{ formatSatsShort(item.zapAmount || 0) }} sats</span>
              <div class="tooltip">
                Total amount received from Lightning zaps and paid content access.
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop Layout -->
        <div class="hidden sm:block">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-start space-x-3 flex-1 min-w-0">
              <!-- Type Icon -->
              <div :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                getStatusColor(item.status)
              ]">
                <component :is="getTypeIcon(item.type)" class="w-4 h-4" />
              </div>

              <!-- Content Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2 mb-1">
                  <h3 class="font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{{ item.title }}</h3>
                  <span :class="[
                    'px-2 py-1 rounded-full text-xs font-medium capitalize',
                    getStatusColor(item.status)
                  ]">
                    {{ item.status }}
                  </span>
                  <span v-if="item.nostrEventId" class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    On Nostr
                  </span>
                </div>
                <p class="text-sm text-gray-600 line-clamp-2 mb-2">{{ item.description }}</p>
                <div class="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Updated {{ formatDate(item.updatedAt) }}</span>
                  <span class="text-green-600 font-medium">{{ getTotalRevenue(item).toLocaleString() }} sats</span>
                </div>
              </div>
            </div>

            <!-- Desktop Actions -->
            <div class="flex items-center space-x-2 flex-shrink-0">
              <button
                @click="$emit('edit', item)"
                class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                title="Edit"
              >
                <IconEdit class="w-4 h-4" />
              </button>
              <button
                @click="$emit('preview', item)"
                class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Preview"
              >
                <IconEye class="w-4 h-4" />
              </button>
              <button
                v-if="item.status === 'draft'"
                @click="$emit('publish-nostr', item)"
                class="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Publish to Nostr"
              >
                <IconShare class="w-4 h-4" />
              </button>
              <button
                @click="$emit('delete', item)"
                class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <IconTrash class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Twitter-Style Engagement Row -->
          <div v-if="item.nostrEventId" class="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
            <!-- Engagement Metrics -->
            <div class="flex items-center space-x-8">
              <!-- Likes -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors group relative tooltip-container">
                <IconHeart :class="[
                  'w-5 h-5 transition-colors',
                  getEngagementCounts(item.nostrEventId).likes > 0 ? 'text-red-500' : 'text-gray-400 group-hover:text-red-500'
                ]" />
                <span class="text-sm font-medium">{{ getEngagementCounts(item.nostrEventId).likes || 0 }}</span>
                <div class="tooltip">
                  {{ getEngagementCounts(item.nostrEventId).likes || 0 }} {{ (getEngagementCounts(item.nostrEventId).likes || 0) === 1 ? 'like' : 'likes' }} from Nostr users
                </div>
              </button>
              
              <!-- Reposts -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors group relative tooltip-container">
                <IconRepeat :class="[
                  'w-5 h-5 transition-colors',
                  getEngagementCounts(item.nostrEventId).reposts > 0 ? 'text-green-500' : 'text-gray-400 group-hover:text-green-500'
                ]" />
                <span class="text-sm font-medium">{{ getEngagementCounts(item.nostrEventId).reposts || 0 }}</span>
                <div class="tooltip">
                  {{ getEngagementCounts(item.nostrEventId).reposts || 0 }} {{ (getEngagementCounts(item.nostrEventId).reposts || 0) === 1 ? 'repost' : 'reposts' }} on Nostr
                </div>
              </button>
              
              <!-- Zaps -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-orange-500 transition-colors group relative tooltip-container">
                <IconBolt :class="[
                  'w-5 h-5 transition-colors',
                  (item.zapCount || 0) > 0 ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500'
                ]" />
                <span class="text-sm font-medium">{{ item.zapCount || 0 }}</span>
                <div class="tooltip">
                  {{ item.zapCount || 0 }} Lightning {{ (item.zapCount || 0) === 1 ? 'zap' : 'zaps' }} ({{ formatSatsShort(item.zapAmount || 0) }} sats total)
                </div>
              </button>
              
              <!-- Bookmarks -->
              <button class="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors group relative tooltip-container">
                <IconBookmark :class="[
                  'w-5 h-5 transition-colors',
                  getEngagementCounts(item.nostrEventId).bookmarks > 0 ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'
                ]" />
                <span class="text-sm font-medium">{{ getEngagementCounts(item.nostrEventId).bookmarks || 0 }}</span>
                <div class="tooltip">
                  {{ getEngagementCounts(item.nostrEventId).bookmarks || 0 }} {{ (getEngagementCounts(item.nostrEventId).bookmarks || 0) === 1 ? 'bookmark' : 'bookmarks' }} on Nostr
                </div>
              </button>
            </div>
            
            <!-- Revenue Badge -->
            <div v-if="(item.zapAmount || 0) > 0" class="flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1 rounded-full relative tooltip-container cursor-help">
              <IconBolt class="w-4 h-4 text-orange-600" />
              <span class="text-sm font-bold text-orange-700">{{ formatSatsShort(item.zapAmount || 0) }} sats</span>
              <div class="tooltip">
                Total amount received from Lightning zaps and paid content access.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-if="items.length === 0" class="text-center py-12">
      <IconFileText class="w-16 h-16 mx-auto text-gray-400 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
      <p class="text-gray-600">Create your first piece of premium content to start earning.</p>
    </div>
  </div>
</template>

<style scoped>
/* Ensure dropdowns appear above other elements */
.z-10 {
  z-index: 10;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Social media style engagement buttons */
.group:hover .group-hover\:text-red-500 {
  color: #ef4444;
}

.group:hover .group-hover\:text-green-500 {
  color: #10b981;
}

.group:hover .group-hover\:text-orange-500 {
  color: #f97316;
}

.group:hover .group-hover\:text-blue-500 {
  color: #3b82f6;
}

/* Tooltip Styles with 0.5s delay */
.tooltip-container {
  position: relative;
}

.tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  z-index: 50;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  
  /* Initial hidden state */
  opacity: 0;
  visibility: hidden;
  
  /* Smooth transition with 0.5s delay */
  transition: opacity 0.2s ease-in-out 0.5s, 
              visibility 0.2s ease-in-out 0.5s, 
              transform 0.2s ease-in-out 0.5s;
}

.tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.tooltip-container:hover .tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-8px);
}

/* Mobile: Reduce tooltip delay and size */
@media (max-width: 640px) {
  .tooltip {
    font-size: 11px;
    padding: 6px 10px;
    /* Faster on mobile for better touch experience */
    transition: opacity 0.15s ease-in-out 0.3s, 
                visibility 0.15s ease-in-out 0.3s, 
                transform 0.15s ease-in-out 0.3s;
  }
  
  .tooltip::after {
    border-width: 4px;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .tooltip {
    background-color: #000000;
    border: 1px solid #ffffff;
  }
  
  .tooltip::after {
    border-top-color: #000000;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .tooltip {
    transition: none;
  }
  
  .tooltip-container:hover .tooltip {
    transform: translateX(-50%) translateY(-8px);
  }
}
</style>