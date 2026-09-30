<script setup>
import { computed } from 'vue'
import {
  IconUserPlus,
  IconShield,
  IconBolt,
  IconCheck,
  IconAward
} from '@iconify-prerendered/vue-tabler'
import { nip19 } from '../../services/nostr/nostrImports.js'
import BadgeList from '../badges/BadgeList.vue'
import { useBadges } from '../../composables/social/useBadges.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const { getUserBadgeCount } = useBadges()

const props = defineProps({
  pubkey: {
    type: String,
    required: true
  },
  profile: {
    type: Object,
    default: null
  },
  isFollowing: {
    type: Boolean,
    default: false
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  showSelection: {
    type: Boolean,
    default: false
  },
  showMutuals: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['click', 'follow', 'unfollow', 'toggle-selection', 'badge-click'])

// Computed properties
const displayName = computed(() => {
  return props.profile?.name || 
         props.profile?.display_name || 
         `user:${props.pubkey.substring(0, 8)}`
})

const avatar = computed(() => {
  return props.profile?.picture || generateAvatar(props.pubkey)
})

const shortHandle = computed(() => {
  if (props.profile?.name) {
    return `@${props.profile.name}`
  }
  try {
    const npub = nip19.npubEncode(props.pubkey)
    return `${npub.substring(0, 12)}...`
  } catch {
    return `${props.pubkey.substring(0, 8)}...`
  }
})

const hasVerification = computed(() => {
  return !!props.profile?.nip05
})

const hasLightning = computed(() => {
  return !!props.profile?.lud16
})

const badgeCount = computed(() => getUserBadgeCount(props.pubkey))

// Handle follow/unfollow
const handleFollowToggle = () => {
  if (props.isFollowing) {
    emit('unfollow', props.pubkey)
  } else {
    emit('follow', props.pubkey)
  }
}

// Handle badge click
const handleBadgeClick = (badge) => {
  emit('badge-click', badge)
}
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all duration-200 p-4">
    <div class="flex items-center space-x-4">
      <!-- Selection Checkbox -->
      <div v-if="showSelection" class="flex-shrink-0">
        <input
          type="checkbox"
          :checked="isSelected"
          @change="emit('toggle-selection', pubkey)"
          class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
        />
      </div>

      <!-- Avatar with Status -->
      <div class="relative flex-shrink-0 cursor-pointer" @click="emit('click', pubkey)">
        <div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-orange-200 hover:border-orange-300 transition-colors">
          <img
            :src="avatar"
            :alt="displayName"
            class="w-full h-full object-cover"
            @error="$event.target.src = generateAvatar(pubkey)"
          />
        </div>
        <!-- Online status dot (optional) -->
        <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
      </div>

      <!-- Profile Info -->
      <div class="flex-1 min-w-0 cursor-pointer" @click="emit('click', pubkey)">
        <div class="flex items-center space-x-2 mb-1">
          <h3 class="font-semibold text-gray-900 truncate">{{ displayName }}</h3>
          
          <!-- Verification Badge -->
          <IconShield v-if="hasVerification" class="w-4 h-4 text-blue-600" title="NIP-05 Verified" />

          <!-- Lightning Badge -->
          <IconBolt v-if="hasLightning" class="w-4 h-4 text-yellow-500" title="Lightning Address" />

          <!-- Badge Count -->
          <span v-if="badgeCount > 0" class="flex items-center space-x-0.5 text-orange-600" :title="`${badgeCount} badges`">
            <IconAward class="w-4 h-4" />
            <span class="text-xs font-medium">{{ badgeCount }}</span>
          </span>
        </div>
        
        <p class="text-sm text-gray-500 truncate">{{ shortHandle }}</p>
        
        <p v-if="profile?.about" class="text-sm text-gray-600 line-clamp-2 mt-1">
          {{ profile.about }}
        </p>
        
        <!-- Badges -->
        <div class="flex items-center space-x-2 mt-2">
          <span v-if="showMutuals" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Mutual
          </span>
          
          <!-- NIP-58 Badges -->
          <BadgeList
            :key="`badges-${pubkey}`"
            :pubkey="pubkey"
            size="small"
            :show-count="false"
            :show-view-all="false"
            layout="horizontal"
            @badge-click="handleBadgeClick"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-2 flex-shrink-0">
        <!-- Simple Follow/Following Button -->
        <button
          v-if="!isFollowing"
          @click="handleFollowToggle"
          class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
        >
          <IconUserPlus class="w-4 h-4" />
          <span class="hidden sm:inline">Follow</span>
        </button>

        <button
          v-else
          @click="handleFollowToggle"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 border border-gray-300"
        >
          <IconCheck class="w-4 h-4" />
          <span class="hidden sm:inline">Following</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>