<template>
  <div class="media-library">

    <!-- ===== Top section: two-column on desktop, stacked on mobile ===== -->
    <div class="library-header">
      <!-- Left: filters + actions -->
      <div class="header-left">
        <MediaFilters />
        <div class="header-actions">
          <button v-if="mediaState.selectedCount.value > 0" class="btn-sm btn-sm--danger" @click="onDeleteSelected">
            <IconTrash class="btn-sm-icon" />
            <span>Delete {{ mediaState.selectedCount.value }}</span>
          </button>
          <div class="view-toggle">
            <button
              class="view-toggle-btn"
              :class="{ 'view-toggle-btn--active': viewMode === 'grid' }"
              title="Grid view"
              @click="viewMode = 'grid'"
            >
              <IconLayoutGrid class="btn-sm-icon" />
            </button>
            <button
              class="view-toggle-btn"
              :class="{ 'view-toggle-btn--active': viewMode === 'list' }"
              title="List view"
              @click="viewMode = 'list'"
            >
              <IconList class="btn-sm-icon" />
            </button>
          </div>
          <button class="btn-sm" title="Refresh" @click="blossom.refresh()">
            <IconRefresh class="btn-sm-icon" />
          </button>
        </div>
      </div>

      <!-- Right: compact upload + server indicator -->
      <div class="header-right">
        <MediaUploader :disabled="isUploading" @upload="onUpload" />
        <ServerIndicator />
      </div>
    </div>

    <!-- ===== Total size summary ===== -->
    <div v-if="mediaState.fileCount.value > 0" class="size-summary">
      {{ formatSize(mediaState.totalSize.value) }} across {{ mediaState.fileCount.value }} file{{ mediaState.fileCount.value !== 1 ? 's' : '' }}
    </div>

    <!-- ===== Upload progress ===== -->
    <div v-if="uploadEntries.length > 0" class="upload-progress">
      <div v-for="[id, entry] in uploadEntries" :key="id" class="progress-item">
        <span class="progress-name">{{ entry.name }}</span>
        <template v-if="entry.status === 'uploading'">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" :style="{ width: entry.progress + '%' }"></div>
          </div>
          <span class="progress-pct">{{ entry.progress }}%</span>
        </template>
        <template v-else-if="entry.status === 'error'">
          <span class="progress-error">{{ entry.error }}</span>
          <button class="progress-dismiss" title="Dismiss" @click="dismissUploadError(id)">
            <IconX class="progress-dismiss-icon" />
          </button>
        </template>
      </div>
    </div>

    <!-- ===== Loading state ===== -->
    <div v-if="mediaState.isLoading.value && mediaState.fileCount.value === 0" class="state-loading">
      <IconLoader2 class="spin-icon" />
      <p>Fetching your media from Blossom servers...</p>
    </div>

    <!-- ===== Empty state ===== -->
    <div v-else-if="!mediaState.isLoading.value && mediaState.fileCount.value === 0" class="state-empty">
      <div class="empty-illustration">
        <div class="empty-icon-ring">
          <IconUpload class="empty-upload-icon" />
        </div>
      </div>
      <h3>Upload your first file</h3>
      <p>Drag and drop or click the upload area above to add media to your Blossom servers.</p>
      <div class="empty-tips">
        <span class="tip">PNG, JPG, GIF, WebP</span>
        <span class="tip-dot"></span>
        <span class="tip">MP4, WebM</span>
        <span class="tip-dot"></span>
        <span class="tip">MP3, WAV</span>
        <span class="tip-dot"></span>
        <span class="tip">Up to 20 MB</span>
      </div>
    </div>

    <!-- ===== No results for current filter ===== -->
    <div v-else-if="mediaState.sortedFiles.value.length === 0" class="state-no-results">
      <IconFilter class="state-icon" />
      <p>No files match the current filter.</p>
    </div>

    <!-- ===== Media grid / list ===== -->
    <MediaGrid
      v-else-if="viewMode === 'grid'"
      :files="mediaState.sortedFiles.value"
      :selected-files="mediaState.selectedFiles.value"
      @preview="onPreview"
      @delete="onDelete"
      @download="onDownload"
      @toggle="mediaState.toggleSelection"
    />

    <MediaList
      v-else
      :files="mediaState.sortedFiles.value"
      :selected-files="mediaState.selectedFiles.value"
      @preview="onPreview"
      @delete="onDelete"
      @download="onDownload"
      @toggle="mediaState.toggleSelection"
    />

    <!-- ===== Lightbox ===== -->
    <MediaPreview
      :file="previewFile"
      :has-prev="previewIndex > 0"
      :has-next="previewIndex < mediaState.sortedFiles.value.length - 1"
      @close="previewFile = null"
      @prev="navigatePreview(-1)"
      @next="navigatePreview(1)"
      @download="onDownload"
    />

    <!-- ===== Confirmation modal (delete / download) ===== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="confirmAction" class="modal-overlay" @click.self="confirmAction = null">
          <div class="modal-card">
            <h3>{{ confirmAction.title }}</h3>
            <p>{{ confirmAction.message }}</p>
            <p v-if="downloadError" class="modal-error">{{ downloadError }}</p>
            <div v-if="isDownloading || isDeleting" class="modal-progress">
              <IconLoader2 class="spin-icon-sm" />
              <span>{{ isDownloading ? 'Downloading...' : 'Deleting...' }}</span>
            </div>
            <div v-else class="modal-actions">
              <button class="btn-modal btn-modal--secondary" @click="confirmAction = null; downloadError = ''">Cancel</button>
              <button
                class="btn-modal"
                :class="confirmAction.type === 'delete' || confirmAction.type === 'delete-selected' ? 'btn-modal--danger' : 'btn-modal--primary'"
                @click="executeConfirmAction"
              >
                {{ confirmAction.confirmLabel }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMediaState } from '../../composables/media/useMediaState.js'
