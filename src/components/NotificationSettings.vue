<script setup>
import { computed } from 'vue'
import { 
  IconBell, 
  IconBellOff,
  IconVolume,
  IconVolumeOff,
  IconDeviceDesktop,
  IconBolt,
  IconWallet,
  IconPlugConnected,
  IconCheck,
  IconX
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../composables/useNotifications.js'

const {
  notificationSettings,
  requestNotificationPermission
} = useNotifications()

const desktopPermission = computed(() => {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
})

const handleDesktopToggle = async (enabled) => {
  if (enabled && desktopPermission.value === 'default') {
    const granted = await requestNotificationPermission()
    if (!granted) {
      notificationSettings.value.desktop = false
      return
    }
  }
  notificationSettings.value.desktop = enabled
}

const testNotification = () => {
  // You can import and use the notification handlers here for testing
  console.log('Test notification triggered')
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Notification Preferences</h3>
      <p class="text-gray-600 text-sm mb-6">Configure how and when you receive notifications</p>
      
      <!-- Master Toggle -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <IconBell v-if="notificationSettings.enabled" class="w-5 h-5 text-orange-600" />
              <IconBellOff v-else class="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <h4 class="font-medium text-gray-900">Enable Notifications</h4>
              <p class="text-sm text-gray-600">Turn all notifications on or off</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="notificationSettings.enabled"
              class="sr-only peer"
            />
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
          </label>
        </div>
      </div>
      
      <!-- Notification Types -->
      <div class="space-y-4">
        <h4 class="font-medium text-gray-900">Notification Types</h4>
        
        <!-- Zap Received -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <IconBolt class="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Zaps Received</h5>
                <p class="text-sm text-gray-600">When you receive lightning tips</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.zapReceived"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
        
        <!-- Zap Sent -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <IconBolt class="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Zaps Sent</h5>
                <p class="text-sm text-gray-600">When you send lightning payments</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.zapSent"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
        
        <!-- Balance Changes -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <IconWallet class="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Balance Changes</h5>
                <p class="text-sm text-gray-600">When your wallet balance updates</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.balanceChange"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
        
        <!-- Connection Status -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <IconPlugConnected class="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Connection Status</h5>
                <p class="text-sm text-gray-600">Wallet connection and errors</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.connectionStatus"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>
      
      <!-- Notification Methods -->
      <div class="space-y-4 mt-6">
        <h4 class="font-medium text-gray-900">Notification Methods</h4>
        
        <!-- Sound -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <IconVolume v-if="notificationSettings.sound" class="w-4 h-4 text-yellow-600" />
                <IconVolumeOff v-else class="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Sound</h5>
                <p class="text-sm text-gray-600">Play notification sounds</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.sound"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
        
        <!-- Desktop Notifications -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <IconDeviceDesktop class="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Desktop Notifications</h5>
                <p class="text-sm text-gray-600">
                  Show system notifications
                  <span v-if="desktopPermission === 'denied'" class="text-red-600">(Permission denied)</span>
                  <span v-else-if="desktopPermission === 'unsupported'" class="text-gray-500">(Not supported)</span>
                </p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                :checked="notificationSettings.desktop"
                @change="handleDesktopToggle($event.target.checked)"
                :disabled="!notificationSettings.enabled || desktopPermission === 'denied' || desktopPermission === 'unsupported'"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>
      
      <!-- Test Notification -->
      <div class="bg-gray-50 rounded-lg p-4 mt-6">
        <div class="flex items-center justify-between">
          <div>
            <h5 class="font-medium text-gray-900">Test Notifications</h5>
            <p class="text-sm text-gray-600">Send a test notification to verify your settings</p>
          </div>
          <button
            @click="testNotification"
            :disabled="!notificationSettings.enabled"
            class="btn-secondary text-sm"
          >
            Test
          </button>
        </div>
      </div>
    </div>
  </div>
</template>