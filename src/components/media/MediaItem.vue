<template>
  <div class="media-item" :class="{ 'media-item--selected': isSelected }" @click="$emit('preview', file)">
    <!-- Thumbnail -->
    <div class="media-thumb">
      <img
        v-if="isImage && !thumbError"
        :src="file.url"
        :alt="file.hash"
        loading="lazy"
        @error="thumbError = true"
      />
      <div v-else-if="isVideo" class="media-thumb-placeholder">
        <IconPlayerPlay class="placeholder-icon" />
      </div>
      <div v-else class="media-thumb-placeholder">
        <IconPhoto class="placeholder-icon" />
      </div>

      <!-- File type badge -->
      <span class="type-badge">{{ fileExtension }}</span>

      <!-- Bottom gradient scrim with info -->
      <div class="media-scrim">
        <span class="scrim-size">{{ formatSize(file.size) }}</span>
        <span v-if="file.created" class="scrim-date">{{ relativeDate(file.created) }}</span>
      </div>

      <!-- Server count indicator (top-left, offset to clear checkbox) -->
      <span v-if="file.servers?.length > 1" class="server-badge" :title="`On ${file.servers.length} servers`">
        <IconServer2 class="server-badge-icon" />
        {{ file.servers.length }}
      </span>

      <!-- Hover overlay (desktop) -->
      <div class="media-overlay" @click.stop>
        <button class="overlay-btn" title="Copy URL" @click="copyUrl">
          <IconCheck v-if="copied" class="overlay-btn-icon" />
          <IconCopy v-else class="overlay-btn-icon" />
        </button>
        <button class="overlay-btn" title="Download" @click="$emit('download', file)">
          <IconDownload class="overlay-btn-icon" />
        </button>
        <button class="overlay-btn" title="Preview" @click="$emit('preview', file)">
          <IconMaximize class="overlay-btn-icon" />
        </button>
        <button class="overlay-btn overlay-btn--danger" title="Delete" @click="$emit('delete', file.hash)">
          <IconTrash class="overlay-btn-icon" />
        </button>
      </div>

      <!-- Selection checkbox -->
      <label class="media-checkbox" :class="{ 'media-checkbox--visible': isSelected }" @click.stop>
        <input type="checkbox" :checked="isSelected" @change="$emit('toggle', file.hash)" />
      </label>
    </div>

    <!-- Action bar (always visible, used on touch + provides clean row below thumb) -->
    <div class="media-actions-bar">
      <button class="bar-btn" title="Copy URL" @click.stop="copyUrl">
        <IconCheck v-if="copied" class="bar-btn-icon" />
        <IconCopy v-else class="bar-btn-icon" />
      </button>
      <button class="bar-btn" title="Download" @click.stop="$emit('download', file)">
        <IconDownload class="bar-btn-icon" />
      </button>
      <button class="bar-btn bar-btn--danger" title="Delete" @click.stop="$emit('delete', file.hash)">
        <IconTrash class="bar-btn-icon" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  IconPlayerPlay,
  IconPhoto,
  IconServer2,
  IconCopy,
  IconCheck,
  IconDownload,
  IconMaximize,
  IconTrash
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  file: { type: Object, required: true },
  isSelected: { type: Boolean, default: false }
})

defineEmits(['preview', 'delete', 'toggle', 'download'])

const thumbError = ref(false)
const copied = ref(false)

const isImage = computed(() => props.file.type?.startsWith('image/'))
const isVideo = computed(() => props.file.type?.startsWith('video/'))

const fileExtension = computed(() => {
  const type = props.file.type || ''
  const ext = type.split('/').pop()?.toUpperCase()
  const map = { JPEG: 'JPG', MPEG: 'MP3', QUICKTIME: 'MOV', 'SVG+XML': 'SVG' }
  return map[ext] || ext || '?'
})

function copyUrl() {
  navigator.clipboard.writeText(props.file.url).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  })
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function relativeDate(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.floor(Date.now() / 1000) - timestamp
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`
  return `${Math.floor(seconds / 2592000)}mo`
}
</script>

<style scoped>
.media-item {
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.media-item:hover {
  border-color: var(--color-border-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.media-item--selected,
.media-item--selected:hover {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

/* Thumbnail container */
.media-thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--color-bg);
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-normal);
}

.media-item:hover .media-thumb img {
  transform: scale(1.05);
}

.media-thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-subtle);
}

.placeholder-icon {
  width: 2rem;
  height: 2rem;
}

/* Type badge (top-right) */
.type-badge {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.65);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.625rem;
  font-weight: 600;
  font-family: var(--font-mono);
  border-radius: var(--radius-sm);
  letter-spacing: 0.03em;
  line-height: 1.4;
  backdrop-filter: blur(4px);
  z-index: 2;
}

/* Server count (top-left, offset right to clear checkbox) */
.server-badge {
  position: absolute;
  top: 0.375rem;
  left: 1.75rem;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.125rem 0.375rem;
  background: rgba(0, 0, 0, 0.65);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.625rem;
  font-weight: 600;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(4px);
  z-index: 2;
}

.server-badge-icon {
  width: 0.75rem;
  height: 0.75rem;
}

/* Bottom gradient scrim */
.media-scrim {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 1.5rem 0.5rem 0.375rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 100%);
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.85);
  z-index: 1;
  pointer-events: none;
}

.scrim-size {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.scrim-date {
  opacity: 0.7;
}

/* Hover overlay */
.media-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity var(--transition-fast);
  z-index: 3;
}

.media-item:hover .media-overlay {
  opacity: 1;
}

.overlay-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.overlay-btn-icon {
  width: 1rem;
  height: 1rem;
}

.overlay-btn:hover {
  background: var(--color-surface-hover);
}

.overlay-btn--danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

/* Selection checkbox */
.media-checkbox {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  cursor: pointer;
  z-index: 4;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.media-item:hover .media-checkbox,
.media-checkbox--visible {
  opacity: 1;
}

.media-checkbox input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* ===================================================================
   Action bar (below thumbnail)
   =================================================================== */
.media-actions-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.125rem;
  padding: 0.25rem 0.375rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.bar-btn:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.bar-btn--danger:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.bar-btn-icon {
  width: 0.875rem;
  height: 0.875rem;
}

/* Touch devices: disable hover effects, always show controls */
@media (hover: none) {
  .media-item:hover {
    transform: none;
    box-shadow: none;
    border-color: var(--color-border);
  }

  .media-item--selected:hover {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .media-item:hover .media-thumb img {
    transform: none;
  }

  .media-scrim {
    opacity: 1;
  }

  .media-overlay {
    opacity: 0;
    pointer-events: none;
  }

  .media-checkbox {
    opacity: 1;
  }

  .bar-btn {
    width: 2rem;
    height: 2rem;
  }

  .bar-btn-icon {
    width: 1rem;
    height: 1rem;
  }
}
</style>
