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
  IconSettings
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import * as nip19 from 'nostr-tools/nip19'
import NostrProfileEditor from './NostrProfileEditor.vue'

// Define emits to prevent Vue warning
defineEmits(['changePage'])

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

// Enhanced loading states
const minLoadingDuration = 800
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
  const npub = currentUser.value.npub
  return `${npub.substring(0, 8)}...${npub.substring(npub.length - 4)}`
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
  <div class="nostr-settings-container">
    <!-- Not Authenticated State -->
    <div v-if="!isAuthenticated" class="nostr-connect-card">
      <div class="nostr-connect-content">
        <div class="nostr-logo-wrapper">
          <img
            src="/nostr-logo/nostr10.png"
            alt="Nostr Logo"
            class="nostr-logo"
          />
        </div>

        <h3 class="nostr-connect-title">Connect with Nostr</h3>
        <p class="nostr-connect-description">
          Sign in with your Nostr identity to access decentralized social features and manage your profile.
        </p>

        <button
          @click="handleLogin"
          :disabled="isLoading || loadingStates.login"
          class="nostr-connect-button"
        >
          <IconLoader v-if="isLoading || loadingStates.login" class="w-5 h-5 animate-spin" />
          <IconUser v-else class="w-5 h-5" />
          <span>{{ (isLoading || loadingStates.login) ? 'Connecting...' : 'Connect with Nostr' }}</span>
        </button>

        <!-- Auth Error -->
        <div v-if="authError" class="nostr-error-message">
          <IconAlertCircle class="w-4 h-4" />
          <span>{{ authError }}</span>
        </div>
      </div>
    </div>

    <!-- Authenticated State -->
    <div v-else class="nostr-profile-section">
      <!-- Profile Card -->
      <div class="nostr-profile-card">
        <!-- Profile Header -->
        <div class="nostr-profile-header">
          <div class="nostr-avatar-container">
            <img
              :src="getUserAvatar()"
              :alt="userProfile?.name || 'User'"
              class="nostr-avatar"
              @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
            />
            <div class="nostr-status-dot"></div>
          </div>

          <div class="nostr-profile-info">
            <h3 class="nostr-profile-name">{{ userProfile?.name || 'Anonymous' }}</h3>
            <p class="nostr-profile-npub">{{ getShortNpub() }}</p>
          </div>

          <!-- Action Menu -->
          <div class="nostr-profile-actions">
            <button
              @click="handleEditProfile"
              class="nostr-action-button"
              title="Edit Profile"
            >
              <IconEdit class="w-4 h-4" />
            </button>

            <button
              @click="handleRefreshProfile"
              :disabled="loadingStates.refreshProfile"
              class="nostr-action-button"
              title="Refresh Profile"
            >
              <IconRefresh :class="['w-4 h-4', loadingStates.refreshProfile ? 'animate-spin' : '']" />
            </button>

            <button
              @click="handleLogout"
              :disabled="loadingStates.logout"
              class="nostr-action-button nostr-action-danger"
              title="Sign out"
            >
              <IconLoader v-if="loadingStates.logout" class="w-4 h-4 animate-spin" />
              <IconX v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Status Badges -->
        <div class="nostr-badges">
          <div class="nostr-badge nostr-badge-success">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
            <span>Connected</span>
          </div>
          <div v-if="userProfile?.nip05" class="nostr-badge nostr-badge-info">
            <IconShield class="w-3 h-3" />
            <span>Verified</span>
          </div>
          <div v-if="userProfile?.lud16" class="nostr-badge nostr-badge-warning">
            <IconBolt class="w-3 h-3" />
            <span>Lightning</span>
          </div>
        </div>

        <!-- Divider -->
        <div class="nostr-divider"></div>

        <!-- Profile Details -->
        <div class="nostr-details">
          <!-- Public Key -->
          <div class="nostr-detail-item">
            <div class="nostr-detail-header">
              <IconKey class="w-4 h-4 text-gray-400" />
              <span class="nostr-detail-label">PUBLIC KEY</span>
            </div>
            <div class="nostr-detail-content">
              <code class="nostr-detail-value">{{ getShortNpub() }}</code>
              <button
                @click="copyToClipboard(currentUser.npub)"
                :disabled="loadingStates.copyAction"
                class="nostr-copy-button"
                title="Copy"
              >
                <IconCheck v-if="copySuccess" class="w-3.5 h-3.5 text-green-600" />
                <IconCopy v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Lightning Address -->
          <div v-if="userProfile?.lud16" class="nostr-detail-item">
            <div class="nostr-detail-header">
              <IconBolt class="w-4 h-4 text-orange-500" />
              <span class="nostr-detail-label">LIGHTNING</span>
            </div>
            <div class="nostr-detail-content">
              <code class="nostr-detail-value nostr-detail-value-orange">{{ userProfile.lud16 }}</code>
              <button
                @click="copyToClipboard(userProfile.lud16)"
                :disabled="loadingStates.copyAction"
                class="nostr-copy-button"
                title="Copy"
              >
                <IconCopy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- NIP-05 Verification -->
          <div v-if="userProfile?.nip05" class="nostr-detail-item">
            <div class="nostr-detail-header">
              <IconShield class="w-4 h-4 text-blue-500" />
              <span class="nostr-detail-label">VERIFIED</span>
            </div>
            <div class="nostr-detail-content">
              <code class="nostr-detail-value nostr-detail-value-blue">{{ userProfile.nip05 }}</code>
              <button
                @click="copyToClipboard(userProfile.nip05)"
                :disabled="loadingStates.copyAction"
                class="nostr-copy-button"
                title="Copy"
              >
                <IconCopy class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Website -->
          <div v-if="userProfile?.website" class="nostr-detail-item">
            <div class="nostr-detail-header">
              <IconGlobe class="w-4 h-4 text-green-500" />
              <span class="nostr-detail-label">WEBSITE</span>
            </div>
            <div class="nostr-detail-content">
              <code class="nostr-detail-value nostr-detail-value-green">{{ userProfile.website }}</code>
              <a
                :href="userProfile.website"
                target="_blank"
                rel="noopener noreferrer"
                class="nostr-copy-button"
                title="Visit"
              >
                <IconExternalLink class="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Relay Section (Collapsible) -->
      <div class="nostr-relay-section">
        <button @click="toggleRelaySection" class="nostr-relay-header">
          <div class="nostr-relay-header-content">
            <IconPlugConnected class="w-5 h-5 text-orange-600" />
            <div class="nostr-relay-header-text">
              <h4 class="nostr-relay-title">Relay Network</h4>
              <p class="nostr-relay-subtitle">{{ connectedRelays.length }}/{{ userRelays.length }} connected</p>
            </div>
          </div>
          <component
            :is="showRelaySection ? IconChevronUp : IconChevronDown"
            class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="{ 'rotate-180': showRelaySection }"
          />
        </button>

        <!-- Relay Content -->
        <transition name="relay-expand">
          <div v-if="showRelaySection" class="nostr-relay-content">
            <!-- Add Relay Form -->
            <div class="nostr-add-relay-form">
              <input
                v-model="newRelayUrl"
                type="text"
                placeholder="wss://relay.example.com"
                class="nostr-relay-input"
                @keyup.enter="handleAddRelay"
              />
              <button
                @click="handleAddRelay"
                :disabled="loadingStates.addRelay || !newRelayUrl.trim()"
                class="nostr-add-relay-button"
              >
                <IconLoader v-if="loadingStates.addRelay" class="w-4 h-4 animate-spin" />
                <IconPlus v-else class="w-4 h-4" />
              </button>
            </div>

            <!-- Form Error -->
            <div v-if="relayFormError" class="nostr-error-message">
              <IconAlertCircle class="w-3.5 h-3.5" />
              <span>{{ relayFormError }}</span>
            </div>

            <!-- Relay List -->
            <div v-if="userRelays.length > 0" class="nostr-relay-list">
              <div
                v-for="relay in userRelays"
                :key="relay.url"
                class="nostr-relay-item"
              >
                <div class="nostr-relay-info">
                  <div :class="['nostr-relay-status', relay.status === 'connected' ? 'nostr-relay-status-connected' : '']"></div>
                  <div class="nostr-relay-details">
                    <p class="nostr-relay-name">{{ formatRelayUrl(relay.url) }}</p>
                    <div class="nostr-relay-badges-row">
                      <span v-if="relay.read" class="nostr-relay-badge">R</span>
                      <span v-if="relay.write" class="nostr-relay-badge">W</span>
                    </div>
                  </div>
                </div>
                <div class="nostr-relay-actions">
                  <button
                    @click="handleRefreshRelay(relay.url)"
                    :disabled="refreshingIndividualRelay.has(relay.url)"
                    class="nostr-relay-action-button"
                    title="Refresh"
                  >
                    <IconRefresh :class="['w-3.5 h-3.5', refreshingIndividualRelay.has(relay.url) ? 'animate-spin' : '']" />
                  </button>
                  <button
                    @click="handleRemoveRelay(relay.url)"
                    class="nostr-relay-action-button nostr-relay-action-danger"
                    title="Remove"
                  >
                    <IconTrash class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
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
/* Container */
.nostr-settings-container {
  @apply space-y-4;
}

