<script setup>
import { ref, onMounted } from 'vue'
import {
  IconPlugConnected,
  IconPlus,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
  IconShield,
  IconUser,
  IconLoader,
  IconInfoCircle,
  IconX,
  IconCheck,
  IconServer,
  IconCode
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useRelayInfo } from '../../composables/core/useRelayInfo.js'

const {
  currentUser,
  isAuthenticated,
  userRelays,
  relayError,
  connectedRelays,
  readRelays,
  writeRelays,
  runtimeRelayCount,
  addRelay,
  removeRelay,
  checkRelayStatus,
  checkAllRelayStatuses,
  validateRelayUrl,
  initAuthAndRelays
} = useNostrAuth()

const {
  relayInfo,
  fetchInfo,
  fetchAllInfo,
  supportsNip,
  getLimitations,
  getSoftware,
  getSupportedNips
} = useRelayInfo()

// Local state
const newRelayUrl = ref('')
const relayFormError = ref('')
const refreshingIndividualRelay = ref({})
const selectedRelayUrl = ref(null)
const loadingRelayInfo = ref(false)
const relayInfoError = ref(false)

// Initialize on mount
onMounted(async () => {
  await initAuthAndRelays()
  // Fetch relay info for all connected relays in background
  fetchAllInfo().catch(() => { relayInfoError.value = true })
})

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
    if (selectedRelayUrl.value === url) selectedRelayUrl.value = null
  } catch (error) {
    console.error('Failed to remove relay:', error)
  }
}

// Handle refresh all relays
const handleRefreshRelays = async () => {
  relayInfoError.value = false
  await checkAllRelayStatuses()
  fetchAllInfo().catch(() => { relayInfoError.value = true })
}

// Handle refresh single relay
const handleRefreshRelay = async (url) => {
  refreshingIndividualRelay.value = { ...refreshingIndividualRelay.value, [url]: true }
  try {
    await checkRelayStatus(url)
    await fetchInfo(url)
  } finally {
    const next = { ...refreshingIndividualRelay.value }
    delete next[url]
    refreshingIndividualRelay.value = next
  }
}

// Open relay info card
const openRelayInfo = async (url) => {
  if (selectedRelayUrl.value === url) {
    selectedRelayUrl.value = null
    return
  }
  selectedRelayUrl.value = url
  if (!relayInfo.value.get(url)) {
    loadingRelayInfo.value = true
    try {
      await fetchInfo(url)
    } finally {
      loadingRelayInfo.value = false
    }
  }
}

const closeRelayInfo = () => {
  selectedRelayUrl.value = null
}

// Get relay info for selected relay
const selectedInfo = () => relayInfo.value.get(selectedRelayUrl.value)

// Get relay status color
const getRelayStatusColor = (status) => {
  switch (status) {
    case 'connected': return 'bg-green-500'
    case 'disconnected': return 'bg-gray-300'
    case 'checking': return 'bg-yellow-500'
    default: return 'bg-gray-300'
  }
}

