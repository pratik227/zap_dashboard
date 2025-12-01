<script setup>
import { ref, onMounted, computed } from 'vue'
import { IconBolt, IconTrendingUp, IconTrendingDown } from '@iconify-prerendered/vue-tabler'
import { getISPRanking, getNodeRankings, getLightningStatistics, formatSats } from '../utils/lightningStatsService.js'

const isLoading = ref(true)
const stats = ref(null)
const ispData = ref(null)
const nodeRankings = ref(null)

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
  return { btc, usd }
})

const clearnetCapacity = computed(() => {
  if (!ispData.value?.clearnetCapacity) return { btc: 'N/A' }
  const sats = ispData.value.clearnetCapacity
  const btc = (sats / 100000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return { btc }
})

const torCapacity = computed(() => {
  if (!ispData.value?.torCapacity) return { btc: 'N/A' }
  const sats = ispData.value.torCapacity
  const btc = (sats / 100000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return { btc }
})

const unknownCapacity = computed(() => {
  if (!ispData.value?.unknownCapacity) return { btc: 'N/A' }
  const sats = ispData.value.unknownCapacity
  const btc = (sats / 100000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return { btc }
})

const avgCapacity = computed(() => {
  if (!stats.value?.latest) return { sats: 'N/A', change: 0 }
  const avg = Math.round(stats.value.latest.total_capacity / stats.value.latest.channel_count)
  return { sats: avg.toLocaleString('en-US'), change: 0.4 }
})

const avgFee = computed(() => {
  return { ppm: '823', change: 0.7 }
})

const avgBaseFee = computed(() => {
  return { mSats: '950', change: -0.1 }
})

const topISPs = computed(() => {
  if (!ispData.value?.ispRanking) return []
  return ispData.value.ispRanking.slice(0, 5).map(([asn, name, capacity, channels, nodes], index) => ({
    asn,
    name,
    capacity,
    channels,
    nodes,
    percentage: ((capacity / ispData.value.clearnetCapacity) * 100).toFixed(2)
  }))
})

const topNodesByCapacity = computed(() => {
  if (!nodeRankings.value?.topByCapacity) return []
  return nodeRankings.value.topByCapacity.slice(0, 5)
})

const topNodesByChannels = computed(() => {
  if (!nodeRankings.value?.topByChannels) return []
  return nodeRankings.value.topByChannels.slice(0, 5)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mb-4"></div>
      <p class="text-gray-400">Loading Lightning Network data...</p>
    </div>

    <template v-else>
      <!-- Main Stats Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Network Statistics Card -->
        <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white border border-gray-700">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Network Statistics</h2>

          <div class="grid grid-cols-3 gap-4">
            <!-- Capacity -->
            <div class="space-y-1">
              <p class="text-xs text-blue-400 font-medium">Capacity</p>
              <p class="text-2xl font-bold">{{ networkCapacity.btc }}</p>
              <p class="text-xs text-gray-400">BTC</p>
              <p class="text-lg font-semibold text-green-400 mt-1">{{ networkCapacity.usd }} $</p>
            </div>

            <!-- Nodes -->
            <div class="space-y-1">
              <p class="text-xs text-blue-400 font-medium">Nodes</p>
              <p class="text-2xl font-bold">{{ stats?.latest?.node_count?.toLocaleString() || 'N/A' }}</p>
              <p class="text-xs text-green-400 flex items-center space-x-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+0.4%</span>
              </p>
            </div>

            <!-- Channels -->
            <div class="space-y-1">
              <p class="text-xs text-blue-400 font-medium">Channels</p>
              <p class="text-2xl font-bold">{{ stats?.latest?.channel_count?.toLocaleString() || 'N/A' }}</p>
              <p class="text-xs text-green-400 flex items-center space-x-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+0.4%</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Channel Statistics Card -->
        <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white border border-gray-700">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Channel Statistics</h2>

          <div class="grid grid-cols-3 gap-4">
            <!-- Avg Capacity -->
            <div class="space-y-1">
              <p class="text-xs text-blue-400 font-medium">Avg Capacity</p>
              <p class="text-2xl font-bold">{{ avgCapacity.sats }}</p>
              <p class="text-xs text-gray-400">sats</p>
              <p class="text-xs text-green-400 flex items-center space-x-1 mt-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+{{ avgCapacity.change }}%</span>
              </p>
            </div>

            <!-- Avg Fee -->
            <div class="space-y-1">
              <p class="text-xs text-blue-400 font-medium">Avg Fee Rate</p>
              <p class="text-2xl font-bold">{{ avgFee.ppm }}</p>
              <p class="text-xs text-gray-400">ppm</p>
              <p class="text-xs text-green-400 flex items-center space-x-1 mt-1">
                <IconTrendingUp class="w-3 h-3" />
                <span>+{{ avgFee.change }}%</span>
              </p>
            </div>

            <!-- Avg Base Fee -->
            <div class="space-y-1">
              <p class="text-xs text-blue-400 font-medium">Avg Base Fee</p>
              <p class="text-2xl font-bold">{{ avgBaseFee.mSats }}</p>
              <p class="text-xs text-gray-400">mSats</p>
              <p class="text-xs text-red-400 flex items-center space-x-1 mt-1">
                <IconTrendingDown class="w-3 h-3" />
                <span>{{ avgBaseFee.change }}%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Capacity Breakdown -->
      <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white border border-gray-700">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Capacity by Network Type</h2>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="space-y-2">
            <p class="text-xs text-blue-400 font-medium">Clearnet Capacity</p>
            <p class="text-2xl font-bold">{{ clearnetCapacity.btc }}</p>
            <p class="text-xs text-gray-400">BTC</p>
          </div>

          <div class="space-y-2">
            <p class="text-xs text-blue-400 font-medium">Tor Capacity</p>
            <p class="text-2xl font-bold">{{ torCapacity.btc }}</p>
            <p class="text-xs text-gray-400">BTC</p>
          </div>

          <div class="space-y-2">
            <p class="text-xs text-blue-400 font-medium">Unknown Capacity</p>
            <p class="text-2xl font-bold">{{ unknownCapacity.btc }}</p>
            <p class="text-xs text-gray-400">BTC</p>
          </div>
        </div>

        <!-- ISP Distribution Pie Chart Placeholder -->
        <div v-if="topISPs.length > 0" class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <p class="text-sm font-medium text-gray-300">Top ISPs ({{ (topISPs.reduce((sum, isp) => sum + parseFloat(isp.percentage), 0)).toFixed(1) }}%)</p>
            <a href="#" class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">View more »</a>
          </div>

          <div class="space-y-2">
            <div v-for="isp in topISPs" :key="isp.asn" class="flex items-center justify-between text-sm">
              <span class="text-gray-400">{{ isp.name }}</span>
              <span class="text-white font-medium">{{ isp.percentage }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Rankings Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Top Nodes by Liquidity -->
        <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white border border-gray-700">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Liquidity Ranking</h2>
            <a href="#" class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1">
              <span>View more</span>
              <span>»</span>
            </a>
          </div>

          <div class="space-y-1">
            <div class="grid grid-cols-3 gap-2 text-xs text-gray-500 font-semibold pb-2 border-b border-gray-700">
              <div>Alias</div>
              <div class="text-right">Liquidity</div>
              <div class="text-right">USD</div>
            </div>

            <div v-for="(node, index) in topNodesByCapacity" :key="node.publicKey"
              class="grid grid-cols-3 gap-2 py-2 hover:bg-gray-800/50 rounded transition-colors">
              <div class="text-sm text-cyan-400 font-medium truncate">{{ node.alias }}</div>
              <div class="text-sm text-right">
                <span class="text-white">{{ (node.capacity / 100000000).toFixed(2) }}</span>
                <span class="text-gray-500 text-xs ml-1">BTC</span>
                <span class="text-gray-600 text-xs ml-1">({{ ((node.capacity / stats.latest.total_capacity) * 100).toFixed(1) }}%)</span>
              </div>
              <div class="text-sm text-right text-green-400 font-semibold">
                {{ ((node.capacity / 100000000) * 98000).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }} $
              </div>
            </div>
          </div>
        </div>

        <!-- Top Nodes by Channels -->
        <div class="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white border border-gray-700">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Connectivity Ranking</h2>
            <a href="#" class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1">
              <span>View more</span>
              <span>»</span>
            </a>
          </div>

          <div class="space-y-1">
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-500 font-semibold pb-2 border-b border-gray-700">
              <div>Alias</div>
              <div class="text-right">Channels</div>
            </div>

            <div v-for="(node, index) in topNodesByChannels" :key="node.publicKey"
              class="grid grid-cols-2 gap-2 py-2 hover:bg-gray-800/50 rounded transition-colors">
              <div class="text-sm text-cyan-400 font-medium truncate">{{ node.alias }}</div>
              <div class="text-sm text-right">
                <span class="text-white font-semibold">{{ node.channels.toLocaleString() }}</span>
                <span class="text-gray-600 text-xs ml-1">({{ ((node.channels / stats.latest.channel_count) * 100).toFixed(1) }}%)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style>
