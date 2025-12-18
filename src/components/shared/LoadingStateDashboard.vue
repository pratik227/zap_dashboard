<script setup>
import { IconBolt, IconCurrencyBitcoin, IconUsers, IconChartLine } from '@iconify-prerendered/vue-tabler'
</script>

<template>
  <div class="space-y-4 sm:space-y-6 animate-pulse">
    <!-- Loading Banner -->
    <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 p-4 sm:p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex-1">
          <div class="h-7 bg-white/30 rounded w-64 mb-3"></div>
          <div class="h-5 bg-white/20 rounded w-96 max-w-full"></div>
        </div>
        <div class="flex items-center space-x-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          <span class="text-white text-sm">Loading your data...</span>
        </div>
      </div>
    </div>

    <!-- Loading Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <!-- Total Zaps Skeleton -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
            <IconBolt class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 opacity-50" />
          </div>
          <div class="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
        <div>
          <div class="h-8 bg-gray-200 rounded w-24 mb-2"></div>
          <div class="h-4 bg-gray-100 rounded w-20"></div>
        </div>
      </div>

      <!-- Total Sats Skeleton -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-lg flex items-center justify-center">
            <IconCurrencyBitcoin class="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 opacity-50" />
          </div>
          <div class="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
        <div>
          <div class="h-8 bg-gray-200 rounded w-32 mb-2"></div>
          <div class="h-4 bg-gray-100 rounded w-24"></div>
        </div>
      </div>

      <!-- Unique Supporters Skeleton -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg flex items-center justify-center">
            <IconUsers class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 opacity-50" />
          </div>
          <div class="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
        <div>
          <div class="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div class="h-4 bg-gray-100 rounded w-32"></div>
        </div>
      </div>

      <!-- Average Zap Skeleton -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg flex items-center justify-center">
            <IconChartLine class="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 opacity-50" />
          </div>
          <div class="h-6 w-16 bg-gray-200 rounded-full"></div>
        </div>
        <div>
          <div class="h-8 bg-gray-200 rounded w-24 mb-2"></div>
          <div class="h-4 bg-gray-100 rounded w-20"></div>
        </div>
      </div>
    </div>

    <!-- Loading Chart and Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- Chart Skeleton -->
      <div class="lg:col-span-2 bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div class="h-6 bg-gray-200 rounded w-40 mb-2 sm:mb-0"></div>
          <div class="h-4 bg-gray-100 rounded w-24"></div>
        </div>
        <div class="h-64 sm:h-80 bg-gray-100 rounded-lg flex items-center justify-center">
          <div class="text-center">
            <IconChartLine class="w-16 h-16 text-gray-300 mx-auto mb-3 animate-pulse" />
            <p class="text-gray-400 text-sm">Loading chart...</p>
          </div>
        </div>
      </div>

      <!-- Recent Activity Skeleton -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="h-6 bg-gray-200 rounded w-32 mb-4"></div>
        <div class="space-y-4">
          <div v-for="i in 5" :key="i" class="flex items-center space-x-3 p-3 bg-orange-50/50 rounded-lg">
            <div class="w-8 h-8 bg-gray-200 rounded-full"></div>
            <div class="flex-1">
              <div class="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div class="h-3 bg-gray-100 rounded w-16"></div>
            </div>
            <div class="text-right">
              <div class="h-4 bg-gray-200 rounded w-16 mb-2"></div>
              <div class="h-3 bg-gray-100 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
