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
  IconUserX
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'
import NostrProfileEditor from './NostrProfileEditor.vue'

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

const newRelayUrl = ref('')
const addingRelay = ref(false)
const relayFormError = ref('')
const copySuccess = ref(false)
const refreshingProfile = ref(false)
const showProfileEditor = ref(false)
const showRelaySection = ref(false)
const refreshingRelays = ref(false)
const refreshingIndividualRelay = ref(new Set())

const minLoadingDuration = 800
const loadingStates = ref({
  login: false,
  logout: false,
  addRelay: false,
  refreshProfile: false,
  refreshRelays: false,
  copyAction: false
})

const withMinimumDuration = async (asyncFn, loadingKey) => {
  loadingStates.value[loadingKey] = true
  const startTime = Date.now()

  try {
    await asyncFn()
  } finally {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, minLoadingDuration - elapsed)

    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining))
    }

    loadingStates.value[loadingKey] = false
  }
}

onMounted(async () => {
  await initAuthAndRelays()
})

const handleLogin = async () => {
  await withMinimumDuration(async () => {
    try {
      await login()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }, 'login')
}

const handleLogout = async () => {
  await withMinimumDuration(async () => {
    logout()
  }, 'logout')
}

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

  await withMinimumDuration(async () => {
    relayFormError.value = ''
    try {
      await addRelay(newRelayUrl.value.trim())
      newRelayUrl.value = ''
    } catch (error) {
      relayFormError.value = error.message
    }
  }, 'addRelay')
}

const handleRemoveRelay = async (url) => {
  try {
    removeRelay(url)
  } catch (error) {
    console.error('Failed to remove relay:', error)
  }
}

const handleRefreshRelays = async () => {
  await withMinimumDuration(async () => {
    await checkAllRelayStatuses()
  }, 'refreshRelays')
}

const handleRefreshRelay = async (url) => {
  refreshingIndividualRelay.value.add(url)
  try {
    await checkRelayStatus(url)
  } finally {
    refreshingIndividualRelay.value.delete(url)
  }
}

const handleRefreshProfile = async () => {
  if (!isAuthenticated.value) return

  await withMinimumDuration(async () => {
    try {
      await refreshUserProfile()
    } catch (error) {
      console.error('Failed to refresh profile:', error)
    }
  }, 'refreshProfile')
}

