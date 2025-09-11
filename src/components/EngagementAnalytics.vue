<script setup>
import { computed, inject } from 'vue'
import {
  IconTrendingUp,
  IconUsers,
  IconBolt,
  IconHeart,
  IconRepeat,
  IconBookmark,
  IconTarget,
  IconClock,
  IconStar,
  IconFire
} from '@iconify-prerendered/vue-tabler'
import { useEngagementMetrics } from '../composables/useEngagementMetrics.js'
import { filterZapsByTimeRange } from '../utils/timeFilter.js'

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

// Calculate meaningful engagement analytics
const engagementAnalytics = computed(() => {
  // Get NIP-57 zaps (those with eventId)
  const nip57Zaps = combinedZapData.value.filter(zap => zap.eventId)
  const filteredZaps = filterZapsByTimeRange(nip57Zaps, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) {
    return {
      totalEngagement: 0,
      engagementRate: 0,
      avgEngagementPerPost: 0,
      topPerformingContent: null,
      engagementTrend: 'neutral',
      viralityScore: 0,
      communityHealth: 0
    }
  }

  // Group by content (eventId)
  const contentEngagement = new Map()
  
  filteredZaps.forEach(zap => {
    const eventId = zap.eventId
    if (!contentEngagement.has(eventId)) {
      contentEngagement.set(eventId, {
        eventId,
        zaps: 0,
        zapAmount: 0,
        likes: 0,
        reposts: 0,
        bookmarks: 0,
        totalEngagement: 0
      })
    }
    
    const content = contentEngagement.get(eventId)
    content.zaps += 1
    content.zapAmount += zap.amount
    
    // Get engagement metrics for this content
    const engagement = getEngagementCounts(eventId)
    content.likes = engagement.likes
    content.reposts = engagement.reposts
    content.bookmarks = engagement.bookmarks
    content.totalEngagement = engagement.totalEngagement + content.zaps
  })

  const contentArray = Array.from(contentEngagement.values())
  
  // Calculate analytics
  const totalPosts = contentArray.length
  const totalEngagement = contentArray.reduce((sum, content) => sum + content.totalEngagement, 0)
  const totalZaps = filteredZaps.length
  const totalZapAmount = filteredZaps.reduce((sum, zap) => sum + zap.amount, 0)
  
  // Engagement rate: what percentage of your content gets engagement
  const postsWithEngagement = contentArray.filter(content => content.totalEngagement > 0).length
  const engagementRate = totalPosts > 0 ? Math.round((postsWithEngagement / totalPosts) * 100) : 0
  
  // Average engagement per post
  const avgEngagementPerPost = totalPosts > 0 ? Math.round(totalEngagement / totalPosts) : 0
  
  // Find top performing content
  const topContent = contentArray.sort((a, b) => b.totalEngagement - a.totalEngagement)[0]
  
  // Virality score: reposts + zaps (content that spreads)
  const totalReposts = contentArray.reduce((sum, content) => sum + content.reposts, 0)
  const viralityScore = totalReposts + totalZaps
  
  // Community health: likes + bookmarks (content that resonates)
  const totalLikes = contentArray.reduce((sum, content) => sum + content.likes, 0)
  const totalBookmarks = contentArray.reduce((sum, content) => sum + content.bookmarks, 0)
  const communityHealth = totalLikes + totalBookmarks
  
  // Engagement trend (simplified)
  const engagementTrend = totalEngagement > avgEngagementPerPost * totalPosts ? 'positive' : 
                        totalEngagement < avgEngagementPerPost * totalPosts * 0.5 ? 'negative' : 'neutral'

  return {
    totalEngagement,
    totalPosts,
    engagementRate,
    avgEngagementPerPost,
    topPerformingContent: topContent,
    engagementTrend,
    viralityScore,
    communityHealth,
    totalZaps,
    totalZapAmount,
    totalLikes,
    totalReposts,
    totalBookmarks
  }
})

// Get trend color and icon
const getTrendColor = (trend) => {
  switch (trend) {
    case 'positive': return 'text-green-600 bg-green-100'
    case 'negative': return 'text-red-600 bg-red-100'
    default: return 'text-gray-600 bg-gray-100'
  }
}

const getTrendIcon = (trend) => {
  switch (trend) {
    case 'positive': return IconTrendingUp
    case 'negative': return IconTrendingUp // Same icon, different color
    default: return IconTarget
  }
}
</script>

