<script setup>
import { computed, ref } from 'vue'
import {
  IconBolt,
  IconChartBar,
  IconWallet,
  IconFileText,
  IconTarget,
  IconUsers,
  IconCurrencyBitcoin,
  IconTrendingUp,
  IconWorld,
  IconLogin,
  IconRefresh
} from '@iconify-prerendered/vue-tabler'
import { useLightningNetwork } from '../composables/useLightningNetwork.js'
import LightningNetworkMap from './LightningNetworkMap.vue'

const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['trigger-login'])

const showMap = ref(false)

// Use Lightning Network data
const {
  globalStats,
  formattedStats,
  isLoading,
  networkHealth,
  refresh
} = useLightningNetwork()

// Trigger nostr-login widget
const handleConnect = () => {
  console.log('🚀 Triggering nostr-login widget from EmptyStateDashboard...')
  emit('trigger-login')
}

const toggleMap = () => {
  showMap.value = !showMap.value
}

// Network health color
const healthColor = computed(() => {
  switch (networkHealth.value) {
    case 'excellent':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'good':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'fair':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
})

const features = [
  {
    icon: IconChartBar,
    name: 'Real-Time Dashboard',
    description: 'Monitor all your Lightning activity in one place',
    image: '/dashboard.png'
  },
  {
    icon: IconChartBar,
    name: 'Deep Analytics',
    description: 'Understand trends and optimize your earnings',
    image: '/analytics.png'
  },
  {
    icon: IconWallet,
    name: 'Wallet Management',
    description: 'Seamlessly connect and manage your NWC wallet',
    image: '/wallet.png'
  },
  {
    icon: IconFileText,
    name: 'Content Tracking',
    description: 'See which content drives the most zaps',
    image: '/ZapStore_Preview_1.png'
  },
  {
    icon: IconTarget,
    name: 'Campaign Builder',
    description: 'Create and track fundraising campaigns',
    image: '/ZapTracker_campaigns.png'
  },
  {
    icon: IconUsers,
    name: 'Audience Insights',
    description: 'Understand your supporters and grow your community',
    image: '/ZapStore_Preview_2.png'
  }
]
</script>

<template>
  <div class="space-y-8 animate-fade-in">
    <!-- Hero Section -->
    <div class="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-2xl shadow-2xl">
      <div class="absolute inset-0 bg-grid-pattern opacity-10"></div>
      <div class="relative px-6 py-12 sm:px-12 sm:py-16 text-center">
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl animate-pulse-glow">
            <IconBolt class="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 class="text-3xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">
          Welcome to ZapTracker
        </h1>
        <p class="text-lg sm:text-xl text-orange-50 mb-8 max-w-2xl mx-auto">
          Your comprehensive Lightning Network dashboard for tracking zaps, managing earnings, and growing your presence.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            @click="handleConnect"
            class="px-8 py-4 bg-white text-orange-600 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <IconLogin class="w-5 h-5" />
            <span>Connect with Nostr</span>
          </button>
          <button
            @click="toggleMap"
            class="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 font-semibold rounded-xl hover:bg-white/20 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <IconWorld class="w-5 h-5" />
            <span>{{ showMap ? 'Hide' : 'Explore' }} Global Network</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Lightning Network Stats Section -->
    <div class="bg-white rounded-xl shadow-lg border border-orange-100 overflow-hidden">
      <div class="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <IconWorld class="w-7 h-7 text-orange-600" />
              <span>Lightning Network Statistics</span>
            </h2>
            <p class="text-sm text-gray-600 mt-1">Real-time data from the global Lightning Network</p>
          </div>
          <div class="flex items-center space-x-3">
            <span
              :class="['px-3 py-1 rounded-full text-xs font-medium border', healthColor]"
            >
              Network: {{ networkHealth }}
            </span>
            <button
              @click="refresh"
              :disabled="isLoading"
              class="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 disabled:opacity-50"
            >
              <IconRefresh :class="['w-5 h-5', isLoading ? 'animate-spin' : '']" />
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="bg-gray-200 rounded-lg h-32"></div>
        </div>
      </div>

      <div v-else-if="formattedStats" class="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6">
        <!-- Total Nodes -->
        <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center shadow-lg">
              <IconBolt class="w-6 h-6 text-white" />
            </div>
            <IconTrendingUp class="w-5 h-5 text-green-600" />
          </div>
          <div class="text-3xl font-bold text-gray-900 mb-1">
            {{ formattedStats.totalNodes }}
          </div>
          <div class="text-sm font-medium text-gray-600">Total Lightning Nodes</div>
        </div>

        <!-- Total Capacity -->
        <div class="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-200 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-amber-400 to-yellow-400 rounded-lg flex items-center justify-center shadow-lg">
              <IconCurrencyBitcoin class="w-6 h-6 text-white" />
            </div>
            <IconTrendingUp class="w-5 h-5 text-green-600" />
          </div>
          <div class="text-3xl font-bold text-gray-900 mb-1">
            {{ formattedStats.totalCapacity }}
          </div>
          <div class="text-sm font-medium text-gray-600">Network Capacity</div>
        </div>

        <!-- Countries -->
        <div class="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-lg flex items-center justify-center shadow-lg">
              <IconWorld class="w-6 h-6 text-white" />
            </div>
            <IconTrendingUp class="w-5 h-5 text-green-600" />
          </div>
          <div class="text-3xl font-bold text-gray-900 mb-1">
            {{ formattedStats.totalCountries }}
          </div>
          <div class="text-sm font-medium text-gray-600">Countries with Nodes</div>
        </div>
      </div>

      <!-- Top Countries Quick View -->
      <div v-if="formattedStats && !showMap" class="px-6 pb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Countries by Node Count</h3>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div
            v-for="country in formattedStats.topCountries.slice(0, 5)"
            :key="country.iso"
            class="bg-orange-50 rounded-lg p-3 border border-orange-200 hover:border-orange-300 transition-all text-center"
          >
            <div class="text-3xl mb-2">{{ country.flagEmoji }}</div>
            <div class="text-sm font-semibold text-gray-900 truncate">
              {{ country.name?.en || country.iso }}
            </div>
            <div class="text-xs text-gray-600 mt-1">
              {{ country.count }} nodes
            </div>
          </div>
        </div>
        <div class="mt-4 text-center">
          <button
            @click="toggleMap"
            class="text-sm text-orange-600 hover:text-orange-700 font-medium inline-flex items-center space-x-1"
          >
            <span>View Full Global Map</span>
            <IconWorld class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Lightning Network Map -->
    <LightningNetworkMap
      v-if="showMap && globalStats"
      :countries="globalStats.allCountries"
      :is-loading="isLoading"
    />

    <!-- Why Connect Section - Compact -->
    <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
            <IconBolt class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900 text-sm">Connect Your Account</h3>
            <p class="text-xs text-gray-600">Track zaps, analyze earnings, and grow your presence</p>
          </div>
        </div>
        <button
          @click="handleConnect"
          class="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 whitespace-nowrap"
        >
          Get Started
        </button>
      </div>
    </div>

    <!-- Compact Features Overview -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
        <h2 class="text-xl font-bold text-gray-900 text-center">What You Can Track</h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div
            v-for="feature in features"
            :key="feature.name"
            class="group flex flex-col items-center text-center p-3 rounded-lg hover:bg-orange-50 transition-all duration-200 cursor-pointer"
          >
            <div class="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center mb-2 group-hover:scale-110 group-hover:shadow-md transition-all duration-200">
              <component :is="feature.icon" class="w-6 h-6 text-orange-600" />
            </div>
            <h3 class="text-xs font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">{{ feature.name }}</h3>
          </div>
        </div>
      </div>
    </div>
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

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(255, 255, 255, 0.6);
  }
}

.animate-fade-in {
  animation: fade-in 0.6s ease-out;
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.bg-grid-pattern {
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
