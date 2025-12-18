<template>
  <div class="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
    <div class="flex items-center justify-between mb-4">
      <div class="h-4 bg-gray-200 rounded w-1/4"></div>
      <div class="h-4 bg-gray-200 rounded w-16"></div>
    </div>
    <div class="space-y-3">
      <div class="h-8 bg-gray-200 rounded w-3/4"></div>
      <div class="h-3 bg-gray-200 rounded w-full"></div>
      <div class="h-3 bg-gray-200 rounded w-5/6"></div>
    </div>
    <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
      <div class="h-3 bg-gray-200 rounded w-20"></div>
      <div class="h-8 bg-gray-200 rounded w-24"></div>
    </div>
  </div>
</template>

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
