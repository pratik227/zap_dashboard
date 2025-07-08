// Map NWC transaction data to our application's zap data structure
export function mapTransactionToZap(transaction, index) {
  // Use payment_hash as the primary identifier for deduplication
  const id = transaction.payment_hash || transaction.id || `tx-${index}`
  
  // Generate dynamic sender info based on transaction data
  const transactionHash = id
  const senderKey = transactionHash.substring(0, 8)

  // Create dynamic sender info
  const sender = {
    name: `User_${senderKey}`,
    pubkey: `npub1${senderKey}...`,
    nip05: null,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${senderKey}&backgroundColor=b6e3f4,c0aede,d1d4f9`
  }

  // Use actual transaction description or generate based on transaction type
  const note = transaction.description ||
    (transaction.type === 'outgoing' ? 'Payment sent' : 'Payment received')

  // Generate dynamic client and note type based on transaction data
  const clients = ['damus', 'amethyst', 'iris', 'snort', 'nostrudel']
  const noteTypes = ['original', 'reply', 'repost']

  // Use transaction hash to deterministically select client and note type
  const hashSum = transactionHash.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const client = clients[hashSum % clients.length]
  const noteType = noteTypes[hashSum % noteTypes.length]
  
  return {
    id: id, // Consistent ID for deduplication
    amount: Math.floor(transaction.amount / 1000), // Convert from msats to sats
    timestamp: transaction.settled_at ? new Date(transaction.settled_at * 1000).toISOString() : new Date().toISOString(),
    sender,
    note,
    noteType,
    client,
    type: transaction.type || 'incoming', // Add transaction type (incoming/outgoing)
    engagement: {
      replies: Math.floor(Math.random() * 30),
      reposts: Math.floor(Math.random() * 20),
      likes: Math.floor(Math.random() * 50)
    }
  }
}

export function processTransactions(transactions) {
  // Create a Set to track processed payment hashes
  const processedHashes = new Set() 
  
  return transactions
    .filter(tx => {
      // Only include incoming settled transactions
      if (tx.type !== 'incoming' || tx.state !== 'settled') {
        return false
      }
      
      // Check if we've already processed this payment hash
      const paymentHash = tx.payment_hash || tx.id
      if (paymentHash && processedHashes.has(paymentHash)) {
        console.log(`Skipping duplicate transaction with hash ${paymentHash?.substring(0, 16)}...`)
        return false
      }
      
      // Add to processed set and include this transaction
      if (paymentHash) {
        processedHashes.add(paymentHash)
      }
      return true
    })
    .map((tx, index) => mapTransactionToZap(tx, index))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}
