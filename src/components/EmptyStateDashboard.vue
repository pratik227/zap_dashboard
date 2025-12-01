<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  IconBolt,
  IconServer,
  IconWorld,
  IconChartPie,
  IconTrendingUp,
  IconDatabase
} from '@iconify-prerendered/vue-tabler'
import VChart from 'vue-echarts'
import { getISPRanking, getNodeRankings, getLightningStatistics, formatSats } from '../utils/lightningStatsService.js'

const emit = defineEmits(['connect'])

const isLoading = ref(true)
const stats = ref(null)
const ispData = ref(null)
const nodeRankings = ref(null)

const handleConnect = () => {
  emit('connect')
}

// Fetch all Lightning Network data
onMounted(async () => {
  isLoading.value = true

  try {
    const [statsData, ispRanking, rankings] = await Promise.all([
      getLightningStatistics(),
      getISPRanking(),
      getNodeRankings()
    ])

    stats.value = statsData
    ispData.value = ispRanking
    nodeRankings.value = rankings
  } catch (error) {
    console.error('Error fetching Lightning data:', error)
  } finally {
    isLoading.value = false
  }
})

// Compute pie chart data for top ISPs
const ispChartOption = computed(() => {
  if (!ispData.value?.ispRanking) return null

  const top10 = ispData.value.ispRanking.slice(0, 10)

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        return `${params.name}<br/>Capacity: ${formatSats(params.value)}<br/>Share: ${params.percent}%`
      }
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { fontSize: 11 }
    },
    series: [
      {
        name: 'ISP Distribution',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: top10.map(([asn, name, capacity]) => ({
          name: name,
          value: capacity
        })),
        color: [
          '#f97316', '#fb923c', '#fdba74', '#fcd34d',
          '#fbbf24', '#f59e0b', '#d97706', '#b45309',
          '#92400e', '#78350f'
        ]
      }
    ]
  }
})

// Compute pie chart data for top nodes by capacity
const topNodesChartOption = computed(() => {
  if (!nodeRankings.value?.topByCapacity) return null

  const top10 = nodeRankings.value.topByCapacity.slice(0, 10)

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        return `${params.name}<br/>Capacity: ${formatSats(params.value)}<br/>Share: ${params.percent}%`
      }
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { fontSize: 11 }
    },
    series: [
      {
        name: 'Node Capacity',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: top10.map(node => ({
          name: node.alias,
          value: node.capacity
        })),
        color: [
          '#ea580c', '#f97316', '#fb923c', '#fdba74',
          '#fed7aa', '#fbbf24', '#fcd34d', '#fde047',
          '#facc15', '#eab308'
        ]
      }
    ]
  }
})

// Top ISPs list
const topISPs = computed(() => {
  if (!ispData.value?.ispRanking) return []
  return ispData.value.ispRanking.slice(0, 5).map(([asn, name, capacity, channels, nodes]) => ({
    asn,
    name,
    capacity,
    channels,
    nodes
  }))
})

// Top nodes list
const topNodes = computed(() => {
  if (!nodeRankings.value?.topByCapacity) return []
  return nodeRankings.value.topByCapacity.slice(0, 5)
})
</script>

<template>
  <div class="space-y-8 pb-8">
    <!-- Hero Section - Clean & Minimal -->
    <div class="text-center space-y-6 py-12">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl shadow-lg mb-4">
        <IconBolt class="w-10 h-10 text-white" />
      </div>
      <div>
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          Lightning Network Insights
        </h1>
        <p class="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Track your zaps, analyze earnings, and grow your presence on the Lightning Network
        </p>
      </div>

      <!-- Primary CTA -->
      <button
        @click="handleConnect"
        class="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 inline-flex items-center space-x-2"
      >
        <IconBolt class="w-5 h-5" />
        <span>Connect with Nostr to Get Started</span>
      </button>

      <p class="text-sm text-gray-500">
        Explore global Lightning Network statistics below
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mb-4"></div>
      <p class="text-gray-600">Loading Lightning Network data...</p>
    </div>

    <!-- Stats Content -->
    <template v-else>
      <!-- Network Overview Stats -->
      <div v-if="stats" class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl p-6 border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
              <IconWorld class="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p class="text-sm text-gray-600">Total Nodes</p>
              <p class="text-2xl font-bold text-gray-900">{{ stats.latest?.node_count?.toLocaleString() || 'N/A' }}</p>
            </div>
          </div>
          <p class="text-xs text-gray-500">Active Lightning nodes worldwide</p>
        </div>

        <div class="bg-white rounded-xl p-6 border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-lg flex items-center justify-center">
              <IconTrendingUp class="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p class="text-sm text-gray-600">Total Channels</p>
              <p class="text-2xl font-bold text-gray-900">{{ stats.latest?.channel_count?.toLocaleString() || 'N/A' }}</p>
            </div>
          </div>
          <p class="text-xs text-gray-500">Open payment channels</p>
        </div>

        <div class="bg-white rounded-xl p-6 border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-center space-x-3 mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-lg flex items-center justify-center">
              <IconDatabase class="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p class="text-sm text-gray-600">Network Capacity</p>
              <p class="text-2xl font-bold text-gray-900">{{ formatSats(stats.latest?.total_capacity || 0) }}</p>
            </div>
          </div>
          <p class="text-xs text-gray-500">Total locked liquidity</p>
        </div>
      </div>

      <!-- ISP Distribution Chart -->
      <div v-if="ispChartOption" class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center space-x-3 mb-6">
          <div class="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
            <IconServer class="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Node Distribution by ISP</h3>
            <p class="text-sm text-gray-600">Top 10 hosting providers by capacity</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Chart -->
          <div class="h-80">
            <VChart :option="ispChartOption" autoresize />
          </div>

          <!-- ISP List -->
          <div class="space-y-3">
            <div v-for="(isp, index) in topISPs" :key="isp.asn"
              class="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {{ index + 1 }}
                </div>
                <div>
                  <p class="font-semibold text-gray-900 text-sm">{{ isp.name }}</p>
                  <p class="text-xs text-gray-600">{{ isp.nodes }} nodes • {{ isp.channels.toLocaleString() }} channels</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-semibold text-gray-900 text-sm">{{ formatSats(isp.capacity) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Nodes Chart -->
      <div v-if="topNodesChartOption" class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center space-x-3 mb-6">
          <div class="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center">
            <IconChartPie class="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Top Lightning Nodes</h3>
            <p class="text-sm text-gray-600">Ranked by channel capacity</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Chart -->
          <div class="h-80">
            <VChart :option="topNodesChartOption" autoresize />
          </div>

          <!-- Nodes List -->
          <div class="space-y-3">
            <div v-for="(node, index) in topNodes" :key="node.publicKey"
              class="flex items-center justify-between p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg hover:shadow-md transition-shadow">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  {{ index + 1 }}
                </div>
                <div>
                  <p class="font-semibold text-gray-900 text-sm">{{ node.alias }}</p>
                  <p class="text-xs text-gray-600 font-mono truncate max-w-[200px]">{{ node.publicKey.slice(0, 20) }}...</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-semibold text-gray-900 text-sm">{{ formatSats(node.capacity) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div class="text-center py-8">
        <div class="inline-block bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-8">
          <h3 class="text-xl font-bold text-gray-900 mb-2">Ready to Track Your Lightning Activity?</h3>
          <p class="text-gray-600 mb-6">Connect your Nostr account to get started</p>
          <button
            @click="handleConnect"
            class="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 inline-flex items-center space-x-2"
          >
            <IconBolt class="w-5 h-5" />
            <span>Connect with Nostr</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out forwards;
}
</style>
