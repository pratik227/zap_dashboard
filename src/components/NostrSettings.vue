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

// Local state
const newRelayUrl = ref('')
const addingRelay = ref(false)
const relayFormError = ref('')
const copySuccess = ref(false)
const refreshingProfile = ref(false)
const showProfileEditor = ref(false) // Controls the visibility of the ProfileEditor modal
const showRelaySection = ref(false) // Default to collapsed for cleaner initial experience
const refreshingRelays = ref(false)
const refreshingIndividualRelay = ref(new Set())

// Enhanced loading states with minimum duration for better UX
const minLoadingDuration = 800 // Minimum loading time in ms
const loadingStates = ref({
  login: false,
  logout: false,
  addRelay: false,
  refreshProfile: false,
  refreshRelays: false,
  copyAction: false
})

// Helper function to ensure minimum loading duration
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

// Initialize on mount
onMounted(async () => {
  await initAuthAndRelays()
})

// Handle login
const handleLogin = async () => {
  await withMinimumDuration(async () => {
    try {
      await login()
    } catch (error) {
      console.error('Login failed:', error)
    }
  }, 'login')
}

// Handle logout
const handleLogout = async () => {
  await withMinimumDuration(async () => {
    logout()
  }, 'logout')
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

// Handle remove relay
const handleRemoveRelay = async (url) => {
  try {
    removeRelay(url)
  } catch (error) {
    console.error('Failed to remove relay:', error)
  }
}

// Handle refresh all relays with visual feedback
const handleRefreshRelays = async () => {
  await withMinimumDuration(async () => {
    await checkAllRelayStatuses()
  }, 'refreshRelays')
}

// Handle refresh single relay with visual feedback
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
  
  await withMinimumDuration(async () => {
    try {
      await refreshUserProfile()
    } catch (error) {
      console.error('Failed to refresh profile:', error)
    }
  }, 'refreshProfile')
}

// Copy to clipboard
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

// Handle profile edit
const handleEditProfile = () => {
  console.log('Attempting to open profile editor. Current showProfileEditor:', showProfileEditor.value);
  showProfileEditor.value = true;
  console.log('showProfileEditor after click:', showProfileEditor.value);
}

// Handle profile update
const handleProfileUpdated = () => {
  showProfileEditor.value = false;
  // Optionally refresh user profile data after update
  handleRefreshProfile();
}

// Toggle relay section
const toggleRelaySection = () => {
  showRelaySection.value = !showRelaySection.value
}
</script>

