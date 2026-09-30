<script setup>
import { computed, ref } from 'vue'
import { IconAward } from '@iconify-prerendered/vue-tabler'
import { useBadges } from '../../composables/social/useBadges.js'

const props = defineProps({
  badge: { type: Object, required: true },
  size: { type: String, default: 'medium' },
  sizePixels: { type: Number, default: 0 },
  clickable: { type: Boolean, default: true }
})

const emit = defineEmits(['click'])

const { getBadgeThumbnail } = useBadges()

const imageError = ref(false)

const badgeDefinition = computed(() => props.badge.definition)

const displayName = computed(() =>
  badgeDefinition.value?.name || badgeDefinition.value?.d || 'Unknown Badge'
)

const computedSizePx = computed(() => {
  if (props.sizePixels > 0) return props.sizePixels
  return { small: 24, medium: 32, large: 48 }[props.size] || 32
})

const badgeImage = computed(() => {
  if (imageError.value) return null
  if (!badgeDefinition.value) return null

  // Use composable's thumbnail resolver for consistent sizing
  const preferredSize = computedSizePx.value >= 48 ? 'large'
    : computedSizePx.value >= 32 ? 'medium' : 'small'
  return getBadgeThumbnail(props.badge, preferredSize)
})

const iconSizePx = computed(() => Math.max(12, Math.round(computedSizePx.value * 0.5)))

function handleClick(event) {
  if (!props.clickable) return
  event.stopPropagation()
  event.preventDefault()
  emit('click', props.badge)
}
</script>

<template>
  <div
    class="badge-display relative inline-flex items-center justify-center transition-transform duration-150"
    :class="clickable ? 'cursor-pointer hover:scale-110' : ''"
    :style="{ width: computedSizePx + 'px', height: computedSizePx + 'px' }"
    :title="displayName"
    @click="handleClick"
  >
    <!-- Badge image — raw, no forced rounding -->
    <img
      v-if="badgeImage && !imageError"
      :src="badgeImage"
      :alt="displayName"
      class="w-full h-full object-contain"
      @error="imageError = true"
    />

    <!-- Fallback icon when image fails or no definition -->
    <div
      v-else-if="badgeDefinition"
      class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center"
    >
      <IconAward
        class="text-white"
        :style="{ width: iconSizePx + 'px', height: iconSizePx + 'px' }"
      />
    </div>

    <!-- Skeleton when definition hasn't loaded yet -->
    <div
      v-else
      class="w-full h-full bg-gray-200 rounded-lg animate-pulse"
    ></div>
  </div>
</template>
