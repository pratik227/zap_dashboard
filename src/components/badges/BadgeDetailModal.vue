<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconX, 
  IconAward, 
  IconUser,
  IconCalendar,
  IconExternalLink,
  IconCopy,
  IconCheck
} from '@iconify-prerendered/vue-tabler'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  badge: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

// Local state
const copySuccess = ref('')

// Computed properties
const badgeDefinition = computed(() => props.badge?.definition)

const displayName = computed(() => {
  return badgeDefinition.value?.name || 
         badgeDefinition.value?.d || 
         'Unknown Badge'
})

const displayDescription = computed(() => {
  return badgeDefinition.value?.description || 'No description available'
})

const badgeImage = computed(() => {
  const definition = badgeDefinition.value
  if (!definition) return null

  // Try to get the highest resolution image
  if (definition.image) {
    return definition.image
  }

  // Fallback to largest thumbnail
  if (definition.thumbnails && definition.thumbnails.length > 0) {
    const sortedThumbnails = [...definition.thumbnails].sort((a, b) => {
      const aSize = parseInt(a.size?.split('x')[0] || '0')
      const bSize = parseInt(b.size?.split('x')[0] || '0')
      return bSize - aSize
    })
    return sortedThumbnails[0].url
  }

  return null
})

const issuerNpub = computed(() => {
  if (!badgeDefinition.value?.pubkey) return null
  try {
    return nip19.npubEncode(badgeDefinition.value.pubkey)
  } catch {
    return null
  }
})

const issuerShort = computed(() => {
  if (!issuerNpub.value) return 'Unknown'
  return `${issuerNpub.value.substring(0, 12)}...`
})

const createdDate = computed(() => {
  if (!badgeDefinition.value?.created_at) return null
  return new Date(badgeDefinition.value.created_at * 1000).toLocaleDateString()
})

const badgeRef = computed(() => {
  if (!badgeDefinition.value) return null
  return `30009:${badgeDefinition.value.pubkey}:${badgeDefinition.value.d}`
})

// Methods
const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const closeModal = () => {
  emit('close')
}

const openIssuerProfile = () => {
  if (issuerNpub.value) {
    const url = `https://primal.net/p/${issuerNpub.value}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// Reset state when modal is closed
watch(() => props.show, (newValue) => {
  if (!newValue) {
    copySuccess.value = ''
  }
})
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show && badge && badgeDefinition" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
          <!-- Header -->
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-orange-200">
                  <img 
                    v-if="badgeImage"
                    :src="badgeImage" 
                    :alt="displayName"
                    class="w-full h-full object-cover"
                    @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
                  />
                  <div 
                    class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center"
                    :style="{ display: badgeImage ? 'none' : 'flex' }"
                  >
                    <IconAward class="w-8 h-8 text-white" />
                  </div>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-gray-900">{{ displayName }}</h3>
                  <p class="text-sm text-gray-600">NIP-58 Badge</p>
                </div>
              </div>
              <button
                @click="closeModal"
                class="touch-target text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors flex items-center justify-center"
                title="Close"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-6">
            <!-- Description -->
            <div v-if="displayDescription">
              <h4 class="font-semibold text-gray-900 mb-2">Description</h4>
              <p class="text-gray-700 leading-relaxed">{{ displayDescription }}</p>
            </div>

            <!-- Badge Details -->
            <div class="space-y-4">
              <h4 class="font-semibold text-gray-900">Badge Details</h4>
              
              <!-- Issuer -->
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconUser class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Issued by</span>
                </div>
                <div class="flex items-center space-x-2">
                  <code class="text-xs text-gray-600 font-mono">{{ issuerShort }}</code>
                  <button
                    v-if="issuerNpub"
                    @click="copyToClipboard(issuerNpub, 'issuer')"
                    class="p-1 text-gray-400 hover:text-orange-600 rounded transition-colors"
                    title="Copy issuer npub"
                  >
                    <IconCheck v-if="copySuccess === 'issuer'" class="w-3 h-3 text-green-600" />
                    <IconCopy v-else class="w-3 h-3" />
                  </button>
                  <button
                    @click="openIssuerProfile"
                    class="p-1 text-gray-400 hover:text-orange-600 rounded transition-colors"
                    title="View issuer profile"
                  >
                    <IconExternalLink class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- Created Date -->
              <div v-if="createdDate" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconCalendar class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Created</span>
                </div>
                <span class="text-sm text-gray-600">{{ createdDate }}</span>
              </div>

              <!-- Badge Reference -->
              <div v-if="badgeRef" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconAward class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Badge ID</span>
                </div>
                <div class="flex items-center space-x-2">
                  <code class="text-xs text-gray-600 font-mono">{{ badgeRef.substring(0, 20) }}...</code>
                  <button
                    @click="copyToClipboard(badgeRef, 'badge')"
                    class="p-1 text-gray-400 hover:text-orange-600 rounded transition-colors"
                    title="Copy badge reference"
                  >
                    <IconCheck v-if="copySuccess === 'badge'" class="w-3 h-3 text-green-600" />
                    <IconCopy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Thumbnails -->
            <div v-if="badgeDefinition.thumbnails && badgeDefinition.thumbnails.length > 0" class="space-y-4">
              <h4 class="font-semibold text-gray-900">Available Sizes</h4>
              <div class="grid grid-cols-4 gap-3">
                <div 
                  v-for="thumbnail in badgeDefinition.thumbnails" 
                  :key="thumbnail.url"
                  class="text-center"
                >
                  <div class="w-12 h-12 mx-auto rounded-lg overflow-hidden border border-gray-200 mb-1">
                    <img 
                      :src="thumbnail.url" 
                      :alt="`${displayName} ${thumbnail.size}`"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <span class="text-xs text-gray-500">{{ thumbnail.size || 'Unknown' }}</span>
                </div>
              </div>
            </div>

            <!-- Info Box -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex items-start space-x-3">
                <IconAward class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-medium text-blue-900 mb-1">About NIP-58 Badges</h4>
                  <p class="text-sm text-blue-800">
                    This badge follows the NIP-58 standard for Nostr badges. It represents community recognition 
                    and can be awarded by trusted members of the Nostr ecosystem.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Modal transition */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: opacity 0.3s ease;
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

/* Touch target for better mobile UX */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* Smooth transitions */
.transition-colors {
  transition-property: color, border-color, background-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}
</style>
