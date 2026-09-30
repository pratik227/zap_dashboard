<script setup>
import { computed, inject, ref, onMounted, onUnmounted } from 'vue'
import { IconClock, IconUsers, IconTrendingUp, IconAlertCircle } from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import { filterZapsByTimeRange } from '../utils/core/timeFilter.js'
import UserProfileModal from '../components/modals/UserProfileModal.vue'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import EngagementAnalytics from '../components/analytics/EngagementAnalytics.vue'
import EmptyStateAnalytics from '../components/analytics/EmptyStateAnalytics.vue'
import SkeletonAnalytics from '../components/shared/SkeletonAnalytics.vue'
import { calculateSmartYAxisRange, applySplitAxisTransformation } from '../utils/chart/chartScaling.js'

const emit = defineEmits(['show-help'])

const { login } = useNostrAuth()

// Inline status for login errors
const inlineStatus = ref(null)
let _statusTimer = null
const showStatus = (message, type = 'error') => {
  clearTimeout(_statusTimer)
  inlineStatus.value = { message, type }
  _statusTimer = setTimeout(() => { inlineStatus.value = null }, 4000)
}

onUnmounted(() => {
  clearTimeout(_statusTimer)
})

const handleConnectNostr = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error.message)
    if (error.message.includes('No Nostr extension')) {
      showStatus('No Nostr extension found. Please install a NIP-07 browser extension — we recommend Jump by Buho (from the ZapTracker founders, available for Firefox & Chrome), or Alby, nos2x, or Flamingo — and refresh this page.')
    } else {
      showStatus(getUserFriendlyError(error))
    }
  }
}

// Lazy load ECharts
const VChart = ref(null)
const echartsError = ref(null)
const isEchartsLoaded = ref(false)
const isRetryingCharts = ref(false)

const loadEcharts = async () => {
  echartsError.value = null
  try {
    const { use } = await import('echarts/core')
    const { CanvasRenderer } = await import('echarts/renderers')
    const { LineChart, BarChart, PieChart } = await import('echarts/charts')
    const {
      TooltipComponent,
      GridComponent
    } = await import('echarts/components')
    const { default: VChartComponent } = await import('vue-echarts')

    use([
      CanvasRenderer,
      LineChart,
      BarChart,
      PieChart,
      TooltipComponent,
      GridComponent
    ])

    VChart.value = VChartComponent
    isEchartsLoaded.value = true
  } catch (error) {
    console.error('Failed to load ECharts:', error)
    echartsError.value = error.message
  }
}

const retryLoadCharts = async () => {
  isRetryingCharts.value = true
  await loadEcharts()
  isRetryingCharts.value = false
}

onMounted(loadEcharts)

const combinedZapData = inject('combinedZapData')
const profileStore = inject('profileStore')
const fetchAuthorProfile = inject('fetchAuthorProfile')
const selectedTimeRange = inject('selectedTimeRange')
const isWalletConnected = inject('isWalletConnected')
const isAuthenticated = inject('isAuthenticated')
const isPageLoading = inject('isPageLoading', ref(false))

// State for user profile modal
const showUserModal = ref(false)
const selectedUser = ref(null)

// Computed property for connection-aware data filtering
const analyticsData = computed(() => {
  const allZaps = combinedZapData.value

  switch (connectionStatus.value.type) {
    case 'both':
      return allZaps
    case 'nostr-only':
      return allZaps.filter(zap => zap.source === 'nip57')
    case 'nwc-only':
      return allZaps.filter(zap => zap.source === 'nwc')
    case 'none':
      return []
    default:
      return allZaps
  }
})

