<script setup>
import { computed } from 'vue'

const props = defineProps({
  date: { type: Date, required: true }
})

const label = computed(() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const msgDate = new Date(props.date.getFullYear(), props.date.getMonth(), props.date.getDate())

  if (msgDate.getTime() === today.getTime()) return 'Today'
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday'
  return props.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})
</script>

<template>
  <div class="flex items-center justify-center my-4">
    <span class="text-[11px] text-gray-400 font-medium bg-gray-100/80 px-3 py-1 rounded-full select-none">
      {{ label }}
    </span>
  </div>
</template>
