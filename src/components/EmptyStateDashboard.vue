<script setup>
import { ref } from 'vue'
import { IconBolt } from '@iconify-prerendered/vue-tabler'
import LightningStats from './LightningStats.vue'

const emit = defineEmits(['connect'])

const handleConnect = () => {
  emit('connect')
}
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
