<script setup>
import { computed, inject } from 'vue'
import { useBtcPrice } from '../composables/useBtcPrice.js'

const zapData = inject('zapData')
const selectedTimeRange = inject('selectedTimeRange')

// Use BTC price composable
const { satsToUSD, formatUSD } = useBtcPrice()

const stats = computed(() => {
  const zaps = zapData.value
  const now = new Date()
  let filteredZaps = []
  
  // Filter by time range
  switch (selectedTimeRange.value) {
    case '24h':
      filteredZaps = zaps.filter(zap => 
        new Date(zap.timestamp) > new Date(now - 24 * 60 * 60 * 1000)
      )
      break
    case '7d':
      filteredZaps = zaps.filter(zap => 
        new Date(zap.timestamp) > new Date(now - 7 * 24 * 60 * 60 * 1000)
      )
      break
    case '30d':
      filteredZaps = zaps.filter(zap => 
        new Date(zap.timestamp) > new Date(now - 30 * 24 * 60 * 60 * 1000)
      )
      break
    default:
      filteredZaps = zaps
  }
  
  const totalSats = filteredZaps.reduce((sum, zap) => sum + zap.amount, 0)
  const totalUSD = satsToUSD(totalSats)
  const avgZap = filteredZaps.length > 0 ? totalSats / filteredZaps.length : 0
  
  return {
    totalSats,
    totalUSD,
    totalUSD,
    totalZaps: filteredZaps.length,
    avgZap: Math.round(avgZap),
    topSupporter: filteredZaps.length > 0 ? 'anonymous' : 'N/A'
  }
})
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Total Sats -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600 mb-1">Total Sats</p>
          <p class="text-2xl font-bold text-orange-600">
            {{ stats.totalSats.toLocaleString() }}
          </p>
          <p class="text-xs text-gray-500">
            ≈ {{ formatUSD(stats.totalUSD) }}
          </p>
        </div>
        <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
          <span class="text-xl">⚡</span>
        </div>
      </div>
    </div>
    
    <!-- Total Zaps -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600 mb-1">Total Zaps</p>
          <p class="text-2xl font-bold text-orange-600">{{ stats.totalZaps }}</p>
          <p class="text-xs text-gray-500">
            {{ selectedTimeRange === '24h' ? 'Last 24h' : 
                selectedTimeRange === '7d' ? 'Last 7 days' : 
                selectedTimeRange === '30d' ? 'Last 30 days' : 'All time' }}
          </p>
        </div>
        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
          <span class="text-xl">🎯</span>
        </div>
      </div>
    </div>
    
    <!-- Average Zap -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600 mb-1">Average Zap</p>
          <p class="text-2xl font-bold text-orange-600">{{ stats.avgZap }}</p>
          <p class="text-xs text-gray-500">sats per zap</p>
        </div>
        <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
          <span class="text-xl">📊</span>
        </div>
      </div>
    </div>
    
    <!-- Top Supporter -->
    <div class="stat-card">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600 mb-1">Top Supporter</p>
          <p class="text-lg font-bold text-orange-600 truncate">{{ stats.topSupporter }}</p>
          <p class="text-xs text-gray-500">most generous</p>
        </div>
        <div class="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
          <span class="text-xl">👑</span>
        </div>
      </div>
    </div>
  </div>
</template>