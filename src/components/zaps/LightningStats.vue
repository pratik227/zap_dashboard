<script setup>
import { ref, onMounted, computed } from 'vue'
import {
  IconBolt, IconTrendingUp, IconTrendingDown, IconWorld,
  IconServer, IconActivity, IconInfoCircle, IconNetwork,
  IconShield, IconSearch, IconZzz, IconPlugConnected,
} from '@iconify-prerendered/vue-tabler'
import { nostrNetworkService } from '../../utils/network/nostrNetworkService.js'

const isLoading = ref(true)
const stats = ref(null)
const capabilities = ref(null)
const activeTooltip = ref(null)

const tooltips = {
  onlineRelays: 'Relays currently accepting connections. Higher availability means a healthier Nostr network.',
  totalRelays: 'All known Nostr relays that have ever been active on the network.',
  searchSupport: 'Relays implementing NIP-50 search. These allow searching event content via text queries.',
  authSupport: 'Relays implementing NIP-42 authentication. These support authenticated client connections.',
  zapSupport: 'Relays supporting NIP-57 Lightning Zaps, enabling Bitcoin tipping on Nostr.',
}

const showTooltip = (key) => { activeTooltip.value = key }
const hideTooltip = () => { activeTooltip.value = null }

onMounted(async () => {
  isLoading.value = true
  try {
    const globalStats = await nostrNetworkService.getGlobalStats()
    stats.value = globalStats
    capabilities.value = globalStats.relayCapabilities
  } catch (error) {
    console.error('Error fetching Nostr network data:', error)
  } finally {
    isLoading.value = false
  }
})

const topRelays = computed(() => {
  if (!capabilities.value?.relays) return []
  return capabilities.value.relays.filter(r => r.supported).slice(0, 5)
})

const topNips = computed(() => {
  if (!capabilities.value?.nipSupport) return []
  return capabilities.value.nipSupport
    .filter(n => n.percentage >= 50)
    .slice(0, 8)
})

