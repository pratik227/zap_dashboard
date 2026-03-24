<script setup>
import { ref, computed, onMounted, onUnmounted, inject, defineAsyncComponent, watch } from 'vue'
import { formatMsatsToSats } from '../utils/format.js'
import {
  IconWallet,
  IconBolt, 
  IconPlus, 
  IconSend, 
  IconCopy, 
  IconCheck, 
  IconX, 
  IconRefresh,
  IconEye,
  IconEyeOff,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconClock,
  IconAlertCircle,
  IconQrcode,
  IconScan,
  IconCamera,
  IconCameraOff,
  IconShare
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useNostrConnections } from '../composables/core/useNostrConnections.js'
import { useNotifications } from '../composables/core/useNotifications.js'
import {
  getBalance,
  getWalletInfo,
  fetchTransactions,
  makeInvoice,
  payInvoice,
  payLightningAddress,
  lookupInvoice,
  getUserFriendlyError,
  isLightningAddress,
  stripLightningPrefix
} from '../utils/wallet/nwcClient.js'
import { QrcodeStream } from 'vue-qrcode-reader'
const { isWalletConnected, activeConnection } = useNostrConnections()
const { handleZapSent, handlePaymentSuccess, handlePaymentError, notifications } = useNotifications()

// Inject the changePage function from App.vue
const changePage = inject('changePage')

// State management
const balance = ref(0)
const walletInfo = ref(null)
const transactions = ref([])
const isLoading = ref(false)
const showBalance = ref(true)
const error = ref('')

// Modal states
const showCreateInvoice = ref(false)
const showSendPayment = ref(false)
const showQrScanner = ref(false)

// Invoice creation
const invoiceForm = ref({
  amount: '',
  description: ''
})
const createdInvoice = ref(null)
const invoiceStatus = ref('pending') // pending, paid, expired
const invoicePolling = ref(null)
const copySuccess = ref(false)

// Payment sending
const paymentForm = ref({
  invoice: '',
  amount: ''
})
const paymentStatus = ref('') // success, error, pending
const paymentResult = ref(null)
const isResolvingAddress = ref(false)

// QR Scanner state
const qrScannerError = ref('')
const cameraPermission = ref('prompt') // prompt, granted, denied

// Computed properties
const balanceInSats = computed(() => {
  return Math.floor(balance.value / 1000) // Convert msats to sats
})

const formattedBalance = computed(() => {
  if (!showBalance.value) return '****'
  return balanceInSats.value.toLocaleString()
})

const sortedTransactions = computed(() => {
  return [...transactions.value].sort((a, b) => {
    const timeA = a.settled_at || a.created_at || 0
    const timeB = b.settled_at || b.created_at || 0
    return timeB - timeA
  })
})

const isInvoiceFormValid = computed(() => {
  return invoiceForm.value.amount && 
         parseInt(invoiceForm.value.amount) > 0 && 
         invoiceForm.value.description.trim()
})

// Detect input type: 'invoice', 'lightning-address', or 'unknown'
const paymentInputType = computed(() => {
  const raw = paymentForm.value.invoice.trim()
  if (!raw) return 'empty'
  const cleaned = stripLightningPrefix(raw)
  if (cleaned.toLowerCase().startsWith('lnbc') || cleaned.toLowerCase().startsWith('lntb')) {
    return 'invoice'
  }
  if (isLightningAddress(cleaned)) {
    return 'lightning-address'
  }
  return 'unknown'
})

const isPaymentFormValid = computed(() => {
  if (paymentInputType.value === 'invoice') return true
  if (paymentInputType.value === 'lightning-address') {
    return parseInt(paymentForm.value.amount) > 0
  }
  return paymentForm.value.invoice.trim().length > 0
})

// Lifecycle methods
onMounted(() => {
  if (isWalletConnected.value) {
    loadWalletData()
  }
  checkCameraPermission()
})

