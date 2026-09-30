/**
 * WalletService — full NWC wallet abstraction powered by nostr-core.
 *
 * Primary interface for all wallet operations. Wraps nwcClient.js for
 * connection lifecycle and adds all nostr-core NWC capabilities:
 * - Balance, info, budget queries
 * - Invoice creation, lookup, payment
 * - Lightning Address & keysend payments
 * - Fiat-denominated payments & conversion
 * - Real-time payment notifications
 * - Message signing
 */

import {
  initializeNWC, closeNWC, getNWCClient,
  fetchTransactions, getWalletInfo, getBalance,
  makeInvoice, payInvoice, lookupInvoice,
  payLightningAddress, isLightningAddress, stripLightningPrefix,
  getUserFriendlyError
} from '../../utils/wallet/nwcClient.js'

import {
  getExchangeRate,
  fiatToSats,
  satsToFiat,
} from './nostrImports.js'

class WalletService {

  constructor() {
    /** @type {(() => void)|null} notification unsubscribe handle */
    this._notificationUnsub = null
  }

  // ── Connection ──────────────────────────────────────────────────

  /**
   * Connect to a wallet via NWC URL.
   * @param {string} nwcUrl — nostr+walletconnect:// URL
   * @returns {Promise<object>} NWC client instance
   */
  async connect(nwcUrl) {
    if (!nwcUrl) {
      this.disconnect()
      return null
    }
    return initializeNWC(nwcUrl)
  }

  /**
   * Disconnect the active wallet and clean up notifications.
   */
  disconnect() {
    this.unsubscribeNotifications()
    closeNWC()
  }

  /**
   * Check if a wallet is currently connected.
   */
  get isConnected() {
    return getNWCClient() !== null
  }

  // ── Wallet Info ─────────────────────────────────────────────────

  /**
   * Get wallet info (alias, pubkey, network, supported methods, etc.)
   */
  async getInfo(retries = 3) {
    return getWalletInfo(retries)
  }

  /**
   * Get wallet balance in msats.
   */
  async getBalance(retries = 3) {
    return getBalance(retries)
  }

  /**
   * Get wallet spending budget info.
   * @returns {Promise<{used_budget?, total_budget?, renews_at?, renewal_period?}>}
   */
  async getBudget() {
    const client = getNWCClient()
    if (!client) throw new Error('NWC Client not initialized')
    return client.getBudget()
  }

  // ── Transactions ────────────────────────────────────────────────

  /**
   * List recent transactions.
   * @param {object} [params] — { from?, until?, limit?, offset?, unpaid?, type? }
   */
  async listTransactions(params) {
    if (params && typeof params === 'object' && !('retries' in params)) {
      // Direct params mode — pass through to NWC client
      const client = getNWCClient()
      if (!client) throw new Error('NWC Client not initialized')
      const response = await client.listTransactions(params)
      return response.transactions || []
    }
    // Legacy mode: retries count
    return fetchTransactions(typeof params === 'number' ? params : 3)
  }

  // ── Payments ────────────────────────────────────────────────────

  /**
   * Pay a BOLT-11 invoice.
   * @param {string} invoice — BOLT-11 invoice string
   * @param {number} [amount] — amount in msats (for amountless invoices)
   * @returns {Promise<{preimage, fees_paid?}>}
   */
  async payInvoice(invoice, amount) {
    const client = getNWCClient()
    if (!client) throw new Error('NWC Client not initialized')
    return client.payInvoice(invoice, amount)
  }

  /**
   * Pay a Lightning Address by resolving to invoice first.
   * @param {string} address — user@domain
   * @param {number} amountSats
   * @returns {Promise<{preimage, fees_paid?, invoice?}>}
   */
  async payLightningAddress(address, amountSats) {
    return payLightningAddress(address, amountSats)
  }

  /**
   * Pay a Lightning Address with fiat amount (auto-converts to sats).
   * @param {string} address — user@domain
   * @param {number} fiatAmount — amount in fiat currency
   * @param {string} currency — ISO currency code (e.g., 'USD', 'EUR')
   * @returns {Promise<{preimage, fees_paid?, sats?, invoice?, rate?}>}
   */
  async payLightningAddressFiat(address, fiatAmount, currency) {
    const client = getNWCClient()
    if (!client) throw new Error('NWC Client not initialized')
    return client.payLightningAddressFiat(address, fiatAmount, currency)
  }

  /**
   * Keysend payment (direct node payment without invoice).
   * @param {object} params — { amount, pubkey, preimage?, tlv_records? }
   * @returns {Promise<{preimage, fees_paid?}>}
   */
  async payKeysend(params) {
    const client = getNWCClient()
    if (!client) throw new Error('NWC Client not initialized')
    return client.payKeysend(params)
  }

  /**
   * Create a BOLT-11 invoice.
   * @param {object} params — { amount, description?, description_hash?, expiry? }
   * @returns {Promise<Transaction>}
   */
  async makeInvoice(params) {
    return makeInvoice(params)
  }

  /**
   * Look up an invoice by payment hash or invoice string.
   * @param {object} params — { payment_hash? | invoice? }
   * @returns {Promise<Transaction>}
   */
  async lookupInvoice(params) {
    return lookupInvoice(params)
  }

  // ── Message Signing (NIP-47) ──────────────────────────────────

  /**
   * Sign a message via the connected wallet.
   * @param {string} message
   * @returns {Promise<{message, signature}>}
   */
  async signMessage(message) {
    const client = getNWCClient()
    if (!client) throw new Error('NWC Client not initialized')
    return client.signMessage(message)
  }

  // ── Notifications ─────────────────────────────────────────────

  /**
   * Subscribe to real-time wallet notifications.
   * @param {function} handler — called with notification event
   * @param {string[]} [types] — notification types to listen for
   *   Supported: 'payment_received', 'payment_sent', 'hold_invoice_accepted'
   * @returns {Promise<void>}
   */
  async subscribeNotifications(handler, types) {
    this.unsubscribeNotifications()

    const client = getNWCClient()
    if (!client) throw new Error('NWC Client not initialized')

    this._notificationUnsub = await client.subscribeNotifications(handler, types)
  }

  /**
   * Unsubscribe from wallet notifications.
   */
  unsubscribeNotifications() {
    if (this._notificationUnsub) {
      this._notificationUnsub()
      this._notificationUnsub = null
    }
  }

  // ── Fiat Conversion ───────────────────────────────────────────

  /**
   * Get current exchange rate for a currency.
   * @param {string} currency — ISO currency code (e.g., 'USD', 'EUR')
   * @returns {Promise<{rate, currency, timestamp}>}
   */
  async getExchangeRate(currency) {
    return getExchangeRate(currency)
  }

  /**
   * Convert fiat amount to sats.
   * @param {number} amount — fiat amount
   * @param {string} currency — ISO currency code
   * @returns {Promise<{sats, rate, currency}>}
   */
  async fiatToSats(amount, currency) {
    return fiatToSats(amount, currency)
  }

  /**
   * Convert sats to fiat amount.
   * @param {number} sats
   * @param {string} currency — ISO currency code
   * @returns {Promise<{amount, rate, currency}>}
   */
  async satsToFiat(sats, currency) {
    return satsToFiat(sats, currency)
  }
}

// ── Static utilities (no instance needed) ─────────────────────────
export { isLightningAddress, stripLightningPrefix, getUserFriendlyError }

// Singleton
export const walletService = new WalletService()
