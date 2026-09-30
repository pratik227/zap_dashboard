<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { nostrNetworkService, combineStats } from '../../utils/network/nostrNetworkService.js'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import {
  IconNetwork,
  IconPlugConnected,
  IconWorld,
  IconServer,
  IconActivity,
  IconLogin,
  IconZoomIn,
  IconExternalLink,
  IconInfoCircle,
  IconSearch,
  IconShield,
  IconBolt,
  IconClock,
  IconRefresh,
  IconAlertTriangle
} from '@iconify-prerendered/vue-tabler'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'

use([CanvasRenderer, PieChart, BarChart, TooltipComponent, LegendComponent, GridComponent])

defineProps({
  hideAuthPrompts: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['trigger-login', 'show-help'])

// Auth loading state guards the login buttons
const { isLoading: isLoginLoading } = useNostrAuth()

const isLoading = ref(true) // until the live probe (first section) is in
const monitorLoading = ref(false)
const sources = reactive({ network: null, probes: null, personal: null })
const stats = computed(() => (isLoading.value ? null : combineStats(sources)))
const activeTooltip = ref(null)

const tooltips = {
  online: {
    title: 'Online Relays',
    description: 'Relays that NIP-66 monitors found online in the last 24 hours. Monitors are independent Nostr services that check relays around the clock and publish what they find as Nostr events.',
    example: 'When you post a note it goes to several relays, so the more relays are online, the more resilient your content is.'
  },
  latency: {
    title: 'Relay Latency',
    description: 'Median time for monitors to open a connection to a relay and read an event from it. Lower is faster.',
    example: 'Your own latency depends on where you are. The live probe below measures it from your browser.'
  },
  throughput: {
    title: 'Network Activity',
    description: 'Unique notes (kind 1) published in the last minute, counted across popular relays and de-duplicated, since the same note is usually stored on many relays.',
    example: 'This is a sample of public activity, not the whole network. Many notes live only on smaller relays.'
  },
  search: {
    title: 'NIP-50 Search',
    description: 'Relays that support full-text search, so clients can find old notes and people instead of only recent events.',
    example: 'NIP-50 lets you search for "bitcoin" across everything a relay stores.'
  },
  nips: {
    title: 'NIP Support',
    description: 'NIPs (Nostr Implementation Possibilities) are optional standards. Relays advertise the ones they support. More support means more features, like search, authentication and protected events.',
    example: 'Based on what each relay advertises, as reported by NIP-66 monitors.'
  },
  access: {
    title: 'Relay Access',
    description: 'Whether relays accept events from anyone, or require authentication (NIP-42), payment or proof of work.',
    example: 'Paid and authenticated relays often have less spam, while open relays are easiest to start with.'
  },
  ranking: {
    title: 'Fastest Relays',
    description: 'Clearnet relays with the lowest combined connect and read time, as measured by NIP-66 monitors.',
    example: 'Relays close to you may be faster than this ranking suggests.'
  }
}

const showTooltip = (key) => { activeTooltip.value = key }
const hideTooltip = () => { activeTooltip.value = null }

// Sections render as their source arrives. Probes run before the (large) monitor
// download so it doesn't inflate the latency they measure.
const loadData = async ({ force = false } = {}) => {
  isLoading.value = true
  if (force) nostrNetworkService.clearCache()
  const [probe, personal] = await Promise.allSettled([
    nostrNetworkService.getProbeResults(),
    nostrNetworkService.getPersonalStats()
  ])
  sources.probes = probe.status === 'fulfilled' ? probe.value : null
  sources.personal = personal.status === 'fulfilled' ? personal.value : null
  isLoading.value = false

  monitorLoading.value = true
  sources.network = await nostrNetworkService.getMonitorStats().catch(() => null)
  monitorLoading.value = false
}

onMounted(() => loadData())

const network = computed(() => stats.value?.network || null)
const probes = computed(() => stats.value?.probes || null)
const personal = computed(() => stats.value?.personal || null)
const nothingLoaded = computed(() => stats.value && !monitorLoading.value && !network.value && !probes.value?.summary.reachable)
const monitorPlaceholder = computed(() => (monitorLoading.value ? 'Loading data from relay monitors…' : 'Monitor data is unavailable right now.'))

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—')
const ms = (n) => (typeof n === 'number' ? `${n.toLocaleString()} ms` : '—')

const statsCards = computed(() => {
  if (!stats.value) return []
  const net = network.value
  const probe = probes.value?.summary
  return [
    {
      title: 'Online Relays',
      value: fmt(net?.onlineRelays),
      icon: IconPlugConnected,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
      subtitle: net ? `Seen in the last 24h by ${net.monitors} monitors` : monitorLoading.value ? 'Loading…' : 'Monitor data unavailable',
      tooltipKey: 'online'
    },
    {
      title: 'Median Latency',
      // Monitors measure from many places; the browser probe is only a fallback
      value: ms(net ? net.medianRttOpen : monitorLoading.value ? null : probe?.medianConnectMs),
      icon: IconClock,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      subtitle: net?.medianRttRead ? `to connect · ${ms(net.medianRttRead)} to read` : monitorLoading.value ? 'Loading…' : 'to connect, from your browser',
      tooltipKey: 'latency'
    },
    {
      title: 'Notes per Minute',
      value: fmt(probe?.notesLastMinute),
      icon: IconActivity,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      subtitle: probe?.reachable ? `Unique notes across ${probe.reachable} relays` : 'Live probe unavailable',
      tooltipKey: 'throughput'
    },
    {
      title: 'NIP-50 Search',
      value: monitorLoading.value ? '—' : fmt(stats.value.searchSupportCount),
      icon: IconSearch,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      subtitle: monitorLoading.value ? 'Loading…' : stats.value.nipSampleSize ? `of ${fmt(stats.value.nipSampleSize)} relays reporting NIPs` : 'No NIP data',
      tooltipKey: 'search'
    }
  ]
})

const topNipsByAdoption = computed(() => (monitorLoading.value ? [] : (stats.value?.nipSupport || []).filter(n => n.percentage >= 5).slice(0, 12)))

const nipAdoptionChart = computed(() => {
  if (!topNipsByAdoption.value.length) return null
  return {
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: '#1f2937', fontSize: 13 },
      formatter: (params) => {
        const nip = topNipsByAdoption.value[params[0].dataIndex]
        return `<div style="font-weight:700;margin-bottom:6px;color:#ea580c;">NIP-${nip.nip}: ${nip.description}</div>
                <div style="color:#6b7280;">${nip.percentage}% of relays (${nip.count.toLocaleString()} of ${nip.total.toLocaleString()})</div>`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
    xAxis: { type: 'category', data: topNipsByAdoption.value.map(n => `NIP-${n.nip}`), axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar',
      data: topNipsByAdoption.value.map(n => n.percentage),
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#fb923c' }, { offset: 1, color: '#ea580c' }] },
        borderRadius: [4, 4, 0, 0]
      },
      barMaxWidth: 30,
      label: { show: true, position: 'top', formatter: '{c}%', fontSize: 10 }
    }]
  }
})

