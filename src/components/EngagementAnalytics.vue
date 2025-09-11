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
  IconEye,
  IconChevronRight
} from '@iconify-prerendered/vue-tabler'
import { useEngagementMetrics } from '../composables/useEngagementMetrics.js'
import { filterZapsByTimeRange } from '../utils/timeFilter.js'

const combinedZapData = inject('combinedZapData')
const selectedTimeRange = inject('selectedTimeRange')
const changePage = inject('changePage')

const { getEngagementCounts } = useEngagementMetrics()

// Separate notes and long-form content
const topPerformingNotes = computed(() => {
  const nip57Zaps = combinedZapData.value.filter(zap => zap.eventId)
  const filteredZaps = filterZapsByTimeRange(nip57Zaps, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) return []

  // Group by content and calculate performance for notes
  const contentPerformance = new Map()
  
  filteredZaps.forEach(zap => {
    const eventId = zap.eventId
    if (!contentPerformance.has(eventId)) {
      const engagement = getEngagementCounts(eventId)
      contentPerformance.set(eventId, {
        eventId,
        type: 'note', // Assume note for now, will be updated if we find long-form data
        title: '',
        content: '',
        coverImage: null,
        zaps: 0,
        zapAmount: 0,
        likes: engagement.likes,
        reposts: engagement.reposts,
        bookmarks: engagement.bookmarks,
        totalScore: 0
      })
    }
    
    const content = contentPerformance.get(eventId)
    content.zaps += 1
    content.zapAmount += zap.amount
    
    // Extract note content for preview
    if (zap.note && !content.content) {
      content.content = parseNoteContent(zap.note)
    }
  })

  // Try to get content details from localStorage to identify long-form vs notes
  try {
    const storedContent = localStorage.getItem('user_content_items')
    if (storedContent) {
      const contentItems = JSON.parse(storedContent)
      
      contentPerformance.forEach((content, eventId) => {
        const contentItem = contentItems.find(item => item.nostrEventId === eventId)
        if (contentItem) {
          content.type = 'longform'
          content.title = contentItem.title || 'Untitled Article'
          content.coverImage = contentItem.coverImage || null
        }
      })
    }
  } catch (error) {
    console.warn('Failed to load content details from storage:', error)
  }

  // Filter for notes only and calculate scores
  const notesArray = Array.from(contentPerformance.values())
    .filter(content => content.type === 'note')
  
  notesArray.forEach(content => {
    content.totalScore = (content.zaps * 10) + (content.reposts * 3) + (content.likes * 1) + (content.bookmarks * 2)
  })

  return notesArray
    .filter(content => content.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3)
})

const topPerformingLongForm = computed(() => {
  const nip57Zaps = combinedZapData.value.filter(zap => zap.eventId)
  const filteredZaps = filterZapsByTimeRange(nip57Zaps, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) return []

  // Group by content and calculate performance for long-form
  const contentPerformance = new Map()
  
  filteredZaps.forEach(zap => {
    const eventId = zap.eventId
    if (!contentPerformance.has(eventId)) {
      const engagement = getEngagementCounts(eventId)
      contentPerformance.set(eventId, {
        eventId,
        type: 'note',
        title: '',
        content: '',
        coverImage: null,
        zaps: 0,
        zapAmount: 0,
        likes: engagement.likes,
        reposts: engagement.reposts,
        bookmarks: engagement.bookmarks,
        totalScore: 0
      })
    }
    
    const content = contentPerformance.get(eventId)
    content.zaps += 1
    content.zapAmount += zap.amount
  })

  // Get content details from localStorage
  try {
    const storedContent = localStorage.getItem('user_content_items')
    if (storedContent) {
      const contentItems = JSON.parse(storedContent)
      
      contentPerformance.forEach((content, eventId) => {
        const contentItem = contentItems.find(item => item.nostrEventId === eventId)
        if (contentItem) {
          content.type = 'longform'
          content.title = contentItem.title || 'Untitled Article'
          content.coverImage = contentItem.coverImage || null
        }
      })
    }
  } catch (error) {
    console.warn('Failed to load content details from storage:', error)
  }

  // Filter for long-form only and calculate scores
  const longFormArray = Array.from(contentPerformance.values())
    .filter(content => content.type === 'longform')
  
  longFormArray.forEach(content => {
    content.totalScore = (content.zaps * 10) + (content.reposts * 3) + (content.likes * 1) + (content.bookmarks * 2)
  })

  return longFormArray
    .filter(content => content.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3)
})

// Parse note content to extract meaningful text
const parseNoteContent = (note) => {
  if (typeof note === 'string') {
    if (note.startsWith('{') && note.endsWith('}')) {
      try {
        const parsed = JSON.parse(note)
        if (parsed && typeof parsed === 'object') {
          if (parsed.content) {
            return parsed.content.trim()
          }
          if (parsed.description) {
            return parsed.description.trim()
          }
          return 'Note content'
        }
      } catch (error) {
        return note.trim()
      }
    } else if (note.startsWith('[') && note.endsWith(']')) {
      try {
        const parsed = JSON.parse(note)
        if (Array.isArray(parsed)) {
          return extractTextFromArray(parsed)
        }
      } catch (error) {
        return note.trim()
      }
    }
    return note.trim()
  }
  
  if (Array.isArray(note)) {
    return extractTextFromArray(note)
  }
  
  return String(note || 'Note content').trim()
}

