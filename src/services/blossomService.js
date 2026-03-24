/**
 * Blossom Service - Core API for decentralized media uploads
 *
 * Delegates to nostr-core's blossom helpers for hashing, auth headers,
 * listing, mirroring, and deletion. Retains XHR-based upload for progress
 * tracking (nostr-core's uploadBlob uses fetch, which lacks upload progress).
 *
 * Auth event creation uses blossom.createAuthEventTemplate() + an external
 * signEvent callback so it works with NIP-07 / NIP-46 signers (no secret key).
 */

import { blossom } from './nostr/nostrImports.js'
import { storageService } from './StorageService.js'

export const DEFAULT_BLOSSOM_SERVERS = [
  'https://blossom.band',
  'https://nostr.build',
  'https://cdn.satellite.earth'
]

export const BLOSSOM_MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const STORAGE_KEY = 'blossom_servers'

/**
 * Compute SHA-256 hex digest of a file using nostr-core's blossom.getBlobHash.
 * @param {File|Blob} file
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
export async function computeHash(file) {
  const buffer = await file.arrayBuffer()
  return blossom.getBlobHash(new Uint8Array(buffer))
}

/**
 * Create a kind 24242 Blossom auth event and sign it via an external signer.
 *
 * Uses blossom.createAuthEventTemplate() for the event structure, then
 * delegates signing to the provided signEvent callback (NIP-07 / NIP-46 compatible).
 *
 * @param {string} content - Description of the action
 * @param {string} action - Blossom action: 'upload', 'delete', or 'list'
 * @param {string} _pubkey - Hex pubkey (unused — signer fills this in)
 * @param {Function} signEvent - Signer callback (e.g. signerService.signEvent)
 * @param {string} [hash] - SHA-256 hash for upload/delete
 * @returns {Promise<object|null>} Signed event object, or null on failure
 */
export async function signBlossomAuth(content, action, _pubkey, signEvent, hash = null) {
  const expiration = Math.floor(Date.now() / 1000) + 300 // 5 minutes

  const template = blossom.createAuthEventTemplate({
    action,
    expiration,
    content,
    hashes: hash ? [hash] : undefined
  })

  const signed = await signEvent(template)
  return signed || null
}

/**
 * Upload a file to a blossom server via XHR (for progress tracking).
 *
 * Uses blossom.getAuthorizationHeader() to encode the signed auth event.
 * XHR is retained instead of blossom.uploadBlob() because fetch does not
 * expose upload progress events.
 *
 * @param {string} server - Blossom server URL
 * @param {File|Blob} file - File to upload
 * @param {string} hash - SHA-256 hex hash of the file
 * @param {object|null} authEvent - Signed kind 24242 event
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @returns {Promise<object>} Server response with url
 */
export function upload(server, file, hash, authEvent, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `${server.replace(/\/$/, '')}/upload`)

    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    if (authEvent) {
      xhr.setRequestHeader('Authorization', blossom.getAuthorizationHeader(authEvent))
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({ url: `${server}/${hash}` })
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload network error')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

    xhr.send(file)
  })
}

/**
 * Upload to first server, then mirror to remaining servers in parallel.
 * Mirroring uses nostr-core's blossom.mirrorBlob().
 */
export async function uploadToAll(file, servers, pubkey, signEvent, onProgress) {
  if (!servers.length) throw new Error('No servers configured')

  const hash = await computeHash(file)

  // Upload to primary server (XHR for progress)
  const primaryServer = servers[0]
  const uploadAuth = await signBlossomAuth('Upload file', 'upload', pubkey, signEvent, hash)
  const result = await upload(primaryServer, file, hash, uploadAuth, onProgress)

  const primaryUrl = result.url || `${primaryServer}/${hash}`
  const urls = [primaryUrl]
  const successServers = [primaryServer]

  // Mirror to remaining servers via nostr-core
  if (servers.length > 1) {
    const mirrorResults = await Promise.allSettled(
      servers.slice(1).map(async (server) => {
        const mirrorAuth = await signBlossomAuth('Mirror file', 'upload', pubkey, signEvent, hash)
        await blossom.mirrorBlob(server, primaryUrl, mirrorAuth)
        const mirrorUrl = `${server.replace(/\/$/, '')}/${hash}`
        return { server, url: mirrorUrl }
      })
    )

    for (const r of mirrorResults) {
      if (r.status === 'fulfilled') {
        urls.push(r.value.url)
        successServers.push(r.value.server)
      }
    }
  }

  return {
    hash,
    url: primaryUrl,
    urls,
    servers: successServers,
    size: file.size,
    type: file.type,
    created: Math.floor(Date.now() / 1000)
  }
}

/**
 * List files from a blossom server using nostr-core's blossom.listBlobs().
 */
export async function list(server, pubkey, signEvent) {
  // blossom.listBlobs() does not support auth headers — it's a public GET.
  // If the server requires auth, fall back to manual fetch with auth.
  if (signEvent) {
    const authEvent = await signBlossomAuth('List files', 'list', pubkey, signEvent)
    if (authEvent) {
      // Manual fetch with auth header (listBlobs doesn't accept auth)
      const resp = await fetch(`${server.replace(/\/$/, '')}/list/${pubkey}`, {
        headers: { 'Authorization': blossom.getAuthorizationHeader(authEvent) }
      })
      if (!resp.ok) throw new Error(`List failed: ${resp.status}`)
      return resp.json()
    }
  }

  // No auth needed — use nostr-core directly
  return blossom.listBlobs(server, pubkey)
}

/**
 * Delete a file from a blossom server using nostr-core's blossom.deleteBlob().
 * @param {string} server - Blossom server URL
 * @param {string} hash - SHA-256 hex hash
 * @param {object} authEvent - Signed kind 24242 event
 */
export async function deleteFile(server, hash, authEvent) {
  await blossom.deleteBlob(server, hash, authEvent)
  return true
}

/**
 * Get configured blossom servers from storage or defaults
 */
export function getConfiguredServers() {
  const parsed = storageService.get(STORAGE_KEY, null)
  if (Array.isArray(parsed) && parsed.length > 0) return parsed
  return [...DEFAULT_BLOSSOM_SERVERS]
}

/**
 * Save configured servers to storage
 */
export function setConfiguredServers(servers) {
  storageService.set(STORAGE_KEY, servers)
}
