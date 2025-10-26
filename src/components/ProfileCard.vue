<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import {
  IconShield,
  IconBolt,
  IconCopy,
  IconCheck,
  IconExternalLink,
  IconSettings,
  IconPencil
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
  },
  isCurrentUser: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click', 'follow', 'unfollow', 'toggle-selection', 'edit'])

// UI state
const showMenu = ref(false)
const copySuccess = ref(false)
const menuRef = ref(null)

// Computed properties
const displayName = computed(() => {
  return props.profile?.name ||
         props.profile?.display_name ||
         'Anonymous'
})

const avatar = computed(() => {
  return props.profile?.picture || generateFallbackAvatar(props.pubkey)
})

const npubShort = computed(() => {
  try {
    const npub = nip19.npubEncode(props.pubkey)
    return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`
  } catch {
    return `${props.pubkey.substring(0, 8)}...`
  }
})

const hasVerification = computed(() => {
  return !!props.profile?.nip05
})

const connectionStatus = computed(() => {
  // This would be determined by your connection logic
  return 'Connected'
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

// Copy npub to clipboard
const copyNpub = async () => {
  try {
    const npub = nip19.npubEncode(props.pubkey)
    await navigator.clipboard.writeText(npub)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
      showMenu.value = false
    }, 1500)
  } catch (error) {
    console.error('Failed to copy npub:', error)
  }
}

// Get profile URL
const getProfileUrl = () => {
  try {
    const npub = nip19.npubEncode(props.pubkey)
    return `https://primal.net/p/${npub}`
  } catch (error) {
    return '#'
  }
}

// Handle click outside
const handleClickOutside = (event) => {
  if (menuRef.value && !menuRef.value.contains(event.target)) {
    showMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const toggleMenu = (e) => {
  e.stopPropagation()
  showMenu.value = !showMenu.value
}

const handleEdit = () => {
  emit('edit')
  showMenu.value = false
}
</script>

<template>
  <div class="profile-card">
    <!-- Header with Avatar and Name -->
    <div class="profile-header">
      <!-- Avatar -->
      <div class="profile-avatar-container">
        <img
          :src="avatar"
          :alt="displayName"
          class="profile-avatar"
          @error="$event.target.src = generateFallbackAvatar(pubkey)"
        />
        <div class="profile-status-dot"></div>
      </div>

      <!-- Name and Info -->
      <div class="profile-info">
        <div class="profile-name-row">
          <h3 class="profile-name">{{ displayName }}</h3>
          <IconShield v-if="hasVerification" class="profile-badge" title="Verified" />
        </div>
        <p class="profile-pubkey">{{ npubShort }}</p>
      </div>

      <!-- Menu Button -->
      <div class="profile-actions" ref="menuRef">
        <button
          @click="toggleMenu"
          class="profile-menu-button"
          :class="{ 'active': showMenu }"
        >
          <IconSettings class="w-4 h-4" />
        </button>

        <!-- Dropdown Menu -->
        <transition name="menu-fade">
          <div v-if="showMenu" class="profile-menu">
            <button
              v-if="isCurrentUser"
              @click="handleEdit"
              class="profile-menu-item"
            >
              <IconPencil class="w-4 h-4" />
              <span>Edit Profile</span>
            </button>

            <button
              @click="copyNpub"
              class="profile-menu-item"
            >
              <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
              <IconCopy v-else class="w-4 h-4" />
              <span>{{ copySuccess ? 'Copied!' : 'Copy Public Key' }}</span>
            </button>

            <a
              :href="getProfileUrl()"
              target="_blank"
              rel="noopener noreferrer"
              class="profile-menu-item"
              @click="showMenu = false"
            >
              <IconExternalLink class="w-4 h-4" />
              <span>View on Primal</span>
            </a>
          </div>
        </transition>
      </div>
    </div>

    <!-- Divider -->
    <div class="profile-divider"></div>

    <!-- Public Key Section -->
    <div class="profile-section">
      <div class="profile-section-header">
        <IconBolt class="w-4 h-4 text-gray-400" />
        <span class="profile-section-label">Public Key</span>
      </div>
      <p class="profile-section-value">{{ npubShort }}</p>
    </div>

    <!-- Connection Status -->
    <div class="profile-section">
      <div class="profile-section-header">
        <div class="w-2 h-2 rounded-full bg-green-500"></div>
        <span class="profile-section-label">{{ connectionStatus }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-card {
  @apply bg-white rounded-2xl overflow-hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.profile-card:hover {
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(251, 146, 60, 0.2);
}

/* Header */
.profile-header {
  @apply flex items-start gap-3 p-4;
}

/* Avatar */
.profile-avatar-container {
  @apply relative flex-shrink-0;
}

.profile-avatar {
  @apply w-12 h-12 rounded-full object-cover;
  border: 2px solid rgba(0, 0, 0, 0.06);
}

.profile-status-dot {
  @apply absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Profile Info */
.profile-info {
  @apply flex-1 min-w-0;
}

.profile-name-row {
  @apply flex items-center gap-1.5 mb-0.5;
}

.profile-name {
  @apply text-base font-semibold text-gray-900 truncate;
  letter-spacing: -0.01em;
}

.profile-badge {
  @apply w-4 h-4 text-blue-500 flex-shrink-0;
}

.profile-pubkey {
  @apply text-sm text-gray-500 truncate font-mono;
  font-size: 13px;
}

/* Actions */
.profile-actions {
  @apply relative flex-shrink-0;
}

.profile-menu-button {
  @apply p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200;
  -webkit-tap-highlight-color: transparent;
}

.profile-menu-button.active {
  @apply bg-gray-100 text-gray-600;
}

.profile-menu-button:active {
  @apply scale-95;
}

/* Menu */
.profile-menu {
  @apply absolute right-0 top-full mt-1 w-56 bg-white rounded-xl overflow-hidden z-50;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.profile-menu-item {
  @apply w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150;
  -webkit-tap-highlight-color: transparent;
}

.profile-menu-item:active {
  @apply bg-gray-100;
}

.profile-menu-item:first-child {
  @apply pt-3;
}

.profile-menu-item:last-child {
  @apply pb-3;
}

/* Divider */
.profile-divider {
  @apply mx-4 h-px bg-gray-100;
}

/* Section */
.profile-section {
  @apply px-4 py-3;
}

.profile-section + .profile-section {
  @apply border-t border-gray-100;
}

.profile-section-header {
  @apply flex items-center gap-2 mb-1;
}

.profile-section-label {
  @apply text-xs font-medium text-gray-500 uppercase tracking-wider;
  letter-spacing: 0.05em;
}

.profile-section-value {
  @apply text-sm text-gray-900 font-mono truncate;
  padding-left: 24px;
}

/* Menu Transition */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-fade-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .profile-card {
    @apply rounded-xl;
  }

  .profile-header {
    @apply p-3.5;
  }

  .profile-avatar {
    @apply w-11 h-11;
  }

  .profile-name {
    @apply text-[15px];
  }

  .profile-pubkey {
    font-size: 12px;
  }

  .profile-section {
    @apply px-3.5 py-2.5;
  }

  .profile-menu {
    @apply w-64;
  }

  /* Larger touch targets on mobile */
  .profile-menu-button {
    @apply p-2.5;
    min-width: 44px;
    min-height: 44px;
  }

  .profile-menu-item {
    @apply py-3.5;
    min-height: 52px;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .profile-card,
  .profile-menu-button,
  .profile-menu-item {
    transition: none !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .profile-card {
    border-width: 2px;
  }

  .profile-avatar {
    border-width: 2px;
  }
}
</style>
