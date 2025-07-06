<template>
  <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
    <div class="flex items-start space-x-3">
      <IconAlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        <h3 class="text-sm font-medium text-red-800 mb-1">Something went wrong</h3>
        <p class="text-sm text-red-700 mb-3">{{ error.message || 'An unexpected error occurred' }}</p>
        <div class="flex space-x-2">
          <button 
            @click="retry"
            class="btn-secondary text-sm text-blue-600 hover:text-blue-700"
          >
            Try Again
          </button>
          <button 
            @click="goToDashboard"
            class="btn-secondary text-sm text-gray-600 hover:text-gray-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<script setup>
import { ref, onErrorCaptured, inject } from 'vue'
import { IconAlertTriangle } from '@iconify-prerendered/vue-tabler'

const error = ref(null)
const changePage = inject('changePage')

onErrorCaptured((err, instance, info) => {
  console.error('Error captured by boundary:', err, info)
  error.value = err
  return false // Prevent error from propagating
})

const retry = () => {
  error.value = null
}

const goToDashboard = () => {
  error.value = null
  changePage('dashboard')
}
</script> 