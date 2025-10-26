import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrConnections } from './useNostrConnections.js'
import { fetchTransactions, getBalance } from '../utils/nwcClient.js'

// Global notification state
const notifications = ref([])
const notificationSettings = ref({
  enabled: true,
  sound: false,
  desktop: true,
  zapReceived: true,
  zapSent: true,
  balanceChange: false,
  connectionStatus: false,
  engagements: true,
  engagementReplies: true,
  engagementReposts: true,
  engagementReactions: true,
  engagementMentions: true,
  social: true,
  socialNewFollowers: true,
  socialProfileMentions: true,
  socialTagMentions: true,
  contentNotifications: true,
  systemNotifications: true,
  minZapAmount: 1,
  balanceChangeThreshold: 1000,
  zapsByCampaign: true,
  zapsByArticle: true,
  zapsByNote: true,
  zapsByEvent: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00'
})

// Notification types
const NOTIFICATION_TYPES = {
  ZAP_RECEIVED: 'zap_received',
  ZAP_SENT: 'zap_sent',
  BALANCE_CHANGE: 'balance_change',
  CONNECTION_SUCCESS: 'connection_success',
  CONNECTION_ERROR: 'connection_error',
  WALLET_ERROR: 'wallet_error',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_ERROR: 'payment_error',
  ENGAGEMENT_REPLY: 'engagement_reply',
  ENGAGEMENT_REPOST: 'engagement_repost',
  ENGAGEMENT_REACTION: 'engagement_reaction',
  ENGAGEMENT_MENTION: 'engagement_mention',
  SOCIAL_NEW_FOLLOWER: 'social_new_follower',
  SOCIAL_PROFILE_MENTION: 'social_profile_mention',
  SOCIAL_TAG_MENTION: 'social_tag_mention',
  CONTENT_PUBLISHED: 'content_published',
  CONTENT_MILESTONE: 'content_milestone',
  SYSTEM_UPDATE: 'system_update',
  SYSTEM_ERROR: 'system_error'
}

// Notification categories
const NOTIFICATION_CATEGORIES = {
  ZAPS: 'zaps',
  ENGAGEMENTS: 'engagements',
  SOCIAL: 'social',
  WALLET: 'wallet',
  SYSTEM: 'system'
}

// Notification priority levels
const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
}

// Content types
const CONTENT_TYPES = {
  CAMPAIGN: 'campaign',
  ARTICLE: 'article',
  NOTE: 'note',
  EVENT: 'event',
  LONG_FORM: 'long_form'
}

// Storage keys
const NOTIFICATION_SETTINGS_KEY = 'notification_settings'
const LAST_TRANSACTION_KEY = 'last_transaction_timestamp'
const LAST_BALANCE_KEY = 'last_balance'
const PROCESSED_TRANSACTIONS_KEY = 'processed_transactions'
const NOTIFICATIONS_KEY = 'notifications_list'
const PROCESSED_NOTIFICATION_IDS_KEY = 'processed_notification_ids'

// Generate unique notification ID
const generateNotificationId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