/* Connect Card */
.nostr-connect-card {
  @apply bg-white rounded-2xl overflow-hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.nostr-connect-content {
  @apply p-8 text-center;
}

.nostr-logo-wrapper {
  @apply w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mx-auto mb-6;
}

.nostr-logo {
  @apply w-12 h-12 object-contain;
}

.nostr-connect-title {
  @apply text-xl font-semibold text-gray-900 mb-2;
  letter-spacing: -0.01em;
}

.nostr-connect-description {
  @apply text-sm text-gray-600 mb-6 max-w-md mx-auto;
  line-height: 1.5;
}

.nostr-connect-button {
  @apply inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium transition-all duration-200;
  box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
}

.nostr-connect-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.4);
}

.nostr-connect-button:active:not(:disabled) {
  transform: translateY(0);
}

.nostr-connect-button:disabled {
  @apply opacity-60 cursor-not-allowed;
}

/* Profile Section */
.nostr-profile-section {
  @apply space-y-3;
}

.nostr-profile-card {
  @apply bg-white rounded-2xl overflow-hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.nostr-profile-header {
  @apply flex items-start gap-3 p-4;
}

.nostr-avatar-container {
  @apply relative flex-shrink-0;
}

.nostr-avatar {
  @apply w-14 h-14 rounded-full object-cover;
  border: 2px solid rgba(0, 0, 0, 0.06);
}

.nostr-status-dot {
  @apply absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.nostr-profile-info {
  @apply flex-1 min-w-0;
}

.nostr-profile-name {
  @apply text-base font-semibold text-gray-900 truncate mb-0.5;
  letter-spacing: -0.01em;
}

.nostr-profile-npub {
  @apply text-sm text-gray-500 font-mono truncate;
}

.nostr-profile-actions {
  @apply flex items-center gap-1 flex-shrink-0;
}

.nostr-action-button {
  @apply p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200;
  min-width: 36px;
  min-height: 36px;
}

.nostr-action-button:active:not(:disabled) {
  @apply scale-95;
}

.nostr-action-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.nostr-action-danger {
  @apply hover:text-red-600 hover:bg-red-50;
}

/* Badges */
.nostr-badges {
  @apply flex flex-wrap gap-2 px-4 pb-3;
}

.nostr-badge {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium;
}

.nostr-badge-success {
  @apply bg-green-50 text-green-700;
}

.nostr-badge-info {
  @apply bg-blue-50 text-blue-700;
}

.nostr-badge-warning {
  @apply bg-orange-50 text-orange-700;
}

/* Divider */
.nostr-divider {
  @apply mx-4 h-px bg-gray-100;
}

/* Details */
.nostr-details {
  @apply p-4 space-y-3;
}

.nostr-detail-item {
  @apply space-y-1.5;
}

.nostr-detail-header {
  @apply flex items-center gap-2;
}

.nostr-detail-label {
  @apply text-xs font-medium text-gray-500 uppercase tracking-wider;
  letter-spacing: 0.05em;
}

.nostr-detail-content {
  @apply flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2;
}

.nostr-detail-value {
  @apply flex-1 text-sm text-gray-900 font-mono truncate;
}

.nostr-detail-value-orange {
  @apply text-orange-600;
}

.nostr-detail-value-blue {
  @apply text-blue-600;
}

.nostr-detail-value-green {
  @apply text-green-600;
}

.nostr-copy-button {
  @apply flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-all duration-150;
}

.nostr-copy-button:active:not(:disabled) {
  @apply scale-90;
}

/* Relay Section */
.nostr-relay-section {
  @apply bg-white rounded-2xl overflow-hidden;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.nostr-relay-header {
  @apply w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-200;
  -webkit-tap-highlight-color: transparent;
}

.nostr-relay-header-content {
  @apply flex items-center gap-3;
}

.nostr-relay-header-text {
  @apply text-left;
}

.nostr-relay-title {
  @apply text-base font-semibold text-gray-900;
  letter-spacing: -0.01em;
}

.nostr-relay-subtitle {
  @apply text-sm text-gray-500;
}

.nostr-relay-content {
  @apply px-4 pb-4 space-y-3;
}

.nostr-add-relay-form {
  @apply flex gap-2;
}

.nostr-relay-input {
  @apply flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-white transition-all duration-200;
  font-family: ui-monospace, monospace;
}

.nostr-add-relay-button {
  @apply flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg transition-all duration-200;
  box-shadow: 0 1px 3px rgba(251, 146, 60, 0.3);
}

.nostr-add-relay-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(251, 146, 60, 0.4);
}

.nostr-add-relay-button:active:not(:disabled) {
  transform: translateY(0);
}

.nostr-add-relay-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

/* Relay List */
.nostr-relay-list {
  @apply space-y-2;
}

.nostr-relay-item {
  @apply flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150;
}

.nostr-relay-info {
  @apply flex items-center gap-2.5 flex-1 min-w-0;
}

.nostr-relay-status {
  @apply w-2 h-2 rounded-full bg-gray-300 flex-shrink-0;
}

.nostr-relay-status-connected {
  @apply bg-green-500 animate-pulse;
}

.nostr-relay-details {
  @apply flex-1 min-w-0;
}

.nostr-relay-name {
  @apply text-sm font-medium text-gray-900 truncate;
}

.nostr-relay-badges-row {
  @apply flex items-center gap-1 mt-0.5;
}

.nostr-relay-badge {
  @apply w-4 h-4 bg-orange-100 text-orange-700 rounded text-xs font-bold flex items-center justify-center;
}

.nostr-relay-actions {
  @apply flex items-center gap-1 flex-shrink-0;
}

.nostr-relay-action-button {
  @apply p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-all duration-150;
}

.nostr-relay-action-button:active:not(:disabled) {
  @apply scale-90;
}

.nostr-relay-action-danger {
  @apply hover:text-red-600 hover:bg-red-100;
}

/* Error Message */
.nostr-error-message {
  @apply flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Relay Expand Transition */
.relay-expand-enter-active,
.relay-expand-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.relay-expand-enter-from,
.relay-expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.relay-expand-enter-to,
.relay-expand-leave-from {
  opacity: 1;
  max-height: 1000px;
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .nostr-connect-content {
    @apply p-6;
  }

  .nostr-profile-header {
    @apply p-3.5;
  }

  .nostr-avatar {
    @apply w-12 h-12;
  }

  .nostr-profile-name {
    @apply text-[15px];
  }

  .nostr-profile-npub {
    font-size: 13px;
  }

  .nostr-details {
    @apply p-3.5;
  }

  .nostr-relay-header {
    @apply p-3.5;
  }

  .nostr-relay-content {
    @apply px-3.5 pb-3.5;
  }

  /* Larger touch targets */
  .nostr-action-button,
  .nostr-copy-button,
  .nostr-relay-action-button,
  .nostr-add-relay-button {
    min-width: 44px;
    min-height: 44px;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .nostr-profile-card,
  .nostr-relay-section,
  .nostr-connect-card {
    border-width: 2px;
  }
}
</style>
