<script setup>
import { ref, onMounted, computed } from 'vue'
import { IconBolt, IconTrendingUp, IconTrendingDown, IconWorld, IconServer, IconActivity, IconInfoCircle } from '@iconify-prerendered/vue-tabler'
import { getISPRanking, getNodeRankings, getLightningStatistics, formatSats } from '../../utils/network/lightningStatsService.js'

const isLoading = ref(true)
const stats = ref(null)
const ispData = ref(null)
const nodeRankings = ref(null)
const activeTooltip = ref(null)

const tooltips = {
  networkCapacity: 'The total Bitcoin locked in all Lightning channels. More capacity means the network can handle larger payments.',
  activeNodes: 'Number of operational Lightning nodes routing payments. Each node strengthens the network.',
  paymentChannels: 'Direct payment connections between nodes. Think of them as highways for instant Bitcoin transactions.',
  avgCapacity: 'The typical size of a payment channel. Larger channels can route bigger payments.',
  clearnetCapacity: 'Bitcoin held in channels on nodes accessible via regular internet.',
  torCapacity: 'Bitcoin held in channels on privacy-focused Tor nodes.',
  feeRate: 'Average cost to route payments through the network, measured in parts per million (ppm).',
  baseFee: 'Flat fee charged per payment routing, measured in millisatoshis (1/1000 of a sat).'
}

const showTooltip = (key) => {
  activeTooltip.value = key
}

const hideTooltip = () => {
  activeTooltip.value = null
}

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