// Generate content hash for deduplication
const generateContentHash = (type, data) => {
  const contentString = JSON.stringify({ type, ...data })
  let hash = 0
  for (let i = 0; i < contentString.length; i++) {
    const char = contentString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

// Get category from notification type
const getCategoryFromType = (type) => {
  if (type.startsWith('zap_') || type === NOTIFICATION_TYPES.BALANCE_CHANGE) {
    return NOTIFICATION_CATEGORIES.ZAPS
  }
  if (type.startsWith('engagement_')) {
    return NOTIFICATION_CATEGORIES.ENGAGEMENTS
  }
  if (type.startsWith('social_')) {
    return NOTIFICATION_CATEGORIES.SOCIAL
  }
  if (type.includes('connection') || type.includes('payment') || type.includes('wallet')) {
    return NOTIFICATION_CATEGORIES.WALLET
  }
  if (type.startsWith('system_') || type.startsWith('content_')) {
    return NOTIFICATION_CATEGORIES.SYSTEM
  }
  return NOTIFICATION_CATEGORIES.SYSTEM
}

// Get priority from notification type
const getPriorityFromType = (type, data = {}) => {
  if (type === NOTIFICATION_TYPES.ZAP_RECEIVED && data.amount >= 10000) {
    return NOTIFICATION_PRIORITY.HIGH
  }
  if (type === NOTIFICATION_TYPES.SYSTEM_ERROR || type === NOTIFICATION_TYPES.WALLET_ERROR) {
    return NOTIFICATION_PRIORITY.URGENT
  }
  if (type === NOTIFICATION_TYPES.CONNECTION_ERROR || type === NOTIFICATION_TYPES.PAYMENT_ERROR) {
    return NOTIFICATION_PRIORITY.HIGH
  }
  if (type.startsWith('engagement_') || type.startsWith('social_')) {
    return NOTIFICATION_PRIORITY.NORMAL
  }
  return NOTIFICATION_PRIORITY.NORMAL
}

// Processed notification IDs for deduplication
const processedNotificationIds = new Set()

// Load processed notification IDs from localStorage
const loadProcessedNotificationIds = () => {
  try {
    const stored = localStorage.getItem(PROCESSED_NOTIFICATION_IDS_KEY)
    if (stored) {
      const ids = JSON.parse(stored)
      ids.forEach(id => processedNotificationIds.add(id))
    }
  } catch (error) {
    console.warn('Failed to load processed notification IDs:', error)
  }
}

// Save processed notification IDs to localStorage
const saveProcessedNotificationIds = () => {
  try {
    const idsArray = Array.from(processedNotificationIds).slice(-1000)
    localStorage.setItem(PROCESSED_NOTIFICATION_IDS_KEY, JSON.stringify(idsArray))
  } catch (error) {
    console.warn('Failed to save processed notification IDs:', error)
  }
}

// Load settings from localStorage
const loadNotificationSettings = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      notificationSettings.value = { ...notificationSettings.value, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load notification settings:', error)
  }
}

// Load notifications from localStorage
const loadNotifications = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      notifications.value = Array.isArray(parsed) ? parsed : []
      console.log('Loaded notifications from storage:', notifications.value.length, 'notifications')
    }
  } catch (error) {
    console.error('Failed to load notifications:', error)
    notifications.value = []
  }
}

// Save notifications to localStorage
const saveNotifications = () => {
  try {
    // Only keep the last 100 notifications to avoid storage bloat
    const notificationsToSave = notifications.value.slice(0, 100)
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notificationsToSave))
  } catch (error) {
    console.error('Failed to save notifications:', error)
  }
}

// Save settings to localStorage
const saveNotificationSettings = () => {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(notificationSettings.value))
  } catch (error) {
    console.error('Failed to save notification settings:', error)
  }
}

// Watch for settings changes and save
watch(notificationSettings, saveNotificationSettings, { deep: true })

// Watch for notification changes and save
watch(notifications, saveNotifications, { deep: true })

// Create notification object with enhanced metadata
const createNotification = (type, title, message, data = {}) => {
  const notification = {
    id: generateNotificationId(),
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    played: false,
    category: getCategoryFromType(type),
    priority: getPriorityFromType(type, data),
    contentType: data.contentType || null,
    contentId: data.contentId || null,
    actionUrl: data.actionUrl || null,
    metadata: data.metadata || {},
    data: { ...data }
  }

  delete notification.data.contentType
  delete notification.data.contentId
  delete notification.data.actionUrl
  delete notification.data.metadata

  return notification
}

