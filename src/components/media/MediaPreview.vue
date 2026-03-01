<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="file" class="lightbox-overlay" @click.self="$emit('close')">
        <div class="lightbox-content">
          <!-- Top bar -->
          <div class="lightbox-header">
            <span class="lightbox-info">
              {{ fileName }} &middot; {{ formatSize(file.size) }}
            </span>
            <div class="lightbox-actions">
              <button class="lightbox-btn" title="Copy URL" @click="copyUrl">
                <IconCheck v-if="copied" class="lightbox-btn-icon" />
                <IconCopy v-else class="lightbox-btn-icon" />
              </button>
              <button class="lightbox-btn" title="Download" @click="$emit('download', file)">
                <IconDownload class="lightbox-btn-icon" />
              </button>
              <button class="lightbox-btn" title="Close" @click="$emit('close')">
                <IconX class="lightbox-btn-icon" />
              </button>
            </div>
          </div>

          <!-- Media -->
          <div class="lightbox-media">
            <button v-if="hasPrev" class="lightbox-nav lightbox-nav--prev" @click="$emit('prev')">
              <IconChevronLeft class="lightbox-nav-icon" />
            </button>

            <img v-if="isImage" :src="file.url" :alt="file.hash" class="lightbox-img" />
            <video v-else-if="isVideo" :src="file.url" controls class="lightbox-video" />
            <audio v-else-if="isAudio" :src="file.url" controls class="lightbox-audio" />
            <div v-else class="lightbox-unknown">
              <IconPhotoOff class="lightbox-unknown-icon" />
              <p>Preview not available</p>
            </div>

            <button v-if="hasNext" class="lightbox-nav lightbox-nav--next" @click="$emit('next')">
              <IconChevronRight class="lightbox-nav-icon" />
            </button>
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
  IconPhotoOff
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
  return props.file.hash?.slice(0, 12) + '...'
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
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.5);
}

.lightbox-info {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.lightbox-actions {
  display: flex;
  gap: 0.5rem;
}

.lightbox-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.lightbox-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lightbox-btn-icon {
  width: 1rem;
  height: 1rem;
}

.lightbox-media {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 1rem;
}

.lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.lightbox-video {
  max-width: 100%;
  max-height: 100%;
  border-radius: var(--radius-md);
}

.lightbox-audio {
  width: 80%;
  max-width: 500px;
}

.lightbox-unknown {
  text-align: center;
  color: var(--color-text-muted);
}

.lightbox-unknown-icon {
  width: 3rem;
  height: 3rem;
}

.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lightbox-nav-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.lightbox-nav--prev { left: 1rem; }
.lightbox-nav--next { right: 1rem; }

/* Mobile: larger touch targets, tighter padding */
@media (max-width: 480px) {
  .lightbox-btn {
    width: 2.75rem;
    height: 2.75rem;
  }

  .lightbox-btn-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .lightbox-nav {
    width: 2.75rem;
    height: 2.75rem;
  }

  .lightbox-nav--prev { left: 0.5rem; }
  .lightbox-nav--next { right: 0.5rem; }

  .lightbox-media {
    padding: 0.5rem;
  }

  .lightbox-header {
    padding: 0.5rem 0.75rem;
  }

  .lightbox-info {
    font-size: 0.75rem;
  }
}

/* Transitions */
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.2s ease;
}

.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
