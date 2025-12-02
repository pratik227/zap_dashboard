<script setup>
import { ref } from 'vue'
import { IconBolt, IconChartBar, IconUsers, IconWallet, IconTrendingUp, IconCheck, IconHelp } from '@iconify-prerendered/vue-tabler'
import LightningStats from './LightningStats.vue'

const emit = defineEmits(['connect', 'show-help'])

const handleConnect = () => {
  emit('connect')
}

const handleShowHelp = () => {
  emit('show-help')
}
</script>

<template>
  <div class="space-y-8 pb-8">
    <!-- Hero Section -->
    <div class="text-center space-y-6 py-12">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl shadow-lg mb-4">
        <IconBolt class="w-10 h-10 text-white" />
      </div>
      <div>
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          Your Lightning Command Center
        </h1>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto mb-2">
          Track zaps, analyze supporters, and grow your Lightning Network presence
        </p>
        <p class="text-base text-gray-500 max-w-xl mx-auto">
          Get real-time insights into your earnings, engagement, and audience across the Nostr network
        </p>
      </div>
    </div>

    <!-- Features Grid -->
    <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconChartBar class="w-6 h-6 text-orange-600" />
        </div>
        <h3 class="font-semibold text-gray-900 mb-2">Analytics</h3>
        <p class="text-sm text-gray-600">Track earnings, trends, and growth with beautiful visualizations</p>
      </div>

      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconUsers class="w-6 h-6 text-orange-600" />
        </div>
        <h3 class="font-semibold text-gray-900 mb-2">Audience</h3>
        <p class="text-sm text-gray-600">Understand your supporters and grow your community</p>
      </div>

      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconWallet class="w-6 h-6 text-orange-600" />
        </div>
        <h3 class="font-semibold text-gray-900 mb-2">Wallet</h3>
        <p class="text-sm text-gray-600">Manage payments and track your Lightning balance</p>
      </div>

      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconTrendingUp class="w-6 h-6 text-orange-600" />
        </div>
        <h3 class="font-semibold text-gray-900 mb-2">Campaigns</h3>
        <p class="text-sm text-gray-600">Create funding campaigns and track your goals</p>
      </div>
    </div>

    <!-- Preview Section -->
    <div class="max-w-4xl mx-auto bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 p-8 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900">Your Dashboard Preview</h3>
        <span class="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">Example</span>
      </div>

      <!-- Mock Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-xs text-gray-500 mb-1">Total Zaps</div>
          <div class="text-2xl font-bold text-gray-400">0</div>
          <div class="text-xs text-gray-400 mt-1">Connect to track</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-xs text-gray-500 mb-1">Total Earned</div>
          <div class="text-2xl font-bold text-gray-400">0 sats</div>
          <div class="text-xs text-gray-400 mt-1">Start earning</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-xs text-gray-500 mb-1">Supporters</div>
          <div class="text-2xl font-bold text-gray-400">0</div>
          <div class="text-xs text-gray-400 mt-1">Build audience</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-xs text-gray-500 mb-1">Avg Zap</div>
          <div class="text-2xl font-bold text-gray-400">0 sats</div>
          <div class="text-xs text-gray-400 mt-1">Coming soon</div>
        </div>
      </div>

      <!-- Mock Chart -->
      <div class="bg-white rounded-xl p-6 border border-gray-200">
        <div class="text-sm font-medium text-gray-700 mb-4">7 Day Activity</div>
        <div class="h-32 flex items-end justify-around space-x-2">
          <div v-for="i in 7" :key="i" class="flex-1 bg-gray-200 rounded-t opacity-40" :style="{ height: `${20 + Math.random() * 60}%` }"></div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="max-w-3xl mx-auto">
      <div class="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-8 text-white text-center shadow-xl">
        <h3 class="text-2xl font-bold mb-3">Ready to Get Started?</h3>
        <p class="text-orange-50 mb-6 text-lg">
          Connect your Nostr account to unlock your Lightning analytics dashboard
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            @click="handleConnect"
            class="bg-white text-orange-600 px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <IconBolt class="w-5 h-5" />
            <span>Connect with Nostr</span>
          </button>
          <button
            @click="handleShowHelp"
            class="bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-700 transition-all duration-200 flex items-center justify-center space-x-2 border-2 border-white/30"
          >
            <IconHelp class="w-5 h-5" />
            <span>How It Works</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Benefits -->
    <div class="max-w-3xl mx-auto grid md:grid-cols-2 gap-4 mt-8">
      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <IconCheck class="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 text-sm mb-1">Privacy First</h4>
          <p class="text-gray-600 text-xs">Your keys never leave your device</p>
        </div>
      </div>

      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <IconCheck class="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 text-sm mb-1">Free Forever</h4>
          <p class="text-gray-600 text-xs">No subscriptions or hidden fees</p>
        </div>
      </div>

      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <IconCheck class="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 text-sm mb-1">Real-Time Data</h4>
          <p class="text-gray-600 text-xs">See updates as they happen</p>
        </div>
      </div>

      <div class="flex items-start space-x-3">
        <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <IconCheck class="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 text-sm mb-1">Export & Share</h4>
          <p class="text-gray-600 text-xs">Download reports anytime</p>
        </div>
      </div>
    </div>

    <!-- Lightning Network Stats - Mempool Style -->
    <LightningStats />

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
