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
  IconChevronDown,
  IconHash,
  IconPhoto
} from '@iconify-prerendered/vue-tabler'
import { nip19 } from '../../services/nostr/nostrImports.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  badge: { type: Object, default: null }
})

const emit = defineEmits(['close'])

const badgeModalRoot = ref(null)
useFocusTrap(toRef(props, 'show'), badgeModalRoot)

const copySuccess = ref('')
const issuerProfile = ref(null)
const loadingIssuer = ref(false)
const showAdvanced = ref(false)

// ── Computed ──────────────────────────────────────────────────
const badgeDefinition = computed(() => props.badge?.definition)

const displayName = computed(() =>
  badgeDefinition.value?.name || badgeDefinition.value?.d || 'Unknown Badge'
)

const displayDescription = computed(() =>
  badgeDefinition.value?.description || ''
)

const badgeImage = computed(() => {
  const def = badgeDefinition.value
  if (!def) return null
  if (def.image) return def.image
  if (def.thumbnails?.length > 0) {
    const sorted = [...def.thumbnails].sort((a, b) => {
      return parseInt(b.size?.split('x')[0] || '0') - parseInt(a.size?.split('x')[0] || '0')
    })
    return sorted[0].url
  }
  return null
})

const issuerNpub = computed(() => {
  if (!badgeDefinition.value?.pubkey) return null
  try { return nip19.npubEncode(badgeDefinition.value.pubkey) } catch { return null }
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

const naddrString = computed(() => {
  if (!badgeDefinition.value?.pubkey || !badgeDefinition.value?.d) return null
  try {
    return nip19.naddrEncode({
      identifier: badgeDefinition.value.d,
      pubkey: badgeDefinition.value.pubkey,
      kind: 30009
    })
  } catch { return null }
})

const njumpUrl = computed(() => {
  if (!naddrString.value) return null
  return `https://njump.me/${naddrString.value}`
})

// ── Methods ───────────────────────────────────────────────────
const loadIssuerProfile = async () => {
  const pubkey = badgeDefinition.value?.pubkey
  if (!pubkey || loadingIssuer.value) return

  loadingIssuer.value = true
  try {
    const profile = await profileService.get(pubkey)
    if (profile) issuerProfile.value = profile
  } catch { /* keep npub fallback */ }
  finally { loadingIssuer.value = false }
}

const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => { copySuccess.value = '' }, 2000)
  } catch { /* silent */ }
}

const closeModal = () => emit('close')

const openIssuerProfile = () => {
  if (issuerNpub.value) {
    window.open(`https://primal.net/p/${issuerNpub.value}`, '_blank', 'noopener,noreferrer')
  }
}

const openNjump = () => {
  if (njumpUrl.value) window.open(njumpUrl.value, '_blank', 'noopener,noreferrer')
}