// Watch for new payment notifications and refresh wallet data (track length, not deep)
watch(() => notifications.value.length, (newLen, oldLen) => {
  if (!isWalletConnected.value || !newLen || newLen <= (oldLen || 0)) return

  const hasNewPaymentNotification = notifications.value.some(notification =>
    (notification.type === 'zap_received' || notification.type === 'payment_success') &&
    !notification.read
  )

  if (hasNewPaymentNotification) {
    setTimeout(() => {
      refreshData()
    }, 1000)
  }
})

onUnmounted(() => {
  if (invoicePolling.value) {
    clearInterval(invoicePolling.value)
  }
})

// Camera permission check
const checkCameraPermission = async () => {
  try {
    const result = await navigator.permissions.query({ name: 'camera' })
    cameraPermission.value = result.state
    
    result.addEventListener('change', () => {
      cameraPermission.value = result.state
    })
  } catch (error) {
    console.warn('Camera permission check not supported:', error)
  }
}

// Data loading methods
const loadWalletData = async () => {
  if (!isWalletConnected.value) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const [balanceResult, infoResult, transactionResult] = await Promise.allSettled([
      getBalance(),
      getWalletInfo(),
      fetchTransactions()
    ])

    if (balanceResult.status === 'fulfilled' && balanceResult.value) {
      balance.value = balanceResult.value.balance || 0
    } else if (balanceResult.status === 'rejected') {
      console.warn('Balance fetch failed:', balanceResult.reason?.message)
    }

    if (infoResult.status === 'fulfilled' && infoResult.value) {
      walletInfo.value = infoResult.value
    } else if (infoResult.status === 'rejected') {
      console.warn('Wallet info fetch failed:', infoResult.reason?.message)
    }

    if (transactionResult.status === 'fulfilled' && transactionResult.value) {
      transactions.value = transactionResult.value
    } else if (transactionResult.status === 'rejected') {
      console.warn('Transaction fetch failed:', transactionResult.reason?.message)
    }

    // Show error only if all requests failed
    const failures = [balanceResult, infoResult, transactionResult].filter(r => r.status === 'rejected')
    if (failures.length === 3) {
      error.value = getUserFriendlyError(failures[0].reason)
    } else if (failures.length > 0) {
      error.value = `Some data unavailable. ${getUserFriendlyError(failures[0].reason)}`
    }
  } catch (err) {
    error.value = getUserFriendlyError(err)
  } finally {
    isLoading.value = false
  }
}

const refreshData = async () => {
  await loadWalletData()
}

// Invoice creation methods
const openCreateInvoice = () => {
  showCreateInvoice.value = true
  invoiceForm.value = { amount: '', description: '' }
  createdInvoice.value = null
  invoiceStatus.value = 'pending'
}

const closeCreateInvoice = () => {
  showCreateInvoice.value = false
  if (invoicePolling.value) {
    clearInterval(invoicePolling.value)
    invoicePolling.value = null
  }
}

const createInvoice = async () => {
  if (!isInvoiceFormValid.value) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const amountMsats = parseInt(invoiceForm.value.amount) * 1000 // Convert sats to msats
    
    const invoice = await makeInvoice({
      amount: amountMsats,
      description: invoiceForm.value.description,
      expiry: 3600 // 1 hour
    })
    
    createdInvoice.value = invoice
    invoiceStatus.value = 'pending'
    
    // Start polling for payment
    startInvoicePolling(invoice.payment_hash)
    
  } catch (err) {
    error.value = getUserFriendlyError(err)
  } finally {
    isLoading.value = false
  }
}

const startInvoicePolling = (paymentHash) => {
  if (invoicePolling.value) {
    clearInterval(invoicePolling.value)
  }
  
  invoicePolling.value = setInterval(async () => {
    try {
      const invoiceData = await lookupInvoice({ payment_hash: paymentHash })
      
      if (invoiceData && invoiceData.settled) {
        invoiceStatus.value = 'paid'
        clearInterval(invoicePolling.value)
        invoicePolling.value = null
        
        // Refresh wallet data to show new balance
        await refreshData()
        
        // Auto-close modal after 3 seconds
        setTimeout(() => {
          closeCreateInvoice()
        }, 3000)
      }
    } catch (err) {
      console.error('Invoice lookup error:', err)
    }
  }, 5000) // Check every 5 seconds
}

