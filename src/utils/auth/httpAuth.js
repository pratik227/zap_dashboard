/**
 * httpAuth.js — NIP-98 HTTP Auth utilities.
 *
 * Creates authenticated HTTP requests using nostr-core's NIP-98
 * implementation. Used for Blossom uploads and other authenticated
 * HTTP endpoints.
 */

import { nip98 } from '../../services/nostr/nostrImports.js'
import { signerService } from '../../services/nostr/SignerService.js'

/**
 * Create a NIP-98 Authorization header for an HTTP request.
 * @param {string} url — target URL
 * @param {string} method — HTTP method (GET, POST, PUT, DELETE)
 * @param {string} [payload] — optional SHA-256 hash of the request body
 * @returns {Promise<string>} Authorization header value
 */
export async function createAuthHeader(url, method, payload) {
  const template = nip98.createHttpAuthEventTemplate({
    url,
    method,
    body: payload,
  })

  const signedEvent = await signerService.signEvent(template)
  return nip98.getAuthorizationHeader(signedEvent)
}

/**
 * Perform an authenticated fetch using NIP-98.
 * @param {string} url
 * @param {object} [opts] — standard fetch options + { nostrAuth: true }
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase()
  const authHeader = await createAuthHeader(url, method)

  const headers = new Headers(opts.headers || {})
  headers.set('Authorization', authHeader)

  return fetch(url, { ...opts, headers })
}
