<script setup>
import { computed, inject, ref } from 'vue'
import {
  IconBolt,
  IconHeart,
  IconRepeat,
  IconBookmark,
  IconFileText,
  IconEdit,
  IconTrendingUp,
  IconChevronRight
} from '@iconify-prerendered/vue-tabler'
import { useEngagementMetrics } from '../../composables/analytics/useEngagementMetrics.js'
import { filterZapsByTimeRange } from '../../utils/core/timeFilter.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { fetchWithCache, isCacheEntry, unwrap } from '../../services/nostr/CacheEntry.js'
import { useReactiveCache } from '../../composables/core/useReactiveCache.js'
import { storageService } from '../../services/StorageService.js'
import { getContentItems } from '../../composables/content/useContent.js'
import ZapEventModal from '../modals/ZapEventModal.vue'

const combinedZapData = inject('combinedZapData')
const selectedTimeRange = inject('selectedTimeRange')

// Modal state for content preview
const showEventModal = ref(false)
const selectedEventId = ref(null)

const { getEngagementCounts } = useEngagementMetrics()

// Cache for note content (CacheEntry envelopes, with promise coalescing)
const { mapRef: noteContentCache, store: noteStore } = useReactiveCache()

const NOTE_UNAVAILABLE = { text: 'Unable to load note content', title: 'Note (content unavailable)' }

const fetchNoteContent = async (eventId) => {
  return fetchWithCache({
    namespace: 'noteContent',
    key: eventId,
    store: noteStore,
    fetcher: async () => {
      const noteEvent = await nostrService.queryOne({
        ids: [eventId],
        kinds: [1]
      })
      if (!noteEvent?.content) return null
      const text = noteEvent.content.trim()
      return {
        text,
        title: createNoteTitle(text),
        created_at: noteEvent.created_at,
        pubkey: noteEvent.pubkey
      }
    },
    isEmpty: (v) => v == null,
    fallback: NOTE_UNAVAILABLE,
    ttl: {
      hit: 5 * 60 * 1000,  // 5min
      miss: 2 * 60 * 1000, // 2min retry for missing notes
      error: 30_000         // 30s retry on error
    }
  })
}

// Helper function to create note title from content
const createNoteTitle = (text) => {
  if (!text || typeof text !== 'string') return 'Note'
  const firstLine = text.split('\n')[0].trim()
  if (firstLine.length === 0) return 'Note'
  return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
}

// Shared logic for building content performance map from zaps
const buildContentPerformance = (typeFilter) => {
  const nip57Zaps = combinedZapData.value.filter(zap => zap.eventId)
  const filteredZaps = filterZapsByTimeRange(nip57Zaps, selectedTimeRange.value)

  if (filteredZaps.length === 0) return []

  const contentPerformance = new Map()

  filteredZaps.forEach(zap => {
    const eventId = zap.eventId
    if (!contentPerformance.has(eventId)) {
      const engagement = getEngagementCounts(eventId)
      const rawCached = noteContentCache.value.get(eventId)
      const cachedContent = isCacheEntry(rawCached) ? unwrap(rawCached) : rawCached

      contentPerformance.set(eventId, {
        eventId,
        type: 'note',
        title: cachedContent?.title || 'Loading...',
        coverImage: null,
        zaps: 0,
        zapAmount: 0,
        likes: engagement.likes,
        reposts: engagement.reposts,
        bookmarks: engagement.bookmarks
      })

      // Fetch content if not yet cached (fetchWithCache handles coalescing + miss caching)
      if (typeFilter === 'note' && !noteContentCache.value.has(eventId)) {
        fetchNoteContent(eventId).catch(() => {
          // error already cached by fetchWithCache
        })
      }
    }

    const content = contentPerformance.get(eventId)
    content.zaps += 1
    content.zapAmount += zap.amount
  })

  // Identify long-form content via useContent's centralized accessor
  const contentItems = getContentItems()
  contentPerformance.forEach((content, eventId) => {
    const contentItem = contentItems.find(item => item.nostrEventId === eventId)
    if (contentItem) {
      content.type = 'longform'
      content.title = contentItem.title || 'Untitled Article'
      content.coverImage = contentItem.coverImage || null
    }
  })

  // Filter by type, calculate scores, sort and return top 3
  return Array.from(contentPerformance.values())
    .filter(content => content.type === typeFilter)
    .map(content => ({
      ...content,
      totalScore: (content.zaps * 10) + (content.reposts * 3) + (content.likes * 1) + (content.bookmarks * 2)
    }))
    .filter(content => content.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3)
}

const topPerformingNotes = computed(() => buildContentPerformance('note'))
const topPerformingLongForm = computed(() => buildContentPerformance('longform'))

const FALLBACK_IMAGE = '/new_logo3.png'

// Format numbers
const formatNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

const handleContentClick = (content) => {
  selectedEventId.value = content.eventId
  showEventModal.value = true
}

// Check if we have any content to show
const hasContent = computed(() => {
  return topPerformingNotes.value.length > 0 || topPerformingLongForm.value.length > 0
})
</script>

