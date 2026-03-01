<template>
  <div
    class="upload-zone"
    :class="{
      'upload-zone--active': isDragging,
      'upload-zone--disabled': disabled
    }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
    @click="openFilePicker"
  >
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      multiple
      hidden
      @change="onFileSelect"
    />
    <div class="upload-content">
      <IconUpload class="upload-icon" />
      <span class="upload-text">
        Drop files here or <span class="upload-link">browse</span>
      </span>
    </div>
    <div class="upload-hints">
      <span class="upload-hint"><IconPhoto class="upload-hint-icon" />Images</span>
      <span class="upload-hint"><IconVideo class="upload-hint-icon" />Video</span>
      <span class="upload-hint"><IconMusic class="upload-hint-icon" />Audio</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { IconUpload, IconPhoto, IconVideo, IconMusic } from '@iconify-prerendered/vue-tabler'

defineProps({
  disabled: { type: Boolean, default: false },
  accept: { type: String, default: 'image/*,video/*,audio/*' }
})

const emit = defineEmits(['upload'])

const fileInput = ref(null)
const isDragging = ref(false)

function onDragOver() {
  isDragging.value = true
}

function onDrop(e) {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    emit('upload', e.dataTransfer.files)
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileSelect(e) {
  if (e.target.files?.length) {
    emit('upload', e.target.files)
    e.target.value = ''
  }
}
</script>

<style scoped>
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: all var(--transition-normal);
  background: var(--color-surface);
  position: relative;
}

.upload-zone:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.upload-zone--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  border-style: solid;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
}

.upload-zone:hover .upload-icon,
.upload-zone--active .upload-icon {
  color: var(--color-primary);
  transform: translateY(-1px);
}

.upload-zone--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.upload-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  transition: all var(--transition-fast);
}

.upload-text {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  white-space: nowrap;
}

.upload-link {
  color: var(--color-primary);
  text-decoration: underline;
}

.upload-hints {
  display: flex;
  gap: 0.625rem;
}

.upload-hint {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
}

.upload-hint-icon {
  width: 0.75rem;
  height: 0.75rem;
  opacity: 0.6;
}

@media (max-width: 768px) {
  .upload-zone {
    padding: 1rem;
  }
}
</style>
