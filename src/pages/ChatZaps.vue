<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { 
  IconMessageCircle, 
  IconPlus, 
  IconSearch, 
  IconSend, 
  IconBolt, 
  IconUser, 
  IconX, 
  IconDots, 
  IconCopy, 
  IconTrash, 
  IconUserX, 
  IconLoader, 
  IconArrowLeft, 
  IconAlertCircle,
  IconRefresh,
  IconCheck,
  IconKey,
  IconQrcode
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useNostrChat } from '../composables/social/useNostrChat.js'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useNostrConnections } from '../composables/core/useNostrConnections.js'
import * as nip19 from 'nostr-tools/nip19'
import UserProfileModal from '../components/modals/UserProfileModal.vue'

// Authentication
const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

// Chat functionality
const {
  conversations,
  activeMessages: messages,
  sendMessage: sendChatMessage,
  isLoading: isSending,
  setActiveConversation,
  startConversation,
  refreshConversationProfile
} = useNostrChat()

// Connections - using conversations from chat instead
const connections = computed(() => Array.from(conversations.value.values()))

// Local state
const searchQuery = ref('')
const selectedConnection = ref(null)
const showNewConnectionModal = ref(false)
const showConnectionOptions = ref(false)
const showMobileSidebar = ref(false)
const showProfileModal = ref(false)
const selectedProfile = ref(null)
const newMessage = ref('')
const newConnection = ref({
  name: '',
  pubkey: ''
})
const connectionError = ref('')
const isAddingConnection = ref(false)
const messagesContainer = ref(null)
const copySuccess = ref('')
const activeTab = ref('publickey') // 'publickey' or 'lightning'

// Computed
const filteredConnections = computed(() => {
  if (!searchQuery.value) return connections.value
  const query = searchQuery.value.toLowerCase()
  return connections.value.filter(conn =>
    conn.name?.toLowerCase().includes(query) ||
    conn.pubkey.toLowerCase().includes(query)
  )
})

// Methods
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

const selectConnection = (connection) => {
  selectedConnection.value = connection
  setActiveConversation(connection)
  // Close mobile sidebar when connection is selected
  showMobileSidebar.value = false
  // Scroll to bottom of messages
  nextTick(() => {
    scrollToBottom()
  })
}

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConnection.value) return

  try {
    await sendChatMessage(selectedConnection.value.pubkey, newMessage.value)
    newMessage.value = ''
    // Scroll to bottom after sending
    nextTick(() => {
      scrollToBottom()
    })
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const validatePubkey = (pubkey) => {
  if (!pubkey || !pubkey.trim()) {
    return 'Public key is required'
  }

  const trimmed = pubkey.trim()

  // Check if it's an npub
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'npub') {
        return null // Valid npub
      }
    } catch (error) {
      return 'Invalid npub format'
    }
  }

  // Check if it's a hex pubkey (64 characters)
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return null // Valid hex pubkey
  }

  return 'Invalid public key format. Please enter a valid npub or hex public key.'
}

const addConnection = async () => {
  connectionError.value = ''

  const validation = validatePubkey(newConnection.value.pubkey)
  if (validation) {
    connectionError.value = validation
    return
  }

  isAddingConnection.value = true

  try {
    let pubkey = newConnection.value.pubkey.trim()

    // Convert npub to hex if needed
    if (pubkey.startsWith('npub1')) {
      const decoded = nip19.decode(pubkey)
      pubkey = decoded.data
    }

    await startConversation(pubkey)

    // Reset form
    newConnection.value = { name: '', pubkey: '' }
    showNewConnectionModal.value = false
  } catch (error) {
    console.error('Failed to add connection:', error)
    connectionError.value = error.message || 'Failed to add connection'
  } finally {
    isAddingConnection.value = false
  }
}

const openUserProfile = (connection) => {
  selectedProfile.value = connection
  showProfileModal.value = true
  activeTab.value = 'publickey'
  copySuccess.value = ''
}

const closeUserProfile = () => {
  showProfileModal.value = false
  selectedProfile.value = null
  copySuccess.value = ''
}

const copyToClipboard = async (text, type) => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const formatNpub = (pubkey) => {
  try {
    return nip19.npubEncode(pubkey)
  } catch (error) {
    return pubkey
  }
}

