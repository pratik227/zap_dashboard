<script setup>
import { computed } from 'vue'
import { IconHash, IconBolt, IconHeart } from '@iconify-prerendered/vue-tabler'
import { formatSatsShort } from '../../utils/format.js'

const props = defineProps({
  contentItems: {
    type: Array,
    required: true
  },
  getEngagementCounts: {
    type: Function,
    required: true
  }
})

const tagStats = computed(() => {
  const tagMap = {}

  for (const item of props.contentItems) {
    if (item.status !== 'published' || !item.tags?.length) continue

    const engagement = item.nostrEventId
      ? props.getEngagementCounts(item.nostrEventId)
      : { totalEngagement: 0 }

    for (const tag of item.tags) {
      if (!tagMap[tag]) {
        tagMap[tag] = { tag, articleCount: 0, totalSats: 0, totalEngagement: 0 }
      }
      tagMap[tag].articleCount++
      tagMap[tag].totalSats += item.zapAmount || 0
      tagMap[tag].totalEngagement += engagement.totalEngagement || 0
    }
  }

  return Object.values(tagMap)
    .sort((a, b) => b.totalSats - a.totalSats)
    .slice(0, 8)
})
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm p-4 lg:p-6 rounded-xl border border-orange-100/50 shadow-sm">
    <h3 class="text-sm font-bold text-orange-900 mb-4 flex items-center space-x-2">
      <IconHash class="w-4 h-4 text-orange-600" />
      <span>Tag Performance</span>
    </h3>

    <div v-if="tagStats.length === 0" class="text-center py-8">
      <IconHash class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500">No tagged content yet</p>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="stat in tagStats"
        :key="stat.tag"
        class="flex items-center space-x-3 p-2 rounded-lg hover:bg-orange-50/50 transition-colors"
      >
        <span class="inline-flex items-center px-2.5 py-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 rounded-full text-xs font-medium flex-shrink-0">
          #{{ stat.tag }}
        </span>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-gray-500">{{ stat.articleCount }} article{{ stat.articleCount !== 1 ? 's' : '' }}</p>
        </div>
        <div class="flex items-center space-x-3 flex-shrink-0">
          <div class="flex items-center space-x-1 text-xs text-orange-600">
            <IconBolt class="w-3 h-3" />
            <span class="font-medium">{{ formatSatsShort(stat.totalSats) }}</span>
          </div>
          <div class="flex items-center space-x-1 text-xs text-pink-600">
            <IconHeart class="w-3 h-3" />
            <span class="font-medium">{{ stat.totalEngagement }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
