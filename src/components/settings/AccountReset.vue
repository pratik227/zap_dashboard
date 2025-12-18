<script setup>
import { ref, onMounted } from 'vue'
import { 
  IconRefresh, 
  IconTrash, 
  IconCheck, 
  IconX, 
  IconAlertTriangle,
  IconLoader,
  IconBolt,
  IconKey,
  IconShield,
  IconPlugConnected,
  IconPlugOff,
  IconArrowLeft
} from '@iconify-prerendered/vue-tabler'
import {
  performCompleteReset,
  verifyConnectionStatus
} from '../../utils/account/accountReset.js'

// State
const isResetting = ref(false)
const resetComplete = ref(false)
const resetError = ref('')
const resetStep = ref(0)
const resetProgress = ref(0)
const resetSteps = [
  'Preparing for reset',
  'Clearing wallet connections',
  'Removing Nostr identity',
  'Finalizing reset'
]

const resetResult = ref(null)

// Status
const connectionStatus = ref(null)

// Reset all account data
const handleReset = async () => {
  if (isResetting.value) return
  
  if (!confirm('Are you sure you want to reset all account data? This cannot be undone.')) {
    return
  }
  
  isResetting.value = true
  resetError.value = ''
  resetComplete.value = false
  resetStep.value = 0
  resetProgress.value = 0
  
  try {
    // Step 1: Prepare
    resetStep.value = 0
    resetProgress.value = 10
    await new Promise(resolve => setTimeout(resolve, 300)) // Small delay for UI
    
    // Step 2: Clear wallet connections
    resetStep.value = 1
    resetProgress.value = 30
    await new Promise(resolve => setTimeout(resolve, 300)) // Small delay for UI
    
    // Step 3: Remove Nostr identity
    resetStep.value = 2
    resetProgress.value = 70
    await new Promise(resolve => setTimeout(resolve, 300)) // Small delay for UI
    
    // Step 4: Perform the actual reset and finalize
    resetStep.value = 3 
    resetProgress.value = 100
    await performCompleteReset()
    
    // Check final status
    connectionStatus.value = await verifyConnectionStatus()
    
    resetResult.value = { success: true }
    resetComplete.value = true
    
    // Show a full-screen success message
    document.body.style.overflow = 'hidden'
    
    // Force page reload after 5 seconds to ensure all components are reset
    const reloadTimer = setTimeout(() => {
      document.body.style.overflow = ''
      window.location.reload()
    }, 5000)
    
    // Allow user to cancel the automatic reload
    window.cancelReload = () => {
      clearTimeout(reloadTimer)
      document.body.style.overflow = ''
    }
  } catch (error) {
    console.error('Reset failed:', error)
    resetError.value = error.message || 'Reset failed'
    resetProgress.value = 0
    resetResult.value = { success: false, error: resetError.value }
  } finally {
    isResetting.value = false
  }
}

// Check current connection status
const checkStatus = async () => {
  try {
    connectionStatus.value = await verifyConnectionStatus()
  } catch (error) {
    console.error('Failed to check status:', error)
    resetError.value = 'Failed to check connection status'
  }
}

// Initialize on mount
onMounted(async () => {
  await checkStatus()
})
</script>

