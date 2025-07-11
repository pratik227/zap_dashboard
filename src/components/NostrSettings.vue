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
  IconBolt
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

// Local state
const newRelayUrl = ref('')
const addingRelay = ref(false)
const relayFormError = ref('')
const copySuccess = ref(false)
const refreshingProfile = ref(false)

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
const handleLogout = () => {
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

  addingRelay.value = true
  relayFormError.value = ''

  try {
    await addRelay(newRelayUrl.value.trim())
    newRelayUrl.value = ''
  } catch (error) {
    relayFormError.value = error.message
  } finally {
    addingRelay.value = false
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
  await checkRelayStatus(url)
}

// Handle refresh profile
const handleRefreshProfile = async () => {
  if (!isAuthenticated.value) return
  
  refreshingProfile.value = true
  try {
    await refreshUserProfile()
  } catch (error) {
    console.error('Failed to refresh profile:', error)
  } finally {
    refreshingProfile.value = false
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
      return 'text-green-600 bg-green-100'
    case 'disconnected':
      return 'text-red-600 bg-red-100'
    case 'checking':
      return 'text-yellow-600 bg-yellow-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

// Get relay status icon
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
         'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
}

// Get short npub for display
const getShortNpub = () => {
  if (!currentUser.value?.npub) return ''
  return currentUser.value.npub.substring(0, 20) + '...'
}
const showProfileEditor = ref(false)

// Handle profile edit
const handleEditProfile = () => {
  showProfileEditor.value = true
}

// Handle profile update
const handleProfileUpdated = () => {
  showProfileEditor.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Profile Section -->
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Nostr Profile</h3>
      <p class="text-gray-600 text-sm mb-6">Connect with your Nostr identity to access decentralized features and manage your profile</p>
      
      <!-- Not Authenticated -->
      <div v-if="!isAuthenticated" class="bg-white rounded-lg border border-gray-200 p-6">
        <div class="text-center">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <img 
              src="/nostr-logo/nostr10.png" 
              alt="Nostr Logo" 
              class="w-16 h-16 object-contain"
            />
          </div>
          
          <h4 class="text-lg font-medium text-gray-900 mb-2">Connect with Nostr</h4>
          <p class="text-gray-600 text-sm mb-6">
            Sign in with your Nostr identity to access decentralized social features and manage your profile.
          </p>
          
          <button
            @click="handleLogin"
            :disabled="isLoading"
            class="btn-primary"
          >
            <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
            <IconUser v-else class="w-4 h-4" />
            {{ isLoading ? 'Connecting...' : 'Connect with Nostr' }}
          </button>
          
          <!-- Auth Error -->
          <div v-if="authError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-4 h-4 text-red-600" />
              <span class="text-sm text-red-600">{{ authError }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Authenticated -->
      <div v-else class="bg-white rounded-lg border border-gray-200 p-6">
        <!-- Profile Editor -->
        <div v-if="showProfileEditor">
          <NostrProfileEditor 
            @close-editor="showProfileEditor = false"
            @profile-updated="handleProfileUpdated"
          />
        </div>
        
        <!-- Profile Display -->
        <div v-else>
          <div class="flex items-start justify-between">
            <div class="flex items-start space-x-4 flex-1">
              <img 
                :src="getUserAvatar()" 
                :alt="userProfile?.name || 'User'"
                class="w-16 h-16 rounded-full border-2 border-purple-200"
                @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
              />
              <div class="flex-1 min-w-0">
                <h4 class="text-lg font-medium text-gray-900">{{ userProfile?.name || 'Anonymous' }}</h4>
                
                <!-- Display name if different from name, otherwise show about -->
                <p v-if="userProfile?.display_name && userProfile?.display_name !== userProfile?.name" class="text-sm text-gray-600 mb-3">
                  {{ userProfile.display_name }}
                </p>
                <p v-else-if="userProfile?.about" class="text-sm text-gray-600 mb-3 line-clamp-2">
                  {{ userProfile.about }}
                </p>
                
                <!-- Profile Details -->
                <div class="space-y-2">
                  <!-- NPub -->
                  <div class="flex items-center space-x-2">
                    <IconKey class="w-4 h-4 text-gray-400" />
                    <code class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {{ getShortNpub() }}
                    </code>
                    <button
                      @click="copyToClipboard(currentUser.npub)"
                      class="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy npub"
                    >
                      <IconCheck v-if="copySuccess" class="w-3 h-3 text-green-600" />
                      <IconCopy v-else class="w-3 h-3" />
                    </button>
                  </div>
                  
                  <!-- NIP-05 -->
                  <div v-if="userProfile?.nip05" class="flex items-center space-x-2">
                    <IconShield class="w-4 h-4 text-green-500" />
                    <span class="text-xs text-green-600">{{ userProfile.nip05 }}</span>
                  </div>
                  
                  <!-- Lightning Address (LUD16) -->
                  <div v-if="userProfile?.lud16" class="flex items-center space-x-2">
                    <IconBolt class="w-4 h-4 text-orange-500" />
                    <span class="text-xs text-orange-600">{{ userProfile.lud16 }}</span>
                  </div>
                  
                  <!-- Website -->
                  <div v-if="userProfile?.website" class="flex items-center space-x-2">
                    <IconGlobe class="w-4 h-4 text-blue-500" />
                    <a 
                      :href="userProfile.website" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {{ userProfile.website }}
                      <IconExternalLink class="w-3 h-3 inline ml-1" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="flex flex-col space-y-2">
              <div class="text-right">
                <div class="text-sm font-medium text-green-600">Connected</div>
                <div class="text-xs text-gray-500">{{ connectedRelays.length }} relays</div>
              </div>
              
              <div class="flex space-x-2">
                <button
                  @click="handleEditProfile"
                  class="p-2 rounded-lg text-purple-600 hover:text-purple-700 hover:bg-purple-50 flex items-center justify-center"
                  title="Edit profile"
                >
                  <IconEdit class="w-3 h-3" />
                  <span class="hidden sm:ml-1 sm:inline text-xs">Edit</span>
                </button>
                
                <button
                  @click="handleRefreshProfile"
                  :disabled="refreshingProfile"
                  class="p-2 rounded-lg text-gray-600 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                  title="Refresh profile"
                >
                  <IconRefresh :class="['w-3 h-3', refreshingProfile ? 'animate-spin' : '']" />
                  <span class="hidden sm:ml-1 sm:inline text-xs">Refresh</span>
                </button>
                
                <button
                  @click="handleLogout"
                  class="p-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center justify-center"
                  title="Logout"
                >
                  <IconX class="w-3 h-3" />
                  <span class="hidden sm:ml-1 sm:inline text-xs">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Relay Management Section -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Relay Management</h3>
          <p class="text-gray-600 text-sm">Manage your Nostr relay connections for optimal performance</p>
        </div>
        <button
          @click="handleRefreshRelays"
          :disabled="isLoading"
          class="btn-secondary text-sm"
        >
          <IconRefresh :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
          Refresh All
        </button>
      </div>
      
      <!-- Relay Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-2xl font-bold text-gray-900">{{ userRelays.length }}</div>
          <div class="text-sm text-gray-600">Total Relays</div>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-2xl font-bold text-green-600">{{ connectedRelays.length }}</div>
          <div class="text-sm text-gray-600">Connected</div>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-2xl font-bold text-blue-600">{{ readRelays.length }}</div>
          <div class="text-sm text-gray-600">Read Enabled</div>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-2xl font-bold text-purple-600">{{ writeRelays.length }}</div>
          <div class="text-sm text-gray-600">Write Enabled</div>
        </div>
      </div>
      
      <!-- Add Relay Form -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div class="flex items-center space-x-3">
          <div class="flex-1">
            <input
              v-model="newRelayUrl"
              type="text"
              placeholder="wss://relay.example.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-sm"
              @keyup.enter="handleAddRelay"
            />
          </div>
          <button
            @click="handleAddRelay"
            :disabled="addingRelay || !newRelayUrl.trim()"
            class="btn-primary text-sm"
          >
            <IconLoader v-if="addingRelay" class="w-4 h-4 animate-spin" />
            <IconPlus v-else class="w-4 h-4" />
            Add Relay
          </button>
        </div>
        
        <!-- Form Error -->
        <div v-if="relayFormError" class="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-4 h-4 text-red-600" />
            <span class="text-sm text-red-600">{{ relayFormError }}</span>
          </div>
        </div>
      </div>
      
      <!-- Relay List -->
      <div class="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        <div
          v-for="relay in userRelays"
          :key="relay.url"
          class="p-4 hover:bg-gray-50 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <!-- Status Icon -->
              <div :class="[
                'w-8 h-8 rounded-full flex items-center justify-center',
                getRelayStatusColor(relay.status)
              ]">
                <component 
                  :is="getRelayStatusIcon(relay.status)" 
                  :class="[
                    'w-4 h-4',
                    relay.status === 'checking' ? 'animate-spin' : ''
                  ]"
                />
              </div>
              
              <!-- Relay Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-2">
                  <h4 class="font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h4>
                  <span :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    getRelayStatusColor(relay.status)
                  ]">
                    {{ relay.status }}
                  </span>
                </div>
                <div class="flex items-center space-x-4 mt-1">
                  <code class="text-xs text-gray-500 truncate max-w-xs">{{ relay.url }}</code>
                  <div class="flex items-center space-x-2 text-xs text-gray-500">
                    <span v-if="relay.read" class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Read</span>
                    <span v-if="relay.write" class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Write</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center space-x-2">
              <button
                @click="handleRefreshRelay(relay.url)"
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh relay status"
              >
                <IconRefresh class="w-4 h-4" />
              </button>
              
              <button
                @click="copyToClipboard(relay.url)"
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy relay URL"
              >
                <IconCopy class="w-4 h-4" />
              </button>
              
              <button
                @click="handleRemoveRelay(relay.url)"
                title="Remove relay"
                class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <IconTrash class="w-4 h-4" />
              </button>
              <button
                @click="$emit('change-page', 'account-reset')"
                class="p-2 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center justify-center"
                title="Reset all account data"
              >
                <IconRefresh class="w-3 h-3" />
                <span class="hidden sm:ml-1 sm:inline text-xs">Reset</span>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Empty State -->
        <div v-if="userRelays.length === 0" class="p-8 text-center">
          <IconPlugConnected class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No relays configured</h4>
          <p class="text-gray-600 text-sm">Add your first relay to start connecting to the Nostr network</p>
        </div>
      </div>
      
      <!-- Relay Error -->
      <div v-if="relayError" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-4 h-4 text-red-600" />
          <span class="text-sm text-red-600">{{ relayError }}</span>
        </div>
      </div>
    </div>

    <!-- Security Notice -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <IconShield class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 class="font-medium text-blue-900 mb-1">Privacy & Security</h4>
          <p class="text-sm text-blue-800">
            Your Nostr keys are managed by your browser extension or client. This application only reads your public profile and relay preferences.
          </p>
        </div>
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