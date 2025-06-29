<script setup>
import { IconWallet, IconChartLine, IconRocket } from '@iconify-prerendered/vue-tabler'
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
        <IconWallet class="w-6 h-6 text-orange-600" />
        <span>Finances</span>
      </h1>
      <p class="text-gray-600">Financial overview and reporting</p>
    </div>
    
    <div class="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div class="text-6xl mb-4">
        <IconWallet class="w-16 h-16 mx-auto text-gray-300" />
      </div>
      <h3 class="text-xl font-semibold text-gray-900 mb-2">Financial Dashboard</h3>
      <p class="text-gray-600 mb-6">Track your earnings, expenses, and financial metrics.</p>
<!--      <button class="btn-primary">-->
<!--        <IconChartLine class="w-4 h-4" />-->
<!--        View Reports-->
<!--      </button>-->
      <button class="btn-primary">
        <IconRocket class="w-4 h-4" />
        Coming Soon
      </button>
    </div>
  </div>
</template>
