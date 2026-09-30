<script setup>
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import {
  IconPlus,
  IconX,
  IconUser,
  IconBolt,
  IconArrowLeft,
  IconAlertCircle,
  IconLoader2,
  IconRefresh,
  IconMessageCircle,
  IconLock
} from '@iconify-prerendered/vue-tabler'
import { useNostrChat } from '../composables/social/useNostrChat.js'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useNostrConnections } from '../composables/core/useNostrConnections.js'
import { makeInvoice, getUserFriendlyError } from '../utils/wallet/nwcClient.js'
import { nip19 } from '../services/nostr/nostrImports.js'
import UserProfileModal from '../components/modals/UserProfileModal.vue'
import ChatConversationList from '../components/chat/ChatConversationList.vue'
import ChatMessageArea from '../components/chat/ChatMessageArea.vue'
import ChatInputBar from '../components/chat/ChatInputBar.vue'
import ChatEmptyState from '../components/chat/ChatEmptyState.vue'

// Auth
const { isAuthenticated, currentUser, login } = useNostrAuth()
const { isWalletConnected } = useNostrConnections()

// Chat
const {
  sortedConversations,
  activeMessages: messages,
  activeConversation,
  sendMessage: sendChatMessage,
  isLoading,
  isSending,
  error: chatError,
  setActiveConversation,
  clearActiveConversation,
  startConversation,
  refreshConversationProfile
} = useNostrChat()

// Local state
const searchQuery = ref('')
const showNewConnectionModal = ref(false)
const showProfileModal = ref(false)
const selectedProfile = ref(null)
const newConnection = ref({ name: '', pubkey: '' })
const connectionError = ref('')
const isAddingConnection = ref(false)
const messageAreaRef = ref(null)
const inputBarRef = ref(null)
const sendError = ref('')

// Inline status for login errors
const inlineStatus = ref(null)
let _statusTimer = null
const showStatus = (message, type = 'error') => {
  clearTimeout(_statusTimer)
  inlineStatus.value = { message, type }
  _statusTimer = setTimeout(() => { inlineStatus.value = null }, 4000)
}

onUnmounted(() => {
  clearTimeout(_statusTimer)
})

// Methods
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (err) {
    if (err.message?.includes('No Nostr extension')) {
      showStatus('No Nostr extension found. Please install a NIP-07 browser extension — we recommend Jump by Buho (from the ZapTracker founders, available for Firefox & Chrome), or Alby, nos2x, or Flamingo — and refresh this page.')
    } else {
      showStatus(getUserFriendlyError(err))
    }
  }
}

const selectConversation = (conversation) => {
  sendError.value = ''
  setActiveConversation(conversation)
  nextTick(() => {
    messageAreaRef.value?.scrollToBottom()
    inputBarRef.value?.focus()
  })
}

const goBackToList = () => {
  sendError.value = ''
  clearActiveConversation()
}

const handleSend = async (content) => {
  if (!activeConversation.value || !content.trim()) return
  sendError.value = ''
  try {
    await sendChatMessage(activeConversation.value.pubkey, content)
  } catch (error) {
    console.error('Failed to send message:', error)
    sendError.value = error.message || 'Failed to send message'
    setTimeout(() => { sendError.value = '' }, 5000)
  }
}

const handleSendInvoice = async (amountSats) => {
  if (!activeConversation.value || !isWalletConnected.value) return
  sendError.value = ''
  try {
    const result = await makeInvoice({
      amount: amountSats * 1000, // Convert sats to millisats
      description: `Payment request from ${currentUser.value?.profile?.name || 'Anonymous'}`,
      expiry: 3600
    })
    if (result?.invoice) {
      await sendChatMessage(activeConversation.value.pubkey, result.invoice)
    }
  } catch (error) {
    console.error('Failed to create invoice:', error)
    sendError.value = getUserFriendlyError(error)
    setTimeout(() => { sendError.value = '' }, 5000)
  }
}

const validatePubkey = (pubkey) => {
  if (!pubkey?.trim()) return 'Public key is required'
  const trimmed = pubkey.trim()
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') return null
    } catch { return 'Invalid npub format' }
  }
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return null
  return 'Invalid public key format. Enter a valid npub or hex public key.'
}

