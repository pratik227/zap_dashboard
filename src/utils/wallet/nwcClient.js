import { nwc } from '@getalby/sdk'

// NWC Client singleton
let nwcClient = null

// List of reliable Nostr relays as fallbacks
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine'
]

export function initializeNWC(nwcUrl) {
  // Clear existing client if no URL provided
  if (!nwcUrl) {
    nwcClient = null
    return null
  }
  
  try {
    nwcClient = new nwc.NWCClient({
      nostrWalletConnectUrl: nwcUrl,
      relayUrls: DEFAULT_RELAYS
    })
    console.info('NWC Client initialized successfully with fallback relays')
    return nwcClient
  } catch (error) {
    console.error('Failed to initialize NWC Client:', error)
    nwcClient = null
    throw error
  }
}

export function getNWCClient() {
  return nwcClient
}

export async function fetchTransactions(retryCount = 3) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  let lastError
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Fetching transactions (attempt ${attempt}/${retryCount})...`)
      const response = await nwcClient.listTransactions({
        limit: 100,
        timeout: 30000 // 30 seconds timeout
      })
      
      console.log(`Successfully fetched ${response.transactions?.length || 0} transactions`)
      return response.transactions || []
    } catch (error) {
      console.warn(`Transaction fetch attempt ${attempt} failed:`, error.message)
      lastError = error
      
      // Don't retry on the last attempt or for certain error types
      if (attempt === retryCount || error.message.includes('not initialized')) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  console.error('Failed to fetch transactions after all retries:', lastError)
  throw lastError
}

export async function getWalletInfo(retryCount = 3) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  let lastError
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Getting wallet info (attempt ${attempt}/${retryCount})...`)
      const info = await nwcClient.getInfo()
      console.log('Successfully retrieved wallet info')
      return info
    } catch (error) {
      console.warn(`Wallet info attempt ${attempt} failed:`, error.message)
      lastError = error
      
      // Don't retry on the last attempt or for certain error types
      if (attempt === retryCount || error.message.includes('not initialized')) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  console.error('Failed to get wallet info after all retries:', lastError)
  throw lastError
}

export async function getBalance(retryCount = 3) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  let lastError
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Getting balance (attempt ${attempt}/${retryCount})...`)
      const balance = await nwcClient.getBalance()
      console.log('Successfully retrieved balance')
      return balance
    } catch (error) {
      console.warn(`Balance fetch attempt ${attempt} failed:`, error.message)
      lastError = error
      
      // Don't retry on the last attempt or for certain error types
      if (attempt === retryCount || error.message.includes('not initialized')) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
      console.log(`Retrying in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  console.error('Failed to get balance after all retries:', lastError)
  throw lastError
}

export async function makeInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const invoice = await nwcClient.makeInvoice({
      amount: params.amount, // Amount in millisats
      description: params.description || '',
      expiry: params.expiry || 3600 // Default 1 hour expiry
    })
    return invoice
  } catch (error) {
    console.error('Failed to create invoice:', error)
    throw error
  }
}

export async function payInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const payment = await nwcClient.payInvoice({
      invoice: params.invoice
    })
    return payment
  } catch (error) {
    console.error('Failed to pay invoice:', error)
    throw error
  }
}

export async function lookupInvoice(params) {
  if (!nwcClient) {
    throw new Error('NWC Client not initialized')
  }

  try {
    const invoice = await nwcClient.lookupInvoice({
      payment_hash: params.payment_hash
    })
    return invoice
  } catch (error) {
    console.error('Failed to lookup invoice:', error)
    throw error
  }
}
