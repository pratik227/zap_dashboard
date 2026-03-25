<script setup>
import { ref, computed, watch, toRef } from 'vue'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import {
  IconX,
  IconAward,
  IconUser,
  IconCalendar,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconHash,
  IconPhoto
} from '@iconify-prerendered/vue-tabler'
import { nip19 } from '../../services/nostr/nostrImports.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

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

const badgeModalRoot = ref(null)
useFocusTrap(toRef(props, 'show'), badgeModalRoot)

// Local state
const copySuccess = ref('')
const issuerProfile = ref(null)
const loadingIssuer = ref(false)

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

  if (definition.image) return definition.image

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

const issuerDisplayName = computed(() => {
  if (issuerProfile.value?.name) return issuerProfile.value.name
  if (issuerProfile.value?.display_name) return issuerProfile.value.display_name
  if (!issuerNpub.value) return 'Unknown'
  return `${issuerNpub.value.substring(0, 12)}...`
})

const issuerAvatar = computed(() => {
  if (issuerProfile.value?.picture) return issuerProfile.value.picture
  if (badgeDefinition.value?.pubkey) return generateAvatar(badgeDefinition.value.pubkey)
  return null
})

const createdDate = computed(() => {
  if (!badgeDefinition.value?.created_at) return null
  return new Date(badgeDefinition.value.created_at * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
})

const badgeSlug = computed(() => badgeDefinition.value?.d || null)

const badgeRef = computed(() => {
  if (!badgeDefinition.value) return null
  return `30009:${badgeDefinition.value.pubkey}:${badgeDefinition.value.d}`
})

const njumpUrl = computed(() => {
  if (!badgeDefinition.value?.pubkey || !badgeDefinition.value?.d) return null
  try {
    const naddr = nip19.naddrEncode({
      identifier: badgeDefinition.value.d,
      pubkey: badgeDefinition.value.pubkey,
      kind: 30009
    })
    return `https://njump.me/${naddr}`
  } catch {
    return null
  }
})

// Methods
const loadIssuerProfile = async () => {
  const pubkey = badgeDefinition.value?.pubkey
  if (!pubkey || loadingIssuer.value) return

  loadingIssuer.value = true
  try {
    const profile = await profileService.get(pubkey)
    if (profile) issuerProfile.value = profile
  } catch {
    // Silently fail — we still show npub fallback
  } finally {
    loadingIssuer.value = false
  }
}

const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => { copySuccess.value = '' }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const closeModal = () => {
  emit('close')
}

const openIssuerProfile = () => {
  if (issuerNpub.value) {
    window.open(`https://primal.net/p/${issuerNpub.value}`, '_blank', 'noopener,noreferrer')
  }
}

const openNjump = () => {
  if (njumpUrl.value) {
    window.open(njumpUrl.value, '_blank', 'noopener,noreferrer')
  }
}

const openBadgeBox = () => {
  window.open('https://badgebox.rinbal.de', '_blank', 'noopener,noreferrer')
}

// Load issuer profile when modal opens; reset stale state
watch(() => props.show, (newValue) => {
  if (newValue) {
    issuerProfile.value = null
    loadIssuerProfile()
  } else {
    copySuccess.value = ''
  }
})
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show && badge && badgeDefinition" ref="badgeModalRoot" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4" @click.self="closeModal" @keydown.escape="closeModal" tabindex="-1">
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
            <div v-if="badgeDefinition?.description">
              <h4 class="font-semibold text-gray-900 mb-2">Description</h4>
              <p class="text-gray-700 leading-relaxed">{{ displayDescription }}</p>
            </div>

            <!-- Badge Details -->
            <div class="space-y-3">
              <h4 class="font-semibold text-gray-900">Badge Details</h4>

              <!-- Issuer with profile -->
              <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <div v-if="issuerAvatar" class="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                    <img :src="issuerAvatar" :alt="issuerDisplayName" class="w-full h-full object-cover" />
                  </div>
                  <IconUser v-else class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Issued by</span>
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-sm text-gray-600">{{ issuerDisplayName }}</span>
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

              <!-- Badge Slug / Identifier -->
              <div v-if="badgeSlug" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconHash class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Identifier</span>
                </div>
                <code class="text-sm text-gray-600 font-mono">{{ badgeSlug }}</code>
              </div>

              <!-- Created Date -->
              <div v-if="createdDate" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconCalendar class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Created</span>
                </div>
                <span class="text-sm text-gray-600">{{ createdDate }}</span>
              </div>

              <!-- Image Dimensions -->
              <div v-if="badgeDefinition.imageSize" class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-2">
                  <IconPhoto class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Image Size</span>
                </div>
                <span class="text-sm text-gray-600">{{ badgeDefinition.imageSize }}</span>
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
            <div v-if="badgeDefinition.thumbnails && badgeDefinition.thumbnails.length > 0" class="space-y-3">
              <h4 class="font-semibold text-gray-900">Available Sizes <span class="text-sm font-normal text-gray-500">({{ badgeDefinition.thumbnails.length }})</span></h4>
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

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-2">
              <button
                v-if="njumpUrl"
                @click="openNjump"
                class="flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
              >
                <IconExternalLink class="w-4 h-4" />
                <span>View on njump</span>
              </button>
              <button
                @click="openBadgeBox"
                class="flex items-center space-x-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors"
              >
                <IconAward class="w-4 h-4" />
                <span>BadgeBox</span>
              </button>
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
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: opacity 0.3s ease;
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

.touch-target {
  min-width: 44px;
  min-height: 44px;
}
</style>
