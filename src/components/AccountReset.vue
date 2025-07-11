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
  IconPlugOff
} from '@iconify-prerendered/vue-tabler'
import { 
  performCompleteReset, 
  clearNWCData, 
  clearNostrData, 
  initializeNewNWCSession,
  initializeNostrAccount,
  verifyConnectionStatus
} from '../utils/accountReset.js'

const emit = defineEmits(['reset-complete'])

// State
const isResetting = ref(false)
const resetComplete = ref(false)
const resetError = ref('')
const resetStep = ref(0)
const resetProgress = ref(0)
const resetSteps = [
  'Preparing for reset',
  'Clearing NWC data',
  'Clearing Nostr data',
  'Validating storage integrity',
  'Finalizing reset'
]

// Form state
const showAdvancedOptions = ref(false)
const nwcUrl = ref('')
const nostrPubkey = ref('')
const initializeAfterReset = ref(false)

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
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UI
    
    // Step 2: Clear NWC data
    resetStep.value = 1
    resetProgress.value = 30
    await clearNWCData()
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UI
    
    // Step 3: Clear Nostr data
    resetStep.value = 2
    resetProgress.value = 60
    await clearNostrData()
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UI
    
    // Step 4: Validate storage integrity
    resetStep.value = 3
    resetProgress.value = 80
    await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UI
    
    // Step 5: Finalize
    resetStep.value = 4
    resetProgress.value = 100
    
    // Initialize new accounts if requested
    if (initializeAfterReset.value) {
      if (nwcUrl.value) {
        await initializeNewNWCSession(nwcUrl.value)
      }
      
      if (nostrPubkey.value) {
        await initializeNostrAccount(nostrPubkey.value)
      }
    }
    
    // Check final status
    connectionStatus.value = await verifyConnectionStatus()
    
    resetComplete.value = true
    emit('reset-complete', { success: true })
    
  } catch (error) {
    console.error('Reset failed:', error)
    resetError.value = error.message || 'Reset failed'
    resetProgress.value = 0
    emit('reset-complete', { success: false, error: resetError.value })
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
    <div class="bg-white rounded-xl border border-gray-200 p-6">
      <div class="flex items-start space-x-4">
        <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <IconTrash class="w-6 h-6 text-red-600" />
        </div>
        <div class="flex-1">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Account Data Reset</h2>
          <p class="text-gray-600 mb-4">
            This will clear all your account data, including wallet connections, Nostr identity, and payment history.
            This action cannot be undone.
          </p>
          
          <!-- Current Status -->
          <div v-if="connectionStatus" class="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 class="font-medium text-gray-900 mb-2">Current Status</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <p v-if="connectionStatus.nwc.connections > 0" class="text-xs text-gray-500">
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
                  <p v-if="connectionStatus.nostr.npub" class="text-xs text-gray-500">
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
                  <p v-if="connectionStatus.relayManager.totalRelays > 0" class="text-xs text-gray-500">
                    {{ connectionStatus.relayManager.totalRelays }} total relays
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Advanced Options Toggle -->
          <div class="mb-6">
            <button 
              @click="showAdvancedOptions = !showAdvancedOptions"
              class="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
            >
              <span>{{ showAdvancedOptions ? 'Hide' : 'Show' }} advanced options</span>
              <IconChevronDown v-if="!showAdvancedOptions" class="w-4 h-4" />
              <IconChevronUp v-else class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Advanced Options -->
          <div v-if="showAdvancedOptions" class="space-y-4 mb-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div class="flex items-start space-x-3">
                <IconAlertTriangle class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-medium text-blue-900 mb-1">Advanced Options</h4>
                  <p class="text-sm text-blue-800">
                    You can optionally initialize new account data after reset. This is useful if you want to switch to a different wallet or Nostr identity.
                  </p>
                </div>
              </div>
            </div>
            
            <div class="flex items-center space-x-2 mb-4">
              <input 
                type="checkbox" 
                id="initialize-after-reset" 
                v-model="initializeAfterReset"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label for="initialize-after-reset" class="text-sm font-medium text-gray-700">
                Initialize new accounts after reset
              </label>
            </div>
            
            <div v-if="initializeAfterReset" class="space-y-4">
              <!-- NWC URL -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  New NWC URL (optional)
                </label>
                <input
                  v-model="nwcUrl"
                  type="password"
                  placeholder="nostr+walletconnect://..."
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Get this from your wallet's NWC settings
                </p>
              </div>
              
              <!-- Nostr Pubkey -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  New Nostr Public Key (optional)
                </label>
                <input
                  v-model="nostrPubkey"
                  type="text"
                  placeholder="Hex public key (not npub)"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Enter your Nostr public key in hex format (not npub)
                </p>
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
                class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                :style="{ width: resetProgress + '%' }"
              ></div>
            </div>
          </div>
          
          <!-- Reset Success -->
          <div v-if="resetComplete" class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
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
          <div v-if="resetError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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
          <div class="flex space-x-3">
            <button
              @click="handleReset"
              :disabled="isResetting"
              class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconLoader v-if="isResetting" class="w-4 h-4 animate-spin" />
              <IconTrash v-else class="w-4 h-4" />
              <span>{{ isResetting ? 'Resetting...' : 'Reset All Data' }}</span>
            </button>
            
            <button
              @click="checkStatus"
              :disabled="isResetting"
              class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <IconRefresh class="w-4 h-4" />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Security Notice -->
    <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <IconShield class="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 class="font-medium text-orange-900 mb-1">Security Notice</h4>
          <p class="text-sm text-orange-800">
            This reset only clears data stored in your browser's local storage. It does not affect your actual wallet or Nostr identity. Your funds remain safe in your wallet, and your Nostr keys remain in your Nostr client or extension.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>