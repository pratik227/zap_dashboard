<script setup>
import { ref, onMounted, computed } from 'vue'
import { nostrNetworkService } from '../../services/nostrNetworkService.js'
import {
  IconActivity,
  IconRefresh,
  IconSearch,
  IconShield,
  IconServer,
  IconWorld,
  IconWifi,
  IconWifiOff
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  hideAuthPrompts: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['trigger-login', 'show-help'])

const isLoading = ref(true)
const stats = ref(null)
const loadError = ref('')

const loadData = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    stats.value = await nostrNetworkService.getNetworkStats()
  } catch (error) {
    loadError.value = 'Could not load Nostr relay health.'
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

const refreshData = async () => {
  nostrNetworkService.clearCache()
  await loadData()
}

const summaryCards = computed(() => {
  if (!stats.value) return []

  return [
    {
      title: 'Online Relays',
      value: nostrNetworkService.formatNumber(stats.value.onlineRelays || stats.value.onlineFeatured),
      subtitle: 'Relays currently reachable',
      icon: IconWifi,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600'
    },
    {
      title: 'Known Relays',
      value: nostrNetworkService.formatNumber(stats.value.knownRelays),
      subtitle: 'Unique relays observed',
      icon: IconServer,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'NIP-50 Search',
      value: nostrNetworkService.formatNumber(stats.value.nip50Relays),
      subtitle: 'Relays advertising search',
      icon: IconSearch,
      color: 'from-purple-500 to-fuchsia-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      title: 'Average Response',
      value: nostrNetworkService.formatLatency(stats.value.averageResponseMs),
      subtitle: 'Featured relay NIP-11 check',
      icon: IconActivity,
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    }
  ]
})

const healthRows = computed(() => stats.value?.featuredRelays || [])

const healthSummary = computed(() => {
  if (!stats.value) return []

  return [
    {
      label: 'Fast featured relays',
      value: stats.value.onlineFeatured,
      color: 'bg-emerald-500'
    },
    {
      label: 'Slow featured relays',
      value: stats.value.slowFeatured,
      color: 'bg-amber-500'
    },
    {
      label: 'Offline featured relays',
      value: stats.value.offlineFeatured,
      color: 'bg-red-500'
    }
  ]
})

const nipAdoption = computed(() => {
  if (!stats.value) return []

  return [
    {
      label: 'NIP-50 search',
      value: stats.value.nip50Relays,
      description: 'Useful for finding notes, profiles, and content inside a relay.'
    },
    {
      label: 'NIP-42 auth',
      value: stats.value.nip42Relays,
      description: 'Relays that support authentication flows for spam resistance and access control.'
    },
    {
      label: 'Paid relays',
      value: stats.value.paidRelays,
      description: 'Relays that may require payment for admission, publishing, or subscriptions.'
    }
  ]
})

const statusClasses = {
  online: 'bg-emerald-100 text-emerald-700',
  slow: 'bg-amber-100 text-amber-700',
  offline: 'bg-red-100 text-red-700'
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-500 rounded-2xl p-6 text-white shadow-lg">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <IconWorld class="w-8 h-8" />
            <h2 class="text-3xl font-bold">Nostr Network Explorer</h2>
          </div>
          <p class="text-purple-100 max-w-3xl">
            Live relay health, feature support, and NIP adoption for the Nostr network.
          </p>
          <p v-if="stats?.isFallback" class="mt-3 text-sm text-purple-100">
            Showing fallback relay data because the live relay APIs were unavailable.
          </p>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            @click="refreshData"
            class="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg font-semibold transition-colors"
          >
            <IconRefresh class="w-4 h-4" />
            Refresh
          </button>
          <button
            v-if="!props.hideAuthPrompts"
            @click="emit('trigger-login')"
            class="px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 rounded-lg font-semibold transition-colors"
          >
            Connect Nostr
          </button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="index in 4" :key="index" class="bg-white rounded-xl p-6 border border-gray-100 shadow-sm animate-pulse">
        <div class="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div class="h-8 bg-gray-200 rounded w-1/3 mb-3"></div>
        <div class="h-4 bg-gray-100 rounded w-2/3"></div>
      </div>
    </div>

    <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
      {{ loadError }}
    </div>

    <template v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="card in summaryCards"
          :key="card.title"
          class="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-semibold text-gray-500">{{ card.title }}</p>
              <p class="text-3xl font-bold text-gray-900 mt-2">{{ card.value }}</p>
              <p class="text-sm text-gray-500 mt-1">{{ card.subtitle }}</p>
            </div>
            <div :class="['w-12 h-12 rounded-xl flex items-center justify-center', card.bgColor]">
              <component :is="card.icon" :class="['w-6 h-6', card.textColor]" />
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-xl p-6 border border-gray-100 shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h3 class="text-xl font-bold text-gray-900">Featured Relay Health</h3>
              <p class="text-sm text-gray-500">NIP-11 checks against common public relays.</p>
            </div>
            <IconShield class="w-6 h-6 text-purple-500" />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500 border-b border-gray-100">
                  <th class="py-3 pr-4 font-semibold">Relay</th>
                  <th class="py-3 pr-4 font-semibold">Status</th>
                  <th class="py-3 pr-4 font-semibold">Latency</th>
                  <th class="py-3 pr-4 font-semibold">NIPs</th>
                  <th class="py-3 font-semibold">Access</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="relay in healthRows" :key="relay.relayUrl" class="border-b border-gray-50">
                  <td class="py-4 pr-4">
                    <p class="font-semibold text-gray-900">{{ relay.name }}</p>
                    <p class="text-xs text-gray-500">{{ relay.relayUrl }}</p>
                  </td>
                  <td class="py-4 pr-4">
                    <span :class="['px-2.5 py-1 rounded-full text-xs font-bold', statusClasses[relay.status]]">
                      {{ relay.status }}
                    </span>
                  </td>
                  <td class="py-4 pr-4 text-gray-700">
                    {{ nostrNetworkService.formatLatency(relay.responseMs) }}
                  </td>
                  <td class="py-4 pr-4 text-gray-700">
                    {{ relay.supportedNips.slice(0, 6).join(', ') || 'N/A' }}
                  </td>
                  <td class="py-4 text-gray-700">
                    <span v-if="relay.paymentRequired">Paid</span>
                    <span v-else-if="relay.authRequired">Auth</span>
                    <span v-else>Public</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Health Mix</h3>
            <div class="space-y-4">
              <div v-for="item in healthSummary" :key="item.label">
                <div class="flex justify-between text-sm mb-1">
                  <span class="text-gray-600">{{ item.label }}</span>
                  <span class="font-semibold text-gray-900">{{ item.value }}</span>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    :class="['h-full rounded-full', item.color]"
                    :style="{ width: `${Math.min(100, (item.value / healthRows.length) * 100)}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <h3 class="text-xl font-bold text-gray-900 mb-4">Feature Adoption</h3>
            <div class="space-y-4">
              <div v-for="item in nipAdoption" :key="item.label" class="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                <div class="flex items-center justify-between">
                  <p class="font-semibold text-gray-900">{{ item.label }}</p>
                  <p class="text-lg font-bold text-purple-600">{{ nostrNetworkService.formatNumber(item.value) }}</p>
                </div>
                <p class="text-sm text-gray-500 mt-1">{{ item.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-cyan-50 border border-cyan-100 rounded-xl p-5 flex items-start gap-3">
        <IconWifiOff class="w-5 h-5 text-cyan-700 mt-0.5" />
        <div>
          <p class="font-semibold text-cyan-900">Why this is more useful for ZapTracker</p>
          <p class="text-sm text-cyan-800 mt-1">
            ZapTracker users depend on Nostr relays for profile discovery, event publishing, search, and wallet-related social activity.
            Relay health and NIP support are more actionable here than Lightning channel capacity.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
