<template>
  <div class="h-full flex flex-col lg:flex-row bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="p-6">
      <div class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-start space-x-4">
            <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <IconUser class="w-6 h-6" />
            </div>
            <div>
              <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
              <p class="text-purple-100 text-sm">
                Connect your Nostr identity to send and receive encrypted messages with Lightning zaps.
              </p>
            </div>
          </div>
          <button
            @click="handleNostrLogin"
            class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
          >
            <IconBolt class="w-4 h-4" />
            <span>Connect with Nostr</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Chat Interface -->
    <div v-else class="h-full flex flex-col lg:flex-row">
      <!-- Conversations Sidebar -->
      <div class="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-orange-100/50 flex flex-col">
        <!-- Sidebar Header -->
        <div class="p-4 border-b border-orange-100/50">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconMessageCircle class="w-5 h-5 text-orange-600" />
              <span>Messages</span>
            </h2>
            <button
              @click="showNewChatModal = true"
              class="btn-primary text-sm"
              title="Start new conversation"
            >
              <IconPlus class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Search -->
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search conversations..."
              class="w-full pl-10 pr-4 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
            />
            <IconSearch class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          </div>
        </div>

        <!-- Conversations List -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="isLoading" class="p-4">
            <div class="animate-pulse space-y-3">
              <div v-for="i in 3" :key="i" class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="filteredConversations.length === 0" class="p-6 text-center">
            <IconMessageCircle class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h3 class="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
            <p class="text-gray-600 text-sm mb-4">Start a new conversation to begin messaging.</p>
            <button
              @click="showNewChatModal = true"
              class="btn-primary text-sm"
            >
              <IconPlus class="w-4 h-4" />
              Start Conversation
            </button>
          </div>

          <div v-else class="divide-y divide-orange-100/50">
            <div
              v-for="conversation in filteredConversations"
              :key="conversation.id"
              @click="setActiveConversation(conversation)"
              :class="[
                'p-4 hover:bg-orange-25/50 cursor-pointer transition-colors',
                activeConversation?.id === conversation.id ? 'bg-orange-50 border-r-2 border-orange-400' : ''
              ]"
            >
              <div class="flex items-center space-x-3">
                <!-- Avatar -->
                <div class="relative">
                  <img
                    :src="conversation.profile.picture || generateAvatar(conversation.pubkey)"
                    :alt="conversation.profile.name"
                    class="w-10 h-10 rounded-full border-2 border-orange-200"
                    @error="$event.target.src = generateAvatar(conversation.pubkey)"
                  />
                  <div v-if="conversation.unreadCount > 0" class="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                    {{ conversation.unreadCount > 9 ? '9+' : conversation.unreadCount }}
                  </div>
                </div>

                <!-- Conversation Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h3 class="font-medium text-gray-900 truncate">{{ conversation.profile.name }}</h3>
                    <span class="text-xs text-gray-500">{{ formatMessageTime(conversation.lastMessageTime) }}</span>
                  </div>
                  <p class="text-sm text-gray-600 truncate">{{ conversation.lastMessage || 'No messages yet' }}</p>
                  <div v-if="conversation.profile.nip05" class="text-xs text-gray-500 truncate">{{ conversation.profile.nip05 }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="flex-1 flex flex-col">
        <!-- No Active Conversation -->
        <div v-if="!activeConversation" class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <IconMessageCircle class="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h3>
            <p class="text-gray-600 mb-6">Choose a conversation from the sidebar to start messaging.</p>
            <button
              @click="showNewChatModal = true"
              class="btn-primary"
            >
              <IconPlus class="w-4 h-4" />
              Start New Conversation
            </button>
          </div>
        </div>

        <!-- Active Conversation -->
        <div v-else class="flex-1 flex flex-col">
          <!-- Chat Header -->
          <div class="p-4 border-b border-orange-100/50 bg-white/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <img
                  :src="activeConversation.profile.picture || generateAvatar(activeConversation.pubkey)"
                  :alt="activeConversation.profile.name"
                  class="w-10 h-10 rounded-full border-2 border-orange-200"
                  @error="$event.target.src = generateAvatar(activeConversation.pubkey)"
                />
                <div>
                  <h3 class="font-semibold text-gray-900">{{ activeConversation.profile.name }}</h3>
                  <p class="text-sm text-gray-600">{{ activeConversation.profile.nip05 || truncatePubkey(activeConversation.pubkey) }}</p>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <!-- Zap Button -->
                <button
                  v-if="isWalletConnected"
                  @click="showZapModal = true"
                  class="btn-secondary text-sm"
                  title="Send Lightning Zap"
                >
                  <IconBolt class="w-4 h-4" />
                  Zap
                </button>
                
                <!-- More Options -->
                <div class="relative" ref="optionsDropdown">
                  <button
                    @click="showOptions = !showOptions"
                    class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <IconDots class="w-4 h-4" />
                  </button>
                  
                  <div v-if="showOptions" class="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                    <button
                      @click="copyPubkey(activeConversation.pubkey)"
                      class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <IconCopy class="w-4 h-4" />
                      <span>Copy Pubkey</span>
                    </button>
                    <button
                      @click="blockUser(activeConversation.pubkey)"
                      class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <IconUserX class="w-4 h-4" />
                      <span>Block User</span>
                    </button>
                    <button
                      @click="deleteConversation(activeConversation.pubkey)"
                      class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <IconTrash class="w-4 h-4" />
                      <span>Delete Conversation</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Messages Area -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4" ref="messagesContainer">
            <div v-if="activeMessages.length === 0" class="text-center py-8">
              <IconMessageCircle class="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p class="text-gray-600">No messages yet. Start the conversation!</p>
            </div>

            <div
              v-for="message in activeMessages"
              :key="message.id"
              :class="[
                'flex',
                message.isOutgoing ? 'justify-end' : 'justify-start'
              ]"
            >
              <div
                :class="[
                  'max-w-xs lg:max-w-md px-4 py-2 rounded-lg',
                  message.isOutgoing
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                ]"
              >
                <p class="text-sm">{{ message.content }}</p>
                <div class="flex items-center justify-between mt-1">
                  <span :class="[
                    'text-xs',
                    message.isOutgoing ? 'text-orange-100' : 'text-gray-500'
                  ]">
                    {{ formatMessageTime(message.timestamp) }}
                  </span>
                  <div v-if="message.zap" class="flex items-center space-x-1 ml-2">
                    <IconBolt class="w-3 h-3" />
                    <span class="text-xs">{{ message.zap.amount }} sats</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Message Input -->
          <div class="p-4 border-t border-orange-100/50 bg-white/50">
            <div class="flex items-end space-x-3">
              <div class="flex-1">
                <textarea
                  v-model="newMessage"
                  @keydown.enter.exact.prevent="handleSendMessage"
                  @keydown.enter.shift.exact="newMessage += '\n'"
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  rows="1"
                  class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 resize-none"
                  style="min-height: 44px; max-height: 120px;"
                  ref="messageInput"
                ></textarea>
              </div>
              
              <!-- Zap Amount Input -->
              <div v-if="isWalletConnected" class="flex flex-col items-center space-y-1">
                <input
                  v-model.number="zapAmount"
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-20 px-2 py-1 border border-orange-200/50 rounded text-center text-sm"
                  title="Zap amount in sats (optional)"
                />
                <span class="text-xs text-gray-500">sats</span>
              </div>
              
              <button
                @click="handleSendMessage"
                :disabled="!newMessage.trim() || isSending"
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLoader v-if="isSending" class="w-4 h-4 animate-spin" />
                <IconSend v-else class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- New Chat Modal -->
    <div v-if="showNewChatModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl p-6 max-w-md w-full">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-semibold text-gray-900">Start New Conversation</h3>
          <button @click="showNewChatModal = false" class="text-gray-500 hover:text-gray-700">
            <IconX class="w-5 h-5" />
          </button>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Nostr Public Key or npub</label>
            <input
              v-model="newChatPubkey"
              type="text"
              placeholder="npub1... or hex pubkey"
              class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            />
            <p class="text-xs text-gray-500 mt-1">
              Enter a Nostr public key (npub1...) or hex format
            </p>
          </div>
          
          <div v-if="newChatError" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-600">{{ newChatError }}</p>
          </div>
          
          <div class="flex space-x-3">
            <button @click="showNewChatModal = false" class="btn-secondary flex-1">Cancel</button>
            <button @click="handleStartConversation" class="btn-primary flex-1">Start Chat</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Zap Modal -->
    <div v-if="showZapModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl p-6 max-w-md w-full">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-semibold text-gray-900">Send Lightning Zap</h3>
          <button @click="showZapModal = false" class="text-gray-500 hover:text-gray-700">
            <IconX class="w-5 h-5" />
          </button>
        </div>
        
        <div class="space-y-4">
          <div class="text-center">
            <img
              :src="activeConversation?.profile.picture || generateAvatar(activeConversation?.pubkey)"
              :alt="activeConversation?.profile.name"
              class="w-16 h-16 rounded-full mx-auto mb-3 border-2 border-orange-200"
            />
            <h4 class="font-medium text-gray-900">{{ activeConversation?.profile.name }}</h4>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount (sats)</label>
            <input
              v-model.number="zapModalAmount"
              type="number"
              min="1"
              placeholder="1000"
              class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Message (optional)</label>
            <textarea
              v-model="zapComment"
              placeholder="Add a message with your zap..."
              rows="3"
              class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
            ></textarea>
          </div>
          
          <div v-if="zapError" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-600">{{ zapError }}</p>
          </div>
          
          <div class="flex space-x-3">
            <button @click="showZapModal = false" class="btn-secondary flex-1">Cancel</button>
            <button @click="handleSendZap" :disabled="!zapModalAmount || zapModalAmount <= 0 || isSendingZap" class="btn-primary flex-1">
              <IconLoader v-if="isSendingZap" class="w-4 h-4 animate-spin" />
              <IconBolt v-else class="w-4 h-4" />
              Send Zap
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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
  IconLoader
} from '@iconify-prerendered/vue-tabler'
import { useNostrChat } from '../composables/useNostrChat.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrConnections } from '../composables/useNostrConnections.js'

