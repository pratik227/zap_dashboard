import {
  parseZapReceipt as coreParseZapReceipt,
  validateZapReceipt as coreValidateZapReceipt,
} from '../../services/nostr/nostrImports.js'
import { getPaymentHashFromInvoice } from '../wallet/invoiceUtils.js'

/**
 * Parse a kind:9735 zap receipt event.
 *
 * Wraps nostr-core's parseZapReceipt and extends it with:
 * - Payment-hash based deduplication (id = paymentHash when available)
 * - Goal tag extraction
 * - ISO timestamp
 * - Raw event reference
 *
 * @param {Object} zapEvent - Raw kind:9735 nostr event
 * @returns {Object|null} Parsed zap receipt
 */
export const parseZapReceipt = (zapEvent) => {
  try {
    // Use nostr-core for spec-correct parsing
    const parsed = coreParseZapReceipt(zapEvent)
    if (!parsed) return null

    // nostr-core returns: { recipientPubkey, senderPubkey, eventId, amount, bolt11, description, preimage }
    // amount is in msats in nostr-core, convert to sats
    const amountSats = typeof parsed.amount === 'number'
      ? Math.floor(parsed.amount / 1000)
      : 0

    // Deduplicate by payment hash when available
    let id = zapEvent.id
    if (parsed.bolt11) {
      const paymentHash = getPaymentHashFromInvoice(parsed.bolt11)
      if (paymentHash) id = paymentHash
    }

    // Extract goal tag and message from zap request description
    let goalTag = zapEvent.tags.find(t => t[0] === 'goal')?.[1] || null
    let message = ''
    try {
      const descTag = zapEvent.tags.find(t => t[0] === 'description')
      if (descTag?.[1]) {
        const zapRequest = JSON.parse(descTag[1])
        message = zapRequest.content || ''
        if (!goalTag) {
          goalTag = zapRequest.tags?.find(t => t[0] === 'goal')?.[1] || null
        }
      }
    } catch {
      // skip parse errors
    }

    return {
      id,
      amount: amountSats,
      zapperPubkey: parsed.senderPubkey || zapEvent.pubkey,
      zappedEventId: parsed.eventId || null,
      goalTag,
      message,
      bolt11: parsed.bolt11 || null,
      timestamp: new Date(zapEvent.created_at * 1000).toISOString(),
      rawZapEvent: zapEvent,
    }
  } catch {
    return null
  }
}

/**
 * Validate a zap receipt using nostr-core's spec-correct validation.
 * @param {Object} receiptEvent - kind:9735 event
 * @param {Object} [requestEvent] - optional zap request event to cross-check
 * @returns {boolean}
 */
export const validateZapReceipt = (receiptEvent, requestEvent) => {
  try {
    return coreValidateZapReceipt(receiptEvent, requestEvent)
  } catch {
    return false
  }
}
