<script setup>
import { computed, inject } from 'vue'
import {
  IconBolt,
  IconHeart,
  IconRepeat,
  IconBookmark,
  IconEye,
  IconTrendingUp
} from '@iconify-prerendered/vue-tabler'
import { useEngagementMetrics } from '../composables/useEngagementMetrics.js'
import { filterZapsByTimeRange } from '../utils/timeFilter.js'

const combinedZapData = inject('combinedZapData')
const selectedTimeRange = inject('selectedTimeRange')
const changePage = inject('changePage')

const { getEngagementCounts } = useEngagementMetrics()

// Find best performing content with real engagement data
const bestPerformingContent = computed(() => {
  const nip57Zaps = combinedZapData.value.filter(zap => zap.eventId)
  const filteredZaps = filterZapsByTimeRange(nip57Zaps, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) return []

  // Group by content and calculate performance
  const contentPerformance = new Map()
  
  filteredZaps.forEach(zap => {
    const eventId = zap.eventId
    if (!contentPerformance.has(eventId)) {
      const engagement = getEngagementCounts(eventId)
      contentPerformance.set(eventId, {
        eventId,
        title: 'Untitled Content', // Will be updated if we have content data
        coverImage: null, // Will be updated if we have content data
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

  // Try to get content details from localStorage
  try {
    const storedContent = localStorage.getItem('user_content_items')
    if (storedContent) {
      const contentItems = JSON.parse(storedContent)
      
      contentPerformance.forEach((content, eventId) => {
        const contentItem = contentItems.find(item => item.nostrEventId === eventId)
        if (contentItem) {
          content.title = contentItem.title || 'Untitled Content'
          content.coverImage = contentItem.coverImage || null
        }
      })
    }
  } catch (error) {
    console.warn('Failed to load content details from storage:', error)
  }

  // Calculate performance scores
  const contentArray = Array.from(contentPerformance.values())
  contentArray.forEach(content => {
    // Weighted scoring: zaps worth most, then reposts, likes, bookmarks
    content.totalScore = (content.zaps * 10) + (content.reposts * 3) + (content.likes * 1) + (content.bookmarks * 2)
  })

  return contentArray
    .filter(content => content.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3)
})

// Format numbers to be user-friendly
const formatNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

// Generate fallback image for content
const generateContentFallbackImage = () => {
  return '/new_logo3.png' // ZapTracker logo as fallback
}

// Get content title for display
const getContentTitle = (content) => {
  // If we have a proper title (from long-form content), use it
  if (content.title && content.title !== 'Untitled Content') {
    return content.title.length > 40 ? content.title.substring(0, 40) + '...' : content.title
  }
  
  // For notes without titles, try to get the actual note content
  const eventId = content.eventId || content.nostrEventId
  if (eventId) {
    // Look for the note content in our zap data
    const relatedZap = combinedZapData.value.find(zap => zap.eventId === eventId)
    if (relatedZap && relatedZap.note) {
      // Clean up the note content and create a preview
      const noteContent = parseNoteContent(relatedZap.note)
      if (noteContent && noteContent !== 'No note content') {
        // Take first line or first 40 characters, whichever is shorter
        const firstLine = noteContent.split('\n')[0].trim()
        const preview = firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine
        return preview || 'Short note'
      }
    }
  }
  
  // Final fallback
  return 'Short note'
}

// Parse note content to extract meaningful text
const parseNoteContent = (note) => {
  if (typeof note === 'string') {
    // Handle JSON object strings (like Nostr events)
    if (note.startsWith('{') && note.endsWith('}')) {
      try {
        const parsed = JSON.parse(note)
        if (parsed && typeof parsed === 'object') {
          // Handle Nostr events with content
          if (parsed.content) {
            return parsed.content.trim()
          }
          
          // Handle other object types
          if (parsed.description) {
            return parsed.description.trim()
          }
          
          return 'Note content'
        }
      } catch (error) {
        return note.trim()
      }
    }
    // Handle JSON array strings
    else if (note.startsWith('[') && note.endsWith(']')) {
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
  
  if (typeof note === 'object' && note !== null) {
    try {
      return JSON.stringify(note.get('content')).trim()
    } catch (error) {
      return 'Note content'
    }
  }
  
  return String(note || 'Note content').trim()
}

// Extract text from array format notes
const extractTextFromArray = (noteArray) => {
  try {
    const textPlain = noteArray.find(item => Array.isArray(item) && item[0] === 'text/plain')
    if (textPlain && textPlain[1]) {
      return textPlain[1].trim()
    }
    
    const textIdentifier = noteArray.find(item => Array.isArray(item) && item[0] === 'text/identifier')
    if (textIdentifier && textIdentifier[1]) {
      return textIdentifier[1].trim()
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

// Handle view content details in ZapTracker
const viewContentDetails = (content) => {
  // Navigate to content unlock page with the event ID
  const eventId = content.eventId || content.nostrEventId
  if (eventId) {
    changePage('content-unlock', { eventId })
  }
}

// Handle view content details
const viewContentDetails = (content) => {
  // Navigate to content unlock page with the event ID
  const url = `/?page=content-unlock&eventId=${content.eventId}`
  window.open(url, '_blank')
}

// Calculate totals for summary
const totals = computed(() => {
  return bestPerformingContent.value.reduce((acc, content) => ({
    sats: acc.sats + content.zapAmount,
    zaps: acc.zaps + content.zaps,
    engagement: acc.engagement + content.likes + content.reposts + content.bookmarks
  }), { sats: 0, zaps: 0, engagement: 0 })
})
</script>

<template>
  <div v-if="bestPerformingContent.length > 0" class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <!-- Clean Header -->
    <div class="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <IconTrendingUp class="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Top Performing Content</h3>
            <p class="text-sm text-gray-500">Your best content this period</p>
          </div>
        </div>
        
        <!-- Quick Summary -->
        <div class="flex items-center space-x-4 text-sm">
          <div class="text-center">
            <div class="font-bold text-orange-600">{{ formatNumber(totals.sats) }}</div>
            <div class="text-xs text-gray-500">sats</div>
          </div>
          <div class="text-center">
            <div class="font-bold text-gray-900">{{ formatNumber(totals.zaps) }}</div>
            <div class="text-xs text-gray-500">zaps</div>
          </div>
          <div class="text-center">
            <div class="font-bold text-purple-600">{{ formatNumber(totals.engagement) }}</div>
            <div class="text-xs text-gray-500">reactions</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Content List -->
    <div class="divide-y divide-gray-50">
      <div
        v-for="(content, index) in bestPerformingContent"
        :key="content.eventId"
        :class="[
          'px-6 py-5 hover:bg-gray-50 transition-colors group',
          index === bestPerformingContent.length - 1 ? 'rounded-b-xl' : ''
        ]"
      >
        <!-- Content Header with Thumbnail and Title -->
        <div class="flex items-center space-x-4 mb-4">
          <!-- Rank Badge -->
          <div :class="[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
            index === 0 ? 'bg-yellow-100 text-yellow-700' :
            index === 1 ? 'bg-gray-100 text-gray-600' :
            'bg-orange-100 text-orange-600'
          ]">
            {{ index + 1 }}
          </div>
          
          <!-- Content Thumbnail -->
          <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 bg-gray-100">
            <img
              :src="content.coverImage || generateContentFallbackImage()"
              :alt="content.title"
              class="w-full h-full object-cover"
              @error="$event.target.src = generateContentFallbackImage()"
            />
          </div>
          
          <!-- Content Title -->
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-gray-900 text-base truncate">
              {{ getContentTitle(content) }}
            </h4>
          </div>
        </div>
        
        <!-- Metrics and Actions Row -->
        <div class="flex items-center justify-between">
          <!-- Metrics -->
          <div class="flex items-center space-x-3">
            <!-- Zaps (Primary Metric) -->
            <div class="flex items-center space-x-1.5 bg-orange-50 px-3 py-1.5 rounded-full">
              <IconBolt class="w-4 h-4 text-orange-500" />
              <span class="font-semibold text-orange-700">{{ formatNumber(content.zaps) }}</span>
              <span class="text-xs text-orange-600">{{ formatNumber(content.zapAmount) }} sats</span>
            </div>
            
            <!-- Engagement Metrics -->
            <div class="flex items-center space-x-2">
              <span v-if="content.likes > 0" class="flex items-center space-x-1 text-pink-600">
                <IconHeart class="w-3.5 h-3.5" />
                <span class="text-sm font-medium">{{ formatNumber(content.likes) }}</span>
              </span>
              <span v-if="content.reposts > 0" class="flex items-center space-x-1 text-green-600">
                <IconRepeat class="w-3.5 h-3.5" />
                <span class="text-sm font-medium">{{ formatNumber(content.reposts) }}</span>
              </span>
              <span v-if="content.bookmarks > 0" class="flex items-center space-x-1 text-blue-600">
                <IconBookmark class="w-3.5 h-3.5" />
                <span class="text-sm font-medium">{{ formatNumber(content.bookmarks) }}</span>
              </span>
            </div>
          </div>
          
          <!-- View Details Button -->
          <button
            @click="viewContentDetails(content)"
            class="opacity-0 group-hover:opacity-100 flex items-center space-x-2 text-gray-400 hover:text-orange-600 text-sm transition-all duration-200 bg-gray-50 hover:bg-orange-50 px-4 py-2 rounded-lg font-medium"
          >
            <IconEye class="w-4 h-4" />
            <span>View Details</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Clean transitions */
.transition-colors {
  transition: background-color 0.15s ease;
}

.transition-all {
  transition: all 0.2s ease;
}

/* Hover states */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Focus states for accessibility */
button:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Truncate text */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Ensure proper image aspect ratio */
.w-12.h-12 img {
  object-fit: cover;
}

.w-16.h-16 img {
  object-fit: cover;
}
</style>