<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import {
  IconUserPlus,
  IconCheck,
  IconShield,
  IconBolt,
  IconLoader
} from '@iconify-prerendered/vue-tabler'
import BadgeList from '../badges/BadgeList.vue'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { nip19 } from '../../services/nostr/nostrImports.js'


const props = defineProps({
  pubkey: {
    type: String,
    required: true
  },
  anchorEl: {
    type: Object,
    default: null
  },
  isFollowing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['follow', 'unfollow', 'close'])

const profile = ref(null)
const isLoadingProfile = ref(true)
const cardRef = ref(null)
const position = ref({ top: '0px', left: '0px' })

// Computed
const displayName = computed(() => {
  return profile.value?.name ||
    profile.value?.display_name ||
    `user:${props.pubkey.substring(0, 8)}`
})

const avatar = computed(() => {
  return profile.value?.picture || generateAvatar(props.pubkey)
})

const shortHandle = computed(() => {
  if (profile.value?.name) {
    return `@${profile.value.name}`
  }
  try {
    const npub = nip19.npubEncode(props.pubkey)
    return `${npub.substring(0, 16)}...`
  } catch {
    return `${props.pubkey.substring(0, 8)}...`
  }
})

const hasVerification = computed(() => !!profile.value?.nip05)
const hasLightning = computed(() => !!profile.value?.lud16)

const aboutText = computed(() => {
  const about = profile.value?.about
  if (!about) return ''
  // Truncate to ~120 chars for the hover card
  return about.length > 120 ? about.substring(0, 120) + '...' : about
})

// Position the card near the anchor element
const updatePosition = () => {
  if (!props.anchorEl) return

  const rect = props.anchorEl.getBoundingClientRect()
  const cardWidth = 320
  const cardHeight = 260 // estimated
  const gap = 8

  // Default: position below the anchor
  let top = rect.bottom + gap
  let left = rect.left

  // If card would go off the right edge, align to right
  if (left + cardWidth > window.innerWidth - 16) {
    left = window.innerWidth - cardWidth - 16
  }

  // If card would go off the bottom, position above
  if (top + cardHeight > window.innerHeight - 16) {
    top = rect.top - cardHeight - gap
  }

  // Ensure left is not negative
  if (left < 16) left = 16

  position.value = {
    top: `${top}px`,
    left: `${left}px`
  }
}

// Fetch profile data
const loadProfile = async () => {
  isLoadingProfile.value = true
  try {
    const p = await profileService.get(props.pubkey)
    if (p) {
      profile.value = p
    }
  } catch (err) {
    console.warn('ProfileHoverCard: failed to load profile', err)
  } finally {
    isLoadingProfile.value = false
  }
}

const handleFollowToggle = () => {
  if (props.isFollowing) {
    emit('unfollow', props.pubkey)
  } else {
    emit('follow', props.pubkey)
  }
}

// Open profile in external client
const openProfile = () => {
  try {
    const npub = nip19.npubEncode(props.pubkey)
    window.open(`https://primal.net/p/${npub}`, '_blank')
  } catch { /* ignore */ }
}

onMounted(() => {
  loadProfile()
  updatePosition()
  nextTick(updatePosition)
})

// Update position if anchor changes
watch(() => props.anchorEl, () => {
  nextTick(updatePosition)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="cardRef"
      class="profile-hover-card fixed z-[10001] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      :style="position"
      @mouseenter="$emit('close', false)"
      @mouseleave="$emit('close', true)"
    >
      <!-- Loading state -->
      <div v-if="isLoadingProfile" class="p-6 flex items-center justify-center">
        <IconLoader class="w-5 h-5 animate-spin text-orange-500" />
      </div>

      <!-- Profile content -->
      <div v-else>
        <!-- Header with avatar -->
        <div class="p-4 pb-2 flex items-start space-x-3">
          <!-- Avatar -->
          <div
            class="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-orange-200 cursor-pointer"
            @click="openProfile"
          >
            <img
              :src="avatar"
              :alt="displayName"
              class="w-full h-full object-cover"
              @error="$event.target.src = generateAvatar(pubkey)"
            />
          </div>

          <!-- Name + handle -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-1.5">
              <h3
                class="font-semibold text-gray-900 truncate cursor-pointer hover:text-orange-600 transition-colors"
                @click="openProfile"
              >
                {{ displayName }}
              </h3>
              <IconShield v-if="hasVerification" class="w-4 h-4 text-blue-500 flex-shrink-0" title="NIP-05 verified" />
              <IconBolt v-if="hasLightning" class="w-4 h-4 text-yellow-500 flex-shrink-0" title="Lightning address" />
            </div>
            <p class="text-sm text-gray-400 truncate">{{ shortHandle }}</p>
            <p v-if="profile?.nip05" class="text-xs text-gray-400 truncate mt-0.5">
              {{ profile.nip05 }}
            </p>
          </div>
        </div>

        <!-- About -->
        <p v-if="aboutText" class="px-4 text-sm text-gray-600 leading-relaxed">
          {{ aboutText }}
        </p>

        <!-- Badges -->
        <div class="px-4 pt-2">
          <BadgeList
            :key="`hover-badges-${pubkey}`"
            :pubkey="pubkey"
            size="small"
            :max-display="3"
            :show-count="false"
            :show-view-all="false"
            layout="horizontal"
          />
        </div>

        <!-- Follow action -->
        <div class="px-4 py-3 flex items-center justify-between border-t border-gray-100 mt-2">
          <button
            v-if="!isFollowing"
            @click="handleFollowToggle"
            class="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <IconUserPlus class="w-3.5 h-3.5" />
            Follow
          </button>
          <button
            v-else
            @click="handleFollowToggle"
            class="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 border border-gray-300"
          >
            <IconCheck class="w-3.5 h-3.5" />
            Following
          </button>

          <button
            @click="openProfile"
            class="text-xs text-gray-400 hover:text-orange-600 transition-colors"
          >
            View profile
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.profile-hover-card {
  animation: hoverCardIn 0.15s ease-out;
}

@keyframes hoverCardIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
