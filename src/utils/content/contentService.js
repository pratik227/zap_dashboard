// Mock content service for storing and retrieving full content
// In a real implementation, this would be a backend API

class ContentService {
  constructor() {
    // In-memory storage for demo purposes
    // In production, this would be a database
    this.contentStore = new Map()
    this.paymentVerifications = new Map()
  }

  // Store full content for an article
  storeFullContent(eventId, fullContent) {
    this.contentStore.set(eventId, {
      content: fullContent,
      storedAt: new Date().toISOString(),
      accessedCount: 0
    })
    console.log(`Stored full content for event: ${eventId}`)
  }

  // Retrieve full content after payment verification
  async getFullContent(eventId, paymentProof) {
    const stored = this.contentStore.get(eventId)
    if (!stored) {
      throw new Error('Content not found')
    }

    // In a real implementation, you would verify the payment proof
    // against the Lightning Network or your payment processor
    if (!this.verifyPayment(paymentProof)) {
      throw new Error('Payment verification failed')
    }

    // Increment access count
    stored.accessedCount++
    
    // Handle encrypted content
    if (stored.encryptedContent && stored.encryptionKey) {
      // Import the encryption utility
      const { contentEncryption } = await import('./contentEncryption.js')
      
      // Decrypt the content
      const decryptedContent = await contentEncryption.decryptContent(
        stored.encryptedContent,
        new Uint8Array(stored.encryptionKey)
      )
      
      return {
        content: decryptedContent,
        storedAt: stored.storedAt,
        accessedAt: new Date().toISOString(),
        accessedCount: stored.accessedCount,
        encrypted: true
      }
    }
    
    // Return original content (for backward compatibility)
    return {
      content: stored.content,
      storedAt: stored.storedAt,
      accessedAt: new Date().toISOString(),
      accessedCount: stored.accessedCount,
      encrypted: false
    }
  }

  // Mock payment verification
  // In a real implementation, this would verify against Lightning Network
  verifyPayment(paymentProof) {
    // For demo purposes, accept any payment proof
    // In production, verify the preimage against the invoice
    return paymentProof && paymentProof.preimage
  }

  // Store payment verification
  storePaymentVerification(eventId, paymentProof) {
    this.paymentVerifications.set(eventId, {
      ...paymentProof,
      verifiedAt: new Date().toISOString()
    })
    console.log(`Stored payment verification for event: ${eventId}`)
  }

  // Check if payment was verified for an event
  isPaymentVerified(eventId) {
    return this.paymentVerifications.has(eventId)
  }

  // Get payment verification details
  getPaymentVerification(eventId) {
    return this.paymentVerifications.get(eventId)
  }

  // Clean up old data (for demo purposes)
  cleanup() {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Remove old content (older than 1 day)
    for (const [eventId, data] of this.contentStore.entries()) {
      if (new Date(data.storedAt) < oneDayAgo) {
        this.contentStore.delete(eventId)
      }
    }

    // Remove old payment verifications (older than 1 day)
    for (const [eventId, data] of this.paymentVerifications.entries()) {
      if (new Date(data.verifiedAt) < oneDayAgo) {
        this.paymentVerifications.delete(eventId)
      }
    }
  }
}

// Export singleton instance
export const contentService = new ContentService()

// Clean up old data every hour
setInterval(() => {
  contentService.cleanup()
}, 60 * 60 * 1000)

// Debug function to test encryption
export const testEncryption = async () => {
  const { contentEncryption } = await import('./contentEncryption.js')
  
  const testContent = "This is a test of the encryption system for paid content."
  const key = contentEncryption.generateEncryptionKey()
  
  console.log('🔐 Testing encryption...')
  console.log('Original content:', testContent)
  
  const encrypted = await contentEncryption.encryptContent(testContent, key)
  console.log('Encrypted content:', encrypted)
  
  const decrypted = await contentEncryption.decryptContent(encrypted, key)
  console.log('Decrypted content:', decrypted)
  
  const success = testContent === decrypted
  console.log('✅ Encryption test:', success ? 'PASSED' : 'FAILED')
  
  return success
} 