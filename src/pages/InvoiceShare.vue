<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { 
  IconArrowLeft, 
  IconCopy, 
  IconCheck, 
  IconBolt, 
  IconAlertCircle,
  IconShare,
  IconDownload,
  IconExternalLink,
  IconClock,
  IconGlobe
} from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { parseInvoiceBasic, formatInvoiceAmount, validateInvoice, truncateInvoice } from '../utils/wallet/invoiceUtils.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import { payInvoice } from '../utils/wallet/nwcClient.js'
import { useNotifications } from '../composables/core/useNotifications.js'
import { useNostrConnections } from '../composables/core/useNostrConnections.js'

const currentPage = inject('currentPage')
const emit = defineEmits(['change-page'])

const { handlePaymentSuccess, handlePaymentError } = useNotifications()
const { isWalletConnected } = useNostrConnections()

// State
const invoice = ref('')
const parsedInvoice = ref(null)
const copySuccess = ref(false)
const isLoading = ref(false)
const paymentStatus = ref('')
const error = ref('')

// Get invoice from URL parameters
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const invoiceParam = urlParams.get('invoice')
  if (invoiceParam) {
    invoice.value = decodeURIComponent(invoiceParam)
    parseInvoice()
  } else {
    error.value = 'No invoice provided in URL parameters'
  }
})

// Parse the invoice
const parseInvoice = () => {
  const validation = validateInvoice(invoice.value)
  if (!validation.isValid) {
    error.value = validation.error
    return
  }

  const parsed = parseInvoiceBasic(invoice.value)
  if (parsed) {
    parsedInvoice.value = parsed
    error.value = ''
  } else {
    error.value = 'Failed to parse invoice'
  }
}

// Computed properties
const qrCodeValue = computed(() => {
  // For Lightning invoices, we can use lightning: URI scheme
  return `lightning:${invoice.value}`
})

const invoiceDetails = computed(() => {
  if (!parsedInvoice.value) return []
  
  const details = []
  
  if (parsedInvoice.value.amount) {
    details.push({
      label: 'Amount',
      value: formatInvoiceAmount(parsedInvoice.value.amount),
      icon: IconBolt
    })
  }
  
  if (parsedInvoice.value.network) {
    details.push({
      label: 'Network',
      value: parsedInvoice.value.network.charAt(0).toUpperCase() + parsedInvoice.value.network.slice(1),
      icon: IconGlobe
    })
  }
  
  if (parsedInvoice.value.timestamp) {
    details.push({
      label: 'Created',
      value: parsedInvoice.value.timestamp.toLocaleString(),
      icon: IconClock
    })
  }
  
  return details
})

// Methods
const copyInvoice = async () => {
  try {
    await navigator.clipboard.writeText(invoice.value)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy invoice:', err)
  }
}

const shareInvoice = async () => {
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Lightning Invoice',
        text: `Pay this Lightning invoice: ${formatInvoiceAmount(parsedInvoice.value?.amount || 0)}`,
        url: window.location.href
      })
    } catch (err) {
      console.error('Failed to share:', err)
      // Fallback to copying URL
      copyUrl()
    }
  } else {
    // Fallback to copying URL
    copyUrl()
  }
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy URL:', err)
  }
}

const downloadQR = () => {
  try {
    // Find the QR code canvas element
    const qrContainer = document.querySelector('.qr-code-container')
    if (!qrContainer) {
      console.error('QR code container not found')
      return
    }

    const canvas = qrContainer.querySelector('canvas')
    if (!canvas) {
      console.error('QR code canvas not found')
      return
    }

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Failed to generate blob from canvas')
        return
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'lightning-invoice-qr.png'
      
      // Temporarily add to DOM, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the blob URL
      URL.revokeObjectURL(url)
    }, 'image/png', 1.0)

  } catch (error) {
    console.error('Error downloading QR code:', error)
  }
}

const payThisInvoice = async () => {
  if (!isWalletConnected.value) {
    error.value = 'Please connect your wallet to pay invoices'
    return
  }

  isLoading.value = true
  paymentStatus.value = 'processing'
  error.value = ''

  try {
    const result = await payInvoice({ invoice: invoice.value })
    
    paymentStatus.value = 'success'
    handlePaymentSuccess(result)
    
    // Show success message
    setTimeout(() => {
      goBack()
    }, 3000)
    
  } catch (err) {
    error.value = getUserFriendlyError(err)
    paymentStatus.value = 'error'
    handlePaymentError(err)
  } finally {
    isLoading.value = false
  }
}

const goBack = () => {
  // Navigate back to the main app
  window.history.back()
}

