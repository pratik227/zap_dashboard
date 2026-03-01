import { ref, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { nip04, nip44, hexToBytes } from 'nostr-core'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

/**
 * Map chat/encryption errors to user-friendly messages.
 */
export function getUserFriendlyChatError(error) {
  const msg = error.message?.toLowerCase() || ''

  // Encryption/decryption failures
  if (msg.includes('no encryption method') || msg.includes('no decryption method')) {
    return 'No encryption key available. Please log in with a Nostr extension or private key.'
  }
  if (msg.includes('decrypt') || msg.includes('bad mac') || msg.includes('invalid ciphertext')) {
    return 'Could not decrypt this message. It may use a different encryption protocol.'
  }
  if (msg.includes('encrypt')) {
    return 'Failed to encrypt message. Please check your connection and try again.'
  }

  // Signing failures
  if (msg.includes('no signing method')) {
    return 'Cannot sign messages. Please connect a Nostr extension or provide a private key.'
  }
  if (msg.includes('signature verification failed')) {
    return 'Message signature verification failed. Please try again.'
  }

  // Relay/network failures
  if (msg.includes('publish') || msg.includes('relay')) {
    return 'Could not deliver message. Relays may be unreachable — try again shortly.'
  }

  // Identity errors
  if (msg.includes('cannot message yourself')) {
    return 'You cannot send messages to yourself.'
  }
  if (msg.includes('invalid npub') || msg.includes('invalid pubkey')) {
    return 'Invalid user address. Please check the npub or pubkey format.'
  }
  if (msg.includes('not authenticated')) {
    return 'You need to log in before sending messages.'
  }
  if (msg.includes('empty') || msg.includes('cannot be empty')) {
    return 'Please enter a message before sending.'
  }

  return error.message || 'Something went wrong. Please try again.'
}

// Global state for chat
const conversations = ref(new Map())
const messages = ref(new Map())
const activeConversation = ref(null)
const isLoading = ref(false)
const isSending = ref(false)
const error = ref('')

// Chat subscription management
let chatSubscription = null
const processedEventIds = new Set()
const MAX_PROCESSED_IDS = 2000

// NIP-44 conversation key cache
const conversationKeyCache = new Map()

// Reactivity version counter — incremented to force computed re-evaluation
const _version = ref(0)
const triggerUpdate = () => { _version.value++ }

const getOrCreateConversationKey = (privkeyHex, pubkeyHex) => {
  if (conversationKeyCache.has(pubkeyHex)) {
    return conversationKeyCache.get(pubkeyHex)
  }
  const privkeyBytes = hexToBytes(privkeyHex)
  const convKey = nip44.getConversationKey(privkeyBytes, pubkeyHex)
  conversationKeyCache.set(pubkeyHex, convKey)
  return convKey
}

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
    status: 'sent',
    zap: null
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
    unreadCount: 0
  }
}

// Fetch user profile using centralized profileFetcher
const fetchUserProfile = async (pubkey) => {
  const profile = await fetchProfile(pubkey, { ttl: 3600000 })
  if (profile && !profile.picture) {
    profile.picture = generateAvatar(pubkey)
  }
  return profile
}

// Unified encrypt helper — prefers NIP-44, falls back to NIP-04
const encryptMessage = async (content, recipientPubkey, currentUser) => {
  if (window.nostr?.nip44?.encrypt) {
    try {
      return await window.nostr.nip44.encrypt(recipientPubkey, content)
    } catch (e) {
      console.warn('NIP-44 extension encrypt failed, trying fallback:', e.message)
    }
  }
  if (currentUser.privkey) {
    try {
      const convKey = getOrCreateConversationKey(currentUser.privkey, recipientPubkey)
      return nip44.encrypt(content, convKey)
    } catch (e) {
      console.warn('NIP-44 local encrypt failed, trying NIP-04:', e.message)
    }
  }
  if (window.nostr?.nip04?.encrypt) {
    return await window.nostr.nip04.encrypt(recipientPubkey, content)
  }
  if (currentUser.privkey) {
    return nip04.encrypt(currentUser.privkey, recipientPubkey, content)
  }
  throw new Error('No encryption method available')
}

// Unified decrypt helper — tries NIP-44 first, falls back to NIP-04
const decryptMessage = async (content, counterpartyPubkey, currentUser) => {
  if (window.nostr?.nip44?.decrypt) {
    try {
      return await window.nostr.nip44.decrypt(counterpartyPubkey, content)
    } catch (e) {
      console.warn('NIP-44 extension decrypt failed, trying fallback:', e.message)
    }
  }
  if (currentUser.privkey) {
    try {
      const convKey = getOrCreateConversationKey(currentUser.privkey, counterpartyPubkey)
      return nip44.decrypt(content, convKey)
    } catch (e) {
      console.warn('NIP-44 local decrypt failed, trying NIP-04:', e.message)
    }
  }
  if (window.nostr?.nip04?.decrypt) {
    return await window.nostr.nip04.decrypt(counterpartyPubkey, content)
  }
  if (currentUser.privkey) {
    return nip04.decrypt(currentUser.privkey, counterpartyPubkey, content)
  }
  throw new Error('No decryption method available')
}

