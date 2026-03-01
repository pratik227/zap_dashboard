<script setup>
import { ref, nextTick, watch } from 'vue'
import { IconSend, IconLoader2, IconBolt, IconX } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  walletConnected: { type: Boolean, default: false }
})

const emit = defineEmits(['send', 'send-invoice'])

const content = ref('')
const inputRef = ref(null)
const showInvoiceInput = ref(false)
const invoiceAmount = ref('')

const handleSend = () => {
  if (!content.value.trim() || props.disabled || props.sending) return
  emit('send', content.value)
  content.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleSendInvoice = () => {
  const amount = parseInt(invoiceAmount.value)
  if (!amount || amount <= 0) return
  emit('send-invoice', amount)
  invoiceAmount.value = ''
  showInvoiceInput.value = false
}

const handleInvoiceKeydown = (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSendInvoice()
  }
  if (e.key === 'Escape') {
    showInvoiceInput.value = false
    invoiceAmount.value = ''
  }
}

// Auto-resize textarea
watch(content, () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 120) + 'px'
    }
  })
})

const focus = () => {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-gray-100 bg-white flex-shrink-0">
    <!-- Invoice amount input (slides in) -->
    <div v-if="showInvoiceInput" class="flex items-center gap-2 mb-2.5 animate-slide-in">
      <div class="flex-1 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
        <IconBolt class="w-4 h-4 text-amber-500 flex-shrink-0" />
        <input
          v-model="invoiceAmount"
          type="number"
          min="1"
          placeholder="Amount in sats"
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-amber-400/60 text-gray-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          @keydown="handleInvoiceKeydown"
        />
        <span class="text-[11px] text-amber-500/70 font-medium">sats</span>
      </div>
      <button
        @click="handleSendInvoice"
        :disabled="!invoiceAmount || parseInt(invoiceAmount) <= 0"
        :class="[
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
          invoiceAmount && parseInt(invoiceAmount) > 0
            ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-sm hover:shadow-md active:scale-95'
            : 'bg-gray-100 text-gray-400'
        ]"
        title="Send invoice"
      >
        <IconBolt class="w-4 h-4" />
      </button>
      <button
        @click="showInvoiceInput = false; invoiceAmount = ''"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        <IconX class="w-4 h-4" />
      </button>
    </div>

    <!-- Main input row -->
    <div class="flex items-end gap-2.5">
      <!-- Invoice button (only when wallet connected) -->
      <button
        v-if="walletConnected && !showInvoiceInput"
        @click="showInvoiceInput = true"
        class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-amber-500 hover:bg-amber-50 transition-colors"
        title="Request payment"
      >
        <IconBolt class="w-5 h-5" />
      </button>

      <div class="flex-1 bg-gray-50/80 border border-gray-200/80 rounded-2xl px-4 py-2.5 transition-all duration-200 focus-within:border-orange-300 focus-within:bg-white focus-within:shadow-sm focus-within:ring-2 focus-within:ring-orange-100">
        <textarea
          ref="inputRef"
          v-model="content"
          @keydown="handleKeydown"
          placeholder="Type a message..."
          rows="1"
          class="w-full bg-transparent resize-none text-sm outline-none leading-relaxed max-h-[120px] overflow-y-auto placeholder:text-gray-400"
          :disabled="disabled || sending"
        ></textarea>
      </div>
      <button
        @click="handleSend"
        :disabled="!content.trim() || disabled || sending"
        :class="[
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200',
          content.trim() && !disabled && !sending
            ? 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
            : 'bg-gray-100 text-gray-400'
        ]"
        title="Send message (Enter)"
      >
        <IconLoader2 v-if="sending" class="w-[18px] h-[18px] animate-spin" />
        <IconSend v-else class="w-[18px] h-[18px]" />
      </button>
    </div>
    <p class="text-[10px] text-gray-300 mt-1.5 ml-1 select-none hidden sm:block">
      Enter to send, Shift+Enter for new line
    </p>
  </div>
</template>

<style scoped>
@keyframes slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-slide-in {
  animation: slide-in 0.15s ease-out;
}
</style>
