/**
 * PublishService — unified sign → verify → publish pipeline with retry.
 *
 * All event publishing should go through this service. It provides:
 * - Automatic signing via SignerService
 * - Event verification before publish
 * - Retry with exponential backoff on transient failures
 * - Structured result with success/failure details
 * - Pending event queue for offline/retry scenarios
 */

import { verifyEvent } from './nostrImports.js'
import { nostrService } from './NostrService.js'
import { signerService } from './SignerService.js'

/** @typedef {{ eventId: string, successful: number, failed: number, total: number }} PublishResult */

const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 5000, 10000] // exponential-ish backoff

class PublishService {
  constructor() {
    /** @type {Map<string, { event, template, resolve, reject, retries, lastError }>} */
    this._pending = new Map()
  }

  /**
   * Sign and publish an event template.
   * Handles the full lifecycle: sign → verify → publish → retry.
   *
   * @param {object} template — { kind, content, tags, created_at }
   * @param {object} [opts] — { retries?: number, onRetry?: Function }
   * @returns {Promise<{ event: object, result: PublishResult }>}
   */
  async signAndPublish(template, { retries = MAX_RETRIES, onRetry } = {}) {
    // Ensure created_at is set
    if (!template.created_at) {
      template.created_at = Math.floor(Date.now() / 1000)
    }

    // Sign
    const signedEvent = await signerService.signEvent(template)

    // Verify
    if (!verifyEvent(signedEvent)) {
      throw new PublishError('Event signature verification failed', 'SIGN_FAILED', template)
    }

    // Publish with retry
    return this._publishWithRetry(signedEvent, template, retries, onRetry)
  }

  /**
   * Publish an already-signed event with retry logic.
   * Use this when you've already signed the event yourself.
   *
   * @param {object} signedEvent
   * @param {object} [opts] — { retries?: number, onRetry?: Function }
   * @returns {Promise<{ event: object, result: PublishResult }>}
   */
  async publish(signedEvent, { retries = MAX_RETRIES, onRetry } = {}) {
    if (!verifyEvent(signedEvent)) {
      throw new PublishError('Invalid event signature', 'SIGN_FAILED')
    }
    return this._publishWithRetry(signedEvent, null, retries, onRetry)
  }

  /**
   * Retry publishing a failed event by its ID.
   * @param {string} eventId
   * @returns {Promise<{ event: object, result: PublishResult }>}
   */
  async retry(eventId) {
    const pending = this._pending.get(eventId)
    if (!pending) {
      throw new PublishError('No pending event found with that ID', 'NOT_FOUND')
    }

    return this._publishWithRetry(pending.event, pending.template, MAX_RETRIES)
  }

  /**
   * Get all pending (failed) events that can be retried.
   * @returns {Array<{ eventId, kind, createdAt, lastError }>}
   */
  getPending() {
    return Array.from(this._pending.entries()).map(([id, entry]) => ({
      eventId: id,
      kind: entry.event.kind,
      createdAt: entry.event.created_at,
      lastError: entry.lastError,
    }))
  }

  /**
   * Remove a pending event (give up on retry).
   */
  removePending(eventId) {
    this._pending.delete(eventId)
  }

  /**
   * Clear all pending events.
   */
  clearPending() {
    this._pending.clear()
  }

  // ── Internal ────────────────────────────────────────────────────

  async _publishWithRetry(signedEvent, template, maxRetries, onRetry) {
    let lastError = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await nostrService.publish(signedEvent)

        if (result.successful === 0) {
          throw new PublishError(
            `Published to 0/${result.total} relays`,
            'ALL_RELAYS_FAILED',
            template
          )
        }

        // Success — remove from pending if it was there
        this._pending.delete(signedEvent.id)

        return { event: signedEvent, result }
      } catch (err) {
        lastError = err

        // Don't retry signature or validation errors
        if (err.code === 'SIGN_FAILED') throw err

        // Don't retry on last attempt
        if (attempt >= maxRetries) break

        // Notify about retry
        const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]
        onRetry?.({ attempt: attempt + 1, maxRetries, delay, error: err.message })

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted — store for manual retry
    this._pending.set(signedEvent.id, {
      event: signedEvent,
      template,
      retries: maxRetries,
      lastError: lastError?.message || 'Unknown error',
    })

    throw new PublishError(
      lastError?.message || 'Failed to publish after retries',
      'PUBLISH_FAILED',
      template,
      { eventId: signedEvent.id, retries: maxRetries }
    )
  }
}

/**
 * Structured publish error with error code and context.
 */
export class PublishError extends Error {
  /**
   * @param {string} message
   * @param {string} code — 'SIGN_FAILED' | 'ALL_RELAYS_FAILED' | 'PUBLISH_FAILED' | 'NOT_FOUND'
   * @param {object} [template] — original event template
   * @param {object} [meta] — additional context
   */
  constructor(message, code, template, meta) {
    super(message)
    this.name = 'PublishError'
    this.code = code
    this.template = template
    this.meta = meta
  }

  /** User-friendly error message */
  get userMessage() {
    switch (this.code) {
      case 'SIGN_FAILED':
        return 'Failed to sign the event. Please check your signer connection.'
      case 'ALL_RELAYS_FAILED':
        return 'Could not deliver to any relay. Check your connection and try again.'
      case 'PUBLISH_FAILED':
        return 'Publishing failed after multiple attempts. You can retry from the pending queue.'
      default:
        return this.message
    }
  }
}

// Singleton
export const publishService = new PublishService()
