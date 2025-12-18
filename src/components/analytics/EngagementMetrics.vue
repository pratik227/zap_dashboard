<script setup>
import { computed } from 'vue'
import {
  IconHeartFilled,
  IconHeart,
  IconRepeat,
  IconBolt,
  IconBookmarkFilled,
  IconBookmark
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  engagementCounts: {
    type: Object,
    required: true,
    default: () => ({
      likes: 0,
      reposts: 0,
      bookmarks: 0,
      totalEngagement: 0
    })
  },
  zapCount: {
    type: Number,
    default: 0
  },
  size: {
    type: String,
    default: 'default', 
    validator: (value) => ['default', 'small', 'medium', 'large'].includes(value)
  },
  showAllMetrics: {
    type: Boolean,
    default: false
  },
  textSize: {
    type: String,
    default: 'text-xs'
  },
  showNoEngagementText: {
    type: Boolean,
    default: true
  },
  showTooltips: {
    type: Boolean,
    default: true
  }
})

const iconSizeClass = computed(() => ({
  small: 'w-3 h-3',
  medium: 'w-3.3 h-3.2',
  default: 'w-4 h-4', 
  large: 'w-5 h-5'
}[props.size]))

const hasEngagement = computed(() => 
  (props.engagementCounts?.totalEngagement || 0) > 0 || props.zapCount > 0
)

const hasAnyEngagement = computed(() => 
  (props.engagementCounts?.likes || 0) > 0 || 
  (props.engagementCounts?.reposts || 0) > 0 || 
  (props.engagementCounts?.bookmarks || 0) > 0 || 
  props.zapCount > 0
)

const safeEngagementCounts = computed(() => ({
  likes: props.engagementCounts?.likes || 0,
  reposts: props.engagementCounts?.reposts || 0,
  bookmarks: props.engagementCounts?.bookmarks || 0,
  totalEngagement: props.engagementCounts?.totalEngagement || 0
}))

// Format numbers to be user-friendly (1.2k, 1.5M, etc.)
const formatNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}
</script>

<template>
  <template v-if="hasAnyEngagement || showAllMetrics">
    <span :class="['flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-gray-50 transition-colors', showTooltips ? 'tooltip-container' : '']">
      <IconHeartFilled v-if="safeEngagementCounts.likes > 0" :class="[iconSizeClass, 'text-red-500']" />
      <IconHeart v-else :class="[iconSizeClass, 'text-gray-400']" />
      <span :class="[textSize, 'font-medium']">{{ formatNumber(safeEngagementCounts.likes) }}</span>
      <div v-if="showTooltips" class="custom-tooltip">{{ safeEngagementCounts.likes }} {{ safeEngagementCounts.likes <= 1 ? 'like' : 'likes' }}</div>
    </span>
    
    <span :class="['flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-gray-50 transition-colors', showTooltips ? 'tooltip-container' : '']">
      <IconRepeat :class="[iconSizeClass, safeEngagementCounts.reposts > 0 ? 'text-green-500' : 'text-gray-400']" />
      <span :class="[textSize, 'font-medium']">{{ formatNumber(safeEngagementCounts.reposts) }}</span>
      <div v-if="showTooltips" class="custom-tooltip">{{ safeEngagementCounts.reposts }} {{ safeEngagementCounts.reposts <= 1 ? 'repost' : 'reposts' }}</div>
    </span>
    
    <span :class="['flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-orange-50 transition-colors', showTooltips ? 'tooltip-container' : '']">
      <IconBolt :class="[iconSizeClass, zapCount > 0 ? 'text-orange-500' : 'text-gray-400']" />
      <span :class="[textSize, 'font-medium', zapCount > 0 ? 'text-orange-600' : 'text-gray-500']">{{ formatNumber(zapCount) }}</span>
      <div v-if="showTooltips" class="custom-tooltip">{{ zapCount }} {{ zapCount <= 1 ? 'zap' : 'zaps' }}</div>
    </span>
    
    <span :class="['flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-gray-50 transition-colors', showTooltips ? 'tooltip-container' : '']">
      <IconBookmarkFilled v-if="safeEngagementCounts.bookmarks > 0" :class="[iconSizeClass, 'text-blue-500']" />
      <IconBookmark v-else :class="[iconSizeClass, 'text-gray-400']" />
      <span :class="[textSize, 'font-medium']">{{ formatNumber(safeEngagementCounts.bookmarks) }}</span>
      <div v-if="showTooltips" class="custom-tooltip">{{ safeEngagementCounts.bookmarks }} {{ safeEngagementCounts.bookmarks <= 1 ? 'bookmark' : 'bookmarks' }}</div>
    </span>
  </template>
  
  <span v-else-if="showNoEngagementText" class="text-gray-400" :class="textSize">
    No Engagement Yet
  </span>
</template>

<style scoped>
.tooltip-container {
  position: relative;
  cursor: pointer;
}

.custom-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  z-index: 50;
  pointer-events: none;
  
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(-4px);
  transition: all 0.2s ease-in-out;
}

.custom-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.9);
}

.tooltip-container:hover .custom-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(-8px);
}

@media (max-width: 640px) {
  .custom-tooltip {
    font-size: 11px;
    padding: 4px 8px;
  }
}
</style>
