<script setup>
import { ref, onMounted, computed } from 'vue'
import { lightningNetworkService } from '../services/lightningNetworkService.js'
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
  IconExternalLink
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

const emit = defineEmits(['trigger-login', 'show-help'])

const isLoading = ref(true)
const networkStats = ref(null)
const topNodesByCapacity = ref([])
const topNodesByConnectivity = ref([])
const nodesByCountry = ref([])
const ispRanking = ref(null)
const historicalData = ref([])

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
    console.error('Failed to load Lightning Network data:', error)
  } finally {
    isLoading.value = false
  }
}

const openNodeOnAmboss = (publicKey) => {
  window.open(`https://amboss.space/node/${publicKey}`, '_blank')
}

const statsCards = computed(() => {
  if (!networkStats.value) return []

  const stats = networkStats.value
  return [
    {
      title: 'Total Channels',
      value: lightningNetworkService.formatNumber(stats.channel_count),
      icon: IconNetwork,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      subtitle: 'Active payment channels'
    },
    {
      title: 'Network Nodes',
      value: lightningNetworkService.formatNumber(stats.node_count),
      icon: IconUsers,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      subtitle: 'Connected Lightning nodes'
    },
    {
      title: 'Total Capacity',
      value: lightningNetworkService.formatSats(stats.total_capacity),
      icon: IconCoins,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      subtitle: 'Network liquidity'
    },
    {
      title: 'Average Capacity',
      value: lightningNetworkService.formatSats(stats.avg_capacity),
      icon: IconActivity,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      subtitle: 'Per channel'
    }
  ]
})