const accessChart = computed(() => {
  const net = network.value
  if (!net?.onlineRelays) return null
  // Categories overlap (a relay can need auth and payment), so show each as its own slice of "restricted"
  const restricted = net.onlineRelays - net.openAccess
  const data = [
    { value: net.openAccess, name: 'Open to everyone', itemStyle: { color: '#10b981' } },
    { value: net.paymentRequired, name: 'Paid', itemStyle: { color: '#f59e0b' } },
    { value: Math.max(0, restricted - net.paymentRequired), name: 'Auth or PoW only', itemStyle: { color: '#6366f1' } }
  ].filter(d => d.value > 0)
  return {
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: p => `<strong>${p.name}</strong><br>${p.value.toLocaleString()} relays (${p.percent}%)`
    },
    legend: { bottom: 5, left: 'center', icon: 'circle', itemGap: 20, textStyle: { fontSize: 12, color: '#374151' } },
    series: [{
      type: 'pie',
      radius: ['50%', '78%'],
      center: ['50%', '42%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      data
    }]
  }
})

const fastestRelays = computed(() => network.value?.fastestRelays || [])

const probeHealthColor = computed(() => {
  const pct = probes.value?.summary.reachablePercentage ?? 0
  if (pct >= 80) return 'emerald'
  if (pct >= 50) return 'amber'
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
    <div class="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-3xl p-8 md:p-12 shadow-lg">
      <div class="absolute inset-0 bg-black/5"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between gap-4 mb-6">
          <div class="flex items-center space-x-4">
            <div class="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <IconNetwork class="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 class="text-3xl md:text-4xl font-semibold text-white mb-2 tracking-tight">Nostr Network Explorer</h1>
              <p class="text-white/90 text-base">Live insights into the Nostr relay network</p>
            </div>
          </div>
          <button
            class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium border border-white/30 disabled:opacity-60"
            :disabled="isLoading || monitorLoading"
            @click="loadData({ force: true })"
          >
            <IconRefresh :class="['w-4 h-4', isLoading || monitorLoading ? 'animate-spin' : '']" /> Refresh
          </button>
        </div>

        <div v-if="!hideAuthPrompts" class="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex-1">
              <p class="text-white/90 text-base mb-2">Explore the decentralized Nostr network</p>
              <p class="text-white text-sm">Connect your Nostr account to see your personal relay health alongside the network</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                @click="emit('trigger-login')"
                :disabled="isLoginLoading"
                :class="[
                  'px-8 py-3.5 bg-white text-orange-600 font-medium rounded-xl shadow-sm transition-all duration-150 flex items-center justify-center space-x-2 whitespace-nowrap',
                  isLoginLoading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md'
                ]"
              >
                <IconActivity v-if="isLoginLoading" class="w-5 h-5 animate-spin" />
                <IconLogin v-else class="w-5 h-5" />
                <span>{{ isLoginLoading ? 'Connecting...' : 'Connect with Nostr' }}</span>
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

    <!-- Loading State (skeleton) -->
    <div v-if="isLoading" class="space-y-6 animate-pulse">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div v-for="i in 4" :key="i" class="bg-white rounded-xl border border-gray-200/60 p-6">
          <div class="h-3 bg-gray-200 rounded w-20 mb-3"></div>
          <div class="h-8 bg-gray-200 rounded w-28 mb-2"></div>
          <div class="h-3 bg-gray-100 rounded w-16"></div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-gray-200/60 p-6">
        <div class="h-4 bg-gray-200 rounded w-48 mb-4"></div>
        <div class="h-64 bg-gray-100 rounded-lg"></div>
      </div>
    </div>

    <!-- Nothing reachable -->
    <div v-else-if="nothingLoaded" class="bg-white rounded-2xl p-10 border border-gray-200 text-center">
      <IconAlertTriangle class="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <h3 class="text-lg font-semibold text-gray-900 mb-1">Couldn’t reach the Nostr network</h3>
      <p class="text-sm text-gray-600 mb-4">None of the monitor or probe relays responded. Check your connection and try again.</p>
      <button class="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium" @click="loadData({ force: true })">Try again</button>
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
              @mouseenter="showTooltip(card.tooltipKey)"
              @mouseleave="hideTooltip"
              @focus="showTooltip(card.tooltipKey)"
              @blur="hideTooltip"
              :aria-label="`About ${card.title}`"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <h3 class="text-gray-600 text-sm font-medium mb-2">{{ card.title }}</h3>
          <p class="text-3xl font-semibold text-gray-900 mb-1 tabular-nums">{{ card.value }}</p>
          <p class="text-xs text-gray-500">{{ card.subtitle }}</p>

          <div
            v-if="activeTooltip === card.tooltipKey"
            :class="[
              'absolute pointer-events-none z-[9999] w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700',
              'top-full mt-2 left-1/2 -translate-x-1/2',
              'lg:top-0 lg:translate-x-0',
              index % 4 < 2 ? 'lg:left-full lg:ml-4' : 'lg:left-auto lg:right-full lg:mr-4'
            ]"
            style="animation: fadeIn 0.2s ease-out"
          >
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
        <!-- NIP Adoption -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <IconShield class="w-5 h-5 text-orange-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">NIP Adoption</h3>
                <p class="text-sm text-gray-500">
                  <template v-if="monitorLoading">Loading…</template>
                  <template v-else-if="stats?.nipSource === 'nip66'">Across {{ fmt(stats.nipSampleSize) }} relays reported by monitors</template>
                  <template v-else-if="stats?.nipSource === 'probe'">Across {{ stats.nipSampleSize }} probed relays</template>
                  <template v-else>No NIP data available</template>
                </p>
              </div>
            </div>
            <button @mouseenter="showTooltip('nips')" @mouseleave="hideTooltip" aria-label="About NIP adoption" class="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <div v-if="activeTooltip === 'nips'" class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 right-4" style="animation: fadeIn 0.2s ease-out">
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.nips.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.nips.description }}</p>
          </div>
          <VChart v-if="nipAdoptionChart" :option="nipAdoptionChart" class="w-full" style="height: 340px;" autoresize />
          <p v-else class="text-sm text-gray-500 text-center py-24">{{ monitorLoading ? monitorPlaceholder : 'NIP data is unavailable right now.' }}</p>
        </div>

        <!-- Relay Access -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                <IconWorld class="w-5 h-5 text-cyan-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Relay Access</h3>
                <p class="text-sm text-gray-500">Who can publish to online relays</p>
              </div>
            </div>
            <button @mouseenter="showTooltip('access')" @mouseleave="hideTooltip" aria-label="About relay access" class="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <div v-if="activeTooltip === 'access'" class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 right-4" style="animation: fadeIn 0.2s ease-out">
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.access.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.access.description }}</p>
          </div>
          <VChart v-if="accessChart" :option="accessChart" class="w-full" style="height: 300px;" autoresize />
          <p v-else class="text-sm text-gray-500 text-center py-24">{{ monitorPlaceholder }}</p>
          <div v-if="network" class="grid grid-cols-3 gap-3 mt-2 text-center">
            <div>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">{{ fmt(network.authRequired) }}</p>
              <p class="text-xs text-gray-500">require auth (NIP-42)</p>
            </div>
            <div>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">{{ fmt(network.byNetwork.tor) }}</p>
              <p class="text-xs text-gray-500">on Tor</p>
            </div>
            <div>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">{{ fmt(network.powRequired) }}</p>
              <p class="text-xs text-gray-500">require PoW</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Fastest relays -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200 relative">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center space-x-3 flex-1">
              <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <IconServer class="w-5 h-5 text-green-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Fastest Relays</h3>
                <p class="text-sm text-gray-500">Lowest connect + read time, measured by monitors</p>
              </div>
            </div>
            <button @mouseenter="showTooltip('ranking')" @mouseleave="hideTooltip" aria-label="About the ranking" class="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <div v-if="activeTooltip === 'ranking'" class="absolute pointer-events-none z-[9999] w-80 max-w-[calc(100vw-2rem)] p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-16 right-4" style="animation: fadeIn 0.2s ease-out">
            <h4 class="font-medium text-sm mb-2 text-white">{{ tooltips.ranking.title }}</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.ranking.description }}</p>
          </div>
          <div v-if="fastestRelays.length" class="space-y-2 max-h-96 overflow-y-auto">
            <div
              v-for="(relay, index) in fastestRelays"
              :key="relay.url"
              class="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-orange-50 transition-colors border border-transparent hover:border-orange-200"
            >
              <div class="flex items-center space-x-3 flex-1 min-w-0">
                <div class="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-medium text-sm">{{ index + 1 }}</div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ relay.url.replace(/^wss:\/\//, '') }}</p>
                  <p class="text-xs text-gray-500 truncate">
                    {{ relay.software || 'unknown software' }}<template v-if="relay.nips.length"> · {{ relay.nips.length }} NIPs</template><template v-if="relay.payment"> · paid</template><template v-else-if="relay.auth"> · auth</template>
                  </p>
                </div>
              </div>
              <div class="text-right flex-shrink-0 ml-4">
                <p class="text-sm font-semibold text-gray-900 tabular-nums">{{ relay.rttOpen }} ms</p>
                <p class="text-xs text-gray-500 tabular-nums">read {{ relay.rttRead }} ms</p>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-500 text-center py-16">{{ monitorPlaceholder }}</p>
        </div>

        <!-- Live probe + personal health -->
        <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <IconBolt class="w-5 h-5 text-amber-600" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Live From Your Browser</h3>
              <p class="text-sm text-gray-500">Popular relays probed just now</p>
            </div>
          </div>

          <div v-if="probes" class="space-y-5">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700">Relays responding</span>
                <span class="text-sm font-semibold" :class="probeHealthColor === 'emerald' ? 'text-emerald-600' : probeHealthColor === 'amber' ? 'text-amber-600' : 'text-red-600'">
                  {{ probes.summary.reachable }} / {{ probes.summary.probed }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-3">
                <div
                  class="h-3 rounded-full transition-all duration-500"
                  :class="probeHealthColor === 'emerald' ? 'bg-gradient-to-r from-emerald-400 to-green-500' : probeHealthColor === 'amber' ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-rose-500'"
                  :style="{ width: probes.summary.reachablePercentage + '%' }"
                ></div>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                Median {{ ms(probes.summary.medianConnectMs) }} to connect, {{ ms(probes.summary.medianQueryMs) }} to answer a query
              </p>
            </div>

            <ul class="divide-y divide-gray-100 border border-gray-100 rounded-xl max-h-56 overflow-y-auto">
              <li v-for="relay in probes.relays" :key="relay.url" class="flex items-center justify-between px-3 py-2 text-sm">
                <span class="flex items-center gap-2 min-w-0">
                  <span :class="['w-2 h-2 rounded-full flex-shrink-0', relay.ok ? 'bg-emerald-500' : 'bg-red-400']" :aria-label="relay.ok ? 'responding' : 'not responding'"></span>
                  <span class="truncate text-gray-800">{{ relay.url.replace(/^wss:\/\//, '') }}</span>
                </span>
                <span class="text-xs text-gray-500 tabular-nums flex-shrink-0 ml-3">
                  <template v-if="relay.ok">{{ relay.connectMs }} ms · {{ relay.notesLastMinute }} notes/min</template>
                  <template v-else>{{ relay.error || 'no response' }}</template>
                </span>
              </li>
            </ul>
          </div>
          <p v-else class="text-sm text-gray-500 text-center py-6">Live probe unavailable.</p>

          <!-- Personal relay stats -->
          <div v-if="personal" class="mt-5 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 class="text-sm font-semibold text-gray-900 mb-3">Your Relay Connections</h4>
            <div class="grid grid-cols-3 gap-3 text-center">
              <div>
                <p class="text-lg font-semibold text-emerald-600 tabular-nums">{{ personal.connected }}</p>
                <p class="text-xs text-gray-500">connected</p>
              </div>
              <div>
                <p class="text-lg font-semibold text-amber-600 tabular-nums">{{ personal.disconnected }}</p>
                <p class="text-xs text-gray-500">disconnected</p>
              </div>
              <div>
                <p class="text-lg font-semibold tabular-nums" :class="personal.healthyPercentage >= 80 ? 'text-emerald-600' : 'text-amber-600'">{{ personal.healthyPercentage }}%</p>
                <p class="text-xs text-gray-500">healthy</p>
              </div>
            </div>
          </div>
          <p v-else-if="!hideAuthPrompts" class="mt-5 bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm text-gray-500 text-center">
            Connect your Nostr account to see your personal relay health
          </p>
        </div>
      </div>

      <p v-if="network?.sources?.length" class="text-xs text-gray-400 text-center">
        Network data from NIP-66 monitors via {{ network.sources.map(s => s.replace(/^wss:\/\//, '')).join(', ') }}
      </p>

      <!-- CTA -->
      <div v-if="!hideAuthPrompts" class="bg-white border border-gray-200 rounded-3xl p-12 md:p-16 shadow-sm">
        <div class="max-w-2xl mx-auto text-center">
          <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <IconZoomIn class="w-7 h-7 text-gray-400" />
          </div>
          <h2 class="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 tracking-tight">Ready to Explore the Nostr Network?</h2>
          <p class="text-gray-600 text-base mb-10 leading-relaxed max-w-xl mx-auto">
            Connect your Nostr account to see your personal relay health and start tracking your zaps.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              @click="emit('trigger-login')"
              :disabled="isLoginLoading"
              :class="[
                'px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl transition-all duration-150 flex items-center justify-center space-x-2',
                isLoginLoading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md'
              ]"
            >
              <IconActivity v-if="isLoginLoading" class="w-5 h-5 animate-spin" />
              <IconLogin v-else class="w-5 h-5" />
              <span>{{ isLoginLoading ? 'Connecting...' : 'Connect with Nostr' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