const copyToClipboard = async (text) => {
  await withMinimumDuration(async () => {
    try {
      await navigator.clipboard.writeText(text)
      copySuccess.value = true
      setTimeout(() => {
        copySuccess.value = false
      }, 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }, 'copyAction')
}

const getRelayStatusColor = (status) => {
  switch (status) {
    case 'connected':
      return 'text-green-600 bg-green-100'
    case 'disconnected':
      return 'text-red-600 bg-red-100'
    case 'checking':
      return 'text-yellow-600 bg-yellow-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

const getRelayStatusIcon = (status) => {
  switch (status) {
    case 'connected':
      return IconWifi
    case 'disconnected':
      return IconWifiOff
    case 'checking':
      return IconLoader
    default:
      return IconWifiOff
  }
}

const formatRelayUrl = (url) => {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

const getUserAvatar = () => {
  return userProfile.value?.picture ||
         userProfile.value?.avatar ||
         'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
}

const getShortNpub = () => {
  if (!currentUser.value?.npub) return ''
  return currentUser.value.npub.substring(0, 20) + '...'
}

const handleEditProfile = () => {
  console.log('Attempting to open profile editor. Current showProfileEditor:', showProfileEditor.value);
  showProfileEditor.value = true;
  console.log('showProfileEditor after click:', showProfileEditor.value);
}

const handleProfileUpdated = () => {
  showProfileEditor.value = false;
  handleRefreshProfile();
}

const toggleRelaySection = () => {
  showRelaySection.value = !showRelaySection.value
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-semibold text-gray-900 mb-2">Nostr Identity</h2>
      <p class="text-gray-500">Manage your decentralized identity</p>
    </div>

    <!-- Not Authenticated State -->
    <div v-if="!isAuthenticated" class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div class="p-8 text-center">
        <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-purple-100 to-pink-100">
          <img
            src="/nostr-logo/nostr10.png"
            alt="Nostr Logo"
            class="w-12 h-12 object-contain"
          />
        </div>

        <h3 class="text-xl font-semibold text-gray-900 mb-3">Connect with Nostr</h3>
        <p class="text-gray-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
          Sign in with your Nostr identity to access decentralized social features and manage your profile.
        </p>

        <button
          @click="handleLogin"
          :disabled="isLoading || loadingStates.login"
          class="inline-flex items-center space-x-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconLoader v-if="isLoading || loadingStates.login" class="w-5 h-5 animate-spin" />
          <IconUser v-else class="w-5 h-5" />
          <span>{{ (isLoading || loadingStates.login) ? 'Connecting...' : 'Connect with Nostr' }}</span>
        </button>

        <div v-if="isLoading || loadingStates.login" class="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div class="flex items-start space-x-3">
            <IconLoader class="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
            <div class="flex-1 text-left">
              <p class="text-sm font-medium text-blue-900 mb-2">Waiting for authentication...</p>
              <p class="text-xs text-blue-700">
                Please complete the login process in your Nostr extension
              </p>
            </div>
          </div>
        </div>

        <div v-if="authError" class="mt-4 bg-red-50 border border-red-100 rounded-xl p-4">
          <div class="flex items-center space-x-2 justify-center">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-sm text-red-600">{{ authError }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Authenticated State -->
    <div v-else class="space-y-6">
      <!-- Profile Card -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-6">
          <div class="flex items-start justify-between mb-6">
            <div class="flex items-center space-x-4">
              <div class="relative">
                <div class="w-16 h-16 rounded-2xl overflow-hidden border-2 border-orange-200">
                  <img
                    :src="getUserAvatar()"
                    :alt="userProfile?.name || 'User'"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                  />
                </div>
                <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-white"></div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ userProfile?.name || 'Anonymous' }}
                </h3>
                <p class="text-sm text-gray-500 font-mono">
                  {{ getShortNpub() }}
                </p>
              </div>
            </div>

            <div class="flex items-center space-x-2">
              <button
                @click="handleEditProfile"
                class="p-2.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                title="Edit Profile"
              >
                <IconEdit class="w-5 h-5" />
              </button>

              <button
                @click="handleRefreshProfile"
                :disabled="loadingStates.refreshProfile"
                class="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all disabled:opacity-50"
                title="Refresh Profile"
              >
                <IconRefresh :class="['w-5 h-5', loadingStates.refreshProfile ? 'animate-spin' : '']" />
              </button>

              <button
                @click="handleLogout"
                :disabled="loadingStates.logout"
                class="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                title="Logout"
              >
                <IconLoader v-if="loadingStates.logout" class="w-5 h-5 animate-spin" />
                <IconX v-else class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 mb-6">
            <span class="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
              <IconUserCheck class="w-3.5 h-3.5 mr-1.5" />
              Connected
            </span>
            <span v-if="userProfile?.nip05" class="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
              <IconShield class="w-3.5 h-3.5 mr-1.5" />
              Verified
            </span>
            <span v-if="userProfile?.lud16" class="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium">
              <IconBolt class="w-3.5 h-3.5 mr-1.5" />
              Zap Ready
            </span>
          </div>

          <div class="space-y-3">
            <div class="p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                    <IconKey class="w-5 h-5 text-gray-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">Public Key</p>
                    <code class="text-xs text-gray-500 font-mono truncate block">{{ getShortNpub() }}</code>
                  </div>
                </div>
                <button
                  @click="copyToClipboard(currentUser.npub)"
                  :disabled="loadingStates.copyAction"
                  class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Copy public key"
                >
                  <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                  <IconCheck v-else-if="copySuccess" class="w-4 h-4 text-green-600" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div v-if="userProfile?.lud16" class="p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                    <IconBolt class="w-5 h-5 text-orange-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">Lightning Address</p>
                    <p class="text-xs text-orange-600 font-mono truncate">{{ userProfile.lud16 }}</p>
                  </div>
                </div>
                <button
                  @click="copyToClipboard(userProfile.lud16)"
                  :disabled="loadingStates.copyAction"
                  class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Copy Lightning address"
                >
                  <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div v-if="userProfile?.nip05" class="p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <IconShield class="w-5 h-5 text-blue-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">NIP-05 Verified</p>
                    <p class="text-xs text-blue-600 font-mono truncate">{{ userProfile.nip05 }}</p>
                  </div>
                </div>
                <button
                  @click="copyToClipboard(userProfile.nip05)"
                  :disabled="loadingStates.copyAction"
                  class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Copy NIP-05"
                >
                  <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div v-if="userProfile?.website" class="p-4 hover:bg-gray-50 rounded-xl transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <IconGlobe class="w-5 h-5 text-green-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">Website</p>
                    <p class="text-xs text-green-600 truncate">{{ userProfile.website }}</p>
                  </div>
                </div>
                <a
                  :href="userProfile.website"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Visit website"
                >
                  <IconExternalLink class="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Relay Network -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          @click="toggleRelaySection"
          class="w-full p-5 hover:bg-gray-50 transition-colors group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <IconPlugConnected class="w-5 h-5 text-blue-600" />
              </div>
              <div class="text-left">
                <h3 class="text-base font-semibold text-gray-900">Relay Network</h3>
                <p class="text-sm text-gray-500">
                  {{ connectedRelays.length }}/{{ userRelays.length }} relays connected
                  <span v-if="!showRelaySection" class="text-gray-400"> • Tap to manage</span>
                </p>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <button
                @click.stop="handleRefreshRelays"
                :disabled="loadingStates.refreshRelays"
                class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Refresh all relays"
              >
                <IconRefresh :class="['w-5 h-5', loadingStates.refreshRelays ? 'animate-spin' : '']" />
              </button>
              <component
                :is="showRelaySection ? IconChevronUp : IconChevronDown"
                class="w-5 h-5 text-gray-400 transition-transform"
              />
            </div>
          </div>
        </button>

        <div v-if="showRelaySection" class="border-t border-gray-100 p-5 space-y-4">
          <div class="bg-blue-50 rounded-xl p-4">
            <input
              v-model="newRelayUrl"
              type="text"
              placeholder="wss://relay.example.com"
              class="w-full px-4 py-2.5 border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-300 text-sm bg-white mb-3"
              @keyup.enter="handleAddRelay"
            />

            <button
              @click="handleAddRelay"
              :disabled="loadingStates.addRelay || !newRelayUrl.trim()"
              class="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconLoader v-if="loadingStates.addRelay" class="w-4 h-4 animate-spin" />
              <IconPlus v-else class="w-4 h-4" />
              <span>{{ loadingStates.addRelay ? 'Adding...' : 'Add Relay' }}</span>
            </button>

            <div v-if="relayFormError" class="mt-3 bg-red-50 border border-red-100 rounded-lg p-3">
              <div class="flex items-center space-x-2">
                <IconAlertCircle class="w-4 h-4 text-red-600" />
                <span class="text-sm text-red-600">{{ relayFormError }}</span>
              </div>
            </div>
          </div>

          <div v-if="userRelays.length === 0" class="text-center py-8">
            <IconPlugConnected class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p class="text-gray-600 text-sm">No relays configured</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="relay in userRelays"
              :key="relay.url"
              class="p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div :class="[
                    'w-2.5 h-2.5 rounded-full flex-shrink-0',
                    relay.status === 'connected' ? 'bg-green-400' :
                    relay.status === 'checking' ? 'bg-yellow-400' : 'bg-red-400'
                  ]"></div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2">
                      <h5 class="text-sm font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                      <div class="flex items-center space-x-1 flex-shrink-0">
                        <span v-if="relay.read" class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">R</span>
                        <span v-if="relay.write" class="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-semibold">W</span>
                      </div>
                    </div>
                    <p class="text-xs text-gray-500 truncate font-mono">{{ relay.url }}</p>
                  </div>
                </div>

                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click="handleRefreshRelay(relay.url)"
                    :disabled="refreshingIndividualRelay.has(relay.url)"
                    class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Refresh relay"
                  >
                    <IconRefresh :class="['w-4 h-4', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                  </button>

                  <button
                    @click="copyToClipboard(relay.url)"
                    :disabled="loadingStates.copyAction"
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-all"
                    title="Copy URL"
                  >
                    <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                    <IconCopy v-else class="w-4 h-4" />
                  </button>

                  <button
                    @click="handleRemoveRelay(relay.url)"
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove relay"
                  >
                    <IconTrash class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="relayError" class="bg-red-50 border border-red-100 rounded-xl p-3">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-4 h-4 text-red-600" />
              <span class="text-sm text-red-600">{{ relayError }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Security Notice -->
      <div class="bg-blue-50 border border-blue-100 rounded-2xl p-5">
        <div class="flex items-start space-x-3">
          <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <IconShield class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 class="font-semibold text-blue-900 mb-1">Privacy & Security</h4>
            <p class="text-sm text-blue-700 leading-relaxed">
              Your Nostr keys are managed by your browser extension. Your private keys never leave your device.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NostrProfileEditor
    :show="showProfileEditor"
    @close-editor="showProfileEditor = false"
    @profile-updated="handleProfileUpdated"
  />
</template>
