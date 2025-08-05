// Utility functions for basic BOLT11 invoice parsing
// Note: This is a simplified parser for display purposes only

export function parseInvoiceBasic(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return null
  }

  try {
    // Basic BOLT11 invoice structure: ln + network + amount + checksum
    const invoiceLower = invoice.toLowerCase()
    
    // Check if it's a valid Lightning invoice
    if (!invoiceLower.startsWith('lnbc') && !invoiceLower.startsWith('lntb') && !invoiceLower.startsWith('lnbcrt')) {
      return null
    }

    // Extract network
    let network = 'mainnet'
    if (invoiceLower.startsWith('lntb')) {
      network = 'testnet'
    } else if (invoiceLower.startsWith('lnbcrt')) {
      network = 'regtest'
    }

    // Extract amount (simplified - this is not a complete implementation)
    let amount = null
    let amountUnit = 'sats'
    
    // Look for amount pattern after network prefix
    const amountMatch = invoiceLower.match(/^ln[a-z]+(\d+)([munp]?)/)
    if (amountMatch) {
      const amountValue = parseInt(amountMatch[1])
      const unit = amountMatch[2]
      
      // Convert to sats based on unit
      switch (unit) {
        case 'm': // milli-bitcoin (0.001 BTC)
          amount = amountValue * 100000 // 100,000 sats per mBTC
          break
        case 'u': // micro-bitcoin (0.000001 BTC)
          amount = amountValue * 100 // 100 sats per μBTC
          break
        case 'n': // nano-bitcoin (0.000000001 BTC)
          amount = Math.round(amountValue * 0.1) // 0.1 sats per nBTC
          break
        case 'p': // pico-bitcoin (0.000000000001 BTC)
          amount = Math.round(amountValue * 0.0001) // 0.0001 sats per pBTC
          break
        default:
          // No unit means the amount is in the smallest unit (millisatoshis for mainnet)
          amount = Math.floor(amountValue / 1000) // Convert msats to sats
      }
    }

    // Extract timestamp (simplified)
    const timestampMatch = invoice.match(/(\d{10})/)
    let timestamp = null
    if (timestampMatch) {
      timestamp = new Date(parseInt(timestampMatch[1]) * 1000)
    }

    return {
      network,
      amount,
      amountUnit,
      timestamp,
      raw: invoice,
      isValid: true
    }
  } catch (error) {
    console.warn('Failed to parse invoice:', error)
    return null
  }
}

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

export function validateInvoice(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return { isValid: false, error: 'Invalid invoice format' }
  }

  const invoiceLower = invoice.toLowerCase()
  
  if (!invoiceLower.startsWith('ln')) {
    return { isValid: false, error: 'Invoice must start with "ln"' }
  }

  if (invoice.length < 50) {
    return { isValid: false, error: 'Invoice too short' }
  }

  if (invoice.length > 2000) {
    return { isValid: false, error: 'Invoice too long' }
  }

  return { isValid: true }
}

export function truncateInvoice(invoice, maxLength = 50) {
  if (!invoice) return ''
  if (invoice.length <= maxLength) return invoice
  
  const start = Math.floor(maxLength / 2) - 2
  const end = Math.floor(maxLength / 2) - 2
  
  return `${invoice.substring(0, start)}...${invoice.substring(invoice.length - end)}`
}

/**
 * Extract payment hash from a BOLT11 invoice
 * @param {string} invoice - BOLT11 invoice string
 * @returns {string|null} - Payment hash or null if not found
 */
export function getPaymentHashFromInvoice(invoice) {
  if (!invoice || typeof invoice !== 'string') {
    return null
  }
  
  try {
    // BOLT11 invoices encode the payment hash in a tag with prefix 'p'
    // The format is typically base32 encoded and appears after removing the human-readable part

    // First, check if it's a valid Lightning invoice
    if (!invoice.toLowerCase().startsWith('ln')) {
      return null
    }

    // Simple regex-based extraction - this is a simplified approach
    // In production, you would use a full BOLT11 decoder library
    const paymentHashRegex = /p([a-fA-F0-9]{64})/
    const match = invoice.match(paymentHashRegex)

    if (match && match[1]) {
      return match[1]
    }

    // Alternative approach: look for payment hash in the data part
    // This is a fallback and less reliable than a proper decoder
    const parts = invoice.split('1')
    if (parts.length > 1) {
      // Look for a 64-character hex string that could be a payment hash
      const hexHashRegex = /([a-fA-F0-9]{64})/
      const hexMatch = parts[1].match(hexHashRegex)
      if (hexMatch && hexMatch[1]) {
        return hexMatch[1]
      }
    }

    // If we can't find it with simple methods, generate a deterministic hash from the invoice
    // This ensures we at least have a consistent ID for deduplication
    return generateDeterministicHashFromInvoice(invoice)

  } catch (error) {
    console.warn('Failed to extract payment hash from invoice:', error)
    return null
  }
}

/**
 * Generate a deterministic hash from an invoice when we can't extract the actual payment hash
 * @param {string} invoice - BOLT11 invoice string
 * @returns {string} - Deterministic hash
 */
function generateDeterministicHashFromInvoice(invoice) {
  // Use a simple hash function to generate a consistent ID
  let hash = 0
  for (let i = 0; i < invoice.length; i++) {
    const char = invoice.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // Convert to hex string and ensure it's 64 characters
  const hexHash = Math.abs(hash).toString(16).padStart(16, '0')
  return hexHash.repeat(4).substring(0, 64)
}

/**
 * Extract amount from a BOLT11 invoice (basic implementation)
 * @param {string} bolt11 - BOLT11 invoice string
 * @returns {number} - Amount in sats
 */
export function extractAmountFromBolt11(bolt11) {
  try {
    // Very basic bolt11 parsing - in production use a proper library
    const match = bolt11.match(/lnbc(\d+)([munp]?)/)
    if (match) {
      const amount = parseInt(match[1])
      const unit = match[2]
      
      switch (unit) {
        case 'm': return amount * 100000 // mBTC to sats
        case 'u': return amount * 100    // μBTC to sats
        case 'n': return Math.round(amount * 0.1) // nBTC to sats
        case 'p': return Math.round(amount * 0.0001) // pBTC to sats
        default: return Math.floor(amount / 1000) // msats to sats
      }
    }
    return 0
  } catch (error) {
    return 0
  }
}