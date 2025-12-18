<script setup>
import { computed, ref, onMounted } from 'vue'
import { useBadges } from '../../composables/social/useBadges.js'
import BadgeDisplay from './BadgeDisplay.vue'
import { IconAward, IconChevronRight, IconLoader } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  pubkey: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  maxDisplay: {
    type: Number,
    default: 5
  },
  showCount: {
    type: Boolean,
    default: true
  },
  showViewAll: {
    type: Boolean,
    default: true
  },
  layout: {
    type: String,
    default: 'horizontal', // 'horizontal', 'vertical', 'grid'
    validator: (value) => ['horizontal', 'vertical', 'grid'].includes(value)
  }
})

const emit = defineEmits(['badge-click', 'view-all'])

// Composables
const { 
  getUserBadges, 
  getUserBadgeCount, 
  initUserBadges, 
  isLoading 
} = useBadges()

// Local state
const loadingBadges = ref(false)

// Computed properties - reactively get badges from the composable
const badges = computed(() => {
  return getUserBadges(props.pubkey)
})

const displayBadges = computed(() => {
  return badges.value.slice(0, props.maxDisplay)
})

const remainingCount = computed(() => {
  const total = badges.value.length
  return total > props.maxDisplay ? total - props.maxDisplay : 0
})

const hasMoreBadges = computed(() => remainingCount.value > 0)

const containerClasses = computed(() => {
  const baseClasses = 'flex items-center'
  
  const layoutClasses = {
    horizontal: 'flex-row space-x-2',
    vertical: 'flex-col space-y-2',
    grid: 'flex-wrap gap-2'
  }
  
  return `${baseClasses} ${layoutClasses[props.layout] || layoutClasses.horizontal}`
})

const badgeContainerClasses = computed(() => {
  const layoutClasses = {
    horizontal: 'flex items-center space-x-1',
    vertical: 'flex flex-col space-y-1',
    grid: 'flex flex-wrap gap-1'
  }
  
  return layoutClasses[props.layout] || layoutClasses.horizontal
})

// Methods
const loadUserBadges = async () => {
  if (!props.pubkey) return
  
  // Check if badges are already cached - if so, no need to fetch
  const cachedBadges = getUserBadges(props.pubkey)
  if (cachedBadges.length > 0) {
    return // Don't fetch again if we have cached badges
  }
  
  try {
    loadingBadges.value = true
    await initUserBadges(props.pubkey)
    // No need to assign - badges computed property will reactively update
  } catch (error) {
    console.error('Error loading user badges:', error)
  } finally {
    loadingBadges.value = false
  }
}

const handleBadgeClick = (badge) => {
  emit('badge-click', badge)
}

const handleViewAll = (event) => {
  // Stop event propagation to prevent parent click handlers
  if (event) {
    event.stopPropagation()
    event.preventDefault()
  }
  emit('view-all', {
    pubkey: props.pubkey,
    badges: badges.value,
    totalCount: badges.value.length
  })
}

// Watch for pubkey changes and load badges immediately
// Using immediate: true to load badges as soon as component is created
import { watch } from 'vue'
watch(() => props.pubkey, (newPubkey, oldPubkey) => {
  if (newPubkey) {
    // Only load if pubkey changed or this is the first load
    if (newPubkey !== oldPubkey || oldPubkey === undefined) {
      loadUserBadges()
    }
  }
  // No need to clear badges - computed property handles it automatically
}, { immediate: true }) // Load immediately on component creation
</script>

<template>
  <div v-if="badges.length > 0 || loadingBadges" :class="containerClasses">
    <!-- Loading State -->
    <div v-if="loadingBadges" class="flex items-center space-x-2">
      <IconLoader class="w-4 h-4 animate-spin text-gray-400" />
      <span class="text-sm text-gray-500">Loading badges...</span>
    </div>
    
    <!-- Badges Display -->
    <div v-else-if="badges.length > 0" class="flex items-center space-x-3">
      <!-- Badge Icons -->
      <div :class="badgeContainerClasses">
        <BadgeDisplay
          v-for="badge in displayBadges"
          :key="`${badge.badgeDefinition}-${badge.badgeAward}`"
          :badge="badge"
          :size="size"
          :clickable="true"
          @click="handleBadgeClick"
        />
        
        <!-- More Badges Indicator -->
        <div 
          v-if="hasMoreBadges && showViewAll"
          class="relative inline-flex items-center justify-center rounded-full border-2 border-dashed border-gray-300 hover:border-orange-300 cursor-pointer transition-colors"
          :class="size === 'small' ? 'w-6 h-6' : size === 'medium' ? 'w-8 h-8' : 'w-12 h-12'"
          @click="handleViewAll"
          :title="`+${remainingCount} more badges`"
        >
          <span 
            class="text-gray-500 hover:text-orange-600 font-medium"
            :class="size === 'small' ? 'text-xs' : size === 'medium' ? 'text-sm' : 'text-base'"
          >
            +{{ remainingCount }}
          </span>
        </div>
      </div>
      
      <!-- Badge Count (optional) -->
      <div v-if="showCount" class="flex items-center space-x-1 text-sm text-gray-600">
        <IconAward class="w-4 h-4" />
        <span>{{ badges.length }}</span>
        <span class="hidden sm:inline">{{ badges.length === 1 ? 'badge' : 'badges' }}</span>
      </div>
      
      <!-- View All Link (for horizontal layout) -->
      <button
        v-if="showViewAll && hasMoreBadges && layout === 'horizontal'"
        @click="handleViewAll"
        class="flex items-center space-x-1 text-sm text-orange-600 hover:text-orange-700 transition-colors"
      >
        <span>View all</span>
        <IconChevronRight class="w-3 h-3" />
      </button>
    </div>
  </div>
  
  <!-- Empty State (only show if not loading and explicitly requested) -->
  <div 
    v-else-if="!loadingBadges && badges.length === 0 && $slots.empty"
    class="flex items-center space-x-2 text-gray-500"
  >
    <slot name="empty">
      <IconAward class="w-4 h-4 text-gray-400" />
      <span class="text-sm">No badges</span>
    </slot>
  </div>
</template>

<style scoped>
/* Animation for loading spinner */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Smooth transitions */
.transition-colors {
  transition-property: color, border-color, background-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
</style>
