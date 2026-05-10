<script setup>
import { ref, onMounted, computed } from 'vue'
import { lightningNetworkService } from '../../services/lightningNetworkService.js'
import {
  IconBolt,
  IconNetwork,
  IconUsers,
  IconCoins,
  IconWorld,
  IconServer,
  IconTrendingUp,
  IconActivity,
  IconLogin,
  IconZoomIn,
  IconExternalLink,
  IconInfoCircle
} from '@iconify-prerendered/vue-tabler'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent
])

const props = defineProps({
  hideAuthPrompts: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['trigger-login', 'show-help'])

const isLoading = ref(true)
const networkStats = ref(null)
const topNodesByCapacity = ref([])
const topNodesByConnectivity = ref([])
const nodesByCountry = ref([])
const ispRanking = ref(null)
const historicalData = ref([])
const activeTooltip = ref(null)

const tooltips = {
  channels: {
    title: 'Online Relays',
    description: 'Relays are the servers that carry Nostr events between apps. Online relays make publishing, reading, search, and discovery feel more reliable.',
    example: 'A higher online count means the dashboard has more healthy relays available for real-time Nostr activity.'
  },
  nodes: {
    title: 'Known Relays',
    description: 'This is the relay sample ZapTracker probes to estimate public Nostr network health.',
    example: 'Users can still connect their own relay set; this public sample is just a quick network pulse.'
  },
  capacity: {
    title: 'Event Throughput',
    description: 'This estimates how many public kind-1 notes the sampled relays saw in the last minute.',
    example: 'Throughput helps show whether the relay set is active right now, not just reachable.'
  },
  avgCapacity: {
    title: 'Average Response',
    description: 'The average time it took healthy relays to open a WebSocket connection or answer the count probe.',
    example: 'Lower response times usually mean faster feeds and smoother publishing.'
  },
  clearnet: {
    title: 'Relay Health',
    description: 'Healthy relays accepted a WebSocket connection and responded during the probe window.',
    pros: 'Useful for real-time feeds and publishing'
  },
  tor: {
    title: 'Offline Relays',
    description: 'Offline relays did not respond before the probe timed out.',
    pros: 'Users can route around them with a broader relay list'
  },
  hybrid: {
    title: 'NIP Support',
    description: 'NIP-11 relay info documents advertise which protocol features each relay supports.',
    pros: 'Search and auth support improve app features'
  },
  isp: {
    title: 'Relay Response Groups',
    description: 'Relays are grouped by response time so users can quickly see how responsive the sampled network is.',
    note: 'A mixed relay list is healthier than relying on one fast endpoint.'
  },
  topCountries: {
    title: 'Advertised NIP Support',
    description: 'This shows the most common protocol features advertised by the relays that responded to NIP-11.',
    example: 'NIP-50 means search support, and NIP-42 means relay authentication support.'
  },
  topNodesByCapacity: {
    title: 'Busiest Relays',
    description: 'These relays returned the highest recent event counts during the probe window.',
    example: 'Busy relays can be good discovery sources, but they are not always the fastest.'
  },
  topNodesByConnectivity: {
    title: 'Fastest Relays',
    description: 'These relays answered fastest during this browser-side health check.',
    example: 'Fast relays make feeds feel more immediate.'
  }
}

const showTooltip = (key) => {
  activeTooltip.value = key
}

const hideTooltip = () => {
  activeTooltip.value = null
}

const loadData = async () => {
  isLoading.value = true
  try {
    const [stats, topCap, topConn, countries, isp, historical] = await Promise.all([
      lightningNetworkService.getNetworkStats('latest'),
      lightningNetworkService.getTopNodesByCapacity(),
      lightningNetworkService.getTopNodesByConnectivity(),
      lightningNetworkService.getNodesByCountry(),
      lightningNetworkService.getISPRanking(),
      lightningNetworkService.getHistoricalStats()
    ])

    networkStats.value = stats.latest
    topNodesByCapacity.value = topCap.slice(0, 10)
    topNodesByConnectivity.value = topConn.slice(0, 10)
    nodesByCountry.value = countries.slice(0, 10)
    ispRanking.value = isp
    historicalData.value = historical
  } catch (error) {
    console.error('Failed to load Nostr network data:', error)
  } finally {
    isLoading.value = false
  }
}

const openRelay = (url) => {
  window.open(url.replace(/^wss:\/\//, 'https://'), '_blank')
}

const statsCards = computed(() => {
  if (!networkStats.value) return []

  const stats = networkStats.value
  return [
    {
      title: 'Online Relays',
      value: lightningNetworkService.formatNumber(stats.online_relays),
      icon: IconNetwork,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      subtitle: `${stats.offline_relays} offline in sample`,
      tooltipKey: 'channels'
    },
    {
      title: 'Known Relays',
      value: lightningNetworkService.formatNumber(stats.relay_count),
      icon: IconUsers,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      subtitle: 'Public relays probed',
      tooltipKey: 'nodes'
    },
    {
      title: 'Event Throughput',
      value: `${stats.events_per_second}/sec`,
      icon: IconCoins,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      subtitle: `${lightningNetworkService.formatNumber(stats.event_count)} events/min`,
      tooltipKey: 'capacity'
    },
    {
      title: 'Average Response',
      value: `${stats.avg_response_ms}ms`,
      icon: IconActivity,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      subtitle: `${stats.nip50_relays} search, ${stats.nip42_relays} auth`,
      tooltipKey: 'avgCapacity'
    }
  ]
})

const nodeTypeChart = computed(() => {
  if (!networkStats.value) return null

  const stats = networkStats.value
  const total = stats.relay_count || 1

  const nodeTypeInfo = {
    'Online': {
      description: 'Relays that accepted a WebSocket connection during the probe',
      benefits: 'Available for reading and publishing',
      security: 'Use multiple relays for resilience',
      value: stats.online_relays
    },
    'Offline': {
      description: 'Relays that failed or timed out during the probe',
      benefits: 'Avoided automatically by healthy relay selection',
      security: 'Failures are normal in decentralized relay sets',
      value: stats.offline_relays
    },
    'NIP-50 Search': {
      description: 'Online relays advertising NIP-50 search support',
      benefits: 'Better discovery and content lookup',
      security: 'Depends on each relay policy',
      value: stats.nip50_relays
    },
    'NIP-42 Auth': {
      description: 'Online relays advertising NIP-42 authentication support',
      benefits: 'Useful for permissioned relay workflows',
      security: 'Supports relay-side auth challenges',
      value: stats.nip42_relays
    }
  }

  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [20, 24],
      textStyle: {
        color: '#1f2937',
        fontSize: 14
      },
      extraCssText: 'box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 12px; max-width: 380px;',
      formatter: (params) => {
        const percent = ((params.value / total) * 100).toFixed(1)
        const info = nodeTypeInfo[params.name]
        return `<div style="font-weight: 700; margin-bottom: 10px; font-size: 16px; color: ${params.color};">${params.name}</div>
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; line-height: 1.5; font-style: italic;">${info.description}</div>
                <div style="background: #f9fafb; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                  <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">Relays: <strong style="color: #111827;">${params.value.toLocaleString()}</strong> (${percent}%)</div>
                  <div style="font-size: 12px; color: #059669; margin-bottom: 4px;">✓ ${info.benefits}</div>
                  <div style="font-size: 12px; color: #3b82f6;">🔒 ${info.security}</div>
                </div>`
      }
    },
    legend: {
      orient: 'horizontal',
      bottom: '5',
      left: 'center',
      itemGap: 24,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: {
        fontSize: 13,
        fontWeight: 600,
        color: '#374151'
      },
      icon: 'circle'
    },
        series: [
      {
        name: 'Node Types',
        type: 'pie',
        radius: ['52%', '82%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 4,
          shadowBlur: 15,
          shadowColor: 'rgba(0, 0, 0, 0.12)'
        },
        label: {
          show: false
        },
        labelLine: {
          show: false
        },
        emphasis: {
          scale: true,
          scaleSize: 12,
          itemStyle: {
            shadowBlur: 25,
            shadowColor: 'rgba(0, 0, 0, 0.25)',
            borderWidth: 5
          }
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: (idx) => idx * 100,
        data: [
          {
            value: stats.online_relays,
            name: 'Online',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#34d399' },
                  { offset: 1, color: '#059669' }
                ]
              }
            }
          },
          {
            value: stats.offline_relays,
            name: 'Offline',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#fbbf24' },
                  { offset: 1, color: '#d97706' }
                ]
              }
            }
          },
          {
            value: stats.nip50_relays,
            name: 'NIP-50 Search',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#60a5fa' },
                  { offset: 1, color: '#2563eb' }
                ]
              }
            }
          },
          {
            value: stats.nip42_relays,
            name: 'NIP-42 Auth',
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#a78bfa' },
                  { offset: 1, color: '#7c3aed' }
                ]
              }
            }
          }
        ]
      }
    ]
  }
})