<template>
  <div class="space-y-6">
    <!-- Profile Section -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <!-- Section Header -->
      <div class="p-4 sm:p-6 border-b border-orange-100/50 bg-gradient-to-r from-orange-50 to-amber-50">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <IconUser class="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Nostr Identity</h3>
            <p class="text-sm text-gray-600">Manage your decentralized identity</p>
          </div>
        </div>
      </div>
      
      <!-- Not Authenticated State -->
      <div v-if="!isAuthenticated" class="p-4 sm:p-6">
        <div class="text-center py-6">
          <div class="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-r from-purple-100 to-pink-100">
            <img 
              src="/nostr-logo/nostr10.png" 
              alt="Nostr Logo" 
              class="w-12 h-12 object-contain"
            />
          </div>
          
          <h4 class="text-xl font-semibold text-gray-900 mb-3">Connect with Nostr</h4>
          <p class="text-gray-600 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            Sign in with your Nostr identity to access decentralized social features and manage your profile.
          </p>
          
          <button
            @click="handleLogin"
            :disabled="isLoading || loadingStates.login"
            class="btn-primary w-full sm:w-auto"
          >
            <IconLoader v-if="isLoading || loadingStates.login" class="w-4 h-4 animate-spin" />
            <IconUser v-else class="w-4 h-4" />
            {{ (isLoading || loadingStates.login) ? 'Connecting...' : 'Connect with Nostr' }}
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
      
      <!-- Authenticated State -->
      <div v-else class="p-4 sm:p-6">
        <!-- Compact Profile Card - Vue Bits Inspired -->
        <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <!-- Compact Header -->
          <div class="p-4 border-b border-gray-100">
            <div class="flex items-center justify-between">
              <!-- Left: Avatar + Info -->
              <div class="flex items-center space-x-3">
                <div class="relative">
                  <div class="w-12 h-12 rounded-xl overflow-hidden border-2 border-orange-200">
                    <img 
                      :src="getUserAvatar()" 
                      :alt="userProfile?.name || 'User'"
                      class="w-full h-full object-cover"
                      @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                    />
                  </div>
                  <!-- Status dot -->
                  <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 rounded-full border-2 border-white shadow-sm"></div>
                </div>
                
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-gray-900 truncate">
                    {{ userProfile?.name || 'Anonymous' }}
                  </h3>
                  <p class="text-sm text-gray-500 truncate">
                    {{ getShortNpub() }}
                  </p>
                </div>
              </div>
              
              <!-- Right: Action Buttons -->
              <div class="flex items-center space-x-2">
                <button
                  @click="handleEditProfile"
                  class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 touch-target"
                  title="Edit Profile"
                >
                  <IconEdit class="w-4 h-4" />
                </button>
                
                <button
                  @click="handleRefreshProfile"
                  :disabled="loadingStates.refreshProfile"
                  class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
                  title="Refresh Profile"
                >
                  <IconRefresh :class="['w-4 h-4', loadingStates.refreshProfile ? 'animate-spin' : '']" />
                </button>
                
                <button
                  @click="handleLogout"
                  :disabled="loadingStates.logout"
                  class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50 touch-target"
                  title="Logout"
                >
                  <IconLoader v-if="loadingStates.logout" class="w-4 h-4 animate-spin" />
                  <IconX v-else class="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <!-- Status Badges -->
            <div class="flex flex-wrap gap-2 mt-3">
              <span class="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                <IconUserCheck class="w-3 h-3 mr-1" />
                Connected
              </span>
              <span v-if="userProfile?.nip05" class="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                <IconShield class="w-3 h-3 mr-1" />
                Verified
              </span>
              <span v-if="userProfile?.lud16" class="inline-flex items-center px-2 py-1 bg-orange-50 text-orange-700 rounded-md text-xs font-medium">
                <IconBolt class="w-3 h-3 mr-1" />
                Zap Ready
              </span>
            </div>
          </div>
          
          <!-- Profile Details List -->
          <div class="divide-y divide-gray-100">
            <!-- Public Key -->
            <div class="p-3 hover:bg-gray-50 transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <IconKey class="w-4 h-4 text-gray-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">Public Key</p>
                    <code class="text-xs text-gray-500 font-mono truncate block">{{ getShortNpub() }}</code>
                  </div>
                </div>
                <button
                  @click="copyToClipboard(currentUser.npub)"
                  :disabled="loadingStates.copyAction"
                  class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Copy public key"
                >
                  <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                  <IconCheck v-else-if="copySuccess" class="w-4 h-4 text-green-600" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Lightning Address -->
            <div v-if="userProfile?.lud16" class="p-3 hover:bg-orange-25 transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <IconBolt class="w-4 h-4 text-orange-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">Lightning Address</p>
                    <p class="text-xs text-orange-600 font-mono truncate">{{ userProfile.lud16 }}</p>
                  </div>
                </div>
                <button
                  @click="copyToClipboard(userProfile.lud16)"
                  :disabled="loadingStates.copyAction"
                  class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Copy Lightning address"
                >
                  <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- NIP-05 Verification -->
            <div v-if="userProfile?.nip05" class="p-3 hover:bg-blue-25 transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <IconShield class="w-4 h-4 text-blue-600" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">NIP-05 Verified</p>
                    <p class="text-xs text-blue-600 font-mono truncate">{{ userProfile.nip05 }}</p>
                  </div>
                </div>
                <button
                  @click="copyToClipboard(userProfile.nip05)"
                  :disabled="loadingStates.copyAction"
                  class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Copy NIP-05"
                >
                  <IconLoader v-if="loadingStates.copyAction" class="w-4 h-4 animate-spin" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Website -->
            <div v-if="userProfile?.website" class="p-3 hover:bg-green-25 transition-colors group">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3 flex-1 min-w-0">
                  <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <IconGlobe class="w-4 h-4 text-green-600" />
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
                  class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Visit website"
                >
                  <IconExternalLink class="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Relay Management Section -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <!-- Collapsible Header -->
      <button
        @click="toggleRelaySection"
        class="w-full p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 group"
        :class="{ 'border-b border-orange-100/50': showRelaySection }"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <IconPlugConnected class="w-5 h-5 text-blue-600" />
            </div>
            <div class="text-left">
              <h3 class="text-lg font-semibold text-gray-900">Relay Network</h3>
              <p class="text-sm text-gray-600">
                {{ connectedRelays.length }}/{{ userRelays.length }} relays connected
                <span v-if="!showRelaySection" class="text-gray-400">• Tap to manage</span>
              </p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <button
              @click.stop="handleRefreshRelays"
              :disabled="loadingStates.refreshRelays"
              class="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-110"
              title="Refresh all relays"
            >
              <IconRefresh :class="['w-5 h-5', loadingStates.refreshRelays ? 'animate-spin' : '']" />
            </button>
            <component 
              :is="showRelaySection ? IconChevronUp : IconChevronDown" 
              class="w-5 h-5 text-gray-400 transition-all duration-300 group-hover:text-blue-600" 
              :class="{ 'rotate-180': showRelaySection }"
            />
          </div>
        </div>
      </button>
      
      <!-- Relay Content (Collapsible) -->
      <transition 
        name="relay-section"
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-300 ease-in"
        enter-from-class="opacity-0 max-h-0 transform -translate-y-2"
        enter-to-class="opacity-100 max-h-[1000px] transform translate-y-0"
        leave-from-class="opacity-100 max-h-[1000px] transform translate-y-0"
        leave-to-class="opacity-0 max-h-0 transform -translate-y-2"
      >
        <div v-if="showRelaySection" class="p-4 sm:p-6">
          <!-- Relay Stats Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2.5 text-center border border-green-200/50">
              <div class="text-xl font-bold text-green-600">{{ connectedRelays.length }}</div>
              <div class="text-xs text-green-700 font-medium mt-0.5">Connected</div>
            </div>
            <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-2.5 text-center border border-blue-200/50">
              <div class="text-xl font-bold text-blue-600">{{ readRelays.length }}</div>
              <div class="text-xs text-blue-700 font-medium mt-0.5">Read</div>
            </div>
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2.5 text-center border border-purple-200/50">
              <div class="text-xl font-bold text-purple-600">{{ writeRelays.length }}</div>
              <div class="text-xs text-purple-700 font-medium mt-0.5">Write</div>
            </div>
            <div class="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-2.5 text-center border border-gray-200/50">
              <div class="text-xl font-bold text-gray-600">{{ userRelays.length }}</div>
              <div class="text-xs text-gray-700 font-medium mt-0.5">Total</div>
            </div>
          </div>
          
          <!-- Add Relay Form -->
          <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200/50 p-3 mb-4">
            <h4 class="font-medium text-gray-900 mb-2 flex items-center space-x-2">
              <IconPlus class="w-3.5 h-3.5 text-orange-600" />
              <span>Add New Relay</span>
            </h4>
            
            <div class="space-y-2">
              <input
                v-model="newRelayUrl"
                type="text"
                placeholder="wss://relay.example.com"
                class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-white/80"
                @keyup.enter="handleAddRelay"
              />
              
              <div class="flex flex-col sm:flex-row gap-2">
                <button
                  @click="handleAddRelay"
                  :disabled="loadingStates.addRelay || !newRelayUrl.trim()"
                  class="btn-primary flex-1 sm:flex-none text-sm"
                >
                  <IconLoader v-if="loadingStates.addRelay" class="w-4 h-4 animate-spin" />
                  <IconPlus v-else class="w-4 h-4" />
                  {{ loadingStates.addRelay ? 'Adding...' : 'Add Relay' }}
                </button>
              </div>
              
              <!-- Form Error -->
              <div v-if="relayFormError" class="bg-red-50 border border-red-200/50 rounded-lg p-3">
                <div class="flex items-center space-x-2">
                  <IconAlertCircle class="w-3.5 h-3.5 text-red-600" />
                  <span class="text-sm text-red-600">{{ relayFormError }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Relay List -->
          <div class="space-y-2">
            <h4 class="font-medium text-gray-900 flex items-center space-x-2">
              <IconSettings class="w-3.5 h-3.5 text-gray-600" />
              <span>Your Relays</span>
            </h4>
            
            <div v-if="userRelays.length === 0" class="text-center py-8">
              <IconPlugConnected class="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <h4 class="text-lg font-medium text-gray-900 mb-2">No relays configured</h4>
              <p class="text-gray-600 text-sm">Add your first relay to start connecting to the Nostr network</p>
            </div>
            
            <div v-else class="space-y-1.5">
              <div
                v-for="relay in userRelays"
                :key="relay.url"
                class="bg-white rounded-lg border border-gray-100 p-2.5 hover:shadow-md hover:border-gray-200 transition-all duration-200"
              >
                <!-- Mobile Layout -->
                <div class="block sm:hidden">
                  <!-- Compact mobile layout -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 flex-1 min-w-0">
                      <!-- Status dot -->
                      <div :class="[
                        'w-2.5 h-2.5 rounded-full flex-shrink-0',
                        relay.status === 'connected' ? 'bg-green-400 animate-pulse' : 
                        relay.status === 'checking' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                      ]"></div>
                      
                      <!-- Relay info -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-1.5">
                          <h5 class="text-xs font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                          <!-- Compact badges -->
                          <div class="flex items-center space-x-0.5 flex-shrink-0">
                            <span v-if="relay.read" class="w-3.5 h-3.5 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center justify-center leading-none">R</span>
                            <span v-if="relay.write" class="w-3.5 h-3.5 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center justify-center leading-none">W</span>
                          </div>
                        </div>
                        <p class="text-xs text-gray-400 truncate font-mono">{{ relay.url }}</p>
                      </div>
                    </div>
                    
                    <!-- Compact action buttons -->
                    <div class="flex items-center space-x-0.5 flex-shrink-0">
                      <button
                        @click="handleRefreshRelay(relay.url)"
                        :disabled="refreshingIndividualRelay.has(relay.url)"
                        class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200 disabled:opacity-50"
                        title="Refresh relay"
                      >
                        <IconRefresh :class="['w-3 h-3', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                      </button>
                      
                      <button
                        @click="copyToClipboard(relay.url)"
                        :disabled="loadingStates.copyAction"
                        class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all duration-200 disabled:opacity-50"
                        title="Copy URL"
                      >
                        <IconLoader v-if="loadingStates.copyAction" class="w-3 h-3 animate-spin" />
                        <IconCopy v-else class="w-3 h-3" />
                      </button>
                      
                      <button
                        @click="handleRemoveRelay(relay.url)"
                        class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-200"
                        title="Remove relay"
                      >
                        <IconTrash class="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Desktop Layout -->
                <div class="hidden sm:flex items-center justify-between py-0.5">
                  <div class="flex items-center space-x-2.5 flex-1 min-w-0">
                    <!-- Compact status indicator -->
                    <div :class="[
                      'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                      getRelayStatusColor(relay.status)
                    ]">
                      <component 
                        :is="getRelayStatusIcon(relay.status)" 
                        :class="[
                          'w-2.5 h-2.5',
                          relay.status === 'checking' || refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : ''
                        ]"
                      />
                    </div>
                    
                    <!-- Streamlined relay info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-1.5">
                        <h5 class="text-xs font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                        <!-- Compact status and badges -->
                        <div class="flex items-center space-x-0.5 flex-shrink-0">
                          <span v-if="relay.read" class="w-4 h-4 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center justify-center leading-none">R</span>
                          <span v-if="relay.write" class="w-4 h-4 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center justify-center leading-none">W</span>
                        </div>
                      </div>
                      <code class="text-xs text-gray-400 truncate max-w-sm font-mono">{{ relay.url }}</code>
                    </div>
                  </div>
                  
                  <!-- Compact actions -->
                  <div class="flex items-center space-x-0.5 flex-shrink-0">
                    <button
                      @click="handleRefreshRelay(relay.url)"
                      :disabled="refreshingIndividualRelay.has(relay.url)"
                      class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200 disabled:opacity-50"
                      title="Refresh relay status"
                    >
                      <IconRefresh :class="['w-3 h-3', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                    </button>
                    
                    <button
                      @click="copyToClipboard(relay.url)"
                      :disabled="loadingStates.copyAction"
                      class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all duration-200 disabled:opacity-50"
                      title="Copy relay URL"
                    >
                      <IconLoader v-if="loadingStates.copyAction" class="w-3 h-3 animate-spin" />
                      <IconCopy v-else class="w-3 h-3" />
                    </button>
                    
                    <button
                      @click="handleRemoveRelay(relay.url)"
                      title="Remove relay"
                      class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-200"
                    >
                      <IconTrash class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Relay Error -->
          <div v-if="relayError" class="mt-3 bg-red-50 border border-red-200/50 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-4 h-4 text-red-600" />
              <span class="text-sm text-red-600">{{ relayError }}</span>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- Security Notice -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 sm:p-6">
      <div class="flex items-start space-x-3">
        <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconShield class="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h4 class="font-semibold text-blue-900 mb-2">Privacy & Security</h4>
          <p class="text-sm text-blue-800 leading-relaxed">
            Your Nostr keys are managed by your browser extension or client. ZapTracker only reads your public profile and relay preferences. Your private keys never leave your device.
          </p>
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
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Slide down animation for collapsible content */
.relay-section-enter-active,
.relay-section-leave-active {
  transition: all 0.3s ease-out;
  overflow: hidden;
}

.relay-section-enter-from {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.relay-section-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
}

.relay-section-enter-to,
.relay-section-leave-from {
  opacity: 1;
  max-height: 1000px; /* A large enough value to allow content to expand */
  transform: translateY(0);
}

/* Enhanced touch targets for mobile */
@media (max-width: 640px) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Status indicator animations */
@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pulse-yellow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.bg-green-400.animate-pulse {
  animation: pulse-green 2s infinite;
}

.bg-yellow-400.animate-pulse {
  animation: pulse-yellow 1.5s infinite;
}

/* Enhanced focus states for accessibility */
button:focus-visible {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}

input:focus-visible {
  outline: 2px solid #fb923c;
  outline-offset: 2px;
}

/* Improved button interactions */
.btn-primary {
  transition: all 0.2s ease-out;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.3);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

/* Smooth hover animations for icon buttons */
button:hover:not(:disabled) .group-hover\:scale-110 {
  transform: scale(1.1);
}

/* Loading state improvements */
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Card hover effects */
.bg-white\/80:hover {
  background-color: rgba(255, 255, 255, 0.95);
}
</style>