<template>
  <div class="max-w-5xl mx-auto">
    <!-- Hero Section -->
    <div class="text-center mb-12">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-amber-500 rounded-3xl shadow-lg mb-6">
        <IconChartBar class="w-10 h-10 text-white" />
      </div>
      <h2 class="text-3xl font-bold text-gray-900 mb-4">
        No Analytics Data Yet
      </h2>
      <p class="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
        Your analytics page is empty because you haven't received any zaps yet. Let's change that!
      </p>
    </div>

    <!-- Why Empty Explanation -->
    <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
      <div class="flex items-start space-x-4">
        <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <IconInfoCircle class="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Why is this empty?</h3>
          <p class="text-gray-700 leading-relaxed">
            This page will show your zap analytics once people start supporting your content with Lightning payments.
            You'll see detailed insights about your supporters, earnings trends, and engagement patterns.
          </p>
        </div>
      </div>
    </div>

    <!-- Step-by-Step Guide -->
    <div class="mb-12">
      <h3 class="text-2xl font-bold text-gray-900 mb-6 text-center">How to Get Your First Zaps</h3>

      <div class="grid md:grid-cols-2 gap-6">
        <!-- Step 1 -->
        <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-600">
              1
            </div>
            <h4 class="text-lg font-semibold text-gray-900">Create Valuable Content</h4>
          </div>
          <p class="text-gray-600 mb-4 leading-relaxed">
            Post notes, articles, or long-form content on Nostr that provides value to your audience. Share insights, tutorials, stories, or helpful information.
          </p>
          <div class="flex items-center space-x-2 text-sm text-orange-600">
            <IconFileText class="w-4 h-4" />
            <span>Go to Content page to create articles</span>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-600">
              2
            </div>
            <h4 class="text-lg font-semibold text-gray-900">Share on Nostr</h4>
          </div>
          <p class="text-gray-600 mb-4 leading-relaxed">
            Publish your content to the Nostr network. Use popular Nostr clients like Primal, Damus, Amethyst, or Nostrudel to share your posts.
          </p>
          <div class="flex items-center space-x-2 text-sm text-orange-600">
            <IconShare class="w-4 h-4" />
            <span>Post notes directly from Nostr clients</span>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-600">
              3
            </div>
            <h4 class="text-lg font-semibold text-gray-900">Add Lightning Address</h4>
          </div>
          <p class="text-gray-600 mb-4 leading-relaxed">
            Make sure your Nostr profile includes a Lightning address so people can easily zap you. Get one from services like Alby, Wallet of Satoshi, or Zeus.
          </p>
          <div class="flex items-center space-x-2 text-sm text-orange-600">
            <IconBolt class="w-4 h-4" />
            <span>Set up in your Nostr profile settings</span>
          </div>
        </div>

        <!-- Step 4 -->
        <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-orange-300 hover:shadow-lg transition-all duration-300">
          <div class="flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center font-bold text-orange-600">
              4
            </div>
            <h4 class="text-lg font-semibold text-gray-900">Engage with Community</h4>
          </div>
          <p class="text-gray-600 mb-4 leading-relaxed">
            Interact with others, reply to posts, join conversations, and build relationships. People zap content they find valuable and creators they appreciate.
          </p>
          <div class="flex items-center space-x-2 text-sm text-orange-600">
            <IconUsers class="w-4 h-4" />
            <span>Check Audience page to grow your network</span>
          </div>
        </div>
      </div>
    </div>

    <!-- What You'll See When Data Arrives -->
    <div class="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-8 mb-8">
      <div class="flex items-start space-x-4">
        <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <IconSparkles class="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900 mb-3">Once You Start Receiving Zaps</h3>
          <ul class="space-y-2 text-gray-700">
            <li class="flex items-start space-x-2">
              <IconCheck class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Total zaps received and earnings in sats</span>
            </li>
            <li class="flex items-start space-x-2">
              <IconCheck class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Daily, weekly, and monthly earning trends</span>
            </li>
            <li class="flex items-start space-x-2">
              <IconCheck class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Top supporters and their contribution amounts</span>
            </li>
            <li class="flex items-start space-x-2">
              <IconCheck class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Content performance analytics</span>
            </li>
            <li class="flex items-start space-x-2">
              <IconCheck class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Peak activity times and engagement patterns</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 rounded-2xl p-8 text-white text-center shadow-xl">
      <h3 class="text-2xl font-bold mb-3">Ready to Start Creating?</h3>
      <p class="text-orange-50 mb-6 text-lg">
        Head to the Content page to create your first post and start building your presence on Nostr
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          @click="$emit('go-to-content')"
          class="bg-white text-orange-600 px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <IconEdit class="w-5 h-5" />
          <span>Create Content</span>
        </button>
        <button
          @click="$emit('show-help')"
          class="bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-700 transition-all duration-200 flex items-center justify-center space-x-2 border-2 border-white/30"
        >
          <IconHelp class="w-5 h-5" />
          <span>Learn More</span>
        </button>
      </div>
    </div>

    <!-- Tips Section -->
    <div class="mt-8 grid md:grid-cols-3 gap-4">
      <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div class="flex items-center space-x-2 mb-2">
          <IconBulb class="w-5 h-5 text-amber-500" />
          <h4 class="font-semibold text-gray-900 text-sm">Pro Tip</h4>
        </div>
        <p class="text-xs text-gray-600">Quality over quantity - focus on creating valuable content that helps or entertains your audience.</p>
      </div>

      <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div class="flex items-center space-x-2 mb-2">
          <IconBulb class="w-5 h-5 text-amber-500" />
          <h4 class="font-semibold text-gray-900 text-sm">Be Consistent</h4>
        </div>
        <p class="text-xs text-gray-600">Regular posting helps build an audience. Share updates, insights, or stories consistently.</p>
      </div>

      <div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div class="flex items-center space-x-2 mb-2">
          <IconBulb class="w-5 h-5 text-amber-500" />
          <h4 class="font-semibold text-gray-900 text-sm">Engage Authentically</h4>
        </div>
        <p class="text-xs text-gray-600">Reply to comments, support others, and build genuine connections in the Nostr community.</p>
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
  IconCheck,
  IconFileText,
  IconShare,
  IconEdit,
  IconInfoCircle,
  IconSparkles,
  IconBulb
} from '@iconify-prerendered/vue-tabler'

defineEmits(['connect-nostr', 'show-help', 'go-to-content'])
</script>