const countryDistributionChart = computed(() => {
  if (nodesByCountry.value.length === 0) return null

  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(251, 191, 36, 0.1)'
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [16, 20],
      textStyle: {
        color: '#1f2937',
        fontSize: 14
      },
      extraCssText: 'box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 12px;',
      formatter: (params) => {
        const data = params[0]
        const country = nodesByCountry.value[data.dataIndex]
        return `<div style="font-weight: 700; margin-bottom: 8px; font-size: 15px; color: #f59e0b;">${country.name.en}</div>
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Relays: <strong style="color: #111827;">${country.count.toLocaleString()}</strong></div>
                <div style="font-size: 13px; color: #6b7280;">Sample share: <strong style="color: #059669;">${country.share}%</strong></div>`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => `${(value / 1000).toFixed(0)}K`
      }
    },
    yAxis: {
      type: 'category',
      data: nodesByCountry.value.map(c => c.iso),
      axisLabel: {
        fontSize: 11
      }
    },
    series: [
      {
        name: 'Relays',
        type: 'bar',
        data: nodesByCountry.value.map(c => ({
          value: c.count,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#f59e0b' },
                { offset: 1, color: '#f97316' }
              ]
            }
          }
        })),
        barMaxWidth: 30,
        label: {
          show: true,
          position: 'right',
          formatter: '{c}'
        }
      }
    ]
  }
})

