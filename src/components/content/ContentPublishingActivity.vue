<script setup>
import { computed, ref, onMounted } from 'vue'
import { IconFileText, IconCalendar } from '@iconify-prerendered/vue-tabler'
import { CHART_COLORS, CHART_TOOLTIP_STYLE, chartAreaGradient } from '../../utils/constants.js'

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

    use([CanvasRenderer, LineChart, BarChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent])
    VChart.value = VChartComponent
    isEchartsLoaded.value = true
  } catch (error) {
    echartsError.value = error.message
  }
})

const props = defineProps({
  contentItems: {
    type: Array,
    required: true
  }
})

const publishedItems = computed(() => {
  return props.contentItems.filter(item => item.status === 'published' && item.publishedAt)
})

const chartOption = computed(() => {
  const items = publishedItems.value

  // Bucket by month
  const monthMap = {}
  for (const item of items) {
    const date = new Date(item.publishedAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!monthMap[key]) {
      monthMap[key] = { articles: 0, revenue: 0 }
    }
    monthMap[key].articles++
    monthMap[key].revenue += item.zapAmount || 0
  }

  const sortedMonths = Object.keys(monthMap).sort()
  const labels = sortedMonths.map(m => {
    const [y, mo] = m.split('-')
    return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  })

  return {
    title: {
      text: 'Publishing Activity',
      textStyle: { color: CHART_COLORS.titleText, fontSize: 14, fontWeight: 'bold' },
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      ...CHART_TOOLTIP_STYLE,
      formatter: function (params) {
        let result = params[0].name
        for (const p of params) {
          const unit = p.seriesName === 'Revenue' ? ' sats' : ''
          result += `<br/>${p.marker} ${p.seriesName}: ${p.value.toLocaleString()}${unit}`
        }
        return result
      }
    },
    legend: {
      data: ['Articles', 'Revenue'],
      textStyle: { color: CHART_COLORS.titleText, fontSize: 10 },
      top: '12%'
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '10%',
      top: '25%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Articles',
        nameTextStyle: { color: CHART_COLORS.axisLabel, fontSize: 10 },
        position: 'left',
        minInterval: 1,
        axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 },
        splitLine: { lineStyle: { color: CHART_COLORS.splitLine, type: 'dashed' } }
      },
      {
        type: 'value',
        name: 'Revenue',
        nameTextStyle: { color: CHART_COLORS.axisLabel, fontSize: 10 },
        position: 'right',
        axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
        axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 }
      }
    ],
    series: [
      {
        name: 'Articles',
        type: 'bar',
        yAxisIndex: 0,
        data: sortedMonths.map(m => monthMap[m].articles),
        itemStyle: { color: CHART_COLORS.green, borderRadius: [4, 4, 0, 0] }
      },
      {
        name: 'Revenue',
        type: 'line',
        yAxisIndex: 1,
        data: sortedMonths.map(m => monthMap[m].revenue),
        smooth: true,
        lineStyle: { color: CHART_COLORS.primary, width: 2 },
        itemStyle: { color: CHART_COLORS.primary },
        areaStyle: { color: chartAreaGradient(0.2, 0.02) }
      }
    ]
  }
})
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-orange-100/50 shadow-sm">
    <!-- Empty state -->
    <div v-if="publishedItems.length === 0" class="flex items-center justify-center h-[250px] lg:h-[300px]">
      <div class="text-center">
        <IconCalendar class="w-10 h-10 mx-auto text-gray-400 mb-2" />
        <h3 class="text-sm font-medium text-gray-900 mb-1">No publishing activity yet</h3>
        <p class="text-xs text-gray-500">Publish content to see your activity timeline.</p>
      </div>
    </div>
    <!-- Error state -->
    <div v-else-if="echartsError" class="flex items-center justify-center h-[250px] lg:h-[300px]">
      <div class="text-center">
        <IconFileText class="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p class="text-red-600 text-sm">Failed to load chart</p>
      </div>
    </div>
    <!-- Chart -->
    <div v-else-if="isEchartsLoaded && VChart" class="h-[250px] lg:h-[300px]">
      <VChart :autoresize="true" :option="chartOption" class="w-full h-full" />
    </div>
    <!-- Loading (skeleton) -->
    <div v-else class="h-[250px] lg:h-[300px] animate-pulse">
      <div class="h-full bg-gray-100 rounded-lg flex items-end justify-around px-4 pb-4 gap-2">
        <div v-for="i in 10" :key="i" class="flex-1 bg-gray-200/80 rounded-t" :style="{ height: `${10 + i * 8}%` }"></div>
      </div>
    </div>
  </div>
</template>
