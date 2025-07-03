<script setup>
import { computed, inject, ref, onMounted, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { IconBolt, IconCurrencyBitcoin, IconUsers, IconChartLine } from '@iconify-prerendered/vue-tabler'
import { getNWCClient, getBalance, getWalletInfo } from '../utils/nwcClient.js'

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent
])

const zapData = inject('zapData')
const selectedTimeRange = inject('selectedTimeRange')

// Real-time wallet data
const walletBalance = ref(0)
const walletInfo = ref(null)
const isLoading = ref(false)

// Fetch real wallet data
async function fetchWalletData() {
  const client = getNWCClient()
  if (!client) return

  isLoading.value = true
  try {
    const [balance, info] = await Promise.all([
      getBalance(),
      getWalletInfo()
    ])
    
    if (balance) {
      walletBalance.value = Math.floor(balance.balance / 1000) // Convert msats to sats
    }
    
    if (info) {
      walletInfo.value = info
    }
  } catch (error) {
    console.error('Failed to fetch wallet data:', error)
  } finally {
    isLoading.value = false
  }
}

// Watch for zapData changes to refresh wallet data
watch(() => zapData.value.length, (newLength) => {
  if (newLength > 0) {
    fetchWalletData()
  }
}, { immediate: true })

onMounted(() => {
  fetchWalletData()
})

// Dynamic stats based on real data
const stats = computed(() => {
  const zaps = zapData.value
  const totalSats = zaps.reduce((sum, zap) => sum + zap.amount, 0)
  const totalUSD = totalSats * 0.0003
  const avgZap = zaps.length > 0 ? totalSats / zaps.length : 0
  
  // Get unique supporters
  const uniqueSupporters = new Set(zaps.map(zap => zap.sender.pubkey)).size
  
  return {
    totalZaps: zaps.length,
    totalSats,
    totalUSD,
    avgZap: Math.round(avgZap),
    uniqueSupporters,
    walletBalance: walletBalance.value
  }
})

// Dynamic chart data based on real zap timestamps
const chartOption = computed(() => {
  const zaps = zapData.value
  
  if (zaps.length === 0) {
    // Show empty chart with sample data
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return {
        date: date.getDate(),
        value: 0
      }
    })
    
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#fb923c',
        textStyle: { color: '#374151' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: last30Days.map(d => d.date),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 12 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 12 },
        splitLine: { lineStyle: { color: '#f3f4f6' } }
      },
      series: [{
        data: last30Days.map(d => d.value),
        type: 'line',
        smooth: true,
        lineStyle: { color: '#fb923c', width: 3 },
        itemStyle: { color: '#fb923c' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(251, 146, 60, 0.3)' },
              { offset: 1, color: 'rgba(251, 146, 60, 0.05)' }
            ]
          }
        }
      }]
    }
  }
  
  // Group zaps by day for the last 30 days
  const last30Days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (29 - i))
    return {
      date: date.getDate(),
      fullDate: date.toDateString(),
      value: 0
    }
  })
  
  // Count zaps per day
  zaps.forEach(zap => {
    const zapDate = new Date(zap.timestamp).toDateString()
    const dayData = last30Days.find(day => day.fullDate === zapDate)
    if (dayData) {
      dayData.value += zap.amount
    }
  })
  
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#fb923c',
      textStyle: { color: '#374151' },
      formatter: function(params) {
        const data = params[0]
        return `${data.name}: ${data.value} sats`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: last30Days.map(d => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#9ca3af', fontSize: 12 },
      splitLine: { lineStyle: { color: '#f3f4f6' } }
    },
    series: [{
      data: last30Days.map(d => d.value),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#fb923c', width: 3 },
      itemStyle: { color: '#fb923c' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(251, 146, 60, 0.3)' },
            { offset: 1, color: 'rgba(251, 146, 60, 0.05)' }
          ]
        }
      }
    }]
  }
})

// Recent zaps from real data
const recentZaps = computed(() => {
  return zapData.value
    .slice(0, 5)
    .map(zap => ({
      ...zap,
      timeAgo: formatTimeAgo(zap.timestamp)
    }))
})