const topISPChart = computed(() => {
  if (!ispRanking.value) return null

  const allISPs = ispRanking.value.ispRanking
  const threshold = 0.05
  const totalNodes = allISPs.reduce((sum, isp) => sum + isp[4], 0)

  const mainISPs = []
  let othersNodes = 0
  let othersCapacity = 0
  let othersChannels = 0
  let othersCount = 0

  allISPs.forEach(isp => {
    const share = isp[4] / totalNodes
    if (share >= threshold && mainISPs.length < 6) {
      mainISPs.push(isp)
    } else {
      othersNodes += isp[4]
      othersCapacity += isp[2]
      othersChannels += isp[3]
      othersCount++
    }
  })

  if (othersNodes > 0) {
    mainISPs.push([
      'others',
      `Others (${othersCount} providers)`,
      othersCapacity,
      othersChannels,
      othersNodes
    ])
  }

  const topISPs = mainISPs

  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [16, 20],
      textStyle: {
        color: '#1f2937',
        fontSize: 14
      },
      extraCssText: 'box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 12px;',
      formatter: (params) => {
        const isp = topISPs[params.dataIndex]
        const percent = ((isp[4] / totalNodes) * 100).toFixed(1)
        const avgEventsPerRelay = isp[2] / isp[4]
        const avgNipsPerRelay = (isp[3] / isp[4]).toFixed(0)

        let additionalInfo = ''
        if (isp[0] === 'others') {
          additionalInfo = `<div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; line-height: 1.5; font-style: italic;">Combined total from ${othersCount} smaller response groups</div>`
        } else {
          const ispTypes = {
            'Fast': 'Fast relays responded in under 500ms',
            'Steady': 'Steady relays responded between 500ms and 1200ms',
            'Slow': 'Slow relays responded after 1200ms'
          }

          const ispInfo = Object.keys(ispTypes).find(key => isp[1].includes(key))
          if (ispInfo) {
            additionalInfo = `<div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; line-height: 1.5; font-style: italic;">${ispTypes[ispInfo]}</div>`
          }
        }

        return `<div style="font-weight: 700; margin-bottom: 10px; font-size: 16px; color: ${params.color};">${isp[1]}</div>
                ${additionalInfo}
                <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="color: #6b7280; font-size: 13px;">Recent Events:</span>
                    <strong style="color: #111827; font-size: 13px; margin-left: 12px;">${lightningNetworkService.formatNumber(isp[2])}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="color: #6b7280; font-size: 13px;">Advertised NIPs:</span>
                    <strong style="color: #111827; font-size: 13px; margin-left: 12px;">${isp[3].toLocaleString()}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6b7280; font-size: 13px;">Relays:</span>
                    <strong style="color: #111827; font-size: 13px; margin-left: 12px;">${isp[4].toLocaleString()}</strong>
                  </div>
                </div>
                <div style="background: #eff6ff; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Avg per relay:</div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: #6b7280; font-size: 12px;">Events:</span>
                    <strong style="color: #3b82f6; font-size: 12px;">${lightningNetworkService.formatNumber(Math.round(avgEventsPerRelay))}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280; font-size: 12px;">NIPs:</span>
                    <strong style="color: #3b82f6; font-size: 12px;">${avgNipsPerRelay}</strong>
                  </div>
                </div>
                <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #6b7280; font-size: 13px;">Sample Share:</span>
                  <strong style="color: #059669; font-size: 15px; margin-left: 12px;">${percent}%</strong>
                </div>`
      }
    },
    legend: {
      orient: 'horizontal',
      bottom: '5',
      left: 'center',
      type: 'scroll',
      itemGap: 16,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: {
        fontSize: 12,
        fontWeight: 600,
        color: '#374151'
      },
      icon: 'circle',
      pageIconSize: 12,
      pageTextStyle: {
        color: '#6b7280'
      }
    },
    series: [
      {
        name: 'Hosting Providers',
        type: 'pie',
        radius: ['52%', '82%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 4,
          shadowBlur: 15,
          shadowColor: 'rgba(0, 0, 0, 0.12)'
        },
        label: {
          show: false
        },
        labelLine: {
          show: false
        },
        emphasis: {
          scale: true,
          scaleSize: 12,
          itemStyle: {
            shadowBlur: 25,
            shadowColor: 'rgba(0, 0, 0, 0.25)',
            borderWidth: 5
          }
        },
        animationType: 'scale',
        animationEasing: 'elasticOut',
        animationDelay: (idx) => idx * 80,
        data: topISPs.map((isp, index) => {
          const isOthers = isp[0] === 'others'
          const displayName = isp[1].length > 20 ? isp[1].substring(0, 20) + '...' : isp[1]

          const colors = [
            ['#60a5fa', '#2563eb'],
            ['#22d3ee', '#0891b2'],
            ['#a78bfa', '#7c3aed'],
            ['#f472b6', '#db2777'],
            ['#fbbf24', '#d97706'],
            ['#34d399', '#059669'],
            ['#fb7185', '#e11d48']
          ]

          const colorIndex = index % colors.length
          const [lightColor, darkColor] = isOthers ? ['#94a3b8', '#64748b'] : colors[colorIndex]

          return {
            value: isp[4],
            name: displayName,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: lightColor },
                  { offset: 1, color: darkColor }
                ]
              }
            }
          }
        })
      }
    ]
  }
})

