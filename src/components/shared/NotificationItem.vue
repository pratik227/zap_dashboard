<script setup>
import {
  IconBell,
  IconBolt,
  IconWallet,
  IconSparkles,
  IconCircleCheck,
  IconAlertCircle,
  IconCalendar,
  IconClock,
  IconX
} from '@iconify-prerendered/vue-tabler'
import * as nip19 from 'nostr-tools/nip19'
import { useNotifications } from '../../composables/core/useNotifications.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const props = defineProps({
  notification: { type: Object, required: true }
})

const emit = defineEmits(['remove'])

const { NOTIFICATION_TYPES } = useNotifications()

const getNotificationIcon = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC: return IconWallet
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR: return IconSparkles
    case NOTIFICATION_TYPES.ZAP_SENT: return IconBolt
    case NOTIFICATION_TYPES.BALANCE_CHANGE: return IconWallet
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS: return IconCircleCheck
    case NOTIFICATION_TYPES.CONNECTION_ERROR:
    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR: return IconAlertCircle
    case NOTIFICATION_TYPES.CALENDAR_INVITE: return IconCalendar
    case NOTIFICATION_TYPES.CALENDAR_EVENT_START: return IconClock
    default: return IconBell
  }
}

const getNotificationColor = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NWC: return 'text-blue-600 bg-blue-50'
    case NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR: return 'text-orange-600 bg-orange-50'
    case NOTIFICATION_TYPES.ZAP_SENT: return 'text-amber-600 bg-amber-50'
    case NOTIFICATION_TYPES.BALANCE_CHANGE: return 'text-blue-600 bg-blue-50'
    case NOTIFICATION_TYPES.CONNECTION_SUCCESS:
    case NOTIFICATION_TYPES.PAYMENT_SUCCESS: return 'text-green-600 bg-green-50'
    case NOTIFICATION_TYPES.CONNECTION_ERROR:
    case NOTIFICATION_TYPES.PAYMENT_ERROR:
    case NOTIFICATION_TYPES.WALLET_ERROR: return 'text-red-600 bg-red-50'
    case NOTIFICATION_TYPES.CALENDAR_INVITE: return 'text-amber-600 bg-amber-50'
    case NOTIFICATION_TYPES.CALENDAR_EVENT_START: return 'text-red-600 bg-red-50'
    default: return 'text-gray-600 bg-gray-50'
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const handleImageError = (e) => {
  e.target.src = generateAvatar(props.notification.data?.sender?.pubkey)
}

const getProfileUrl = (pubkey) => {
  try {
    const npub = nip19.npubEncode(pubkey)
    return `https://primal.net/p/${npub}`
  } catch {
    return null
  }
}

const handleRemove = (e) => {
  e.stopPropagation()
  emit('remove', props.notification.id)
}
</script>

<template>
  <div class="flex items-start gap-3">
    <!-- Unread indicator -->
    <div
      v-if="!notification.read"
      class="absolute left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-amber-200"
    />

    <!-- Icon -->
    <div
      :class="[
        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105',
        getNotificationColor(notification.type),
        !notification.read ? 'ml-3' : ''
      ]"
    >
      <component :is="getNotificationIcon(notification.type)" class="w-5 h-5" />
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-start justify-between gap-2 mb-1">
        <h4 class="text-sm font-semibold text-gray-900 leading-tight">{{ notification.title }}</h4>
        <span class="text-xs text-gray-500 whitespace-nowrap flex-shrink-0 font-medium">
          {{ formatTime(notification.timestamp) }}
        </span>
      </div>
      <p class="text-sm text-gray-600 leading-snug mb-2">{{ notification.message }}</p>

      <!-- Amount badge -->
      <div
        v-if="notification.data?.amount"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700"
      >
        <IconBolt class="w-3.5 h-3.5" />
        <span>{{ notification.data.amount.toLocaleString() }} sats</span>
      </div>

      <!-- Sender info for Nostr zaps -->
      <div
        v-if="notification.data?.sender && notification.type === NOTIFICATION_TYPES.ZAP_RECEIVED_NOSTR"
        class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100"
      >
        <a
          :href="getProfileUrl(notification.data.sender.pubkey)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 hover:opacity-80 transition-opacity"
          @click.stop
        >
          <img
            :src="notification.data.sender.picture || notification.data.sender.avatar || generateAvatar(notification.data.sender.pubkey)"
            :alt="notification.data.sender.name"
            class="w-6 h-6 rounded-full ring-2 ring-white"
            @error="handleImageError"
          />
          <span class="text-xs text-gray-600">
            from <span class="font-semibold text-gray-900 hover:text-amber-600 transition-colors">{{ notification.data.sender.name }}</span>
          </span>
        </a>
      </div>

      <!-- Organizer info for calendar invites -->
      <div
        v-if="notification.data?.organizer && notification.type === NOTIFICATION_TYPES.CALENDAR_INVITE"
        class="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100"
      >
        <a
          :href="getProfileUrl(notification.data.organizer)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 hover:opacity-80 transition-opacity"
          @click.stop
        >
          <img
            :src="notification.data.organizerProfile?.picture || generateAvatar(notification.data.organizer)"
            :alt="notification.data.organizerProfile?.name || 'Organizer'"
            class="w-6 h-6 rounded-full ring-2 ring-white"
            @error="(e) => e.target.src = generateAvatar(notification.data.organizer)"
          />
          <span class="text-xs text-gray-600">
            by <span class="font-semibold text-gray-900 hover:text-amber-600 transition-colors">{{ notification.data.organizerProfile?.name || `user:${notification.data.organizer.substring(0, 8)}` }}</span>
          </span>
        </a>
      </div>
    </div>

    <!-- Remove button -->
    <button
      @click="handleRemove"
      class="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
    >
      <IconX class="w-4 h-4" />
    </button>
  </div>
</template>
