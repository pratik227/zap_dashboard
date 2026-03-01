import { ref, computed, watch } from 'vue'
import { useNostrConnections } from './useNostrConnections.js'
import { fetchTransactions, getBalance } from '../../utils/wallet/nwcClient.js'

// Global notification state
const notifications = ref([])
const notificationSettings = ref({
  enabled: true,
  sound: false,
  desktop: true,
  zapReceived: true,
  zapSent: true,
  nwcTransactions: true,
  nostrZaps: true,
  balanceChange: false,
  connectionStatus: false,
  calendarInvites: true,
  calendarEventStarts: true
})

// Notification types
const NOTIFICATION_TYPES = {
  ZAP_RECEIVED_NWC: 'zap_received_nwc',
  ZAP_RECEIVED_NOSTR: 'zap_received_nostr',
  ZAP_SENT: 'zap_sent',
  BALANCE_CHANGE: 'balance_change',
  CONNECTION_SUCCESS: 'connection_success',
  CONNECTION_ERROR: 'connection_error',
  WALLET_ERROR: 'wallet_error',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_ERROR: 'payment_error',
  CALENDAR_INVITE: 'calendar_invite',
  CALENDAR_EVENT_START: 'calendar_event_start'
}

// Storage keys
const NOTIFICATION_SETTINGS_KEY = 'notification_settings'
const LAST_TRANSACTION_KEY = 'last_transaction_timestamp'
const LAST_BALANCE_KEY = 'last_balance'
const PROCESSED_TRANSACTIONS_KEY = 'processed_transactions'
const NOTIFICATIONS_KEY = 'notifications_list'
const NOTIFIED_EVENTS_KEY = 'notified_calendar_events'

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

// Load notifications from localStorage
const loadNotifications = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      notifications.value = Array.isArray(parsed) ? parsed : []
    }
  } catch (error) {
    console.error('Failed to load notifications:', error)
    notifications.value = []
  }
}

