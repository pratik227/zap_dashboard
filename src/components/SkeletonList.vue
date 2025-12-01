<template>
  <div class="space-y-4">
    <div v-for="i in items" :key="i" class="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div class="flex items-start space-x-4">
        <div class="h-12 w-12 bg-gray-200 rounded-full flex-shrink-0"></div>
        <div class="flex-1 space-y-3">
          <div class="flex items-center justify-between">
            <div class="h-4 bg-gray-200 rounded w-32"></div>
            <div class="h-3 bg-gray-200 rounded w-20"></div>
          </div>
          <div class="h-3 bg-gray-200 rounded w-full"></div>
          <div class="h-3 bg-gray-200 rounded w-4/5"></div>
          <div class="flex items-center space-x-4 mt-2">
            <div class="h-6 bg-gray-200 rounded w-16"></div>
            <div class="h-6 bg-gray-200 rounded w-20"></div>
            <div class="h-6 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Number,
    default: 3
  }
})
</script>

<style scoped>
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
