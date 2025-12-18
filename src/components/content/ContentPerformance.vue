<script setup>
import { computed, ref, onMounted } from 'vue'
import { IconTrendingUp, IconBolt, IconFileText } from '@iconify-prerendered/vue-tabler'

// Lazy load ECharts to prevent issues
const VChart = ref(null)
const echartsError = ref(null)
const isEchartsLoaded = ref(false)

onMounted(async () => {
  try {
    const { use } = await import('echarts/core')
    const { CanvasRenderer } = await import('echarts/renderers')
    const { LineChart, BarChart } = await import('echarts/charts')
    const {
      TitleComponent,
      TooltipComponent,
      GridComponent,
      LegendComponent
    } = await import('echarts/components')
    const { default: VChartComponent } = await import('vue-echarts')
    
    use([
      CanvasRenderer,
      LineChart,
      BarChart,
      TitleComponent,
      TooltipComponent,
      GridComponent,
      LegendComponent
    ])
    
    VChart.value = VChartComponent
    isEchartsLoaded.value = true
  } catch (error) {
    console.error('Failed to load ECharts:', error)
    echartsError.value = error.message
  }
})

const props = defineProps({
  contentItems: {
    type: Array,
    required: true
  }
})

// Revenue trend chart with real data
const revenueChartOption = computed(() => {
  // Get last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toDateString(),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: 0
    }
  })
  
  // Calculate revenue per day from real content zap data
  props.contentItems.forEach(item => {
    if (item.zaps && item.zaps.length > 0) {
      item.zaps.forEach(zap => {
        const zapDate = new Date(zap.timestamp).toDateString()
        const dayData = last7Days.find(day => day.date === zapDate)
        if (dayData) {
          dayData.revenue += zap.amount
        }
      })
    }
  })
  
  return {
    title: {
      text: 'Revenue Trend (Last 7 Days)',
      textStyle: { color: '#7c2d12', fontSize: 14, fontWeight: 'bold' },
      left: 'center'
    },
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
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: last7Days.map(d => d.label),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { 
        color: '#9a3412',
        fontSize: 10,
        rotate: window.innerWidth < 640 ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { 
        color: '#9a3412',
        fontSize: 10
      },
      splitLine: {
        lineStyle: { color: '#f3f4f6', type: 'dashed' }
      }
    },
    series: [{
      data: last7Days.map(d => d.revenue),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#f97316', width: 2 },
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

// Content performance chart with real data
const performanceChartOption = computed(() => {
  // Get top 5 content items by zap revenue
  const topContent = props.contentItems
    .filter(item => item.zapAmount > 0) // Only show content with zaps
    .sort((a, b) => b.zapAmount - a.zapAmount)
    .slice(0, 5)
    .map(item => ({
      name: item.title.length > 15 ? item.title.substring(0, 15) + '...' : item.title,
      revenue: item.zapAmount || 0,
      zapCount: item.zapCount || 0
    }))
  
  // If no content with zaps, show empty state
  if (topContent.length === 0) {
    return {
      title: {
        text: 'Top Performing Content',
        textStyle: { color: '#7c2d12', fontSize: 14, fontWeight: 'bold' },
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: 'No zapped content yet'
      },
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '20%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['No data'],
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412', fontSize: 10 }
      },
      series: [{
        data: [0],
        type: 'bar',
        itemStyle: { color: '#e5e7eb' }
      }]
    }
  }
  
  return {
    title: {
      text: 'Top Performing Content',
      textStyle: { color: '#7c2d12', fontSize: 14, fontWeight: 'bold' },
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#f97316',
      textStyle: { color: '#374151' },
      formatter: function(params) {
        const data = params[0]
        const zapData = params[1]
        return `${data.name}<br/>Revenue: ${data.value.toLocaleString()} sats<br/>Zaps: ${zapData.value}`
      }
    },
    legend: {
      data: ['Revenue (sats)', 'Zap Count'],
      textStyle: { color: '#7c2d12', fontSize: 10 },
      top: '15%'
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '25%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: topContent.map(item => item.name),
      axisLine: { lineStyle: { color: '#fed7aa' } },
      axisTick: { lineStyle: { color: '#fed7aa' } },
      axisLabel: { 
        color: '#9a3412',
        fontSize: 9,
        rotate: window.innerWidth < 640 ? 45 : 0,
        interval: 0
      }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Revenue',
        nameTextStyle: { color: '#9a3412', fontSize: 10 },
        position: 'left',
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412', fontSize: 10 },
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } }
      },
      {
        type: 'value',
        name: 'Zaps',
        nameTextStyle: { color: '#9a3412', fontSize: 10 },
        position: 'right',
        axisLine: { lineStyle: { color: '#fed7aa' } },
        axisTick: { lineStyle: { color: '#fed7aa' } },
        axisLabel: { color: '#9a3412', fontSize: 10 }
      }
    ],
    series: [
      {
        name: 'Revenue (sats)',
        type: 'bar',
        yAxisIndex: 0,
        data: topContent.map(item => item.revenue),
        itemStyle: { 
          color: '#f97316',
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: 'Zap Count',
        type: 'line',
        yAxisIndex: 1,
        data: topContent.map(item => item.zapCount),
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
        symbol: 'circle',
        symbolSize: 6
      }
    ]
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Performance Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      <!-- Revenue Trend -->
      <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div v-if="echartsError" class="flex items-center justify-center h-[250px] lg:h-[300px]">
          <div class="text-center">
            <IconFileText class="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p class="text-red-600 text-sm">Failed to load chart</p>
          </div>
        </div>
        <div v-else-if="isEchartsLoaded && VChart" class="h-[250px] lg:h-[300px]">
          <VChart :autoresize="true" :option="revenueChartOption" class="w-full h-full" />
        </div>
        <div v-else class="flex items-center justify-center h-[250px] lg:h-[300px]">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
      
      <!-- Content Performance -->
      <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-orange-100/50 shadow-sm">
        <div v-if="echartsError" class="flex items-center justify-center h-[250px] lg:h-[300px]">
          <div class="text-center">
            <IconFileText class="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p class="text-red-600 text-sm">Failed to load chart</p>
          </div>
        </div>
        <div v-else-if="isEchartsLoaded && VChart" class="h-[250px] lg:h-[300px]">
          <VChart :autoresize="true" :option="performanceChartOption" class="w-full h-full" />
        </div>
        <div v-else class="flex items-center justify-center h-[250px] lg:h-[300px]">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      </div>
    </div>
    
    <!-- Simple Summary -->
    <div v-if="contentItems.length === 0" class="text-center py-8">
      <IconFileText class="w-12 h-12 mx-auto text-gray-300 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No content analytics yet</h3>
      <p class="text-gray-600">Create and publish your first blog post to see performance data.</p>
    </div>
    
    <div v-else-if="contentItems.filter(item => item.zapAmount > 0).length === 0" class="text-center py-8">
      <IconBolt class="w-12 h-12 mx-auto text-gray-300 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No zaps received yet</h3>
      <p class="text-gray-600">Share your content to start receiving Lightning zaps from readers.</p>
    </div>
  </div>
</template>

<style scoped>
/* Ensure charts are responsive */
.h-\[250px\] {
  height: 250px;
}

.h-\[300px\] {
  height: 300px;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .h-\[250px\] {
    height: 200px;
  }
  
  .h-\[300px\] {
    height: 220px;
  }
}

/* Loading spinner */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>