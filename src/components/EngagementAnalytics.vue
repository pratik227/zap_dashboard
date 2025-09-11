<script setup>
import { computed, inject } from 'vue'
import {
  IconTrendingUp,
  IconBolt,
  IconHeart,
  IconRepeat,
  IconBookmark,
  IconStar,
  IconExternalLink
} from '@iconify-prerendered/vue-tabler'
import { useEngagementMetrics } from '../composables/useEngagementMetrics.js'
import { filterZapsByTimeRange } from '../utils/timeFilter.js'
import * as nip19 from 'nostr-tools/nip19'

const combinedZapData = inject('combinedZapData')
const selectedTimeRange = inject('selectedTimeRange')

const { getEngagementCounts } = useEngagementMetrics()

// Format numbers to user-friendly format
const formatNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

// Find best performing content with real engagement data
const bestPerformingContent = computed(() => {
  // Get NIP-57 zaps (those with eventId)
  const nip57Zaps = combinedZapData.value.filter(zap => zap.eventId)
  const filteredZaps = filterZapsByTimeRange(nip57Zaps, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) {
    return []
  }

  // Group by content (eventId) and calculate performance scores
  const contentPerformance = new Map()
  
  filteredZaps.forEach(zap => {
    const eventId = zap.eventId
    if (!contentPerformance.has(eventId)) {
      const engagement = getEngagementCounts(eventId)
      contentPerformance.set(eventId, {
        eventId,
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

  // Calculate performance scores and sort
  const contentArray = Array.from(contentPerformance.values())
  
  contentArray.forEach(content => {
    // Simple scoring: zaps are worth more since they're monetary
    content.totalScore = (content.zaps * 10) + (content.likes * 2) + (content.reposts * 5) + content.bookmarks
  })

  return contentArray
    .filter(content => content.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 3) // Top 3 performing content
})

// Get Nostr client URL for content
const getNostrClientUrl = (eventId) => {
  try {
    return `https://primal.net/e/${eventId}`
  } catch (error) {
    return '#'
  }
}
</script>

<template>
  <div v-if="bestPerformingContent.length > 0" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
        <IconTrendingUp class="w-5 h-5 text-orange-600" />
        <span>Best Performing Content</span>
      </h3>
      <div class="text-sm text-gray-500">
        Top {{ bestPerformingContent.length }} posts
      </div>
    </div>

    <!-- Top Performing Content List -->
    <div class="space-y-4">
      <div
        v-for="(content, index) in bestPerformingContent"
        :key="content.eventId"
        class="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
      >
        <div class="flex items-center justify-between">
          <!-- Rank and Performance -->
          <div class="flex items-center space-x-4">
            <!-- Rank Badge -->
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
              index === 0 ? 'bg-yellow-100 text-yellow-700' :
              index === 1 ? 'bg-gray-100 text-gray-700' :
              'bg-orange-100 text-orange-700'
            ]">
              {{ index + 1 }}
            </div>
            
            <!-- Performance Metrics -->
            <div>
              <div class="flex items-center space-x-3 mb-1">
                <!-- Zaps (Most Important) -->
                <div class="flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1 rounded-full">
                  <IconBolt class="w-4 h-4 text-orange-600" />
                  <span class="font-bold text-orange-700">{{ formatNumber(content.zaps) }}</span>
                  <span class="text-xs text-orange-600">zaps</span>
                </div>
                
                <!-- Engagement Breakdown -->
                <div class="flex items-center space-x-2 text-sm">
                  <span v-if="content.likes > 0" class="flex items-center space-x-1 text-pink-600">
                    <IconHeart class="w-3 h-3" />
                    <span>{{ formatNumber(content.likes) }}</span>
                  </span>
                  <span v-if="content.reposts > 0" class="flex items-center space-x-1 text-green-600">
                    <IconRepeat class="w-3 h-3" />
                    <span>{{ formatNumber(content.reposts) }}</span>
                  </span>
                  <span v-if="content.bookmarks > 0" class="flex items-center space-x-1 text-blue-600">
                    <IconBookmark class="w-3 h-3" />
                    <span>{{ formatNumber(content.bookmarks) }}</span>
                  </span>
                </div>
              </div>
              
              <!-- Revenue -->
              <div class="text-sm text-gray-600">
                <span class="font-medium text-orange-600">{{ formatNumber(content.zapAmount) }} sats earned</span>
              </div>
            </div>
          </div>
          
          <!-- View Content Link -->
          <a
            :href="getNostrClientUrl(content.eventId)"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
          >
            <span>View</span>
            <IconExternalLink class="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>

    <!-- Quick Summary -->
    <div class="mt-6 pt-4 border-t border-gray-200">
      <div class="grid grid-cols-3 gap-4 text-center">
        <div>
          <div class="text-lg font-bold text-orange-600">
            {{ formatNumber(bestPerformingContent.reduce((sum, c) => sum + c.zapAmount, 0)) }}
          </div>
          <div class="text-xs text-gray-600">Total Sats</div>
        </div>
        <div>
          <div class="text-lg font-bold text-gray-900">
            {{ formatNumber(bestPerformingContent.reduce((sum, c) => sum + c.zaps, 0)) }}
          </div>
          <div class="text-xs text-gray-600">Total Zaps</div>
        </div>
        <div>
          <div class="text-lg font-bold text-purple-600">
            {{ formatNumber(bestPerformingContent.reduce((sum, c) => sum + c.likes + c.reposts + c.bookmarks, 0)) }}
          </div>
          <div class="text-xs text-gray-600">Engagement</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth transitions for all elements */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Hover effects for interactive elements */
.hover\:shadow-md:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Focus states for accessibility */
a:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}
</style>