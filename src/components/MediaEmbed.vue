<template>
  <div class="media-embed">
    <div v-if="mediaType === 'image'" class="image-embed">
      <div class="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
        <img
          :src="url"
          :alt="alt || 'Embedded image'"
          class="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
          @click="openFullscreen"
          @error="handleImageError"
          @load="handleImageLoad"
        />
        
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
        
        <div v-if="hasError" class="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div class="text-center text-gray-500">
            <IconPhoto class="w-8 h-8 mx-auto mb-2" />
            <p class="text-sm">Failed to load image</p>
          </div>
        </div>
        
        <div v-if="!isLoading && !hasError" class="absolute top-2 right-2 bg-black/50 text-white p-1 rounded opacity-0 hover:opacity-100 transition-opacity">
          <IconMaximize class="w-4 h-4" />
        </div>
      </div>
      
      <div class="mt-2 text-xs text-gray-500 break-all">
        <a :href="url" target="_blank" rel="noopener noreferrer" class="hover:text-orange-600 transition-colors">
          {{ truncateUrl(url) }}
        </a>
      </div>
    </div>

    <div v-else-if="mediaType === 'video'" class="video-embed">
      <div class="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-900">
        <video
          :src="url"
          controls
          preload="metadata"
          class="w-full h-auto max-h-96"
          @error="handleVideoError"
          @loadedmetadata="handleVideoLoad"
        >
          Your browser does not support the video tag.
        </video>
        
        <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
        
        <div v-if="hasError" class="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div class="text-center text-white">
            <IconVideo class="w-8 h-8 mx-auto mb-2" />
            <p class="text-sm">Failed to load video</p>
          </div>
        </div>
      </div>
      
      <div class="mt-2 text-xs text-gray-500 break-all">
        <a :href="url" target="_blank" rel="noopener noreferrer" class="hover:text-orange-600 transition-colors">
          {{ truncateUrl(url) }}
        </a>
      </div>
    </div>

    <div v-else-if="mediaType === 'audio'" class="audio-embed">
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div class="flex items-center space-x-3 mb-3">
          <IconMusic class="w-6 h-6 text-orange-600" />
          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">Audio File</p>
            <p class="text-xs text-gray-500 break-all">{{ truncateUrl(url) }}</p>
          </div>
        </div>
        
        <audio
          :src="url"
          controls
          preload="metadata"
          class="w-full"
          @error="handleAudioError"
          @loadedmetadata="handleAudioLoad"
        >
          Your browser does not support the audio tag.
        </audio>
        
        <div v-if="hasError" class="text-center text-red-500 mt-2">
          <IconAlertCircle class="w-4 h-4 mx-auto mb-1" />
          <p class="text-xs">Failed to load audio</p>
        </div>
      </div>
    </div>

    <div v-else class="url-embed">
      <a 
        :href="url" 
        target="_blank" 
        rel="noopener noreferrer"
        class="inline-flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800 hover:text-blue-900 transition-colors"
      >
        <IconLink class="w-4 h-4" />
        <span>{{ truncateUrl(url) }}</span>
        <IconExternalLink class="w-3 h-3" />
      </a>
    </div>

    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showFullscreen" class="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" @click="closeFullscreen">
          <div class="relative max-w-full max-h-full">
            <img
              :src="url"
              :alt="alt || 'Fullscreen image'"
              class="max-w-full max-h-full object-contain"
              @click.stop
            />
            <button
              @click="closeFullscreen"
              class="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            >
              <IconX class="w-6 h-6" />
            </button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  IconPhoto, 
  IconVideo, 
  IconMusic, 
  IconLink, 
  IconExternalLink, 
  IconMaximize, 
  IconX,
  IconAlertCircle
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  url: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    required: true,
    validator: (value) => ['image', 'video', 'audio', 'url'].includes(value)
  },
  alt: {
    type: String,
    default: null
  },
  maxWidth: {
    type: String,
    default: '100%'
  }
})

const isLoading = ref(true)
const hasError = ref(false)
const showFullscreen = ref(false)

const truncateUrl = (url) => {
  if (!url) return ''
  if (url.length <= 50) return url
  
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const path = urlObj.pathname + urlObj.search
    
    if (path.length <= 20) {
      return `${domain}${path}`
    }
    
    return `${domain}${path.substring(0, 20)}...`
  } catch {
    return url.substring(0, 47) + '...'
  }
}

const handleImageLoad = () => {
  isLoading.value = false
  hasError.value = false
}

const handleImageError = () => {
  isLoading.value = false
  hasError.value = true
}

const handleVideoLoad = () => {
  isLoading.value = false
  hasError.value = false
}

const handleVideoError = () => {
  isLoading.value = false
  hasError.value = true
}

const handleAudioLoad = () => {
  isLoading.value = false
  hasError.value = false
}

const handleAudioError = () => {
  isLoading.value = false
  hasError.value = true
}

const openFullscreen = () => {
  if (props.mediaType === 'image' && !hasError.value) {
    showFullscreen.value = true
  }
}

const closeFullscreen = () => {
  showFullscreen.value = false
}

const handleKeydown = (event) => {
  if (event.key === 'Escape' && showFullscreen.value) {
    closeFullscreen()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  
  if (props.mediaType === 'url') {
    isLoading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: opacity 0.3s ease;
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

video, img {
  max-width: 100%;
  height: auto;
}

audio::-webkit-media-controls-panel {
  background-color: #f3f4f6;
}
</style>
