<template>
  <div
    :class="[
      'group rounded-xl overflow-hidden bg-white border cursor-pointer transition-all duration-200',
      isSelected
        ? 'border-orange-500 ring-1 ring-orange-500'
        : 'border-gray-200 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5'
    ]"
    @click="$emit('preview', file)"
  >
    <!-- Thumbnail -->
    <div class="relative aspect-square overflow-hidden bg-gray-50">
      <img
        v-if="isImage && !thumbError"
        :src="file.url"
        :alt="file.hash"
        loading="lazy"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        @error="thumbError = true"
      />
      <div v-else-if="isVideo" class="flex items-center justify-center w-full h-full text-gray-400">
        <IconPlayerPlay class="w-8 h-8" />
      </div>
      <div v-else class="flex items-center justify-center w-full h-full text-gray-400">
        <IconPhoto class="w-8 h-8" />
      </div>

      <!-- File type badge (top-right) -->
      <span class="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/60 text-white/90 text-[10px] font-semibold font-mono rounded backdrop-blur-sm z-[2] leading-tight">
        {{ fileExtension }}
      </span>

      <!-- Server count (top-left, offset for checkbox) -->
      <span
        v-if="file.servers?.length > 1"
        class="absolute top-1.5 left-7 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/60 text-white/90 text-[10px] font-semibold rounded backdrop-blur-sm z-[2]"
        :title="`On ${file.servers.length} servers`"
      >
        <IconServer2 class="w-3 h-3" />
        {{ file.servers.length }}
      </span>

      <!-- Bottom gradient scrim -->
      <div class="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2 pb-1.5 pt-6 bg-gradient-to-t from-black/70 to-transparent text-[11px] text-white/85 z-[1] pointer-events-none">
        <span class="font-medium tabular-nums">{{ formatSize(file.size) }}</span>
        <span v-if="file.created" class="opacity-70">{{ relativeDate(file.created) }}</span>
      </div>

      <!-- Hover overlay (desktop) -->
      <div class="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[3]" @click.stop>
        <button class="flex items-center justify-center w-9 h-9 rounded-lg bg-white text-gray-700 hover:bg-gray-100 transition-colors" title="Copy URL" @click="copyUrl">
          <IconCheck v-if="copied" class="w-4 h-4 text-green-600" />
          <IconCopy v-else class="w-4 h-4" />
        </button>
        <button class="flex items-center justify-center w-9 h-9 rounded-lg bg-white text-gray-700 hover:bg-gray-100 transition-colors" title="Download" @click="$emit('download', file)">
          <IconDownload class="w-4 h-4" />
        </button>
        <button class="flex items-center justify-center w-9 h-9 rounded-lg bg-white text-gray-700 hover:bg-gray-100 transition-colors" title="Preview" @click="$emit('preview', file)">
          <IconMaximize class="w-4 h-4" />
        </button>
        <button class="flex items-center justify-center w-9 h-9 rounded-lg bg-white text-red-600 hover:bg-red-50 transition-colors" title="Delete" @click="$emit('delete', file.hash)">
          <IconTrash class="w-4 h-4" />
        </button>
      </div>

      <!-- Selection checkbox -->
      <label
        :class="[
          'absolute top-1.5 left-1.5 z-[4] transition-opacity duration-150 cursor-pointer',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        ]"
        @click.stop
      >
        <input type="checkbox" :checked="isSelected" class="w-4 h-4 accent-orange-500 cursor-pointer rounded" @change="$emit('toggle', file.hash)" />
      </label>
    </div>

    <!-- Action bar (touch-friendly, always visible) -->
    <div class="flex items-center justify-end gap-0.5 px-1.5 py-1 border-t border-gray-100 bg-white">
      <button class="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Copy URL" @click.stop="copyUrl">
        <IconCheck v-if="copied" class="w-3.5 h-3.5 text-green-600" />
        <IconCopy v-else class="w-3.5 h-3.5" />
      </button>
      <button class="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Download" @click.stop="$emit('download', file)">
        <IconDownload class="w-3.5 h-3.5" />
      </button>
      <button class="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete" @click.stop="$emit('delete', file.hash)">
        <IconTrash class="w-3.5 h-3.5" />
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
/* Touch devices: disable hover effects, always show controls */
@media (hover: none) {
  .group:hover {
    transform: none !important;
    box-shadow: none !important;
  }

  .group:hover img {
    transform: none !important;
  }

  /* Hide desktop overlay on touch */
  .group .absolute.inset-0.bg-black\/50 {
    display: none;
  }

  /* Enlarge touch targets */
  .flex.items-center.justify-center.w-7 {
    width: 2rem;
    height: 2rem;
  }
}
</style>