const copyInvoice = async () => {
  if (!createdInvoice.value) return
  
  try {
    await navigator.clipboard.writeText(createdInvoice.value.invoice)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy invoice:', err)
  }
}

// NEW: Share invoice method
const shareInvoice = () => {
  if (!createdInvoice.value) return
  
  // Navigate to the invoice share page with the invoice as a parameter
  const invoiceParam = encodeURIComponent(createdInvoice.value.invoice)
  const shareUrl = `${window.location.origin}${window.location.pathname}?page=invoice-share&invoice=${invoiceParam}`
  
  // Update the URL and navigate
  window.history.pushState({}, '', shareUrl)
  changePage('invoice-share')
  
  // Close the modal
  closeCreateInvoice()
}

// Payment sending methods
const openSendPayment = () => {
  showSendPayment.value = true
  paymentForm.value = { invoice: '', amount: '' }
  paymentStatus.value = ''
  paymentResult.value = null
  isResolvingAddress.value = false
}

const closeSendPayment = () => {
  showSendPayment.value = false
  closeQrScanner()
}

const sendPayment = async () => {
  if (!isPaymentFormValid.value) return

  isLoading.value = true
  paymentStatus.value = 'pending'
  error.value = ''

  try {
    const raw = paymentForm.value.invoice.trim()
    const cleaned = stripLightningPrefix(raw)
    let result
    let paidAmountSats = null

    if (isLightningAddress(cleaned)) {
      // Lightning address flow: resolve to invoice then pay
      const amountSats = parseInt(paymentForm.value.amount)
      isResolvingAddress.value = true
      try {
        result = await payLightningAddress(cleaned, amountSats)
      } finally {
        isResolvingAddress.value = false
      }
      paidAmountSats = amountSats
    } else {
      // Direct BOLT-11 invoice flow
      const invoice = cleaned
      result = await payInvoice({ invoice })
      paidAmountSats = extractAmountFromInvoice(invoice)
    }

    paymentResult.value = result
    paymentStatus.value = 'success'

    handlePaymentSuccess(result)

    if (paidAmountSats) {
      handleZapSent({ amount: paidAmountSats * 1000 }) // msats
    }

    await refreshData()

    setTimeout(() => {
      closeSendPayment()
    }, 3000)

  } catch (err) {
    error.value = getUserFriendlyError(err)
    paymentStatus.value = 'error'
    handlePaymentError(err)
  } finally {
    isLoading.value = false
    isResolvingAddress.value = false
  }
}

// Simple invoice amount extraction (this is a simplified version)
const extractAmountFromInvoice = (invoice) => {
  try {
    // This is a very basic extraction - in a real app you'd use a proper BOLT11 decoder
    const match = invoice.match(/lnbc(\d+)/)
    if (match) {
      return parseInt(match[1]) * 1000 // Convert to msats
    }
  } catch (err) {
    console.warn('Failed to extract amount from invoice:', err)
  }
  return null
}

// QR Scanner methods
const openQrScanner = () => {
  showQrScanner.value = true
  qrScannerError.value = ''
}

const closeQrScanner = () => {
  showQrScanner.value = false
  qrScannerError.value = ''
}

// Replace onQrDecode with decodeQR for vue-qrcode-reader
const decodeQR = (results) => {
  if (!results || !results.length) return
  const decodedString = results[0].rawValue || results[0].text || ''
  try {
    let value = decodedString
    // Strip lightning: prefix
    if (value.toLowerCase().startsWith('lightning:')) {
      value = value.substring(10)
    }
    // Extract from bitcoin: unified QR
    if (decodedString.toLowerCase().startsWith('bitcoin:') && decodedString.includes('lightning=')) {
      const lightningMatch = decodedString.match(/lightning=([^&]+)/)
      if (lightningMatch) {
        value = lightningMatch[1]
      }
    }
    // Accept BOLT-11 invoices
    if (value.toLowerCase().startsWith('lnbc') || value.toLowerCase().startsWith('lntb')) {
      paymentForm.value.invoice = value
      closeQrScanner()
    }
    // Accept lightning addresses
    else if (isLightningAddress(value)) {
      paymentForm.value.invoice = value
      closeQrScanner()
    } else {
      qrScannerError.value = 'Not a Lightning invoice or address'
    }
  } catch (err) {
    qrScannerError.value = 'Failed to process QR code: ' + err.message
  }
}

