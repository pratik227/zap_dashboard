<script setup>
import { computed, ref } from 'vue'
import { IconAward } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  badge: {
    type: Object,
    required: true
  },
  size: {
    type: String,
    default: 'medium', // 'small', 'medium', 'large'
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  showTooltip: {
    type: Boolean,
    default: true
  },
  clickable: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click'])

// Local state
const imageError = ref(false)
const showTooltip = ref(false)

// Computed properties
const badgeDefinition = computed(() => props.badge.definition)

const displayName = computed(() => {
  return badgeDefinition.value?.name || 
         badgeDefinition.value?.d || 
         'Unknown Badge'
})

const displayDescription = computed(() => {
  return badgeDefinition.value?.description || 'No description available'
})

const badgeImage = computed(() => {
  if (imageError.value) return null
  
  const definition = badgeDefinition.value
  if (!definition) return null

  // Get appropriate thumbnail based on size
  const sizeMap = {
    small: 'small',
    medium: 'medium', 
    large: 'large'
  }
  
  const preferredSize = sizeMap[props.size]
  
  // Try to find appropriate thumbnail
  if (definition.thumbnails && definition.thumbnails.length > 0) {
    const sizePreferences = {
      small: ['32x32', '16x16', '64x64'],
      medium: ['64x64', '32x32', '256x256'],
      large: ['256x256', '512x512', '1024x1024']
    }
    
    const preferences = sizePreferences[preferredSize] || sizePreferences.medium
    
    for (const prefSize of preferences) {
      const thumbnail = definition.thumbnails.find(t => t.size === prefSize)
      if (thumbnail) {
        return thumbnail.url
      }
    }
    
    // Fallback to first thumbnail
    return definition.thumbnails[0].url
  }
  
  // Fallback to main image
  return definition.image
})

const sizeClasses = computed(() => {
  const sizeMap = {
    small: 'w-6 h-6',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  }
  return sizeMap[props.size] || sizeMap.medium
})

const containerClasses = computed(() => {
  const baseClasses = 'relative inline-block rounded-full overflow-hidden border-2 transition-all duration-200'
  const sizeSpecificClasses = {
    small: 'border-orange-200 hover:border-orange-300',
    medium: 'border-orange-200 hover:border-orange-300 hover:shadow-md',
    large: 'border-orange-300 hover:border-orange-400 hover:shadow-lg'
  }
  
  const clickableClasses = props.clickable ? 'cursor-pointer hover:scale-105' : ''
  
  return `${baseClasses} ${sizeSpecificClasses[props.size]} ${clickableClasses}`
})

// Handle image error
const handleImageError = () => {
  imageError.value = true
}

// Handle badge click
const handleClick = (event) => {
  if (props.clickable) {
    // Stop event propagation to prevent parent click handlers
    event.stopPropagation()
    event.preventDefault()
    emit('click', props.badge)
  }
}

// Handle tooltip
const handleMouseEnter = () => {
  if (props.showTooltip) {
    showTooltip.value = true
  }
}

const handleMouseLeave = () => {
  showTooltip.value = false
}
</script>

<template>
  <div 
    :class="containerClasses"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :title="showTooltip ? `${displayName}: ${displayDescription}` : ''"
  >
    <!-- Badge Image -->
    <div v-if="badgeImage && !imageError" :class="sizeClasses">
      <img
        :src="badgeImage"
        :alt="displayName"
        :class="sizeClasses"
        class="object-cover"
        @error="handleImageError"
      />
    </div>
    
    <!-- Fallback Icon -->
    <div 
      v-else 
      :class="sizeClasses"
      class="bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center"
    >
      <IconAward 
        :class="props.size === 'small' ? 'w-3 h-3' : props.size === 'medium' ? 'w-4 h-4' : 'w-6 h-6'"
        class="text-white"
      />
    </div>
    
    <!-- Loading State -->
    <div 
      v-if="!badgeDefinition"
      :class="sizeClasses"
      class="bg-gray-200 animate-pulse flex items-center justify-center"
    >
      <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
    </div>
    
    <!-- Tooltip (for larger sizes) -->
    <div 
      v-if="showTooltip && props.size !== 'small' && badgeDefinition"
      class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 whitespace-nowrap max-w-xs"
    >
      <div class="font-semibold">{{ displayName }}</div>
      <div v-if="displayDescription" class="text-gray-300 mt-1">{{ displayDescription }}</div>
      <!-- Tooltip arrow -->
      <div class="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure tooltip appears above other elements */
.relative {
  z-index: 1;
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Hover effects */
.hover\:scale-105:hover {
  transform: scale(1.05);
}
</style>
