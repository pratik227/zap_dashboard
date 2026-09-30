<script setup>
import { computed } from 'vue'
import { useBadges } from '../../composables/social/useBadges.js'
import BadgeDisplay from './BadgeDisplay.vue'

const props = defineProps({
  pubkey: { type: String, required: true },
  loading: { type: Boolean, default: false },
  maxDisplay: { type: Number, default: 0 },
  showCount: { type: Boolean, default: true },
  showViewAll: { type: Boolean, default: true },
  layout: {
    type: String,
    default: 'horizontal',
    validator: (v) => ['horizontal', 'vertical', 'grid'].includes(v)
  }
})

const emit = defineEmits(['badge-click', 'view-all'])

const { getUserBadges, getProfileBadgeCount } = useBadges()

const badges = computed(() => getUserBadges(props.pubkey))

const displayBadges = computed(() => {
  if (props.maxDisplay <= 0) return badges.value
  return badges.value.slice(0, props.maxDisplay)
})

const remainingCount = computed(() => {
  if (props.maxDisplay <= 0) return 0
  return Math.max(0, badges.value.length - props.maxDisplay)
})

// Dynamic sizing based on raw profile badge count (stable before definitions load)
const dynamicSizePx = computed(() => {
  const count = getProfileBadgeCount(props.pubkey)
  if (count <= 6) return 48
  if (count <= 12) return 36
  return 24
})

// Gap scales with badge size
const gapClass = computed(() => {
  if (dynamicSizePx.value >= 48) return 'gap-3'
  if (dynamicSizePx.value >= 36) return 'gap-2'
  return 'gap-1.5'
})

const skeletonCount = computed(() => Math.min(getProfileBadgeCount(props.pubkey) || 4, 8))

const layoutClass = computed(() => ({
  horizontal: 'flex flex-wrap items-center',
  vertical: 'flex flex-col items-start',
  grid: 'flex flex-wrap'
}[props.layout] || 'flex flex-wrap items-center'))
</script>

<template>
  <!-- Skeleton loading -->
  <div v-if="loading && badges.length === 0" :class="[layoutClass, gapClass]">
    <div
      v-for="i in skeletonCount"
      :key="'skel-' + i"
      class="bg-gray-200 rounded-lg animate-pulse"
      :style="{ width: dynamicSizePx + 'px', height: dynamicSizePx + 'px' }"
    ></div>
  </div>

  <!-- Badges loaded -->
  <div v-else-if="badges.length > 0" :class="[layoutClass, gapClass]">
    <BadgeDisplay
      v-for="badge in displayBadges"
      :key="`${badge.badgeDefinition}-${badge.badgeAward}`"
      :badge="badge"
      :size-pixels="dynamicSizePx"
      :clickable="true"
      @click="(b) => emit('badge-click', b)"
    />

    <!-- +N more indicator -->
    <div
      v-if="remainingCount > 0 && showViewAll"
      class="inline-flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-300 cursor-pointer transition-colors text-gray-500 hover:text-orange-600 font-medium"
      :style="{ width: dynamicSizePx + 'px', height: dynamicSizePx + 'px', fontSize: (dynamicSizePx >= 36 ? 13 : 11) + 'px' }"
      @click.stop="emit('view-all', { pubkey, badges: badges, totalCount: badges.length })"
      :title="`+${remainingCount} more badges`"
    >
      +{{ remainingCount }}
    </div>

    <!-- Count label -->
    <span
      v-if="showCount"
      class="text-xs text-gray-500 ml-1"
    >{{ badges.length }} {{ badges.length === 1 ? 'badge' : 'badges' }}</span>
  </div>

  <!-- Empty state (slot) -->
  <div v-else-if="!loading && $slots.empty">
    <slot name="empty"></slot>
  </div>
</template>