// Check if notification should be deduplicated
const shouldDeduplicateNotification = (type, data) => {
  const contentHash = generateContentHash(type, {
    amount: data.amount,
    sender: data.sender?.pubkey || data.sender?.name,
    paymentHash: data.paymentHash,
    contentId: data.contentId
  })

  const notificationId = `${type}_${contentHash}`

  if (processedNotificationIds.has(notificationId)) {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
    const recentNotification = notifications.value.find(n => {
      const notificationTime = new Date(n.timestamp).getTime()
      return n.type === type && notificationTime > fiveMinutesAgo
    })

    if (recentNotification) {
      return true
    }

    processedNotificationIds.delete(notificationId)
  }

  processedNotificationIds.add(notificationId)
  saveProcessedNotificationIds()

  return false
}

// Add notification to the list with deduplication
const addNotification = (notification, isNewNotification = true) => {
  if (!notificationSettings.value.enabled) return

  if (shouldDeduplicateNotification(notification.type, notification.data)) {
    console.log('Notification deduplicated:', notification.type)
    return
  }

  notifications.value.unshift(notification)

  // Limit to 100 notifications
  if (notifications.value.length > 100) {
    notifications.value = notifications.value.slice(0, 100)
  }

  // Only show desktop notification and play sound for truly new notifications
  if (isNewNotification && !notification.played) {
    // Show desktop notification if enabled
    if (notificationSettings.value.desktop && 'Notification' in window) {
      showDesktopNotification(notification)
    }

    // Play sound if enabled
    if (notificationSettings.value.sound) {
      playNotificationSound()
    }

    // Mark as played to prevent replay
    notification.played = true
  }

  console.log('Notification added:', notification)
}

// Show desktop notification
const showDesktopNotification = (notification) => {
  if (Notification.permission === 'granted') {
    const desktopNotification = new Notification(notification.title, {
      body: notification.message,
      icon: '/vite.svg', // You can replace with your app icon
      tag: notification.type,
      requireInteraction: false
    })

    // Auto close after 5 seconds
    setTimeout(() => {
      desktopNotification.close()
    }, 5000)
  }
}

// Play notification sound
const playNotificationSound = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (error) {
    console.warn('Failed to play notification sound:', error)
  }
}

// Request desktop notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return Notification.permission === 'granted'
}

// Mark notification as read
const markAsRead = (notificationId) => {
  const notification = notifications.value.find(n => n.id === notificationId)
  if (notification) {
    notification.read = true
  }
}

// Mark all notifications as read
const markAllAsRead = () => {
  notifications.value.forEach(notification => {
    notification.read = true
  })
}

// Clear all notifications
const clearAllNotifications = () => {
  notifications.value = []
  saveNotifications() // Ensure empty state is saved
}