const openInWallet = () => {
  // Try to open in external wallet apps
  const lightningUrl = `lightning:${invoice.value}`
  window.open(lightningUrl, '_blank')
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-6 lg:p-8">
    <!-- Standalone Header -->
    <div class="max-w-4xl mx-auto mb-8">
      <div class="text-center">
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center space-x-2">
          <IconBolt class="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
          <span>Lightning Invoice</span>
        </h1>
        <p class="text-gray-600">Scan or copy the invoice to make a Lightning payment</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error && !parsedInvoice" class="max-w-2xl mx-auto">
      <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <IconAlertCircle class="w-12 h-12 mx-auto text-red-600 mb-4" />
        <h3 class="text-lg font-semibold text-red-900 mb-2">Invalid Invoice</h3>
        <p class="text-red-700 mb-4">{{ error }}</p>
        <button @click="goBack" class="btn-secondary">
          Go back
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else class="max-w-2xl mx-auto">
      <!-- QR Code Section -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6 text-center mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-6">Scan to Pay</h2>
        
        <!-- QR Code -->
        <div class="qr-code-container bg-white p-6 rounded-lg border-2 border-gray-200 mb-6 inline-block">

          <QRCodeVue3
            :key="qrCodeValue"
            :value="qrCodeValue"
            :size="250"
            color="#000000"
            background-color="#ffffff"
            error-correction-level="M"
            class="mx-auto"
          />
        </div>

        <!-- Amount Display -->
        <div v-if="parsedInvoice?.amount" class="mb-6">
          <div class="text-3xl font-bold text-orange-600 mb-2">
            {{ formatInvoiceAmount(parsedInvoice.amount) }}
          </div>
          <div class="text-sm text-gray-600">Lightning Payment</div>
        </div>

        <!-- Action Buttons -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <button
            @click="copyInvoice"
            class="btn-secondary"
          >
            <IconCheck v-if="copySuccess" class="w-4 h-4 text-green-600" />
            <IconCopy v-else class="w-4 h-4" />
            {{ copySuccess ? 'Copied!' : 'Copy Invoice' }}
          </button>
          
          <button
            @click="shareInvoice"
            class="btn-secondary"
          >
            <IconShare class="w-4 h-4" />
            Share
          </button>
          
          <button
            @click="downloadQR"
            class="btn-secondary"
          >
            <IconDownload class="w-4 h-4" />
            Download QR
          </button>
          
          <button
            @click="openInWallet"
            class="btn-secondary"
          >
            <IconExternalLink class="w-4 h-4" />
            Open in Wallet
          </button>
        </div>

        <!-- Pay Button (if wallet connected) -->
        <div v-if="isWalletConnected" class="border-t border-gray-200 pt-4">
          <button
            v-if="paymentStatus !== 'success'"
            @click="payThisInvoice"
            :disabled="isLoading || paymentStatus === 'processing'"
            class="btn-primary w-full"
          >
            <IconBolt class="w-4 h-4" />
            {{ isLoading ? 'Processing Payment...' : 'Pay This Invoice' }}
          </button>
          
          <div v-else class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center justify-center space-x-2">
              <IconCheck class="w-5 h-5 text-green-600" />
              <span class="text-green-800 font-medium">Payment Successful!</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Invoice Details -->
      <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>
        
        <!-- Parsed Details -->
        <div v-if="invoiceDetails.length > 0" class="space-y-3 mb-6">
          <div
            v-for="detail in invoiceDetails"
            :key="detail.label"
            class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
          >
            <div class="flex items-center space-x-2">
              <component :is="detail.icon" class="w-4 h-4 text-gray-500" />
              <span class="text-sm font-medium text-gray-700">{{ detail.label }}</span>
            </div>
            <span class="text-sm text-gray-900">{{ detail.value }}</span>
          </div>
        </div>

        <!-- Raw Invoice -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Invoice String</label>
          <div class="bg-gray-50 p-3 rounded-lg border">
            <code class="text-xs text-gray-600 break-all font-mono leading-relaxed">
              {{ invoice }}
            </code>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error && paymentStatus === 'error'" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <span class="text-red-800">{{ error }}</span>
        </div>
      </div>

      <!-- Instructions -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="font-medium text-blue-900 mb-2">How to Pay</h4>
        <ul class="text-sm text-blue-800 space-y-1">
          <li>• Scan the QR code with any Lightning wallet</li>
          <li>• Copy the invoice string and paste it in your wallet</li>
          <li>• Use the "Open in Wallet" button to launch your default Lightning app</li>
          <li v-if="isWalletConnected">• Use the "Pay This Invoice" button to pay directly from this app</li>
        </ul>
      </div>

      <!-- Back to App Link -->
      <div class="text-center mt-8">
        <button
          @click="goBack"
          class="text-orange-600 hover:text-orange-700 font-medium text-sm"
        >
          ← Back to previous page
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qr-code-container {
  display: inline-block;
}

code {
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
