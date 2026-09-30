/**
 * StorageService — centralized localStorage abstraction.
 *
 * All localStorage access should go through this service.
 * Provides:
 * - JSON serialization/deserialization with error safety
 * - Debounced writes to avoid localStorage thrashing
 * - Centralized cleanup for logout/reset
 * - Key registry from constants.js
 */

import { STORAGE_KEYS } from '../utils/constants.js'

class StorageService {
  constructor() {
    /** @type {Map<string, number>} debounce timers by key */
    this._timers = new Map()
  }

  /**
   * Get a value from localStorage, parsed from JSON.
   * Returns defaultValue if key doesn't exist or parse fails.
   *
   * @param {string} key
   * @param {*} [defaultValue=null]
   * @returns {*}
   */
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      return JSON.parse(raw)
    } catch {
      console.warn(`[StorageService] Failed to parse key "${key}", returning default`)
      return defaultValue
    }
  }

  /**
   * Get a raw string from localStorage (no JSON parsing).
   * @param {string} key
   * @param {string} [defaultValue=null]
   * @returns {string|null}
   */
  getRaw(key, defaultValue = null) {
    return localStorage.getItem(key) ?? defaultValue
  }

  /**
   * Set a value in localStorage, serialized as JSON.
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        console.error(`[StorageService] Storage quota exceeded for key "${key}"`)
      } else {
        console.error(`[StorageService] Failed to set key "${key}":`, err)
      }
    }
  }

  /**
   * Set a raw string in localStorage (no JSON serialization).
   * @param {string} key
   * @param {string} value
   */
  setRaw(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      console.error(`[StorageService] Failed to set raw key "${key}":`, err)
    }
  }

  /**
   * Set a value with debouncing — batches rapid writes.
   * @param {string} key
   * @param {*} value
   * @param {number} [delay=2000] — debounce delay in ms
   */
  debouncedSet(key, value, delay = 2000) {
    const existing = this._timers.get(key)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.set(key, value)
      this._timers.delete(key)
    }, delay)
    this._timers.set(key, timer)
  }

  /**
   * Remove a key from localStorage.
   * @param {string} key
   */
  remove(key) {
    localStorage.removeItem(key)
    const timer = this._timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this._timers.delete(key)
    }
  }

  /**
   * Check if a key exists in localStorage.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return localStorage.getItem(key) !== null
  }

  /**
   * Clear all auth-related keys (called on logout).
   * Preserves user-created content (campaigns, follow packs, relays).
   */
  clearAuthData() {
    const authKeys = [
      STORAGE_KEYS.USER,
      STORAGE_KEYS.SIGNER_TYPE,
      STORAGE_KEYS.REMOTE_URI,
      STORAGE_KEYS.CONNECTIONS,
      STORAGE_KEYS.ACTIVE_CONNECTION,
      STORAGE_KEYS.NWC_URL,
      STORAGE_KEYS.NOTIFICATION_SETTINGS,
      STORAGE_KEYS.LAST_TX_TIMESTAMP,
      STORAGE_KEYS.LAST_BALANCE,
      STORAGE_KEYS.PROCESSED_TX,
      STORAGE_KEYS.NOTIFICATIONS_LIST,
      STORAGE_KEYS.CONTENT_ITEMS,
    ]
    authKeys.forEach(key => this.remove(key))
  }

  /**
   * Clear ALL localStorage keys (called on full account reset).
   */
  clearAll() {
    // Cancel all pending debounced writes
    for (const timer of this._timers.values()) {
      clearTimeout(timer)
    }
    this._timers.clear()

    // Clear all known keys
    Object.values(STORAGE_KEYS).forEach(key => this.remove(key))

    // Also clear any legacy/unknown keys
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keysToRemove.push(key)
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }

  /**
   * Flush all pending debounced writes immediately.
   */
  flush() {
    for (const [key, timer] of this._timers) {
      clearTimeout(timer)
      // The debounced value is lost — this just cancels pending writes
    }
    this._timers.clear()
  }
}

// Singleton
export const storageService = new StorageService()

// Re-export STORAGE_KEYS for convenience
export { STORAGE_KEYS }
