<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  IconBolt, IconBell, IconUser, IconRefresh,
  IconAward, IconExternalLink, IconCheck, IconCopy,
  IconPlugConnected, IconShield, IconKey, IconGlobe,
  IconEdit, IconLogout, IconLoader, IconAlertCircle
} from '@iconify-prerendered/vue-tabler'
import { nip19 } from '../services/nostr/nostrImports.js'
import SettingsConnections from '../components/settings/SettingsConnections.vue'
import NotificationSettings from '../components/settings/NotificationSettings.vue'
import NostrSettings from '../components/settings/NostrSettings.vue'
import AccountReset from '../components/settings/AccountReset.vue'
import BadgeList from '../components/badges/BadgeList.vue'
import BadgeDetailModal from '../components/badges/BadgeDetailModal.vue'
import NostrProfileEditor from '../components/profile/NostrProfileEditor.vue'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useBadges } from '../composables/social/useBadges.js'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'

const {
  currentUser,
  userProfile,
  isLoading,
  authError,
  isAuthenticated,
  login,
  loginWithRemote,
  logout,
  refreshUserProfile
} = useNostrAuth()
const { getUserBadgeCount, initUserBadges } = useBadges()

// Define props to receive the initial tab from parent
const props = defineProps({
  initialTab: {
    type: String,
    default: 'profile'
  }
})

const emit = defineEmits(['change-page'])

const activeTab = ref('profile')

// Badge detail modal state
const showBadgeDetailModal = ref(false)
const selectedBadge = ref(null)
const copySuccess = ref('')
const localLoginError = ref('')
const showProfileEditor = ref(false)
const showLoginOptions = ref(false)
const bunkerUri = ref('')
const loginMode = ref(null) // null | 'extension' | 'remote'

const handleBadgeClick = (badge) => {
  selectedBadge.value = badge
  showBadgeDetailModal.value = true
}

// Badge count
const badgeCount = computed(() => {
  return currentUser.value?.pubkey ? getUserBadgeCount(currentUser.value.pubkey) : 0
})

// Profile computed
const displayName = computed(() => {
  return userProfile.value?.name || userProfile.value?.display_name || 'Anonymous'
})

const userNpub = computed(() => {
  if (!currentUser.value?.pubkey) return ''
  try { return nip19.npubEncode(currentUser.value.pubkey) } catch { return '' }
})

const shortNpub = computed(() => {
  if (!userNpub.value) return ''
  return userNpub.value.substring(0, 12) + '...' + userNpub.value.substring(userNpub.value.length - 4)
})

const userAvatar = computed(() => {
  return userProfile.value?.picture || generateAvatar(currentUser.value?.pubkey)
})

const userBanner = computed(() => {
  return userProfile.value?.banner || null
})

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = text
    setTimeout(() => { copySuccess.value = '' }, 2000)
  } catch (e) {
    console.error('Copy failed:', e)
  }
}

// Login
const handleLogin = async () => {
  try {
    await login()
    showLoginOptions.value = false
    loginMode.value = null
  } catch (error) {
    console.error('Login failed:', error)
  }
}

const handleRemoteLogin = async () => {
  if (!bunkerUri.value.trim()) return
  try {
    await loginWithRemote(bunkerUri.value.trim())
    showLoginOptions.value = false
    loginMode.value = null
    bunkerUri.value = ''
  } catch (error) {
    console.error('Remote login failed:', error)
  }
}

const selectLoginMode = (mode) => {
  loginMode.value = mode
  if (mode === 'extension') {
    handleLogin()
  }
}

// Profile actions
const handleRefreshProfile = async () => {
  if (!isAuthenticated.value) return
  try {
    await refreshUserProfile()
  } catch (error) {
    console.error('Failed to refresh profile:', error)
  }
}

const handleProfileUpdated = () => {
  showProfileEditor.value = false
  handleRefreshProfile()
}