<template>
  <div v-if="hasContent" class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <!-- Clean Header -->
    <div class="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-25">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
          <IconTrendingUp class="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 class="text-xl font-bold text-gray-900">Top Performing Content</h3>
          <p class="text-sm text-gray-600">Your best content this period</p>
        </div>
      </div>
    </div>

    <!-- Content Grid -->
    <div class="p-6">
      <!-- Mobile: Single Column -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Notes Section -->
        <div class="space-y-4">
          <div class="flex items-center space-x-2 mb-4">
            <IconEdit class="w-5 h-5 text-purple-600" />
            <h4 class="text-lg font-semibold text-gray-900">Top Notes</h4>
            <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {{ topPerformingNotes.length }}
            </span>
          </div>
          
          <!-- Notes List -->
          <div v-if="topPerformingNotes.length === 0" class="text-center py-8">
            <IconEdit class="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p class="text-gray-500 text-sm">No performing notes yet</p>
          </div>
          
          <div v-else class="space-y-3">
            <div
              v-for="(note, index) in topPerformingNotes"
              :key="note.eventId"
              @click="handleContentClick(note)"
              class="group bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
            >
              <!-- Note Header -->
              <div class="flex items-start space-x-3 mb-3">
                <!-- Rank Badge -->
                <div :class="[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  'bg-orange-100 text-orange-600'
                ]">
                  {{ index + 1 }}
                </div>
                
                <!-- Note Thumbnail -->
                <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-50">
                  <img
                    :src="FALLBACK_IMAGE"
                    alt="Note"
                    class="w-full h-full object-cover opacity-60"
                  />
                </div>
                
                <!-- Note Preview -->
                <div class="flex-1 min-w-0">
                  <h5 class="font-medium text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                    {{ note.title }}
                  </h5>
                </div>
                
                <!-- Arrow -->
                <IconChevronRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
              </div>
              
              <!-- Metrics -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <!-- Zaps -->
                  <div class="flex items-center space-x-1 bg-orange-50 px-2 py-1 rounded-full">
                    <IconBolt class="w-3 h-3 text-orange-500" />
                    <span class="text-xs font-semibold text-orange-700">{{ formatNumber(note.zapAmount) }}</span>
                  </div>
                  
                  <!-- Engagement -->
                  <div class="flex items-center space-x-1 text-xs">
                    <span v-if="note.likes > 0" class="flex items-center space-x-0.5 text-red-600">
                      <IconHeart class="w-3 h-3" />
                      <span>{{ formatNumber(note.likes) }}</span>
                    </span>
                    <span v-if="note.reposts > 0" class="flex items-center space-x-0.5 text-green-600">
                      <IconRepeat class="w-3 h-3" />
                      <span>{{ formatNumber(note.reposts) }}</span>
                    </span>
                    <span v-if="note.bookmarks > 0" class="flex items-center space-x-0.5 text-blue-600">
                      <IconBookmark class="w-3 h-3" />
                      <span>{{ formatNumber(note.bookmarks) }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Long-form Articles Section -->
        <div class="space-y-4">
          <div class="flex items-center space-x-2 mb-4">
            <IconFileText class="w-5 h-5 text-blue-600" />
            <h4 class="text-lg font-semibold text-gray-900">Top Articles</h4>
            <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {{ topPerformingLongForm.length }}
            </span>
          </div>
          
          <!-- Articles List -->
          <div v-if="topPerformingLongForm.length === 0" class="text-center py-8">
            <IconFileText class="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p class="text-gray-500 text-sm">No performing articles yet</p>
          </div>
          
          <div v-else class="space-y-3">
            <div
              v-for="(article, index) in topPerformingLongForm"
              :key="article.eventId"
              @click="handleContentClick(article)"
              class="group bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer"
            >
              <!-- Article Header -->
              <div class="flex items-start space-x-3 mb-3">
                <!-- Rank Badge -->
                <div :class="[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-600' :
                  'bg-orange-100 text-orange-600'
                ]">
                  {{ index + 1 }}
                </div>
                
                <!-- Article Thumbnail -->
                <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-50">
                  <img
                    :src="article.coverImage || FALLBACK_IMAGE"
                    :alt="article.title"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = FALLBACK_IMAGE"
                  />
                </div>
                
                <!-- Article Info -->
                <div class="flex-1 min-w-0">
                  <h5 class="font-medium text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                    {{ article.title }}
                  </h5>
                </div>
                
                <!-- Arrow -->
                <IconChevronRight class="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
              </div>
              
              <!-- Metrics -->
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <!-- Zaps -->
                  <div class="flex items-center space-x-1 bg-orange-50 px-2 py-1 rounded-full">
                    <IconBolt class="w-3 h-3 text-orange-500" />
                    <span class="text-xs font-semibold text-orange-700">{{ formatNumber(article.zapAmount) }}</span>
                  </div>
                  
                  <!-- Engagement -->
                  <div class="flex items-center space-x-1 text-xs">
                    <span v-if="article.likes > 0" class="flex items-center space-x-0.5 text-red-600">
                      <IconHeart class="w-3 h-3" />
                      <span>{{ formatNumber(article.likes) }}</span>
                    </span>
                    <span v-if="article.reposts > 0" class="flex items-center space-x-0.5 text-green-600">
                      <IconRepeat class="w-3 h-3" />
                      <span>{{ formatNumber(article.reposts) }}</span>
                    </span>
                    <span v-if="article.bookmarks > 0" class="flex items-center space-x-0.5 text-blue-600">
                      <IconBookmark class="w-3 h-3" />
                      <span>{{ formatNumber(article.bookmarks) }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Content Preview Modal -->
  <ZapEventModal
    :event-id="selectedEventId"
    :show="showEventModal"
    @close="showEventModal = false; selectedEventId = null"
  />
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>