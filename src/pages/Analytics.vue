<script setup>
import { computed, inject, ref, onMounted } from 'vue'
import { IconClock, IconBook, IconChartLine, IconRefresh, IconUsers, IconTrendingUp, IconAlertCircle, IconBolt } from '@iconify-prerendered/vue-tabler'

const emit = defineEmits(['show-help'])
import { filterZapsByTimeRange } from '../utils/core/timeFilter.js'
import * as nip19 from 'nostr-tools/nip19'
import UserProfileModal from '../components/modals/UserProfileModal.vue'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import EngagementAnalytics from '../components/analytics/EngagementAnalytics.vue'
import EmptyStateAnalytics from '../components/analytics/EmptyStateAnalytics.vue'
import { IconExternalLink, IconHeart, IconRepeat, IconBookmark } from '@iconify-prerendered/vue-tabler'

// Lazy load ECharts to prevent issues
// Lazy load ECharts to prevent issues
const VChart = ref(null)
const echartsError = ref(null)
const isEchartsLoaded = ref(false)

onMounted(async () => {
  try {
    const { use } = await import('echarts/core')
    const { CanvasRenderer } = await import('echarts/renderers')
    const { LineChart, BarChart, PieChart } = await import('echarts/charts')
    const {
      TitleComponent,
      TooltipComponent,
      LegendComponent,
      GridComponent
    } = await import('echarts/components')
    const { default: VChartComponent } = await import('vue-echarts')
    
    use([
      CanvasRenderer,
      LineChart,
      BarChart,
      PieChart,
      TitleComponent,
      TooltipComponent,
      LegendComponent,
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
const profileStore = inject('profileStore')
const fetchAuthorProfile = inject('fetchAuthorProfile')
const selectedTimeRange = inject('selectedTimeRange')
const isWalletConnected = inject('isWalletConnected')
const isAuthenticated = inject('isAuthenticated')

// State for user profile modal
const showUserModal = ref(false)
const selectedUser = ref(null)

// Computed property for connection-aware data filtering
const analyticsData = computed(() => {
  const allZaps = combinedZapData.value
  let zaps = allZaps
  
  // Determine which data to use based on connection status
  if (isAuthenticated.value) {
    // Both connected: use all data (NWC + NIP-57)
    zaps = zaps.filter(zap => zap.source === 'nip57')
  } else  if (connectionStatus.value.type === 'nostr-only') {
    // Only Nostr connected: show only Nostr zaps
    zaps = zaps.filter(zap => zap.source === 'nip57')
  } else if (connectionStatus.value.type === 'none') {
    // No connections: show nothing
    zaps = []
  }
  return zaps
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

// Process real zap data for daily activity
const dailyActivityOption = computed(() => {
  const zaps = analyticsData.value
  
  if (zaps.length === 0) {
    // Show empty state with sample structure
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return {
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: 0
      }
    })
    
    return {
      title: {
        text: `Daily ${connectionStatus.value.dataLabel} Activity (Last 7 Days)`,
        textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#f97316',
        textStyle: { color: '#374151' },
        formatter: function(params) {
          const data = params[0]
          return `${data.name}: ${data.value} sats`
        }
      },
      xAxis: {
        type: 'category',
        data: last7Days.map(d => d.label),
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412' }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412' }
      },
      series: [{
        data: last7Days.map(d => d.value),
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
  }
  
  // Process real data - group by day for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toDateString(),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: 0
    }
  })
  
  // Aggregate zaps by day
  zaps.forEach(zap => {
    const zapDate = new Date(zap.timestamp).toDateString()
    const dayData = last7Days.find(day => day.date === zapDate)
    if (dayData) {
      dayData.value += zap.amount
    }
  })
  
  return {
    title: {
      text: `Daily ${connectionStatus.value.dataLabel} Activity (Last 7 Days)`,
      textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' },
      formatter: function(params) {
        const data = params[0]
        return `${data.name}: ${data.value} sats`
      }
    },
    xAxis: {
      type: 'category',
      data: last7Days.map(d => d.label),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { color: '#9a3412' }
    },
    series: [{
      data: last7Days.map(d => d.value),
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
})

// Process real data for top supporters
const topSupportersOption = computed(() => {
  const zaps = analyticsData.value
  
  if (zaps.length === 0) {
    return {
      title: {
        text: 'Top Supporters',
        textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
      },
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
    title: {
      text: 'Top Supporters',
      textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
    },
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
      // emphasis: {
      //   label: {
      //     show: true,
      //     fontSize: '18',
      //     fontWeight: 'bold'
      //   }
      // },
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
    title: {
      text: `${connectionStatus.value.dataLabel} Amount Distribution`,
      textStyle: { color: '#7c2d12', fontSize: 16, fontWeight: 'bold' }
    },
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
    return [
      {
        title: 'Connect Account',
        value: 'No Data',
        description: connectionStatus.value.emptyMessage,
        icon: IconClock
      },
      {
        title: `Total ${connectionStatus.value.type === 'nwc-only' ? 'Payments' : 'Zaps'}`,
        value: '0',
        description: `No ${connectionStatus.value.dataLabel} yet`,
        icon: IconBook
      },
      {
        title: 'Average Amount',
        value: '0 sats',
        description: `No ${connectionStatus.value.dataLabel} to calculate average`,
        icon: IconChartLine
      },
      {
        title: 'Unique Supporters',
        value: '0',
        description: 'No supporters yet',
        icon: IconUsers
      }
    ]
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
  
  // Calculate best performing content type
  const noteTypeCounts = {}
  zaps.forEach(zap => {
    const type = zap.noteType || 'unknown'
    noteTypeCounts[type] = (noteTypeCounts[type] || 0) + zap.amount
  })
  const bestType = Object.entries(noteTypeCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'
  
  // Calculate engagement rate (mock calculation)
  // COMMENTED OUT - No reliable data to calculate engagement rate
  // const totalNotes = zaps.length * 2 // Assume 2x more notes than zaps
  // const engagementRate = totalNotes > 0 ? ((zaps.length / totalNotes) * 100).toFixed(1) : '0.0'
  
  // Calculate repeat supporters
  const supporterCounts = new Map();
  const supporterAmounts = new Map();
  
  filteredZaps.forEach(zap => {
    const senderKey = zap.sender?.pubkey || zap.zapperPubkey || 'anonymous';
    supporterCounts.set(senderKey, (supporterCounts.get(senderKey) || 0) + 1);
    supporterAmounts.set(senderKey, (supporterAmounts.get(senderKey) || 0) + zap.amount);
  });
  
  // Get repeat supporters (sent more than one zap)
  const repeatSupporters = Array.from(supporterCounts.entries())
    .filter(([_, count]) => count > 1)
    .length;
  
  const totalSupporters = supporterCounts.size;
  const repeatPercentage = totalSupporters > 0 ? Math.round((repeatSupporters / totalSupporters) * 100) : 0;
  
  // Get top supporter by amount
  let topSupporter = { pubkey: 'anonymous', amount: 0, count: 0 };
  supporterAmounts.forEach((amount, pubkey) => {
    if (amount > topSupporter.amount) {
      topSupporter = { 
        pubkey, 
        amount, 
        count: supporterCounts.get(pubkey) || 0 
      };
    }
  });
  
  return [
    {
      title: 'Peak Zap Time',
      value: peakTimeFormatted,
      description: `${peakHourCount} zaps (${peakHourAmount.toLocaleString()} sats)`,
      icon: IconClock
    },
    // COMMENTED OUT - Engagement Rate insight removed due to lack of reliable data
    // {
    //   title: 'Engagement Rate',
    //   value: `${engagementRate}%`,
    //   description: 'Percentage of content that gets zapped',
    //   icon: IconChartLine
    // },
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
  
  // Calculate engagement metrics from all content
  let totalLikes = 0
  let totalReposts = 0
  let totalBookmarks = 0
  let totalZapCount = zaps.length
  
  // This would need to be enhanced with actual engagement data
  // For now, using placeholder values based on zap activity
  if (zaps.length > 0) {
    totalLikes = Math.floor(zaps.length * 1.5) // Estimate likes based on zaps
    totalReposts = Math.floor(zaps.length * 0.3) // Estimate reposts
    totalBookmarks = Math.floor(zaps.length * 0.2) // Estimate bookmarks
  }
  
  return {
    totalZaps: zaps.length,
    totalAmount,
    avgAmount,
    uniqueSupporters,
    totalLikes,
    totalReposts,
    totalBookmarks,
    totalZapCount,
    totalEngagement: totalLikes + totalReposts + totalBookmarks
  }
})

// Format engagement numbers for better readability
const formatEngagementNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}
</script>

<template>
  <!-- Empty State - No Data -->
  <EmptyStateAnalytics
    v-if="analyticsData.length === 0 && !isAuthenticated"
    @connect-nostr="() => document.dispatchEvent(new Event('nlLaunch'))"
    @show-help="$emit('show-help')"
    @go-to-content="$emit('change-page', 'content')"
  />

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
      <div class="flex items-center space-x-2">
        <IconAlertCircle class="w-5 h-5 text-red-600" />
        <span class="text-red-800">Failed to load charts: {{ echartsError }}</span>
      </div>
    </div>

    <!-- Charts Grid -->
    <div v-else-if="isEchartsLoaded && VChart" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Daily Activity Chart -->
      <div class="card p-6">
        <VChart :autoresize="true" :option="dailyActivityOption" style="height: 300px;" />
      </div>
      
      <!-- Top Supporters Chart -->
      <div class="card p-6">
        <VChart :autoresize="true" :option="topSupportersOption" style="height: 300px;" />
      </div>
      
      <!-- Amount Distribution Chart -->
      <div class="card p-6 lg:col-span-2">
        <VChart :autoresize="true" :option="amountDistributionOption" style="height: 300px;" />
      </div>
    </div>

    <!-- ECharts Loading State -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card p-6">
        <div class="flex items-center justify-center h-[300px]">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
      <div class="card p-6">
        <div class="flex items-center justify-center h-[300px]">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
      <div class="card p-6 lg:col-span-2">
        <div class="flex items-center justify-center h-[300px]">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    </div>
    
    <!-- Dynamic Insights Cards -->
    <div class="space-y-6">
      <!-- Engagement Analytics Component -->
      <EngagementAnalytics />
      
      <!-- Real-Time Insights -->
      <div>
        <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <IconTrendingUp class="w-5 h-5 text-orange-600" />
          <span>Content Insights</span>
          <span v-if="zapData.length > 0" class="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full">
            Live Data
          </span>
          <span v-else class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            No Data
          </span>
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
        
        <!-- Top Supporters Card -->
        <div class="card p-4 text-center hover:shadow-lg transition-all duration-200">
          <div class="text-3xl mb-2">
            <IconUsers class="w-8 h-8 mx-auto text-orange-600" />
          </div>
          <h4 class="font-medium text-gray-900 mb-3">Top Supporter</h4>
          
          <!-- Loading State -->
          <div v-if="combinedZapData.filter(zap => zap.eventId).length === 0" class="text-center py-2">
            <p class="text-sm text-gray-500">Connect to see top supporters</p>
          </div>
          
          <!-- Supporters List -->
          <div v-else-if="topSupporters.length > 0">
            <div v-if="topSupporters[0]" @click="openUserProfile(topSupporters[0])" class="flex items-center justify-between p-1 rounded-lg hover:bg-orange-50 transition-colors cursor-pointer">
              <!-- Avatar -->
              <div class="w-8 h-8 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                <img 
                  :src="topSupporters[0].profile?.picture || generateAvatar(topSupporters[0].pubkey)" 
                  :alt="topSupporters[0].profile?.name || 'Supporter'"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(topSupporters[0].pubkey)"
                />
              </div>
              
              <!-- Name -->
              <div class="flex-1 min-w-0 mx-2">
                <p class="font-medium text-gray-900 truncate text-xs">{{ topSupporters[0].profile?.name || topSupporters[0].pubkey.substring(0, 8) + '...' }}</p>
                <p v-if="topSupporters[0].profile?.lud16" class="text-xs text-blue-600 truncate leading-tight">
                  {{ topSupporters[0].profile.lud16 }}
                </p>
              </div>
              
              <!-- Amount -->
              <div class="text-right flex-shrink-0">
                <p class="text-xs font-bold text-orange-600">{{ topSupporters[0].totalAmount.toLocaleString() }}</p>
                <p class="text-xs text-gray-500 leading-tight">{{ topSupporters[0].zapCount }} zap{{ topSupporters[0].zapCount !== 1 ? 's' : '' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- Data Status Indicator -->
    <div class="text-center py-4">
      <div v-if="connectionStatus.type === 'none'" class="text-gray-500 text-sm">
        <IconRefresh class="w-4 h-4 inline mr-2" />
        {{ connectionStatus.emptyMessage }}
      </div>
      <div v-else-if="analyticsData.length > 0" class="text-green-600 text-sm">
        <IconBolt class="w-4 h-4 inline mr-2" />
        Analytics updated with {{ analyticsData.length }} {{ connectionStatus.dataLabel }}
      </div>
      <div v-else class="text-amber-600 text-sm">
        <IconTrendingUp class="w-4 h-4 inline mr-2" />
        {{ connectionStatus.emptyMessage }}
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
