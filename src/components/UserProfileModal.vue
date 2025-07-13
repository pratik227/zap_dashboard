<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconX, 
  IconKey, 
  IconBolt, 
  IconGlobe,
  IconUser,
  IconCheck,
  IconCopy,
  IconExternalLink
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  userProfileData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

// Local state
const activeTab = ref('publickey')
const copySuccess = ref('')

// Get user avatar with fallback
const getUserAvatar = computed(() => {
  if (props.userProfileData?.profile?.picture) {
    return props.userProfileData.profile.picture
  }
  // Fallback to default avatar
  return generateFallbackAvatar(props.userProfileData?.pubkey)
})

// Generate a fallback avatar based on pubkey
const generateFallbackAvatar = (pubkey) => {
  if (!pubkey) return 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  
  // Use a deterministic approach to generate avatar based on pubkey
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  // Create a hash from the pubkey to consistently select an avatar
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Copy to clipboard with feedback
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

// Format npub
const formatNpub = (pubkey) => {
  try {
    return nip19.npubEncode(pubkey)
  } catch (error) {
    return pubkey
  }
}

// Format pubkey for display
const formatPubkey = (pubkey) => {
  if (!pubkey) return ''
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}

// Close modal
const closeModal = () => {
  emit('close')
}

// Reset state when modal is closed
watch(() => props.show, (newValue) => {
  if (!newValue) {
    activeTab.value = 'publickey'
    copySuccess.value = ''
  }
})
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="show && userProfileData" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
          <!-- Header -->
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="relative w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                  <img 
                    v-if="userProfileData.profile?.picture"
                    :src="userProfileData.profile.picture" 
                    :alt="userProfileData.profile?.name || 'User'"
                    class="w-full h-full object-cover"
                    @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
                  />
                  <div 
                    class="w-full h-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center"
                    :style="{ display: userProfileData.profile?.picture ? 'none' : 'flex' }"
                  >
                    <IconUser class="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">
                    {{ userProfileData.profile?.name || formatPubkey(userProfileData.pubkey) }}
                  </h3>
                  <p v-if="userProfileData.profile?.about" class="text-sm text-gray-600 line-clamp-2">
                    {{ userProfileData.profile.about }}
                  </p>
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

          <!-- Tab Navigation -->
          <div class="border-b border-gray-200">
            <nav class="flex">
              <button
                @click="activeTab = 'publickey'"
                :class="[
                  'flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'publickey'
                    ? 'border-orange-400 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                <div class="flex items-center justify-center space-x-2">
                  <IconKey class="w-4 h-4" />
                  <span>Public key</span>
                </div>
              </button>
              <button
                v-if="userProfileData.profile?.lud16"
                @click="activeTab = 'lightning'"
                :class="[
                  'flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === 'lightning'
                    ? 'border-orange-400 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                <div class="flex items-center justify-center space-x-2">
                  <IconBolt class="w-4 h-4" />
                  <span>Lightning address</span>
                </div>
              </button>
            </nav>
          </div>

          <!-- Tab Content -->
          <div class="p-6">
            <!-- Public Key Tab -->
            <div v-if="activeTab === 'publickey'" class="space-y-6">
              <!-- QR Code -->
              <div class="text-center">
                <div class="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
                  <QRCodeVue3
                    :value="formatNpub(userProfileData.pubkey)"
                    :size="200"
                    color="#000000"
                    background-color="#ffffff"
                    error-correction-level="M"
                  />
                </div>
              </div>

              <!-- Public Key String -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Public key:</label>
                <div class="bg-gray-50 p-3 rounded-lg border">
                  <div class="flex items-center justify-between">
                    <code class="text-xs text-gray-600 break-all font-mono flex-1 mr-3">
                      {{ formatNpub(userProfileData.pubkey) }}
                    </code>
                    <button
                      @click="copyToClipboard(formatNpub(userProfileData.pubkey), 'publickey')"
                      class="touch-target p-2 text-gray-400 hover:text-orange-600 rounded-lg transition-colors flex-shrink-0"
                      title="Copy public key"
                    >
                      <IconCheck v-if="copySuccess === 'publickey'" class="w-4 h-4 text-green-600" />
                      <IconCopy v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Lightning Address Tab -->
            <div v-if="activeTab === 'lightning' && userProfileData.profile?.lud16" class="space-y-6">
              <!-- QR Code -->
              <div class="text-center">
                <div class="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block mb-4">
                  <QRCodeVue3
                    :value="userProfileData.profile.lud16"
                    :size="200"
                    color="#000000"
                    background-color="#ffffff"
                    error-correction-level="M"
                  />
                </div>
              </div>

              <!-- Lightning Address String -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Lightning address:</label>
                <div class="bg-gray-50 p-3 rounded-lg border">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 flex-1 mr-3">
                      <IconBolt class="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <code class="text-sm text-gray-600 break-all font-mono">
                        {{ userProfileData.profile.lud16 }}
                      </code>
                    </div>
                    <button
                      @click="copyToClipboard(userProfileData.profile.lud16, 'lightning')"
                      class="touch-target p-2 text-gray-400 hover:text-orange-600 rounded-lg transition-colors flex-shrink-0"
                      title="Copy Lightning address"
                    >
                      <IconCheck v-if="copySuccess === 'lightning'" class="w-4 h-4 text-green-600" />
                      <IconCopy v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Lightning Address Info -->
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div class="flex items-start space-x-3">
                  <IconBolt class="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 class="font-medium text-yellow-900 mb-1">Lightning Address</h4>
                    <p class="text-sm text-yellow-800">
                      This is a Lightning payment address. You can send Bitcoin payments instantly to this address.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Lightning Address Message -->
            <div v-if="activeTab === 'lightning' && !userProfileData.profile?.lud16" class="text-center py-8">
              <IconBolt class="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <h4 class="text-lg font-medium text-gray-900 mb-2">No Lightning Address</h4>
              <p class="text-gray-600 text-sm">This user hasn't set up a Lightning address yet.</p>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>