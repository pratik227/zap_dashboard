<script setup>
import { ref, computed } from 'vue'
import { IconBolt, IconLoader2, IconCheck, IconChevronDown, IconChevronUp, IconCopy, IconAlertCircle } from '@iconify-prerendered/vue-tabler'
import QRCodeVue3 from 'qrcode-vue3'
import { parseInvoiceBasic, formatInvoiceAmount, truncateInvoice } from '../../utils/wallet/invoiceUtils.js'
import { payInvoice, getUserFriendlyError } from '../../utils/wallet/nwcClient.js'

const props = defineProps({
  invoice: { type: String, required: true },
  isOutgoing: { type: Boolean, default: false },
  walletConnected: { type: Boolean, default: false }
})

const emit = defineEmits(['paid'])

const showQR = ref(false)
const isPaying = ref(false)
const isPaid = ref(false)
const payError = ref('')
const copied = ref(false)

const parsed = computed(() => parseInvoiceBasic(props.invoice))
const amountDisplay = computed(() => {
  if (!parsed.value?.amount) return 'Unknown amount'
  return formatInvoiceAmount(parsed.value.amount)
})
const handlePay = async () => {
  if (isPaying.value || isPaid.value || !props.walletConnected) return
  isPaying.value = true
  payError.value = ''
  try {
    await payInvoice({ invoice: props.invoice })
    isPaid.value = true
    emit('paid', props.invoice)
  } catch (e) {
    payError.value = getUserFriendlyError(e)
    setTimeout(() => { payError.value = '' }, 4000)
  } finally {
    isPaying.value = false
  }
}

const copyInvoice = async () => {
  try {
    await navigator.clipboard.writeText(props.invoice)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* ignore */ }
}
</script>

<template>
  <div class="w-full max-w-[280px]">
    <!-- Invoice card -->
    <div :class="[
      'rounded-2xl overflow-hidden border',
      isOutgoing
        ? 'bg-white/15 border-white/20'
        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-orange-200/60'
    ]">
      <!-- Header -->
      <div :class="[
        'px-3.5 py-2.5 flex items-center gap-2',
        isOutgoing ? 'border-b border-white/15' : 'border-b border-orange-200/40'
      ]">
        <div :class="[
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
          isOutgoing ? 'bg-white/20' : 'bg-orange-400'
        ]">
          <IconBolt :class="['w-3.5 h-3.5', isOutgoing ? 'text-white' : 'text-white']" />
        </div>
        <div class="flex-1 min-w-0">
          <div :class="['text-[11px] font-medium leading-none', isOutgoing ? 'text-white/70' : 'text-orange-600/70']">
            Lightning Invoice
          </div>
          <div :class="['text-[15px] font-bold leading-tight mt-0.5', isOutgoing ? 'text-white' : 'text-gray-900']">
            {{ amountDisplay }}
          </div>
        </div>
        <!-- Status badge -->
        <div v-if="isPaid" class="flex items-center gap-1 bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full">
          <IconCheck class="w-3 h-3" />
          <span class="text-[10px] font-semibold">Paid</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-3 py-2.5 flex items-center gap-2">
        <!-- Pay button (only for received invoices with wallet connected) -->
        <button
          v-if="!isOutgoing && walletConnected && !isPaid"
          @click.stop="handlePay"
          :disabled="isPaying"
          :class="[
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[13px] font-semibold transition-all',
            isPaying
              ? 'bg-orange-100 text-orange-400 cursor-wait'
              : 'bg-gradient-to-r from-orange-400 to-amber-400 text-white hover:from-orange-500 hover:to-amber-500 active:scale-[0.97] shadow-sm'
          ]"
        >
          <IconLoader2 v-if="isPaying" class="w-3.5 h-3.5 animate-spin" />
          <IconBolt v-else class="w-3.5 h-3.5" />
          {{ isPaying ? 'Paying...' : 'Pay Invoice' }}
        </button>

        <!-- No wallet hint -->
        <div v-if="!isOutgoing && !walletConnected && !isPaid" class="flex-1 py-1.5 text-center">
          <p class="text-[11px] text-gray-400">No wallet connected</p>
          <p class="text-[10px] text-gray-300 leading-snug">Use QR code or copy to pay externally</p>
        </div>

        <!-- Sent invoice status -->
        <div v-if="isOutgoing && !isPaid" class="flex-1 py-1.5 text-center">
          <p :class="['text-[11px]', isOutgoing ? 'text-white/60' : 'text-gray-400']">
            Awaiting payment
          </p>
          <p :class="['text-[10px] leading-snug', isOutgoing ? 'text-white/40' : 'text-gray-300']">
            Share QR code so they can pay
          </p>
        </div>

        <!-- QR toggle -->
        <button
          @click.stop="showQR = !showQR"
          :class="[
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
            isOutgoing
              ? 'hover:bg-white/15 text-white/70 hover:text-white'
              : 'hover:bg-orange-100 text-orange-500 hover:text-orange-600'
          ]"
          title="Show QR code"
        >
          <IconChevronUp v-if="showQR" class="w-4 h-4" />
          <IconChevronDown v-else class="w-4 h-4" />
        </button>

        <!-- Copy button -->
        <button
          @click.stop="copyInvoice"
          :class="[
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
            isOutgoing
              ? 'hover:bg-white/15 text-white/70 hover:text-white'
              : 'hover:bg-orange-100 text-orange-500 hover:text-orange-600'
          ]"
          :title="copied ? 'Copied!' : 'Copy invoice'"
        >
          <IconCheck v-if="copied" class="w-4 h-4 text-green-500" />
          <IconCopy v-else class="w-4 h-4" />
        </button>
      </div>

      <!-- Error -->
      <div v-if="payError" class="px-3 pb-2">
        <div class="flex items-center gap-1.5 text-[11px] text-red-500 bg-red-50 rounded-lg px-2.5 py-1.5">
          <IconAlertCircle class="w-3 h-3 flex-shrink-0" />
          <span class="truncate">{{ payError }}</span>
        </div>
      </div>

      <!-- QR Code (expandable) -->
      <div v-if="showQR" :class="[
        'px-3 pb-3 pt-1 border-t',
        isOutgoing ? 'border-white/15' : 'border-orange-200/40'
      ]">
        <div class="bg-white rounded-xl p-3 flex flex-col items-center">
          <QRCodeVue3
            :value="invoice"
            :size="180"
            color="#000000"
            background-color="#ffffff"
            error-correction-level="M"
          />
          <p class="text-[10px] text-gray-400 mt-2 font-mono text-center break-all leading-relaxed">
            {{ truncateInvoice(invoice, 60) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
