<script setup>
import { computed, inject, ref, onMounted, watch, defineEmits } from 'vue'

const emit = defineEmits(['trigger-login', 'change-page'])
import { IconBolt, IconCurrencyBitcoin, IconUsers, IconChartLine, IconAlertCircle, IconArrowRight } from '@iconify-prerendered/vue-tabler'
import { getNWCClient, getBalance, getWalletInfo } from '../utils/wallet/nwcClient.js'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useBtcPrice } from '../composables/core/useBtcPrice.js'
import { filterZapsByTimeRange, getTimeRangeDisplayText, getShortTimeRangeText, getPeriodComparison } from '../utils/core/timeFilter.js'
import EmptyStateDashboard from '../components/shared/EmptyStateDashboard.vue'
import LoadingStateDashboard from '../components/shared/LoadingStateDashboard.vue'
import LightningNetworkDashboard from '../components/zaps/LightningNetworkDashboard.vue'
import { calculateSmartYAxisRange, applySplitAxisTransformation } from '../utils/chart/chartScaling.js'

const currentPage = inject('currentPage')

// Lazy load ECharts to prevent issues
const VChart = ref(null)
const echartsError = ref(null)
const isEchartsLoaded = ref(false)

onMounted(async () => {
  try {
    const { use } = await import('echarts/core')
    const { CanvasRenderer } = await import('echarts/renderers')
    const { LineChart } = await import('echarts/charts')
    const {
      TitleComponent,
      TooltipComponent,
      GridComponent
    } = await import('echarts/components')
    const { default: VChartComponent } = await import('vue-echarts')
    
    use([
      CanvasRenderer,
      LineChart,
      TitleComponent,
      TooltipComponent,
      GridComponent
    ])
    
    VChart.value = VChartComponent
    isEchartsLoaded.value = true
  } catch (error) {
    console.error('Failed to load ECharts:', error)
    echartsError.value = error.message
  }
})

const zapData = inject('zapData')
const combinedZapData = inject('combinedZapData')
const selectedTimeRange = inject('selectedTimeRange')
const isWalletConnected = inject('isWalletConnected')
const isAuthenticated = inject('isAuthenticated')

// Use Nostr authentication to get user profile
const { userProfile } = useNostrAuth()

// Use BTC price composable
const { btcPriceUSD, satsToUSD, formatUSD } = useBtcPrice()

// Real-time wallet data
const walletBalance = ref(0)
const walletInfo = ref(null)
const isLoading = ref(false)

// Computed property for personalized welcome message
const welcomeMessage = computed(() => {
  if (isAuthenticated.value && userProfile.value?.name) {
    return `Welcome back, ${userProfile.value.name}!`
  }
  return 'Welcome back, Creator!'
})

// Computed properties for connection-aware messaging
const connectionStatus = computed(() => {
  const hasNWC = isWalletConnected.value
  const hasNostr = isAuthenticated.value
  
  if (hasNWC && hasNostr) {
    return {
      type: 'both',
      title: 'Full Setup Complete!',
      description: 'Both your NWC wallet and Nostr account are connected',
      dataTypes: 'NWC payments + Nostr zaps'
    }
  } else if (hasNostr) {
    return {
      type: 'nostr-only',
      title: 'Nostr Connected',
      description: 'Connect your Lightning wallet via NWC to view payment history in the Wallet tab',
      dataTypes: 'Nostr zaps only'
    }
  } else if (hasNWC) {
    return {
      type: 'nwc-only', 
      title: 'Wallet Connected',
      description: 'Connect your Nostr account to see social zap data too',
      dataTypes: 'NWC payments only'
    }
  } else {
    return {
      type: 'none',
      title: 'Connect to Get Started',
      description: 'Connect your NWC wallet and/or Nostr account to view your data',
      dataTypes: 'No data available'
    }
  }
})

const noDataMessage = computed(() => {
  const status = connectionStatus.value
  
  if (status.type === 'none') {
    return 'Connect your wallet or Nostr account to see activity'
  } else if (status.type === 'nwc-only') {
    return 'No NWC payments yet. Try making a payment or connect your Nostr account for more data.'
  } else if (status.type === 'nostr-only') {
    return 'No Nostr zaps yet. Try receiving some zaps or connect your NWC wallet for more data.'
  } else {
    return 'No activity yet. Try receiving some zaps or making payments.'
  }
})

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

