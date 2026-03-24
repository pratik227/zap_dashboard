<script setup>
import { ref, inject, onMounted, watch, computed } from 'vue'
import { IconBolt, IconRefresh, IconPlugOff, IconCheck, IconAlertCircle } from '@iconify-prerendered/vue-tabler'
import { useNostrConnections } from '../../composables/core/useNostrConnections.js'
import nwcLogo from '../../assets/nwc-logo.svg'

const emit = defineEmits(['connection-success'])

const {
  activeConnection,
  isLoadingConnection,
  connectionError,
  isWalletConnected,
  setActiveConnection,
  clearActiveConnection,
  autoReconnect,
  walletStatus,
  walletStatusMessage
} = useNostrConnections()

const nwcUrl = ref('')
const showSuccess = ref(false)
const localError = ref('')
const connectCountdown = ref(0)
let _countdownTimer = null

// Countdown timer for connection timeout feedback
watch(isLoadingConnection, (loading) => {
  if (loading) {
    connectCountdown.value = 30
    _countdownTimer = setInterval(() => {
      connectCountdown.value--
      if (connectCountdown.value <= 0) {
        clearInterval(_countdownTimer)
        _countdownTimer = null
      }
    }, 1000)
  } else {
    connectCountdown.value = 0
    if (_countdownTimer) {
      clearInterval(_countdownTimer)
      _countdownTimer = null
    }
  }
})

// Check for stored connection on mount
onMounted(() => {
  if (isWalletConnected.value) {
    showSuccess.value = true
    setTimeout(() => {
      showSuccess.value = false
    }, 3000)
  }
})

// Watch for connection changes
watch(isWalletConnected, (connected) => {
  if (connected) {
    showSuccess.value = true
    setTimeout(() => {
      showSuccess.value = false
    }, 3000)
  }
})

async function connectToWallet() {
  if (!nwcUrl.value.trim()) {
    localError.value = 'Please enter a valid NWC URL'
    return
  }

  localError.value = ''

  try {
    await setActiveConnection(nwcUrl.value.trim())

    showSuccess.value = true
    setTimeout(() => {
      showSuccess.value = false
    }, 3000)
    
    // Clear the input
    nwcUrl.value = ''
    
    // Emit success event to parent
    emit('connection-success')
    
  } catch (error) {
    console.error('Connection failed:', error)
    localError.value = error.message || 'Failed to connect to wallet'
  }
}

function disconnect() {
  clearActiveConnection()
  nwcUrl.value = ''
  showSuccess.value = false
  localError.value = ''
}

async function refreshConnection() {
  if (!isWalletConnected.value) return
  
  try {
    await autoReconnect()
    
    showSuccess.value = true
    setTimeout(() => {
      showSuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to refresh connection:', error)
    localError.value = 'Failed to refresh connection'
  }
}

// Clear local error when connection error changes
watch(connectionError, () => {
  if (!connectionError.value) {
    localError.value = ''
  }
})

const displayError = computed(() => {
  return localError.value || connectionError.value
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center space-x-3">
        <img :src="nwcLogo" alt="NWC Logo" class="w-8 h-8" @error="$event.target.style.display = 'none'" />
        <div>
          <h3 class="text-lg font-semibold text-gray-800 flex items-center space-x-2">
            <IconBolt class="w-5 h-5 text-orange-600" />
            <span>Wallet Connection</span>
          </h3>
          <p class="text-sm text-gray-600">Connect your Lightning wallet via Nostr Wallet Connect</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        <div :class="[
          'w-2 h-2 rounded-full transition-all duration-300',
          walletStatus === 'connected' ? 'bg-green-400 animate-pulse' :
          walletStatus === 'reconnecting' || walletStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
          'bg-red-400'
        ]"></div>
        <span class="text-sm text-gray-600">
          {{ walletStatus === 'connected' ? 'Connected' :
             walletStatus === 'reconnecting' ? 'Reconnecting...' :
             walletStatus === 'connecting' ? 'Connecting...' :
             walletStatus === 'error' ? 'Error — retrying' :
             'Disconnected' }}
        </span>
      </div>
    </div>

    <!-- Success Message -->
    <transition name="slide-down">
      <div v-if="showSuccess" class="bg-green-50 border border-green-200 rounded-lg p-3">
        <div class="flex items-center space-x-2">
          <IconCheck class="w-4 h-4 text-green-600 success-checkmark" />
          <span class="text-sm text-green-800">
            Wallet connected successfully! Data will refresh automatically.
          </span>
        </div>
      </div>
    </transition>

    <div v-if="!isWalletConnected" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Nostr Wallet Connect URL
        </label>
        <input
          v-model="nwcUrl"
          type="password"
          placeholder="nostr+walletconnect://..."
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base touch-target transition-all duration-200"
          @keyup.enter="connectToWallet"
          :disabled="isLoadingConnection"
        />
        <p class="text-xs text-gray-500 mt-1">
          Get your NWC URL from your Alby account or other NWC-enabled wallet
        </p>
      </div>

      <button
        @click="connectToWallet"
        :disabled="isLoadingConnection || !nwcUrl.trim()"
        :class="[
          'btn-primary w-full',
          isLoadingConnection ? 'opacity-75 cursor-not-allowed' : ''
        ]"
      >
        <IconRefresh v-if="isLoadingConnection" class="w-4 h-4 animate-spin" />
        <IconBolt v-else class="w-4 h-4" />
        {{ isLoadingConnection ? `Connecting... ${connectCountdown > 0 ? `(${connectCountdown}s)` : ''}` : 'Connect Wallet' }}
      </button>

      <!-- Error Message -->
      <transition name="error-fade">
        <div v-if="displayError" class="p-3 bg-red-50 border border-red-200 rounded-lg error-shake">
          <div class="flex items-start space-x-2">
            <IconAlertCircle class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p class="text-sm text-red-600">{{ displayError }}</p>
              <p class="text-xs text-red-500 mt-1">
                Make sure your NWC URL is correct and your wallet is online.
              </p>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <div v-else class="space-y-4">
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="font-medium text-green-800">
              {{ activeConnection?.name || 'Connected Wallet' }}
            </p>
            <p class="text-sm text-green-600">
              Connection active and ready • Data syncing automatically
            </p>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <button
              @click="refreshConnection"
              :disabled="isLoadingConnection"
              :class="[
                'btn-secondary text-sm',
                isLoadingConnection ? 'opacity-75 cursor-not-allowed' : ''
              ]"
            >
              <IconRefresh :class="['w-4 h-4', isLoadingConnection ? 'animate-spin' : '']" />
              Refresh
            </button>
            <button
              @click="disconnect"
              class="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <IconPlugOff class="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