const { isAuthenticated, login } = useNostrAuth()
const { isWalletConnected } = useNostrConnections()

const {
  conversations,
  activeConversation,
  activeMessages,
  isLoading,
  error,
  canSendMessages,
  sendMessage,
  sendZap,
  startConversation,
  setActiveConversation,
  clearActiveConversation,
  deleteConversation,
  blockUser,
  formatMessageTime
} = useNostrChat()

// Local state
const searchQuery = ref('')
const newMessage = ref('')
const zapAmount = ref(0)
const isSending = ref(false)

// Modal state
const showNewChatModal = ref(false)
const newChatPubkey = ref('')
const newChatError = ref('')

const showZapModal = ref(false)
const zapModalAmount = ref(1000)
const zapComment = ref('')
const isSendingZap = ref(false)
const zapError = ref('')

const showOptions = ref(false)

// Refs
const messageInput = ref(null)
const messagesContainer = ref(null)
const optionsDropdown = ref(null)

// Computed
const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value
  
  const query = searchQuery.value.toLowerCase()
  return conversations.value.filter(conv => 
    conv.profile.name.toLowerCase().includes(query) ||
    conv.profile.nip05?.toLowerCase().includes(query) ||
    conv.pubkey.toLowerCase().includes(query)
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

const handleSendMessage = async () => {
  if (!newMessage.value.trim() || isSending.value) return
  
  isSending.value = true
  
  try {
    await sendMessage(
      activeConversation.value.pubkey, 
      newMessage.value.trim(),
      zapAmount.value || 0
    )
    
    newMessage.value = ''
    zapAmount.value = 0
    
    // Scroll to bottom
    await nextTick()
    scrollToBottom()
    
  } catch (error) {
    console.error('Failed to send message:', error)
    // You could show an error notification here
  } finally {
    isSending.value = false
  }
}

const handleStartConversation = async () => {
  if (!newChatPubkey.value.trim()) return
  
  newChatError.value = ''
  
  try {
    await startConversation(newChatPubkey.value.trim())
    showNewChatModal.value = false
    newChatPubkey.value = ''
  } catch (error) {
    newChatError.value = error.message
  }
}

const handleSendZap = async () => {
  if (!zapModalAmount.value || zapModalAmount.value <= 0) return
  
  isSendingZap.value = true
  zapError.value = ''
  
  try {
    await sendZap(
      activeConversation.value.pubkey,
      zapModalAmount.value,
      zapComment.value
    )
    
    showZapModal.value = false
    zapModalAmount.value = 1000
    zapComment.value = ''
    
  } catch (error) {
    zapError.value = error.message
  } finally {
    isSendingZap.value = false
  }
}

const copyPubkey = async (pubkey) => {
  try {
    await navigator.clipboard.writeText(pubkey)
    showOptions.value = false
    // You could show a success notification here
  } catch (error) {
    console.error('Failed to copy pubkey:', error)
  }
}

const truncatePubkey = (pubkey) => {
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}

const generateAvatar = (pubkey) => {
  // Generate a deterministic avatar based on pubkey
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Auto-scroll to bottom when new messages arrive
watch(activeMessages, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

// Close options dropdown when clicking outside
const handleClickOutside = (event) => {
  if (optionsDropdown.value && !optionsDropdown.value.contains(event.target)) {
    showOptions.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Auto-resize textarea
watch(newMessage, () => {
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.style.height = 'auto'
      messageInput.value.style.height = Math.min(messageInput.value.scrollHeight, 120) + 'px'
    }
  })
})
</script>

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
</style>