<template>
  <div v-if="engagementAnalytics.totalEngagement > 0" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
        <IconFire class="w-5 h-5 text-orange-600" />
        <span>Engagement Analytics</span>
      </h3>
      <div :class="[
        'px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1',
        getTrendColor(engagementAnalytics.engagementTrend)
      ]">
        <component :is="getTrendIcon(engagementAnalytics.engagementTrend)" class="w-4 h-4" />
        <span class="capitalize">{{ engagementAnalytics.engagementTrend }}</span>
      </div>
    </div>

    <!-- Key Metrics Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- Engagement Rate -->
      <div class="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
        <div class="text-2xl font-bold text-purple-600 mb-1">{{ engagementAnalytics.engagementRate }}%</div>
        <div class="text-sm text-purple-700 font-medium">Engagement Rate</div>
        <div class="text-xs text-purple-600 mt-1">{{ engagementAnalytics.totalPosts - (engagementAnalytics.totalPosts * engagementAnalytics.engagementRate / 100) }} posts need attention</div>
      </div>

      <!-- Average Engagement -->
      <div class="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
        <div class="text-2xl font-bold text-blue-600 mb-1">{{ formatNumber(engagementAnalytics.avgEngagementPerPost) }}</div>
        <div class="text-sm text-blue-700 font-medium">Avg per Post</div>
        <div class="text-xs text-blue-600 mt-1">{{ engagementAnalytics.totalPosts }} posts analyzed</div>
      </div>

      <!-- Virality Score -->
      <div class="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
        <div class="text-2xl font-bold text-green-600 mb-1">{{ formatNumber(engagementAnalytics.viralityScore) }}</div>
        <div class="text-sm text-green-700 font-medium">Virality Score</div>
        <div class="text-xs text-green-600 mt-1">Reposts + Zaps</div>
      </div>

      <!-- Community Health -->
      <div class="text-center p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
        <div class="text-2xl font-bold text-orange-600 mb-1">{{ formatNumber(engagementAnalytics.communityHealth) }}</div>
        <div class="text-sm text-orange-700 font-medium">Community Health</div>
        <div class="text-xs text-orange-600 mt-1">Likes + Saves</div>
      </div>
    </div>

    <!-- Engagement Breakdown -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <!-- Zaps (Most Important) -->
      <div class="bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg p-3 text-center">
        <div class="flex items-center justify-center space-x-1 mb-1">
          <IconBolt class="w-4 h-4 text-orange-600" />
          <span class="font-bold text-orange-700">{{ formatNumber(engagementAnalytics.totalZaps) }}</span>
        </div>
        <div class="text-xs text-orange-600 font-medium">Zaps</div>
        <div class="text-xs text-orange-500">{{ formatNumber(engagementAnalytics.totalZapAmount) }} sats</div>
      </div>

      <!-- Likes -->
      <div class="bg-gradient-to-r from-pink-100 to-rose-100 rounded-lg p-3 text-center">
        <div class="flex items-center justify-center space-x-1 mb-1">
          <IconHeart class="w-4 h-4 text-pink-600" />
          <span class="font-bold text-pink-700">{{ formatNumber(engagementAnalytics.totalLikes) }}</span>
        </div>
        <div class="text-xs text-pink-600 font-medium">Likes</div>
      </div>

      <!-- Reposts -->
      <div class="bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-3 text-center">
        <div class="flex items-center justify-center space-x-1 mb-1">
          <IconRepeat class="w-4 h-4 text-green-600" />
          <span class="font-bold text-green-700">{{ formatNumber(engagementAnalytics.totalReposts) }}</span>
        </div>
        <div class="text-xs text-green-600 font-medium">Reposts</div>
      </div>

      <!-- Bookmarks -->
      <div class="bg-gradient-to-r from-blue-100 to-cyan-100 rounded-lg p-3 text-center">
        <div class="flex items-center justify-center space-x-1 mb-1">
          <IconBookmark class="w-4 h-4 text-blue-600" />
          <span class="font-bold text-blue-700">{{ formatNumber(engagementAnalytics.totalBookmarks) }}</span>
        </div>
        <div class="text-xs text-blue-600 font-medium">Saves</div>
      </div>
    </div>

    <!-- Top Performing Content Insight -->
    <div v-if="engagementAnalytics.topPerformingContent" class="mt-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
      <div class="flex items-center space-x-2 mb-1">
        <IconStar class="w-4 h-4 text-yellow-600" />
        <span class="text-sm font-medium text-yellow-800">Top Performer</span>
      </div>
      <div class="text-xs text-yellow-700">
        Your best content got {{ formatNumber(engagementAnalytics.topPerformingContent.totalEngagement) }} total interactions
        ({{ formatNumber(engagementAnalytics.topPerformingContent.zaps) }} zaps, {{ formatNumber(engagementAnalytics.topPerformingContent.likes) }} likes)
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

/* Responsive grid adjustments */
@media (max-width: 640px) {
  .grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 640px) {
  .sm\:grid-cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* Gradient backgrounds for better visual appeal */
.bg-gradient-to-r {
  background-image: linear-gradient(to right, var(--tw-gradient-stops));
}

.bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, var(--tw-gradient-stops));
}
</style>