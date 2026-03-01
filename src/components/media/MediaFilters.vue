<template>
  <div class="media-filters">
    <!-- Stat chips that double as type filters -->
    <div class="stat-chips">
      <button
        v-for="chip in chips"
        :key="chip.value"
        class="stat-chip"
        :class="{ 'stat-chip--active': mediaState.filterType.value === chip.value }"
        @click="mediaState.filterType.value = chip.value"
      >
        <component :is="chip.icon" class="stat-chip-icon" />
        <span class="stat-chip-count">{{ chip.count }}</span>
        <span class="stat-chip-label">{{ chip.label }}</span>
      </button>
    </div>

    <!-- Sort dropdown -->
    <div class="sort-control">
      <IconSortDescending class="sort-icon" />
      <select v-model="mediaState.sortBy.value" class="sort-select">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="largest">Largest</option>
        <option value="smallest">Smallest</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMediaState } from '../../composables/media/useMediaState.js'
import {
  IconLayoutGrid,
  IconPhoto,
  IconPlayerPlay,
  IconMusic,
  IconSortDescending
} from '@iconify-prerendered/vue-tabler'

const mediaState = useMediaState()

const chips = computed(() => [
  { value: 'all', icon: IconLayoutGrid, label: 'All', count: mediaState.fileCount.value },
  { value: 'image', icon: IconPhoto, label: 'Images', count: mediaState.imageCount.value },
  { value: 'video', icon: IconPlayerPlay, label: 'Video', count: mediaState.videoCount.value },
  { value: 'audio', icon: IconMusic, label: 'Audio', count: mediaState.audioCount.value }
])
</script>

<style scoped>
.media-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.stat-chips {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.stat-chip:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text);
}

.stat-chip--active {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.stat-chip-icon {
  width: 0.875rem;
  height: 0.875rem;
}

.stat-chip-count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-chip-label {
  display: inline;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 0.25rem 0.5rem;
}

.sort-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}

.sort-select {
  background: transparent;
  border: none;
  color: var(--color-text);
  font-size: 0.8125rem;
  cursor: pointer;
  outline: none;
  padding: 0.25rem 0;
}

.sort-select option {
  background: var(--color-surface-elevated);
  color: var(--color-text);
}

/* Mobile: hide labels, show only counts, ensure touch targets */
@media (max-width: 480px) {
  .stat-chip-label {
    display: none;
  }

  .stat-chip {
    padding: 0.5rem 0.625rem;
    min-height: 2.25rem;
  }

  .sort-control {
    padding: 0.375rem 0.5rem;
    min-height: 2.25rem;
  }
}
</style>