import { useBlossom } from '../../composables/media/useBlossom.js'
import {
  IconTrash,
  IconRefresh,
  IconLoader2,
  IconUpload,
  IconFilter,
  IconX,
  IconLayoutGrid,
  IconList
} from '@iconify-prerendered/vue-tabler'
import MediaFilters from './MediaFilters.vue'
import MediaUploader from './MediaUploader.vue'
import MediaGrid from './MediaGrid.vue'
import MediaList from './MediaList.vue'
import MediaPreview from './MediaPreview.vue'
import ServerIndicator from './ServerIndicator.vue'

const mediaState = useMediaState()
const blossom = useBlossom()

const viewMode = ref('grid')
const previewFile = ref(null)
const confirmAction = ref(null)
const isDownloading = ref(false)
const isDeleting = ref(false)
const downloadError = ref('')

const uploadEntries = computed(() => Array.from(mediaState.uploadQueue.value.entries()))
const isUploading = computed(() => uploadEntries.value.some(([, e]) => e.status === 'uploading'))

const previewIndex = computed(() => {
  if (!previewFile.value) return -1
  return mediaState.sortedFiles.value.findIndex(f => f.hash === previewFile.value.hash)
})

function onUpload(files) {
  blossom.uploadFiles(files)
}

function onPreview(file) {
  previewFile.value = file
}

function navigatePreview(dir) {
  const idx = previewIndex.value + dir
  if (idx >= 0 && idx < mediaState.sortedFiles.value.length) {
    previewFile.value = mediaState.sortedFiles.value[idx]
  }
}

function onDelete(hash) {
  confirmAction.value = {
    type: 'delete',
    title: 'Delete File',
    message: 'This will remove the file from all configured Blossom servers. This cannot be undone.',
    confirmLabel: 'Delete',
    data: hash
  }
}

function onDeleteSelected() {
  confirmAction.value = {
    type: 'delete-selected',
    title: 'Delete Files',
    message: `This will delete ${mediaState.selectedCount.value} file${mediaState.selectedCount.value !== 1 ? 's' : ''} from all configured Blossom servers. This cannot be undone.`,
    confirmLabel: 'Delete All',
    data: null
  }
}

function onDownload(file) {
  confirmAction.value = {
    type: 'download',
    title: 'Download File',
    message: `Download this file (${formatSize(file.size)}) to your local machine?`,
    confirmLabel: 'Download',
    data: file
  }
}

async function executeConfirmAction() {
  const action = confirmAction.value
  if (!action) return

  if (action.type === 'delete') {
    isDeleting.value = true
    try {
      await blossom.deleteFiles([action.data])
    } finally {
      isDeleting.value = false
    }
    confirmAction.value = null
  } else if (action.type === 'delete-selected') {
    isDeleting.value = true
    try {
      await blossom.deleteFiles([...mediaState.selectedFiles.value])
      mediaState.clearSelection()
    } finally {
      isDeleting.value = false
    }
    confirmAction.value = null
  } else if (action.type === 'download') {
    await executeDownload(action.data)
  }
}

