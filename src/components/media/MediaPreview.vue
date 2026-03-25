<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="file" class="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-sm flex flex-col" @click.self="$emit('close')">

        <!-- Top bar -->
        <div class="flex items-center justify-between px-4 sm:px-6 py-3 bg-gradient-to-b from-black/60 to-transparent flex-shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-white/70 text-sm font-medium truncate">
              {{ fileName }}
            </span>
            <span class="text-white/40 text-xs">{{ formatSize(file.size) }}</span>
            <span v-if="file.type" class="hidden sm:inline-flex px-2 py-0.5 bg-white/10 text-white/60 text-xs font-mono rounded">
              {{ file.type }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button
              class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Copy URL"
              @click="copyUrl"
            >
              <IconCheck v-if="copied" class="w-4.5 h-4.5 text-green-400" />
              <IconCopy v-else class="w-4.5 h-4.5" />
            </button>
            <button
              class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
              title="Download"
              @click="$emit('download', file)"
            >
              <IconDownload class="w-4.5 h-4.5" />
            </button>
            <button
              class="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-white hover:bg-red-500/30 hover:text-red-300 transition-colors"
              title="Close"
              @click="$emit('close')"
            >
              <IconX class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Media area -->
        <div class="flex-1 flex items-center justify-center relative px-4 pb-4 min-h-0" @click.self="$emit('close')">
          <!-- Prev nav -->
          <button
            v-if="hasPrev"
            class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/25 transition-all duration-200 hover:scale-110 z-10"
            @click.stop="$emit('prev')"
          >
            <IconChevronLeft class="w-6 h-6" />
          </button>

          <!-- Image -->
          <img
            v-if="isImage"
            :src="file.url"
            :alt="file.hash"
            class="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
            draggable="false"
          />
          <!-- Video -->
          <video
            v-else-if="isVideo"
            :src="file.url"
            controls
            class="max-w-full max-h-full rounded-lg shadow-2xl"
          />
          <!-- Audio -->
          <div v-else-if="isAudio" class="w-full max-w-lg mx-auto bg-white/5 rounded-2xl p-8 text-center">
            <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center">
              <IconPlayerPlay class="w-8 h-8 text-white/60" />
            </div>
            <audio :src="file.url" controls class="w-full" />
          </div>
          <!-- Unknown -->
          <div v-else class="text-center text-white/50">
            <IconPhotoOff class="w-16 h-16 mx-auto mb-3 opacity-50" />
            <p class="text-sm">Preview not available for this file type</p>
          </div>

          <!-- Next nav -->
          <button
            v-if="hasNext"
            class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/25 transition-all duration-200 hover:scale-110 z-10"
            @click.stop="$emit('next')"
          >
            <IconChevronRight class="w-6 h-6" />
          </button>
        </div>

        <!-- Bottom info bar -->
        <div class="flex-shrink-0 px-4 sm:px-6 py-2 bg-gradient-to-t from-black/40 to-transparent">
          <div class="flex items-center justify-center gap-4 text-xs text-white/40">
            <span v-if="hasPrev || hasNext">Use arrow keys to navigate</span>
            <span>Press Esc to close</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  IconCopy,
  IconCheck,
  IconDownload,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconPhotoOff,
  IconPlayerPlay
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  file: { type: Object, default: null },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'prev', 'next', 'download'])

const copied = ref(false)

const isImage = computed(() => props.file?.type?.startsWith('image/'))
const isVideo = computed(() => props.file?.type?.startsWith('video/'))
const isAudio = computed(() => props.file?.type?.startsWith('audio/'))

const fileName = computed(() => {
  if (!props.file) return ''
  return props.file.hash?.slice(0, 16) + '...'
})

function copyUrl() {
  if (!props.file?.url) return
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

function onKeydown(e) {
  if (!props.file) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft' && props.hasPrev) emit('prev')
  else if (e.key === 'ArrowRight' && props.hasNext) emit('next')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.25s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