const formatTimeAgo = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Calculate percentage changes (mock for now, could be enhanced with historical data)
const getPercentageChange = (current, type) => {
  // Mock percentage changes - in a real app, you'd compare with historical data
  const changes = {
    zaps: 12.5,
    sats: 8.2,
    supporters: 3.1,
    avg: -2.1
  }
  return changes[type] || 0
}
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Welcome Banner -->
    <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white p-4 sm:p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold mb-2 flex items-center space-x-2">
            <IconBolt class="w-6 h-6" />
            <span>{{ zapData.length > 0 ? 'Welcome back, Creator!' : 'Connect your wallet to get started!' }}</span>
          </h1>
          <p class="text-orange-50 text-sm sm:text-base">
            <span v-if="zapData.length > 0">
              You've received {{ stats.totalZaps }} zaps worth {{ stats.totalSats.toLocaleString() }} sats
            </span>
            <span v-else>
              Connect your Lightning wallet to view your real zap data and earnings
            </span>
          </p>
        </div>
        <div v-if="isLoading" class="flex items-center space-x-2">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          <span class="text-sm">Loading...</span>
        </div>
      </div>
    </div>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      <!-- Total Zaps -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
            <IconBolt class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          </div>
          <span :class="[
            'text-xs sm:text-sm font-medium',
            getPercentageChange(stats.totalZaps, 'zaps') >= 0 ? 'text-green-500' : 'text-red-500'
          ]">
            {{ getPercentageChange(stats.totalZaps, 'zaps') >= 0 ? '+' : '' }}{{ getPercentageChange(stats.totalZaps, 'zaps') }}%
          </span>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ stats.totalZaps.toLocaleString() }}</p>
          <p class="text-gray-500 text-sm">Total Zaps</p>
        </div>
      </div>

      <!-- Total Sats -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-lg flex items-center justify-center">
            <IconCurrencyBitcoin class="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <span :class="[
            'text-xs sm:text-sm font-medium',
            getPercentageChange(stats.totalSats, 'sats') >= 0 ? 'text-green-500' : 'text-red-500'
          ]">
            {{ getPercentageChange(stats.totalSats, 'sats') >= 0 ? '+' : '' }}{{ getPercentageChange(stats.totalSats, 'sats') }}%
          </span>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ stats.totalSats.toLocaleString() }}</p>
          <p class="text-gray-500 text-sm">Total Sats (~${{ stats.totalUSD.toFixed(2) }})</p>
        </div>
      </div>

      <!-- Unique Supporters -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg flex items-center justify-center">
            <IconUsers class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          </div>
          <span :class="[
            'text-xs sm:text-sm font-medium',
            getPercentageChange(stats.uniqueSupporters, 'supporters') >= 0 ? 'text-green-500' : 'text-red-500'
          ]">
            {{ getPercentageChange(stats.uniqueSupporters, 'supporters') >= 0 ? '+' : '' }}{{ getPercentageChange(stats.uniqueSupporters, 'supporters') }}%
          </span>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ stats.uniqueSupporters.toLocaleString() }}</p>
          <p class="text-gray-500 text-sm">Unique Supporters</p>
        </div>
      </div>

      <!-- Average Zap -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg flex items-center justify-center">
            <IconChartLine class="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <span :class="[
            'text-xs sm:text-sm font-medium',
            getPercentageChange(stats.avgZap, 'avg') >= 0 ? 'text-green-500' : 'text-red-500'
          ]">
            {{ getPercentageChange(stats.avgZap, 'avg') >= 0 ? '+' : '' }}{{ getPercentageChange(stats.avgZap, 'avg') }}%
          </span>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ stats.avgZap.toLocaleString() }}</p>
          <p class="text-gray-500 text-sm">Average Zap</p>
        </div>
      </div>
    </div>

    <!-- Chart and Recent Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <!-- Zaps Chart -->
      <div class="lg:col-span-2 bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-2 sm:mb-0 flex items-center space-x-2">
            <IconChartLine class="w-5 h-5 text-orange-600" />
            <span>Zaps Over Time</span>
          </h3>
          <div class="text-sm text-gray-500">Last 30 days</div>
        </div>
        <div class="h-64 sm:h-80">
          <VChart :option="chartOption" class="w-full h-full" />
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <IconBolt class="w-5 h-5 text-orange-600" />
          <span>Recent Zaps</span>
        </h3>
        <div v-if="recentZaps.length === 0" class="text-center py-8">
          <div class="text-gray-400 text-4xl mb-2">
            <IconBolt class="w-12 h-12 mx-auto" />
          </div>
          <p class="text-gray-500 text-sm">No zaps yet</p>
          <p class="text-gray-400 text-xs mt-1">Connect your wallet to see activity</p>
        </div>
        <div v-else class="space-y-4">
          <div v-for="zap in recentZaps" :key="zap.id" class="flex items-center space-x-3 p-3 bg-orange-50/50 rounded-lg">
            <div class="w-8 h-8 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full flex items-center justify-center overflow-hidden">
              <img 
                :src="zap.sender.avatar" 
                :alt="zap.sender.name || 'Anonymous'"
                class="w-full h-full rounded-full object-cover"
                @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
              />
              <IconBolt class="w-4 h-4 text-white" style="display: none;" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">
                {{ zap.sender.name || 'Anonymous' }}
              </p>
              <p class="text-xs text-gray-500">{{ zap.timeAgo }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-orange-600">{{ zap.amount }} sats</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Wallet Balance Card -->
    <div v-if="walletBalance > 0" class="bg-gradient-to-r from-green-400 to-emerald-500 text-white p-4 sm:p-6 rounded-xl shadow-lg">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold mb-1 flex items-center space-x-2">
            <IconBolt class="w-5 h-5" />
            <span>Wallet Balance</span>
          </h3>
          <p class="text-green-100 text-sm">Available in your connected wallet</p>
        </div>
        <div class="text-right">
          <p class="text-2xl sm:text-3xl font-bold">{{ walletBalance.toLocaleString() }}</p>
          <p class="text-green-100 text-sm">sats</p>
        </div>
      </div>
    </div>
  </div>
</template>