const onQrError = (error) => {
  console.error('QR Scanner error:', error)
  qrScannerError.value = 'Camera error: ' + error.message
}



const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

const getTransactionIcon = (transaction) => {
  if (transaction.type === 'incoming') {
    return IconArrowDownLeft
  }
  return IconArrowUpRight
}

const getTransactionColor = (transaction) => {
  if (transaction.type === 'incoming') {
    return 'text-green-600'
  }
  return 'text-red-600'
}

const truncateInvoice = (invoice, length = 20) => {
  if (!invoice) return ''
  if (invoice.length <= length) return invoice
  return invoice.substring(0, length) + '...'
}

const parseNoteContent = (note) => {
  if (typeof note === 'string') {
    // Handle JSON object strings (like Nostr events)
    if (note.startsWith('{') && note.endsWith('}')) {
      try {
        const parsed = JSON.parse(note)
        if (parsed && typeof parsed === 'object') {
          // Handle Nostr zap events (kind 9734)
          if (parsed.kind === 9734) {
            const amountTag = parsed.tags?.find(tag => tag[0] === 'amount')
            const amount = amountTag ? amountTag[1] : null
            if (amount) {
              return `Zap: ${Math.floor(amount / 1000)} sats`
            }
            return 'Zap payment'
          }
          
          // Handle other Nostr events with content
          if (parsed.content) {
            return parsed.content
          }
          
          // Handle other object types
          if (parsed.description) {
            return parsed.description
          }
          
          return `${parsed.kind ? `Event (kind ${parsed.kind})` : 'Event'}`
        }
      } catch (error) {
        return note
      }
    }
    // Handle JSON array strings
    else if (note.startsWith('[') && note.endsWith(']')) {
      try {
        const parsed = JSON.parse(note)
        if (Array.isArray(parsed)) {
          return extractTextFromArray(parsed)
        }
      } catch (error) {
        return note
      }
    }
    return note
  }
  
  if (Array.isArray(note)) {
    return extractTextFromArray(note)
  }
  
  if (typeof note === 'object' && note !== null) {
    try {
      return JSON.stringify(note.get('content'))
    } catch (error) {
      return 'Unable to display note content'
    }
  }
  
  return String(note || 'No note content')
}