<template>
  <div class="space-y-6">
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-6">
      <div class="flex flex-col sm:flex-row sm:items-start sm:space-x-4">
        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 mx-auto sm:mx-0 mb-4 sm:mb-0">
          <IconTrash class="w-6 h-6 text-red-600" />
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-gray-900 mb-2 text-center sm:text-left">Account Data Reset</h2>
          <p class="text-gray-600 mb-6 text-center sm:text-left">
            This will clear all your local account data, including wallet connections, Nostr identity, and payment history.
            <span class="font-medium text-red-600">This action cannot be undone.</span>
          </p>
          
          <!-- Current Status -->
          <div v-if="connectionStatus" class="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <h3 class="font-medium text-gray-900 mb-3 text-center sm:text-left">Current Status</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- NWC Status -->
              <div class="flex items-start space-x-3">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  connectionStatus.nwc.connected ? 'bg-green-100' : 'bg-gray-100'
                ]">
                  <IconPlugConnected v-if="connectionStatus.nwc.connected" class="w-4 h-4 text-green-600" />
                  <IconPlugOff v-else class="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900">NWC Connection</h4>
                  <p class="text-sm text-gray-600">
                    {{ connectionStatus.nwc.connected ? 'Connected' : 'Not connected' }}
                  </p>
                  <p v-if="connectionStatus.nwc.connections > 0" class="text-xs text-gray-500 mt-1">
                    {{ connectionStatus.nwc.connections }} connection(s) stored
                  </p>
                </div>
              </div>
              
              <!-- Nostr Status -->
              <div class="flex items-start space-x-3">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  connectionStatus.nostr.authenticated ? 'bg-purple-100' : 'bg-gray-100'
                ]">
                  <IconKey v-if="connectionStatus.nostr.authenticated" class="w-4 h-4 text-purple-600" />
                  <IconKey v-else class="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900">Nostr Identity</h4>
                  <p class="text-sm text-gray-600">
                    {{ connectionStatus.nostr.authenticated ? 'Authenticated' : 'Not authenticated' }}
                  </p>
                  <p v-if="connectionStatus.nostr.npub" class="text-xs text-gray-500 mt-1">
                    {{ connectionStatus.nostr.npub.substring(0, 10) }}...
                  </p>
                </div>
              </div>
              
              <!-- Relay Status -->
              <div class="flex items-start space-x-3">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  connectionStatus.relayManager.connectedRelays > 0 ? 'bg-blue-100' : 'bg-gray-100'
                ]">
                  <IconBolt v-if="connectionStatus.relayManager.connectedRelays > 0" class="w-4 h-4 text-blue-600" />
                  <IconBolt v-else class="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <h4 class="font-medium text-gray-900">Relay Connections</h4>
                  <p class="text-sm text-gray-600">
                    {{ 
                      connectionStatus.relayManager.connectedRelays > 0 
                        ? `${connectionStatus.relayManager.connectedRelays} connected` 
                        : 'No connected relays' 
                    }}
                  </p>
                  <p v-if="connectionStatus.relayManager.totalRelays > 0" class="text-xs text-gray-500 mt-1">
                    {{ connectionStatus.relayManager.totalRelays }} total relays
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Reset Progress -->
          <div v-if="isResetting" class="mb-6">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700">
                {{ resetSteps[resetStep] }}...
              </span>
              <span class="text-sm text-gray-600">{{ resetProgress }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                class="bg-orange-600 h-2.5 rounded-full transition-all duration-300" 
                :style="{ width: resetProgress + '%' }"
              ></div>
            </div>
          </div>
          
          <!-- Reset Success -->
          <div v-if="resetComplete" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 animate-pulse-subtle">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <IconCheck class="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 class="font-medium text-green-900">Reset Complete</h4>
                <p class="text-sm text-green-800">
                  All account data has been successfully cleared.
                </p>
              </div>
            </div>
          </div>
          
          <!-- Reset Error -->
          <div v-if="resetError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 error-shake">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <IconX class="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h4 class="font-medium text-red-900">Reset Failed</h4>
                <p class="text-sm text-red-800">
                  {{ resetError }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
            <button
              @click="handleReset"
              :disabled="isResetting"
              class="btn-primary bg-red-600 hover:bg-red-700 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconRefresh v-if="!isResetting" class="w-4 h-4" />
              <IconLoader v-else class="w-4 h-4 animate-spin" />
              <span>{{ isResetting ? 'Resetting...' : 'Reset All Data' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Security Notice -->
    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 shadow-sm">
      <div class="flex items-start space-x-3">
        <IconShield class="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 class="font-medium text-orange-900 mb-1">Security Notice</h4>
          <p class="text-sm text-orange-800 leading-relaxed">
            This reset only clears data stored in your browser's local storage. It does not affect your actual wallet or Nostr identity. Your funds remain safe in your wallet, and your Nostr keys remain in your Nostr client or extension.
          </p>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Full-screen Success Message -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="resetComplete && resetResult?.success" class="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4">
        <div class="bg-white rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <IconCheck class="w-10 h-10 text-green-600" />
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">Reset Complete!</h2>
          <p class="text-lg text-gray-700 mb-6">
            All your account data has been successfully cleared. The page will refresh in a few seconds.
          </p>
          <div class="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div class="bg-green-600 h-2 rounded-full animate-countdown"></div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
<style scoped>
.animate-countdown {
  animation: countdown 5s linear forwards;
}

@keyframes countdown {
  from { width: 100%; }
  to { width: 0%; }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>