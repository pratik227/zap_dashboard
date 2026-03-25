<template>
  <div class="media-list">
    <div class="list-header">
      <span class="list-col list-col--check"></span>
      <span class="list-col list-col--preview">Preview</span>
      <span class="list-col list-col--name">File</span>
      <span class="list-col list-col--type">Type</span>
      <span class="list-col list-col--size">Size</span>
      <span class="list-col list-col--date">Date</span>
      <span class="list-col list-col--servers">Servers</span>
      <span class="list-col list-col--actions"></span>
    </div>

    <div
      v-for="file in files"
      :key="file.hash"
      class="list-row"
      :class="{ 'list-row--selected': selectedFiles.has(file.hash) }"
      @click="$emit('preview', file)"
    >
      <!-- Checkbox -->
      <span class="list-col list-col--check" @click.stop>
        <input
          type="checkbox"
          class="list-checkbox"
          :checked="selectedFiles.has(file.hash)"
          @change="$emit('toggle', file.hash)"
        />
      </span>

      <!-- Thumbnail -->
      <span class="list-col list-col--preview">
        <div class="list-thumb">
          <img
            v-if="isImage(file) && !thumbErrors.has(file.hash)"
            :src="file.url"
            :alt="file.hash"
            loading="lazy"
            @error="thumbErrors.add(file.hash)"
          />
          <IconPlayerPlay v-else-if="isVideo(file)" class="thumb-icon" />
          <IconMusic v-else-if="isAudio(file)" class="thumb-icon" />
          <IconFile v-else class="thumb-icon" />
        </div>
      </span>

      <!-- Hash / name -->
      <span class="list-col list-col--name">
        <span class="list-hash" :title="file.url">{{ file.hash?.slice(0, 16) }}...</span>
      </span>

      <!-- Type badge -->
      <span class="list-col list-col--type">
        <span class="list-type-badge">{{ fileExtension(file) }}</span>
      </span>

      <!-- Size -->
      <span class="list-col list-col--size list-mono">{{ formatSize(file.size) }}</span>

      <!-- Date -->
      <span class="list-col list-col--date list-muted">{{ relativeDate(file.created) }}</span>

      <!-- Servers -->
      <span class="list-col list-col--servers">
        <span v-if="file.servers?.length" class="list-servers">
          <IconServer2 class="list-server-icon" />
          {{ file.servers.length }}
        </span>
      </span>

      <!-- Actions -->
      <span class="list-col list-col--actions" @click.stop>
        <button class="list-action-btn list-action-btn--copy" title="Copy URL" @click="copyUrl(file)">
          <IconCheck v-if="copiedHash === file.hash" class="list-action-icon" />
          <IconCopy v-else class="list-action-icon" />
        </button>
        <button class="list-action-btn" title="Download" @click="$emit('download', file)">
          <IconDownload class="list-action-icon" />
        </button>
        <button class="list-action-btn list-action-btn--danger" title="Delete" @click="$emit('delete', file.hash)">
          <IconTrash class="list-action-icon" />
        </button>
      </span>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import {
  IconPlayerPlay,
  IconMusic,
  IconFile,
  IconServer2,
  IconCopy,
  IconCheck,
  IconDownload,
  IconTrash
} from '@iconify-prerendered/vue-tabler'

defineProps({
  files: { type: Array, required: true },
  selectedFiles: { type: Set, default: () => new Set() }
})

defineEmits(['preview', 'delete', 'toggle', 'download'])

const thumbErrors = reactive(new Set())
const copiedHash = ref(null)

function isImage(file) { return file.type?.startsWith('image/') }
function isVideo(file) { return file.type?.startsWith('video/') }
function isAudio(file) { return file.type?.startsWith('audio/') }

function fileExtension(file) {
  const type = file.type || ''
  const ext = type.split('/').pop()?.toUpperCase()
  const map = { JPEG: 'JPG', MPEG: 'MP3', QUICKTIME: 'MOV', 'SVG+XML': 'SVG' }
  return map[ext] || ext || '?'
}

function copyUrl(file) {
  navigator.clipboard.writeText(file.url).then(() => {
    copiedHash.value = file.hash
    setTimeout(() => { copiedHash.value = null }, 2000)
  })
}

function formatSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function relativeDate(timestamp) {
  if (!timestamp) return '-'
  const seconds = Math.floor(Date.now() / 1000) - timestamp
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d ago`
  return `${Math.floor(seconds / 2592000)}mo ago`
}
</script>

<style scoped>
.media-list {
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  background: white;
}

.list-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  user-select: none;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 0.8125rem;
  color: #111827;
}

.list-row:last-child { border-bottom: none; }
.list-row:hover { background: #f9fafb; }
.list-row--selected, .list-row--selected:hover { background: #fff7ed; }

.list-col { flex-shrink: 0; }
.list-col--check { width: 1.5rem; display: flex; align-items: center; }
.list-col--preview { width: 2.5rem; }
.list-col--name { flex: 1; min-width: 0; }
.list-col--type { width: 3.5rem; }
.list-col--size { width: 4.5rem; text-align: right; }
.list-col--date { width: 4.5rem; text-align: right; }
.list-col--servers { width: 3rem; text-align: center; }
.list-col--actions { width: 5.5rem; display: flex; justify-content: flex-end; gap: 0.125rem; }

.list-thumb {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.25rem;
  overflow: hidden;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
}

.list-thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb-icon { width: 1rem; height: 1rem; color: #9ca3af; }

.list-hash {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.75rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.list-type-badge {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #6b7280;
  letter-spacing: 0.03em;
}

.list-mono { font-variant-numeric: tabular-nums; font-size: 0.75rem; }
.list-muted { color: #9ca3af; font-size: 0.75rem; }

.list-servers {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.list-server-icon { width: 0.75rem; height: 0.75rem; }
.list-checkbox { width: 0.875rem; height: 0.875rem; accent-color: #f97316; cursor: pointer; }

.list-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s ease;
}

.list-action-btn:hover { background: #f3f4f6; color: #111827; }
.list-action-btn--danger:hover { background: #fef2f2; color: #ef4444; }
.list-action-icon { width: 0.875rem; height: 0.875rem; }

@media (max-width: 768px) {
  .list-col--date, .list-col--servers { display: none; }
}

@media (max-width: 480px) {
  .list-col--type { display: none; }
  .list-action-btn--copy { display: none; }
  .list-col--actions { width: 3.5rem; }
}
</style>