const extractTextFromArray = (noteArray) => {
  try {
    const textPlain = noteArray.find(item => Array.isArray(item) && item[0] === 'text/plain')
    if (textPlain && textPlain[1]) {
      return textPlain[1].trim()
    }
    
    const firstText = noteArray.find(item => Array.isArray(item) && typeof item[1] === 'string')
    if (firstText && firstText[1]) {
      return firstText[1].trim()
    }
    
    return 'Note content'
  } catch (error) {
    return 'Note content'
  }
}

// Generate fallback image
const generateContentFallbackImage = () => {
  return '/new_logo3.png'
}

// Get content title for display
const getNoteTitle = (content) => {
  if (!content.content) return 'Short note'
  
  // Get first line or first 40 characters
  const firstLine = content.content.split('\n')[0].trim()
  if (firstLine.length === 0) return 'Short note'
  
  return firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine
}

const getLongFormTitle = (content) => {
  const title = content.title || 'Untitled Article'
  return title.length > 40 ? title.substring(0, 40) + '...' : title
}

// Format numbers
const formatNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

// Handle content clicks
const handleNoteClick = (note) => {
  // Navigate to note details view (you'll need to implement this)
  console.log('Opening note details for:', note.eventId)
  // changePage('note-details', { eventId: note.eventId })
}

const handleLongFormClick = (article) => {
  // Navigate to content details
  changePage('content')
  // You might want to add logic to show specific article
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
            <IconEdit class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p class="text-gray-500 text-sm">No performing notes yet</p>
          </div>
          
          <div v-else class="space-y-3">
            <div
              v-for="(note, index) in topPerformingNotes"
              :key="note.eventId"
              @click="handleNoteClick(note)"
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
                    :src="generateContentFallbackImage()"
                    alt="Note"
                    class="w-full h-full object-cover opacity-60"
                  />
                </div>
                
                <!-- Note Preview -->
                <div class="flex-1 min-w-0">
                  <h5 class="font-medium text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                    {{ getNoteTitle(note) }}
                  </h5>
                  <div class="flex items-center space-x-2">
                    <IconEdit class="w-3 h-3 text-purple-500" />
                    <span class="text-xs text-gray-500">Note</span>
                  </div>
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
                  <div class="flex items-center space-x-2 text-xs">
                    <span v-if="note.likes > 0" class="flex items-center space-x-0.5 text-pink-600">
                      <IconHeart class="w-3 h-3" />
                      <span>{{ formatNumber(note.likes) }}</span>
                    </span>
                    <span v-if="note.reposts > 0" class="flex items-center space-x-0.5 text-green-600">
                      <IconRepeat class="w-3 h-3" />
                      <span>{{ formatNumber(note.reposts) }}</span>
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
            <IconFileText class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p class="text-gray-500 text-sm">No performing articles yet</p>
          </div>
          
          <div v-else class="space-y-3">
            <div
              v-for="(article, index) in topPerformingLongForm"
              :key="article.eventId"
              @click="handleLongFormClick(article)"
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
                    :src="article.coverImage || generateContentFallbackImage()"
                    :alt="article.title"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = generateContentFallbackImage()"
                  />
                </div>
                
                <!-- Article Info -->
                <div class="flex-1 min-w-0">
                  <h5 class="font-medium text-gray-900 text-sm leading-tight mb-1 line-clamp-2">
                    {{ getLongFormTitle(article) }}
                  </h5>
                  <div class="flex items-center space-x-2">
                    <IconFileText class="w-3 h-3 text-blue-500" />
                    <span class="text-xs text-gray-500">Article</span>
                  </div>
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
                  <div class="flex items-center space-x-2 text-xs">
                    <span v-if="article.likes > 0" class="flex items-center space-x-0.5 text-pink-600">
                      <IconHeart class="w-3 h-3" />
                      <span>{{ formatNumber(article.likes) }}</span>
                    </span>
                    <span v-if="article.reposts > 0" class="flex items-center space-x-0.5 text-green-600">
                      <IconRepeat class="w-3 h-3" />
                      <span>{{ formatNumber(article.reposts) }}</span>
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
</template>

<style scoped>
/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Clean transitions */
.transition-all {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-colors {
  transition: color 0.15s ease;
}

/* Hover states */
.group:hover .group-hover\:text-orange-500 {
  color: #f97316;
}

/* Focus states for accessibility */
.group:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Mobile optimizations */
@media (max-width: 1024px) {
  .grid-cols-1 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  .group {
    min-height: 44px;
  }
  
  .cursor-pointer {
    cursor: pointer;
  }
}

/* Clean card shadows */
.hover\:shadow-md:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Subtle border hover */
.hover\:border-gray-300:hover {
  border-color: #d1d5db;
}
</style>