// Connection status for messaging
const connectionStatus = computed(() => {
  const hasNWC = isWalletConnected.value
  const hasNostr = isAuthenticated.value
  
  if (hasNWC && hasNostr) {
    return {
      type: 'both',
      dataLabel: 'payments and zaps',
      emptyMessage: 'No activity yet. Try receiving some zaps.'
    }
  } else if (hasNostr) {
    return {
      type: 'nostr-only',
      dataLabel: 'Nostr zaps',
      emptyMessage: 'No Nostr zaps yet. Try receiving some zaps for more data.'
    }
  } else if (hasNWC) {
    return {
      type: 'nwc-only', 
      dataLabel: 'NWC payments',
      emptyMessage: 'No NWC payments yet. Try making a payment or connect your Nostr account for more data.'
    }
  } else {
    return {
      type: 'none',
      dataLabel: 'data',
      emptyMessage: 'Connect your NWC wallet and/or Nostr account to view analytics.'
    }
  }
})

// Determine number of days for daily activity based on selected time range
const activityDayCount = computed(() => {
  switch (selectedTimeRange.value) {
    case '24h': return 1
    case '7d': return 7
    case '30d': return 30
    case 'all': return 30
    default: return 7
  }
})

const activityTimeLabel = computed(() => {
  switch (selectedTimeRange.value) {
    case '24h': return 'Last 24 Hours'
    case '7d': return 'Last 7 Days'
    case '30d': return 'Last 30 Days'
    case 'all': return 'All Time (30 Days)'
    default: return 'Last 7 Days'
  }
})

// Process real zap data for daily activity
const dailyActivityOption = computed(() => {
  const zaps = analyticsData.value
  const dayCount = activityDayCount.value

  // Build date buckets
  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (dayCount - 1 - i))
    return {
      date: date.toDateString(),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: 0
    }
  })

  // Aggregate zaps by day
  zaps.forEach(zap => {
    const zapDate = new Date(zap.timestamp).toDateString()
    const dayData = days.find(day => day.date === zapDate)
    if (dayData) {
      dayData.value += zap.amount
    }
  })

  // Calculate smart Y-axis range with split-axis detection
  const scalingResult = calculateSmartYAxisRange(days)

  const baseConfig = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' },
      formatter: function(params) {
        const data = params[0]
        return `${data.name}: ${data.value.toLocaleString()} sats`
      }
    },
    xAxis: {
      type: 'category',
      data: days.map(d => d.label),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: {
        color: '#9a3412',
        rotate: dayCount > 14 ? 45 : 0,
        interval: dayCount > 14 ? Math.floor(dayCount / 10) : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' }
    },
    series: [{
      data: days.map(d => d.value),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#f97316', width: 3 },
      itemStyle: { color: '#f97316' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(249, 115, 22, 0.3)' },
            { offset: 1, color: 'rgba(249, 115, 22, 0.05)' }
          ]
        }
      }
    }]
  }

  return applySplitAxisTransformation(baseConfig, scalingResult)
})

// Process real data for top supporters
const topSupportersOption = computed(() => {
  const zaps = analyticsData.value
  
  if (zaps.length === 0) {
    return {
      tooltip: {
        trigger: 'item',
        formatter: 'No data available',
        backgroundColor: '#fff',
        borderColor: '#f97316',
        textStyle: { color: '#374151' }
      },
      series: [{
        name: 'Supporters',
        type: 'pie',
        radius: ['40%', '70%'],
        data: [],
        color: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fff7ed']
      }]
    }
  }
  
  // Aggregate zaps by sender
  const supporterMap = new Map()
  zaps.forEach(zap => {
    const senderKey = zap.sender?.name || zap.sender?.pubkey?.substring(0, 8) || 'Anonymous'
    const currentAmount = supporterMap.get(senderKey) || 0
    supporterMap.set(senderKey, currentAmount + zap.amount)
  })
  
  // Convert to array and sort by amount
  const supporters = Array.from(supporterMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5) // Top 5 supporters
  
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} sats ({d}%)',
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' }
    },
    series: [{
      name: 'Supporters',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      label: {
        show: false,
        position: 'center'
      },
      itemStyle: {
        borderRadius: 10,
        borderColor: '#fff',
        borderWidth: 2
      },
      labelLine: {
        show: false
      },
      data: supporters,
      color: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#fff7ed']
    }]
  }
})