const formatPubkey = (pubkey) => {
  if (!pubkey) return ''
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Auto-resize textarea
watch(newMessage, () => {
  nextTick(() => {
    const textarea = document.querySelector('textarea')
    if (textarea && textarea.placeholder === 'Type your message...') {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  })
})

// Scroll to bottom when messages change
watch(messages, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

// Close mobile sidebar when clicking outside (handled by overlay)
// Close connection options when clicking outside
const handleClickOutside = (event) => {
  if (showConnectionOptions.value && !event.target.closest('[data-connection-options]')) {
    showConnectionOptions.value = false
  }
}

// Lifecycle
onMounted(() => {
  // Auto-select first connection if available
  if (connections.value.length > 0 && !selectedConnection.value) {
    selectConnection(connections.value[0])
  }

  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="h-[calc(100vh-160px)] sm:h-[calc(100vh-180px)] lg:h-[calc(100vh-200px)] flex flex-col bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="p-4 sm:p-6">
      <div class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-4 sm:p-6 rounded-xl shadow-lg">
        <div class="flex flex-col gap-4">
          <div class="flex items-start space-x-3 sm:space-x-4">
            <div class="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconUser class="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg sm:text-xl font-bold mb-2">Nostr Login Required</h2>
              <p class="text-purple-100 text-sm sm:text-base leading-relaxed">
                Connect your Nostr identity to send and receive encrypted messages with Lightning zaps.
              </p>
            </div>
          </div>
          <button
            @click="handleNostrLogin"
            class="touch-target bg-white/20 hover:bg-white/30 px-4 py-3 sm:px-6 sm:py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto sm:self-start"
          >
            <IconBolt class="w-4 h-4" />
            <span class="text-sm sm:text-base">Connect with Nostr</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Chat Interface -->
    <div v-else class="flex-1 flex flex-col lg:flex-row relative min-h-0">
      <!-- Mobile Overlay -->
      <div
        v-if="showMobileSidebar"
        class="fixed inset-0 bg-black/50 z-40 lg:hidden"
        @click="showMobileSidebar = false"
      ></div>

      <!-- Sidebar with connections -->
      <div :class="[
        'w-full lg:w-80 border-r border-orange-100/50 bg-white backdrop-blur-sm flex flex-col min-h-0',
        'fixed lg:relative top-0 left-0 h-full z-50 lg:z-auto transform transition-transform duration-300 ease-in-out lg:transform-none',
        showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]">
        <!-- Header -->
        <div class="p-3 sm:p-4 border-b border-orange-100/50 flex-shrink-0">
          <div class="flex items-center justify-between">
            <h2 class="text-base sm:text-lg font-semibold text-gray-900">Chat Connections</h2>
            <div class="flex items-center space-x-2">
              <button
                @click="showNewConnectionModal = true"
                class="touch-target p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex items-center justify-center"
                title="Add new connection"
              >
                <IconPlus class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <!-- Mobile close button -->
              <button
                @click="showMobileSidebar = false"
                class="touch-target p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors lg:hidden flex items-center justify-center"
                title="Close sidebar"
              >
                <IconX class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="p-3 sm:p-4 border-b border-orange-100/50 flex-shrink-0">
          <div class="relative">
            <IconSearch class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search connections..."
              class="touch-target w-full pl-10 pr-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
        </div>

        <!-- Connections List - Scrollable -->
        <div class="flex-1 overflow-y-auto min-h-0 max-h-[calc(100%-140px)]">
          <div v-if="filteredConnections.length === 0" class="p-4 sm:p-6">
            <div class="text-center mb-6">
              <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-500 rounded-2xl shadow-lg mb-4">
                <IconMessageCircle class="w-8 h-8 text-white" />
              </div>
              <h4 class="text-lg font-bold text-gray-900 mb-2">Start Messaging</h4>
              <p class="text-sm text-gray-600 mb-4">
                Connect with people to send private Lightning zaps with messages
              </p>
              <button
                @click="showNewConnectionModal = true"
                class="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 inline-flex items-center space-x-2"
              >
                <IconPlus class="w-5 h-5" />
                <span>Add Connection</span>
              </button>
            </div>
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p class="text-xs text-gray-700 leading-relaxed">
                <strong>Tip:</strong> ChatZaps let you send Lightning payments with private messages. Add someone's Nostr pubkey or npub to start!
              </p>
            </div>
          </div>

          <div
            v-for="connection in filteredConnections"
            :key="connection.pubkey"
            @click="selectConnection(connection)"
            :class="[
              'p-4 border-b border-orange-100/50 cursor-pointer transition-colors hover:bg-orange-50/50',
              selectedConnection?.pubkey === connection.pubkey ? 'bg-orange-50 border-orange-200' : ''
            ]"
          >
            <div class="flex items-center space-x-3">
              <div class="relative w-10 h-10 rounded-full overflow-hidden border-2 border-orange-200 hover:border-orange-300 transition-colors">
                <img 
                  v-if="connection.profile?.picture"
                  :src="connection.profile.picture" 
                  :alt="connection.profile?.name || 'User'"
                  class="w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
                />
                <div 
                  class="w-full h-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center"
                  :style="{ display: connection.profile?.picture ? 'none' : 'flex' }"
                >
                  <IconUser class="w-5 h-5 text-white" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 truncate">
                  {{ connection.profile?.name || formatPubkey(connection.pubkey) }}
                </div>
                <div class="text-sm text-gray-500 truncate">
                  <div v-if="connection.profile?.lud16" class="flex items-center space-x-1">
                    <IconBolt class="w-3 h-3 text-yellow-500 flex-shrink-0" />
                    <span class="truncate">{{ connection.profile.lud16 }}</span>
                  </div>
                </div>
                <div v-if="connection.lastMessage" class="text-xs text-gray-400 truncate">
                  {{ connection.lastMessage }}
                </div>
              </div>
              <div v-if="connection.unreadCount > 0" class="w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                {{ connection.unreadCount > 9 ? '9+' : connection.unreadCount }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Chat Header - Fixed -->
        <div v-if="selectedConnection" class="p-3 sm:p-4 border-b border-orange-100/50 bg-white/50 backdrop-blur-sm flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3 flex-1 min-w-0">
              <!-- Mobile back button -->
              <button
                @click="showMobileSidebar = true"
                class="touch-target p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors lg:hidden flex items-center justify-center"
                title="Back to connections"
              >
                <IconArrowLeft class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <div class="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                <img 
                  v-if="selectedConnection.profile?.picture"
                  :src="selectedConnection.profile.picture" 
                  :alt="selectedConnection.profile?.name || 'User'"
                  class="w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
                />
                <div 
                  class="w-full h-full bg-gradient-to-r from-orange-400 to-amber-400 flex items-center justify-center"
                  :style="{ display: selectedConnection.profile?.picture ? 'none' : 'flex' }"
                >
                  <IconUser class="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              </div>
              <div class="flex-1 min-w-0 cursor-pointer" @click="openUserProfile(selectedConnection)">
                <div class="font-medium text-gray-900 truncate text-sm sm:text-base">
                  {{ selectedConnection.profile?.name || formatPubkey(selectedConnection.pubkey) }}
                </div>
                <div class="text-xs sm:text-sm text-gray-500 truncate">
                  <div v-if="selectedConnection.profile?.lud16" class="flex items-center space-x-1">
                    <IconBolt class="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 flex-shrink-0" />
                    <span class="truncate">{{ selectedConnection.profile.lud16 }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2 flex-shrink-0">
              <button
                @click="refreshConversationProfile(selectedConnection.pubkey)"
                class="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex items-center justify-center"
                title="Refresh profile"
              >
                <IconRefresh class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
<!--              <button-->
<!--                @click="showConnectionOptions = !showConnectionOptions"-->
<!--                class="touch-target p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex items-center justify-center"-->
<!--                title="Connection options"-->
<!--              >-->
<!--                <IconDots class="w-4 h-4 sm:w-5 sm:h-5" />-->
<!--              </button>-->
            </div>
          </div>
        </div>

        <!-- No Connection Selected -->
        <div v-else class="flex-1 flex items-center justify-center p-4 sm:p-6 min-h-0">
          <div class="text-center text-gray-500 max-w-sm">
            <!-- Mobile menu button when no connection selected -->
            <button
              @click="showMobileSidebar = true"
              class="touch-target mb-4 p-3 bg-orange-100 text-orange-600 rounded-lg lg:hidden flex items-center justify-center mx-auto"
              title="Show connections"
            >
              <IconMessageCircle class="w-6 h-6" />
            </button>

            <IconMessageCircle class="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-300" />
            <h3 class="text-base sm:text-lg font-medium text-gray-900 mb-2">Select a connection</h3>
            <p class="text-sm sm:text-base text-gray-600 leading-relaxed">Choose a connection from the sidebar to start chatting</p>
          </div>
        </div>

        <!-- Messages Area - Scrollable -->
        <div v-if="selectedConnection" class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0 max-h-[calc(100%-120px)]" ref="messagesContainer">
          <div v-if="messages.length === 0" class="text-center text-gray-500 py-6 sm:py-8">
            <IconMessageCircle class="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-gray-300" />
            <p class="text-sm sm:text-base mb-1">No messages yet</p>
            <p class="text-xs sm:text-sm">Start the conversation!</p>
          </div>

          <div
            v-for="message in messages"
            :key="message.id"
            :class="[
              'flex',
              message.sender === currentUser?.pubkey ? 'justify-end' : 'justify-start'
            ]"
          >
            <div
              :class="[
                'max-w-[85%] sm:max-w-xs lg:max-w-md px-3 py-2 sm:px-4 sm:py-2 rounded-lg',
                message.sender === currentUser?.pubkey
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              ]"
            >
              <div class="text-sm sm:text-base leading-relaxed break-words">{{ message.content }}</div>
              <div
                :class="[
                  'text-xs mt-1',
                  message.sender === currentUser?.pubkey ? 'text-orange-100' : 'text-gray-500'
                ]"
              >
                {{ formatTime(message.timestamp) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Message Input - Fixed -->
        <div v-if="selectedConnection" class="p-3 sm:p-4 border-t border-orange-100/50 bg-white/50 backdrop-blur-sm flex-shrink-0">
          <div class="flex items-end space-x-2 sm:space-x-3">
            <div class="flex-1">
              <textarea
                v-model="newMessage"
                @keydown.enter.prevent="sendMessage"
                placeholder="Type your message..."
                rows="1"
                class="touch-target w-full px-3 py-2 sm:px-4 sm:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none text-sm sm:text-base leading-relaxed"
                style="max-height: 120px; overflow-y: auto;"
              ></textarea>
            </div>
            <button
              @click="sendMessage"
              :disabled="!newMessage.trim() || isSending"
              class="touch-target p-2 sm:p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center justify-center"
              title="Send message"
            >
              <IconLoader v-if="isSending" class="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              <IconSend v-else class="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Connection Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showNewConnectionModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center justify-between mb-4 sm:mb-6">
              <h3 class="text-lg sm:text-xl font-semibold text-gray-900">Add New Connection</h3>
              <button
                @click="showNewConnectionModal = false"
                class="touch-target text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors flex items-center justify-center"
                title="Close"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection Name</label>
                <input
                  v-model="newConnection.name"
                  type="text"
                  placeholder="Enter a name for this connection"
                  class="touch-target w-full px-3 py-2 sm:px-3 sm:py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm sm:text-base transition-all duration-200"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
                <textarea
                  v-model="newConnection.pubkey"
                  placeholder="Enter the Nostr public key (npub... or hex)"
                  rows="3"
                  class="touch-target w-full px-3 py-2 sm:px-3 sm:py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm sm:text-base transition-all duration-200 resize-none"
                ></textarea>
                <p class="text-xs text-gray-500 mt-1 leading-relaxed">
                  Enter a Nostr public key in npub format or hex format
                </p>
              </div>

              <!-- Validation Error -->
              <div v-if="connectionError" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <div class="flex items-center space-x-2">
                  <IconAlertCircle class="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span class="text-sm text-red-600">{{ connectionError }}</span>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
              <button
                @click="showNewConnectionModal = false"
                class="touch-target btn-secondary w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                @click="addConnection"
                :disabled="!newConnection.pubkey || isAddingConnection"
                class="touch-target btn-primary disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                <IconLoader v-if="isAddingConnection" class="w-4 h-4 animate-spin" />
                <IconPlus v-else class="w-4 h-4" />
                {{ isAddingConnection ? 'Adding...' : 'Add Connection' }}
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
      @close="closeUserProfile" 
    />
  </div>
</template>

<style scoped>
/* Custom scrollbar for messages */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Message input auto-resize */
textarea {
  resize: none;
  overflow-y: auto;
}

/* Responsive text wrapping */
.break-words {
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

/* Smooth transitions for mobile sidebar */
.transform {
  transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
}

/* Ensure proper touch targets on mobile */
@media (max-width: 1023px) {
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }
}

/* Responsive font scaling */
@media (max-width: 640px) {
  .text-responsive {
    font-size: 0.875rem; /* 14px */
  }
}

@media (min-width: 641px) {
  .text-responsive {
    font-size: 1rem; /* 16px */
  }
}

/* Line clamp utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Improve readability on small screens */
@media (max-width: 480px) {
  .leading-relaxed {
    line-height: 1.75;
  }
}

/* Landscape mode optimizations for mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .h-full {
    height: 100vh;
  }

  .max-h-\[90vh\] {
    max-height: 85vh;
  }
}
</style>
