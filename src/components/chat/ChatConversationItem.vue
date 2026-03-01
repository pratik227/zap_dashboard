<script setup>
import { computed } from 'vue'
import { IconUser, IconBolt } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  conversation: { type: Object, required: true },
  isActive: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const displayName = computed(() => {
  return props.conversation.profile?.name || props.conversation.pubkey?.substring(0, 12) + '...'
})

const timeAgo = computed(() => {
  if (!props.conversation.lastMessageTime) return ''
  const diff = Date.now() - props.conversation.lastMessageTime
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
  return new Date(props.conversation.lastMessageTime).toLocaleDateString()
})

const isLastMessageInvoice = computed(() => {
  if (!props.conversation.lastMessage) return false
  const msg = props.conversation.lastMessage.toLowerCase()
  return msg.startsWith('lnbc') || msg.startsWith('lntb') || msg.startsWith('lnbcrt')
})

const lastMessagePreview = computed(() => {
  if (!props.conversation.lastMessage) return ''
  if (isLastMessageInvoice.value) return null // handled in template
  const msg = props.conversation.lastMessage
  return msg.length > 35 ? msg.substring(0, 35) + '...' : msg
})
</script>

<template>
  <div
    @click="emit('select', conversation)"
    :class="[
      'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 border-b border-gray-50',
      isActive
        ? 'bg-orange-50/80 border-l-[3px] border-l-orange-400 pl-[13px]'
        : 'hover:bg-gray-50/80 border-l-[3px] border-l-transparent pl-[13px]'
    ]"
  >
    <!-- Avatar -->
    <div class="relative flex-shrink-0">
      <div class="w-11 h-11 rounded-full overflow-hidden ring-2 ring-gray-100">
        <img
          v-if="conversation.profile?.picture"
          :src="conversation.profile.picture"
          :alt="displayName"
          class="w-full h-full object-cover"
          @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
        />
        <div
          class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center"
          :style="{ display: conversation.profile?.picture ? 'none' : 'flex' }"
        >
          <IconUser class="w-5 h-5 text-white" />
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between mb-0.5">
        <span :class="[
          'truncate text-[13px]',
          conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
        ]">{{ displayName }}</span>
        <span v-if="timeAgo" class="text-[11px] text-gray-400 flex-shrink-0 ml-2 tabular-nums">{{ timeAgo }}</span>
      </div>
      <div class="flex items-center justify-between gap-2">
        <p :class="[
          'text-[12px] truncate leading-normal',
          conversation.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'
        ]">
          <template v-if="isLastMessageInvoice">
            <span class="inline-flex items-center gap-1">
              <IconBolt class="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span>Lightning Invoice</span>
            </span>
          </template>
          <template v-else-if="lastMessagePreview">{{ lastMessagePreview }}</template>
          <template v-else-if="conversation.profile?.lud16">
            <span class="inline-flex items-center gap-1">
              <IconBolt class="w-3 h-3 text-yellow-500 flex-shrink-0" />
              <span class="truncate">{{ conversation.profile.lud16 }}</span>
            </span>
          </template>
          <template v-else>
            <span class="text-gray-300 italic">No messages yet</span>
          </template>
        </p>
        <!-- Unread badge -->
        <div
          v-if="conversation.unreadCount > 0"
          class="min-w-[20px] h-5 px-1.5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0"
        >
          {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
        </div>
      </div>
    </div>
  </div>
</template>
