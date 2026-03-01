<script setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import ChatMessageBubble from './ChatMessageBubble.vue'
import ChatDaySeparator from './ChatDaySeparator.vue'
import ChatEmptyState from './ChatEmptyState.vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  currentUserPubkey: { type: String, default: '' },
  conversationProfile: { type: Object, default: null },
  walletConnected: { type: Boolean, default: false }
})

const containerRef = ref(null)

// Group messages by day and compute bubble shape flags
const groupedItems = computed(() => {
  const items = []
  let currentDay = null

  for (let i = 0; i < props.messages.length; i++) {
    const msg = props.messages[i]
    const msgDate = new Date(msg.timestamp)
    const msgDay = msgDate.toDateString()

    // Day separator
    if (msgDay !== currentDay) {
      items.push({ type: 'separator', date: msgDate, key: 'sep-' + msgDay })
      currentDay = msgDay
    }

    const isOutgoing = msg.sender === props.currentUserPubkey
    const prevMsg = i > 0 ? props.messages[i - 1] : null
    const nextMsg = i < props.messages.length - 1 ? props.messages[i + 1] : null

    // Same sender grouping (within same day)
    const prevSameSender = prevMsg && prevMsg.sender === msg.sender &&
      new Date(prevMsg.timestamp).toDateString() === msgDay
    const nextSameSender = nextMsg && nextMsg.sender === msg.sender &&
      new Date(nextMsg.timestamp).toDateString() === msgDay

    const isFirstInGroup = !prevSameSender
    const isLastInGroup = !nextSameSender

    items.push({
      type: 'message',
      data: msg,
      isOutgoing,
      showAvatar: !isOutgoing && isLastInGroup,
      isFirstInGroup,
      isLastInGroup,
      key: msg.id
    })
  }
  return items
})

const scrollToBottom = (smooth = false) => {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTo({
        top: containerRef.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      })
    }
  })
}

watch(() => props.messages.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    scrollToBottom(true)
  }
})

onMounted(() => {
  scrollToBottom()
})

defineExpose({ scrollToBottom })
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4 chat-messages-bg"
  >
    <ChatEmptyState v-if="messages.length === 0" type="no-messages" />
    <template v-else>
      <template v-for="item in groupedItems" :key="item.key">
        <ChatDaySeparator v-if="item.type === 'separator'" :date="item.date" />
        <ChatMessageBubble
          v-else
          :message="item.data"
          :is-outgoing="item.isOutgoing"
          :show-avatar="item.showAvatar"
          :is-first-in-group="item.isFirstInGroup"
          :is-last-in-group="item.isLastInGroup"
          :avatar-url="conversationProfile?.picture"
          :wallet-connected="walletConnected"
        />
      </template>
      <!-- Bottom padding so last message isn't flush against input -->
      <div class="h-2"></div>
    </template>
  </div>
</template>

<style scoped>
.chat-messages-bg {
  background-color: #fafaf9;
  background-image: radial-gradient(circle at 20% 50%, rgba(251, 146, 60, 0.03) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.03) 0%, transparent 50%);
}

/* Scrollbar */
.chat-messages-bg::-webkit-scrollbar {
  width: 5px;
}
.chat-messages-bg::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages-bg::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}
.chat-messages-bg::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}
</style>
