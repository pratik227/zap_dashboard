<template>
  <div class="max-w-5xl mx-auto">
    <!-- Hero Section -->
    <div class="text-center mb-12">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl shadow-lg mb-6">
        <IconChartBar class="w-10 h-10 text-white" />
      </div>
      <h2 class="text-3xl font-bold text-gray-900 mb-4">
        Unlock Powerful Lightning Analytics
      </h2>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
        Track your zaps, understand your supporters, and grow your Lightning Network presence with real-time insights
      </p>
    </div>

    <!-- Feature Grid -->
    <div class="grid md:grid-cols-3 gap-6 mb-12">
      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconBolt class="w-7 h-7 text-orange-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Real-Time Zap Tracking</h3>
        <p class="text-gray-600 leading-relaxed">
          See every zap as it happens. Track amounts, senders, and engagement patterns across your content.
        </p>
      </div>

      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconUsers class="w-7 h-7 text-orange-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Supporter Insights</h3>
        <p class="text-gray-600 leading-relaxed">
          Discover who your top supporters are, when they're most active, and how they engage with your work.
        </p>
      </div>

      <div class="bg-white rounded-2xl border-2 border-gray-100 p-6 hover:border-orange-200 hover:shadow-lg transition-all duration-300">
        <div class="w-14 h-14 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
          <IconTrendingUp class="w-7 h-7 text-orange-600" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Growth Analytics</h3>
        <p class="text-gray-600 leading-relaxed">
          Visualize trends, track earnings over time, and optimize your content strategy with data-driven insights.
        </p>
      </div>
    </div>

    <!-- Example Preview -->
    <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200 p-8 mb-8">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-900">What You'll See</h3>
        <span class="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">Preview</span>
      </div>

      <!-- Mock Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-sm text-gray-600 mb-1">Total Zaps</div>
          <div class="text-2xl font-bold text-gray-400">---</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-sm text-gray-600 mb-1">Total Sats</div>
          <div class="text-2xl font-bold text-gray-400">---</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-sm text-gray-600 mb-1">Avg Zap</div>
          <div class="text-2xl font-bold text-gray-400">---</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200">
          <div class="text-sm text-gray-600 mb-1">Supporters</div>
          <div class="text-2xl font-bold text-gray-400">---</div>
        </div>
      </div>

      <!-- Mock Chart -->
      <div class="bg-white rounded-xl p-6 border border-gray-200">
        <div class="h-48 flex items-end justify-around space-x-2">
          <div v-for="i in 7" :key="i" class="flex-1 bg-gray-200 rounded-t opacity-50" :style="{ height: `${30 + Math.random() * 60}%` }"></div>
        </div>
        <div class="flex justify-between mt-4 text-xs text-gray-400">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-8 text-white text-center shadow-xl">
      <h3 class="text-2xl font-bold mb-3">Ready to Get Started?</h3>
      <p class="text-orange-50 mb-6 text-lg">
        Connect your Nostr account to start tracking your Lightning Network activity
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          @click="$emit('connect-nostr')"
          class="bg-white text-orange-600 px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <IconBolt class="w-5 h-5" />
          <span>Connect with Nostr</span>
        </button>
        <button
          @click="$emit('show-help')"
          class="bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-700 transition-all duration-200 flex items-center justify-center space-x-2 border-2 border-white/30"
        >
          <IconHelp class="w-5 h-5" />
          <span>Learn How It Works</span>
        </button>
      </div>
    </div>

    <!-- Features List -->
    <div class="mt-12 grid md:grid-cols-2 gap-6">
      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconCheck class="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 mb-1">Privacy First</h4>
          <p class="text-gray-600 text-sm">Your data stays in your browser. We never store your private keys or personal information.</p>
        </div>
      </div>

      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconCheck class="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 mb-1">Free Forever</h4>
          <p class="text-gray-600 text-sm">No subscriptions, no hidden fees. Track unlimited zaps and supporters at no cost.</p>
        </div>
      </div>

      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconCheck class="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 mb-1">Real-Time Updates</h4>
          <p class="text-gray-600 text-sm">See your analytics update instantly as zaps come in from across the Nostr network.</p>
        </div>
      </div>

      <div class="flex items-start space-x-4">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconCheck class="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h4 class="font-semibold text-gray-900 mb-1">Export & Share</h4>
          <p class="text-gray-600 text-sm">Download reports, share insights, and integrate with your workflow seamlessly.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  IconChartBar,
  IconBolt,
  IconUsers,
  IconTrendingUp,
  IconHelp,
  IconCheck
} from '@iconify-prerendered/vue-tabler'

defineEmits(['connect-nostr', 'show-help'])
</script>
