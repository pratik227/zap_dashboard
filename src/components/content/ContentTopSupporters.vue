<script setup>
import { computed } from 'vue'
import { IconBolt, IconUsers } from '@iconify-prerendered/vue-tabler'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { formatSatsShort } from '../../utils/format.js'

const props = defineProps({
  contentItems: {
    type: Array,
    required: true
  }
})

const topSupporters = computed(() => {
  const supporterMap = {}

  for (const item of props.contentItems) {
    if (!item.zaps) continue
    for (const zap of item.zaps) {
      const key = zap.zapperPubkey
      if (!key) continue
      if (!supporterMap[key]) {
        supporterMap[key] = {
          pubkey: key,
          name: zap.sender?.name || `${key.substring(0, 8)}...`,
          avatar: zap.sender?.avatar || zap.sender?.picture || generateAvatar(key),
          totalSats: 0,
          zapCount: 0
        }
      }
      supporterMap[key].totalSats += zap.amount || 0
      supporterMap[key].zapCount++
    }
  }

  return Object.values(supporterMap)
    .sort((a, b) => b.totalSats - a.totalSats)
    .slice(0, 10)
})
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-orange-100/50 shadow-sm">
    <h3 class="text-sm font-bold text-orange-900 mb-4 flex items-center space-x-2">
      <IconUsers class="w-4 h-4 text-orange-600" />
      <span>Top Supporters</span>
    </h3>

    <div v-if="topSupporters.length === 0" class="text-center py-8">
      <IconBolt class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500">No zaps received yet</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(supporter, index) in topSupporters"
        :key="supporter.pubkey"
        class="flex items-center space-x-3 p-2 rounded-lg hover:bg-orange-50/50 transition-colors"
      >
        <span class="text-xs font-bold text-gray-400 w-5 text-right">{{ index + 1 }}</span>
        <img
          :src="supporter.avatar"
          :alt="supporter.name"
          class="w-8 h-8 rounded-full object-cover flex-shrink-0"
          @error="$event.target.src = generateAvatar(supporter.pubkey)"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">{{ supporter.name }}</p>
          <p class="text-xs text-gray-500">{{ supporter.zapCount }} zap{{ supporter.zapCount !== 1 ? 's' : '' }}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-sm font-bold text-orange-600">{{ formatSatsShort(supporter.totalSats) }}</p>
          <p class="text-xs text-gray-500">sats</p>
        </div>
      </div>
    </div>
  </div>
</template>
