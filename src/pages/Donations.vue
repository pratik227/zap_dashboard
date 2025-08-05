<script setup>
import { inject } from 'vue'
import { IconGift, IconTarget, IconRocket, IconArrowRight } from '@iconify-prerendered/vue-tabler'

// Inject changePage function from parent
const changePage = inject('changePage')

// Navigate to campaigns page
const navigateToCampaigns = () => {
  changePage('campaigns')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
        <IconTarget class="w-6 h-6 text-orange-600" />
        <span>Campaigns</span>
      </h1>
      <p class="text-gray-600">Create and manage funding campaigns with Nostr</p>
    </div>
    
    <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-8 rounded-xl shadow-lg text-center">
      <div class="text-6xl mb-6">
        <IconTarget class="w-16 h-16 mx-auto text-white/90" />
      </div>
      <h3 class="text-2xl font-bold mb-3">Funding Campaigns</h3>
      <p class="text-white/90 mb-8 max-w-lg mx-auto">
        Create funding campaigns with goals, track progress, and receive zaps from your supporters using Nostr.
      </p>
      <button @click="navigateToCampaigns" class="bg-white text-orange-600 hover:bg-orange-50 px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 mx-auto shadow-lg hover:shadow-xl transform hover:scale-105">
        <IconTarget class="w-4 h-4" />
        <span>Go to Campaigns</span>
        <IconArrowRight class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>