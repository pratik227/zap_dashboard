<script setup>
import { IconMessageCircle, IconPlus, IconMessages, IconLock } from '@iconify-prerendered/vue-tabler'

defineProps({
  type: {
    type: String,
    default: 'no-selection',
    validator: (v) => ['no-conversations', 'no-messages', 'no-selection'].includes(v)
  }
})

const emit = defineEmits(['add-connection'])
</script>

<template>
  <div class="flex-1 flex items-center justify-center p-6">
    <div class="text-center max-w-[280px]">
      <!-- No conversations -->
      <template v-if="type === 'no-conversations'">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl shadow-lg shadow-orange-200/50 mb-5">
          <IconMessageCircle class="w-8 h-8 text-white" />
        </div>
        <h4 class="text-lg font-semibold text-gray-900 mb-1.5">Start Messaging</h4>
        <p class="text-[13px] text-gray-500 mb-5 leading-relaxed">
          Add a Nostr contact to start sending encrypted messages
        </p>
        <button
          @click="emit('add-connection')"
          class="btn-primary inline-flex text-sm"
        >
          <IconPlus class="w-4 h-4" />
          <span>New Conversation</span>
        </button>
      </template>

      <!-- No messages in conversation -->
      <template v-else-if="type === 'no-messages'">
        <div class="inline-flex items-center justify-center w-14 h-14 bg-orange-50 rounded-2xl mb-4">
          <IconLock class="w-6 h-6 text-orange-400" />
        </div>
        <h4 class="text-[15px] font-medium text-gray-800 mb-1">End-to-end encrypted</h4>
        <p class="text-[13px] text-gray-400 leading-relaxed">
          Messages are encrypted with NIP-44. Send the first message to start the conversation.
        </p>
      </template>

      <!-- No selection (desktop) -->
      <template v-else>
        <div class="inline-flex items-center justify-center w-20 h-20 bg-gray-50 rounded-3xl mb-5">
          <IconMessages class="w-10 h-10 text-gray-300" />
        </div>
        <h4 class="text-base font-medium text-gray-600 mb-1">Select a conversation</h4>
        <p class="text-[13px] text-gray-400 leading-relaxed">Choose from your contacts on the left to start chatting</p>
      </template>
    </div>
  </div>
</template>
