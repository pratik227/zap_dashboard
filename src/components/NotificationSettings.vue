<script setup>
import { ref, computed } from 'vue'
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
  IconX,
  IconHeart,
  IconMessageCircle,
  IconUsers,
  IconAt,
  IconFileText,
  IconSettings as IconSettingsIcon,
  IconClock,
  IconChevronDown,
  IconChevronUp
} from '@iconify-prerendered/vue-tabler'
import { useNotifications } from '../composables/useNotifications.js'

const {
  notificationSettings,
  requestNotificationPermission,
  handleZapReceived,
  NOTIFICATION_TYPES
} = useNotifications()

const expandedSections = ref({
  zaps: false,
  engagements: false,
  social: false,
  advanced: false
})

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

const toggleSection = (section) => {
  expandedSections.value[section] = !expandedSections.value[section]
}

const testNotification = () => {
  handleZapReceived({
    amount: 1000,
    sender: { name: 'Test User' },
    contentType: 'note'
  })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Notification Preferences</h3>
      <p class="text-gray-600 text-sm mb-6">Configure how and when you receive notifications</p>

      <!-- Master Toggle -->
      <div class="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200 p-4 mb-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-md">
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
            <div class="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-orange-500 peer-checked:to-amber-500"></div>
          </label>
        </div>
      </div>

      <!-- Notification Types -->
      <div class="space-y-4">
        <h4 class="font-medium text-gray-900 text-base">Notification Types</h4>

        <!-- Zaps Section -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 flex-1">
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <IconBolt class="w-5 h-5 text-green-600" />
                </div>
                <div class="flex-1">
                  <h5 class="font-medium text-gray-900">Zaps Received</h5>
                  <p class="text-xs text-gray-600">Lightning tips and zaps</p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="notificationSettings.zapReceived"
                    :disabled="!notificationSettings.enabled"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
                </label>
                <button
                  @click="toggleSection('zaps')"
                  class="p-1 hover:bg-gray-100 rounded transition-colors"
                  :disabled="!notificationSettings.enabled || !notificationSettings.zapReceived"
                >
                  <IconChevronDown v-if="!expandedSections.zaps" class="w-4 h-4 text-gray-400" />
                  <IconChevronUp v-else class="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          <!-- Expanded Zap Settings -->
          <transition name="expand">
            <div v-if="expandedSections.zaps && notificationSettings.zapReceived" class="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">Minimum Zap Amount (sats)</label>
                <input
                  type="number"
                  v-model.number="notificationSettings.minZapAmount"
                  min="1"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  :disabled="!notificationSettings.enabled"
                />
                <p class="text-xs text-gray-600">Only notify for zaps above this amount</p>
              </div>

              <div class="space-y-2">
                <p class="text-sm font-medium text-gray-700">Notify by Content Type</p>
                <div class="space-y-2">
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="notificationSettings.zapsByCampaign"
                      :disabled="!notificationSettings.enabled"
                      class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span class="text-sm text-gray-700">Campaign zaps</span>
                  </label>
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="notificationSettings.zapsByArticle"
                      :disabled="!notificationSettings.enabled"
                      class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span class="text-sm text-gray-700">Article zaps</span>
                  </label>
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="notificationSettings.zapsByNote"
                      :disabled="!notificationSettings.enabled"
                      class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span class="text-sm text-gray-700">Note zaps</span>
                  </label>
                  <label class="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="notificationSettings.zapsByEvent"
                      :disabled="!notificationSettings.enabled"
                      class="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span class="text-sm text-gray-700">Event zaps</span>
                  </label>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- Zap Sent -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <IconBolt class="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Zaps Sent</h5>
                <p class="text-xs text-gray-600">When you send lightning payments</p>
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

        <!-- Engagements Section -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 flex-1">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <IconHeart class="w-5 h-5 text-blue-600" />
                </div>
                <div class="flex-1">
                  <h5 class="font-medium text-gray-900">Engagements</h5>
                  <p class="text-xs text-gray-600">Replies, reposts, reactions, mentions</p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="notificationSettings.engagements"
                    :disabled="!notificationSettings.enabled"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
                <button
                  @click="toggleSection('engagements')"
                  class="p-1 hover:bg-gray-100 rounded transition-colors"
                  :disabled="!notificationSettings.enabled || !notificationSettings.engagements"
                >
                  <IconChevronDown v-if="!expandedSections.engagements" class="w-4 h-4 text-gray-400" />
                  <IconChevronUp v-else class="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          <!-- Expanded Engagement Settings -->
          <transition name="expand">
            <div v-if="expandedSections.engagements && notificationSettings.engagements" class="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.engagementReplies"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <IconMessageCircle class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Replies to my posts</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.engagementReposts"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <IconMessageCircle class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Reposts</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.engagementReactions"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <IconHeart class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Reactions and likes</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.engagementMentions"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <IconAt class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Mentions in posts</span>
              </label>
            </div>
          </transition>
        </div>

        <!-- Social Section -->
        <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3 flex-1">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <IconUsers class="w-5 h-5 text-purple-600" />
                </div>
                <div class="flex-1">
                  <h5 class="font-medium text-gray-900">Social Activity</h5>
                  <p class="text-xs text-gray-600">Followers and mentions</p>
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="notificationSettings.social"
                    :disabled="!notificationSettings.enabled"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50"></div>
                </label>
                <button
                  @click="toggleSection('social')"
                  class="p-1 hover:bg-gray-100 rounded transition-colors"
                  :disabled="!notificationSettings.enabled || !notificationSettings.social"
                >
                  <IconChevronDown v-if="!expandedSections.social" class="w-4 h-4 text-gray-400" />
                  <IconChevronUp v-else class="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          </div>

          <!-- Expanded Social Settings -->
          <transition name="expand">
            <div v-if="expandedSections.social && notificationSettings.social" class="border-t border-gray-100 bg-gray-50 p-4 space-y-2">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.socialNewFollowers"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <IconUsers class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">New followers</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.socialProfileMentions"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <IconAt class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Profile mentions</span>
              </label>
              <label class="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="notificationSettings.socialTagMentions"
                  :disabled="!notificationSettings.enabled"
                  class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <IconAt class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Tag mentions</span>
              </label>
            </div>
          </transition>
        </div>

        <!-- Balance Changes -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <IconWallet class="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Balance Changes</h5>
                <p class="text-xs text-gray-600">When your wallet balance updates</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.balanceChange"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        <!-- Connection Status -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <IconPlugConnected class="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Connection Status</h5>
                <p class="text-xs text-gray-600">Wallet connection and errors</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.connectionStatus"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>

        <!-- Content & System -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <IconFileText class="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Content & System</h5>
                <p class="text-xs text-gray-600">Publishing and system updates</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="notificationSettings.contentNotifications"
                :disabled="!notificationSettings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Notification Methods -->
      <div class="space-y-4 mt-6">
        <h4 class="font-medium text-gray-900 text-base">Notification Methods</h4>

        <!-- Sound -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <IconVolume v-if="notificationSettings.sound" class="w-5 h-5 text-yellow-600" />
                <IconVolumeOff v-else class="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Sound</h5>
                <p class="text-xs text-gray-600">Play notification sounds</p>
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
              <div class="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <IconDeviceDesktop class="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <h5 class="font-medium text-gray-900">Desktop Notifications</h5>
                <p class="text-xs text-gray-600">
                  Show system notifications
                  <span v-if="desktopPermission === 'denied'" class="text-red-600 font-medium">(Permission denied)</span>
                  <span v-else-if="desktopPermission === 'granted'" class="text-green-600 font-medium">(Enabled)</span>
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
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="space-y-4 mt-6">
        <button
          @click="toggleSection('advanced')"
          class="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <div class="flex items-center space-x-2">
            <IconSettingsIcon class="w-5 h-5 text-gray-600" />
            <h4 class="font-medium text-gray-900">Advanced Settings</h4>
          </div>
          <IconChevronDown v-if="!expandedSections.advanced" class="w-5 h-5 text-gray-400" />
          <IconChevronUp v-else class="w-5 h-5 text-gray-400" />
        </button>

        <transition name="expand">
          <div v-if="expandedSections.advanced" class="space-y-4">
            <!-- Balance Change Threshold -->
            <div class="bg-white rounded-lg border border-gray-200 p-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Balance Change Threshold (sats)</label>
              <input
                type="number"
                v-model.number="notificationSettings.balanceChangeThreshold"
                min="0"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                :disabled="!notificationSettings.enabled || !notificationSettings.balanceChange"
              />
              <p class="text-xs text-gray-600 mt-1">Only notify if balance changes by more than this amount</p>
            </div>

            <!-- Quiet Hours -->
            <div class="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <IconClock class="w-5 h-5 text-gray-600" />
                  <h5 class="font-medium text-gray-900">Quiet Hours</h5>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    v-model="notificationSettings.quietHoursEnabled"
                    :disabled="!notificationSettings.enabled"
                    class="sr-only peer"
                  />
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600 peer-disabled:opacity-50"></div>
                </label>
              </div>

              <div v-if="notificationSettings.quietHoursEnabled" class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    v-model="notificationSettings.quietHoursStart"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
                    :disabled="!notificationSettings.enabled"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    v-model="notificationSettings.quietHoursEnd"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
                    :disabled="!notificationSettings.enabled"
                  />
                </div>
              </div>
              <p class="text-xs text-gray-600">Suppress non-critical notifications during these hours</p>
            </div>
          </div>
        </transition>
      </div>

      <!-- Test Notification -->
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 mt-6">
        <div class="flex items-center justify-between">
          <div>
            <h5 class="font-medium text-gray-900">Test Notifications</h5>
            <p class="text-xs text-gray-600">Send a test notification to verify your settings</p>
          </div>
          <button
            @click="testNotification"
            :disabled="!notificationSettings.enabled"
            class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
          >
            Test
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease-out;
  max-height: 500px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
