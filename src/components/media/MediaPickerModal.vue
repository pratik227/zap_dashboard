<script setup>
import { ref, computed, watch } from 'vue'
import { useMediaState } from '../../composables/media/useMediaState.js'
import { useBlossom } from '../../composables/media/useBlossom.js'
import {
  IconX,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconUpload,
  IconCheck,
  IconLink,
  IconLoader,
  IconPlayerPlay,
  IconSearch
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** Restrict to certain types: 'all' | 'image' | 'video' | 'audio' */
  accept: { type: String, default: 'all' }
})

const emit = defineEmits(['close', 'select'])

const {
  files,
  sortedFiles,
  uploadQueue,
  filterType,
  isLoading: mediaLoading
} = useMediaState()

const { refresh, uploadFiles } = useBlossom({ autoFetch: false })

// Local state
const activeTab = ref('library') // 'library' | 'url'
const urlInput = ref('')
const altInput = ref('')
const searchQuery = ref('')
const selectedFile = ref(null)
const localFilter = ref('all')

// File input ref for upload
const fileInputRef = ref(null)
const isDragging = ref(false)

// Accept string for file input based on props.accept
const fileAccept = computed(() => {
  if (props.accept === 'image') return 'image/*'
  if (props.accept === 'video') return 'video/*'
  if (props.accept === 'audio') return 'audio/*'
  return 'image/*,video/*,audio/*'
})

// Filtered files for display
const displayFiles = computed(() => {
  let list = Array.from(files.value.values())
    .sort((a, b) => (b.created || 0) - (a.created || 0))

  // Apply type filter
  if (localFilter.value !== 'all') {
    list = list.filter(f => f.type?.startsWith(localFilter.value + '/'))
  } else if (props.accept !== 'all') {
    list = list.filter(f => f.type?.startsWith(props.accept + '/'))
  }

  // Apply search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(f => {
      const ext = f.type?.split('/')?.pop()?.toLowerCase() || ''
      const url = f.url?.toLowerCase() || ''
      return ext.includes(q) || url.includes(q) || f.hash?.includes(q)
    })
  }

  return list
})

// Upload queue items as array
const activeUploads = computed(() => {
  return Array.from(uploadQueue.value.values()).filter(u => u.status === 'uploading')
})

// Counts per type
const counts = computed(() => {
  const all = Array.from(files.value.values())
  return {
    all: all.length,
    image: all.filter(f => f.type?.startsWith('image/')).length,
    video: all.filter(f => f.type?.startsWith('video/')).length,
    audio: all.filter(f => f.type?.startsWith('audio/')).length
  }
})

// Reset state when modal opens
watch(() => props.visible, (val) => {
  if (val) {
    activeTab.value = 'library'
    urlInput.value = ''
    altInput.value = ''
    searchQuery.value = ''
    selectedFile.value = null
    localFilter.value = props.accept !== 'all' ? props.accept : 'all'
    // Fetch media if empty
    if (files.value.size === 0) {
      refresh()
    }
  }
})

// Helpers
const isImage = (file) => file.type?.startsWith('image/')
const isVideo = (file) => file.type?.startsWith('video/')
const isAudio = (file) => file.type?.startsWith('audio/')

const fileExtension = (file) => {
  const ext = file.type?.split('/').pop()?.toUpperCase() || '?'
  const map = { JPEG: 'JPG', MPEG: 'MP3', QUICKTIME: 'MOV', 'SVG+XML': 'SVG' }
  return map[ext] || ext
}

const formatSize = (bytes) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Actions
const selectFile = (file) => {
  selectedFile.value = file
}

const confirmSelection = () => {
  if (selectedFile.value) {
    emit('select', {
      url: selectedFile.value.url,
      type: selectedFile.value.type,
      hash: selectedFile.value.hash,
      alt: ''
    })
    emit('close')
  }
}

const insertFromUrl = () => {
  const url = urlInput.value.trim()
  if (!url) return

  // Guess type from URL
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']
  const videoExts = ['mp4', 'webm', 'mov', 'avi']
  const audioExts = ['mp3', 'ogg', 'wav', 'flac', 'aac']

  let type = 'image/unknown'
  if (imageExts.includes(ext)) type = `image/${ext === 'jpg' ? 'jpeg' : ext}`
  else if (videoExts.includes(ext)) type = `video/${ext}`
  else if (audioExts.includes(ext)) type = `audio/${ext}`

  emit('select', {
    url,
    type,
    alt: altInput.value.trim()
  })
  emit('close')
}

const handleUpload = async (fileList) => {
  const results = await uploadFiles(fileList)
  // Auto-select the first successfully uploaded file
  const success = results.find(r => r.success)
  if (success?.result) {
    selectedFile.value = {
      url: success.result.url,
      type: success.result.type,
      hash: success.result.hash
    }
  }
}