async function executeDownload(file) {
  isDownloading.value = true
  downloadError.value = ''
  try {
    const response = await fetch(file.url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    const ext = getFileExtension(file)
    const filename = file.hash.slice(0, 16) + '.' + ext

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    confirmAction.value = null
  } catch (err) {
    downloadError.value = 'Download failed. The file may no longer be available.'
    console.error('Download failed:', err)
  } finally {
    isDownloading.value = false
  }
}

function dismissUploadError(id) {
  mediaState.dismissUploadError(id)
}

function getFileExtension(file) {
  const type = file.type || ''
  const sub = type.split('/').pop()?.toLowerCase() || ''
  const map = { jpeg: 'jpg', mpeg: 'mp3', quicktime: 'mov', 'svg+xml': 'svg' }
  return map[sub] || sub || 'bin'
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.media-library {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* ===================================================================
   Header: two-column layout
   =================================================================== */
.library-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  flex: 1;
  min-width: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.625rem;
  flex-shrink: 0;
  width: 280px;
}

/* ===================================================================
   Small buttons
   =================================================================== */
.btn-sm {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-sm:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.btn-sm-icon {
  width: 1rem;
  height: 1rem;
}

/* ===================================================================
   View toggle
   =================================================================== */
.view-toggle {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.5rem;
  background: var(--color-surface);
  color: var(--color-text-subtle);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.view-toggle-btn:first-child {
  border-right: 1px solid var(--color-border);
}

.view-toggle-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.view-toggle-btn--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.view-toggle-btn--active:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.btn-sm--danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.btn-sm--danger:hover {
  background: var(--color-danger-soft);
}

/* ===================================================================
   Size summary
   =================================================================== */
.size-summary {
  font-size: 0.8125rem;
  color: var(--color-text-subtle);
  font-variant-numeric: tabular-nums;
}

/* ===================================================================
   Upload progress
   =================================================================== */
.upload-progress {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.progress-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
}

.progress-name {
  color: var(--color-text);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.progress-bar-track {
  flex: 1;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.progress-pct {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  width: 2.5rem;
  text-align: right;
  flex-shrink: 0;
}

.progress-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  flex: 1;
}

.progress-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  flex-shrink: 0;
}

.progress-dismiss:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.progress-dismiss-icon {
  width: 0.75rem;
  height: 0.75rem;
}

/* ===================================================================
   States: loading, empty, no-results
   =================================================================== */
.state-loading,
.state-no-results {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted);
}

.state-loading p,
.state-no-results p {
  margin: 0.5rem 0 0;
  font-size: 0.875rem;
}

.state-icon {
  width: 2rem;
  height: 2rem;
}

.spin-icon {
  width: 2rem;
  height: 2rem;
  animation: spin 1s linear infinite;
}

.spin-icon-sm {
  width: 1rem;
  height: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Enhanced empty state */
.state-empty {
  text-align: center;
  padding: 3rem 1rem;
}

.empty-illustration {
  margin-bottom: 1.25rem;
}

.empty-icon-ring {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: var(--radius-full);
  border: 2px dashed var(--color-border);
  color: var(--color-text-subtle);
  animation: pulse-ring 3s ease-in-out infinite;
}

.empty-upload-icon {
  width: 2rem;
  height: 2rem;
}

@keyframes pulse-ring {
  0%, 100% { border-color: var(--color-border); }
  50% { border-color: var(--color-primary); }
}

.state-empty h3 {
  margin: 0 0 0.375rem;
  color: var(--color-text);
  font-size: 1.125rem;
}

.state-empty p {
  margin: 0 0 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  max-width: 380px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
}

.empty-tips {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tip {
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  padding: 0.125rem 0.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.tip-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--color-text-subtle);
}

/* ===================================================================
   Delete confirmation modal
   =================================================================== */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 400px;
  width: 90%;
}

.modal-card h3 {
  margin: 0 0 0.75rem;
  color: var(--color-text);
}

.modal-card p {
  margin: 0 0 1.25rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-modal {
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: none;
}

.btn-modal--secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-modal--secondary:hover {
  background: var(--color-surface-hover);
}

.btn-modal--primary {
  background: var(--color-primary);
  color: white;
}

.btn-modal--primary:hover {
  background: var(--color-primary-hover);
}

.btn-modal--danger {
  background: var(--color-danger);
  color: white;
}

.btn-modal--danger:hover {
  opacity: 0.9;
}

.modal-error {
  color: var(--color-danger);
  font-size: 0.8125rem;
  margin: -0.5rem 0 0.75rem;
}

.modal-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* ===================================================================
   Responsive: mobile stacked layout
   =================================================================== */
@media (max-width: 768px) {
  .library-header {
    flex-direction: column;
  }

  .header-right {
    width: 100%;
    align-items: stretch;
    flex-direction: column-reverse;
  }
}

@media (max-width: 480px) {
  .progress-name {
    max-width: 100px;
  }
}
</style>