const tabs = [
  { id: 'profile', label: 'Profile', icon: IconUser },
  { id: 'relays', label: 'Relays', icon: IconPlugConnected },
  { id: 'wallet', label: 'Wallet', icon: IconBolt },
  { id: 'alerts', label: 'Notifications', icon: IconBell },
  { id: 'reset', label: 'Reset', icon: IconRefresh }
]

// Set initial tab on mount
onMounted(() => {
  if (props.initialTab) {
    activeTab.value = props.initialTab
  }
  // Initialize badges for current user
  if (currentUser.value?.pubkey) {
    initUserBadges(currentUser.value.pubkey)
  }
})

// Watch for changes to initialTab prop and update activeTab
watch(() => props.initialTab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Elegant Settings Container -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
      <!-- Tab Navigation -->
      <div class="border-b border-gray-100 bg-gray-50/50">
        <nav class="flex space-x-1 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-hide" aria-label="Settings tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex items-center gap-2 px-4 py-2 font-medium text-sm whitespace-nowrap transition-all duration-150 rounded-xl flex-shrink-0',
              activeTab === tab.id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white'
            ]"
          >
            <component :is="tab.icon" class="w-4.5 h-4.5" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6 sm:p-8">
        <!-- Profile Tab -->
        <div v-if="activeTab === 'profile'" class="space-y-5">
          <!-- Not Authenticated -->
          <div v-if="!isAuthenticated" class="max-w-md mx-auto">
            <div class="bg-white rounded-2xl p-10 sm:p-12 text-center shadow-sm border border-gray-200/60">
              <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-orange-100 to-orange-50">
                <img src="/nostr-logo/nostr10.png" alt="Nostr Logo" class="w-12 h-12 object-contain" />
              </div>
              <h2 class="text-2xl font-semibold text-gray-900 mb-2">Connect Your Identity</h2>
              <p class="text-gray-500 text-sm mb-6 leading-relaxed">Choose how to sign in to your Nostr identity.</p>

              <!-- Login Method Selection -->
              <div v-if="loginMode === null" class="space-y-3">
                <!-- Browser Extension (NIP-07) -->
                <button
                  @click="selectLoginMode('extension')"
                  :disabled="isLoading"
                  class="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-2xl transition-all group"
                >
                  <div class="w-12 h-12 bg-orange-100 group-hover:bg-orange-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <IconKey class="w-6 h-6 text-orange-600" />
                  </div>
                  <div class="text-left flex-1">
                    <p class="text-sm font-semibold text-gray-900">Browser Extension</p>
                    <p class="text-xs text-gray-500">Alby, nos2x, Flamingo, or other NIP-07 extension</p>
                  </div>
                </button>

                <!-- Remote Signer (NIP-46) -->
                <button
                  @click="loginMode = 'remote'"
                  :disabled="isLoading"
                  class="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-2xl transition-all group"
                >
                  <div class="w-12 h-12 bg-purple-100 group-hover:bg-purple-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <IconPlugConnected class="w-6 h-6 text-purple-600" />
                  </div>
                  <div class="text-left flex-1">
                    <p class="text-sm font-semibold text-gray-900">Remote Signer (NIP-46)</p>
                    <p class="text-xs text-gray-500">Amber, nsec.app, or other bunker signer</p>
                  </div>
                </button>
              </div>

              <!-- NIP-46 Remote Signer Input -->
              <div v-if="loginMode === 'remote'" class="space-y-4">
                <div class="text-left">
                  <label class="block text-xs font-medium text-gray-700 mb-1.5">Connection URI</label>
                  <input
                    v-model="bunkerUri"
                    type="text"
                    placeholder="bunker://... or nostrconnect://..."
                    class="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    @keyup.enter="handleRemoteLogin"
                  />
                  <p class="text-xs text-gray-400 mt-1.5">Get this from your signer app (Amber, nsec.app)</p>
                </div>

                <div class="flex gap-2">
                  <button
                    @click="loginMode = null; bunkerUri = ''"
                    class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    @click="handleRemoteLogin"
                    :disabled="isLoading || !bunkerUri.trim()"
                    class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50"
                  >
                    <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                    <IconPlugConnected v-else class="w-4 h-4" />
                    {{ isLoading ? 'Connecting...' : 'Connect' }}
                  </button>
                </div>
              </div>

              <!-- Loading state for extension login -->
              <div v-if="loginMode === 'extension' && isLoading" class="mt-4 flex items-center justify-center gap-2 text-orange-600">
                <IconLoader class="w-4 h-4 animate-spin" />
                <span class="text-sm">Connecting to extension...</span>
              </div>

              <!-- Error display -->
              <div v-if="authError || localLoginError" class="mt-4 bg-red-50 border border-red-100 rounded-xl p-3">
                <div class="flex items-center justify-center gap-2 text-sm text-red-600">
                  <IconAlertCircle class="w-4 h-4 flex-shrink-0" />
                  <span>{{ localLoginError || authError }}</span>
                </div>
                <button
                  v-if="loginMode !== null"
                  @click="loginMode = null; localLoginError = ''"
                  class="mt-2 text-xs text-red-500 hover:text-red-700 underline"
                >
                  Try a different method
                </button>
              </div>
            </div>
          </div>

          <!-- Authenticated Profile -->
          <template v-else>
            <!-- Profile Card -->
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
              <!-- Banner -->
              <div class="h-32 sm:h-40 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative overflow-hidden">
                <img
                  v-if="userBanner"
                  :src="userBanner"
                  alt="Profile banner"
                  class="absolute inset-0 w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'"
                />
              </div>

              <div class="px-5 sm:px-6 pb-6">
                <!-- Avatar & Actions -->
                <div class="flex items-end justify-between -mt-10 sm:-mt-12 mb-4">
                  <div class="relative">
                    <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white">
                      <img
                        :src="userAvatar"
                        :alt="displayName"
                        class="w-full h-full object-cover"
                        @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                      />
                    </div>
                    <div v-if="badgeCount > 0" class="absolute -bottom-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                      {{ badgeCount }}
                    </div>
                  </div>

                  <!-- Desktop Actions -->
                  <div class="hidden sm:flex items-center gap-2">
                    <button @click="showProfileEditor = true" class="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                      Edit Profile
                    </button>
                    <button @click="handleRefreshProfile" class="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors" title="Refresh">
                      <IconRefresh class="w-4 h-4" />
                    </button>
                    <button @click="logout" class="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors" title="Logout">
                      <IconLogout class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- Name & About -->
                <div class="mb-4">
                  <h2 class="text-xl font-bold text-gray-900">{{ displayName }}</h2>
                  <p class="text-gray-500 text-xs font-mono mt-0.5">{{ shortNpub }}</p>
                  <p v-if="userProfile?.about" class="text-sm text-gray-600 mt-2 max-w-lg">{{ userProfile.about }}</p>
                </div>

                <!-- Status Badges -->
                <div class="flex flex-wrap gap-2 mb-5">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    <div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    Connected
                  </span>
                  <span v-if="userProfile?.nip05" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    <IconShield class="w-3 h-3" />
                    Verified
                  </span>
                  <span v-if="userProfile?.lud16" class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                    <IconBolt class="w-3 h-3" />
                    Zap Ready
                  </span>
                </div>

                <!-- Profile Details -->
                <div class="space-y-2 mb-5">
                  <!-- Public Key -->
                  <div class="group flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <IconKey class="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div class="flex-1 min-w-0">
                        <p class="text-xs text-gray-500 mb-0.5">Public Key</p>
                        <code class="text-xs text-gray-900 font-mono truncate block">{{ shortNpub }}</code>
                      </div>
                    </div>
                    <button
                      @click="copyToClipboard(userNpub)"
                      class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <IconCheck v-if="copySuccess === userNpub" class="w-4 h-4 text-green-600" />
                      <IconCopy v-else class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Lightning Address -->
                  <div v-if="userProfile?.lud16" class="group flex items-center justify-between p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <IconBolt class="w-4 h-4 text-orange-600 flex-shrink-0" />
                      <div class="flex-1 min-w-0">
                        <p class="text-xs text-orange-900 mb-0.5">Lightning</p>
                        <p class="text-xs text-orange-700 font-medium truncate">{{ userProfile.lud16 }}</p>
                      </div>
                    </div>
                    <button
                      @click="copyToClipboard(userProfile.lud16)"
                      class="w-8 h-8 flex items-center justify-center text-orange-400 hover:text-orange-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <IconCopy class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Website -->
                  <div v-if="userProfile?.website" class="group flex items-center justify-between p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <IconGlobe class="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div class="flex-1 min-w-0">
                        <p class="text-xs text-blue-900 mb-0.5">Website</p>
                        <p class="text-xs text-blue-700 truncate">{{ userProfile.website }}</p>
                      </div>
                    </div>
                    <a
                      :href="userProfile.website"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="w-8 h-8 flex items-center justify-center text-blue-400 hover:text-blue-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <IconExternalLink class="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <!-- Mobile Actions -->
                <div class="flex sm:hidden gap-2">
                  <button @click="showProfileEditor = true" class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">
                    <IconEdit class="w-4 h-4" />
                    Edit
                  </button>
                  <button @click="handleRefreshProfile" class="w-11 h-11 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
                    <IconRefresh class="w-4 h-4" />
                  </button>
                  <button @click="logout" class="w-11 h-11 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors">
                    <IconLogout class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Badges Section -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <IconAward class="w-5 h-5 text-orange-600" />
                  <h3 class="text-lg font-semibold text-gray-900">Badges</h3>
                  <span v-if="badgeCount > 0" class="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{{ badgeCount }}</span>
                </div>
              </div>

              <div class="bg-gray-50 rounded-xl p-6">
                <BadgeList
                  v-if="currentUser?.pubkey"
                  :pubkey="currentUser.pubkey"
                  size="large"
                  :show-count="false"
                  :show-view-all="false"
                  layout="grid"
                  @badge-click="handleBadgeClick"
                >
                  <template #empty>
                    <div class="text-center py-6">
                      <IconAward class="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <h4 class="text-lg font-medium text-gray-900 mb-2">No Badges Yet</h4>
                      <p class="text-gray-500 text-sm mb-4">Earn badges from the Nostr community to showcase here.</p>
                    </div>
                  </template>
                </BadgeList>
              </div>
            </div>

            <!-- BadgeBox Info -->
            <div class="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
              <div class="flex items-start space-x-4">
                <div class="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconAward class="w-5 h-5 text-white" />
                </div>
                <div class="flex-1">
                  <h4 class="font-semibold text-gray-900 mb-1">BadgeBox — Nostr Badge Manager</h4>
                  <p class="text-sm text-gray-700 mb-3">
                    BadgeBox is a PWA for managing NIP-58 badges on Nostr. Create, issue, and display badges
                    to recognize community members and build reputation across the network.
                  </p>
                  <a
                    href="https://badgebox.rinbal.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center space-x-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    <IconExternalLink class="w-4 h-4" />
                    <span>Open BadgeBox</span>
                  </a>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Relay Settings -->
        <div v-if="activeTab === 'relays'">
          <NostrSettings @change-page="emit('change-page', $event)" />
        </div>

        <!-- Wallet Settings -->
        <div v-if="activeTab === 'wallet'">
          <SettingsConnections @change-page="emit('change-page', $event)" />
        </div>

        <!-- Notification Settings -->
        <div v-if="activeTab === 'alerts'">
          <NotificationSettings />
        </div>

        <!-- Reset Settings -->
        <div v-if="activeTab === 'reset'">
          <AccountReset />
        </div>

      </div>
    </div>
  </div>

  <BadgeDetailModal
    :show="showBadgeDetailModal"
    :badge="selectedBadge"
    @close="showBadgeDetailModal = false; selectedBadge = null"
  />

  <NostrProfileEditor
    :show="showProfileEditor"
    @close-editor="showProfileEditor = false"
    @profile-updated="handleProfileUpdated"
  />
</template>

<style scoped>
/* Hide scrollbar for mobile swipe navigation */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Smooth scroll behavior for tabs */
nav {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
</style>
