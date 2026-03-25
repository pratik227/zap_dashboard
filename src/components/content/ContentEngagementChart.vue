<script setup>
import { computed, ref, onMounted } from 'vue'
import { IconFileText, IconHeart } from '@iconify-prerendered/vue-tabler'
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '../../utils/constants.js'

const VChart = ref(null)
const echartsError = ref(null)
const isEchartsLoaded = ref(false)

onMounted(async () => {
  try {
    const { use } = await import('echarts/core')
    const { CanvasRenderer } = await import('echarts/renderers')
    const { BarChart } = await import('echarts/charts')
    const {
      TitleComponent,
      TooltipComponent,
      GridComponent,
      LegendComponent
    } = await import('echarts/components')
    const { default: VChartComponent } = await import('vue-echarts')

    use([CanvasRenderer, BarChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent])
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
  },
  getEngagementCounts: {
    type: Function,
    required: true
  }
})

const chartData = computed(() => {
  return props.contentItems
    .filter(item => item.status === 'published' && item.nostrEventId)
    .map(item => {
      const eng = props.getEngagementCounts(item.nostrEventId) || {}
      const likes = eng.likes || 0
      const reposts = eng.reposts || 0
      const bookmarks = eng.bookmarks || 0
      const zaps = item.zapCount || 0
      const name = item.title || 'Untitled'
      return {
        title: name.length > 20 ? name.substring(0, 20) + '...' : name,
        likes, reposts, bookmarks, zaps,
        total: likes + reposts + bookmarks + zaps
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .reverse()
})

const chartOption = computed(() => {
  const items = chartData.value
  const titles = items.map(p => p.title)

  return {
    title: {
      text: 'Engagement Breakdown',
      textStyle: { color: CHART_COLORS.titleText, fontSize: 14, fontWeight: 'bold' },
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      ...CHART_TOOLTIP_STYLE
    },
    legend: {
      data: ['Likes', 'Reposts', 'Bookmarks', 'Zaps'],
      textStyle: { color: CHART_COLORS.titleText, fontSize: 10 },
      top: '12%'
    },
    grid: {
      left: '3%',
      right: '5%',
      bottom: '5%',
      top: '25%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10 },
      splitLine: { lineStyle: { color: CHART_COLORS.splitLine, type: 'dashed' } }
    },
    yAxis: {
      type: 'category',
      data: titles,
      axisLine: { lineStyle: { color: CHART_COLORS.axisLine } },
      axisLabel: { color: CHART_COLORS.axisLabel, fontSize: 10, width: 100, overflow: 'truncate' }
    },
    series: [
      {
        name: 'Likes',
        type: 'bar',
        stack: 'engagement',
        data: items.map(p => p.likes),
        itemStyle: { color: CHART_COLORS.pink }
      },
      {
        name: 'Reposts',
        type: 'bar',
        stack: 'engagement',
        data: items.map(p => p.reposts),
        itemStyle: { color: CHART_COLORS.green }
      },
      {
        name: 'Bookmarks',
        type: 'bar',
        stack: 'engagement',
        data: items.map(p => p.bookmarks),
        itemStyle: { color: CHART_COLORS.blue }
      },
      {
        name: 'Zaps',
        type: 'bar',
        stack: 'engagement',
        data: items.map(p => p.zaps),
        itemStyle: { color: CHART_COLORS.primary, borderRadius: [0, 4, 4, 0] }
      }
    ]
  }
})
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-orange-100/50 shadow-sm">
    <!-- Empty state -->
    <div v-if="chartData.length === 0" class="flex items-center justify-center h-[250px] lg:h-[300px]">
      <div class="text-center">
        <IconHeart class="w-10 h-10 mx-auto text-gray-400 mb-2" />
        <h3 class="text-sm font-medium text-gray-900 mb-1">No engagement data yet</h3>
        <p class="text-xs text-gray-500">Publish content to see engagement breakdown.</p>
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
        <div v-for="i in 8" :key="i" class="flex-1 bg-gray-200/80 rounded-t" :style="{ height: `${20 + Math.sin(i * 0.7) * 30 + 30}%` }"></div>
      </div>
    </div>
  </div>
</template>