// Format relay URL for display
const formatRelayUrl = (url) => {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// Known NIP descriptions for display
const nipDescriptions = {
  1: 'Basic protocol',
  2: 'Follow list',
  4: 'Encrypted DMs',
  9: 'Event deletion',
  11: 'Relay info',
  13: 'Proof of Work',
  15: 'Marketplace',
  17: 'Private DMs',
  22: 'Comments',
  23: 'Long-form',
  25: 'Reactions',
  28: 'Channels',
  40: 'Expiration',
  42: 'Authentication',
  45: 'Event counts',
  50: 'Search',
  56: 'Reporting',
  57: 'Zaps',
  58: 'Badges',
  65: 'Relay lists',
  70: 'Protected events',
  94: 'File metadata',
}

const getNipLabel = (nip) => nipDescriptions[nip] || `NIP-${nip}`
</script>

<template>
  <div class="space-y-5">
    <!-- Not Authenticated -->
    <div v-if="!isAuthenticated" class="max-w-md mx-auto">
      <div class="bg-gray-50 rounded-2xl p-8 text-center">
        <IconUser class="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Connect First</h3>
        <p class="text-sm text-gray-500">Connect your Nostr identity on the Profile tab to manage relays.</p>
      </div>
    </div>

    <!-- Relay Management -->
    <template v-else>
      <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <!-- Header -->
        <div class="p-5 flex items-center justify-between border-b border-gray-100">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <IconPlugConnected class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-gray-900">Relay Network</h3>
              <p class="text-xs text-gray-500">
                {{ connectedRelays.length }}/{{ userRelays.length }} connected
                <span v-if="runtimeRelayCount > 0" class="text-blue-500"> &middot; +{{ runtimeRelayCount }} outbox</span>
                <span v-if="relayInfoError" class="text-amber-600"> &middot; info unavailable</span>
              </p>
            </div>
          </div>
          <button
            @click="handleRefreshRelays"
            class="w-9 h-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            title="Refresh all relays"
          >
            <IconRefresh class="w-4 h-4" />
          </button>
        </div>

        <div class="px-5 pb-5">
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
              <div class="text-xs text-gray-700">Saved</div>
            </div>
          </div>
          <!-- Runtime relay info -->
          <div v-if="runtimeRelayCount > 0" class="mb-3 px-3 py-2 bg-blue-50 rounded-lg flex items-center gap-2">
            <IconPlugConnected class="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <p class="text-xs text-blue-700">
              <span class="font-medium">{{ runtimeRelayCount }} outbox relays</span> active for event routing (ephemeral, not saved)
            </p>
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
              <IconPlugConnected class="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">No relays configured</p>
            </div>

            <div v-for="relay in userRelays" :key="relay.url">
              <!-- Relay Row -->
              <div
                class="group flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                :class="{ 'bg-blue-50 hover:bg-blue-100': selectedRelayUrl === relay.url }"
                @click="openRelayInfo(relay.url)"
              >
                <div class="flex items-center gap-2.5 flex-1 min-w-0">
                  <div :class="['w-2 h-2 rounded-full flex-shrink-0', getRelayStatusColor(relay.status)]"></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <h5 class="text-xs font-medium text-gray-900 truncate">{{ formatRelayUrl(relay.url) }}</h5>
                      <span v-if="relay.read" class="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold leading-none">R</span>
                      <span v-if="relay.write" class="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold leading-none">W</span>
                      <IconInfoCircle
                        v-if="relayInfo.get(relay.url)"
                        class="w-3 h-3 text-blue-400 flex-shrink-0"
                      />
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                  <button
                    @click="handleRefreshRelay(relay.url)"
                    class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <IconRefresh :class="['w-3.5 h-3.5', refreshingIndividualRelay[relay.url] && 'animate-spin']" />
                  </button>
                  <button
                    @click="handleRemoveRelay(relay.url)"
                    class="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                  >
                    <IconTrash class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Relay Info Card (expandable) -->
              <transition
                enter-active-class="transition-all duration-200 ease-out"
                enter-from-class="opacity-0 max-h-0"
                enter-to-class="opacity-100 max-h-96"
                leave-active-class="transition-all duration-150 ease-in"
                leave-from-class="opacity-100 max-h-96"
                leave-to-class="opacity-0 max-h-0"
              >
                <div
                  v-if="selectedRelayUrl === relay.url"
                  class="overflow-hidden"
                >
                  <div class="ml-4 mt-1 mb-2 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <!-- Loading -->
                    <div v-if="loadingRelayInfo && !relayInfo.get(relay.url)" class="flex items-center justify-center py-4 gap-2 text-gray-400">
                      <IconLoader class="w-4 h-4 animate-spin" />
                      <span class="text-xs">Loading relay info...</span>
                    </div>

                    <!-- No info available -->
                    <div v-else-if="!relayInfo.get(relay.url)" class="text-center py-3">
                      <p class="text-xs text-gray-400">NIP-11 info not available for this relay</p>
                    </div>

                    <!-- Relay Info Content -->
                    <template v-else>
                      <div class="space-y-3">
                        <!-- Header with name -->
                        <div class="flex items-start justify-between">
                          <div class="flex-1 min-w-0">
                            <h4 class="text-sm font-semibold text-gray-900">
                              {{ relayInfo.get(relay.url).name || formatRelayUrl(relay.url) }}
                            </h4>
                            <p v-if="relayInfo.get(relay.url).description" class="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {{ relayInfo.get(relay.url).description }}
                            </p>
                          </div>
                          <button
                            @click.stop="closeRelayInfo"
                            class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded"
                          >
                            <IconX class="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <!-- Software & Contact -->
                        <div class="flex flex-wrap gap-2">
                          <span
                            v-if="relayInfo.get(relay.url).software"
                            class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs"
                          >
                            <IconCode class="w-3 h-3" />
                            {{ relayInfo.get(relay.url).software?.split('/').pop() }}
                            <span v-if="relayInfo.get(relay.url).version" class="text-gray-400">
                              v{{ relayInfo.get(relay.url).version }}
                            </span>
                          </span>
                          <span
                            v-if="relayInfo.get(relay.url).contact"
                            class="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs"
                          >
                            <IconUser class="w-3 h-3" />
                            {{ relayInfo.get(relay.url).contact }}
                          </span>
                        </div>

                        <!-- Limitations -->
                        <div v-if="relayInfo.get(relay.url).limitation" class="bg-gray-50 rounded-lg p-2.5">
                          <p class="text-xs font-medium text-gray-700 mb-1.5">Limits</p>
                          <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                            <div v-if="relayInfo.get(relay.url).limitation.max_message_length" class="text-xs text-gray-500">
                              Max message: <span class="text-gray-700 font-medium">{{ (relayInfo.get(relay.url).limitation.max_message_length / 1024).toFixed(0) }}KB</span>
                            </div>
                            <div v-if="relayInfo.get(relay.url).limitation.max_subscriptions" class="text-xs text-gray-500">
                              Max subs: <span class="text-gray-700 font-medium">{{ relayInfo.get(relay.url).limitation.max_subscriptions }}</span>
                            </div>
                            <div v-if="relayInfo.get(relay.url).limitation.max_event_tags" class="text-xs text-gray-500">
                              Max tags: <span class="text-gray-700 font-medium">{{ relayInfo.get(relay.url).limitation.max_event_tags }}</span>
                            </div>
                            <div v-if="relayInfo.get(relay.url).limitation.max_content_length" class="text-xs text-gray-500">
                              Max content: <span class="text-gray-700 font-medium">{{ (relayInfo.get(relay.url).limitation.max_content_length / 1024).toFixed(0) }}KB</span>
                            </div>
                            <div class="text-xs text-gray-500">
                              Auth required:
                              <span :class="relayInfo.get(relay.url).limitation.auth_required ? 'text-orange-600' : 'text-green-600'" class="font-medium">
                                {{ relayInfo.get(relay.url).limitation.auth_required ? 'Yes' : 'No' }}
                              </span>
                            </div>
                            <div class="text-xs text-gray-500">
                              Payment required:
                              <span :class="relayInfo.get(relay.url).limitation.payment_required ? 'text-orange-600' : 'text-green-600'" class="font-medium">
                                {{ relayInfo.get(relay.url).limitation.payment_required ? 'Yes' : 'No' }}
                              </span>
                            </div>
                          </div>
                        </div>

                        <!-- Supported NIPs -->
                        <div v-if="relayInfo.get(relay.url).supported_nips?.length > 0">
                          <p class="text-xs font-medium text-gray-700 mb-1.5">Supported NIPs</p>
                          <div class="flex flex-wrap gap-1">
                            <span
                              v-for="nip in relayInfo.get(relay.url).supported_nips.slice(0, 20)"
                              :key="nip"
                              class="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono"
                              :title="getNipLabel(nip)"
                            >
                              {{ nip }}
                            </span>
                            <span
                              v-if="relayInfo.get(relay.url).supported_nips.length > 20"
                              class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs"
                            >
                              +{{ relayInfo.get(relay.url).supported_nips.length - 20 }} more
                            </span>
                          </div>
                        </div>

                        <!-- Countries / Languages -->
                        <div class="flex flex-wrap gap-2">
                          <div v-if="relayInfo.get(relay.url).relay_countries?.length" class="text-xs text-gray-500">
                            Countries: <span class="text-gray-700">{{ relayInfo.get(relay.url).relay_countries.join(', ') }}</span>
                          </div>
                          <div v-if="relayInfo.get(relay.url).language_tags?.length" class="text-xs text-gray-500">
                            Languages: <span class="text-gray-700">{{ relayInfo.get(relay.url).language_tags.join(', ') }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
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
              Your keys are managed by your browser extension or remote signer. ZapTracker only reads your public profile. Private keys never leave your device.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
button:active:not(:disabled) {
  transform: scale(0.98);
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
