<script setup>
import { computed } from 'vue'
import { useBtcPrice } from '../composables/useBtcPrice.js'
import { 
  IconCurrencyBitcoin, 
  IconLock, 
  IconFileText, 
  IconEye,
  IconUsers,
  IconTrendingUp 
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  stats: {
    type: Object,
    required: true
  }
})

// Use BTC price composable
const { satsToUSD, formatUSD } = useBtcPrice()

const revenueInUSD = computed(() => {
  return formatUSD(satsToUSD(props.stats.totalRevenue))
})
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
    <!-- Total Revenue -->
    <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-4 sm:p-6 rounded-xl shadow-lg">
      <div class="flex items-center justify-between mb-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center">
          <IconCurrencyBitcoin class="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <span class="text-xs sm:text-sm font-medium opacity-90">
          ≈ {{ revenueInUSD }} USD
        </span>
      </div>
      <div>
        <p class="text-sm opacity-90 mb-1">Total Revenue</p>
        <p class="text-2xl sm:text-3xl font-bold">{{ stats.totalRevenue.toLocaleString() }} sats</p>
      </div>
    </div>

    <!-- Published Items -->
    <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
      <div class="flex items-center justify-between mb-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg flex items-center justify-center">
          <IconFileText class="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
        </div>
        <span class="text-xs sm:text-sm font-medium text-green-500">
          Live content
        </span>
      </div>
      <div>
        <p class="text-sm text-gray-600 mb-1">Published Items</p>
        <p class="text-2xl sm:text-3xl font-bold text-gray-900">{{ stats.published }}</p>
      </div>
    </div>

    
    <!-- Total Blog Posts -->
    <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
      <div class="flex items-center justify-between mb-4">
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
          <IconFileText class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        </div>
        <span class="text-xs sm:text-sm font-medium text-blue-500">
          All content
        </span>
      </div>
      <div>
        <p class="text-sm text-gray-600 mb-1">Total Posts</p>
        <p class="text-2xl sm:text-3xl font-bold text-gray-900">{{ stats.published + stats.drafts }}</p>
      </div>
    </div>
  </div>
</template>
