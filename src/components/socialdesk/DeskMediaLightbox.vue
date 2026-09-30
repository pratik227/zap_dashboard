<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  IconX,
  IconDownload,
  IconExternalLink,
  IconChevronLeft,
  IconChevronRight,
  IconLoader,
  IconAlertCircle
} from '@iconify-prerendered/vue-tabler'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'

const props = defineProps({
  media: { type: Array, default: () => [] },
  initialIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['close'])

const modalRef = ref(null)
const showRef = ref(true)
const activeIndex = ref(0)
const isDownloading = ref(false)
const downloadError = ref('')
const imageLoadError = ref(false)

useFocusTrap(showRef, modalRef)

const hasMedia = computed(() => props.media.length > 0)
const hasMultiple = computed(() => props.media.length > 1)
const currentMedia = computed(() => props.media[activeIndex.value] || null)

function clampIndex(index) {
  if (!props.media.length) return 0
  return Math.min(Math.max(index, 0), props.media.length - 1)
}

function goTo(index) {
  activeIndex.value = clampIndex(index)
  imageLoadError.value = false
}

function goNext() {
  if (!hasMultiple.value) return
  activeIndex.value = (activeIndex.value + 1) % props.media.length
}

function goPrev() {
  if (!hasMultiple.value) return
  activeIndex.value = (activeIndex.value - 1 + props.media.length) % props.media.length
}

async function downloadCurrentMedia() {
  if (!currentMedia.value?.url || isDownloading.value) return

  downloadError.value = ''
  isDownloading.value = true

  try {
    const response = await fetch(currentMedia.value.url, { mode: 'cors' })
    if (!response.ok) {
      throw new Error('Download failed')
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = currentMedia.value.filename || 'socialdesk-media'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    downloadError.value = 'Download unavailable for this file. Use Open instead.'
  } finally {
    isDownloading.value = false
  }
}

function handleKeydown(event) {
  if (!hasMedia.value) return

  if (event.key === 'Escape') {
    emit('close')
  } else if (event.key === 'ArrowRight') {
    goNext()
  } else if (event.key === 'ArrowLeft') {
    goPrev()
  }
}

onMounted(() => {
  activeIndex.value = clampIndex(props.initialIndex)
  document.addEventListener('keydown', handleKeydown)
  // Lock body scroll while lightbox is open
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="modalRef"
      class="fixed inset-0 z-[10020] bg-black/88 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
      tabindex="-1"
      @click.self="emit('close')"
    >
      <div class="flex h-full flex-col">
        <div class="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-6">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200/90">ZapTracker Social Desk</p>
            <div class="text-sm text-white/85">
            <span v-if="hasMultiple">{{ activeIndex + 1 }} / {{ media.length }}</span>
            </div>
            <p v-if="downloadError" class="mt-1 inline-flex items-center gap-1 text-xs text-amber-200">
              <IconAlertCircle class="h-3.5 w-3.5" />
              {{ downloadError }}
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <button
              v-if="currentMedia"
              type="button"
              class="desk-media-action inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors"
              aria-label="Download image"
              title="Download image"
              :disabled="isDownloading"
              @click="downloadCurrentMedia"
            >
              <IconLoader v-if="isDownloading" class="h-4 w-4 animate-spin" />
              <IconDownload v-else class="h-4 w-4" />
              <span>Download</span>
            </button>
            <a
              v-if="currentMedia"
              :href="currentMedia.url"
              target="_blank"
              rel="noopener noreferrer"
              class="desk-media-action inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors"
              aria-label="Open original image"
              title="Open original"
            >
              <IconExternalLink class="h-4 w-4" />
              <span>Open</span>
            </a>
            <button
              class="desk-media-action inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
              aria-label="Close media viewer"
              title="Close"
              @click="emit('close')"
            >
              <IconX class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-6 sm:pb-6">
          <button
            v-if="hasMultiple"
            class="desk-media-nav absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors sm:left-6"
            aria-label="Previous image"
            @click.stop="goPrev"
          >
            <IconChevronLeft class="h-5 w-5" />
          </button>

          <!-- Image error state -->
          <div v-if="currentMedia && imageLoadError" class="text-center text-white/60">
            <IconAlertCircle class="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p class="text-sm mb-2">Image could not be loaded</p>
            <a
              :href="currentMedia.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-orange-300 hover:text-orange-200 underline"
            >Open original URL</a>
          </div>

          <!-- Image -->
          <img
            v-else-if="currentMedia"
            :key="currentMedia.url"
            :src="currentMedia.url"
            :alt="currentMedia.alt || 'Expanded post image'"
            class="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            @error="imageLoadError = true"
          />

          <button
            v-if="hasMultiple"
            class="desk-media-nav absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-colors sm:right-6"
            aria-label="Next image"
            @click.stop="goNext"
          >
            <IconChevronRight class="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.desk-media-action {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 248, 235, 0.96);
  color: #1f2937;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.desk-media-action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 1);
}

.desk-media-action:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.desk-media-nav {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 248, 235, 0.92);
  color: #1f2937;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
}

.desk-media-nav:hover {
  background: rgba(255, 255, 255, 1);
}
 </style>
