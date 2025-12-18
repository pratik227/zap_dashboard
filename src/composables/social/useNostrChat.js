import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNostrConnections } from '../core/useNostrConnections.js'
import { useNotifications } from '../core/useNotifications.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { nip04 } from 'nostr-tools'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import { payInvoice, makeInvoice } from '../../utils/wallet/nwcClient.js'
import * as nip19 from 'nostr-tools/nip19'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

// Global state for chat
const conversations = ref(new Map()) // Map<pubkey, conversation>
const messages = ref(new Map()) // Map<conversationId, message[]>
const activeConversation = ref(null)
const isLoading = ref(false)
const error = ref('')

// Chat subscription management
let chatSubscription = null
let profileSubscriptions = new Map()
const processedEventIds = new Set()

// Message structure
const createMessage = (event, decryptedContent, isOutgoing = false) => {
  return {
    id: event.id,
    content: decryptedContent,
    timestamp: event.created_at * 1000,
    isOutgoing,
    sender: event.pubkey,
    recipient: event.tags.find(tag => tag[0] === 'p')?.[1],
    rawEvent: event,
    status: 'sent', // sent, delivered, failed
    zap: null // Will contain zap info if message has attached zap
  }
}

// Conversation structure
const createConversation = (pubkey, profile = null) => {
  return {
    id: pubkey,
    pubkey,
    profile: profile || {
      name: `User ${pubkey.substring(0, 8)}`,
      picture: generateAvatar(pubkey),
      nip05: null,
      about: null
    },
    lastMessage: null,
    lastMessageTime: 0,
    unreadCount: 0,
    isPaidDM: false,
    paidDMAmount: 0,
    isBlocked: false
  }
}

// generateAvatar imported from avatarGenerator.js

// Fetch user profile using centralized profileFetcher
const fetchUserProfile = async (pubkey) => {
  const profile = await fetchProfile(pubkey, { ttl: 3600000 })
  // Fallback avatar if missing
  if (profile && !profile.picture) {
    profile.picture = generateAvatar(pubkey)
  }
  return profile
}