onMounted(() => {
  loadData()
})
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<template>
  <div class="max-w-7xl mx-auto space-y-8">
    <!-- Hero Section -->
    <div class="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-3xl p-8 md:p-12 shadow-lg">
      <div class="absolute inset-0 bg-black/5"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center space-x-4">
            <div class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <IconBolt class="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 class="text-3xl md:text-4xl font-semibold text-white mb-2 tracking-tight">
                Nostr Network Explorer
              </h1>
              <p class="text-white/90 text-base">
                Relay health, response times, and public Nostr activity
              </p>
            </div>
          </div>
        </div>

        <div v-if="!hideAuthPrompts" class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex-1">
              <p class="text-white/90 text-base mb-2">
                Understand the relay network powering your Nostr activity
              </p>
              <p class="text-white text-sm">
                Connect your Nostr account to track zaps, relays, and publishing health
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="emit('trigger-login')"
                class="px-8 py-3.5 bg-white text-orange-600 font-medium rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap"
              >
                <IconLogin class="w-5 h-5" />
                <span>Connect with Nostr</span>
              </button>
              <button
                @click="emit('show-help')"
                class="px-8 py-3.5 bg-white/20 text-white font-medium rounded-xl hover:bg-white/30 transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap border border-white/30"
              >
                <IconExternalLink class="w-5 h-5" />
                <span>How It Works</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
        <p class="text-gray-600 text-lg">Loading Nostr network data...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-8">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="(card, index) in statsCards"
          :key="card.title"
          class="bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-all duration-200 border border-gray-200 relative"
        >
          <div class="flex items-start justify-between mb-4">
            <div :class="['w-12 h-12 rounded-xl flex items-center justify-center', card.bgColor]">
              <component :is="card.icon" :class="['w-6 h-6', card.textColor]" />
            </div>
            <button
              v-if="card.tooltipKey"
              @mouseenter="showTooltip(card.tooltipKey)"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <h3 class="text-gray-600 text-sm font-medium mb-2">{{ card.title }}</h3>
          <p class="text-3xl font-semibold text-gray-900 mb-1">{{ card.value }}</p>
          <p class="text-xs text-gray-500">{{ card.subtitle }}</p>

          <!-- Tooltip - Responsive positioning -->
          <div
            v-if="activeTooltip === card.tooltipKey"
            :class="[
              'absolute pointer-events-none z-[9999] w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700',
              // Mobile: Show below
              'top-full mt-2 left-1/2 -translate-x-1/2',
              // Medium screens (2 columns): Even on right, odd on left
              'md:top-0 md:translate-x-0',
              index % 2 === 0 ? 'md:left-full md:ml-4' : 'md:right-full md:mr-4',
              // Large screens (4 columns): 0-1 on right, 2-3 on left
              'lg:top-0',
              index % 4 < 2 ? 'lg:left-full lg:right-auto lg:ml-4 lg:mr-0' : 'lg:right-full lg:left-auto lg:mr-4 lg:ml-0'
            ]"
            style="animation: fadeIn 0.2s ease-out"
          >
            <!-- Arrow - positioned based on screen size -->
            <div
              :class="[
                'absolute w-3 h-3 bg-gray-900 border-gray-700 transform rotate-45',
                // Mobile: Arrow on top center
                'border-l border-t -top-1.5 left-1/2 -translate-x-1/2',
                // Medium: Even cards arrow on left, odd on right
                'md:top-8 md:translate-x-0',
                index % 2 === 0 ? 'md:border-l md:border-t md:-left-1.5 md:left-auto' : 'md:border-r md:border-b md:-right-1.5 md:right-auto',
                // Large: 0-1 arrow on left, 2-3 on right
                'lg:top-8',
                index % 4 < 2 ? 'lg:border-l lg:border-t lg:border-r-0 lg:border-b-0 lg:-left-1.5 lg:right-auto' : 'lg:border-r lg:border-b lg:border-l-0 lg:border-t-0 lg:-right-1.5 lg:left-auto'
              ]"
            ></div>
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips[card.tooltipKey].title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed mb-3">{{ tooltips[card.tooltipKey].description }}</p>
            <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <p class="text-xs text-gray-400 italic">{{ tooltips[card.tooltipKey].example }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Row 1 - Two Pie Charts Side by Side -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Node Types Pie Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <IconNetwork class="w-5 h-5 text-orange-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Relay Health</h3>
                <p class="text-sm text-gray-500">Availability and advertised relay capabilities</p>
              </div>
            </div>
            <button
              @mouseenter="showTooltip('clearnet')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>

          <!-- Tooltip - Responsive -->
          <div
            v-if="activeTooltip === 'clearnet'"
            class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <h4 class="font-medium text-sm mb-3 text-white">Understanding Relay Health</h4>
            <div class="space-y-3">
              <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p class="text-xs font-medium text-green-400 mb-1">Online</p>
                <p class="text-xs text-gray-300">Relays that accepted a WebSocket connection during the probe.</p>
              </div>
              <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p class="text-xs font-medium text-purple-400 mb-1">NIP-50</p>
                <p class="text-xs text-gray-300">Relays advertising search support in their NIP-11 metadata.</p>
              </div>
              <div class="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <p class="text-xs font-medium text-blue-400 mb-1">NIP-42</p>
                <p class="text-xs text-gray-300">Relays advertising authentication challenge support.</p>
              </div>
            </div>
          </div>
          <VChart
            v-if="nodeTypeChart"
            :option="nodeTypeChart"
            class="w-full"
            style="height: 320px;"
            autoresize
          />
        </div>

        <!-- Top Hosting Providers Pie Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                <IconServer class="w-5 h-5 text-cyan-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Response Groups</h3>
                <p class="text-sm text-gray-500">Relays grouped by browser-side response time</p>
              </div>
            </div>
            <button
              @mouseenter="showTooltip('isp')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>

          <!-- Tooltip - Responsive -->
          <div
            v-if="activeTooltip === 'isp'"
            class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.isp.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed mb-3">{{ tooltips.isp.description }}</p>
            <div class="bg-green-900/30 rounded-lg p-3 border border-green-700">
              <p class="text-xs text-green-300">💡 {{ tooltips.isp.note }}</p>
            </div>
          </div>
          <VChart
            v-if="topISPChart"
            :option="topISPChart"
            class="w-full"
            style="height: 320px;"
            autoresize
          />
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- NIP Support Bar Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <IconWorld class="w-5 h-5 text-blue-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">NIP Support</h3>
                <p class="text-sm text-gray-500">Most common protocol features advertised by relays</p>
              </div>
            </div>
            <button
              @mouseenter="showTooltip('topCountries')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>

          <!-- Tooltip - Responsive -->
          <div
            v-if="activeTooltip === 'topCountries'"
            class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.topCountries.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed mb-3">{{ tooltips.topCountries.description }}</p>
            <div class="bg-green-900/30 rounded-lg p-3 border border-green-700">
              <p class="text-xs text-green-300">💡 {{ tooltips.topCountries.example }}</p>
            </div>
          </div>
          <VChart
            v-if="countryDistributionChart"
            :option="countryDistributionChart"
            class="w-full"
            style="height: 320px;"
            autoresize
          />
        </div>

        <!-- Top Nodes by Capacity -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <IconTrendingUp class="w-5 h-5 text-green-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Busiest Relays</h3>
                <p class="text-sm text-gray-500">Highest recent kind-1 event counts in the relay sample</p>
              </div>
            </div>
            <button
              @mouseenter="showTooltip('topNodesByCapacity')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>

          <!-- Tooltip - Responsive -->
          <div
            v-if="activeTooltip === 'topNodesByCapacity'"
            class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.topNodesByCapacity.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed mb-3">{{ tooltips.topNodesByCapacity.description }}</p>
            <div class="bg-blue-900/30 rounded-lg p-3 border border-blue-700">
              <p class="text-xs text-blue-300">💡 {{ tooltips.topNodesByCapacity.example }}</p>
            </div>
          </div>
          <div class="space-y-2 max-h-80 overflow-y-auto">
            <div
              v-for="(node, index) in topNodesByCapacity"
              :key="node.publicKey"
              @click="openRelay(node.url)"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-orange-50 hover:shadow-sm transition-all cursor-pointer group border border-transparent hover:border-orange-200"
            >
              <div class="flex items-center space-x-3 flex-1 min-w-0">
                <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                  {{ index + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate group-hover:text-orange-600 transition-colors">{{ node.alias }}</p>
                  <p class="text-xs text-gray-500">{{ node.channels }} advertised NIPs</p>
                </div>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
                <div class="text-right">
                  <p class="text-sm font-semibold text-green-600">
                    {{ lightningNetworkService.formatSats(node.capacity) }}
                  </p>
                </div>
                <IconExternalLink class="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Call to Action -->
      <div v-if="!hideAuthPrompts" class="bg-white border border-gray-200 rounded-3xl p-12 md:p-16 shadow-sm">
        <div class="max-w-2xl mx-auto text-center">
          <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <IconZoomIn class="w-7 h-7 text-gray-400" />
          </div>
          <h2 class="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 tracking-tight">
            Ready to Track Your Nostr Activity?
          </h2>
          <p class="text-gray-600 text-base mb-10 leading-relaxed max-w-xl mx-auto">
            Connect your Nostr account to unlock analytics for your zaps, campaigns, and relay activity.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              @click="emit('trigger-login')"
              class="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <IconLogin class="w-5 h-5" />
              <span>Connect with Nostr</span>
            </button>
            <button
              @click="emit('show-help')"
              class="px-8 py-3.5 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2 border border-gray-300"
            >
              <IconExternalLink class="w-5 h-5" />
              <span>How It Works</span>
            </button>
          </div>
          <p class="text-gray-400 text-sm mt-8">
            No sign-up required • Privacy-first • Open protocol
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