// Remove specific notification
const removeNotification = (notificationId) => {
  const index = notifications.value.findIndex(n => n.id === notificationId)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

// Computed properties
const unreadCount = computed(() => {
  return notifications.value.filter(n => !n.read).length
})

const recentNotifications = computed(() => {
  return notifications.value.slice(0, 10)
})

// Category-based notification filtering
const notificationsByCategory = computed(() => {
  return {
    all: notifications.value,
    zaps: notifications.value.filter(n => n.category === NOTIFICATION_CATEGORIES.ZAPS),
    engagements: notifications.value.filter(n => n.category === NOTIFICATION_CATEGORIES.ENGAGEMENTS),
    social: notifications.value.filter(n => n.category === NOTIFICATION_CATEGORIES.SOCIAL),
    wallet: notifications.value.filter(n => n.category === NOTIFICATION_CATEGORIES.WALLET),
    system: notifications.value.filter(n => n.category === NOTIFICATION_CATEGORIES.SYSTEM)
  }
})

// Unread count by category
const unreadCountByCategory = computed(() => {
  return {
    all: unreadCount.value,
    zaps: notifications.value.filter(n => !n.read && n.category === NOTIFICATION_CATEGORIES.ZAPS).length,
    engagements: notifications.value.filter(n => !n.read && n.category === NOTIFICATION_CATEGORIES.ENGAGEMENTS).length,
    social: notifications.value.filter(n => !n.read && n.category === NOTIFICATION_CATEGORIES.SOCIAL).length,
    wallet: notifications.value.filter(n => !n.read && n.category === NOTIFICATION_CATEGORIES.WALLET).length,
    system: notifications.value.filter(n => !n.read && n.category === NOTIFICATION_CATEGORIES.SYSTEM).length
  }
})

// Check if notification should be shown based on settings
const shouldShowNotification = (type, data = {}) => {
  if (!notificationSettings.value.enabled) return false

  if (type === NOTIFICATION_TYPES.ZAP_RECEIVED) {
    if (!notificationSettings.value.zapReceived) return false
    if (data.amount < notificationSettings.value.minZapAmount) return false

    if (data.contentType) {
      if (data.contentType === CONTENT_TYPES.CAMPAIGN && !notificationSettings.value.zapsByCampaign) return false
      if (data.contentType === CONTENT_TYPES.ARTICLE && !notificationSettings.value.zapsByArticle) return false
      if (data.contentType === CONTENT_TYPES.NOTE && !notificationSettings.value.zapsByNote) return false
      if (data.contentType === CONTENT_TYPES.EVENT && !notificationSettings.value.zapsByEvent) return false
    }
  }

  if (type === NOTIFICATION_TYPES.ZAP_SENT && !notificationSettings.value.zapSent) return false

  if (type === NOTIFICATION_TYPES.BALANCE_CHANGE) {
    if (!notificationSettings.value.balanceChange) return false
    if (Math.abs(data.difference) < notificationSettings.value.balanceChangeThreshold) return false
  }

  if (type.startsWith('engagement_') && !notificationSettings.value.engagements) return false
  if (type === NOTIFICATION_TYPES.ENGAGEMENT_REPLY && !notificationSettings.value.engagementReplies) return false
  if (type === NOTIFICATION_TYPES.ENGAGEMENT_REPOST && !notificationSettings.value.engagementReposts) return false
  if (type === NOTIFICATION_TYPES.ENGAGEMENT_REACTION && !notificationSettings.value.engagementReactions) return false
  if (type === NOTIFICATION_TYPES.ENGAGEMENT_MENTION && !notificationSettings.value.engagementMentions) return false

  if (type.startsWith('social_') && !notificationSettings.value.social) return false
  if (type === NOTIFICATION_TYPES.SOCIAL_NEW_FOLLOWER && !notificationSettings.value.socialNewFollowers) return false
  if (type === NOTIFICATION_TYPES.SOCIAL_PROFILE_MENTION && !notificationSettings.value.socialProfileMentions) return false
  if (type === NOTIFICATION_TYPES.SOCIAL_TAG_MENTION && !notificationSettings.value.socialTagMentions) return false

  if (type.startsWith('content_') && !notificationSettings.value.contentNotifications) return false
  if (type.startsWith('system_') && !notificationSettings.value.systemNotifications) return false

  if (!notificationSettings.value.connectionStatus) {
    if ([NOTIFICATION_TYPES.CONNECTION_SUCCESS, NOTIFICATION_TYPES.CONNECTION_ERROR].includes(type)) {
      return false
    }
  }

  if (notificationSettings.value.quietHoursEnabled && isInQuietHours()) {
    if ([NOTIFICATION_TYPES.SYSTEM_ERROR, NOTIFICATION_TYPES.WALLET_ERROR].includes(type)) {
      return true
    }
    return false
  }

  return true
}

// Check if current time is in quiet hours
const isInQuietHours = () => {
  const now = new Date()
  const currentTime = now.getHours() * 60 + now.getMinutes()

  const [startHour, startMin] = notificationSettings.value.quietHoursStart.split(':').map(Number)
  const [endHour, endMin] = notificationSettings.value.quietHoursEnd.split(':').map(Number)

  const startTime = startHour * 60 + startMin
  const endTime = endHour * 60 + endMin

  if (startTime < endTime) {
    return currentTime >= startTime && currentTime < endTime
  } else {
    return currentTime >= startTime || currentTime < endTime
  }
}

// Notification handlers for different events
const handleZapReceived = (zapData) => {
  if (!shouldShowNotification(NOTIFICATION_TYPES.ZAP_RECEIVED, zapData)) return

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_RECEIVED,
    '⚡ Zap Received!',
    `You received ${zapData.amount} sats from ${zapData.sender?.name || 'Anonymous'}`,
    { amount: zapData.amount, sender: zapData.sender, contentType: zapData.contentType, contentId: zapData.contentId }
  )

  addNotification(notification)
}