// Helper to add a message to a conversation (with reactivity fix)
const addMessageToConversation = (pubkey, message) => {
  const existing = messages.value.get(pubkey) || []
  // Deduplicate
  if (existing.some(m => m.id === message.id)) return false
  const updated = [...existing, message].sort((a, b) => a.timestamp - b.timestamp)
  messages.value.set(pubkey, updated)
  triggerUpdate()
  return true
}

export function useNostrChat() {
  const { currentUser, isAuthenticated } = useNostrAuth()


  // Computed properties — depend on _version for forced re-evaluation
  const sortedConversations = computed(() => {
    _version.value // dependency
    return Array.from(conversations.value.values())
      .sort((a, b) => b.lastMessageTime - a.lastMessageTime)
  })

  const activeMessages = computed(() => {
    _version.value // dependency
    if (!activeConversation.value) return []
    return messages.value.get(activeConversation.value.id) || []
  })

  const canSendMessages = computed(() => {
    return isAuthenticated.value && currentUser.value?.pubkey
  })

  // Initialize chat system
  const initializeChat = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return

    isLoading.value = true
    error.value = ''

    try {
      await subscribeToMessages()
    } catch (err) {
      console.error('Failed to initialize chat:', err)
      error.value = getUserFriendlyChatError(err)
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
      chatSubscription = nostrRelayManager.subscribeToEvents([
        {
          kinds: [4],
          '#p': [currentUser.value.pubkey],
          limit: 100
        },
        {
          kinds: [4],
          authors: [currentUser.value.pubkey],
          limit: 100
        }
      ], {
        onevent: (event) => {
          handleIncomingMessage(event)
        },
        oneose: () => {
          console.log('End of stored DM events')
        },
        onclose: (reason) => {
          console.log('DM subscription closed:', reason)
        }
      })
    } catch (error) {
      console.error('Failed to subscribe to messages:', error)
      throw error
    }
  }

  // Handle incoming message events
  const handleIncomingMessage = async (event) => {
    if (processedEventIds.has(event.id)) return
    processedEventIds.add(event.id)
    if (processedEventIds.size > MAX_PROCESSED_IDS) {
      // Keep newest half by deleting oldest entries (Set iterates in insertion order)
      const toDelete = processedEventIds.size - Math.floor(MAX_PROCESSED_IDS / 2)
      let count = 0
      for (const id of processedEventIds) {
        if (count++ >= toDelete) break
        processedEventIds.delete(id)
      }
    }

    try {
      const isOutgoing = event.pubkey === currentUser.value.pubkey
      const otherPartyPubkey = isOutgoing
        ? event.tags.find(tag => tag[0] === 'p')?.[1]
        : event.pubkey

      if (!otherPartyPubkey) return

      // Decrypt
      let decryptedContent
      try {
        decryptedContent = await decryptMessage(event.content, otherPartyPubkey, currentUser.value)
      } catch (decryptError) {
        console.warn('Failed to decrypt message:', decryptError)
        decryptedContent = '[Encrypted message - unable to decrypt]'
      }

      const message = createMessage(event, decryptedContent, isOutgoing)

      // Get or create conversation
      let conversation = conversations.value.get(otherPartyPubkey)
      if (!conversation) {
        conversation = createConversation(otherPartyPubkey)
        conversations.value.set(otherPartyPubkey, conversation)
        fetchUserProfile(otherPartyPubkey).then(profile => {
          if (profile && conversations.value.has(otherPartyPubkey)) {
            const conv = conversations.value.get(otherPartyPubkey)
            conv.profile = profile
            conversations.value.set(otherPartyPubkey, { ...conv })
            triggerUpdate()
          }
        })
      }

      // Add message
      const added = addMessageToConversation(otherPartyPubkey, message)
      if (added) {
        conversation.lastMessage = message.content
        conversation.lastMessageTime = message.timestamp

        if (!isOutgoing && activeConversation.value?.id !== otherPartyPubkey) {
          conversation.unreadCount = (conversation.unreadCount || 0) + 1
        }

        // Re-set conversation to trigger reactivity
        conversations.value.set(otherPartyPubkey, { ...conversation })
        triggerUpdate()
      }
    } catch (error) {
      console.error('Failed to process incoming message:', error)
    }
  }

  // Send a message
  const sendMessage = async (recipientPubkey, content) => {
    if (!canSendMessages.value) {
      throw new Error('Cannot send messages: not authenticated')
    }
    if (!content.trim()) {
      throw new Error('Message content cannot be empty')
    }

    isSending.value = true

    try {
      // Encrypt the message (NIP-44 preferred, NIP-04 fallback)
      const encryptedContent = await encryptMessage(content, recipientPubkey, currentUser.value)

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

      if (!verifyEvent(signedEvent)) {
        throw new Error('Event signature verification failed')
      }

      // Optimistic: show message immediately before relay confirms
      const optimisticMessage = createMessage(signedEvent, content, true)
      optimisticMessage.status = 'sending'
      addMessageToConversation(recipientPubkey, optimisticMessage)

      // Update conversation metadata immediately
      const conversation = conversations.value.get(recipientPubkey)
      if (conversation) {
        conversation.lastMessage = content
        conversation.lastMessageTime = optimisticMessage.timestamp
        conversations.value.set(recipientPubkey, { ...conversation })
        triggerUpdate()
      }

      // Publish the event
      const result = await nostrRelayManager.publishEvent(signedEvent)

      if (result.successful === 0) {
        // Mark as failed
        const msgs = messages.value.get(recipientPubkey) || []
        const msg = msgs.find(m => m.id === signedEvent.id)
        if (msg) msg.status = 'failed'
        triggerUpdate()
        throw new Error('Failed to publish message to any relays')
      }

      // Mark as sent
      const msgs = messages.value.get(recipientPubkey) || []
      const msg = msgs.find(m => m.id === signedEvent.id)
      if (msg) msg.status = 'sent'
      triggerUpdate()

      return signedEvent
    } catch (err) {
      console.error('Failed to send message:', err)
      // Re-throw with user-friendly message while preserving original for logging
      const friendly = new Error(getUserFriendlyChatError(err))
      friendly.cause = err
      throw friendly
    } finally {
      isSending.value = false
    }
  }

  // Start conversation with a user
  const startConversation = async (pubkeyOrNpub) => {
    try {
      let pubkey = pubkeyOrNpub

      if (pubkeyOrNpub.startsWith('npub1')) {
        const decoded = nip19.decode(pubkeyOrNpub)
        if (decoded.type === 'npub') {
          pubkey = decoded.data
        } else {
          throw new Error('Invalid npub format')
        }
      }

      if (!/^[a-f0-9]{64}$/i.test(pubkey)) {
        throw new Error('Invalid pubkey format')
      }

      if (pubkey === currentUser.value.pubkey) {
        throw new Error('Cannot message yourself')
      }

      let conversation = conversations.value.get(pubkey)
      if (!conversation) {
        conversation = createConversation(pubkey)
        conversations.value.set(pubkey, conversation)
        messages.value.set(pubkey, [])
        triggerUpdate()

        fetchUserProfile(pubkey).then(profile => {
          if (profile && conversations.value.has(pubkey)) {
            const conv = conversations.value.get(pubkey)
            conv.profile = profile
            conversations.value.set(pubkey, { ...conv })
            triggerUpdate()
          }
        }).catch(err => console.warn('Profile fetch failed for', pubkey.substring(0, 8), err.message))
      }

      activeConversation.value = conversation
      conversation.unreadCount = 0
      triggerUpdate()

      return conversation
    } catch (error) {
      console.error('Failed to start conversation:', error)
      throw error
    }
  }

  // Set active conversation
  const setActiveConversation = (conversation) => {
    activeConversation.value = conversation
    if (conversation) {
      conversation.unreadCount = 0
      conversations.value.set(conversation.pubkey, { ...conversation })
      triggerUpdate()
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
    triggerUpdate()
  }

  // Refresh profile for a conversation
  const refreshConversationProfile = async (pubkey) => {
    try {
      const profile = await fetchUserProfile(pubkey)
      if (profile && conversations.value.has(pubkey)) {
        const conv = conversations.value.get(pubkey)
        conv.profile = profile
        conversations.value.set(pubkey, { ...conv })
        triggerUpdate()
      }
      return profile
    } catch (error) {
      console.error('Failed to refresh conversation profile:', error)
      throw error
    }
  }

  // Cleanup function
  const cleanup = () => {
    if (chatSubscription) {
      chatSubscription.close()
      chatSubscription = null
    }
    processedEventIds.clear()
    conversationKeyCache.clear()
  }

  // Initialize when authenticated
  watch(isAuthenticated, (authenticated) => {
    if (authenticated) {
      setTimeout(() => { initializeChat() }, 1000)
    } else {
      cleanup()
      conversations.value.clear()
      messages.value.clear()
      activeConversation.value = null
      triggerUpdate()
    }
  }, { immediate: true })

  return {
    // State
    activeConversation: computed(() => activeConversation.value),
    isLoading: computed(() => isLoading.value),
    isSending: computed(() => isSending.value),
    error: computed(() => error.value),

    // Computed
    sortedConversations,
    activeMessages,
    canSendMessages,

    // Actions
    initializeChat,
    sendMessage,
    startConversation,
    setActiveConversation,
    clearActiveConversation,
    deleteConversation,
    refreshConversationProfile,

    // Utilities
    cleanup
  }
}
