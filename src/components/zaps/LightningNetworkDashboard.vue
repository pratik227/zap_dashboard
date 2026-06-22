<script setup>
import { ref, onMounted, computed } from 'vue'
import { nostrNetworkService } from '../../utils/network/nostrNetworkService.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import {
  IconBolt,
  IconNetwork,
  IconUsers,
  IconPlugConnected,
  IconWorld,
  IconServer,
  IconTrendingUp,
  IconActivity,
  IconLogin,
  IconZoomIn,
  IconExternalLink,
  IconInfoCircle,
  IconSearch,
  IconShield,
  IconZzz,
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
const relayCapabilities = ref(null)
const relayManagerStats = ref(null)
const activeTooltip = ref(null)

const tooltips = {
  relays: {
    title: 'Nostr Relays',
    description: 'Relays are the backbone of the Nostr network. They receive, store, and forward events. Unlike traditional servers, anyone can run a relay and there\'s no single point of failure.',
    example: 'Running a relay helps decentralize the network. Even a small VPS can handle hundreds of connections!'
  },
  online: {
    title: 'Online Relays',
    description: 'Relays currently accepting WebSocket connections. High availability means the network is healthy and events propagate quickly.',
    example: 'When you post a note, it gets sent to multiple online relays. The more online relays, the more resilient your content is.'
  },
  search: {
    title: 'NIP-50 Search',
    description: 'Relays that support content search. They index event content so you can find old notes, find people, and discover content.',
    example: 'NIP-50 allows you to search for "bitcoin" across all events on a relay, not just recent ones.'
  },
  nips: {
    title: 'NIP Support',
    description: 'Nostr Implementation Possibilities (NIPs) are standards that relays can choose to implement. More NIP support means more features like DMs, zaps, search, and authentication.',
    example: 'A relay supporting NIP-57 (Zaps) lets you send Bitcoin tips through Nostr!'
  },
  auth: {
    title: 'NIP-42 Authentication',
    description: 'Authenticated relays require clients to prove their identity. This helps prevent spam and allows relay operators to offer premium features.',
    example: 'Some relays restrict event publishing to authenticated users only with NIP-42.'
  },
  health: {
    title: 'Your Relay Health',
    description: 'Shows the connection status of relays you are personally connected to through your Nostr client.',
    example: 'If you see many disconnected relays, check your internet connection or try different relays.'
  }
}

const showTooltip = (key) => { activeTooltip.value = key }
const hideTooltip = () => { activeTooltip.value = null }

