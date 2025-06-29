<script setup>
import { ref, computed, onMounted, onUnmounted, inject, defineAsyncComponent } from 'vue'
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
  IconCameraOff
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { useNostrConnections } from '../composables/useNostrConnections.js'
import { useNotifications } from '../composables/useNotifications.js'
import { 
  getBalance, 
  getWalletInfo, 
  fetchTransactions, 
  makeInvoice, 
  payInvoice, 
  lookupInvoice 
} from '../utils/nwcClient.js'

// Dynamically import QrStream to avoid build issues
const QrStream = defineAsyncComponent(() => import('qrcode-reader-vue3').then(m => m.default))

const { isWalletConnected, activeConnection } = useNostrConnections()
const { handleZapSent, handlePaymentSuccess, handlePaymentError } = useNotifications()

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
  invoice: ''
})
const paymentStatus = ref('') // success, error, pending
const paymentResult = ref(null)

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

const isPaymentFormValid = computed(() => {
  return paymentForm.value.invoice.trim().length > 0
})

// Lifecycle methods
onMounted(() => {
  if (isWalletConnected.value) {
    loadWalletData()
  }
  checkCameraPermission()
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
    const [balanceData, infoData, transactionData] = await Promise.all([
      getBalance(),
      getWalletInfo(),
      fetchTransactions()
    ])
    
    if (balanceData) {
      balance.value = balanceData.balance || 0
    }
    
    if (infoData) {
      walletInfo.value = infoData
    }
    
    if (transactionData) {
      transactions.value = transactionData
    }
  } catch (err) {
    error.value = 'Failed to load wallet data: ' + err.message
    console.error('Wallet data loading error:', err)
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
    error.value = 'Failed to create invoice: ' + err.message
    console.error('Invoice creation error:', err)
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

// Payment sending methods
const openSendPayment = () => {
  showSendPayment.value = true
  paymentForm.value = { invoice: '' }
  paymentStatus.value = ''
  paymentResult.value = null
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
    const result = await payInvoice({
      invoice: paymentForm.value.invoice.trim()
    })
    
    paymentResult.value = result
    paymentStatus.value = 'success'
    
    // Notify about successful payment
    handlePaymentSuccess(result)
    
    // Also trigger zap sent notification if we can extract amount
    try {
      // Try to decode invoice to get amount (simplified)
      const invoiceAmount = extractAmountFromInvoice(paymentForm.value.invoice)
      if (invoiceAmount) {
        handleZapSent({ amount: invoiceAmount })
      }
    } catch (err) {
      console.warn('Could not extract amount from invoice:', err)
    }
    
    // Refresh wallet data to show new balance
    await refreshData()
    
    // Auto-close modal after 3 seconds
    setTimeout(() => {
      closeSendPayment()
    }, 3000)
    
  } catch (err) {
    error.value = 'Payment failed: ' + err.message
    paymentStatus.value = 'error'
    handlePaymentError(err)
    console.error('Payment error:', err)
  } finally {
    isLoading.value = false
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

const onQrDecode = (decodedString) => {
  try {
    // Handle different QR code formats
    let invoice = decodedString
    
    // If it's a lightning: URI, extract the invoice
    if (decodedString.toLowerCase().startsWith('lightning:')) {
      invoice = decodedString.substring(10)
    }
    
    // If it's a bitcoin: URI with lightning parameter
    if (decodedString.toLowerCase().startsWith('bitcoin:') && decodedString.includes('lightning=')) {
      const lightningMatch = decodedString.match(/lightning=([^&]+)/)
      if (lightningMatch) {
        invoice = lightningMatch[1]
      }
    }
    
    // Validate that it looks like a Lightning invoice
    if (invoice.toLowerCase().startsWith('lnbc') || invoice.toLowerCase().startsWith('lntb')) {
      paymentForm.value.invoice = invoice
      closeQrScanner()
    } else {
      qrScannerError.value = 'Invalid Lightning invoice QR code'
    }
  } catch (err) {
    qrScannerError.value = 'Failed to process QR code: ' + err.message
  }
}

const onQrError = (error) => {
  console.error('QR Scanner error:', error)
  qrScannerError.value = 'Camera error: ' + error.message
}

// Utility methods
const formatAmount = (amount) => {
  if (!amount) return '0'
  const sats = Math.floor(amount / 1000)
  return sats.toLocaleString()
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
    if (note.startsWith('[') && note.endsWith(']')) {
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
      return JSON.stringify(note)
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
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
        <IconWallet class="w-6 h-6 text-orange-600" />
        <span>Wallet</span>
      </h1>
      <p class="text-gray-600">Manage your Lightning wallet and transactions</p>
    </div>

    <!-- Connection Status -->
    <div v-if="!isWalletConnected" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div class="flex items-center space-x-2">
        <IconAlertCircle class="w-5 h-5 text-amber-600" />
        <span class="text-amber-800">Please connect your wallet to access wallet features.</span>
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
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <span class="text-red-800">{{ error }}</span>
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
        
        <div v-else-if="sortedTransactions.length === 0" class="p-6 text-center">
          <IconBolt class="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h4 class="text-lg font-medium text-gray-900 mb-2">No transactions yet</h4>
          <p class="text-gray-600">Your transaction history will appear here</p>
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
                  {{ transaction.type === 'incoming' ? '+' : '-' }}{{ formatAmount(transaction.amount) }} sats
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

    <!-- Create Invoice Modal -->
    <div v-if="showCreateInvoice" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-semibold text-gray-900">Create Invoice</h3>
          <button @click="closeCreateInvoice" class="text-gray-500 hover:text-gray-700">
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
            <p class="text-gray-600">{{ formatAmount(createdInvoice.amount) }} sats received</p>
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
              Amount: {{ formatAmount(createdInvoice.amount) }} sats
            </p>
            
            <!-- Invoice String -->
            <div class="bg-gray-50 p-3 rounded-lg mb-4">
              <p class="text-xs text-gray-600 mb-2">Lightning Invoice:</p>
              <p class="text-sm font-mono break-all">{{ truncateInvoice(createdInvoice.invoice, 50) }}</p>
            </div>
            
            <button
              @click="copyInvoice"
              class="btn-secondary w-full mb-4"
            >
              <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
              <IconCopy v-else class="w-4 h-4" />
              {{ copySuccess ? 'Copied!' : 'Copy Invoice' }}
            </button>
            
            <p class="text-xs text-gray-500">
              Waiting for payment... (checking every 5 seconds)
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Send Payment Modal -->
    <div v-if="showSendPayment" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-semibold text-gray-900">Send Payment</h3>
          <button @click="closeSendPayment" class="text-gray-500 hover:text-gray-700">
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
            <label class="block text-sm font-medium text-gray-700 mb-2">Lightning Invoice</label>
            <div class="relative">
              <textarea
                v-model="paymentForm.invoice"
                placeholder="lnbc1... or scan QR code"
                rows="4"
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
              Paste the Lightning invoice or scan QR code
            </p>
          </div>
          
          <button
            @click="sendPayment"
            :disabled="!isPaymentFormValid || isLoading"
            class="btn-primary w-full"
          >
            <IconSend class="w-4 h-4" />
            {{ isLoading ? 'Sending...' : 'Send Payment' }}
          </button>
          
          <div v-if="paymentStatus === 'error'" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-600">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- QR Scanner Modal -->
    <div v-if="showQrScanner" class="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-semibold text-gray-900">Scan QR Code</h3>
          <button @click="closeQrScanner" class="text-gray-500 hover:text-gray-700">
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
          <div v-else class="relative">
            <div class="bg-black rounded-lg overflow-hidden">
              <QrStream
                @decode="onQrDecode"
                @error="onQrError"
                class="w-full h-64"
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
  </div>
</template>