export function useNostrChat() {
  const { currentUser, isAuthenticated } = useNostrAuth()
  const { isWalletConnected } = useNostrConnections()
  const { handleZapSent, handleZapReceived } = useNotifications()

  // Computed properties
  const sortedConversations = computed(() => {
    return Array.from(conversations.value.values())
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
  })

  const activeMessages = computed(() => {
    if (!activeConversation.value) return []
    return messages.value.get(activeConversation.value.id) || []
  })

  const canSendMessages = computed(() => {
    return isAuthenticated.value && currentUser.value?.pubkey
  })

  // Initialize chat system
  const initializeChat = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) {
      console.log('Not authenticated, cannot initialize chat')
      return
    }

    isLoading.value = true
    error.value = ''

    try {
      console.log('🚀 Initializing Nostr chat system...')
      
      // Subscribe to incoming DMs (kind 4 events)
      await subscribeToMessages()
      
      console.log('✅ Chat system initialized successfully')
    } catch (err) {
      console.error('❌ Failed to initialize chat:', err)
      error.value = 'Failed to initialize chat: ' + err.message
    } finally {
      isLoading.value = false
    }
  }

  // Subscribe to incoming messages
  const subscribeToMessages = async () => {
    if (chatSubscription) {
      chatSubscription.close()
    }

    try {
      console.log('📥 Subscribing to incoming DMs...')
      
      chatSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [4], // Encrypted DMs
          '#p': [currentUser.value.pubkey], // Messages to us
          limit: 100
        },
        {
          kinds: [4], // Encrypted DMs
          authors: [currentUser.value.pubkey], // Messages from us
          limit: 100
        }
      ], {
        onevent: (event) => {
          handleIncomingMessage(event)
        },
        oneose: () => {
          console.log('📡 End of stored DM events')
        },
        onclose: (reason) => {
          console.log('🔌 DM subscription closed:', reason)
        }
      })

      console.log('✅ Subscribed to DMs successfully')
    } catch (error) {
      console.error('❌ Failed to subscribe to messages:', error)
      throw error
    }
  }

  // Handle incoming message events
  const handleIncomingMessage = async (event) => {
    // Prevent duplicate processing
    if (processedEventIds.has(event.id)) {
      return
    }
    processedEventIds.add(event.id)

    try {
      console.log('📨 Processing incoming message:', event.id.substring(0, 16) + '...')
      
      // Determine if this is an outgoing or incoming message
      const isOutgoing = event.pubkey === currentUser.value.pubkey
      const otherPartyPubkey = isOutgoing 
        ? event.tags.find(tag => tag[0] === 'p')?.[1]
        : event.pubkey

      if (!otherPartyPubkey) {
        return
      }

      // Decrypt the message content
      let decryptedContent
      
      // Check if content looks like encrypted data (base64 with ?iv=)
      const isEncrypted = event.content.includes('?iv=') || event.content.includes('==')
      
      if (isEncrypted) {
        try {
          if (isOutgoing) {
            // For outgoing messages, we need to decrypt with recipient's pubkey
            const recipientPubkey = event.tags.find(tag => tag[0] === 'p')?.[1]
            if (currentUser.value.privkey) {
              decryptedContent = await nip04.decrypt(currentUser.value.privkey, recipientPubkey, event.content)
            } else if (window.nostr?.nip04?.decrypt) {
              decryptedContent = await window.nostr.nip04.decrypt(recipientPubkey, event.content)
            } else {
              throw new Error('No decryption method available')
            }
          } else {
            // For incoming messages, we need to decrypt with sender's pubkey
            if (currentUser.value.privkey) {
              decryptedContent = await nip04.decrypt(currentUser.value.privkey, event.pubkey, event.content)
            } else if (window.nostr?.nip04?.decrypt) {
              decryptedContent = await window.nostr.nip04.decrypt(event.pubkey, event.content)
            } else {
              throw new Error('No decryption method available')
            }
          }
          
          console.log('🔓 Successfully decrypted message:', decryptedContent.substring(0, 50) + '...')
        } catch (decryptError) {
          console.warn('⚠️ Failed to decrypt message:', decryptError)
          decryptedContent = '[Encrypted message - unable to decrypt]'
        }
      } else {
        // Content is already plain text
        decryptedContent = event.content
        console.log('📝 Using plain text message:', decryptedContent.substring(0, 50) + '...')
      }

      // Create message object
      const message = createMessage(event, decryptedContent, isOutgoing)

      // Get or create conversation
      let conversation = conversations.value.get(otherPartyPubkey)
      if (!conversation) {
        conversation = createConversation(otherPartyPubkey)
        conversations.value.set(otherPartyPubkey, conversation)
        // Fetch profile for new conversation using centralized fetcher
        fetchUserProfile(otherPartyPubkey).then(profile => {
          if (conversation) {
            conversation.profile = profile
          }
        })
      }

      // Add message to conversation
      const conversationMessages = messages.value.get(otherPartyPubkey) || []
      
      // Check for duplicates
      const existingMessage = conversationMessages.find(m => m.id === message.id)
      if (!existingMessage) {
        conversationMessages.push(message)
        conversationMessages.sort((a, b) => a.timestamp - b.timestamp)
        messages.value.set(otherPartyPubkey, conversationMessages)

        // Update conversation metadata
        conversation.lastMessage = message.content
        conversation.lastMessageTime = message.timestamp
        
        if (!isOutgoing && (!activeConversation.value || activeConversation.value.id !== otherPartyPubkey)) {
          conversation.unreadCount++
        }

        console.log('✅ Added message to conversation:', otherPartyPubkey.substring(0, 8) + '...')
      }

    } catch (error) {
      console.error('❌ Failed to process incoming message:', error)
    }
  }

  // Send a message
  const sendMessage = async (recipientPubkey, content, zapAmount = 0) => {
    if (!canSendMessages.value) {
      throw new Error('Cannot send messages: not authenticated')
    }

    if (!content.trim()) {
      throw new Error('Message content cannot be empty')
    }

    try {
      console.log('📤 Sending message to:', recipientPubkey.substring(0, 8) + '...')
      
      // Encrypt the message
      let encryptedContent
      if (currentUser.value.privkey) {
        // Use local private key
        encryptedContent = await nip04.encrypt(currentUser.value.privkey, recipientPubkey, content)
      } else if (window.nostr?.nip04?.encrypt) {
        // Use browser extension
        encryptedContent = await window.nostr.nip04.encrypt(recipientPubkey, content)
      } else {
        throw new Error('No encryption method available')
      }

      // Create DM event
      const eventTemplate = {
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', recipientPubkey]],
        content: encryptedContent
      }

      // Sign the event
      let signedEvent
      if (currentUser.value.privkey) {
        signedEvent = finalizeEvent(eventTemplate, currentUser.value.privkey)
      } else if (window.nostr?.signEvent) {
        signedEvent = await window.nostr.signEvent(eventTemplate)
      } else {
        throw new Error('No signing method available')
      }

      // Verify the event
      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      // Publish the event
      const result = await nostrRelayManager.publishEvent(signedEvent)
      
      if (result.successful === 0) {
        throw new Error('Failed to publish message to any relays')
      }

      console.log('✅ Message sent successfully to', result.successful, 'relays')

      // Send zap if amount specified
      if (zapAmount > 0 && isWalletConnected.value) {
        try {
          await sendZap(recipientPubkey, zapAmount, `Zap with message: ${content.substring(0, 50)}...`)
        } catch (zapError) {
          console.warn('⚠️ Message sent but zap failed:', zapError)
        }
      }

      return signedEvent

    } catch (error) {
      console.error('❌ Failed to send message:', error)
      throw error
    }
  }

  // Send a zap
  const sendZap = async (recipientPubkey, amountSats, comment = '') => {
    if (!isWalletConnected.value) {
      throw new Error('Wallet not connected')
    }

    try {
      console.log('⚡ Sending zap:', amountSats, 'sats to', recipientPubkey.substring(0, 8) + '...')
      
      // For now, we'll use a simple invoice creation and payment
      // In a full implementation, you'd create a proper zap request following NIP-57
      
      const invoice = await makeInvoice({
        amount: amountSats * 1000, // Convert to msats
        description: comment || `Zap from ${currentUser.value.profile?.name || 'Anonymous'}`
      })

      const payment = await payInvoice({ invoice: invoice.invoice })
      
      handleZapSent({ amount: amountSats })
      console.log('✅ Zap sent successfully')
      
      return payment
    } catch (error) {
      console.error('❌ Failed to send zap:', error)
      throw error
    }
  }

  // Start conversation with a user
  const startConversation = async (pubkeyOrNpub) => {
    try {
      let pubkey = pubkeyOrNpub
      
      // Convert npub to pubkey if needed
      if (pubkeyOrNpub.startsWith('npub1')) {
        const decoded = nip19.decode(pubkeyOrNpub)
        if (decoded.type === 'npub') {
          pubkey = decoded.data
        } else {
          throw new Error('Invalid npub format')
        }
      }

      // Validate pubkey format (64 character hex string)
      if (!/^[a-f0-9]{64}$/i.test(pubkey)) {
        throw new Error('Invalid pubkey format')
      }

      // Don't allow messaging yourself
      if (pubkey === currentUser.value.pubkey) {
        throw new Error('Cannot message yourself')
      }

      // Get or create conversation
      let conversation = conversations.value.get(pubkey)
      if (!conversation) {
        conversation = createConversation(pubkey)
        conversations.value.set(pubkey, conversation)
        
        // Initialize empty message array
        messages.value.set(pubkey, [])
        
        // Fetch profile with enhanced fetching
        fetchUserProfile(pubkey).then(profile => {
          if (conversation) {
            conversation.profile = profile
            console.log('✅ Updated new conversation profile for:', profile.name)
          }
        }).catch(error => {
          console.warn('Failed to update new conversation profile:', error)
        })
      }

      // Set as active conversation
      activeConversation.value = conversation
      
      // Mark as read
      conversation.unreadCount = 0

      console.log('✅ Started conversation with:', pubkey.substring(0, 8) + '...')
      return conversation

    } catch (error) {
      console.error('❌ Failed to start conversation:', error)
      throw error
    }
  }

  // Set active conversation
  const setActiveConversation = (conversation) => {
    activeConversation.value = conversation
    if (conversation) {
      conversation.unreadCount = 0
    }
  }

  // Clear active conversation
  const clearActiveConversation = () => {
    activeConversation.value = null
  }

  // Delete conversation
  const deleteConversation = (pubkey) => {
    conversations.value.delete(pubkey)
    messages.value.delete(pubkey)
    
    if (activeConversation.value?.id === pubkey) {
      activeConversation.value = null
    }
    
    console.log('🗑️ Deleted conversation with:', pubkey.substring(0, 8) + '...')
  }

  // Refresh profile for a conversation
  const refreshConversationProfile = async (pubkey) => {
    try {
      const profile = await fetchUserProfile(pubkey)
      const conversation = conversations.value.get(pubkey)
      
      if (conversation) {
        conversation.profile = profile
        console.log('🔄 Refreshed profile for:', profile.name)
      }
      
      return profile
    } catch (error) {
      console.error('Failed to refresh conversation profile:', error)
      throw error
    }
  }

  // Block user
  const blockUser = (pubkey) => {
    const conversation = conversations.value.get(pubkey)
    if (conversation) {
      conversation.isBlocked = true
      console.log('🚫 Blocked user:', pubkey.substring(0, 8) + '...')
    }
  }

  // Unblock user
  const unblockUser = (pubkey) => {
    const conversation = conversations.value.get(pubkey)
    if (conversation) {
      conversation.isBlocked = false
      console.log('✅ Unblocked user:', pubkey.substring(0, 8) + '...')
    }
  }

  // Format timestamp for display
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
    
    return date.toLocaleDateString()
  }

  // Cleanup function
  const cleanup = () => {
    if (chatSubscription) {
      chatSubscription.close()
      chatSubscription = null
    }
    
    profileSubscriptions.forEach(sub => sub.close())
    profileSubscriptions.clear()
    
    processedEventIds.clear()
    console.log('🧹 Chat cleanup completed')
  }

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      setTimeout(() => {
        initializeChat()
      }, 1000)
    } else {
      cleanup()
      conversations.value.clear()
      messages.value.clear()
      activeConversation.value = null
    }
  }, { immediate: true })

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    conversations: computed(() => conversations.value),
    messages: computed(() => messages.value),
    activeConversation: computed(() => activeConversation.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    
    // Computed
    sortedConversations,
    activeMessages,
    canSendMessages,
    
    // Actions
    initializeChat,
    sendMessage,
    sendZap,
    startConversation,
    setActiveConversation,
    clearActiveConversation,
    deleteConversation,
    blockUser,
    unblockUser,
    refreshConversationProfile,
    
    // Utilities
    formatMessageTime,
    cleanup
  }
}