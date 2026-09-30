<script setup>
/**
 * UserProfileModal — Premium profile sheet.
 *
 * Layout: banner → overlapping avatar → identity → badges → address cards with QR.
 * Fetches fresh profile data on open. Awaits badge definitions before showing.
 */
import { ref, computed, watch, toRef } from 'vue'
import {
  IconX,
  IconKey,
  IconBolt,
  IconCopy,
  IconCheck,
  IconQrcode,
  IconShield,
  IconExternalLink
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { nip19 } from '../../services/nostr/nostrImports.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import { useBadges } from '../../composables/social/useBadges.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import BadgeList from '../badges/BadgeList.vue'
import BadgeDetailModal from '../badges/BadgeDetailModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  userProfileData: { type: Object, default: null }
})

const emit = defineEmits(['close'])

// ── Focus trap ────────────────────────────────────────────────
const modalRef = ref(null)
useFocusTrap(toRef(props, 'show'), modalRef)

// ── Profile data (locally managed for fresh fetch) ────────────
const liveProfile = ref(null)
const profileLoading = ref(false)

const profile = computed(() => liveProfile.value || props.userProfileData?.profile || {})
const pubkey = computed(() => props.userProfileData?.pubkey || '')

// ── Badges ────────────────────────────────────────────────────
const { initUserBadges, getUserBadges } = useBadges()
const showBadgeDetail = ref(false)
const selectedBadge = ref(null)
const badgesLoading = ref(false)
const badgesLoaded = ref(false)

const badges = computed(() => {
  if (!pubkey.value) return []
  return getUserBadges(pubkey.value)
})

function handleBadgeClick(badge) {
  selectedBadge.value = badge
  showBadgeDetail.value = true
}

// ── QR toggles ────────────────────────────────────────────────
const activeQR = ref('') // '' | 'pubkey' | 'lightning'

function toggleQR(type) {
  activeQR.value = activeQR.value === type ? '' : type
}

// ── Copy ──────────────────────────────────────────────────────
const copySuccess = ref('')
let _copyTimer = null

async function copyToClipboard(text, type) {
  try {
    await navigator.clipboard.writeText(text)
    clearTimeout(_copyTimer)
    copySuccess.value = type
    _copyTimer = setTimeout(() => { copySuccess.value = '' }, 2000)
  } catch { /* silently fail */ }
}

// ── Derived ───────────────────────────────────────────────────
const displayName = computed(() =>
  profile.value.display_name || profile.value.name || shortNpub.value
)

const npub = computed(() => {
  if (!pubkey.value) return ''
  try { return nip19.npubEncode(pubkey.value) } catch { return pubkey.value }
})

const shortNpub = computed(() => {
  if (!npub.value) return ''
  return npub.value.slice(0, 14) + '...' + npub.value.slice(-4)
})

const avatar = computed(() => profile.value.picture || generateAvatar(pubkey.value))
const lightningAddress = computed(() => profile.value.lud16 || '')
const website = computed(() => profile.value.website || '')
const nip05 = computed(() => profile.value.nip05 || '')
const aboutText = computed(() => profile.value.about || '')

// ── Banner ────────────────────────────────────────────────────
const bannerFailed = ref(false)
const bannerSrc = computed(() => profile.value.banner || '')
const hasBanner = computed(() => bannerSrc.value && !bannerFailed.value)

const fallbackGradient = computed(() => {
  if (!pubkey.value) return 'from-orange-400 to-amber-500'
  const seed = parseInt(pubkey.value.slice(0, 6), 16)
  const gradients = [
    'from-orange-400 to-amber-500',
    'from-rose-400 to-orange-400',
    'from-violet-400 to-purple-500',
    'from-blue-400 to-cyan-400',
    'from-emerald-400 to-teal-500',
    'from-amber-400 to-yellow-400'
  ]
  return gradients[seed % gradients.length]
})

// ── Lifecycle: fetch fresh data on open ───────────────────────
watch(() => props.show, async (visible) => {
  if (!visible) return

  // Reset state
  activeQR.value = ''
  copySuccess.value = ''
  showBadgeDetail.value = false
  selectedBadge.value = null
  bannerFailed.value = false
  liveProfile.value = null
  badgesLoaded.value = false

  const pk = pubkey.value
  if (!pk) return

  // 1. Fresh profile fetch (gets banner, about, etc.)
  profileLoading.value = true
  try {
    const fresh = await profileService.get(pk, { forceFresh: true })
    if (fresh && props.show) liveProfile.value = fresh
  } catch { /* keep props-based profile as fallback */ }
  profileLoading.value = false

  // 2. Badge fetch (await definitions so they're ready when skeleton hides)
  badgesLoading.value = true
  try {
    await initUserBadges(pk)
  } catch { /* badges are best-effort */ }
  badgesLoading.value = false
  badgesLoaded.value = true
})
</script>