const addConnection = async () => {
  connectionError.value = ''
  const validation = validatePubkey(newConnection.value.pubkey)
  if (validation) { connectionError.value = validation; return }

  isAddingConnection.value = true
  try {
    let pubkey = newConnection.value.pubkey.trim()
    if (pubkey.startsWith('npub1')) {
      pubkey = nip19.decode(pubkey).data
    }
    await startConversation(pubkey)
    newConnection.value = { name: '', pubkey: '' }
    showNewConnectionModal.value = false
  } catch (error) {
    connectionError.value = error.message || 'Failed to add connection'
  } finally {
    isAddingConnection.value = false
  }
}

const openUserProfile = () => {
  if (activeConversation.value) {
    selectedProfile.value = activeConversation.value
    showProfileModal.value = true
  }
}

const displayName = computed(() => {
  if (!activeConversation.value) return ''
  return activeConversation.value.profile?.name ||
    activeConversation.value.pubkey?.substring(0, 12) + '...'
})

// Focus input when conversation changes
watch(activeConversation, (conv) => {
  if (conv) {
    nextTick(() => {
      inputBarRef.value?.focus()
    })
  }
})
</script>

<template>
  <div>
    <!-- Inline Status Banner -->
    <transition name="slide-down">
      <div v-if="inlineStatus" role="status" aria-live="polite" :class="[
        'mb-4 px-4 py-3 rounded-lg text-sm font-medium',
        inlineStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
        inlineStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
        'bg-blue-50 text-blue-800 border border-blue-200'
      ]">
        {{ inlineStatus.message }}
      </div>
    </transition>

  <div class="h-[calc(100vh-160px)] sm:h-[calc(100vh-180px)] lg:h-[calc(100vh-200px)] flex bg-white rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">

    <!-- Auth Banner -->
    <div v-if="!isAuthenticated" class="flex-1 flex items-center justify-center p-4 sm:p-6">
      <div class="bg-gradient-to-br from-orange-400 to-amber-500 text-white p-8 sm:p-10 rounded-2xl shadow-xl max-w-sm w-full text-center">
        <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-5">
          <IconMessageCircle class="w-8 h-8" />
        </div>
        <h2 class="text-xl font-bold mb-2">Private Messages</h2>
        <p class="text-orange-100 text-sm mb-6 leading-relaxed">
          End-to-end encrypted messaging powered by Nostr. Connect your identity to get started.
        </p>
        <button
          @click="handleNostrLogin"
          class="bg-white text-orange-600 hover:bg-orange-50 px-6 py-3 rounded-xl font-semibold transition-all duration-200 inline-flex items-center gap-2 shadow-md hover:shadow-lg"
        >
          <IconBolt class="w-4 h-4" />
          Connect with Nostr
        </button>
      </div>
    </div>

    <!-- Main Chat Interface -->
    <template v-else>
      <!-- Sidebar: conversation list -->
      <div
        :class="[
          'flex flex-col border-r border-gray-100 bg-white',
          'lg:w-[320px] md:w-[280px]',
          activeConversation ? 'hidden md:flex' : 'w-full md:w-[280px]'
        ]"
      >
        <!-- Sidebar header -->
        <div class="h-[57px] px-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <h2 class="text-[17px] font-semibold text-gray-900">Messages</h2>
            <div v-if="isLoading" class="flex items-center gap-1.5 text-orange-500">
              <IconLoader2 class="w-3.5 h-3.5 animate-spin" />
              <span class="text-[11px] font-medium">Syncing</span>
            </div>
          </div>
          <button
            @click="showNewConnectionModal = true"
            class="w-9 h-9 flex items-center justify-center text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
            title="New conversation"
          >
            <IconPlus class="w-5 h-5" />
          </button>
        </div>

        <ChatConversationList
          :conversations="sortedConversations"
          :active-conversation-id="activeConversation?.pubkey"
          v-model:search-query="searchQuery"
          @select="selectConversation"
          @new-connection="showNewConnectionModal = true"
        />
      </div>

      <!-- Chat panel -->
      <div
        :class="[
          'flex-1 flex flex-col min-w-0',
          !activeConversation ? 'hidden md:flex' : 'w-full'
        ]"
      >
        <!-- Chat header -->
        <div v-if="activeConversation" class="h-[57px] px-3 sm:px-4 border-b border-gray-100 bg-white flex items-center gap-3 flex-shrink-0">
          <!-- Back button (mobile) -->
          <button
            @click="goBackToList"
            class="md:hidden w-9 h-9 -ml-1 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <IconArrowLeft class="w-5 h-5" />
          </button>

          <!-- Avatar -->
          <div
            class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 cursor-pointer ring-2 ring-gray-100 hover:ring-orange-200 transition-all"
            @click="openUserProfile"
          >
            <img
              v-if="activeConversation.profile?.picture"
              :src="activeConversation.profile.picture"
              class="w-full h-full object-cover"
              @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
            />
            <div
              class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center"
              :style="{ display: activeConversation.profile?.picture ? 'none' : 'flex' }"
            >
              <IconUser class="w-4 h-4 text-white" />
            </div>
          </div>

          <!-- Name + info -->
          <div class="flex-1 min-w-0 cursor-pointer" @click="openUserProfile">
            <div class="font-medium text-[14px] text-gray-900 truncate leading-tight">
              {{ displayName }}
            </div>
            <div class="flex items-center gap-1 mt-0.5">
              <IconLock class="w-3 h-3 text-green-500 flex-shrink-0" />
              <span class="text-[11px] text-gray-400">Encrypted</span>
            </div>
          </div>

          <!-- Actions -->
          <button
            @click="refreshConversationProfile(activeConversation.pubkey)"
            class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            title="Refresh profile"
          >
            <IconRefresh class="w-[18px] h-[18px]" />
          </button>
        </div>

        <!-- Messages or empty state -->
        <ChatMessageArea
          v-if="activeConversation"
          ref="messageAreaRef"
          :messages="messages"
          :current-user-pubkey="currentUser?.pubkey"
          :conversation-profile="activeConversation?.profile"
          :wallet-connected="isWalletConnected"
        />
        <ChatEmptyState v-else type="no-selection" />

        <!-- Send error toast -->
        <div
          v-if="sendError"
          class="mx-3 sm:mx-4 mb-1 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-600 animate-fade-in"
        >
          <IconAlertCircle class="w-4 h-4 flex-shrink-0" />
          <span class="truncate">{{ sendError }}</span>
          <button @click="sendError = ''" class="ml-auto p-0.5 hover:bg-red-100 rounded transition-colors flex-shrink-0">
            <IconX class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Input -->
        <ChatInputBar
          v-if="activeConversation"
          ref="inputBarRef"
          :sending="isSending"
          :wallet-connected="isWalletConnected"
          @send="handleSend"
          @send-invoice="handleSendInvoice"
        />
      </div>
    </template>

    <!-- New Connection Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div
          v-if="showNewConnectionModal"
          class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          @click.self="showNewConnectionModal = false"
        >
          <div class="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl overflow-hidden">
            <!-- Modal header -->
            <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 class="text-[17px] font-semibold text-gray-900">New Conversation</h3>
              <button
                @click="showNewConnectionModal = false"
                class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <!-- Modal body -->
            <div class="px-5 py-5 space-y-4">
              <div>
                <label class="block text-[13px] font-medium text-gray-700 mb-1.5">Name <span class="text-gray-400 font-normal">(optional)</span></label>
                <input
                  v-model="newConnection.name"
                  type="text"
                  placeholder="e.g. Alice"
                  class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all placeholder:text-gray-400"
                />
              </div>
              <div>
                <label class="block text-[13px] font-medium text-gray-700 mb-1.5">Nostr Public Key</label>
                <textarea
                  v-model="newConnection.pubkey"
                  placeholder="npub1... or hex public key"
                  rows="2"
                  class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-300 transition-all resize-none font-mono placeholder:font-sans placeholder:text-gray-400"
                ></textarea>
                <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  Paste an npub address or 64-character hex public key
                </p>
              </div>

              <!-- Error -->
              <div v-if="connectionError" class="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <IconAlertCircle class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span class="text-[13px] text-red-600 leading-relaxed">{{ connectionError }}</span>
              </div>
            </div>

            <!-- Modal footer -->
            <div class="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5">
              <button
                @click="showNewConnectionModal = false; connectionError = ''"
                class="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                @click="addConnection"
                :disabled="!newConnection.pubkey?.trim() || isAddingConnection"
                class="btn-primary text-sm px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLoader2 v-if="isAddingConnection" class="w-4 h-4 animate-spin" />
                <IconMessageCircle v-else class="w-4 h-4" />
                {{ isAddingConnection ? 'Starting...' : 'Start Chat' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- User Profile Modal -->
    <UserProfileModal
      :show="showProfileModal"
      :user-profile-data="selectedProfile"
      @close="showProfileModal = false; selectedProfile = null"
    />
  </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