const relayHealthColor = computed(() => {
  if (!stats.value) return 'gray'
  const pct = stats.value.onlinePercentage
  if (pct >= 80) return 'emerald'
  if (pct >= 60) return 'amber'
  return 'red'
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="relative w-16 h-16 mb-4">
        <div class="absolute inset-0 bg-gradient-to-r from-fuchsia-400 to-purple-400 rounded-full opacity-20 animate-pulse"></div>
        <div class="absolute inset-2 bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-full flex items-center justify-center">
          <IconNetwork class="w-8 h-8 text-white animate-pulse" />
        </div>
      </div>
      <p class="text-gray-600 font-medium">Probing Nostr network relays...</p>
    </div>

    <template v-else>
      <!-- Hero Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Online Relays -->
        <div class="bg-gradient-to-br from-fuchsia-500 to-purple-500 rounded-2xl p-6 text-white shadow-md relative group">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <IconPlugConnected class="w-6 h-6" />
            </div>
            <button
              @mouseenter="showTooltip('onlineRelays')"
              @mouseleave="hideTooltip"
              class="p-1 text-white/60 hover:text-white transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <p class="text-white/80 text-sm font-medium mb-1">Online Relays</p>
          <p class="text-3xl font-semibold mb-1">{{ stats?.onlineRelays?.toLocaleString() || 'N/A' }}</p>
          <p class="text-white/90 text-lg font-medium">{{ stats?.onlinePercentage || 0 }}% of known relays</p>

          <div
            v-if="activeTooltip === 'onlineRelays'"
            class="absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-0 left-full ml-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div class="absolute w-3 h-3 bg-gray-900 border-l border-t border-gray-700 transform rotate-45 -left-1.5 top-8"></div>
            <h4 class="font-medium text-sm mb-2 text-white">Online Relays</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.onlineRelays }}</p>
          </div>
        </div>

        <!-- Total Known Relays -->
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
              <IconWorld class="w-6 h-6 text-purple-600" />
            </div>
            <button
              @mouseenter="showTooltip('totalRelays')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <p class="text-gray-600 text-sm font-medium mb-1">Known Relays</p>
          <p class="text-3xl font-semibold text-gray-900">{{ stats?.totalRelays?.toLocaleString() || 'N/A' }}</p>
          <p class="text-gray-500 text-sm mt-1">In the Nostr network</p>

          <div
            v-if="activeTooltip === 'totalRelays'"
            class="absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-0 left-full ml-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div class="absolute w-3 h-3 bg-gray-900 border-l border-t border-gray-700 transform rotate-45 -left-1.5 top-8"></div>
            <h4 class="font-medium text-sm mb-2 text-white">Known Relays</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.totalRelays }}</p>
          </div>
        </div>

        <!-- NIP-50 Search Support -->
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
              <IconSearch class="w-6 h-6 text-cyan-600" />
            </div>
            <button
              @mouseenter="showTooltip('searchSupport')"
              @mouseleave="hideTooltip"
              class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <IconInfoCircle class="w-5 h-5" />
            </button>
          </div>
          <p class="text-gray-600 text-sm font-medium mb-1">NIP-50 Search Support</p>
          <p class="text-3xl font-semibold text-gray-900">{{ stats?.searchSupportCount?.toLocaleString() || 'N/A' }}</p>
          <p class="text-gray-500 text-sm mt-1">Relays supporting content search</p>

          <div
            v-if="activeTooltip === 'searchSupport'"
            class="absolute z-50 w-72 p-4 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 top-0 left-full ml-4"
            style="animation: fadeIn 0.2s ease-out"
          >
            <div class="absolute w-3 h-3 bg-gray-900 border-l border-t border-gray-700 transform rotate-45 -left-1.5 top-8"></div>
            <h4 class="font-medium text-sm mb-2 text-white">Search Support</h4>
            <p class="text-xs text-gray-300 leading-relaxed">{{ tooltips.searchSupport }}</p>
          </div>
        </div>
      </div>

      <!-- NIP Support Distribution -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">NIP Adoption</h3>
            <p class="text-sm text-gray-600">Most widely supported NIPs across probed relays</p>
          </div>
          <IconShield class="w-7 h-7 text-purple-500" />
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="nip in topNips" :key="nip.nip"
            class="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-purple-900">NIP-{{ nip.nip }}</span>
              <span class="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-full">
                {{ nip.percentage }}%
              </span>
            </div>
            <p class="text-xs text-purple-700 leading-tight">{{ nip.description }}</p>
            <p class="text-xs text-purple-500 mt-1">{{ nip.count }}/{{ nip.total }} relays</p>
          </div>
        </div>
      </div>

      <!-- Feature Support Summary -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 class="text-lg font-semibold text-gray-900 mb-6 tracking-tight">Network Features</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p class="text-sm text-gray-600 mb-2">Relays with NIP-42 Auth</p>
            <p class="text-2xl font-semibold text-purple-600">{{ stats?.authSupportCount?.toLocaleString() || 'N/A' }}</p>
            <p class="text-sm text-gray-500 mt-1">of {{ stats?.probedRelays || 0 }} probed</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2">Relays with NIP-57 Zaps</p>
            <p class="text-2xl font-semibold text-purple-600">{{ stats?.zapSupportCount?.toLocaleString() || 'N/A' }}</p>
            <p class="text-sm text-gray-500 mt-1">Enable Bitcoin tipping</p>
          </div>
          <div>
            <p class="text-sm text-gray-600 mb-2">Relay Health Score</p>
            <p class="text-2xl font-semibold" :class="relayHealthColor === 'emerald' ? 'text-emerald-600' : relayHealthColor === 'amber' ? 'text-amber-600' : 'text-red-600'">
              {{ stats?.onlinePercentage || 0 }}%
            </p>
            <p class="text-sm text-gray-500 mt-1">
              {{ relayHealthColor === 'emerald' ? 'Excellent' : relayHealthColor === 'amber' ? 'Fair' : 'Poor' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Top Probed Relays -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 tracking-tight">Sampled Relays</h3>
            <p class="text-sm text-gray-600">Well-known relays with NIP-11 info</p>
          </div>
        </div>

        <div class="space-y-2">
          <div v-for="(relay, index) in topRelays" :key="relay.url"
            class="flex items-center justify-between p-3 rounded-xl hover:bg-purple-50 transition-colors border border-gray-200 hover:border-purple-200">
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <div class="w-8 h-8 bg-gradient-to-br from-fuchsia-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                {{ index + 1 }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-900 truncate">{{ relay.name }}</p>
                <p class="text-xs text-gray-500 truncate">{{ relay.url }}</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0 ml-4">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                {{ relay.nips?.length || 0 }} NIPs
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.animate-pulse {
  animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
