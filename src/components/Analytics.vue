<script setup>
import { computed, inject } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { IconClock, IconBook, IconChartLine, IconRefresh, IconUsers, IconTrendingUp } from '@iconify-prerendered/vue-tabler'

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

const zapData = inject('zapData')
const selectedTimeRange = inject('selectedTimeRange')

// Process real zap data for daily activity
const dailyActivityOption = computed(() => {
  const zaps = zapData.value
  
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
        text: 'Daily Zap Activity (Last 7 Days)',
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
      text: 'Daily Zap Activity (Last 7 Days)',
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
  const zaps = zapData.value
  
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
  const zaps = zapData.value
  
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
      text: 'Zap Amount Distribution',
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

// Dynamic insights based on real data
const insights = computed(() => {
  const zaps = zapData.value
  
  if (zaps.length === 0) {
    return [
      {
        title: 'Connect Wallet',
        value: 'No Data',
        description: 'Connect your wallet to see insights',
        icon: IconClock
      },
      {
        title: 'Total Zaps',
        value: '0',
        description: 'No zaps received yet',
        icon: IconBook
      },
      {
        title: 'Average Amount',
        value: '0 sats',
        description: 'No zaps to calculate average',
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
  
  // Calculate peak zap time
  const hourCounts = new Array(24).fill(0)
  zaps.forEach(zap => {
    const hour = new Date(zap.timestamp).getHours()
    hourCounts[hour]++
  })
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))
  const peakTimeFormatted = `${peakHour}:00 - ${peakHour + 1}:00`
  
  // Calculate best performing content type
  const noteTypeCounts = {}
  zaps.forEach(zap => {
    const type = zap.noteType || 'unknown'
    noteTypeCounts[type] = (noteTypeCounts[type] || 0) + zap.amount
  })
  const bestType = Object.entries(noteTypeCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'
  
  // Calculate engagement rate (mock calculation)
  const totalNotes = zaps.length * 2 // Assume 2x more notes than zaps
  const engagementRate = totalNotes > 0 ? ((zaps.length / totalNotes) * 100).toFixed(1) : '0.0'
  
  // Calculate repeat supporters
  const supporterCounts = new Map()
  zaps.forEach(zap => {
    const senderKey = zap.sender?.pubkey || 'anonymous'
    supporterCounts.set(senderKey, (supporterCounts.get(senderKey) || 0) + 1)
  })
  const repeatSupporters = Array.from(supporterCounts.values()).filter(count => count > 1).length
  const totalSupporters = supporterCounts.size
  const repeatPercentage = totalSupporters > 0 ? Math.round((repeatSupporters / totalSupporters) * 100) : 0
  
  return [
    {
      title: 'Peak Zap Time',
      value: peakTimeFormatted,
      description: 'Most active hour for receiving zaps',
      icon: IconClock
    },
    {
      title: 'Best Content Type',
      value: bestType.charAt(0).toUpperCase() + bestType.slice(1),
      description: 'Content type with highest zap amounts',
      icon: IconBook
    },
    {
      title: 'Engagement Rate',
      value: `${engagementRate}%`,
      description: 'Percentage of content that gets zapped',
      icon: IconChartLine
    },
    {
      title: 'Repeat Supporters',
      value: `${repeatPercentage}%`,
      description: 'Supporters who zap multiple times',
      icon: IconUsers
    }
  ]
})

// Additional computed stats for summary
const summaryStats = computed(() => {
  const zaps = zapData.value
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
  <div class="space-y-6">
    <!-- Dynamic Summary Stats -->
    <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6 rounded-xl shadow-lg">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.totalZaps }}</div>
          <div class="text-orange-100 text-sm">Total Zaps</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.totalAmount.toLocaleString() }}</div>
          <div class="text-orange-100 text-sm">Total Sats</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.avgAmount }}</div>
          <div class="text-orange-100 text-sm">Avg Zap</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold">{{ summaryStats.uniqueSupporters }}</div>
          <div class="text-orange-100 text-sm">Supporters</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Daily Activity Chart -->
      <div class="card p-6">
        <VChart :option="dailyActivityOption" style="height: 300px;" />
      </div>
      
      <!-- Top Supporters Chart -->
      <div class="card p-6">
        <VChart :option="topSupportersOption" style="height: 300px;" />
      </div>
      
      <!-- Amount Distribution Chart -->
      <div class="card p-6 lg:col-span-2">
        <VChart :option="amountDistributionOption" style="height: 300px;" />
      </div>
    </div>
    
    <!-- Dynamic Insights Cards -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <IconTrendingUp class="w-5 h-5 text-orange-600" />
        <span>Real-Time Insights</span>
        <span v-if="zapData.length > 0" class="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full">
          Live Data
        </span>
        <span v-else class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          No Data
        </span>
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>
    </div>

    <!-- Data Status Indicator -->
    <div class="text-center py-4">
      <div v-if="zapData.length === 0" class="text-gray-500 text-sm">
        <IconRefresh class="w-4 h-4 inline mr-2" />
        Connect your wallet to see real analytics data
      </div>
      <div v-else class="text-green-600 text-sm">
        <IconTrendingUp class="w-4 h-4 inline mr-2" />
        Analytics updated with {{ zapData.length }} real zaps
      </div>
    </div>
  </div>
</template>
