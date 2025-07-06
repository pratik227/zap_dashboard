<script setup>
import { computed, inject } from 'vue'
import { useBtcPrice } from '../composables/useBtcPrice.js'

const zapData = inject('zapData')
const searchQuery = inject('searchQuery')
const selectedFilters = inject('selectedFilters')
const selectedTimeRange = inject('selectedTimeRange')

// Use BTC price composable
const { satsToUSD, formatUSD } = useBtcPrice()

const filteredZaps = computed(() => {
  let zaps = [...zapData.value]
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    zaps = zaps.filter(zap => 
      zap.note.toLowerCase().includes(query) ||
      zap.sender.name.toLowerCase().includes(query) ||
      zap.sender.nip05?.toLowerCase().includes(query)
    )
  }
  
  // Apply amount filters
  if (selectedFilters.value.minAmount > 0) {
    zaps = zaps.filter(zap => zap.amount >= selectedFilters.value.minAmount)
  }
  if (selectedFilters.value.maxAmount) {
    zaps = zaps.filter(zap => zap.amount <= selectedFilters.value.maxAmount)
  }
  
  // Apply note type filter
  if (selectedFilters.value.noteType !== 'all') {
    zaps = zaps.filter(zap => zap.noteType === selectedFilters.value.noteType)
  }
  
  // Apply time range filter
  const now = new Date()
  switch (selectedTimeRange.value) {
    case '24h':
      zaps = zaps.filter(zap => 
        new Date(zap.timestamp) > new Date(now - 24 * 60 * 60 * 1000)
      )
      break
    case '7d':
      zaps = zaps.filter(zap => 
        new Date(zap.timestamp) > new Date(now - 7 * 24 * 60 * 60 * 1000)
      )
      break
    case '30d':
      zaps = zaps.filter(zap => 
        new Date(zap.timestamp) > new Date(now - 30 * 24 * 60 * 60 * 1000)
      )
      break
  }
  
  return zaps.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
})

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const getClientEmoji = (client) => {
  const clientEmojis = {
    'damus': '🦉',
    'amethyst': '💎',
    'iris': '👁️',
    'snort': '🐽',
    'nostrudel': '🥨',
    'unknown': '📱'
  }
  return clientEmojis[client] || clientEmojis.unknown
}

const getNoteTypeEmoji = (type) => {
  const typeEmojis = {
    'original': '📝',
    'reply': '💬',
    'repost': '🔄'
  }
  return typeEmojis[type] || '📝'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Results Summary -->
    <div class="flex justify-between items-center">
      <p class="text-sm text-gray-600">
        Showing {{ filteredZaps.length }} zaps
      </p>
      <div class="flex space-x-2">
        <button class="btn-secondary text-sm">
          <span>⚡</span>
          Live Updates
        </button>
      </div>
    </div>
    
    <!-- Zap Feed -->
    <div class="space-y-3">
      <div
        v-for="zap in filteredZaps"
        :key="zap.id"
        class="zap-item"
      >
        <div class="flex items-start space-x-4">
          <!-- Sender Avatar -->
          <img
            :src="zap.sender.avatar"
            :alt="zap.sender.name"
            class="w-10 h-10 rounded-full border-2 border-orange-200"
          />
          
          <!-- Zap Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-2">
                <span class="font-medium text-gray-900">{{ zap.sender.name }}</span>
                <span v-if="zap.sender.nip05" class="text-sm text-gray-500">
                  {{ zap.sender.nip05 }}
                </span>
                <span class="text-xs text-gray-400">•</span>
                <span class="text-xs text-gray-400">{{ formatDate(zap.timestamp) }}</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-sm">{{ getClientEmoji(zap.client) }}</span>
                <span class="text-sm">{{ getNoteTypeEmoji(zap.noteType) }}</span>
              </div>
            </div>
            
            <!-- Zap Amount -->
            <div class="flex items-center space-x-2 mb-3">
              <div class="flex items-center space-x-1 bg-orange-100 px-3 py-1 rounded-full">
                <span class="text-orange-600">⚡</span>
                <span class="font-bold text-orange-600">{{ zap.amount.toLocaleString() }}</span>
                <span class="text-sm text-orange-600">sats</span>
              </div>
              <span class="text-sm text-gray-500">
                ≈ ${{ (zap.amount * 0.0003).toFixed(2) }}
              </span>
            </div>
            
            <!-- Note Preview -->
            <div class="bg-gray-50 rounded-lg p-3">
              <p class="text-sm text-gray-700 line-clamp-3">
                {{ zap.note }}
              </p>
              <div class="mt-2 flex items-center justify-between">
                <div class="flex items-center space-x-4 text-xs text-gray-500">
                  <span>{{ zap.engagement.replies }} replies</span>
                  <span>{{ zap.engagement.reposts }} reposts</span>
                  <span>{{ zap.engagement.likes }} likes</span>
                </div>
                <button class="text-xs text-orange-600 hover:text-orange-700 font-medium">
                  View Note →
            <span class="text-sm text-gray-500">
              ≈ {{ formatUSD(satsToUSD(zap.amount)) }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="filteredZaps.length === 0" class="text-center py-12">
        <div class="text-6xl mb-4">⚡</div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No zaps found</h3>
        <p class="text-gray-600">Try adjusting your filters or search terms.</p>
      </div>
    </div>
  </div>
</template>