// Dynamic stats based on real data with 30-day comparison
const stats = computed(() => {
  console.log('🔍 Computing stats with real data...')
  const allZaps = combinedZapData.value
  
  // Determine which data to use based on connection status
  let zapsToAnalyze = []
  if (isWalletConnected.value && isAuthenticated.value) {
    // Both connected: use all data (NWC + NIP-57)
    zapsToAnalyze = allZaps
  } else if (isAuthenticated.value) {
    // Only Nostr connected: use only Nostr zaps (those with source: 'nip57')
    zapsToAnalyze = allZaps.filter(zap => zap.source === 'nip57')
  } else if (isWalletConnected.value) {
    // Only NWC connected: use only NWC payments (those with source: 'nwc')
    zapsToAnalyze = allZaps.filter(zap => zap.source === 'nwc')
  } else {
    // No connections
    zapsToAnalyze = []
  }
  
  if (zapsToAnalyze.length === 0) {
    return {
      totalZaps: 0,
      totalSats: 0,
      uniqueSupporters: 0,
      avgZap: 0,
      totalUSD: 0,
      walletBalance: walletBalance.value,
      changes: {
        totalZaps: { percentage: 0, trend: 'neutral', isNew: false },
        totalSats: { percentage: 0, trend: 'neutral', isNew: false },
        uniqueSupporters: { percentage: 0, trend: 'neutral', isNew: false },
        avgZap: { percentage: 0, trend: 'neutral', isNew: false }
      }
    }
  }
  
  // Get period comparison for 30 days (fixed period like the chart)
  const comparison = getPeriodComparison(zapsToAnalyze, '30d')
  console.log('📈 Period comparison result:', comparison)
  
  return {
    totalZaps: comparison.current.totalZaps,
    totalSats: comparison.current.totalSats,
    uniqueSupporters: comparison.current.uniqueSupporters,
    avgZap: comparison.current.avgZap,
    totalUSD: satsToUSD(comparison.current.totalSats),
    walletBalance: walletBalance.value,
    changes: comparison.changes
  }
})

// Dynamic chart data based on real zap timestamps
const chartOption = computed(() => {
  const allZaps = combinedZapData.value
  
  // Determine which data to use based on connection status (same logic as stats)
  let zapsToChart = []
  if (isWalletConnected.value && isAuthenticated.value) {
    // Both connected: use all data (NWC + NIP-57)
    zapsToChart = allZaps
  } else if (isAuthenticated.value) {
    // Only Nostr connected: use only NIP-57 zaps
    zapsToChart = allZaps.filter(zap => zap.eventId)
  } else if (isWalletConnected.value) {
    // Only NWC connected: use only NWC payments
    zapsToChart = allZaps.filter(zap => !zap.eventId)
  } else {
    // No connections
    zapsToChart = []
  }
  
  const filteredZaps = filterZapsByTimeRange(zapsToChart, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) {
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
      label: `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`,
      fullDate: date.toDateString(),
      value: 0
    }
  })

  // Count zaps per day from filtered data
  filteredZaps.forEach(zap => {
    const zapDate = new Date(zap.timestamp).toDateString()
    const dayData = last30Days.find(day => day.fullDate === zapDate)
    if (dayData) {
      dayData.value += zap.amount
    }
  })

  // Calculate smart Y-axis range with split-axis detection
  const scalingResult = calculateSmartYAxisRange(last30Days)

  // Base chart configuration
  const baseConfig = {
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

  // Apply split-axis transformation while keeping original styling
  return applySplitAxisTransformation(baseConfig, scalingResult)
})

