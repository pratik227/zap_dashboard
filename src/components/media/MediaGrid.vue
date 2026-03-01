<template>
  <div class="media-grid">
    <MediaItem
      v-for="file in files"
      :key="file.hash"
      :file="file"
      :is-selected="selectedFiles.has(file.hash)"
      @preview="$emit('preview', $event)"
      @delete="$emit('delete', $event)"
      @toggle="$emit('toggle', $event)"
      @download="$emit('download', $event)"
    />
  </div>
</template>

<script setup>
import MediaItem from './MediaItem.vue'

defineProps({
  files: { type: Array, required: true },
  selectedFiles: { type: Set, default: () => new Set() }
})

defineEmits(['preview', 'delete', 'toggle', 'download'])
</script>

<style scoped>
.media-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 480px) {
  .media-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 768px) {
  .media-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (min-width: 1024px) {
  .media-grid {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