<template>
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div
        v-if="show && userProfileData"
        ref="modalRef"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upm-title"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
        tabindex="-1"
      >
        <div class="bg-white w-full sm:max-w-[420px] sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden">
          <div class="flex-1 overflow-y-auto overscroll-contain profile-scroll">

            <!-- ═══════════ Banner + Avatar ═══════════ -->
            <div class="relative">
              <!-- Banner -->
              <div class="h-28 sm:h-32 overflow-hidden">
                <!-- Skeleton while loading -->
                <div v-if="profileLoading && !hasBanner" class="w-full h-full bg-gray-200 animate-pulse"></div>
                <!-- Real banner -->
                <img
                  v-else-if="hasBanner"
                  :src="bannerSrc"
                  alt=""
                  class="w-full h-full object-cover"
                  @error="bannerFailed = true"
                />
                <!-- Gradient fallback -->
                <div
                  v-else
                  :class="['w-full h-full bg-gradient-to-br', fallbackGradient]"
                ></div>
                <!-- Scrim for readability -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>

              <!-- Close -->
              <button
                @click="emit('close')"
                class="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white/90 hover:bg-black/50 transition-colors backdrop-blur-sm"
                aria-label="Close"
              >
                <IconX class="w-4 h-4" />
              </button>

              <!-- Avatar overlapping banner -->
              <div class="absolute -bottom-10 left-1/2 -translate-x-1/2">
                <div class="w-[80px] h-[80px] rounded-[22px] overflow-hidden border-[3px] border-white shadow-lg bg-white">
                  <img
                    :src="avatar"
                    :alt="displayName"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = generateAvatar(pubkey)"
                  />
                </div>
              </div>
            </div>

            <!-- ═══════════ Identity ═══════════ -->
            <div class="pt-[52px] pb-1 px-6 text-center">
              <h2 id="upm-title" class="text-[17px] font-bold text-gray-900 leading-snug">
                {{ displayName }}
              </h2>

              <div v-if="nip05" class="flex items-center justify-center gap-1 mt-0.5">
                <IconShield class="w-3 h-3 text-blue-500" />
                <span class="text-[11px] text-blue-600 font-medium">{{ nip05 }}</span>
              </div>

              <p v-if="aboutText" class="text-[13px] text-gray-500 mt-2 leading-relaxed mx-auto max-w-[300px]">
                {{ aboutText }}
              </p>

              <a
                v-if="website"
                :href="website.startsWith('http') ? website : `https://${website}`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 mt-1.5 text-[11px] text-orange-500 hover:text-orange-600 font-medium"
              >
                {{ website.replace(/^https?:\/\//, '').replace(/\/$/, '') }}
                <IconExternalLink class="w-2.5 h-2.5" />
              </a>
            </div>

            <!-- ═══════════ Badges ═══════════ -->
            <div v-if="pubkey" class="px-5 py-3">
              <div class="flex justify-center">
                <BadgeList
                  :pubkey="pubkey"
                  :loading="badgesLoading"
                  :show-count="false"
                  :show-view-all="false"
                  layout="horizontal"
                  @badge-click="handleBadgeClick"
                >
                  <template #empty></template>
                </BadgeList>
              </div>
            </div>

            <!-- ═══════════ Divider ═══════════ -->
            <div class="mx-5 border-t border-gray-100"></div>

            <!-- ═══════════ Address Cards ═══════════ -->
            <div class="p-4 space-y-2">

              <!-- ── Public Key ── -->
              <div class="rounded-2xl overflow-hidden border border-gray-200/50 bg-gray-50/70">
                <button
                  class="w-full flex items-center gap-3 px-4 py-3 text-left"
                  @click="toggleQR('pubkey')"
                >
                  <div class="w-8 h-8 rounded-xl bg-white border border-gray-200/80 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <IconKey class="w-4 h-4 text-gray-500" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] text-gray-400 font-semibold uppercase tracking-widest leading-none mb-1">Nostr</p>
                    <p class="text-[12px] text-gray-700 font-mono truncate leading-tight">{{ shortNpub }}</p>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <div
                      :class="[
                        'w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200',
                        activeQR === 'pubkey' ? 'bg-orange-500 text-white' : 'text-gray-400'
                      ]"
                    >
                      <IconQrcode class="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>

                <!-- Copy bar -->
                <div class="flex border-t border-gray-200/40">
                  <button
                    @click.stop="copyToClipboard(npub, 'pubkey')"
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-gray-500 hover:text-orange-600 hover:bg-orange-50/50 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'pubkey'" class="w-3 h-3 text-green-500" />
                    <IconCopy v-else class="w-3 h-3" />
                    {{ copySuccess === 'pubkey' ? 'Copied' : 'Copy npub' }}
                  </button>
                  <div class="w-px bg-gray-200/40"></div>
                  <button
                    @click.stop="copyToClipboard(pubkey, 'hex')"
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-gray-500 hover:text-orange-600 hover:bg-orange-50/50 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'hex'" class="w-3 h-3 text-green-500" />
                    <IconCopy v-else class="w-3 h-3" />
                    {{ copySuccess === 'hex' ? 'Copied' : 'Copy hex' }}
                  </button>
                </div>

                <!-- QR Panel -->
                <transition name="qr-expand">
                  <div v-if="activeQR === 'pubkey'" class="border-t border-gray-200/40 bg-white">
                    <div class="p-5 flex flex-col items-center">
                      <div class="bg-gray-50 rounded-2xl p-5 shadow-inner border border-gray-100">
                        <QRCodeVue3
                          :value="npub"
                          :size="200"
                          color="#18181b"
                          background-color="#fafafa"
                          error-correction-level="M"
                        />
                      </div>
                      <p class="text-[9px] text-gray-400 font-mono mt-3 text-center break-all max-w-[220px] leading-relaxed select-all">{{ npub }}</p>
                    </div>
                  </div>
                </transition>
              </div>

              <!-- ── Lightning ── -->
              <div v-if="lightningAddress" class="rounded-2xl overflow-hidden border border-amber-200/30 bg-amber-50/40">
                <button
                  class="w-full flex items-center gap-3 px-4 py-3 text-left"
                  @click="toggleQR('lightning')"
                >
                  <div class="w-8 h-8 rounded-xl bg-white border border-amber-200/60 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <IconBolt class="w-4 h-4 text-amber-500" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[10px] text-amber-500/80 font-semibold uppercase tracking-widest leading-none mb-1">Lightning</p>
                    <p class="text-[12px] text-amber-900 font-mono truncate leading-tight">{{ lightningAddress }}</p>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <div
                      :class="[
                        'w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200',
                        activeQR === 'lightning' ? 'bg-amber-500 text-white' : 'text-amber-400'
                      ]"
                    >
                      <IconQrcode class="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>

                <!-- Copy bar -->
                <div class="flex border-t border-amber-200/30">
                  <button
                    @click.stop="copyToClipboard(lightningAddress, 'lightning')"
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-amber-600/70 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                  >
                    <IconCheck v-if="copySuccess === 'lightning'" class="w-3 h-3 text-green-500" />
                    <IconCopy v-else class="w-3 h-3" />
                    {{ copySuccess === 'lightning' ? 'Copied' : 'Copy address' }}
                  </button>
                </div>

                <!-- QR Panel -->
                <transition name="qr-expand">
                  <div v-if="activeQR === 'lightning'" class="border-t border-amber-200/30 bg-white">
                    <div class="p-5 flex flex-col items-center">
                      <div class="bg-amber-50/50 rounded-2xl p-5 shadow-inner border border-amber-100/60">
                        <QRCodeVue3
                          :value="lightningAddress"
                          :size="200"
                          color="#78350f"
                          background-color="#fffbeb"
                          error-correction-level="M"
                        />
                      </div>
                      <p class="text-[10px] text-amber-500 font-mono mt-3 text-center select-all">{{ lightningAddress }}</p>
                    </div>
                  </div>
                </transition>
              </div>

            </div>

            <div class="h-3 sm:h-1"></div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <!-- Badge Detail (nested) -->
  <BadgeDetailModal
    :show="showBadgeDetail"
    :badge="selectedBadge"
    @close="showBadgeDetail = false; selectedBadge = null"
  />
</template>

<style scoped>
.qr-expand-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.qr-expand-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.qr-expand-enter-from,
.qr-expand-leave-to {
  opacity: 0;
  max-height: 0;
  overflow: hidden;
}
.qr-expand-enter-to,
.qr-expand-leave-from {
  max-height: 400px;
}

.profile-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.06) transparent;
}
.profile-scroll::-webkit-scrollbar {
  width: 3px;
}
.profile-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.profile-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
}
</style>