const networkCapacity = computed(() => {
  if (!stats.value?.latest?.total_capacity) return { btc: 'N/A', usd: 'N/A' }
  const sats = stats.value.latest.total_capacity
  const btc = (sats / 100000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const usdPrice = 98000
  const usd = ((sats / 100000000) * usdPrice).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return { btc, usd, sats }
})

const clearnetCapacity = computed(() => {
  if (!ispData.value?.clearnetCapacity) return { btc: 'N/A', percentage: 0 }
  const sats = ispData.value.clearnetCapacity
  const btc = (sats / 100000000).toFixed(2)
  const percentage = ((sats / stats.value.latest.total_capacity) * 100).toFixed(1)
  return { btc, percentage }
})

const torCapacity = computed(() => {
  if (!ispData.value?.torCapacity) return { btc: 'N/A', percentage: 0 }
  const sats = ispData.value.torCapacity
  const btc = (sats / 100000000).toFixed(2)
  const percentage = ((sats / stats.value.latest.total_capacity) * 100).toFixed(1)
  return { btc, percentage }
})

const unknownCapacity = computed(() => {
  if (!ispData.value?.unknownCapacity) return { btc: 'N/A', percentage: 0 }
  const sats = ispData.value.unknownCapacity
  const btc = (sats / 100000000).toFixed(2)
  const percentage = ((sats / stats.value.latest.total_capacity) * 100).toFixed(1)
  return { btc, percentage }
})

const avgCapacity = computed(() => {
  if (!stats.value?.latest) return { sats: 'N/A', btc: 'N/A' }
  const avg = Math.round(stats.value.latest.total_capacity / stats.value.latest.channel_count)
  const btc = (avg / 100000000).toFixed(4)
  return { sats: avg.toLocaleString('en-US'), btc }
})

const topISPs = computed(() => {
  if (!ispData.value?.ispRanking) return []
  return ispData.value.ispRanking.slice(0, 5).map(([asn, name, capacity, channels, nodes], index) => ({
    rank: index + 1,
    asn,
    name: name.length > 25 ? name.substring(0, 25) + '...' : name,
    capacity,
    channels,
    nodes,
    percentage: ((capacity / ispData.value.clearnetCapacity) * 100).toFixed(1)
  }))
})

const topNodesByCapacity = computed(() => {
  if (!nodeRankings.value?.topByCapacity) return []
  return nodeRankings.value.topByCapacity.slice(0, 5).map((node, index) => ({
    ...node,
    rank: index + 1,
    alias: node.alias.length > 20 ? node.alias.substring(0, 20) + '...' : node.alias
  }))
})

const topNodesByChannels = computed(() => {
  if (!nodeRankings.value?.topByChannels) return []
  return nodeRankings.value.topByChannels.slice(0, 5).map((node, index) => ({
    ...node,
    rank: index + 1,
    alias: node.alias.length > 20 ? node.alias.substring(0, 20) + '...' : node.alias
  }))
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="relative w-16 h-16 mb-4">
        <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full opacity-20 animate-pulse"></div>
        <div class="absolute inset-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
          <IconBolt class="w-8 h-8 text-white animate-pulse" />
        </div>
      </div>
      <p class="text-gray-600 font-medium">Loading Lightning Network data...</p>
    </div>

    <template v-else>
      <!-- Hero Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Total Capacity -->
        <div class="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-md relative group">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <IconBolt class="w-6 h-6" />
            </div>
            <div class="flex items-center space-x-2">
              <div class="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium flex items-center space-x-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+0.4%</span>
              </div>
              <button
                @mouseenter="showTooltip('networkCapacity')"
                @mouseleave="hideTooltip"
                class="p-1 text-white/60 hover:text-white transition-colors"
              >
                <IconInfoCircle class="w-5 h-5" />
              </button>
            </div>
          </div>
          <p class="text-white/80 text-sm font-medium mb-1">Network Capacity</p>
          <p class="text-3xl font-semibold mb-1">{{ networkCapacity.btc }} BTC</p>
          <p class="text-white/90 text-lg font-medium">${{ networkCapacity.usd }}</p>

          <!-- Tooltip -->
          <div
            v-if="activeTooltip === 'networkCapacity'"
            class="absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-0 left-full ml-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div class="absolute w-3 h-3 bg-gray-900 border-l border-t border-gray-700 transform rotate-45 -left-1.5 top-8"></div>
            <h4 class="font-medium text-sm mb-2 text-white">Network Capacity</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.networkCapacity }}</p>
          </div>
        </div>

        <!-- Total Nodes -->
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <IconServer class="w-6 h-6 text-orange-600" />
            </div>
            <div class="flex items-center space-x-2">
              <div class="px-3 py-1 bg-green-50 rounded-full text-xs font-medium text-green-700 flex items-center space-x-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+0.4%</span>
              </div>
              <button
                @mouseenter="showTooltip('activeNodes')"
                @mouseleave="hideTooltip"
                class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <IconInfoCircle class="w-5 h-5" />
              </button>
            </div>
          </div>
          <p class="text-gray-600 text-sm font-medium mb-1">Active Nodes</p>
          <p class="text-3xl font-semibold text-gray-900">{{ stats?.latest?.node_count?.toLocaleString() || 'N/A' }}</p>
          <p class="text-gray-500 text-sm mt-1">Running worldwide</p>

          <!-- Tooltip -->
          <div
            v-if="activeTooltip === 'activeNodes'"
            class="absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-0 left-full ml-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div class="absolute w-3 h-3 bg-gray-900 border-l border-t border-gray-700 transform rotate-45 -left-1.5 top-8"></div>
            <h4 class="font-medium text-sm mb-2 text-white">Active Nodes</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.activeNodes }}</p>
          </div>
        </div>

        <!-- Total Channels -->
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
              <IconActivity class="w-6 h-6 text-orange-600" />
            </div>
            <div class="flex items-center space-x-2">
              <div class="px-3 py-1 bg-green-50 rounded-full text-xs font-medium text-green-700 flex items-center space-x-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+0.4%</span>
              </div>
              <button
                @mouseenter="showTooltip('paymentChannels')"
                @mouseleave="hideTooltip"
                class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <IconInfoCircle class="w-5 h-5" />
              </button>
            </div>
          </div>
          <p class="text-gray-600 text-sm font-medium mb-1">Payment Channels</p>
          <p class="text-3xl font-semibold text-gray-900">{{ stats?.latest?.channel_count?.toLocaleString() || 'N/A' }}</p>
          <p class="text-gray-500 text-sm mt-1">Open connections</p>

          <!-- Tooltip -->
          <div
            v-if="activeTooltip === 'paymentChannels'"
            class="absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-0 left-full ml-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div class="absolute w-3 h-3 bg-gray-900 border-l border-t border-gray-700 transform rotate-45 -left-1.5 top-8"></div>
            <h4 class="font-medium text-sm mb-2 text-white">Payment Channels</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.paymentChannels }}</p>
          </div>
        </div>
      </div>

      <!-- Capacity Distribution -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Network Distribution</h3>
            <p class="text-sm text-gray-600">Capacity by network type</p>
          </div>
          <IconWorld class="w-7 h-7 text-orange-500" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-blue-900">Clearnet</span>
              <span class="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">{{ clearnetCapacity.percentage }}%</span>
            </div>
            <p class="text-2xl font-bold text-blue-900">{{ clearnetCapacity.btc }}</p>
            <p class="text-xs text-blue-700 mt-1">BTC</p>
          </div>

          <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-purple-900">Tor</span>
              <span class="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">{{ torCapacity.percentage }}%</span>
            </div>
            <p class="text-2xl font-bold text-purple-900">{{ torCapacity.btc }}</p>
            <p class="text-xs text-purple-700 mt-1">BTC</p>
          </div>

          <div class="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-900">Unknown</span>
              <span class="text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-1 rounded-full">{{ unknownCapacity.percentage }}%</span>
            </div>
            <p class="text-2xl font-bold text-gray-900">{{ unknownCapacity.btc }}</p>
            <p class="text-xs text-gray-700 mt-1">BTC</p>
          </div>
        </div>
      </div>

      <!-- Channel Metrics -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-6 tracking-tight">Channel Metrics</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p class="text-sm text-gray-600 mb-2">Average Capacity</p>
            <p class="text-2xl font-semibold text-orange-600">{{ avgCapacity.sats }}</p>
            <p class="text-sm text-gray-500 mt-1">sats ({{ avgCapacity.btc }} BTC)</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2">Average Fee Rate</p>
            <p class="text-2xl font-semibold text-orange-600">823</p>
            <p class="text-sm text-gray-500 mt-1">ppm <span class="text-green-600">+0.7%</span></p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2">Average Base Fee</p>
            <p class="text-2xl font-semibold text-orange-600">950</p>
            <p class="text-sm text-gray-500 mt-1">mSats <span class="text-red-600">-0.1%</span></p>
          </div>
        </div>
      </div>

      <!-- Top ISPs -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Top Internet Service Providers</h3>
            <p class="text-sm text-gray-600">Largest infrastructure hosting</p>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-3 px-2 text-xs font-medium text-gray-600 uppercase">#</th>
                <th class="text-left py-3 px-4 text-xs font-medium text-gray-600 uppercase">Provider</th>
                <th class="text-right py-3 px-4 text-xs font-medium text-gray-600 uppercase">Capacity</th>
                <th class="text-right py-3 px-4 text-xs font-medium text-gray-600 uppercase">Share</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="isp in topISPs" :key="isp.asn" class="border-b border-gray-100 hover:bg-orange-50 transition-colors">
                <td class="py-3 px-2 text-sm font-medium text-gray-900">{{ isp.rank }}</td>
                <td class="py-3 px-4">
                  <p class="text-sm font-medium text-gray-900">{{ isp.name }}</p>
                </td>
                <td class="py-3 px-4 text-right">
                  <p class="text-sm font-medium text-gray-900">{{ (isp.capacity / 100000000).toFixed(2) }} BTC</p>
                </td>
                <td class="py-3 px-4 text-right">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {{ isp.percentage }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Rankings Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Nodes by Capacity -->
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Top Nodes by Capacity</h3>
            <p class="text-sm text-gray-600">Most liquidity</p>
          </div>

          <div class="space-y-2">
            <div v-for="node in topNodesByCapacity" :key="node.publicKey"
              class="flex items-center justify-between p-3 rounded-xl hover:bg-orange-50 transition-colors border border-gray-200 hover:border-orange-200">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                  {{ node.rank }}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ node.alias }}</p>
                  <p class="text-xs text-gray-500">{{ (node.capacity / 100000000).toFixed(2) }} BTC</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-orange-600">${{ ((node.capacity / 100000000) * 98000).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Nodes by Channels -->
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Top Nodes by Channels</h3>
            <p class="text-sm text-gray-600">Most connected</p>
          </div>

          <div class="space-y-2">
            <div v-for="node in topNodesByChannels" :key="node.publicKey"
              class="flex items-center justify-between p-3 rounded-xl hover:bg-orange-50 transition-colors border border-gray-200 hover:border-orange-200">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-medium text-sm">
                  {{ node.rank }}
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ node.alias }}</p>
                  <p class="text-xs text-gray-500">{{ node.channels.toLocaleString() }} channels</p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-semibold text-orange-600">{{ ((node.channels / stats.latest.channel_count) * 100).toFixed(2) }}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.animate-pulse {
  animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

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