// Process real data for amount distribution
const amountDistributionOption = computed(() => {
  const zaps = analyticsData.value
  
  const ranges = [
    { label: '1-10', min: 1, max: 10, count: 0 },
    { label: '11-50', min: 11, max: 50, count: 0 },
    { label: '51-100', min: 51, max: 100, count: 0 },
    { label: '101-500', min: 101, max: 500, count: 0 },
    { label: '500+', min: 501, max: Infinity, count: 0 }
  ]
  
  // Count zaps in each range
  zaps.forEach(zap => {
    const amount = zap.amount
    const range = ranges.find(r => amount >= r.min && amount <= r.max)
    if (range) {
      range.count++
    }
  })
  
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' },
      formatter: function(params) {
        const data = params[0]
        return `${data.name} sats: ${data.value} zaps`
      }
    },
    xAxis: {
      type: 'category',
      data: ranges.map(r => r.label),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' },
      splitLine: {
        show: false,
      },
      splitArea: {
        show: false,
      }
    },
    series: [{
      data: ranges.map(r => r.count),
      type: 'bar',
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#f97316' },
            { offset: 1, color: '#fed7aa' }
          ]
        },
        borderRadius: [8, 8, 0, 0]
      }
    }]
  }
})

// Calculate top supporters from connection-aware data
const topSupporters = computed(() => {
  const zaps = analyticsData.value
  
  // Apply time range filter
  const filteredZaps = filterZapsByTimeRange(zaps, selectedTimeRange.value)
  
  if (filteredZaps.length === 0) {
    return []
  }
  
  // Aggregate zaps by supporter
  const supporterMap = new Map()
  
  filteredZaps.forEach(zap => {
    const pubkey = zap.sender?.pubkey || zap.zapperPubkey
    if (!pubkey) return
    
    const currentData = supporterMap.get(pubkey) || { 
      pubkey, 
      totalAmount: 0, 
      zapCount: 0,
      profile: null
    }
    
    currentData.totalAmount += zap.amount
    currentData.zapCount += 1
    
    // Try to get profile from store
    if (!currentData.profile && profileStore.value.has(pubkey)) {
      currentData.profile = profileStore.value.get(pubkey)
    }
    
    supporterMap.set(pubkey, currentData)
  })
  
  // Convert to array and sort by amount
  const supporters = Array.from(supporterMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5) // Top 5 supporters
  
  // Fetch profiles for supporters that don't have one yet
  supporters.forEach(supporter => {
    if (!supporter.profile) {
      fetchAuthorProfile(supporter.pubkey)
        .then(profile => {
          supporter.profile = profile
        })
        .catch(error => {
          console.warn(`Failed to fetch profile for ${supporter.pubkey.substring(0, 8)}:`, error)
        })
    }
  })
  
  return supporters
})

// Handle opening user profile modal
const openUserProfile = (supporter) => {
  selectedUser.value = {
    pubkey: supporter.pubkey,
    profile: supporter.profile
  }
  showUserModal.value = true
}

// Dynamic insights based on real data
const insights = computed(() => {
  const zaps = analyticsData.value
  
  if (zaps.length === 0) {
    return []
  }
  
  // Calculate peak zap time with more detail
  const hourCounts = new Array(24).fill(0);
  const hourAmounts = new Array(24).fill(0);
  
  // Apply time range filter to zaps using the imported function
  const filteredZaps = filterZapsByTimeRange(zaps, selectedTimeRange.value);
  
  filteredZaps.forEach(zap => {
    const hour = new Date(zap.timestamp).getHours();
    hourCounts[hour]++;
    hourAmounts[hour] += zap.amount;
  });
  
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakTimeFormatted = `${peakHour}:00 - ${(peakHour + 1) % 24}:00`;
  const peakHourCount = hourCounts[peakHour];
  const peakHourAmount = hourAmounts[peakHour];

  // Calculate repeat supporters
  const supporterCounts = new Map();

  filteredZaps.forEach(zap => {
    const senderKey = zap.sender?.pubkey || zap.zapperPubkey || 'anonymous';
    supporterCounts.set(senderKey, (supporterCounts.get(senderKey) || 0) + 1);
  });
  
  // Get repeat supporters (sent more than one zap)
  const repeatSupporters = Array.from(supporterCounts.entries())
    .filter(([_, count]) => count > 1)
    .length;
  
  const totalSupporters = supporterCounts.size;
  const repeatPercentage = totalSupporters > 0 ? Math.round((repeatSupporters / totalSupporters) * 100) : 0;

  return [
    {
      title: 'Peak Zap Time',
      value: peakTimeFormatted,
      description: `${peakHourCount} zaps (${peakHourAmount.toLocaleString()} sats)`,
      icon: IconClock
    },
    {
      title: 'Repeat Supporters',
      value: `${repeatPercentage}%`,
      description: `${repeatSupporters} of ${totalSupporters} supporters`,
      icon: IconUsers
    },
  ]
})