const extractTextFromArray = (noteArray) => {
  try {
    const textPlain = noteArray.find(item => Array.isArray(item) && item[0] === 'text/plain')
    if (textPlain && textPlain[1]) {
      return textPlain[1]
    }
    
    const textIdentifier = noteArray.find(item => Array.isArray(item) && item[0] === 'text/identifier')
    if (textIdentifier && textIdentifier[1]) {
      return textIdentifier[1]
    }
    
    const firstText = noteArray.find(item => Array.isArray(item) && typeof item[1] === 'string')
    if (firstText && firstText[1]) {
      return firstText[1]
    }
    
    return 'Complex note content'
  } catch (error) {
    return 'Unable to parse note content'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Empty Wallet State -->
    <div v-if="!isWalletConnected" class="wallet-empty-state">
      <!-- Hero Section -->
      <div class="wallet-empty-hero">
        <div class="wallet-empty-icon-wrapper">
          <IconWallet class="wallet-empty-icon" />
          <div class="wallet-empty-icon-pulse"></div>
        </div>

        <h2 class="wallet-empty-title">Connect Your Lightning Wallet</h2>
        <p class="wallet-empty-description">
          Connect your Nostr Wallet Connect (NWC) enabled wallet to manage payments, create invoices, and track transactions.
        </p>

        <button
          @click="changePage('settings', 'wallet')"
          class="wallet-empty-button"
        >
          <IconBolt class="w-5 h-5" />
          <span>Connect Wallet</span>
        </button>
      </div>

      <!-- Features Grid -->
      <div class="wallet-features-grid">
        <div class="wallet-feature-card">
          <div class="wallet-feature-icon wallet-feature-icon-receive">
            <IconArrowDownLeft class="w-5 h-5" />
          </div>
          <h3 class="wallet-feature-title">Receive Payments</h3>
          <p class="wallet-feature-description">
            Create Lightning invoices and receive sats instantly
          </p>
        </div>

        <div class="wallet-feature-card">
          <div class="wallet-feature-icon wallet-feature-icon-send">
            <IconArrowUpRight class="w-5 h-5" />
          </div>
          <h3 class="wallet-feature-title">Send Payments</h3>
          <p class="wallet-feature-description">
            Pay Lightning invoices with a single tap
          </p>
        </div>

        <div class="wallet-feature-card">
          <div class="wallet-feature-icon wallet-feature-icon-history">
            <IconClock class="w-5 h-5" />
          </div>
          <h3 class="wallet-feature-title">Transaction History</h3>
          <p class="wallet-feature-description">
            Track all your payments and receipts in one place
          </p>
        </div>
      </div>

      <!-- Info Card -->
      <div class="wallet-info-card">
        <div class="wallet-info-header">
          <IconBolt class="w-5 h-5 text-orange-600" />
          <h4 class="wallet-info-title">What is NWC?</h4>
        </div>
        <p class="wallet-info-text">
          Nostr Wallet Connect (NWC) is a secure protocol that allows apps to interact with your Lightning wallet without exposing your private keys. Your funds always stay in your control.
        </p>
        <a
          href="https://nwc.wtf"
          target="_blank"
          rel="noopener noreferrer"
          class="wallet-info-link"
        >
          <span>Learn more about NWC</span>
          <IconExternalLink class="w-4 h-4" />
        </a>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Balance Card -->
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6 rounded-xl shadow-lg">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold mb-1">Wallet Balance</h2>
            <p class="text-orange-100 text-sm">{{ walletInfo?.alias || 'Lightning Wallet' }}</p>
          </div>
          <div class="flex items-center space-x-2">
            <button
              @click="showBalance = !showBalance"
              class="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <IconEye v-if="showBalance" class="w-5 h-5" />
              <IconEyeOff v-else class="w-5 h-5" />
            </button>
            <button
              @click="refreshData"
              :disabled="isLoading"
              class="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <IconRefresh :class="['w-5 h-5', isLoading ? 'animate-spin' : '']" />
            </button>
          </div>
        </div>
        
        <div class="text-3xl font-bold mb-2">
          {{ formattedBalance }} sats
        </div>
        
        <div class="flex space-x-3">
          <button
            @click="openCreateInvoice"
            class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <IconPlus class="w-4 h-4" />
            <span>Receive</span>
          </button>
          <button
            @click="openSendPayment"
            class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            <IconSend class="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600 flex-shrink-0" />
            <span class="text-red-800">{{ error }}</span>
          </div>
          <button
            @click="loadWalletData"
            :disabled="isLoading"
            class="ml-4 px-4 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Transactions List -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
        <div class="p-6 border-b border-orange-100/50">
          <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <IconClock class="w-5 h-5 text-orange-600" />
            <span>Recent Transactions</span>
          </h3>
        </div>
        
        <div v-if="isLoading && transactions.length === 0" class="p-6">
          <div class="animate-pulse space-y-4">
            <div v-for="i in 3" :key="i" class="flex items-center space-x-4">
              <div class="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                <div class="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div class="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        </div>
        
        <div v-else-if="sortedTransactions.length === 0" class="p-8 text-center">
          <IconBolt class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No transactions yet</h4>
          <p class="text-gray-600 mb-4">Transactions will appear here once you send or receive Lightning payments. Use the buttons above to create an invoice or send a payment.</p>
          <div class="flex items-center justify-center space-x-3">
            <button
              @click="openCreateInvoice"
              class="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
            >
              Create Invoice
            </button>
            <button
              @click="openSendPayment"
              class="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
            >
              Send Payment
            </button>
          </div>
        </div>
        
        <div v-else class="divide-y divide-orange-100/50">
          <div
            v-for="transaction in sortedTransactions.slice(0, 10)"
            :key="transaction.payment_hash || transaction.id"
            class="p-4 hover:bg-orange-25/50 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div :class="[
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  transaction.type === 'incoming' ? 'bg-green-100' : 'bg-red-100'
                ]">
                  <component 
                    :is="getTransactionIcon(transaction)" 
                    :class="['w-5 h-5', getTransactionColor(transaction)]"
                  />
                </div>
                <div>
                  <p class="font-medium text-gray-900">
                    {{ transaction.type === 'incoming' ? 'Received' : 'Sent' }}
                  </p>
                  <p class="text-sm text-gray-600">
                    {{ parseNoteContent(transaction.description) }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ formatDate(transaction.settled_at || transaction.created_at) }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p :class="[
                  'font-semibold',
                  getTransactionColor(transaction)
                ]">
                  {{ transaction.type === 'incoming' ? '+' : '-' }}{{ formatMsatsToSats(transaction.amount) }} sats
                </p>
                <p class="text-xs text-gray-500">
                  {{ transaction.state || 'settled' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Invoice Modal - Bottom Sheet -->
    <Teleport to="body">
      <transition name="modal-transition">
        <div v-if="showCreateInvoice" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div class="bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-5">
              <h3 class="text-lg font-semibold text-gray-900">Create Invoice</h3>
              <button
                @click="closeCreateInvoice"
                class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
        
        <div v-if="!createdInvoice" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount (sats)</label>
            <input
              v-model="invoiceForm.amount"
              type="number"
              placeholder="1000"
              class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              v-model="invoiceForm.description"
              placeholder="Payment for..."
              rows="3"
              class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            ></textarea>
          </div>
          
          <button
            @click="createInvoice"
            :disabled="!isInvoiceFormValid || isLoading"
            class="btn-primary w-full"
          >
            <IconPlus class="w-4 h-4" />
            {{ isLoading ? 'Creating...' : 'Create Invoice' }}
          </button>
        </div>
        
        <div v-else class="space-y-4">
          <div v-if="invoiceStatus === 'paid'" class="text-center">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <IconCheck class="w-8 h-8 text-green-600" />
            </div>
            <h4 class="text-lg font-semibold text-green-600 mb-2">Payment Received!</h4>
            <p class="text-gray-600">{{ formatMsatsToSats(createdInvoice.amount) }} sats received</p>
          </div>
          
          <div v-else class="text-center">
            <h4 class="text-lg font-semibold text-gray-900 mb-4">Invoice Created</h4>
            
            <!-- QR Code -->
            <div class="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4 inline-block">
              <QRCodeVue3
                :value="createdInvoice.invoice" 
                :size="200"
                color="#000000"
                background-color="#ffffff"
                error-correction-level="M"
              />
            </div>
            
            <p class="text-sm text-gray-600 mb-4">
              Amount: {{ formatMsatsToSats(createdInvoice.amount) }} sats
            </p>
            
            <!-- Invoice String -->
            <div class="bg-gray-50 p-3 rounded-lg mb-4">
              <p class="text-xs text-gray-600 mb-2">Lightning Invoice:</p>
              <p class="text-sm font-mono break-all">{{ truncateInvoice(createdInvoice.invoice, 50) }}</p>
            </div>
            
            <!-- Action Buttons -->
            <div class="grid grid-cols-2 gap-3">
              <button
                @click="copyInvoice"
                class="btn-secondary"
              >
                <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
                <IconCopy v-else class="w-4 h-4" />
                {{ copySuccess ? 'Copied!' : 'Copy' }}
              </button>
              
              <button
                @click="shareInvoice"
                class="btn-secondary"
              >
                <IconShare class="w-4 h-4" />
                Share
              </button>
            </div>
            
            <p class="text-xs text-gray-500 mt-4">
              Waiting for payment... (checking every 5 seconds)
            </p>
          </div>
        </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Send Payment Modal - Bottom Sheet -->
    <Teleport to="body">
      <transition name="modal-transition">
        <div v-if="showSendPayment" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div class="bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-5">
              <h3 class="text-lg font-semibold text-gray-900">Send Payment</h3>
              <button
                @click="closeSendPayment"
                class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
        
        <div v-if="paymentStatus === 'success'" class="text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck class="w-8 h-8 text-green-600" />
          </div>
          <h4 class="text-lg font-semibold text-green-600 mb-2">Payment Sent!</h4>
          <p class="text-gray-600">Payment completed successfully</p>
        </div>
        
        <div v-else class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Invoice or Lightning Address</label>
            <div class="relative">
              <textarea
                v-model="paymentForm.invoice"
                placeholder="lnbc1... or user@domain.com"
                rows="3"
                class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base font-mono text-sm"
              ></textarea>
              <button
                @click="openQrScanner"
                class="absolute top-2 right-2 p-2 text-gray-400 hover:text-orange-600 transition-colors"
                title="Scan QR Code"
              >
                <IconScan class="w-5 h-5" />
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Paste a Lightning invoice, address, or scan QR code
            </p>

            <!-- Input type indicator -->
            <div v-if="paymentInputType === 'lightning-address'" class="mt-2 flex items-center gap-1.5 text-xs text-orange-600">
              <IconBolt class="w-3.5 h-3.5" />
              <span>Lightning Address detected</span>
            </div>
          </div>

          <!-- Amount field for lightning addresses -->
          <div v-if="paymentInputType === 'lightning-address'">
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount (sats)</label>
            <input
              v-model="paymentForm.amount"
              type="number"
              min="1"
              placeholder="Enter amount in sats"
              class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
          </div>

          <button
            @click="sendPayment"
            :disabled="!isPaymentFormValid || isLoading"
            class="btn-primary w-full"
          >
            <IconSend class="w-4 h-4" />
            <template v-if="isResolvingAddress">Resolving address...</template>
            <template v-else-if="isLoading">Sending...</template>
            <template v-else>Send Payment</template>
          </button>

          <div v-if="paymentStatus === 'error'" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-600">{{ error }}</p>
          </div>
        </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- QR Scanner Modal - Bottom Sheet -->
    <Teleport to="body">
      <transition name="modal-transition">
        <div v-if="showQrScanner" class="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div class="bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex justify-between items-center mb-5">
              <h3 class="text-lg font-semibold text-gray-900">Scan QR Code</h3>
              <button
                @click="closeQrScanner"
                class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
        
        <div class="space-y-4">
          <!-- Camera Permission Check -->
          <div v-if="cameraPermission === 'denied'" class="text-center py-8">
            <IconCameraOff class="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">Camera Access Denied</h4>
            <p class="text-gray-600 text-sm mb-4">Please enable camera access to scan QR codes</p>
            <button @click="closeQrScanner" class="btn-secondary">
              Close
            </button>
          </div>
          
          <!-- QR Scanner -->
          <div v-else class="relative h-64">
            <div class="bg-black rounded-lg overflow-hidden w-full h-full">
              <qrcode-stream
                @detect="decodeQR"
                style="border-radius: 8px !important; width: 100%; height: 100%;"
              />
            </div>
            
            <!-- Scanner Overlay -->
            <div class="absolute inset-0 pointer-events-none">
              <div class="w-full h-full border-2 border-orange-400 rounded-lg opacity-50"></div>
              <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-orange-400 rounded-lg"></div>
            </div>
          </div>
          
          <!-- Scanner Instructions -->
          <div class="text-center">
            <div class="flex items-center justify-center space-x-2 mb-2">
              <IconCamera class="w-5 h-5 text-orange-600" />
              <span class="text-sm font-medium text-gray-700">Point camera at QR code</span>
            </div>
            <p class="text-xs text-gray-500">
              Position the Lightning invoice QR code within the frame
            </p>
          </div>
          
          <!-- Error Message -->
          <div v-if="qrScannerError" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="flex items-center space-x-2">
              <IconAlertCircle class="w-4 h-4 text-red-600" />
              <span class="text-sm text-red-600">{{ qrScannerError }}</span>
            </div>
          </div>
          
          <!-- Manual Input Option -->
          <div class="text-center pt-4 border-t border-gray-200">
            <button
              @click="closeQrScanner"
              class="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Enter invoice manually instead
            </button>
          </div>
        </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Empty Wallet State */
.wallet-empty-state {
  @apply space-y-6;
}

.wallet-empty-hero {
  @apply bg-white rounded-2xl p-8 text-center;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.wallet-empty-icon-wrapper {
  @apply relative inline-flex items-center justify-center mb-6;
}

.wallet-empty-icon {
  @apply w-20 h-20 text-orange-600;
  position: relative;
  z-index: 2;
}

.wallet-empty-icon-pulse {
  @apply absolute inset-0 rounded-full bg-orange-100;
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0;
  }
}

.wallet-empty-title {
  @apply text-2xl font-semibold text-gray-900 mb-3;
  letter-spacing: -0.01em;
}

.wallet-empty-description {
  @apply text-gray-600 mb-6 max-w-md mx-auto;
  line-height: 1.6;
}

.wallet-empty-button {
  @apply inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium transition-all duration-200;
  box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
}

.wallet-empty-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.4);
}

.wallet-empty-button:active {
  transform: translateY(0);
}

/* Features Grid */
.wallet-features-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-4;
}

