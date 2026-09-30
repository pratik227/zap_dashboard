import { generateSecretKey, finalizeEvent, getPublicKey } from '../../services/nostr/nostrImports.js'
import { nip04 } from '../../services/nostr/nostrImports.js'

// Content encryption utility for paid content
export class ContentEncryption {
  constructor() {
    this.algorithm = 'AES-GCM'
    this.keyLength = 256
  }

  // Generate a random encryption key
  generateEncryptionKey() {
    return crypto.getRandomValues(new Uint8Array(32))
  }

  // Encrypt content with a symmetric key
  async encryptContent(content, encryptionKey) {
    try {
      // Generate a random IV (Initialization Vector)
      const iv = crypto.getRandomValues(new Uint8Array(12))
      
      // Import the encryption key
      const key = await crypto.subtle.importKey(
        'raw',
        encryptionKey,
        { name: this.algorithm },
        false,
        ['encrypt']
      )

      // Convert content to Uint8Array
      const contentBytes = new TextEncoder().encode(content)

      // Encrypt the content
      const encryptedContent = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        contentBytes
      )

      // Combine IV and encrypted content
      const combined = new Uint8Array(iv.length + encryptedContent.byteLength)
      combined.set(iv)
      combined.set(new Uint8Array(encryptedContent), iv.length)

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined))
    } catch (error) {
      console.error('Encryption failed:', error)
      throw new Error('Failed to encrypt content')
    }
  }

  // Decrypt content with the symmetric key
  async decryptContent(encryptedContent, encryptionKey) {
    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedContent).split('').map(char => char.charCodeAt(0))
      )

      // Extract IV and encrypted content
      const iv = combined.slice(0, 12)
      const encrypted = combined.slice(12)

      // Import the decryption key
      const key = await crypto.subtle.importKey(
        'raw',
        encryptionKey,
        { name: this.algorithm },
        false,
        ['decrypt']
      )

      // Decrypt the content
      const decryptedBytes = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encrypted
      )

      // Convert back to string
      return new TextDecoder().decode(decryptedBytes)
    } catch (error) {
      console.error('Decryption failed:', error)
      throw new Error('Failed to decrypt content')
    }
  }

  // Encrypt content for a specific recipient (using their public key)
  async encryptForRecipient(content, recipientPublicKey, senderPrivateKey) {
    try {
      // Generate a random symmetric key for content encryption
      const contentKey = this.generateEncryptionKey()
      
      // Encrypt the content with the symmetric key
      const encryptedContent = await this.encryptContent(content, contentKey)
      
      // Encrypt the symmetric key for the recipient using NIP-04
      const encryptedKey = await nip04.encrypt(senderPrivateKey, recipientPublicKey, JSON.stringify({
        key: Array.from(contentKey),
        timestamp: Date.now()
      }))

      return {
        encryptedContent,
        encryptedKey,
        contentKey: Array.from(contentKey) // For storage/transmission
      }
    } catch (error) {
      console.error('Recipient encryption failed:', error)
      throw new Error('Failed to encrypt content for recipient')
    }
  }

  // Decrypt content that was encrypted for a specific recipient
  async decryptForRecipient(encryptedContent, encryptedKey, recipientPrivateKey, senderPublicKey) {
    try {
      // Decrypt the symmetric key
      const keyData = await nip04.decrypt(recipientPrivateKey, senderPublicKey, encryptedKey)
      const { key } = JSON.parse(keyData)
      
      // Decrypt the content with the symmetric key
      const content = await this.decryptContent(encryptedContent, new Uint8Array(key))
      
      return content
    } catch (error) {
      console.error('Recipient decryption failed:', error)
      throw new Error('Failed to decrypt content for recipient')
    }
  }

  // Generate a content access token (for paid content)
  generateAccessToken(eventId, userPubkey, timestamp) {
    const data = `${eventId}:${userPubkey}:${timestamp}`
    return btoa(data)
  }

  // Verify content access token
  verifyAccessToken(token, eventId, userPubkey, maxAge = 24 * 60 * 60 * 1000) {
    try {
      const data = atob(token)
      const [tokenEventId, tokenPubkey, timestamp] = data.split(':')
      
      if (tokenEventId !== eventId || tokenPubkey !== userPubkey) {
        return false
      }
      
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      
      if (now - tokenTime > maxAge) {
        return false
      }
      
      return true
    } catch (error) {
      return false
    }
  }
}

// Export singleton instance
export const contentEncryption = new ContentEncryption() 