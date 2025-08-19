<script setup>
import { computed, ref } from 'vue'
import {
  IconUser,
  IconUserPlus,
  IconUserCheck,
  IconUserX,
  IconShield,
  IconBolt,
  IconDots,
  IconCopy,
  IconExternalLink,
  IconList,
  IconCheck,
  IconChevronDown
} from '@iconify-prerendered/vue-tabler'
import * as nip19 from 'nostr-tools/nip19'

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

const emit = defineEmits(['click', 'follow', 'unfollow', 'toggle-selection'])

// UI state
const showDropdown = ref(false)
const copySuccess = ref(false)

// Computed properties
const displayName = computed(() => {
  return props.profile?.name || 
         props.profile?.display_name || 
         `user:${props.pubkey.substring(0, 8)}`
})

const avatar = computed(() => {
  return props.profile?.picture || generateFallbackAvatar(props.pubkey)
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

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

// Handle follow/unfollow
const handleFollowToggle = () => {
  if (props.isFollowing) {
    emit('unfollow', props.pubkey)
  } else {
    // Enhanced follow with feedback
    emit('follow', props.pubkey)
      .then(result => {
        if (result && result.alreadyFollowing) {
          console.log('User was already being followed')
        } else if (result && result.success) {
          console.log('Successfully followed user, total follows:', result.totalFollows)
        }
      })
      .catch(error => {
        console.error('Follow failed:', error)
      })
  }
}

// Copy npub to clipboard
const copyNpub = async () => {
  try {
    const npub = nip19.npubEncode(props.pubkey)
    await navigator.clipboard.writeText(npub)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy npub:', error)
  }
}

// Get profile URL for different clients
const getProfileUrl = (client) => {
  try {
    const npub = nip19.npubEncode(props.pubkey)
    switch (client) {
      case 'primal':
        return `https://primal.net/p/${npub}`
      case 'yakihonne':
        return `https://yakihonne.com/${npub}`
      default:
        return `https://primal.net/p/${npub}`
    }
  } catch (error) {
    return '#'
  }
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
            @error="$event.target.src = generateFallbackAvatar(pubkey)"
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
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center space-x-2 flex-shrink-0">
        <!-- Primary Follow Button -->
        <button
          v-if="!isFollowing"
          @click="handleFollowToggle"
          class="btn-primary text-sm"
        >
          <IconUserPlus class="w-4 h-4" />
          <span class="hidden sm:inline">Follow</span>
        </button>

        <!-- Following Dropdown -->
        <div v-else class="relative">
          <button
            @click="showDropdown = !showDropdown"
            class="btn-secondary text-sm flex items-center space-x-1"
          >
            <IconUserCheck class="w-4 h-4" />
            <span class="hidden sm:inline">Following</span>
            <IconChevronDown class="w-3 h-3" />
          </button>

          <!-- Dropdown Menu -->
          <div v-if="showDropdown" class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
            <button
              @click="$emit('unfollow', pubkey); showDropdown = false"
              class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
            >
              <IconUserX class="w-4 h-4" />
              <span>Unfollow</span>
            </button>
            
            <button
              @click="copyNpub; showDropdown = false"
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
              <IconCopy v-else class="w-4 h-4" />
              <span>{{ copySuccess ? 'Copied!' : 'Copy npub' }}</span>
            </button>
            
            <a
              :href="getProfileUrl('primal')"
              target="_blank"
              rel="noopener noreferrer"
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              @click="showDropdown = false"
            >
              <IconExternalLink class="w-4 h-4" />
              <span>View on Primal</span>
            </a>
          </div>
        </div>

        <!-- Overflow Menu -->
        <button
          class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="More options"
        >
          <IconDots class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>