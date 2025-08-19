<script setup>
import { ref, computed, watch } from 'vue'
import {
  IconCheck,
  IconX,
  IconUsers,
  IconUserPlus,
  IconAlertCircle,
  IconInfoCircle
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  result: {
    type: Object,
    default: null
  },
  operation: {
    type: String,
    default: 'follow' // 'follow', 'bulk-follow', 'follow-pack'
  }
})

const emit = defineEmits(['close'])

// Auto-close timer
const autoCloseTimer = ref(null)

// Computed properties for display
const notificationIcon = computed(() => {
  if (!props.result) return IconInfoCircle
  
  if (props.result.success) {
    return props.result.newFollows > 0 ? IconCheck : IconInfoCircle
  }
  
  return IconAlertCircle
})

const notificationColor = computed(() => {
  if (!props.result) return 'blue'
  
  if (props.result.success) {
    return props.result.newFollows > 0 ? 'green' : 'blue'
  }
  
  return 'red'
})

const notificationTitle = computed(() => {
  if (!props.result) return 'Operation Complete'
  
  if (!props.result.success) {
    return 'Follow Failed'
  }
  
  if (props.result.alreadyFollowingAll) {
    return 'Already Following'
  }
  
  if (props.result.newFollows === 0) {
    return 'No Changes'
  }
  
  switch (props.operation) {
    case 'bulk-follow':
      return 'Bulk Follow Complete'
    case 'follow-pack':
      return 'Pack Followed'
    default:
      return 'Follow Complete'
  }
})

const notificationMessage = computed(() => {
  if (!props.result) return ''
  
  return props.result.message || 'Operation completed'
})

// Watch for show changes to set up auto-close
watch(() => props.show, (show) => {
  if (show) {
    // Clear any existing timer
    if (autoCloseTimer.value) {
      clearTimeout(autoCloseTimer.value)
    }
    
    // Set up auto-close after 5 seconds
    autoCloseTimer.value = setTimeout(() => {
      emit('close')
    }, 5000)
  } else {
    // Clear timer when manually closed
    if (autoCloseTimer.value) {
      clearTimeout(autoCloseTimer.value)
      autoCloseTimer.value = null
    }
  }
})

// Manual close
const closeNotification = () => {
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
  emit('close')
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="notification-slide">
      <div v-if="show" class="fixed top-4 right-4 z-[9999] max-w-sm w-full">
        <div :class="[
          'bg-white rounded-xl shadow-xl border-l-4 p-4 transform transition-all duration-300',
          notificationColor === 'green' ? 'border-green-500' :
          notificationColor === 'blue' ? 'border-blue-500' :
          notificationColor === 'red' ? 'border-red-500' : 'border-gray-500'
        ]">
          <div class="flex items-start space-x-3">
            <!-- Icon -->
            <div :class="[
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              notificationColor === 'green' ? 'bg-green-100' :
              notificationColor === 'blue' ? 'bg-blue-100' :
              notificationColor === 'red' ? 'bg-red-100' : 'bg-gray-100'
            ]">
              <component 
                :is="notificationIcon" 
                :class="[
                  'w-4 h-4',
                  notificationColor === 'green' ? 'text-green-600' :
                  notificationColor === 'blue' ? 'text-blue-600' :
                  notificationColor === 'red' ? 'text-red-600' : 'text-gray-600'
                ]" 
              />
            </div>
            
            <!-- Content -->
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-gray-900 text-sm">{{ notificationTitle }}</h4>
              <p class="text-gray-600 text-sm mt-1 leading-relaxed">{{ notificationMessage }}</p>
              
              <!-- Statistics -->
              <div v-if="result && result.success && result.newFollows > 0" class="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                <span class="flex items-center space-x-1">
                  <IconUserPlus class="w-3 h-3" />
                  <span>+{{ result.newFollows }} new</span>
                </span>
                <span class="flex items-center space-x-1">
                  <IconUsers class="w-3 h-3" />
                  <span>{{ result.totalFollows }} total</span>
                </span>
              </div>
            </div>
            
            <!-- Close Button -->
            <button
              @click="closeNotification"
              class="w-6 h-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            >
              <IconX class="w-3 h-3" />
            </button>
          </div>
          
          <!-- Progress Bar (Auto-close indicator) -->
          <div class="mt-3 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
            <div class="bg-orange-400 h-1 rounded-full animate-countdown"></div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Slide in animation from right */
.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-slide-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Auto-close countdown animation */
.animate-countdown {
  animation: countdown 5s linear forwards;
}

@keyframes countdown {
  from { width: 100%; }
  to { width: 0%; }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .max-w-sm {
    max-width: calc(100vw - 2rem);
  }
}
</style>