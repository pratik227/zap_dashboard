<template>
  <div class="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
    <div class="mb-4">
      <div class="h-4 bg-gray-200 rounded w-32 mb-2"></div>
      <div class="h-3 bg-gray-200 rounded w-48"></div>
    </div>
    <div class="h-64 bg-gray-100 rounded-lg flex items-end justify-around px-4 pb-4 space-x-2">
      <div v-for="i in 7" :key="i" class="flex-1 bg-gray-200 rounded-t" :style="{ height: `${Math.random() * 60 + 40}%` }"></div>
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