.wallet-feature-card {
  @apply bg-white rounded-2xl p-6 text-center;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.wallet-feature-card:hover {
  box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.wallet-feature-icon {
  @apply w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4;
}

.wallet-feature-icon-receive {
  @apply bg-green-100 text-green-600;
}

.wallet-feature-icon-send {
  @apply bg-blue-100 text-blue-600;
}

.wallet-feature-icon-history {
  @apply bg-orange-100 text-orange-600;
}

.wallet-feature-title {
  @apply text-base font-semibold text-gray-900 mb-2;
  letter-spacing: -0.01em;
}

.wallet-feature-description {
  @apply text-sm text-gray-600;
  line-height: 1.5;
}

/* Info Card */
.wallet-info-card {
  @apply bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6;
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.wallet-info-header {
  @apply flex items-center gap-2 mb-3;
}

.wallet-info-title {
  @apply text-base font-semibold text-gray-900;
  letter-spacing: -0.01em;
}

.wallet-info-text {
  @apply text-sm text-gray-700 mb-4;
  line-height: 1.6;
}

.wallet-info-link {
  @apply inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors duration-150;
}

.wallet-info-link:hover {
  @apply underline;
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .wallet-empty-hero {
    @apply p-6;
  }

  .wallet-empty-title {
    @apply text-xl;
  }

  .wallet-empty-description {
    @apply text-sm;
  }

  .wallet-empty-icon {
    @apply w-16 h-16;
  }

  .wallet-feature-card {
    @apply p-5;
  }

  .wallet-feature-icon {
    @apply w-10 h-10;
  }

  .wallet-info-card {
    @apply p-5;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .wallet-empty-icon-pulse,
  .wallet-empty-button,
  .wallet-feature-card {
    animation: none !important;
    transition: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .wallet-empty-hero,
  .wallet-feature-card,
  .wallet-info-card {
    border-width: 2px;
  }
}

/* Modal Transitions - Apple Style */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

.modal-transition-enter-from .bg-white,
.modal-transition-leave-to .bg-white {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .modal-transition-enter-from .bg-white,
  .modal-transition-leave-to .bg-white {
    transform: scale(0.95) translateY(-20px);
  }
}
</style>