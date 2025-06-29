import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useNostrConnections } from './useNostrConnections.js'
import { fetchTransactions, getBalance } from '../utils/nwcClient.js'

// Global notification state
const notifications = ref([])
const notificationSettings = ref({
  enabled: true,
  sound: true,
  desktop: true,
  zapReceived: true,
  zapSent: true,
  balanceChange: true,
  connectionStatus: true
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
  PAYMENT_ERROR: 'payment_error'
}

// Storage keys
const NOTIFICATION_SETTINGS_KEY = 'notification_settings'
const LAST_TRANSACTION_KEY = 'last_transaction_timestamp'
const LAST_BALANCE_KEY = 'last_balance'

// Generate unique notification ID
const generateNotificationId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

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

// Create notification object
const createNotification = (type, title, message, data = {}) => {
  return {
    id: generateNotificationId(),
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    data,
    ...data
  }
}

// Add notification to the list
const addNotification = (notification) => {
  if (!notificationSettings.value.enabled) return

  notifications.value.unshift(notification)
  
  // Limit to 50 notifications
  if (notifications.value.length > 50) {
    notifications.value = notifications.value.slice(0, 50)
  }

  // Show desktop notification if enabled
  if (notificationSettings.value.desktop && 'Notification' in window) {
    showDesktopNotification(notification)
  }

  // Play sound if enabled
  if (notificationSettings.value.sound) {
    playNotificationSound()
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

// Notification handlers for different events
const handleZapReceived = (zapData) => {
  if (!notificationSettings.value.zapReceived) return

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_RECEIVED,
    '⚡ Zap Received!',
    `You received ${zapData.amount} sats from ${zapData.sender?.name || 'Anonymous'}`,
    { amount: zapData.amount, sender: zapData.sender }
  )
  
  addNotification(notification)
}

const handleZapSent = (paymentData) => {
  if (!notificationSettings.value.zapSent) return

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_SENT,
    '⚡ Zap Sent!',
    `You sent ${Math.floor(paymentData.amount / 1000)} sats`,
    { amount: Math.floor(paymentData.amount / 1000) }
  )
  
  addNotification(notification)
}

const handleBalanceChange = (oldBalance, newBalance) => {
  if (!notificationSettings.value.balanceChange) return
  if (oldBalance === newBalance) return

  const difference = newBalance - oldBalance
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

const startTransactionMonitoring = async () => {
  if (transactionPolling) return

  // Load last known state
  try {
    const storedTimestamp = localStorage.getItem(LAST_TRANSACTION_KEY)
    const storedBalance = localStorage.getItem(LAST_BALANCE_KEY)
    
    if (storedTimestamp) {
      lastTransactionTimestamp = parseInt(storedTimestamp)
    }
    
    if (storedBalance) {
      lastBalance = parseInt(storedBalance)
    }
  } catch (error) {
    console.warn('Failed to load last transaction state:', error)
  }

  transactionPolling = setInterval(async () => {
    try {
      // Check for new transactions
      const transactions = await fetchTransactions()
      if (transactions && transactions.length > 0) {
        const latestTransaction = transactions[0]
        const latestTimestamp = latestTransaction.settled_at || latestTransaction.created_at
        
        if (lastTransactionTimestamp && latestTimestamp > lastTransactionTimestamp) {
          // New transaction detected
          if (latestTransaction.type === 'incoming') {
            handleZapReceived({
              amount: Math.floor(latestTransaction.amount / 1000),
              sender: { name: 'Anonymous' }, // NWC doesn't provide sender info
              timestamp: new Date(latestTimestamp * 1000).toISOString()
            })
          }
        }
        
        lastTransactionTimestamp = latestTimestamp
        localStorage.setItem(LAST_TRANSACTION_KEY, lastTransactionTimestamp.toString())
      }

      // Check for balance changes
      const balanceData = await getBalance()
      if (balanceData && balanceData.balance !== undefined) {
        const currentBalance = Math.floor(balanceData.balance / 1000) // Convert to sats
        
        if (lastBalance !== null && currentBalance !== lastBalance) {
          handleBalanceChange(lastBalance, currentBalance)
        }
        
        lastBalance = currentBalance
        localStorage.setItem(LAST_BALANCE_KEY, lastBalance.toString())
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
}

// Initialize notification system
const initializeNotifications = async () => {
  loadNotificationSettings()
  
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
    NOTIFICATION_TYPES
  }
}