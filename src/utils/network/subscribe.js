import { nostrRelayManager } from './nostrRelayManager.js'

let subNonce = 0

/**
 * Promise-based subscribe helper with nonce-based dedup bypass.
 * Waits for relay manager to be ready, then collects events.
 * Resolves after EOSE + grace period or hard timeout.
 * @param {Array} filters - Nostr subscription filters
 * @param {Object} opts - { timeout, eoseGrace }
 * @returns {Promise<Array>} collected events
 */
export const subscribe = async (filters, { timeout = 25000, eoseGrace = 3000 } = {}) => {
  await nostrRelayManager.ready()

  return new Promise((resolve) => {
    const events = []
    const seenIds = new Set()

    const hardTimeout = setTimeout(() => {
      sub?.close()
      resolve(events)
    }, timeout)

    const nonce = ++subNonce
    const sub = nostrRelayManager.subscribeToEvents(filters, {
      _nonce: nonce,
      onevent: (event) => {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id)
          events.push(event)
        }
      },
      oneose: () => {
        clearTimeout(hardTimeout)
        setTimeout(() => {
          sub?.close()
          resolve(events)
        }, eoseGrace)
      }
    })
  })
}