const loadData = async () => {
  isLoading.value = true
  try {
    const [globalStats, relayMgrStats] = await Promise.all([
      nostrNetworkService.getGlobalStats(),
      nostrRelayManager.ready().then(() => nostrRelayManager.getConnectionStats()).catch(() => null),
    ])

    networkStats.value = globalStats
    relayCapabilities.value = globalStats.relayCapabilities
    relayManagerStats.value = relayMgrStats
  } catch (error) {
    console.error('Failed to load Nostr network data:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})

const topNipsByAdoption = computed(() => {
  if (!relayCapabilities.value?.nipSupport) return []
  return relayCapabilities.value.nipSupport
    .filter(n => n.percentage >= 30)
    .slice(0, 12)
})

const topRelayList = computed(() => {
  if (!relayCapabilities.value?.relays) return []
  return relayCapabilities.value.relays
    .filter(r => r.supported)
    .sort((a, b) => (b.nips?.length || 0) - (a.nips?.length || 0))
    .slice(0, 10)
})

const statsCards = computed(() => {
  if (!networkStats.value) return []

  return [
    {
      title: 'Online Relays',
      value: networkStats.value.onlineRelays?.toLocaleString() || 'N/A',
      icon: IconPlugConnected,
      color: 'from-fuchsia-500 to-purple-500',
      bgColor: 'bg-fuchsia-50',
      textColor: 'text-fuchsia-600',
      subtitle: `of ${networkStats.value.totalRelays?.toLocaleString() || '?'} known relays`,
      tooltipKey: 'online',
      badge: `${networkStats.value.onlinePercentage || 0}%`,
      badgeColor: 'bg-green-50 text-green-700',
    },
    {
      title: 'Known Relays',
      value: networkStats.value.totalRelays?.toLocaleString() || 'N/A',
      icon: IconWorld,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      subtitle: 'In the Nostr network',
      tooltipKey: 'relays',
    },
    {
      title: 'NIP-50 Search',
      value: networkStats.value.searchSupportCount?.toLocaleString() || 'N/A',
      icon: IconSearch,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      subtitle: 'Relays with content search',
      tooltipKey: 'search',
    },
    {
      title: 'NIP-42 Auth',
      value: networkStats.value.authSupportCount?.toLocaleString() || 'N/A',
      icon: IconShield,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      subtitle: 'Authenticated relays',
      tooltipKey: 'auth',
    },
  ]
})

const nipAdoptionChart = computed(() => {
  if (topNipsByAdoption.value.length === 0) return null

  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [16, 20],
      textStyle: { color: '#1f2937', fontSize: 14 },
      extraCssText: 'box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 12px;',
      formatter: (params) => {
        const data = params[0]
        const nip = topNipsByAdoption.value[data.dataIndex]
        return `<div style="font-weight: 700; margin-bottom: 8px; font-size: 15px; color: #7c3aed;">NIP-${nip.nip}: ${nip.description}</div>
                <div style="font-size: 13px; color: #6b7280;">Adoption: <strong style="color: #059669;">${nip.percentage}%</strong> (${nip.count}/${nip.total} relays)</div>`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: topNipsByAdoption.value.map(n => `NIP-${n.nip}`),
      axisLabel: { rotate: 45, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%' },
    },
    series: [{
      name: 'Adoption',
      type: 'bar',
      data: topNipsByAdoption.value.map(n => ({
        value: n.percentage,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#a855f7' },
              { offset: 1, color: '#7c3aed' }
            ]
          },
          borderRadius: [4, 4, 0, 0],
        }
      })),
      barMaxWidth: 30,
      label: {
        show: true,
        position: 'top',
        formatter: '{c}%',
        fontSize: 10,
      }
    }]
  }
})

const relayDistributionChart = computed(() => {
  if (!networkStats.value) return null

  const relayMgr = relayManagerStats.value
  const connectedCount = relayMgr?.connected || 0
  const disconnectedCount = relayMgr?.total ? relayMgr.total - relayMgr.connected : 0
  const knownCount = networkStats.value.onlineRelays || 0
  const offlineCount = networkStats.value.offlineRelays || 0

  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [16, 20],
      textStyle: { color: '#1f2937', fontSize: 14 },
      extraCssText: 'box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 12px;',
      formatter: (params) => {
        return `<div style="font-weight: 700; margin-bottom: 8px; font-size: 15px; color: ${params.color};">${params.name}</div>
                <div style="font-size: 13px; color: #6b7280;">Count: <strong style="color: #111827;">${params.value.toLocaleString()}</strong></div>`
      }
    },
    legend: {
      orient: 'horizontal',
      bottom: '5',
      left: 'center',
      itemGap: 24,
      itemWidth: 14,
      itemHeight: 14,
      textStyle: { fontSize: 13, fontWeight: 600, color: '#374151' },
      icon: 'circle'
    },
    series: [{
      name: 'Relays',
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
      label: { show: false },
      labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 12 },
      animationType: 'scale',
      animationEasing: 'elasticOut',
      data: [
        {
          value: knownCount,
          name: 'Online Relays',
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
              colorStops: [
                { offset: 0, color: '#a855f7' },
                { offset: 1, color: '#7c3aed' }
              ]
            }
          }
        },
        {
          value: offlineCount,
          name: 'Offline Relays',
          itemStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
              colorStops: [
                { offset: 0, color: '#d1d5db' },
                { offset: 1, color: '#9ca3af' }
              ]
            }
          }
        },
        ...(relayMgr ? [
          {
            value: connectedCount,
            name: 'Your Connected',
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [
                  { offset: 0, color: '#34d399' },
                  { offset: 1, color: '#059669' }
                ]
              }
            }
          },
          {
            value: disconnectedCount,
            name: 'Your Disconnected',
            itemStyle: {
              color: {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 1,
                colorStops: [
                  { offset: 0, color: '#fbbf24' },
                  { offset: 1, color: '#d97706' }
                ]
              }
            }
          }
        ] : [])
      ]
    }]
  }
})