// Recent zaps from real data - NOW FILTERED BY TIME RANGE
const recentZaps = computed(() => {
  const allZaps = combinedZapData.value
  
  // Determine which data to use based on connection status (same logic as stats)
  let zapsToShow = []
  if (isWalletConnected.value && isAuthenticated.value) {
    // Both connected: use all data (NWC + NIP-57)
    zapsToShow = allZaps
  } else if (isAuthenticated.value) {
    // Only Nostr connected: use only NIP-57 zaps
    zapsToShow = allZaps.filter(zap => zap.eventId)
  } else if (isWalletConnected.value) {
    // Only NWC connected: use only NWC payments
    zapsToShow = allZaps.filter(zap => !zap.eventId)
  } else {
    // No connections
    zapsToShow = []
  }
  
  const filteredZaps = filterZapsByTimeRange(zapsToShow, selectedTimeRange.value)
  
  return filteredZaps
    .slice(0, 5) // Take only the first 5 after filtering
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

// Get percentage change data for a specific metric
const getPercentageChange = (metricType) => {
  console.log(`🔍 Getting percentage change for ${metricType}:`, stats.value.changes[metricType])
  const change = stats.value.changes[metricType]
  
  if (!change) {
    console.warn(`No change data found for metric: ${metricType}`)
    return { percentage: 0, trend: 'neutral', isNew: false }
  }
  
  return change
}

// Format percentage change for display
const formatPercentageChange = (change) => {
  if (change.percentage === 0) {
    return '0%'
  }
  
  const sign = change.percentage > 0 ? '+' : ''
  return `${sign}${change.percentage}%`
}

// Get trend color class for percentage changes
const getTrendColorClass = (change) => {
  switch (change.trend) {
    case 'positive':
      return 'text-green-500 bg-green-50 border-green-200'
    case 'negative':
      return 'text-red-500 bg-red-50 border-red-200'
    default:
      return 'text-gray-500 bg-gray-50 border-gray-200'
  }
}
</script>

<template>
  <!-- Lightning Network Explorer - Accessible when logged in or not -->
  <LightningNetworkDashboard
    v-if="currentPage === 'lightning-explorer' || !isAuthenticated"
    @trigger-login="$emit('trigger-login')"
    @show-help="$emit('show-help')"
    :hideAuthPrompts="isAuthenticated"
  />

  <!-- Loading State (User Dashboard Only) -->
  <LoadingStateDashboard v-else-if="isLoading" />

  <!-- Dashboard with Data -->
  <div v-else class="space-y-4 sm:space-y-6">
    <!-- Welcome Banner -->
    <div class="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 text-white p-4 sm:p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold mb-2 flex items-center space-x-2">
            <IconBolt class="w-6 h-6" />
            <span>{{ stats.totalZaps > 0 ? welcomeMessage : connectionStatus.title }}</span>
          </h1>
          <p class="text-orange-50 text-sm sm:text-base">
            <span v-if="stats.totalZaps > 0">
              You've received {{ stats.totalZaps }} {{ connectionStatus.type === 'nwc-only' ? 'payments' : 'zaps' }} worth {{ stats.totalSats.toLocaleString() }} sats
              <span class="opacity-75">
                ({{ connectionStatus.dataTypes }} • last 30 days vs previous 30 days)
              </span>
            </span>
            <span v-else class="flex items-center gap-3 flex-wrap">
              <span>{{ connectionStatus.description }}</span>
              <button
                v-if="connectionStatus.type === 'nostr-only'"
                @click="emit('change-page', 'wallet')"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg border border-white/30 hover:border-white/50 transition-all duration-200"
              >
                <span>View Wallet</span>
                <IconArrowRight class="w-3.5 h-3.5" />
              </button>
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
            'text-xs sm:text-sm font-medium px-2 py-1 rounded-full border transition-all duration-200',
            getTrendColorClass(getPercentageChange('totalZaps')),
            'animate-pulse-subtle'
          ]">
            {{ formatPercentageChange(getPercentageChange('totalZaps')) }}
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
            'text-xs sm:text-sm font-medium px-2 py-1 rounded-full border transition-all duration-200',
            getTrendColorClass(getPercentageChange('totalSats')),
            'animate-pulse-subtle'
          ]">
            {{ formatPercentageChange(getPercentageChange('totalSats')) }}
          </span>
        </div>
        <div>
          <p class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{{ stats.totalSats.toLocaleString() }}</p>
          <p class="text-gray-500 text-sm">Total Sats ({{ formatUSD(stats.totalUSD) }})</p>
        </div>
      </div>

      <!-- Unique Supporters -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all">
        <div class="flex items-center justify-between mb-4">
          <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg flex items-center justify-center">
            <IconUsers class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
          </div>
          <span :class="[
            'text-xs sm:text-sm font-medium px-2 py-1 rounded-full border transition-all duration-200',
            getTrendColorClass(getPercentageChange('uniqueSupporters')),
            'animate-pulse-subtle'
          ]">
            {{ formatPercentageChange(getPercentageChange('uniqueSupporters')) }}
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
            'text-xs sm:text-sm font-medium px-2 py-1 rounded-full border transition-all duration-200',
            getTrendColorClass(getPercentageChange('avgZap')),
            'animate-pulse-subtle'
          ]">
            {{ formatPercentageChange(getPercentageChange('avgZap')) }}
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
        <!-- ECharts Loading Error -->
        <div v-if="echartsError" class="h-64 sm:h-80 flex items-center justify-center">
          <div class="text-center">
            <IconAlertCircle class="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p class="text-red-600 text-sm">Failed to load chart</p>
          </div>
        </div>
        
        <!-- Chart -->
        <div v-else-if="isEchartsLoaded && VChart" class="h-64 sm:h-80">
          <VChart :autoresize="true" :option="chartOption" class="w-full h-full" />
        </div>
        
        <!-- Loading State -->
        <div v-else class="h-64 sm:h-80 flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <IconBolt class="w-5 h-5 text-orange-600" />
          <span>Recent Zaps</span>
          <span v-if="selectedTimeRange !== 'all'" class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {{ getShortTimeRangeText(selectedTimeRange) }}
          </span>
        </h3>
        <div v-if="recentZaps.length === 0" class="text-center py-8">
          <div class="text-gray-400 text-4xl mb-2">
            <IconBolt class="w-12 h-12 mx-auto" />
          </div>
          <p class="text-gray-500 text-sm">
            {{ combinedZapData.length === 0 ? 'No activity yet' : `No activity in ${getTimeRangeDisplayText(selectedTimeRange)}` }}
          </p>
          <p class="text-gray-400 text-xs mt-1">
            {{ combinedZapData.length === 0 ? noDataMessage : 'Try selecting a different time range' }}
          </p>
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
              <p class="text-xs text-gray-500">{{ zap.timeAgo }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

    <!-- Wallet Balance Card -->
    <div v-if="walletBalance > 0" class="bg-gradient-to-r from-green-400 to-emerald-500 text-white mt-4 p-4 sm:p-6 rounded-xl shadow-lg">
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
</template>
