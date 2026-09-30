/**
 * Typed error classes for the Nostr service layer.
 *
 * Services throw these; composables catch and set user-friendly messages.
 * Each error has a `code` for programmatic handling and a `userMessage`
 * getter for UI display.
 */

// ── Relay Errors ────────────────────────────────────────────────

export class RelayError extends Error {
  constructor(message, relay = null, code = 'RELAY_ERROR') {
    super(message)
    this.name = 'RelayError'
    this.relay = relay
    this.code = code
  }

  get userMessage() {
    switch (this.code) {
      case 'NO_RELAYS': return 'No relays connected. Check your internet connection.'
      case 'ALL_FAILED': return 'All relays failed. Please try again.'
      case 'CONNECTION_FAILED': return `Could not connect to relay${this.relay ? ` ${this.relay}` : ''}.`
      case 'TIMEOUT': return 'Relay connection timed out.'
      default: return this.message
    }
  }
}

// ── Signer / Auth Errors ────────────────────────────────────────

export class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR') {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }

  get userMessage() {
    switch (this.code) {
      case 'NO_EXTENSION': return 'No Nostr extension found. Install Jump by Buho (from the ZapTracker founders), Alby, nos2x, or Flamingo.'
      case 'NO_SIGNER': return 'No signer connected. Please log in first.'
      case 'SIGN_REJECTED': return 'Signing was rejected. Please approve in your signer.'
      case 'REMOTE_TIMEOUT': return 'Remote signer did not respond. Check your signer app.'
      case 'REMOTE_REJECTED': return 'Connection was rejected by the remote signer.'
      case 'SESSION_EXPIRED': return 'Your session has expired. Please log in again.'
      default: return this.message
    }
  }
}

export class SignerError extends Error {
  constructor(message, code = 'SIGNER_ERROR') {
    super(message)
    this.name = 'SignerError'
    this.code = code
  }

  get userMessage() {
    switch (this.code) {
      case 'NO_EXTENSION': return 'No Nostr extension found. Install Jump by Buho (from the ZapTracker founders), Alby, nos2x, or Flamingo.'
      case 'SIGN_REJECTED': return 'Signing was rejected by your extension.'
      default: return this.message
    }
  }
}

// ── Subscription Errors ─────────────────────────────────────────

export class SubscriptionError extends Error {
  constructor(message, filter = null, code = 'SUBSCRIPTION_ERROR') {
    super(message)
    this.name = 'SubscriptionError'
    this.filter = filter
    this.code = code
  }

  get userMessage() {
    return 'Failed to load data from relays. Please try refreshing.'
  }
}

// ── Outbox Errors ───────────────────────────────────────────────

export class OutboxError extends Error {
  constructor(message, code = 'OUTBOX_ERROR') {
    super(message)
    this.name = 'OutboxError'
    this.code = code
  }

  get userMessage() {
    switch (this.code) {
      case 'NO_RELAY_LIST': return 'Could not find relay list for this user.'
      case 'FETCH_FAILED': return 'Failed to fetch data from user\'s relays.'
      default: return this.message
    }
  }
}

// ── Storage Errors ──────────────────────────────────────────────

export class StorageError extends Error {
  constructor(message, key = null, code = 'STORAGE_ERROR') {
    super(message)
    this.name = 'StorageError'
    this.key = key
    this.code = code
  }

  get userMessage() {
    switch (this.code) {
      case 'QUOTA_EXCEEDED': return 'Storage is full. Please clear some data.'
      case 'PARSE_ERROR': return 'Saved data is corrupted. It has been reset.'
      default: return 'Failed to save data locally.'
    }
  }
}

// ── Unified Error Mapper ────────────────────────────────────────

/**
 * Map any error to a user-friendly message string.
 * Works with typed errors (uses .userMessage) and generic errors.
 *
 * @param {Error} error
 * @returns {string} user-friendly message
 */
export function getUserFriendlyError(error) {
  if (!error) return 'An unexpected error occurred.'

  // Typed errors with userMessage getter
  if (error.userMessage) return error.userMessage

  // NWC errors (from nostr-core)
  if (error.name === 'NWCWalletError') {
    const code = error.code
    if (code === 'INSUFFICIENT_BALANCE') return 'Insufficient balance. Please top up your wallet.'
    if (code === 'QUOTA_EXCEEDED') return 'Spending quota exceeded. Check your wallet limits.'
    if (code === 'PAYMENT_FAILED') return 'Payment failed. The invoice may have expired.'
    if (code === 'RATE_LIMITED') return 'Too many requests. Please wait a moment.'
    if (code === 'UNAUTHORIZED') return 'Wallet authorization failed. Please reconnect.'
    return error.message || 'Wallet operation failed.'
  }
  if (error.name === 'NWCTimeoutError' || error.name === 'NWCPublishTimeoutError') {
    return 'Could not reach your wallet. Check your internet connection.'
  }
  if (error.name === 'NWCReplyTimeoutError') {
    return 'Your wallet did not respond in time. It may be offline.'
  }
  if (error.name === 'NWCConnectionError') {
    return 'Failed to connect to wallet relay. Check your connection string.'
  }
  if (error.name === 'NWCDecryptionError') {
    return 'Failed to decrypt wallet response. Your connection string may be invalid.'
  }

  // NIP-46 errors
  if (error.name === 'Nip46TimeoutError') return 'Remote signer timed out. Check your signer app.'
  if (error.name === 'Nip46ConnectionError') return 'Could not connect to remote signer.'
  if (error.name === 'Nip46RemoteError') return 'Remote signer returned an error.'

  // Generic patterns
  const msg = error.message?.toLowerCase() || ''
  if (msg.includes('no signer') || msg.includes('not connected')) return 'Please log in first.'
  if (msg.includes('timeout')) return 'Request timed out. Please try again.'
  if (msg.includes('rate limit') || msg.includes('rate_limited')) return 'Rate limited. Please wait a moment.'
  if (msg.includes('no relays') || msg.includes('no write') || msg.includes('no read')) return 'No relays connected. Check your connection.'
  if (msg.includes('network') || msg.includes('fetch')) return 'Network error. Check your internet connection.'

  return error.message || 'An unexpected error occurred.'
}
