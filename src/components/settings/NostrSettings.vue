<script setup>
import { ref, onMounted } from 'vue'
import {
  IconUser,
  IconPlugConnected,
  IconEdit,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconWifi,
  IconWifiOff,
  IconLoader,
  IconCopy,
  IconExternalLink,
  IconShield,
  IconKey,
  IconGlobe,
  IconBolt,
  IconChevronDown,
  IconChevronUp,
  IconSettings,
  IconUserCheck,
  IconUserX,
  IconLogout
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import NostrProfileEditor from '../profile/NostrProfileEditor.vue'

const {
  currentUser,
  isLoading,
  authError,
  userRelays,
  relayError,
  isAuthenticated,
  userProfile,
  connectedRelays,
  readRelays,
  writeRelays,
  login,
  logout,
  addRelay,
  removeRelay,
  checkRelayStatus,
  checkAllRelayStatuses,
  validateRelayUrl,
  initAuthAndRelays,
  refreshUserProfile
} = useNostrAuth()

// Local state
const newRelayUrl = ref('')
const addingRelay = ref(false)
const relayFormError = ref('')
const copySuccess = ref(false)
const refreshingProfile = ref(false)
const showProfileEditor = ref(false)
const showRelaySection = ref(false)
const refreshingRelays = ref(false)
const refreshingIndividualRelay = ref(new Set())

// Initialize on mount
onMounted(async () => {
  await initAuthAndRelays()
})

// Handle login
const handleLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Handle logout
const handleLogout = async () => {
  logout()
}

// Handle add relay
const handleAddRelay = async () => {
  if (!newRelayUrl.value.trim()) {
    relayFormError.value = 'Please enter a relay URL'
    return
  }

  const validation = validateRelayUrl(newRelayUrl.value.trim())
  if (validation) {
    relayFormError.value = validation
    return
  }

  relayFormError.value = ''
  try {
    await addRelay(newRelayUrl.value.trim())
    newRelayUrl.value = ''
  } catch (error) {
    relayFormError.value = error.message
  }
}

// Handle remove relay
const handleRemoveRelay = async (url) => {
  try {
    removeRelay(url)
  } catch (error) {
    console.error('Failed to remove relay:', error)
  }
}

// Handle refresh all relays
const handleRefreshRelays = async () => {
  await checkAllRelayStatuses()
}

// Handle refresh single relay
const handleRefreshRelay = async (url) => {
  refreshingIndividualRelay.value.add(url)
  try {
    await checkRelayStatus(url)
  } finally {
    refreshingIndividualRelay.value.delete(url)
  }
}

// Handle refresh profile
const handleRefreshProfile = async () => {
  if (!isAuthenticated.value) return

  try {
    await refreshUserProfile()
  } catch (error) {
    console.error('Failed to refresh profile:', error)
  }
}

// Copy to clipboard
const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Get relay status color
const getRelayStatusColor = (status) => {
  switch (status) {
    case 'connected':
      return 'bg-green-500'
    case 'disconnected':
      return 'bg-gray-300'
    case 'checking':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-300'
  }
}

// Format relay URL for display
const formatRelayUrl = (url) => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

// Get user avatar
const getUserAvatar = () => {
  return userProfile.value?.picture ||
         userProfile.value?.avatar ||
         generateAvatar(currentUser.value?.pubkey)
}

// Get user banner
const getUserBanner = () => {
  return userProfile.value?.banner || null
}

// Get short npub for display
const getShortNpub = () => {
  if (!currentUser.value?.npub) return ''
  return currentUser.value.npub.substring(0, 12) + '...' + currentUser.value.npub.substring(currentUser.value.npub.length - 4)
}

// Handle profile edit
const handleEditProfile = () => {
  showProfileEditor.value = true
}

// Handle profile update
const handleProfileUpdated = () => {
  showProfileEditor.value = false
  handleRefreshProfile()
}

// Toggle relay section
const toggleRelaySection = () => {
  showRelaySection.value = !showRelaySection.value
}
</script>

<template>
  <div class="space-y-5">
    <!-- Not Authenticated State -->
    <div v-if="!isAuthenticated" class="max-w-md mx-auto">
      <div class="bg-white rounded-3xl p-10 sm:p-12 text-center shadow-sm border border-gray-100">
        <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-orange-100 to-orange-50">
          <img
            src="/nostr-logo/nostr10.png"
            alt="Nostr Logo"
            class="w-12 h-12 object-contain"
          />
        </div>

        <h2 class="text-2xl font-semibold text-gray-900 mb-2">Connect Your Identity</h2>
        <p class="text-gray-500 text-sm mb-6 leading-relaxed">
          Sign in with your Nostr identity to unlock social features.
        </p>

        <button
          @click="handleLogin"
          :disabled="isLoading"
          class="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-orange-500/20 transition-all duration-200 disabled:opacity-50"
        >
          <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
          <IconUser v-else class="w-4 h-4" />
          {{ isLoading ? 'Connecting...' : 'Connect with Nostr' }}
        </button>

        <!-- Auth Error -->
        <div v-if="authError" class="mt-4 bg-red-50 border border-red-100 rounded-xl p-3">
          <div class="flex items-center justify-center gap-2 text-sm text-red-600">
            <IconAlertCircle class="w-4 h-4 flex-shrink-0" />
            <span>{{ authError }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Authenticated State -->
    <div v-else class="space-y-5">
      <!-- Profile Card -->
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Compact Header with Banner Support -->
        <div class="h-32 sm:h-40 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 relative overflow-hidden">
          <img
            v-if="getUserBanner()"
            :src="getUserBanner()"
            alt="Profile banner"
            class="absolute inset-0 w-full h-full object-cover"
            @error="$event.target.style.display = 'none'"
          />
        </div>

        <!-- Profile Content -->
        <div class="px-5 sm:px-6 pb-6">
          <!-- Avatar & Name -->
          <div class="flex items-end justify-between -mt-10 sm:-mt-12 mb-4">
            <div class="relative">
              <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white">
                <img
                  :src="getUserAvatar()"
                  :alt="userProfile?.name || 'User'"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                />
              </div>
              <div class="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
            </div>

            <!-- Action Buttons - Desktop -->
            <div class="hidden sm:flex items-center gap-2">
              <button
                @click="handleEditProfile"
                class="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
              >
                Edit Profile
              </button>
              <button
                @click="handleRefreshProfile"
                class="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                title="Refresh"
              >
                <IconRefresh class="w-4 h-4" />
              </button>
              <button
                @click="handleLogout"
                class="w-9 h-9 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <IconLogout class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Profile Info -->
          <div class="mb-4">
            <h2 class="text-xl font-bold text-gray-900">
              {{ userProfile?.name || 'Anonymous' }}
            </h2>
            <p class="text-gray-500 text-xs font-mono mt-0.5">{{ getShortNpub() }}</p>
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
                  <code class="text-xs text-gray-900 font-mono truncate block">{{ getShortNpub() }}</code>
                </div>
              </div>
              <button
                @click="copyToClipboard(currentUser.npub)"
                class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
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

          <!-- Mobile Action Buttons -->
          <div class="flex sm:hidden gap-2">
            <button
              @click="handleEditProfile"
              class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <IconEdit class="w-4 h-4" />
              Edit
            </button>
            <button
              @click="handleRefreshProfile"
              class="w-11 h-11 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              <IconRefresh class="w-4 h-4" />
            </button>
            <button
              @click="handleLogout"
              class="w-11 h-11 flex items-center justify-center bg-gray-100 text-gray-700 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <IconLogout class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Relay Network -->
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Header -->
        <button
          @click="toggleRelaySection"
          class="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <IconPlugConnected class="w-5 h-5 text-blue-600" />
            </div>
            <div class="text-left">
              <h3 class="text-base font-semibold text-gray-900">Relay Network</h3>
              <p class="text-xs text-gray-500">
                {{ connectedRelays.length }}/{{ userRelays.length }} connected
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click.stop="handleRefreshRelays"
              class="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <IconRefresh class="w-4 h-4" />
            </button>
            <IconChevronDown
              :class="['w-5 h-5 text-gray-400 transition-transform', showRelaySection && 'rotate-180']"
            />
          </div>
        </button>

        <!-- Relay Content -->
        <transition
          enter-active-class="transition-all duration-200"
          leave-active-class="transition-all duration-200"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-[2000px]"
          leave-from-class="opacity-100 max-h-[2000px]"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="showRelaySection" class="px-5 pb-5 border-t border-gray-100">
            <!-- Stats -->
            <div class="grid grid-cols-4 gap-2 my-4">
              <div class="bg-green-50 rounded-xl p-2.5 text-center">
                <div class="text-lg font-bold text-green-600">{{ connectedRelays.length }}</div>
                <div class="text-xs text-green-700">Online</div>
              </div>
              <div class="bg-blue-50 rounded-xl p-2.5 text-center">
                <div class="text-lg font-bold text-blue-600">{{ readRelays.length }}</div>
                <div class="text-xs text-blue-700">Read</div>
              </div>
              <div class="bg-purple-50 rounded-xl p-2.5 text-center">
                <div class="text-lg font-bold text-purple-600">{{ writeRelays.length }}</div>
                <div class="text-xs text-purple-700">Write</div>
              </div>
              <div class="bg-gray-50 rounded-xl p-2.5 text-center">
                <div class="text-lg font-bold text-gray-600">{{ userRelays.length }}</div>
                <div class="text-xs text-gray-700">Total</div>
              </div>
            </div>

            <!-- Add Relay -->
            <div class="bg-orange-50 rounded-xl p-3 mb-3">
              <div class="flex gap-2">
                <input
                  v-model="newRelayUrl"
                  type="text"
                  placeholder="wss://relay.example.com"
                  class="flex-1 px-3 py-2 text-sm border-0 bg-white rounded-lg focus:ring-2 focus:ring-orange-500"
                  @keyup.enter="handleAddRelay"
                />
                <button
                  @click="handleAddRelay"
                  :disabled="!newRelayUrl.trim()"
                  class="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  <IconPlus class="w-4 h-4" />
                </button>
              </div>
              <div v-if="relayFormError" class="mt-2 text-xs text-red-600 flex items-center gap-1">
                <IconAlertCircle class="w-3 h-3" />
                {{ relayFormError }}
              </div>
            </div>

            <!-- Relay List -->
            <div class="space-y-1.5">
              <div v-if="userRelays.length === 0" class="text-center py-8">
                <IconPlugConnected class="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p class="text-sm text-gray-500">No relays configured</p>
              </div>

              <div
                v-for="relay in userRelays"
                :key="relay.url"
                class="group flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div class="flex items-center gap-2.5 flex-1 min-w-0">
                  <div :class="['w-2 h-2 rounded-full flex-shrink-0', getRelayStatusColor(relay.status)]"></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <h5 class="text-xs font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                      <span v-if="relay.read" class="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold leading-none">R</span>
                      <span v-if="relay.write" class="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold leading-none">W</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click="handleRefreshRelay(relay.url)"
                    class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <IconRefresh :class="['w-3.5 h-3.5', refreshingIndividualRelay.has(relay.url) && 'animate-spin']" />
                  </button>
                  <button
                    @click="handleRemoveRelay(relay.url)"
                    class="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <IconTrash class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Security Notice -->
      <div class="bg-blue-50 rounded-3xl p-4 border border-blue-100">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <IconShield class="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h4 class="font-medium text-gray-900 text-sm mb-1">Privacy & Security</h4>
            <p class="text-xs text-gray-600 leading-relaxed">
              Your keys are managed by your browser extension. ZapTracker only reads your public profile. Private keys never leave your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Profile Editor Modal -->
  <NostrProfileEditor
    :show="showProfileEditor"
    @close-editor="showProfileEditor = false"
    @profile-updated="handleProfileUpdated"
  />
</template>

<style scoped>
button:active:not(:disabled) {
  transform: scale(0.98);
}

* {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