// ── Lifecycle ─────────────────────────────────────────────────
watch(() => props.show, (visible) => {
  if (visible) {
    issuerProfile.value = null
    showAdvanced.value = false
    loadIssuerProfile()
  } else {
    copySuccess.value = ''
  }
})
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div
        v-if="show && badge && badgeDefinition"
        ref="badgeModalRoot"
        class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4"
        @click.self="closeModal"
        @keydown.escape="closeModal"
        tabindex="-1"
      >
        <div class="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">

          <!-- ═══════ Header: badge image + name ═══════ -->
          <div class="p-6 pb-4">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <!-- Badge image — raw, no forced rounding -->
                <div class="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                  <img
                    v-if="badgeImage"
                    :src="badgeImage"
                    :alt="displayName"
                    class="max-w-full max-h-full object-contain"
                  />
                  <div
                    v-else
                    class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center"
                  >
                    <IconAward class="w-10 h-10 text-white" />
                  </div>
                </div>
                <div class="min-w-0">
                  <h3 class="text-xl font-bold text-gray-900 leading-snug">{{ displayName }}</h3>
                  <p class="text-sm text-gray-500 mt-0.5">NIP-58 Badge</p>
                </div>
              </div>
              <button
                @click="closeModal"
                class="touch-target text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors flex items-center justify-center flex-shrink-0"
                aria-label="Close"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- ═══════ Mainstream info (always visible) ═══════ -->
          <div class="px-6 pb-4 space-y-4">

            <!-- Description -->
            <p v-if="displayDescription" class="text-gray-700 leading-relaxed text-[15px]">
              {{ displayDescription }}
            </p>

            <!-- Issuer -->
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div class="flex items-center gap-2.5">
                <div v-if="issuerAvatar" class="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                  <img :src="issuerAvatar" :alt="issuerDisplayName" class="w-full h-full object-cover" />
                </div>
                <IconUser v-else class="w-4 h-4 text-gray-500" />
                <div>
                  <p class="text-[11px] text-gray-400 font-medium leading-none mb-0.5">Issued by</p>
                  <p class="text-sm font-medium text-gray-700">{{ issuerDisplayName }}</p>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <button
                  v-if="issuerNpub"
                  @click="copyToClipboard(issuerNpub, 'issuer')"
                  class="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg transition-colors"
                  title="Copy issuer npub"
                >
                  <IconCheck v-if="copySuccess === 'issuer'" class="w-3.5 h-3.5 text-green-600" />
                  <IconCopy v-else class="w-3.5 h-3.5" />
                </button>
                <button
                  @click="openIssuerProfile"
                  class="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg transition-colors"
                  title="View profile"
                >
                  <IconExternalLink class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Created date -->
            <div v-if="createdDate" class="flex items-center gap-2 px-1 text-sm text-gray-500">
              <IconCalendar class="w-4 h-4 text-gray-400" />
              <span>Created {{ createdDate }}</span>
            </div>
          </div>

          <!-- ═══════ Advanced section (collapsible) ═══════ -->
          <div class="px-6 pb-4">
            <button
              @click="showAdvanced = !showAdvanced"
              class="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>Technical details</span>
              <IconChevronDown
                class="w-4 h-4 transition-transform duration-200"
                :class="showAdvanced ? 'rotate-180' : ''"
              />
            </button>

            <transition name="advanced-expand">
              <div v-if="showAdvanced" class="space-y-2 pt-1 overflow-hidden">

                <!-- Identifier -->
                <div v-if="badgeSlug" class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div class="flex items-center gap-2">
                    <IconHash class="w-4 h-4 text-gray-400" />
                    <span class="text-sm text-gray-600">Identifier</span>
                  </div>
                  <code class="text-sm text-gray-700 font-mono">{{ badgeSlug }}</code>
                </div>

                <!-- Badge reference -->
                <div v-if="badgeRef" class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div class="flex items-center gap-2">
                    <IconAward class="w-4 h-4 text-gray-400" />
                    <span class="text-sm text-gray-600">Badge ref</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <code class="text-xs text-gray-600 font-mono truncate max-w-[140px]">{{ badgeRef }}</code>
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

                <!-- naddr -->
                <div v-if="naddrString" class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div class="flex items-center gap-2">
                    <IconExternalLink class="w-4 h-4 text-gray-400" />
                    <span class="text-sm text-gray-600">naddr</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <code class="text-xs text-gray-600 font-mono truncate max-w-[140px]">{{ naddrString.substring(0, 20) }}...</code>
                    <button
                      @click="copyToClipboard(naddrString, 'naddr')"
                      class="p-1 text-gray-400 hover:text-orange-600 rounded transition-colors"
                      title="Copy naddr"
                    >
                      <IconCheck v-if="copySuccess === 'naddr'" class="w-3 h-3 text-green-600" />
                      <IconCopy v-else class="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <!-- Image dimensions -->
                <div v-if="badgeDefinition.imageSize" class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div class="flex items-center gap-2">
                    <IconPhoto class="w-4 h-4 text-gray-400" />
                    <span class="text-sm text-gray-600">Image size</span>
                  </div>
                  <span class="text-sm text-gray-700">{{ badgeDefinition.imageSize }}</span>
                </div>

                <!-- Thumbnails -->
                <div v-if="badgeDefinition.thumbnails?.length > 0" class="pt-2">
                  <p class="text-sm text-gray-600 mb-2">Available sizes ({{ badgeDefinition.thumbnails.length }})</p>
                  <div class="flex flex-wrap gap-3">
                    <div
                      v-for="thumb in badgeDefinition.thumbnails"
                      :key="thumb.url"
                      class="text-center"
                    >
                      <div class="w-12 h-12 mx-auto mb-1 flex items-center justify-center">
                        <img :src="thumb.url" :alt="`${displayName} ${thumb.size}`" class="max-w-full max-h-full object-contain" />
                      </div>
                      <span class="text-[10px] text-gray-400">{{ thumb.size || '?' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>

          <!-- ═══════ Action buttons ═══════ -->
          <div class="px-6 pb-6 flex flex-wrap gap-2">
            <button
              v-if="njumpUrl"
              @click="openNjump"
              class="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition-colors"
            >
              <IconExternalLink class="w-4 h-4" />
              View on njump
            </button>
            <a
              href="https://badgebox.rinbal.de"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors"
            >
              <IconAward class="w-4 h-4" />
              BadgeBox
            </a>
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
.advanced-expand-enter-active {
  transition: all 0.25s ease-out;
}
.advanced-expand-leave-active {
  transition: all 0.15s ease-in;
}
.advanced-expand-enter-from,
.advanced-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.advanced-expand-enter-to,
.advanced-expand-leave-from {
  max-height: 500px;
}
.touch-target {
  min-width: 44px;
  min-height: 44px;
}
</style>