// Additional computed stats for summary
const summaryStats = computed(() => {
  const zaps = analyticsData.value
  const totalAmount = zaps.reduce((sum, zap) => sum + zap.amount, 0)
  const avgAmount = zaps.length > 0 ? Math.round(totalAmount / zaps.length) : 0
  const uniqueSupporters = new Set(zaps.map(zap => zap.sender?.pubkey || 'anonymous')).size

  return {
    totalZaps: zaps.length,
    totalAmount,
    avgAmount,
    uniqueSupporters
  }
})
</script>

<template>
  <!-- Inline Status Banner -->
  <transition name="slide-down">
    <div v-if="inlineStatus" role="status" aria-live="polite" :class="[
      'mb-4 px-4 py-3 rounded-lg text-sm font-medium',
      inlineStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
      inlineStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
      'bg-blue-50 text-blue-800 border border-blue-200'
    ]">
      {{ inlineStatus.message }}
    </div>
  </transition>

  <!-- Empty State - Not Authenticated -->
  <EmptyStateAnalytics
    v-if="!isAuthenticated"
    @connect-nostr="handleConnectNostr"
    @show-help="$emit('show-help')"
    @go-to-content="$emit('change-page', 'content')"
  />

  <!-- Skeleton Loading -->
  <SkeletonAnalytics v-else-if="isPageLoading && analyticsData.length === 0" />

  <div v-else class="space-y-6">
    <!-- Dynamic Summary Stats -->
    <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6 rounded-xl shadow-lg">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.totalZaps }}</div>
          <div class="text-orange-100 text-sm">Total {{ connectionStatus.type === 'nwc-only' ? 'Payments' : 'Zaps' }}</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.totalAmount.toLocaleString() }}</div>
          <div class="text-orange-100 text-sm">Total Sats</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.avgAmount }}</div>
          <div class="text-orange-100 text-sm">Avg {{ connectionStatus.type === 'nwc-only' ? 'Payment' : 'Zap' }}</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.uniqueSupporters }}</div>
          <div class="text-orange-100 text-sm">Supporters</div>
        </div>
      </div>
    </div>

    <!-- ECharts Loading Error -->
    <div v-if="echartsError" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600 flex-shrink-0" />
          <span class="text-red-800">Failed to load charts: {{ echartsError }}</span>
        </div>
        <button
          @click="retryLoadCharts"
          :disabled="isRetryingCharts"
          class="ml-4 px-4 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isRetryingCharts ? 'Retrying...' : 'Retry' }}
        </button>
      </div>
    </div>

    <!-- Charts Grid -->
    <div v-else-if="isEchartsLoaded && VChart" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Daily Activity Chart -->
      <div class="card p-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Daily Activity - {{ activityTimeLabel }}</h4>
        <VChart :autoresize="true" :option="dailyActivityOption" style="height: 280px;" />
      </div>
      
      <!-- Top Supporters Chart -->
      <div class="card p-6">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Top Supporters</h4>
        <VChart :autoresize="true" :option="topSupportersOption" style="height: 280px;" />
      </div>

      <!-- Amount Distribution Chart -->
      <div class="card p-6 lg:col-span-2">
        <h4 class="text-sm font-semibold text-gray-700 mb-3">Amount Distribution</h4>
        <VChart :autoresize="true" :option="amountDistributionOption" style="height: 280px;" />
      </div>
    </div>

    <!-- ECharts Loading State (skeleton) -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-xl border border-gray-200/60 p-6 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-32 mb-4"></div>
        <div class="h-[260px] bg-gray-100 rounded-lg flex items-end justify-around px-4 pb-4 gap-2">
          <div v-for="i in 7" :key="'a'+i" class="flex-1 bg-gray-200/80 rounded-t" :style="{ height: `${20 + Math.sin(i) * 30 + 30}%` }"></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200/60 p-6 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-32 mb-4"></div>
        <div class="h-[260px] bg-gray-100 rounded-lg flex items-center justify-center">
          <div class="w-40 h-40 rounded-full border-[24px] border-gray-200/80 bg-gray-50"></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200/60 p-6 lg:col-span-2 animate-pulse">
        <div class="h-4 bg-gray-200 rounded w-40 mb-4"></div>
        <div class="h-[260px] bg-gray-100 rounded-lg flex items-end justify-around px-6 pb-4 gap-4">
          <div v-for="i in 5" :key="'b'+i" class="flex-1 bg-gray-200/80 rounded-t" :style="{ height: `${15 + i * 15}%` }"></div>
        </div>
      </div>
    </div>
    
    <!-- Dynamic Insights Cards -->
    <div class="space-y-6">
      <!-- Engagement Analytics Component -->
      <EngagementAnalytics />
      
      <!-- Content Insights -->
      <div v-if="insights.length > 0 || topSupporters.length > 0">
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <IconTrendingUp class="w-5 h-5 text-orange-600" />
          <span>Content Insights</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="insight in insights"
            :key="insight.title"
            class="card p-4 text-center hover:shadow-lg transition-all duration-200"
          >
            <div class="text-3xl mb-2">
              <component :is="insight.icon" class="w-8 h-8 mx-auto text-orange-600" />
            </div>
            <h4 class="font-medium text-gray-900 mb-1">{{ insight.title }}</h4>
            <p class="text-lg font-bold text-orange-600 mb-2">{{ insight.value }}</p>
            <p class="text-xs text-gray-600">{{ insight.description }}</p>
          </div>

          <!-- Top Supporter Card -->
          <div v-if="topSupporters.length > 0" class="card p-4 text-center hover:shadow-lg transition-all duration-200">
            <div class="text-3xl mb-2">
              <IconUsers class="w-8 h-8 mx-auto text-orange-600" />
            </div>
            <h4 class="font-medium text-gray-900 mb-3">Top Supporter</h4>
            <div @click="openUserProfile(topSupporters[0])" class="flex items-center justify-between p-1 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer">
              <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                <img
                  :src="topSupporters[0].profile?.picture || generateAvatar(topSupporters[0].pubkey)"
                  :alt="topSupporters[0].profile?.name || 'Supporter'"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(topSupporters[0].pubkey)"
                />
              </div>
              <div class="flex-1 min-w-0 mx-2">
                <p class="font-medium text-gray-900 truncate text-xs">{{ topSupporters[0].profile?.name || topSupporters[0].pubkey.substring(0, 8) + '...' }}</p>
                <p v-if="topSupporters[0].profile?.lud16" class="text-xs text-blue-600 truncate leading-tight">
                  {{ topSupporters[0].profile.lud16 }}
                </p>
              </div>
              <div class="text-right flex-shrink-0">
                <p class="text-xs font-bold text-orange-600">{{ topSupporters[0].totalAmount.toLocaleString() }}</p>
                <p class="text-xs text-gray-500 leading-tight">{{ topSupporters[0].zapCount }} zap{{ topSupporters[0].zapCount !== 1 ? 's' : '' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- User Profile Modal -->
  <UserProfileModal
    :show="showUserModal"
    :user-profile-data="selectedUser"
    @close="showUserModal = false"
  />
  </div>
</template>
