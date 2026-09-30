/**
 * Utility functions for BOLT-11 invoice parsing.
 *
 * Uses nostr-core's bolt11.decode() (currently shimmed via light-bolt11-decoder)
 * instead of fragile manual regex extraction.
 */
import { bolt11 } from '../../services/nostr/nostrImports.js'

/**
 * Parse a BOLT-11 invoice and return a summary object.
 * Return shape is backwards-compatible with the legacy regex parser.
 *
 * @param {string} invoice - BOLT-11 invoice string
 * @returns {{ network: string, amount: number|null, amountUnit: string,
 *             timestamp: Date|null, raw: string, isValid: boolean,
 *             description: string|null, isExpired: boolean } | null}
 */
export function parseInvoiceBasic(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return null
  }

  try {
    const decoded = bolt11.decode(invoice)

    // Derive network from the prefix (light-bolt11-decoder validates it for us)
    const lower = invoice.toLowerCase()
    let network = 'mainnet'
    if (lower.startsWith('lntb')) network = 'testnet'
    else if (lower.startsWith('lnbcrt')) network = 'regtest'

    return {
      network,
      amount: decoded.amountSat,
      amountUnit: 'sats',
      timestamp: decoded.timestamp != null ? new Date(decoded.timestamp * 1000) : null,
      raw: invoice,
      isValid: true,
      description: decoded.description,
      isExpired: decoded.isExpired,
    }
  } catch (error) {
    console.warn('Failed to parse invoice:', error)
    return null
  }
}

/**
 * Format a sat amount for display.
 * @param {number} amount - Amount in sats
 * @returns {string}
 */
export function formatInvoiceAmount(amount) {
  if (!amount || amount === 0) return '0 sats'

  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)} BTC`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k sats`
  } else {
    return `${amount.toLocaleString()} sats`
  }
}

/**
 * Validate a BOLT-11 invoice string.
 * Now delegates to bolt11.decode() for real validation instead of length checks.
 *
 * @param {string} invoice
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateInvoice(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return { isValid: false, error: 'Invalid invoice format' }
  }

  const lower = invoice.toLowerCase()
  if (!lower.startsWith('ln')) {
    return { isValid: false, error: 'Invoice must start with "ln"' }
  }

  try {
    bolt11.decode(invoice)
    return { isValid: true }
  } catch (err) {
    return { isValid: false, error: err.message || 'Failed to decode invoice' }
  }
}

/**
 * Truncate an invoice for display.
 * @param {string} invoice
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateInvoice(invoice, maxLength = 50) {
  if (!invoice) return ''
  if (invoice.length <= maxLength) return invoice

  const start = Math.floor(maxLength / 2) - 2
  const end = Math.floor(maxLength / 2) - 2

  return `${invoice.substring(0, start)}...${invoice.substring(invoice.length - end)}`
}

/**
 * Extract payment hash from a BOLT-11 invoice.
 * @param {string} invoice - BOLT-11 invoice string
 * @returns {string|null} - Payment hash hex string, or null
 */
export function getPaymentHashFromInvoice(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return null
  }

  try {
    const decoded = bolt11.decode(invoice)
    return decoded.paymentHash || null
  } catch (error) {
    console.warn('Failed to extract payment hash from invoice:', error)
    return null
  }
}

/**
 * Extract amount from a BOLT-11 invoice.
 * @param {string} invoiceStr - BOLT-11 invoice string
 * @returns {number} - Amount in sats (0 if unknown)
 */
export function extractAmountFromBolt11(invoiceStr) {
  try {
    const decoded = bolt11.decode(invoiceStr)
    return decoded.amountSat ?? 0
  } catch {
    return 0
  }
}