// Save notifications to localStorage
const saveNotifications = () => {
  try {
    // Always keep calendar notifications, limit others
    const calendarNotifs = notifications.value.filter(n =>
      n.type === NOTIFICATION_TYPES.CALENDAR_INVITE ||
      n.type === NOTIFICATION_TYPES.CALENDAR_EVENT_START
    )
    const otherNotifs = notifications.value.filter(n =>
      n.type !== NOTIFICATION_TYPES.CALENDAR_INVITE &&
      n.type !== NOTIFICATION_TYPES.CALENDAR_EVENT_START
    )

    // Keep all calendar notifications + up to 200 other notifications
    const notificationsToSave = [...calendarNotifs, ...otherNotifs.slice(0, 200)]
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

// Watch specific settings properties (avoid deep watch)
watch(
  () => JSON.stringify(notificationSettings.value),
  saveNotificationSettings
)

// Debounced watch for notification changes (2s delay)
let saveTimeout = null
const debouncedSave = () => {
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(saveNotifications, 2000)
}
watch(() => notifications.value.length, debouncedSave)

// Create notification object
const createNotification = (type, title, message, data = {}) => {
  return {
    id: generateNotificationId(),
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    played: false,
    data,
    ...data
  }
}

// Add notification to the list
const addNotification = (notification, isNewNotification = true) => {
  if (!notificationSettings.value.enabled) return

  notifications.value.unshift(notification)

  // Limit notifications, but always keep calendar events
  if (notifications.value.length > 250) {
    const calendarNotifs = notifications.value.filter(n =>
      n.type === NOTIFICATION_TYPES.CALENDAR_INVITE ||
      n.type === NOTIFICATION_TYPES.CALENDAR_EVENT_START
    )
    const otherNotifs = notifications.value.filter(n =>
      n.type !== NOTIFICATION_TYPES.CALENDAR_INVITE &&
      n.type !== NOTIFICATION_TYPES.CALENDAR_EVENT_START
    )

    // Keep all calendar notifications + most recent 200 others
    notifications.value = [...calendarNotifs, ...otherNotifs.slice(0, 200)]
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
}

// Show desktop notification
const showDesktopNotification = (notification) => {
  if (Notification.permission === 'granted') {
    const desktopNotification = new Notification(notification.title, {
      body: notification.message,
      icon: '/new_logo3.png',
      tag: notification.type,
      requireInteraction: false
    })

    setTimeout(() => {
      desktopNotification.close()
    }, 5000)
  }
}

// Play notification sound
const playNotificationSound = () => {
  try {
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
  saveNotifications()
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

// Handle incoming NWC transactions
const handleZapReceivedNWC = (transaction) => {
  if (!notificationSettings.value.zapReceived || !notificationSettings.value.nwcTransactions) return

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_RECEIVED_NWC,
    '⚡ Payment Received',
    `You received ${transaction.amount} sats`,
    {
      amount: transaction.amount,
      source: 'nwc',
      paymentHash: transaction.paymentHash,
      timestamp: transaction.timestamp
    }
  )

  addNotification(notification)
}

// Handle incoming Nostr zap receipts
const handleZapReceivedNostr = (zapData) => {
  if (!notificationSettings.value.zapReceived || !notificationSettings.value.nostrZaps) return

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR,
    '⚡ Zap Received!',
    `${zapData.sender?.name || 'Anonymous'} zapped ${zapData.amount} sats`,
    {
      amount: zapData.amount,
      sender: zapData.sender,
      source: 'nostr',
      eventId: zapData.eventId,
      message: zapData.message,
      paymentHash: zapData.id,
      timestamp: zapData.timestamp
    }
  )

  addNotification(notification)
}

// Legacy handler for backward compatibility
const handleZapReceived = (zapData) => {
  // Determine if this is NWC or Nostr based on data structure
  if (zapData.source === 'nwc' || zapData.type === 'incoming') {
    handleZapReceivedNWC(zapData)
  } else if (zapData.source === 'nostr' || zapData.eventId) {
    handleZapReceivedNostr(zapData)
  } else {
    // Default to NWC for backward compatibility
    handleZapReceivedNWC(zapData)
  }
}

// Handle outgoing payments
const handleZapSent = (paymentData) => {
  if (!notificationSettings.value.zapSent) return

  const amount = paymentData.amount
    ? (typeof paymentData.amount === 'number' && paymentData.amount > 1000
        ? Math.floor(paymentData.amount / 1000)
        : paymentData.amount)
    : 0

  const notification = createNotification(
    NOTIFICATION_TYPES.ZAP_SENT,
    '⚡ Payment Sent',
    `You sent ${amount} sats`,
    { amount, source: paymentData.source || 'nwc' }
  )

  addNotification(notification)
}

// Handle balance changes
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

// Handle connection success
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

// Handle connection errors
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

// Handle payment success
const handlePaymentSuccess = (paymentData) => {
  const notification = createNotification(
    NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    '✅ Payment Successful',
    `Payment completed successfully`,
    paymentData
  )

  addNotification(notification)
}

// Handle payment errors
const handlePaymentError = (error) => {
  const notification = createNotification(
    NOTIFICATION_TYPES.PAYMENT_ERROR,
    '❌ Payment Failed',
    `Payment failed: ${error.message}`,
    { error: error.message }
  )

  addNotification(notification)
}

// Handle calendar event invitation
const handleCalendarInvite = (eventData) => {
  if (!notificationSettings.value.calendarInvites) return

  const notification = createNotification(
    NOTIFICATION_TYPES.CALENDAR_INVITE,
    '📅 Event Invitation',
    `You've been invited to "${eventData.title}"`,
    {
      eventId: eventData.id,
      eventTitle: eventData.title,
      eventStart: eventData.start || eventData.start_date,
      eventType: eventData.type,
      organizer: eventData.organizer,
      organizerProfile: eventData.organizerProfile || null
    }
  )

  addNotification(notification)
}

// Handle calendar event starting soon
const handleCalendarEventStart = (eventData) => {
  if (!notificationSettings.value.calendarEventStarts) return

  const notification = createNotification(
    NOTIFICATION_TYPES.CALENDAR_EVENT_START,
    '📅 Event Starting',
    `"${eventData.title}" is starting now`,
    {
      eventId: eventData.id,
      eventTitle: eventData.title,
      eventStart: eventData.start || eventData.start_date,
      eventType: eventData.type
    }
  )

  addNotification(notification)
}

// NWC Transaction monitoring
let transactionPolling = null
let lastTransactionTimestamp = null
let lastBalance = null
let processedTransactions = new Set()

const startTransactionMonitoring = async () => {
  if (transactionPolling) {
    return
  }

  // Load last known state from localStorage
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

        // Process each transaction
        for (const transaction of transactions) {
          const paymentHash = transaction.payment_hash
          const timestamp = transaction.settled_at || transaction.created_at

          // Skip if already processed
          if (processedTransactions.has(paymentHash)) {
            continue
          }

          // Skip if not settled
          if (transaction.state !== 'settled') {
            continue
          }

          // Mark as processed
          processedTransactions.add(paymentHash)
          hasNewTransactions = true

          // Create notification for incoming transactions only
          if (transaction.type === 'incoming') {
            handleZapReceivedNWC({
              amount: Math.floor(transaction.amount / 1000),
              timestamp: new Date(timestamp * 1000).toISOString(),
              paymentHash: paymentHash,
              type: 'incoming',
              source: 'nwc'
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

          // Keep only recent transaction hashes (last 1000)
          const recentTransactions = Array.from(processedTransactions).slice(-1000)
          processedTransactions = new Set(recentTransactions)
          localStorage.setItem(PROCESSED_TRANSACTIONS_KEY, JSON.stringify(Array.from(processedTransactions)))
        }
      }

      // Check for balance changes
      const balanceData = await getBalance()
      if (balanceData && balanceData.balance !== undefined) {
        const currentBalance = Math.floor(balanceData.balance / 1000)

        if (lastBalance !== null && currentBalance !== lastBalance && !isInitialBalanceCheck) {
          handleBalanceChange(lastBalance, currentBalance)
        }

        lastBalance = currentBalance
        localStorage.setItem(LAST_BALANCE_KEY, lastBalance.toString())
        isInitialBalanceCheck = false
      }
    } catch (error) {
      console.warn('Transaction monitoring error:', error.message)
    }
  }, 10000) // Check every 10 seconds
}

const stopTransactionMonitoring = () => {
  if (transactionPolling) {
    clearInterval(transactionPolling)
    transactionPolling = null
  }

  processedTransactions.clear()
}

// Calendar Event Monitoring
let eventMonitoring = null
let notifiedEvents = new Set()

const loadNotifiedEvents = () => {
  try {
    const stored = localStorage.getItem(NOTIFIED_EVENTS_KEY)
    if (stored) {
      notifiedEvents = new Set(JSON.parse(stored))
    }
  } catch (error) {
    console.warn('Failed to load notified events:', error)
  }
}

const saveNotifiedEvents = () => {
  try {
    const recentEvents = Array.from(notifiedEvents).slice(-500)
    notifiedEvents = new Set(recentEvents)
    localStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify(Array.from(notifiedEvents)))
  } catch (error) {
    console.warn('Failed to save notified events:', error)
  }
}

const startEventMonitoring = (getEventsCallback) => {
  if (eventMonitoring) {
    return
  }

  loadNotifiedEvents()

  eventMonitoring = setInterval(() => {
    try {
      const events = getEventsCallback()
      if (!events || events.length === 0) return

      const now = Date.now()
      const fiveMinutes = 5 * 60 * 1000

      events.forEach(event => {
        const eventKey = `${event.id}_start`

        if (notifiedEvents.has(eventKey)) return

        let eventStartTime
        if (event.type === 'time-based' && event.start) {
          eventStartTime = event.start * 1000
        } else if (event.type === 'date-based' && event.start_date) {
          eventStartTime = new Date(event.start_date).getTime()
        } else {
          return
        }

        const timeUntilEvent = eventStartTime - now

        if (timeUntilEvent <= fiveMinutes && timeUntilEvent > -60000) {
          handleCalendarEventStart(event)
          notifiedEvents.add(eventKey)
          saveNotifiedEvents()
        }
      })
    } catch (error) {
      console.warn('Event monitoring error:', error.message)
    }
  }, 30000)
}

const stopEventMonitoring = () => {
  if (eventMonitoring) {
    clearInterval(eventMonitoring)
    eventMonitoring = null
  }
}

// Initialize notification system
const initializeNotifications = async () => {
  loadNotificationSettings()
  loadNotifications()

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

  // Initialize immediately (module-scoped singleton — no lifecycle hooks)
  initializeNotifications()

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
    handleZapReceivedNWC,
    handleZapReceivedNostr,
    handleZapSent,
    handleBalanceChange,
    handleConnectionSuccess,
    handleConnectionError,
    handlePaymentSuccess,
    handlePaymentError,
    handleCalendarInvite,
    handleCalendarEventStart,

    // Monitoring
    startTransactionMonitoring,
    stopTransactionMonitoring,
    startEventMonitoring,
    stopEventMonitoring,

    // Constants
    NOTIFICATION_TYPES
  }
}