const relayHealthColor = computed(() => {
  if (!networkStats.value) return 'gray'
  const pct = networkStats.value.onlinePercentage
  if (pct >= 80) return 'emerald'
  if (pct >= 60) return 'amber'
  return 'red'
})
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

<template>
  <div class="max-w-7xl mx-auto space-y-8">
    <!-- Hero Section -->
    <div class="relative overflow-hidden bg-gradient-to-br from-fuchsia-500 via-purple-500 to-violet-500 rounded-3xl p-8 md:p-12 shadow-lg">
      <div class="absolute inset-0 bg-black/5"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center space-x-4">
            <div class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <IconNetwork class="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 class="text-3xl md:text-4xl font-semibold text-white mb-2 tracking-tight">
                Nostr Network Explorer
              </h1>
              <p class="text-white/90 text-base">
                Real-time insights into the Nostr relay network
              </p>
            </div>
          </div>
        </div>

        <div v-if="!hideAuthPrompts" class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex-1">
              <p class="text-white/90 text-base mb-2">
                Explore the decentralized Nostr network
              </p>
              <p class="text-white text-sm">
                Connect your Nostr account to see your personal relay health and track your network activity
              </p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="emit('trigger-login')"
                class="px-8 py-3.5 bg-white text-purple-600 font-medium rounded-xl shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap"
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
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-4"></div>
        <p class="text-gray-600 text-lg">Probing Nostr relays...</p>
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
            <div class="flex items-center space-x-2">
              <span v-if="card.badge" :class="['px-2 py-0.5 rounded-full text-xs font-medium', card.badgeColor]">
                {{ card.badge }}
              </span>
              <button
                v-if="card.tooltipKey"
                @mouseenter="showTooltip(card.tooltipKey)"
                @mouseleave="hideTooltip"
                class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <IconInfoCircle class="w-5 h-5" />
              </button>
            </div>
          </div>
          <h3 class="text-gray-600 text-sm font-medium mb-2">{{ card.title }}</h3>
          <p class="text-3xl font-semibold text-gray-900 mb-1">{{ card.value }}</p>
          <p class="text-xs text-gray-500">{{ card.subtitle }}</p>

          <div
            v-if="activeTooltip === card.tooltipKey"
            :class="[
              'absolute pointer-events-none z-[9999] w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700',
              'top-full mt-2 left-1/2 -translate-x-1/2',
              'md:top-0 md:translate-x-0',
              index % 2 === 0 ? 'md:left-full md:ml-4' : 'md:right-full md:mr-4',
              'lg:top-0',
              index % 4 < 2 ? 'lg:left-full lg:right-auto lg:ml-4 lg:mr-0' : 'lg:right-full lg:left-auto lg:mr-4 lg:ml-0'
            ]"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div
              :class="[
                'absolute w-3 h-3 bg-gray-900 border-gray-700 transform rotate-45',
                'border-l border-t -top-1.5 left-1/2 -translate-x-1/2',
                'md:top-8 md:translate-x-0',
                index % 2 === 0 ? 'md:border-l md:border-t md:-left-1.5 md:left-auto' : 'md:border-r md:border-b md:-right-1.5 md:right-auto',
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

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- NIP Adoption Bar Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <IconShield class="w-5 h-5 text-purple-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">NIP Adoption</h3>
                <p class="text-sm text-gray-500">Standard support across sampled relays</p>
              </div>
            </div>
            <button
              @mouseenter="showTooltip('nips')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>

          <div
            v-if="activeTooltip === 'nips'"
            class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.nips.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.nips.description }}</p>
          </div>
          <VChart
            v-if="nipAdoptionChart"
            :option="nipAdoptionChart"
            class="w-full"
            style="height: 340px;"
            autoresize
          />
        </div>

        <!-- Relay Distribution Pie Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                <IconWorld class="w-5 h-5 text-cyan-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Relay Distribution</h3>
                <p class="text-sm text-gray-500">Network-wide and personal relay status</p>
              </div>
            </div>
            <button
              @mouseenter="showTooltip('health')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>

          <div
            v-if="activeTooltip === 'health'"
            class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.health.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.health.description }}</p>
          </div>
          <VChart
            v-if="relayDistributionChart"
            :option="relayDistributionChart"
            class="w-full"
            style="height: 340px;"
            autoresize
          />
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Relays by NIP Count -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <IconServer class="w-5 h-5 text-green-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Top Relays by Features</h3>
                <p class="text-sm text-gray-500">Most capable relays by NIP support count</p>
              </div>
            </div>
          </div>
          <div class="space-y-2 max-h-80 overflow-y-auto">
            <div
              v-for="(relay, index) in topRelayList"
              :key="relay.url"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-purple-50 transition-colors border border-transparent hover:border-purple-200"
            >
              <div class="flex items-center space-x-3 flex-1 min-w-0">
                <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                  {{ index + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ relay.name || relay.url }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ relay.software }} {{ relay.version }}</p>
                </div>
              </div>
              <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
                <div class="text-right">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {{ relay.nips?.length || 0 }} NIPs
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Network Health Overview -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <IconActivity class="w-5 h-5 text-amber-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Network Health</h3>
                <p class="text-sm text-gray-500">Summary of Nostr network status</p>
              </div>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Online percentage gauge -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700">Relay Online Rate</span>
                <span class="text-sm font-semibold" :class="relayHealthColor === 'emerald' ? 'text-emerald-600' : relayHealthColor === 'amber' ? 'text-amber-600' : 'text-red-600'">
                  {{ networkStats?.onlinePercentage || 0 }}%
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div
                  class="h-3 rounded-full transition-all duration-500"
                  :class="relayHealthColor === 'emerald' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : relayHealthColor === 'amber' ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-500'"
                  :style="{ width: (networkStats?.onlinePercentage || 0) + '%' }"
                ></div>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                {{ networkStats?.onlineRelays?.toLocaleString() }} online of {{ networkStats?.totalRelays?.toLocaleString() }} known
              </p>
            </div>

            <!-- Feature highlights -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100">
                <p class="text-xs text-purple-700 font-medium mb-1">NIP-57 Zaps</p>
                <p class="text-xl font-bold text-purple-900">{{ networkStats?.zapSupportCount?.toLocaleString() || 'N/A' }}</p>
                <p class="text-xs text-purple-500">relays support zaps</p>
              </div>
              <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                <p class="text-xs text-blue-700 font-medium mb-1">Probed Relays</p>
                <p class="text-xl font-bold text-blue-900">{{ networkStats?.probedRelays || 'N/A' }}</p>
                <p class="text-xs text-blue-500">relays sampled</p>
              </div>
            </div>

            <!-- Personal relay stats -->
            <div v-if="relayManagerStats" class="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 class="text-sm font-semibold text-gray-900 mb-3">Your Relay Connections</h4>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-600">Connected</span>
                <span class="text-sm font-semibold text-emerald-600">{{ relayManagerStats.connected }}</span>
              </div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-600">Disconnected</span>
                <span class="text-sm font-semibold text-amber-600">{{ relayManagerStats.disconnected }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600">Health</span>
                <span class="text-sm font-semibold" :class="relayManagerStats.healthyPercentage >= 80 ? 'text-emerald-600' : 'text-amber-600'">
                  {{ relayManagerStats.healthyPercentage }}%
                </span>
              </div>
            </div>

            <div v-else class="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p class="text-sm text-gray-500 text-center">
                Connect Nostr wallet to see your personal relay health
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div v-if="!hideAuthPrompts" class="bg-white border border-gray-200 rounded-3xl p-12 md:p-16 shadow-sm">
        <div class="max-w-2xl mx-auto text-center">
          <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <IconZoomIn class="w-7 h-7 text-gray-400" />
          </div>
          <h2 class="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 tracking-tight">
            Ready to Explore the Nostr Network?
          </h2>
          <p class="text-gray-600 text-base mb-10 leading-relaxed max-w-xl mx-auto">
            Connect your Nostr account to see your personal relay health and contribute to the decentralized network.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              @click="emit('trigger-login')"
              class="px-8 py-3.5 bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white font-medium rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <IconLogin class="w-5 h-5" />
              <span>Connect with Nostr</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