const onDrop = (e) => {
  isDragging.value = false
  if (e.dataTransfer?.files?.length) {
    handleUpload(e.dataTransfer.files)
  }
}

const onFileSelect = (e) => {
  if (e.target.files?.length) {
    handleUpload(e.target.files)
    e.target.value = ''
  }
}
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="visible" class="fixed inset-0 z-[9999]">
        <!-- Backdrop -->
        <div @click="$emit('close')" class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <!-- Modal -->
        <div class="absolute inset-0 flex md:items-center md:justify-center md:p-6 pointer-events-none">
          <div class="pointer-events-auto w-full md:w-[600px] md:max-w-[90vw] h-full md:h-auto md:max-h-[85vh] bg-white md:shadow-2xl flex flex-col mt-auto md:mt-0 rounded-t-2xl md:rounded-2xl overflow-hidden md:animate-scale-in animate-slide-up">

            <!-- Header -->
            <div class="flex-shrink-0 border-b border-gray-200">
              <!-- Mobile drag handle -->
              <div class="md:hidden flex justify-center pt-2.5 pb-1">
                <div class="w-9 h-1 bg-gray-300 rounded-full"></div>
              </div>

              <div class="flex items-center justify-between px-5 py-3">
                <h3 class="text-lg font-bold text-gray-900">Insert Media</h3>
                <button
                  @click="$emit('close')"
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>

              <!-- Tabs -->
              <div class="flex px-5 gap-1">
                <button
                  @click="activeTab = 'library'"
                  :class="[
                    'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                    activeTab === 'library'
                      ? 'text-orange-600 border-orange-500 bg-orange-50/50'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  ]"
                >
                  <span class="flex items-center gap-1.5">
                    <IconPhoto class="w-4 h-4" />
                    Media Library
                    <span v-if="counts.all > 0" class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{{ counts.all }}</span>
                  </span>
                </button>
                <button
                  @click="activeTab = 'url'"
                  :class="[
                    'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px',
                    activeTab === 'url'
                      ? 'text-orange-600 border-orange-500 bg-orange-50/50'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  ]"
                >
                  <span class="flex items-center gap-1.5">
                    <IconLink class="w-4 h-4" />
                    From URL
                  </span>
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto overscroll-contain min-h-0">

              <!-- Library Tab -->
              <div v-if="activeTab === 'library'" class="p-4 space-y-4">

                <!-- Upload zone -->
                <div
                  class="border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer"
                  :class="isDragging ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="onDrop"
                  @click="fileInputRef?.click()"
                >
                  <input
                    ref="fileInputRef"
                    type="file"
                    :accept="fileAccept"
                    multiple
                    hidden
                    @change="onFileSelect"
                  />
                  <div class="flex items-center justify-center gap-2 text-sm">
                    <IconUpload class="w-4 h-4 text-gray-400" />
                    <span class="text-gray-500">Drop files or <span class="text-orange-500 font-medium">browse</span></span>
                  </div>
                </div>

                <!-- Upload progress -->
                <div v-if="activeUploads.length > 0" class="space-y-2">
                  <div
                    v-for="upload in activeUploads"
                    :key="upload.name"
                    class="flex items-center gap-3 bg-orange-50 rounded-lg px-3 py-2"
                  >
                    <IconLoader class="w-4 h-4 animate-spin text-orange-500 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-medium text-gray-700 truncate">{{ upload.name }}</p>
                      <div class="w-full bg-orange-100 rounded-full h-1 mt-1">
                        <div class="bg-orange-500 h-1 rounded-full transition-all" :style="{ width: upload.progress + '%' }"></div>
                      </div>
                    </div>
                    <span class="text-xs text-orange-600 font-medium">{{ Math.round(upload.progress) }}%</span>
                  </div>
                </div>

                <!-- Filter chips + search -->
                <div v-if="counts.all > 0" class="flex items-center gap-2 flex-wrap">
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button
                      v-for="ft in [
                        { key: 'all', label: 'All', count: counts.all },
                        { key: 'image', label: 'Images', count: counts.image },
                        { key: 'video', label: 'Video', count: counts.video },
                        { key: 'audio', label: 'Audio', count: counts.audio }
                      ].filter(f => f.count > 0 || f.key === 'all')"
                      :key="ft.key"
                      @click="localFilter = ft.key"
                      :class="[
                        'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                        localFilter === ft.key
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      ]"
                    >
                      {{ ft.label }}
                    </button>
                  </div>
                  <div class="flex-1 min-w-[120px]">
                    <div class="relative">
                      <IconSearch class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search..."
                        class="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-orange-400"
                      />
                    </div>
                  </div>
                </div>

                <!-- Files grid -->
                <div v-if="displayFiles.length > 0" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <div
                    v-for="file in displayFiles"
                    :key="file.hash"
                    @click="selectFile(file)"
                    class="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all group"
                    :class="selectedFile?.hash === file.hash
                      ? 'border-orange-500 ring-2 ring-orange-200'
                      : 'border-transparent hover:border-orange-300'"
                  >
                    <!-- Image thumbnail -->
                    <img
                      v-if="isImage(file)"
                      :src="file.url"
                      :alt="file.hash"
                      loading="lazy"
                      class="w-full h-full object-cover"
                    />
                    <!-- Video placeholder -->
                    <div v-else-if="isVideo(file)" class="w-full h-full bg-gray-100 flex items-center justify-center">
                      <IconPlayerPlay class="w-8 h-8 text-gray-400" />
                    </div>
                    <!-- Audio placeholder -->
                    <div v-else-if="isAudio(file)" class="w-full h-full bg-gray-100 flex items-center justify-center">
                      <IconMusic class="w-8 h-8 text-gray-400" />
                    </div>
                    <!-- Generic -->
                    <div v-else class="w-full h-full bg-gray-100 flex items-center justify-center">
                      <IconPhoto class="w-8 h-8 text-gray-400" />
                    </div>

                    <!-- Type badge -->
                    <span class="absolute top-1 right-1 px-1 py-0.5 bg-black/60 text-white text-[9px] font-bold rounded backdrop-blur-sm">
                      {{ fileExtension(file) }}
                    </span>

                    <!-- Size label -->
                    <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3">
                      <span class="text-[10px] text-white/90 font-medium">{{ formatSize(file.size) }}</span>
                    </div>

                    <!-- Selected checkmark -->
                    <div
                      v-if="selectedFile?.hash === file.hash"
                      class="absolute inset-0 bg-orange-500/20 flex items-center justify-center"
                    >
                      <div class="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                        <IconCheck class="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Loading state -->
                <div v-else-if="mediaLoading" class="py-12 text-center">
                  <IconLoader class="w-6 h-6 animate-spin text-orange-500 mx-auto mb-2" />
                  <p class="text-sm text-gray-500">Loading media library...</p>
                </div>

                <!-- Empty state -->
                <div v-else class="py-12 text-center">
                  <IconPhoto class="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p class="text-sm text-gray-500 mb-1">
                    {{ searchQuery ? 'No files match your search' : 'No media files yet' }}
                  </p>
                  <p class="text-xs text-gray-400">Upload files above to get started</p>
                </div>
              </div>

              <!-- URL Tab -->
              <div v-if="activeTab === 'url'" class="p-5 space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Media URL</label>
                  <input
                    v-model="urlInput"
                    type="url"
                    placeholder="https://example.com/media.jpg"
                    class="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-sm"
                    @keyup.enter="insertFromUrl"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">Description <span class="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    v-model="altInput"
                    type="text"
                    placeholder="Describe the media"
                    class="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-sm"
                    @keyup.enter="insertFromUrl"
                  />
                </div>

                <!-- URL Preview -->
                <div v-if="urlInput.trim()" class="rounded-xl border border-gray-200 overflow-hidden">
                  <img
                    v-if="urlInput.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)/i)"
                    :src="urlInput"
                    class="w-full max-h-48 object-contain bg-gray-50"
                    @error="() => {}"
                  />
                  <div v-else class="py-6 flex items-center justify-center bg-gray-50">
                    <IconLink class="w-6 h-6 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex-shrink-0 border-t border-gray-200 px-5 py-3 bg-gray-50/80 safe-bottom">
              <div class="flex items-center justify-between gap-3">
                <!-- Selected file info -->
                <div v-if="activeTab === 'library' && selectedFile" class="flex-1 min-w-0">
                  <p class="text-xs text-gray-500 truncate">
                    {{ selectedFile.type }} · {{ formatSize(selectedFile.size) }}
                  </p>
                </div>
                <div v-else class="flex-1"></div>

                <div class="flex items-center gap-2">
                  <button
                    @click="$emit('close')"
                    class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>

                  <!-- Insert button -->
                  <button
                    v-if="activeTab === 'library'"
                    @click="confirmSelection"
                    :disabled="!selectedFile"
                    class="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white font-medium text-sm transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-[0.97]"
                  >
                    <IconCheck class="w-4 h-4" />
                    Insert
                  </button>
                  <button
                    v-else
                    @click="insertFromUrl"
                    :disabled="!urlInput.trim()"
                    class="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white font-medium text-sm transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-[0.97]"
                  >
                    <IconCheck class="w-4 h-4" />
                    Insert
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
