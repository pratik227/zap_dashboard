<script setup>
import { ref, onMounted, computed } from 'vue'
import { IconClock, IconActivity, IconInfoCircle, IconNetwork, IconShield, IconPlugConnected } from '@iconify-prerendered/vue-tabler'
import { nostrNetworkService } from '../../utils/network/nostrNetworkService.js'

const isLoading = ref(true)
const stats = ref(null)
const activeTooltip = ref(null)

const tooltips = {
  onlineRelays: 'Relays that NIP-66 monitors found online in the last 24 hours.',
  latency: 'Median time for monitors to open a connection to a relay.',
  throughput: 'Unique notes published in the last minute, counted across popular relays.'
}

const showTooltip = (key) => { activeTooltip.value = key }
const hideTooltip = () => { activeTooltip.value = null }

onMounted(async () => {
  try {
    stats.value = await nostrNetworkService.getGlobalStats()
  } finally {
    isLoading.value = false
  }
})

const network = computed(() => stats.value?.network || null)
const probe = computed(() => stats.value?.probes?.summary || null)
const topNips = computed(() => (stats.value?.nipSupport || []).filter(n => n.percentage >= 20).slice(0, 8))
const fastest = computed(() => (network.value?.fastestRelays || []).slice(0, 5))

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString() : '—')
</script>

<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="relative w-16 h-16 mb-4">
        <div class="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full opacity-20 animate-pulse"></div>
        <div class="absolute inset-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
          <IconNetwork class="w-8 h-8 text-white animate-pulse" />
        </div>
      </div>
      <p class="text-gray-600 font-medium">Checking the Nostr network…</p>
    </div>

    <template v-else>
      <!-- Hero Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl p-6 text-white shadow-md relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <IconPlugConnected class="w-6 h-6" />
            </div>
            <button @mouseenter="showTooltip('onlineRelays')" @mouseleave="hideTooltip" aria-label="About online relays" class="p-1 text-white/60 hover:text-white transition-colors">
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <p class="text-white/80 text-sm font-medium mb-1">Online Relays</p>
          <p class="text-3xl font-semibold mb-1 tabular-nums">{{ fmt(network?.onlineRelays) }}</p>
          <p class="text-white/90 text-sm">{{ network ? `Seen in the last 24h by ${network.monitors} monitors` : 'Monitor data unavailable' }}</p>
          <div v-if="activeTooltip === 'onlineRelays'" class="absolute z-50 w-64 p-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-full mt-2 left-0 text-xs leading-relaxed">{{ tooltips.onlineRelays }}</div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <IconClock class="w-6 h-6 text-blue-600" />
            </div>
            <button @mouseenter="showTooltip('latency')" @mouseleave="hideTooltip" aria-label="About latency" class="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <p class="text-gray-600 text-sm font-medium mb-1">Median Latency</p>
          <p class="text-3xl font-semibold text-gray-900 tabular-nums">{{ (network?.medianRttOpen ?? probe?.medianConnectMs) ? `${fmt(network?.medianRttOpen ?? probe?.medianConnectMs)} ms` : '—' }}</p>
          <p class="text-gray-500 text-sm mt-1">to connect to a relay</p>
          <div v-if="activeTooltip === 'latency'" class="absolute z-50 w-64 p-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-full mt-2 left-0 text-xs leading-relaxed">{{ tooltips.latency }}</div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <IconActivity class="w-6 h-6 text-green-600" />
            </div>
            <button @mouseenter="showTooltip('throughput')" @mouseleave="hideTooltip" aria-label="About notes per minute" class="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <p class="text-gray-600 text-sm font-medium mb-1">Notes per Minute</p>
          <p class="text-3xl font-semibold text-gray-900 tabular-nums">{{ fmt(probe?.notesLastMinute) }}</p>
          <p class="text-gray-500 text-sm mt-1">{{ probe?.reachable ? `across ${probe.reachable} popular relays` : 'Live probe unavailable' }}</p>
          <div v-if="activeTooltip === 'throughput'" class="absolute z-50 w-64 p-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-full mt-2 right-0 text-xs leading-relaxed">{{ tooltips.throughput }}</div>
        </div>
      </div>

      <!-- NIP Support -->
      <div v-if="topNips.length" class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">NIP Adoption</h3>
            <p class="text-sm text-gray-600">Most widely supported NIPs across {{ fmt(stats.nipSampleSize) }} relays</p>
          </div>
          <IconShield class="w-7 h-7 text-orange-500" />
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="nip in topNips" :key="nip.nip" class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-orange-900">NIP-{{ nip.nip }}</span>
              <span class="text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">{{ nip.percentage }}%</span>
            </div>
            <p class="text-xs text-orange-800 leading-tight">{{ nip.description }}</p>
          </div>
        </div>
      </div>

      <!-- Network Features -->
      <div v-if="network" class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-6 tracking-tight">Network Features</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p class="text-sm text-gray-600 mb-2">Open to everyone</p>
            <p class="text-2xl font-semibold text-emerald-600 tabular-nums">{{ fmt(network.openAccess) }}</p>
            <p class="text-sm text-gray-500 mt-1">no auth, payment or PoW</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2">Paid relays</p>
            <p class="text-2xl font-semibold text-amber-600 tabular-nums">{{ fmt(network.paymentRequired) }}</p>
            <p class="text-sm text-gray-500 mt-1">require payment to write</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2">NIP-50 search</p>
            <p class="text-2xl font-semibold text-orange-600 tabular-nums">{{ fmt(stats.searchSupportCount) }}</p>
            <p class="text-sm text-gray-500 mt-1">relays with full-text search</p>
          </div>
        </div>
      </div>

      <!-- Fastest Relays -->
      <div v-if="fastest.length" class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Fastest Relays</h3>
          <p class="text-sm text-gray-600">Lowest connect + read time, measured by monitors</p>
        </div>
        <div class="space-y-2">
          <div v-for="(relay, index) in fastest" :key="relay.url" class="flex items-center justify-between p-3 rounded-xl hover:bg-orange-50 transition-colors border border-gray-200 hover:border-orange-200">
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center text-white font-medium text-sm flex-shrink-0">{{ index + 1 }}</div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 truncate">{{ relay.url.replace(/^wss:\/\//, '') }}</p>
                <p class="text-xs text-gray-500 truncate">{{ relay.software || 'unknown software' }}</p>
              </div>
            </div>
            <span class="text-sm font-semibold text-gray-900 tabular-nums flex-shrink-0 ml-4">{{ relay.rttOpen }} ms</span>
          </div>
        </div>
      </div>

      <p v-if="!network && !probe?.reachable" class="text-sm text-gray-500 text-center py-6">Couldn’t reach the Nostr network right now.</p>
    </template>
  </div>
</template>
