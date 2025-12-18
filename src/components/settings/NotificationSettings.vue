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
  IconSparkles,
  IconCalendar,
  IconClock
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../../composables/core/useNotifications.js'

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
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-1">Notification Preferences</h3>
      <p class="text-sm text-gray-600 mb-6">Configure how and when you receive notifications</p>

      <!-- Master Toggle -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 mb-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center">
              <IconBell v-if="notificationSettings.enabled" class="w-6 h-6 text-orange-600" />
              <IconBellOff v-else class="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h4 class="font-semibold text-gray-900">Enable Notifications</h4>
              <p class="text-sm text-gray-600">Turn all notifications on or off</p>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="notificationSettings.enabled"
              class="sr-only peer"
            />
            <div class="w-12 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-200 peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-orange-600 shadow-inner"></div>
          </label>
        </div>
      </div>

      <!-- Notification Types -->
      <div class="space-y-4">
        <h4 class="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Transaction Notifications</h4>

        <!-- NWC Wallet Transactions -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center">
                <IconWallet class="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Wallet Transactions</h5>
                <p class="text-sm text-gray-600">NWC incoming & outgoing payments</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.nwcTransactions"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-blue-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>

        <!-- Nostr Content Zaps -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl flex items-center justify-center">
                <IconSparkles class="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Content Zaps</h5>
                <p class="text-sm text-gray-600">Zaps received on your Nostr content</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.nostrZaps"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-orange-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>

        <!-- Balance Changes -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-green-100 to-green-50 rounded-xl flex items-center justify-center">
                <IconWallet class="w-5 h-5 text-green-600" />
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
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-green-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>

        <!-- Connection Status -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl flex items-center justify-center">
                <IconPlugConnected class="w-5 h-5 text-purple-600" />
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
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-purple-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Calendar Notifications -->
      <div class="space-y-4 mt-8">
        <h4 class="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Calendar Notifications</h4>

        <!-- Event Invitations -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl flex items-center justify-center">
                <IconCalendar class="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Event Invitations</h5>
                <p class="text-sm text-gray-600">When you're invited to events</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.calendarInvites"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-500 peer-checked:to-amber-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>

        <!-- Event Start Reminders -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-red-100 to-red-50 rounded-xl flex items-center justify-center">
                <IconClock class="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Event Reminders</h5>
                <p class="text-sm text-gray-600">When events are starting</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.calendarEventStarts"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-red-500 peer-checked:to-red-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Notification Methods -->
      <div class="space-y-4 mt-8">
        <h4 class="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Notification Methods</h4>

        <!-- Sound -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-yellow-100 to-yellow-50 rounded-xl flex items-center justify-center">
                <IconVolume v-if="notificationSettings.sound" class="w-5 h-5 text-yellow-600" />
                <IconVolumeOff v-else class="w-5 h-5 text-gray-400" />
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
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-yellow-500 peer-checked:to-yellow-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>

        <!-- Desktop Notifications -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl flex items-center justify-center">
                <IconDeviceDesktop class="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Desktop Notifications</h5>
                <p class="text-sm text-gray-600">
                  Show system notifications
                  <span v-if="desktopPermission === 'denied'" class="text-red-600 font-medium">(Permission denied)</span>
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
              <div class="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-200 peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-500 peer-checked:to-indigo-600 peer-disabled:opacity-50 shadow-inner"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth toggle transitions */
input[type="checkbox"] {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

input[type="checkbox"]:checked + div {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
</style>