const handleZapSent = (paymentData) => {
  if (!shouldShowNotification(NOTIFICATION_TYPES.ZAP_SENT, paymentData)) return

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_SENT,
    '⚡ Zap Sent!',
    `You sent ${Math.floor(paymentData.amount / 1000)} sats`,
    { amount: Math.floor(paymentData.amount / 1000) }
  )

  addNotification(notification)
}

const handleBalanceChange = (oldBalance, newBalance) => {
  if (oldBalance === newBalance) return

  const difference = newBalance - oldBalance
  if (!shouldShowNotification(NOTIFICATION_TYPES.BALANCE_CHANGE, { difference })) return

  const notification = createNotification(
    NOTIFICATION_TYPES.BALANCE_CHANGE,
    '💰 Balance Updated',
    `Balance ${difference > 0 ? 'increased' : 'decreased'} by ${Math.abs(difference)} sats`,
    { oldBalance, newBalance, difference }
  )

  addNotification(notification)
}

const handleConnectionSuccess = (connectionName) => {
  if (!notificationSettings.value.connectionStatus) return

  const notification = createNotification(
    NOTIFICATION_TYPES.CONNECTION_SUCCESS,
    '🔗 Wallet Connected',
    `Successfully connected to ${connectionName}`,
    { connectionName }
  )
  
  addNotification(notification)
}

const handleConnectionError = (error) => {
  if (!notificationSettings.value.connectionStatus) return

  const notification = createNotification(
    NOTIFICATION_TYPES.CONNECTION_ERROR,
    '❌ Connection Failed',
    `Failed to connect to wallet: ${error.message}`,
    { error: error.message }
  )
  
  addNotification(notification)
}

const handlePaymentSuccess = (paymentData) => {
  const notification = createNotification(
    NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    '✅ Payment Successful',
    `Payment completed successfully`,
    paymentData
  )
  
  addNotification(notification)
}

const handlePaymentError = (error) => {
  const notification = createNotification(
    NOTIFICATION_TYPES.PAYMENT_ERROR,
    '❌ Payment Failed',
    `Payment failed: ${error.message}`,
    { error: error.message }
  )
  
  addNotification(notification)
}

// Transaction monitoring
let transactionPolling = null
let lastTransactionTimestamp = null
let lastBalance = null
let processedTransactions = new Set()

