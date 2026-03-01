import {
  NWC,
  NWCWalletError,
  NWCTimeoutError,
  NWCPublishTimeoutError,
  NWCReplyTimeoutError,
  NWCConnectionError,
  NWCDecryptionError
} from 'nostr-core'

// NWC Client singleton
let nwcClient = null

/**
 * Map NWC error types to user-friendly messages.
 * Returns a descriptive string suitable for UI display.
 */
export function getUserFriendlyError(error) {
  if (error instanceof NWCWalletError) {
    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        return 'Insufficient balance. Please top up your wallet.'
      case 'QUOTA_EXCEEDED':
        return 'Spending quota exceeded. Check your wallet limits.'
      case 'NOT_FOUND':
        return 'Invoice or payment not found.'
      case 'PAYMENT_FAILED':
        return 'Payment failed. The invoice may have expired or the recipient is unreachable.'
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment and try again.'
      case 'NOT_IMPLEMENTED':
        return 'This operation is not supported by your wallet.'
      case 'UNAUTHORIZED':
        return 'Wallet authorization failed. Please reconnect your wallet.'
      case 'INTERNAL':
        return 'Wallet encountered an internal error. Please try again.'
      default:
        return error.message || 'Wallet operation failed.'
    }
  }

  if (error instanceof NWCPublishTimeoutError) {
    return 'Could not reach your wallet. Check your internet connection.'
  }

  if (error instanceof NWCReplyTimeoutError) {
    return 'Your wallet did not respond in time. It may be offline or overloaded.'
  }

  if (error instanceof NWCTimeoutError) {
    return 'Request timed out. Your wallet may be offline.'
  }

  if (error instanceof NWCConnectionError) {
    return 'Failed to connect to wallet relay. Please check your connection string.'
  }

  if (error instanceof NWCDecryptionError) {
    return 'Failed to decrypt wallet response. Your connection string may be invalid.'
  }

  return error.message || 'An unknown error occurred.'
}

/**
 * Check if an error is retryable (timeouts, connection issues — not wallet rejections).
 */
function isRetryable(error) {
  if (error instanceof NWCWalletError) return false
  if (error instanceof NWCDecryptionError) return false
  if (error instanceof NWCTimeoutError) return true
  if (error instanceof NWCConnectionError) return true
  if (error.message?.includes('not initialized')) return false
  return true
}

export async function initializeNWC(nwcUrl) {
  if (!nwcUrl) {
    if (nwcClient) {
      nwcClient.close()
    }
    nwcClient = null
    return null
  }

  try {
    nwcClient = new NWC(nwcUrl)
    await nwcClient.connect()
    nwcClient.replyTimeout = 30000
    return nwcClient
  } catch (error) {
    nwcClient = null
    throw error
  }
}

export function getNWCClient() {
  return nwcClient
}

export function closeNWC() {
  if (nwcClient) {
    nwcClient.close()
    nwcClient = null
  }
}

/**
 * Generic retry wrapper for NWC operations.
 * Only retries on transient errors (timeouts, connection issues).
 */
async function withRetry(fn, retryCount = 3) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  let lastError
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === retryCount || !isRetryable(error)) {
        break
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

export async function fetchTransactions(retryCount = 3) {
  return withRetry(async () => {
    const response = await nwcClient.listTransactions({ limit: 100 })
    return response.transactions || []
  }, retryCount)
}

export async function getWalletInfo(retryCount = 3) {
  return withRetry(async () => {
    return await nwcClient.getInfo()
  }, retryCount)
}

export async function getBalance(retryCount = 3) {
  return withRetry(async () => {
    return await nwcClient.getBalance()
  }, retryCount)
}

export async function makeInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  return await nwcClient.makeInvoice({
    amount: params.amount,
    description: params.description || '',
    expiry: params.expiry || 3600
  })
}

export async function payInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  return await nwcClient.payInvoice(params.invoice)
}

export async function lookupInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  return await nwcClient.lookupInvoice({
    payment_hash: params.payment_hash
  })
}