const nodeTypeChart = computed(() => {
  if (!networkStats.value) return null

  const stats = networkStats.value
  const total = stats.clearnet_nodes + stats.tor_nodes + stats.clearnet_tor_nodes + stats.unannounced_nodes

  const nodeTypeInfo = {
    'Clearnet': {
      description: 'Public nodes accessible via standard internet',
      benefits: 'Fast connections, easy to reach, better for routing',
      security: 'IP address visible to network',
      value: stats.clearnet_nodes
    },
    'Tor': {
      description: 'Anonymous nodes accessible only via Tor network',
      benefits: 'Enhanced privacy, hidden IP address',
      security: 'Maximum anonymity, slower connections',
      value: stats.tor_nodes
    },
    'Clearnet + Tor': {
      description: 'Hybrid nodes accessible via both networks',
      benefits: 'Best of both worlds - privacy option with speed',
      security: 'Flexible connectivity, balanced approach',
      value: stats.clearnet_tor_nodes
    },
    'Unannounced': {
      description: 'Private nodes not advertised to the network',
      benefits: 'Maximum privacy, used for personal channels',
      security: 'Not visible in public network graph',
      value: stats.unannounced_nodes
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
                  <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">Nodes: <strong style="color: #111827;">${params.value.toLocaleString()}</strong> (${percent}%)</div>
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
            value: stats.clearnet_nodes,
            name: 'Clearnet',
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
            value: stats.tor_nodes,
            name: 'Tor',
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
            value: stats.clearnet_tor_nodes,
            name: 'Clearnet + Tor',
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
            value: stats.unannounced_nodes,
            name: 'Unannounced',
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
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">Nodes: <strong style="color: #111827;">${country.count.toLocaleString()}</strong></div>
                <div style="font-size: 13px; color: #6b7280;">Share: <strong style="color: #059669;">${country.share}%</strong></div>`
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
        name: 'Nodes',
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
        const avgCapacityPerNode = isp[2] / isp[4]
        const avgChannelsPerNode = (isp[3] / isp[4]).toFixed(0)

        let additionalInfo = ''
        if (isp[0] === 'others') {
          additionalInfo = `<div style="font-size: 12px; color: #6b7280; margin-bottom: 10px; line-height: 1.5; font-style: italic;">Combined total from ${othersCount} smaller hosting providers</div>`
        } else {
          const ispTypes = {
            'DigitalOcean': 'Popular cloud platform known for developer-friendly VPS hosting',
            'Amazon': 'AWS - World\'s largest cloud infrastructure provider',
            'Google': 'Google Cloud Platform with global network infrastructure',
            'Hetzner': 'European provider known for cost-effective dedicated servers',
            'OVH': 'European hosting giant with data centers worldwide',
            'Contabo': 'Budget-friendly German hosting provider'
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
                    <span style="color: #6b7280; font-size: 13px;">Total Capacity:</span>
                    <strong style="color: #111827; font-size: 13px; margin-left: 12px;">${lightningNetworkService.formatSats(isp[2])}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="color: #6b7280; font-size: 13px;">Channels:</span>
                    <strong style="color: #111827; font-size: 13px; margin-left: 12px;">${isp[3].toLocaleString()}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6b7280; font-size: 13px;">Nodes:</span>
                    <strong style="color: #111827; font-size: 13px; margin-left: 12px;">${isp[4].toLocaleString()}</strong>
                  </div>
                </div>
                <div style="background: #eff6ff; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                  <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">📊 Avg per node:</div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span style="color: #6b7280; font-size: 12px;">Capacity:</span>
                    <strong style="color: #3b82f6; font-size: 12px;">${lightningNetworkService.formatSats(avgCapacityPerNode)}</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #6b7280; font-size: 12px;">Channels:</span>
                    <strong style="color: #3b82f6; font-size: 12px;">${avgChannelsPerNode}</strong>
                  </div>
                </div>
                <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #6b7280; font-size: 13px;">Market Share:</span>
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

<template>
  <div class="max-w-7xl mx-auto space-y-8">
    <!-- Hero Section -->
    <div class="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-3xl p-8 md:p-12 shadow-2xl">
      <div class="absolute inset-0 bg-black/10"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center space-x-4">
            <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <IconBolt class="w-10 h-10 text-white animate-pulse" />
            </div>
            <div>
              <h1 class="text-3xl md:text-4xl font-bold text-white mb-2">
                Lightning Network Explorer
              </h1>
              <p class="text-white/90 text-lg">
                Real-time insights into Bitcoin's Lightning Network
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex-1">
              <p class="text-white/90 text-base mb-2">
                Discover the power of instant, low-cost Bitcoin transactions
              </p>
              <p class="text-white text-sm">
                Connect your Nostr account to track your Lightning earnings and analyze your zap data
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-4">
              <button
                @click="emit('trigger-login')"
                class="px-8 py-4 bg-white text-orange-600 font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3 whitespace-nowrap"
              >
                <IconLogin class="w-6 h-6" />
                <span>Connect with Nostr</span>
              </button>
              <button
                @click="emit('show-help')"
                class="px-8 py-4 bg-orange-600 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3 whitespace-nowrap border-2 border-white/30"
              >
                <IconExternalLink class="w-6 h-6" />
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
        <p class="text-gray-600 text-lg">Loading Lightning Network data...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="space-y-8">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="card in statsCards"
          :key="card.title"
          class="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-100"
        >
          <div class="flex items-start justify-between mb-4">
            <div :class="['w-14 h-14 rounded-2xl flex items-center justify-center', card.bgColor]">
              <component :is="card.icon" :class="['w-8 h-8', card.textColor]" />
            </div>
          </div>
          <h3 class="text-gray-600 text-sm font-medium mb-2">{{ card.title }}</h3>
          <p class="text-3xl font-bold text-gray-900 mb-1">{{ card.value }}</p>
          <p class="text-xs text-gray-500">{{ card.subtitle }}</p>
        </div>
      </div>

      <!-- Charts Row 1 - Two Pie Charts Side by Side -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Node Types Pie Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <IconNetwork class="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Node Distribution</h3>
                <p class="text-sm text-gray-500">Network connectivity types (Clearnet, Tor, Hybrid)</p>
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
        <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                <IconServer class="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Top Hosting Providers</h3>
                <p class="text-sm text-gray-500">Infrastructure providers by node distribution</p>
              </div>
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
        <!-- Top Countries Bar Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <IconWorld class="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Top Countries</h3>
                <p class="text-sm text-gray-500">Geographic distribution of Lightning nodes globally</p>
              </div>
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
        <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <IconTrendingUp class="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Top Nodes by Liquidity</h3>
                <p class="text-sm text-gray-500">Highest capacity routing nodes on the network</p>
              </div>
            </div>
          </div>
          <div class="space-y-3 max-h-80 overflow-y-auto">
            <div
              v-for="(node, index) in topNodesByCapacity"
              :key="node.publicKey"
              @click="openNodeOnAmboss(node.publicKey)"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-orange-50 hover:shadow-md transition-all cursor-pointer group"
            >
              <div class="flex items-center space-x-3 flex-1 min-w-0">
                <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {{ index + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{{ node.alias }}</p>
                  <p class="text-xs text-gray-500">{{ node.channels }} channels</p>
                </div>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
                <div class="text-right">
                  <p class="text-sm font-bold text-green-600">
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
      <div class="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl p-8 md:p-12 shadow-2xl">
        <div class="max-w-3xl mx-auto text-center">
          <div class="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6">
            <IconZoomIn class="w-12 h-12 text-white" />
          </div>
          <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Track Your Lightning Earnings?
          </h2>
          <p class="text-white/90 text-lg mb-8 leading-relaxed">
            Connect your Nostr account to unlock powerful analytics for your zaps, campaigns, and Lightning Network activity.
            See who's supporting your content, track engagement, and optimize your strategy.
          </p>
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              @click="emit('trigger-login')"
              class="px-10 py-5 bg-white text-blue-600 font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3"
            >
              <IconLogin class="w-6 h-6" />
              <span>Connect with Nostr</span>
            </button>
            <button
              @click="emit('show-help')"
              class="px-10 py-5 bg-blue-600 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-3 border-2 border-white/30"
            >
              <IconExternalLink class="w-6 h-6" />
              <span>How It Works</span>
            </button>
          </div>
          <p class="text-white/80 text-sm mt-6">
            No sign-up required • Privacy-first • Open protocol
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
