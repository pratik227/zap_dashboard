<script setup>
import { computed } from 'vue'
import { IconUser, IconCheck, IconAlertCircle, IconLoader2, IconLock } from '@iconify-prerendered/vue-tabler'
import ChatInvoiceCard from './ChatInvoiceCard.vue'

const props = defineProps({
  message: { type: Object, required: true },
  isOutgoing: { type: Boolean, default: false },
  showAvatar: { type: Boolean, default: false },
  avatarUrl: { type: String, default: null },
  isFirstInGroup: { type: Boolean, default: false },
  isLastInGroup: { type: Boolean, default: false },
  walletConnected: { type: Boolean, default: false }
})

const emit = defineEmits(['invoice-paid'])

const formattedTime = computed(() => {
  const date = new Date(props.message.timestamp)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
})

const isEncryptError = computed(() => {
  return props.message.content === '[Encrypted message - unable to decrypt]'
})

const statusIcon = computed(() => {
  if (!props.isOutgoing) return null
  switch (props.message.status) {
    case 'sending': return 'sending'
    case 'failed': return 'failed'
    default: return 'sent'
  }
})

// Parse message content into segments: text and invoices
const contentSegments = computed(() => {
  const content = props.message.content || ''
  // Match BOLT11 invoices (lnbc, lntb, lnbcrt)
  const invoiceRegex = /(ln(?:bc|tb|bcrt)[a-zA-Z0-9]+)/gi
  const segments = []
  let lastIndex = 0
  let match

  while ((match = invoiceRegex.exec(content)) !== null) {
    // Only treat as invoice if it's long enough (real invoices are 100+ chars)
    if (match[1].length < 50) continue

    if (match.index > lastIndex) {
      const text = content.substring(lastIndex, match.index).trim()
      if (text) segments.push({ type: 'text', content: text })
    }
    segments.push({ type: 'invoice', content: match[1] })
    lastIndex = match.index + match[1].length
  }

  if (lastIndex < content.length) {
    const text = content.substring(lastIndex).trim()
    if (text) segments.push({ type: 'text', content: text })
  }

  return segments.length ? segments : [{ type: 'text', content }]
})

const hasInvoice = computed(() => contentSegments.value.some(s => s.type === 'invoice'))
</script>

<template>
  <div :class="[
    'flex gap-2',
    isOutgoing ? 'justify-end' : 'justify-start',
    isFirstInGroup ? 'mt-3' : 'mt-0.5'
  ]">
    <!-- Avatar spacer / avatar (received only) -->
    <div v-if="!isOutgoing" class="w-8 flex-shrink-0 self-end">
      <div v-if="showAvatar" class="w-8 h-8 rounded-full overflow-hidden ring-1 ring-gray-100">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          class="w-full h-full object-cover"
          @error="$event.target.style.display = 'none'; $event.target.nextElementSibling.style.display = 'flex'"
        />
        <div
          class="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center"
          :style="{ display: avatarUrl ? 'none' : 'flex' }"
        >
          <IconUser class="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    </div>

    <div class="max-w-[75%] sm:max-w-[70%] lg:max-w-[65%]">
      <!-- Content segments -->
      <template v-for="(segment, idx) in contentSegments" :key="idx">
        <!-- Invoice card -->
        <ChatInvoiceCard
          v-if="segment.type === 'invoice'"
          :invoice="segment.content"
          :is-outgoing="isOutgoing"
          :wallet-connected="walletConnected"
          :class="idx > 0 ? 'mt-1.5' : ''"
          @paid="emit('invoice-paid', $event)"
        />

        <!-- Decrypt error bubble -->
        <div
          v-else-if="isEncryptError"
          class="px-3.5 py-2.5 rounded-2xl bg-gray-50 border border-gray-200/80 text-gray-500"
          :class="idx > 0 ? 'mt-1' : ''"
        >
          <div class="flex items-center gap-2">
            <IconLock class="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div>
              <p class="text-[13px] font-medium text-gray-600 leading-tight">Unable to read this message</p>
              <p class="text-[11px] text-gray-400 leading-snug mt-0.5">Encrypted with a different key or protocol version</p>
            </div>
          </div>
        </div>

        <!-- Text bubble -->
        <div
          v-else
          :class="[
            'px-3.5 py-2 text-[14px] leading-relaxed break-words whitespace-pre-wrap',
            idx > 0 ? 'mt-1' : '',
            isOutgoing
              ? [
                  'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm',
                  isFirstInGroup && isLastInGroup && !hasInvoice ? 'rounded-2xl rounded-br-lg' :
                  isFirstInGroup ? 'rounded-2xl rounded-br-md' :
                  isLastInGroup && !hasInvoice ? 'rounded-2xl rounded-tr-md' :
                  'rounded-xl rounded-r-md'
                ]
              : [
                  'bg-white border border-gray-100/80 text-gray-800 shadow-sm',
                  isFirstInGroup && isLastInGroup && !hasInvoice ? 'rounded-2xl rounded-bl-lg' :
                  isFirstInGroup ? 'rounded-2xl rounded-bl-md' :
                  isLastInGroup && !hasInvoice ? 'rounded-2xl rounded-tl-md' :
                  'rounded-xl rounded-l-md'
                ]
          ]"
        >
          {{ segment.content }}
        </div>
      </template>

      <!-- Timestamp + status -->
      <div v-if="isLastInGroup" :class="[
        'flex items-center gap-1 mt-1 px-1',
        isOutgoing ? 'justify-end' : 'justify-start'
      ]">
        <span class="text-[10px] text-gray-400 leading-none">{{ formattedTime }}</span>
        <template v-if="statusIcon">
          <IconLoader2 v-if="statusIcon === 'sending'" class="w-3 h-3 text-gray-300 animate-spin" />
          <IconCheck v-else-if="statusIcon === 'sent'" class="w-3 h-3 text-gray-400" />
          <IconAlertCircle v-else-if="statusIcon === 'failed'" class="w-3 h-3 text-red-400" />
        </template>
      </div>
    </div>
  </div>
</template>
