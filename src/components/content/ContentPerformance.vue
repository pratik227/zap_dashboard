<script setup>
import { computed, ref, onMounted } from 'vue'
import { IconBolt, IconFileText } from '@iconify-prerendered/vue-tabler'
import { CHART_COLORS, CHART_TOOLTIP_STYLE, chartAreaGradient } from '../../utils/constants.js'

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
      textStyle: { color: CHART_COLORS.titleText, fontSize: 14, fontWeight: 'bold' },
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      ...CHART_TOOLTIP_STYLE,
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
      axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: {
        color: CHART_COLORS.axisLabel,
        fontSize: 10,
        rotate: window.innerWidth < 640 ? 45 : 0
      }
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: {
        color: CHART_COLORS.axisLabel,
        fontSize: 10
      },
      splitLine: {
        lineStyle: { color: CHART_COLORS.splitLine, type: 'dashed' }
      }
    },
    series: [{
      data: last7Days.map(d => d.revenue),
      type: 'line',
      smooth: true,
      lineStyle: { color: CHART_COLORS.primary, width: 2 },
      itemStyle: { color: CHART_COLORS.primary },
      areaStyle: { color: chartAreaGradient() }
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
    .map(item => {
      const title = item.title || 'Untitled'
      return {
        name: title.length > 15 ? title.substring(0, 15) + '...' : title,
        revenue: item.zapAmount || 0,
        zapCount: item.zapCount || 0
      }
    })
  
  // If no content with zaps, show empty state
  if (topContent.length === 0) {
    return {
      title: {
        text: 'Top Performing Content',
        textStyle: { color: CHART_COLORS.titleText, fontSize: 14, fontWeight: 'bold' },
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
        axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 }
      },
      series: [{
        data: [0],
        type: 'bar',
        itemStyle: { color: CHART_COLORS.emptyBar }
      }]
    }
  }

  return {
    title: {
      text: 'Top Performing Content',
      textStyle: { color: CHART_COLORS.titleText, fontSize: 14, fontWeight: 'bold' },
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      ...CHART_TOOLTIP_STYLE,
      formatter: function(params) {
        const data = params[0]
        const zapData = params[1]
        return `${data.name}<br/>Revenue: ${data.value.toLocaleString()} sats<br/>Zaps: ${zapData.value}`
      }
    },
    legend: {
      data: ['Revenue (sats)', 'Zap Count'],
      textStyle: { color: CHART_COLORS.titleText, fontSize: 10 },
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
      axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: {
        color: CHART_COLORS.axisLabel,
        fontSize: 9,
        rotate: window.innerWidth < 640 ? 45 : 0,
        interval: 0
      }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Revenue',
        nameTextStyle: { color: CHART_COLORS.axisLabel, fontSize: 10 },
        position: 'left',
        axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_COLORS.splitLine, type: 'dashed' } }
      },
      {
        type: 'value',
        name: 'Zaps',
        nameTextStyle: { color: CHART_COLORS.axisLabel, fontSize: 10 },
        position: 'right',
        axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisTick: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 }
      }
    ],
    series: [
      {
        name: 'Revenue (sats)',
        type: 'bar',
        yAxisIndex: 0,
        data: topContent.map(item => item.revenue),
        itemStyle: {
          color: CHART_COLORS.primary,
          borderRadius: [4, 4, 0, 0]
        }
      },
      {
        name: 'Zap Count',
        type: 'line',
        yAxisIndex: 1,
        data: topContent.map(item => item.zapCount),
        lineStyle: { color: CHART_COLORS.emerald, width: 2 },
        itemStyle: { color: CHART_COLORS.emerald },
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
        <div v-else class="h-[250px] lg:h-[300px] animate-pulse">
          <div class="h-full bg-gray-100 rounded-lg flex items-end justify-around px-4 pb-4 gap-2">
            <div v-for="i in 7" :key="'r'+i" class="flex-1 bg-gray-200/80 rounded-t" :style="{ height: `${20 + Math.sin(i) * 30 + 30}%` }"></div>
          </div>
        </div>
      </div>

      <!-- Content Performance -->
      <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-gray-200/60 shadow-sm">
        <div v-if="echartsError" class="flex items-center justify-center h-[250px] lg:h-[300px]">
          <div class="text-center">
            <IconFileText class="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p class="text-red-600 text-sm">Failed to load chart</p>
          </div>
        </div>
        <div v-else-if="isEchartsLoaded && VChart" class="h-[250px] lg:h-[300px]">
          <VChart :autoresize="true" :option="performanceChartOption" class="w-full h-full" />
        </div>
        <div v-else class="h-[250px] lg:h-[300px] animate-pulse">
          <div class="h-full bg-gray-100 rounded-lg flex items-end justify-around px-4 pb-4 gap-3">
            <div v-for="i in 6" :key="'p'+i" class="flex-1 bg-gray-200/80 rounded-t" :style="{ height: `${15 + i * 12}%` }"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Simple Summary -->
    <div v-if="contentItems.length === 0" class="text-center py-8">
      <IconFileText class="w-12 h-12 mx-auto text-gray-400 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No content analytics yet</h3>
      <p class="text-gray-600">Create and publish your first blog post to see performance data.</p>
    </div>
    
    <div v-else-if="contentItems.filter(item => item.zapAmount > 0).length === 0" class="text-center py-8">
      <IconBolt class="w-12 h-12 mx-auto text-gray-400 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No zaps received yet</h3>
      <p class="text-gray-600">Share your content to start receiving Lightning zaps from readers.</p>
    </div>
  </div>
</template>