const startTransactionMonitoring = async () => {
  if (transactionPolling) return

  // Load last known state
  try {
    const storedTimestamp = localStorage.getItem(LAST_TRANSACTION_KEY)
    const storedBalance = localStorage.getItem(LAST_BALANCE_KEY)
    const storedProcessedTransactions = localStorage.getItem(PROCESSED_TRANSACTIONS_KEY)
    
    if (storedTimestamp) {
      lastTransactionTimestamp = parseInt(storedTimestamp)
    }
    
    if (storedBalance) {
      lastBalance = parseInt(storedBalance)
    }
    
    if (storedProcessedTransactions) {
      processedTransactions = new Set(JSON.parse(storedProcessedTransactions))
    }
  } catch (error) {
    console.warn('Failed to load last transaction state:', error)
  }

  // Flag to prevent initial balance notification
  let isInitialBalanceCheck = true

  transactionPolling = setInterval(async () => {
    try {
      // Check for new transactions
      const transactions = await fetchTransactions()
      if (transactions && transactions.length > 0) {
        let hasNewTransactions = false
        
        // Process each transaction to check if it's new
        for (const transaction of transactions) {
          const paymentHash = transaction.payment_hash
          const timestamp = transaction.settled_at || transaction.created_at
          
          // Skip if we've already processed this transaction
          if (processedTransactions.has(paymentHash)) {
            continue
          }
          
          // Skip if transaction is not settled
          if (transaction.state !== 'settled') {
            continue
          }
          
          // Mark as processed to avoid duplicates
          processedTransactions.add(paymentHash)
          hasNewTransactions = true
          
          // Create notification for incoming transactions
          if (transaction.type === 'incoming') {
            handleZapReceived({
              amount: Math.floor(transaction.amount / 1000),
              sender: { name: 'Anonymous' }, // NWC doesn't provide sender info
              timestamp: new Date(timestamp * 1000).toISOString(),
              paymentHash: paymentHash
            })
          }
          
          // Update last transaction timestamp
          if (!lastTransactionTimestamp || timestamp > lastTransactionTimestamp) {
            lastTransactionTimestamp = timestamp
          }
        }
        
        // Save state if we processed new transactions
        if (hasNewTransactions) {
          localStorage.setItem(LAST_TRANSACTION_KEY, lastTransactionTimestamp.toString())
          
          // Keep only recent transaction hashes (last 1000 to avoid storage bloat)
          const recentTransactions = Array.from(processedTransactions).slice(-1000)
          processedTransactions = new Set(recentTransactions)
          localStorage.setItem(PROCESSED_TRANSACTIONS_KEY, JSON.stringify(Array.from(processedTransactions)))
        }
      }

      // Check for balance changes
      const balanceData = await getBalance()
      if (balanceData && balanceData.balance !== undefined) {
        const currentBalance = Math.floor(balanceData.balance / 1000) // Convert to sats
        
        if (lastBalance !== null && currentBalance !== lastBalance && !isInitialBalanceCheck) {
          handleBalanceChange(lastBalance, currentBalance)
        }
        
        // Update lastBalance and save to localStorage
        lastBalance = currentBalance
        localStorage.setItem(LAST_BALANCE_KEY, lastBalance.toString())
        
        // After first balance check, allow balance change notifications
        isInitialBalanceCheck = false
      }
    } catch (error) {
      console.warn('Transaction monitoring error:', error)
    }
  }, 10000) // Check every 10 seconds
}

const stopTransactionMonitoring = () => {
  if (transactionPolling) {
    clearInterval(transactionPolling)
    transactionPolling = null
  }
  
  // Clear processed transactions when stopping monitoring
  processedTransactions.clear()
}

// Initialize notification system
const initializeNotifications = async () => {
  loadNotificationSettings()
  loadNotifications()
  loadProcessedNotificationIds()

  // Request desktop notification permission if enabled
  if (notificationSettings.value.desktop) {
    await requestNotificationPermission()
  }
}

export function useNotifications() {
  const { isWalletConnected, activeConnection } = useNostrConnections()

  // Watch for wallet connection changes
  watch(isWalletConnected, (connected) => {
    if (connected) {
      startTransactionMonitoring()
    } else {
      stopTransactionMonitoring()
    }
  }, { immediate: true })

  // Initialize on mount
  onMounted(() => {
    initializeNotifications()
  })

  // Cleanup on unmount
  onUnmounted(() => {
    stopTransactionMonitoring()
  })

  return {
    // State
    notifications,
    notificationSettings,
    unreadCount,
    recentNotifications,
    notificationsByCategory,
    unreadCountByCategory,

    // Actions
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    removeNotification,
    requestNotificationPermission,

    // Event handlers
    handleZapReceived,
    handleZapSent,
    handleBalanceChange,
    handleConnectionSuccess,
    handleConnectionError,
    handlePaymentSuccess,
    handlePaymentError,

    // Monitoring
    startTransactionMonitoring,
    stopTransactionMonitoring,

    // Constants
    NOTIFICATION_TYPES,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_PRIORITY,
    CONTENT_TYPES
  }
}
