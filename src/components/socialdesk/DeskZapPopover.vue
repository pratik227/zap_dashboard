<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { IconX, IconBolt, IconLoader, IconWallet } from '@iconify-prerendered/vue-tabler'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import { useNostrConnections } from '../../composables/core/useNostrConnections.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { makeZapRequest, getZapEndpoint, fetchZapInvoice } from '../../services/nostr/nostrImports.js'
import { payInvoice } from '../../utils/wallet/nwcClient.js'
import { nostrService } from '../../services/nostr/NostrService.js'

const props = defineProps({
  post: { type: Object, required: true }
})

const emit = defineEmits(['close', 'sent'])

const { isWalletConnected } = useNostrConnections()

const selectedAmount = ref(21)
const customAmount = ref('')
const zapMessage = ref('')
const isSending = ref(false)
const zapStep = ref('') // '' | 'profile' | 'invoice' | 'paying' | 'confirming'
const error = ref('')
let cancelled = false
const modalRef = ref(null)
const showRef = ref(true)
useFocusTrap(showRef, modalRef)

const PRESET_AMOUNTS = [21, 100, 500, 1000, 5000]

const effectiveAmount = computed(() => {
  if (customAmount.value) {
    const parsed = parseInt(customAmount.value)
    return isNaN(parsed) || parsed <= 0 ? 0 : parsed
  }
  return selectedAmount.value
})

const canSend = computed(() =>
  isWalletConnected.value && effectiveAmount.value > 0 && !isSending.value
)

const recipientName = computed(() =>
  props.post.profile?.display_name
  || props.post.profile?.name
  || props.post.rawEvent?.pubkey?.slice(0, 8) + '...'
)

function selectPreset(amount) {
  selectedAmount.value = amount
  customAmount.value = ''
}

async function sendZap() {
  if (!canSend.value) return
  error.value = ''
  isSending.value = true

  const amount = effectiveAmount.value

  try {
    const rawEvent = props.post.rawEvent
    if (!rawEvent) throw new Error('Post data not available')
    const pubkey = rawEvent.pubkey

    // Step 1: Fetch recipient profile
    zapStep.value = 'profile'
    const profile = await profileService.get(pubkey)
    if (cancelled) return
    if (!profile) throw new Error('Could not load recipient profile')

    const profileEvent = {
      content: JSON.stringify({ lud16: profile.lud16, lud06: profile.lud06 })
    }

    const zapEndpoint = await getZapEndpoint(profileEvent)
    if (cancelled) return
    if (!zapEndpoint) throw new Error('Recipient has no Lightning address set up for zaps')

    // Step 2: Create invoice
    zapStep.value = 'invoice'
    const connectedRelays = nostrService.getConnectedRelays?.() || []
    const relays = connectedRelays.map(r => r.url).filter(Boolean)

    const zapRequestTemplate = makeZapRequest({
      profile: pubkey,
      event: rawEvent.id,
      amount: amount * 1000,
      relays: relays.slice(0, 5),
      comment: zapMessage.value.trim()
    })

    const invoice = await fetchZapInvoice(zapEndpoint, {
      amount: amount * 1000,
      zapRequest: JSON.stringify(zapRequestTemplate)
    })
    if (cancelled) return
    if (!invoice) throw new Error('Failed to get Lightning invoice')

    // Step 3: Pay — this is irreversible, don't allow cancel from here
    zapStep.value = 'paying'
    await payInvoice({ invoice })

    // Only emit if user hasn't closed the popover during the async flow
    if (!cancelled) {
      emit('sent', amount)
    }
  } catch (err) {
    if (!cancelled) {
      error.value = getUserFriendlyError(err)
    }
  } finally {
    isSending.value = false
    zapStep.value = ''
  }
}

function handleClose() {
  // Block close during irreversible payment step
  if (zapStep.value === 'paying') return
  cancelled = true
  emit('close')
}

onBeforeUnmount(() => {
  cancelled = true
  zapStep.value = ''
})

const stepLabel = computed(() => {
  switch (zapStep.value) {
    case 'profile': return 'Looking up recipient...'
    case 'invoice': return 'Creating invoice...'
    case 'paying': return 'Sending payment...'
    default: return 'Sending...'
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="modalRef"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zap-dialog-title"
      @click.self="handleClose"
      @keydown.escape="handleClose"
      tabindex="-1"
    >
      <div class="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <IconBolt class="w-4 h-4 text-orange-500" />
            <h3 id="zap-dialog-title" class="text-sm font-semibold text-gray-900">Zap {{ recipientName }}</h3>
          </div>
          <button
            @click="handleClose"
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close zap"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>

        <div class="p-4 space-y-4">
          <!-- Not connected warning -->
          <div v-if="!isWalletConnected" class="px-3 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div class="flex items-start gap-2">
              <IconWallet class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p class="text-xs text-amber-800 font-medium">Wallet not connected</p>
                <p class="text-xs text-amber-600 mt-0.5">Connect your Lightning wallet in Settings to send zaps.</p>
              </div>
            </div>
          </div>

          <!-- Amount presets -->
          <div v-else>
            <label class="text-xs font-medium text-gray-500 mb-2 block">Amount (sats)</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="amount in PRESET_AMOUNTS"
                :key="amount"
                @click="selectPreset(amount)"
                :class="[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 border',
                  selectedAmount === amount && !customAmount
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                ]"
              >
                {{ amount.toLocaleString() }}
              </button>
            </div>

            <!-- Custom amount -->
            <div class="mt-3">
              <input
                v-model="customAmount"
                type="number"
                min="1"
                placeholder="Custom amount"
                class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
                @focus="selectedAmount = 0"
              />
            </div>

            <!-- Optional message -->
            <div class="mt-3">
              <input
                v-model="zapMessage"
                type="text"
                placeholder="Add a message (optional)"
                maxlength="140"
                class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
                @keyup.enter="sendZap"
              />
            </div>

            <!-- Error -->
            <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>

            <!-- Send button -->
            <button
              @click="sendZap"
              :disabled="!canSend"
              :class="[
                'w-full mt-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-150',
                canSend
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              ]"
            >
              <IconLoader v-if="isSending" class="w-4 h-4 animate-spin" />
              <IconBolt v-else class="w-4 h-4" />
              {{ isSending ? stepLabel : `Zap ${effectiveAmount > 0 ? effectiveAmount.toLocaleString() + ' sats' : ''}` }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
