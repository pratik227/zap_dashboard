import { extractAmountFromBolt11, getPaymentHashFromInvoice } from '../wallet/invoiceUtils.js'

/**
 * Single-pass parsing of a kind:9735 zap receipt event.
 * Returns structured zap data or null if unparseable.
 *
 * @param {Object} zapEvent - Raw kind:9735 nostr event
 * @returns {Object|null} Parsed zap receipt
 */
export const parseZapReceipt = (zapEvent) => {
  try {
    const descriptionTag = zapEvent.tags.find(t => t[0] === 'description')
    if (!descriptionTag?.[1]) return null

    const zapRequest = JSON.parse(descriptionTag[1])
    const zapperPubkey = zapRequest.pubkey || zapEvent.pubkey

    // Extract bolt11 invoice
    const bolt11Tag = zapEvent.tags.find(t => t[0] === 'bolt11')
    const bolt11 = bolt11Tag?.[1] || null

    // Extract amount: zap request amount tag first, then bolt11 fallback
    let amount = 0
    const amountTag = zapRequest.tags?.find(t => t[0] === 'amount')
    if (amountTag?.[1]) {
      amount = Math.floor(parseInt(amountTag[1]) / 1000) // msats -> sats
    } else if (bolt11) {
      amount = extractAmountFromBolt11(bolt11)
    }

    // Deduplicate by payment hash when available
    let id = zapEvent.id
    if (bolt11) {
      const paymentHash = getPaymentHashFromInvoice(bolt11)
      if (paymentHash) id = paymentHash
    }

    // Extract zapped event ID from receipt e tag or zap request e tag
    const zappedEventId = zapEvent.tags.find(t => t[0] === 'e')?.[1] ||
                          zapRequest.tags?.find(t => t[0] === 'e')?.[1] || null

    // Extract goal tag from receipt level or zap request level
    const goalTag = zapEvent.tags.find(t => t[0] === 'goal')?.[1] ||
                    zapRequest.tags?.find(t => t[0] === 'goal')?.[1] || null

    const message = zapRequest.content || ''
    const timestamp = new Date(zapEvent.created_at * 1000).toISOString()

    return {
      id,
      amount,
      zapperPubkey,
      zappedEventId,
      goalTag,
      message,
      bolt11,
      timestamp,
      rawZapEvent: zapEvent
    }
  } catch {
    return null
  }
}
