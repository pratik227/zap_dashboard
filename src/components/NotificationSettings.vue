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
  IconHeart,
  IconUsers,
  IconFileText,
  IconAlertCircle
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
</script>

<template>
  <div class="max-w-2xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="mb-8">
      <h2 class="text-2xl font-semibold text-gray-900 mb-2">Notification Preferences</h2>
      <p class="text-gray-500">Manage how you receive notifications</p>
    </div>

    <!-- Master Toggle -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div class="p-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <div class="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <IconBell v-if="notificationSettings.enabled" class="w-6 h-6 text-orange-600" />
              <IconBellOff v-else class="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-gray-900">Enable Notifications</h3>
              <p class="text-sm text-gray-500 mt-0.5">Turn all notifications on or off</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="notificationSettings.enabled"
              class="sr-only peer"
            />
            <div class="w-[52px] h-[32px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-100 rounded-full peer peer-checked:after:translate-x-[20px] after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-[24px] after:w-[24px] after:transition-all peer-checked:bg-orange-500 shadow-inner"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- Notification Types Section -->
    <div class="mb-8">
      <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 px-1">What to Notify</h3>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        <!-- Zaps Received -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconBolt class="w-5 h-5 text-green-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Zaps Received</h4>
                <p class="text-xs text-gray-500 mt-0.5">Lightning tips you receive</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.zapReceived"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-green-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Zaps Sent -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconBolt class="w-5 h-5 text-orange-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Zaps Sent</h4>
                <p class="text-xs text-gray-500 mt-0.5">Lightning payments you send</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.zapSent"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-orange-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Balance Changes -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconWallet class="w-5 h-5 text-blue-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Balance Changes</h4>
                <p class="text-xs text-gray-500 mt-0.5">Wallet balance updates</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.balanceChange"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-blue-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Engagements -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconHeart class="w-5 h-5 text-pink-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Engagements</h4>
                <p class="text-xs text-gray-500 mt-0.5">Replies, reposts, reactions</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.engagements"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-pink-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Social -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconUsers class="w-5 h-5 text-blue-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Social</h4>
                <p class="text-xs text-gray-500 mt-0.5">New followers, mentions</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.social"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-blue-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Content -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconFileText class="w-5 h-5 text-teal-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Content</h4>
                <p class="text-xs text-gray-500 mt-0.5">Published posts, milestones</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.content"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-teal-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- System -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconAlertCircle class="w-5 h-5 text-gray-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">System</h4>
                <p class="text-xs text-gray-500 mt-0.5">Updates, errors, alerts</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.system"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-gray-600 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Connection Status -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconPlugConnected class="w-5 h-5 text-gray-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Connection Status</h4>
                <p class="text-xs text-gray-500 mt-0.5">Wallet connections, errors</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.connectionStatus"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-gray-600 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification Methods Section -->
    <div>
      <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 px-1">How to Notify</h3>

      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        <!-- Sound -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconVolume v-if="notificationSettings.sound" class="w-5 h-5 text-yellow-600" />
                <IconVolumeOff v-else class="w-5 h-5 text-gray-400" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Sound</h4>
                <p class="text-xs text-gray-500 mt-0.5">Play notification sounds</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                v-model="notificationSettings.sound"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-yellow-500 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>

        <!-- Desktop Notifications -->
        <div class="p-5 hover:bg-gray-50 transition-colors">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1">
              <div class="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconDeviceDesktop class="w-5 h-5 text-gray-600" />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900">Desktop Notifications</h4>
                <p class="text-xs text-gray-500 mt-0.5">
                  System notifications
                  <span v-if="desktopPermission === 'denied'" class="text-red-600 font-medium"> • Denied</span>
                  <span v-else-if="desktopPermission === 'unsupported'" class="text-gray-400"> • Not supported</span>
                </p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer ml-4">
              <input
                type="checkbox"
                :checked="notificationSettings.desktop"
                @change="handleDesktopToggle($event.target.checked)"
                :disabled="!notificationSettings.enabled || desktopPermission === 'denied' || desktopPermission === 'unsupported'"
                class="sr-only peer"
              />
              <div class="w-[44px] h-[26px] bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-100 rounded-full peer peer-checked:after:translate-x-[18px] after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[20px] after:w-[20px] after:transition-all peer-checked:bg-gray-600 shadow-inner peer-disabled:opacity-40"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
