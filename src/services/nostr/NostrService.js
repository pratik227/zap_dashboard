/**
 * NostrService — network abstraction layer powered by nostr-core RelayPool.
 *
 * This is the ONLY file that touches the relay/pool layer.
 * All composables import from here instead of nostrRelayManager.
 *
 * Manages: relay connections, health checks, backoff, subscription
 * concurrency, event caching, publishing, and event listeners.
 */

import { RelayPool, verifyEvent, nip11, nip65 } from './nostrImports.js'
import { cacheManager } from './CacheManager.js'
import {
  RELAY_CONNECTION_TIMEOUT, RELAY_MAX_RETRIES, RELAY_RETRY_DELAY,
  RELAY_HEALTH_CHECK_INTERVAL, RELAY_HEALTH_CHECK_TIMEOUT, RELAY_MAX_BACKOFF,
  DEFERRED_SUB_TIMEOUT, PUBLISH_TIMEOUT,
  DEFAULT_RELAY_CONFIGS, MAX_CONCURRENT_SUBS,
  SUBSCRIBE_TIMEOUT, SUBSCRIBE_EOSE_GRACE,
  OUTBOX_RELAY_LIST_TTL, OUTBOX_MAX_RELAYS_PER_PUBKEY, RELAY_INFO_TTL,
} from '../../utils/constants.js'

/**
 * Deterministic cache key from a filter object.
 */
function stableCacheKey(filter) {
  return JSON.stringify(filter, Object.keys(filter).sort())
}

class NostrService {
  constructor() {
    this.pool = new RelayPool()
    this._initialized = false
    this._eventListeners = new Set()
    this._createReadyGate()

    // Relay metadata
    this.relayConnections = new Map()   // url → { url, config, connectedAt }
    this.relayStatuses = new Map()      // url → { url, status, config, error, ... }
    this._connectionPromises = new Map() // url → Promise (dedup concurrent connects)
    this.defaultRelays = DEFAULT_RELAY_CONFIGS

    // Health checks
    this._healthCheckTimer = null

    // Backoff tracking
    this._relayBackoff = new Map() // url → { backoffMs, lastFail }

    // Subscription concurrency
    this._activeSubscriptions = new Set()
    this._subscriptionQueue = []

    // Subscription registry — tracks live subscriptions for re-open on reconnect
    // Map<id, { filters, callbacks, options, sub, closed }>
    this._subscriptionRegistry = new Map()
    this._subIdCounter = 0

    // Outbox model: NIP-65 relay list cache
    // pubkey → { relays: [{url, read, write}], fetchedAt: timestamp }
    this._relayListCache = new Map()
    this._relayListFetches = new Map() // pubkey → Promise (dedup in-flight)

    // NIP-11 relay info cache
    // url → { info: RelayInfo, fetchedAt: timestamp }
    this._relayInfoCache = new Map()
  }

  _createReadyGate() {
    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve, reject) => {
        this._readyResolve = resolve
        this._readyReject = reject
      })
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  async initialize(relays = []) {
    if (this._initialized) {
      console.warn('NostrService already initialized, use updateRelays()')
      return
    }

    try {
      const allRelays = this.mergeRelayLists(relays, this.defaultRelays)
      await this._connectToRelays(allRelays)
      this._startHealthCheck()

      this._initialized = true
      this._readyResolve()

      this.emit('initialized', {
        connectedRelays: this.getConnectedRelays().length,
        totalRelays: allRelays.length,
      })
    } catch (error) {
      this._readyReject(error)
      throw error
    }
  }

  ready() {
    if (this._initialized) return Promise.resolve()
    return this._readyPromise
  }

  get isInitialized() {
    return this._initialized
  }

  async updateRelays(newRelays = []) {
    if (!this._initialized) return this.initialize(newRelays)
    if (!newRelays?.length) return

    const existingUrls = new Set(this.relayConnections.keys())
    const toAdd = newRelays.filter(r => !existingUrls.has(r.url))
    if (toAdd.length === 0) return

    await this._connectToRelays(toAdd)
    this.emit('relaysUpdated', {
      addedRelays: toAdd.length,
      connectedRelays: this.getConnectedRelays().length,
    })
  }

  /**
   * Close all registered subscriptions without tearing down the service.
   * Use this on page navigation or when you want to stop all data flows.
   */
  closeAllSubscriptions() {
    for (const [id, entry] of this._subscriptionRegistry) {
      entry.closed = true
      for (const sub of entry.subs) {
        try { sub.close() } catch { /* ignore */ }
      }
    }
    this._subscriptionRegistry.clear()
    this._activeSubscriptions.clear()
    this._subscriptionQueue.length = 0
    this.emit('allSubscriptionsClosed', {})
  }

  /**
   * Get count of active subscriptions (for debugging/UI).
   */
  getActiveSubscriptionCount() {
    return this._subscriptionRegistry.size
  }

  async cleanup() {
    this._stopHealthCheck()
    this.closeAllSubscriptions()

    const allUrls = Array.from(this.relayStatuses.keys())
    if (allUrls.length > 0) {
      this.pool.close(allUrls)
    }

    this.relayConnections.clear()
    this.relayStatuses.clear()
    this._connectionPromises.clear()
    this._eventListeners.clear()
    this._relayBackoff.clear()
    this._relayListCache.clear()
    this._relayListFetches.clear()
    this._relayInfoCache.clear()
    cacheManager.clear()

    this._initialized = false
    this._readyPromise = null
    this._readyResolve = null
    this._readyReject = null
    this._createReadyGate()
  }

  // ── Subscribe (streaming) ───────────────────────────────────────

  /**
   * Open a real-time subscription to events matching filters.
   * Supports deferred subscriptions (queued until ready), concurrency
   * control (max 20), and relay backoff.
   *
   * @param {Array<object>} filters — array of Nostr filter objects
   * @param {object} callbacks — { onevent, oneose?, onclose? }
   * @param {object} [options] — { maxWait }
   * @returns {{ close: Function }}
   */
  subscribe(filters, callbacks = {}, options = {}) {
    if (!this._initialized) {
      return this._deferSubscription(filters, callbacks, options)
    }

    const validFilters = this._validateFilters(filters)
    if (validFilters.length === 0) {
      return { close: () => {} }
    }

    // Concurrency control
    if (this._activeSubscriptions.size >= MAX_CONCURRENT_SUBS) {
      return this._queueSubscription(validFilters, callbacks, options)
    }

    return this._openSubscription(validFilters, callbacks, options)
  }

  // ── Query (one-shot, promise-based) ─────────────────────────────

  /**
   * Collect events matching filters. Resolves after EOSE + grace period
   * or hard timeout — whichever comes first.
   *
   * @param {Array<object>} filters
   * @param {object} [opts]
   * @returns {Promise<Array>}
   */
  async query(filters, { timeout = SUBSCRIBE_TIMEOUT, eoseGrace = SUBSCRIBE_EOSE_GRACE, dedup = true } = {}) {
    await this.ready()

    return new Promise((resolve, reject) => {
      const events = []
      const seenIds = dedup ? new Set() : null
      let resolved = false

      const done = () => {
        if (resolved) return
        resolved = true
        clearTimeout(hardTimer)
        clearTimeout(graceTimer)
        try { sub?.close() } catch { /* ignore */ }
        resolve(events)
      }

      let graceTimer = null
      const hardTimer = setTimeout(done, timeout)

      let sub
      try {
        sub = this.subscribe(filters, {
          onevent: (event) => {
            if (resolved) return
            if (seenIds && seenIds.has(event.id)) return
            if (seenIds) seenIds.add(event.id)
            events.push(event)
          },
          oneose: () => {
            clearTimeout(hardTimer)
            graceTimer = setTimeout(done, eoseGrace)
          },
        })
      } catch (err) {
        clearTimeout(hardTimer)
        reject(err)
      }
    })
  }

  // ── QueryOne (single event, cached) ─────────────────────────────

  /**
   * Fetch a single event matching a filter. Uses centralized cache.
   *
   * @param {object} filter — single Nostr filter object
   * @returns {Promise<object|null>}
   */
  async queryOne(filter) {
    // Guard: legacy callers may pass an array
    if (Array.isArray(filter)) {
      filter = filter[0]
    }
    if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
      return null
    }

    await this.ready()

    const cacheKey = stableCacheKey(filter)
    const cached = cacheManager.get('events', cacheKey)
    if (cached !== undefined) return cached

    const readRelays = this._getHealthyReadRelayUrls()
    if (readRelays.length === 0) {
      // Return cached data if available, otherwise null — don't crash
      this.emit('noRelaysAvailable', { filter })
      return cached !== undefined ? cached : null
    }

    try {
      const events = await this.pool.querySync(readRelays, filter, { maxWait: 10_000 })
      const event = events?.[0] ?? null

      // Cache both hits and misses
      cacheManager.set('events', cacheKey, event)
      if (event) {
        readRelays.forEach(url => this._resetBackoff(url))
      }

      return event
    } catch (error) {
      readRelays.forEach(url => {
        if (error.message?.toLowerCase().includes('rate')) {
          this._markBackoff(url)
        }
      })
      throw error
    }
  }

  // ── Publish ─────────────────────────────────────────────────────

  /**
   * Publish an event to write-enabled relays.
   *
   * @param {object} event — signed Nostr event
   * @param {Array} [targetRelays] — specific relay objects to publish to
   * @returns {Promise<{successful: number, failed: number, total: number}>}
   */
  async publish(event, targetRelays = null) {
    await this.ready()

    if (!verifyEvent(event)) {
      throw new Error('Invalid event signature')
    }

    const relayUrls = targetRelays
      ? targetRelays.map(r => r.url || r)
      : this._getHealthyWriteRelayUrls()
    if (relayUrls.length === 0) {
      this.emit('noRelaysAvailable', { eventId: event.id })
      throw new Error('Cannot publish: no relays are connected. Check your internet connection and try again.')
    }

    let pubTimeoutId
    try {
      const publishPromise = this.pool.publish(relayUrls, event)
      const timeoutPromise = new Promise((_, reject) => {
        pubTimeoutId = setTimeout(() => reject(new Error('publish timed out')), PUBLISH_TIMEOUT)
      })

      const successfulUrls = await Promise.race([publishPromise, timeoutPromise])
      clearTimeout(pubTimeoutId)
      const successCount = successfulUrls?.length ?? 0
      const failCount = relayUrls.length - successCount

      this.emit('eventPublished', {
        eventId: event.id,
        successfulRelays: successCount,
        failedRelays: failCount,
        totalRelays: relayUrls.length,
      })

      return { successful: successCount, failed: failCount, total: relayUrls.length }
    } catch (error) {
      clearTimeout(pubTimeoutId)
      this.emit('publishFailed', { eventId: event.id, error: error.message })
      throw error
    }
  }

  // ── Relay Info ──────────────────────────────────────────────────

  getRelayStatuses() {
    return Array.from(this.relayStatuses.values())
  }

  getConnectedRelays() {
    return this.getRelayStatuses().filter(r => r.status === 'connected')
  }

  getWriteRelays() {
    return this.getConnectedRelays().filter(r => r.config?.write === true)
  }

  getReadRelays() {
    return this.getConnectedRelays().filter(r => r.config?.read === true)
  }

  getConnectionStats() {
    const statuses = this.getRelayStatuses()
    const connected = statuses.filter(r => r.status === 'connected').length
    const total = statuses.length
    return {
      total,
      connected,
      disconnected: total - connected,
      writeEnabled: this.getWriteRelays().length,
      readEnabled: this.getReadRelays().length,
      healthyPercentage: total > 0 ? Math.round((connected / total) * 100) : 0,
    }
  }

  /**
   * Get a health summary suitable for UI display.
   */
  getConnectionHealth() {
    const stats = this.getConnectionStats()
    const unhealthy = this.getRelayStatuses().filter(r => r.status === 'unhealthy')
    return {
      ...stats,
      status: stats.connected === 0 ? 'disconnected'
        : stats.healthyPercentage < 50 ? 'degraded'
        : 'healthy',
      unhealthyRelays: unhealthy.map(r => r.url),
    }
  }

  // ── Relay Management ────────────────────────────────────────────

  async addRelay(url, config = { read: true, write: true }) {
    await this.connectToRelay(url, config)
    this.emit('relayAdded', { url, config })
    return true
  }

  removeRelay(url) {
    this.relayConnections.delete(url)
    this.relayStatuses.delete(url)
    this._connectionPromises.delete(url)
    this.pool.close([url])
    this.emit('relayRemoved', { url })
  }

  async reconnectRelay(url) {
    const status = this.relayStatuses.get(url)
    if (!status) return
    this.relayConnections.delete(url)
    try {
      await this.connectToRelay(url, status.config)
    } catch (err) {
      console.warn(`Failed to reconnect to ${url}:`, err.message)
    }
  }

  // ── Outbox Model (NIP-65) ───────────────────────────────────────

  /**
   * Fetch and cache a user's NIP-65 relay list (kind:10002).
   * Uses nostr-core's parseRelayList for parsing.
   * @param {string} pubkey — hex pubkey
   * @returns {Promise<Array<{url, read, write}>>}
   */
  async fetchRelayList(pubkey) {
    // Check cache
    const cached = this._relayListCache.get(pubkey)
    if (cached && (Date.now() - cached.fetchedAt) < OUTBOX_RELAY_LIST_TTL) {
      return cached.relays
    }

    // Dedup in-flight
    if (this._relayListFetches.has(pubkey)) {
      return this._relayListFetches.get(pubkey)
    }

    const promise = this._fetchRelayListFromRelays(pubkey)
    this._relayListFetches.set(pubkey, promise)

    try {
      return await promise
    } finally {
      this._relayListFetches.delete(pubkey)
    }
  }

  async _fetchRelayListFromRelays(pubkey) {
    try {
      const event = await this.queryOne({
        kinds: [10002], authors: [pubkey], limit: 1
      })

      if (!event) {
        this._relayListCache.set(pubkey, { relays: [], fetchedAt: Date.now() })
        return []
      }

      const relays = nip65.parseRelayList(event)
      this._relayListCache.set(pubkey, { relays, fetchedAt: Date.now() })
      return relays
    } catch (err) {
      console.warn(`Failed to fetch relay list for ${pubkey.substring(0, 8)}:`, err.message)
      return []
    }
  }

  /**
   * Get outbox relays for a set of pubkeys — their WRITE relays
   * (where they publish events). Use these relays to READ their events.
   * @param {string[]} pubkeys
   * @returns {Promise<string[]>} deduplicated relay URLs
   */
  async getOutboxRelays(pubkeys) {
    const relayUrls = new Set()
    const fetches = pubkeys.map(pk => this.fetchRelayList(pk))
    const results = await Promise.allSettled(fetches)

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const relays = result.value
      const writeRelays = nip65.getWriteRelays(relays)
      for (const url of writeRelays.slice(0, OUTBOX_MAX_RELAYS_PER_PUBKEY)) {
        relayUrls.add(url)
      }
    }

    return Array.from(relayUrls)
  }

  /**
   * Get inbox relays for a set of pubkeys — their READ relays
   * (where they read events). Use these relays to PUBLISH events to them.
   * @param {string[]} pubkeys
   * @returns {Promise<string[]>} deduplicated relay URLs
   */
  async getInboxRelays(pubkeys) {
    const relayUrls = new Set()
    const fetches = pubkeys.map(pk => this.fetchRelayList(pk))
    const results = await Promise.allSettled(fetches)

    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const relays = result.value
      const readRelays = nip65.getReadRelays(relays)
      for (const url of readRelays.slice(0, OUTBOX_MAX_RELAYS_PER_PUBKEY)) {
        relayUrls.add(url)
      }
    }

    return Array.from(relayUrls)
  }

  /**
   * Query with outbox model: fetch events from the target pubkeys'
   * write relays in addition to our own read relays.
   * @param {Array<object>} filters — must contain `authors` field
   * @param {object} [opts] — same as query() options
   * @returns {Promise<Array>}
   */
  async queryOutbox(filters, opts = {}) {
    await this.ready()

    // Extract pubkeys from filters
    const pubkeys = new Set()
    for (const f of filters) {
      if (f.authors) f.authors.forEach(pk => pubkeys.add(pk))
      if (f['#p']) f['#p'].forEach(pk => pubkeys.add(pk))
    }

    if (pubkeys.size === 0) {
      return this.query(filters, opts)
    }

    // Fetch outbox relays for targets
    const outboxUrls = await this.getOutboxRelays(Array.from(pubkeys))

    // Ensure we're connected to outbox relays (best-effort)
    const newRelays = outboxUrls.filter(url => !this.relayConnections.has(url))
    if (newRelays.length > 0) {
      await Promise.allSettled(
        newRelays.map(url => this.connectToRelay(url, { read: true, write: false }))
      )
    }

    // Query across our relays + outbox relays
    return this.query(filters, opts)
  }

  /**
   * Publish with inbox model: publish to the target recipients'
   * read relays in addition to our own write relays.
   * @param {object} event — signed Nostr event
   * @param {string[]} recipientPubkeys — target recipients
   * @returns {Promise<{successful, failed, total}>}
   */
  async publishInbox(event, recipientPubkeys = []) {
    await this.ready()

    if (recipientPubkeys.length === 0) {
      return this.publish(event)
    }

    // Fetch inbox relays for recipients
    const inboxUrls = await this.getInboxRelays(recipientPubkeys)

    // Ensure connected to inbox relays (best-effort)
    const newRelays = inboxUrls.filter(url => !this.relayConnections.has(url))
    if (newRelays.length > 0) {
      await Promise.allSettled(
        newRelays.map(url => this.connectToRelay(url, { read: false, write: true }))
      )
    }

    // Publish to our write relays + inbox relays
    const allWriteUrls = new Set([
      ...this._getHealthyWriteRelayUrls(),
      ...inboxUrls
    ])
    const targetRelays = Array.from(allWriteUrls).map(url => ({ url }))
    return this.publish(event, targetRelays)
  }

  // ── NIP-11: Relay Information ─────────────────────────────────

  /**
   * Fetch relay information document (NIP-11).
   * Caches results for 1 hour.
   * @param {string} relayUrl — wss:// relay URL
   * @returns {Promise<object|null>} RelayInfo or null
   */
  async fetchRelayInfo(relayUrl) {
    const cached = this._relayInfoCache.get(relayUrl)
    if (cached && (Date.now() - cached.fetchedAt) < RELAY_INFO_TTL) {
      return cached.info
    }

    try {
      const info = await nip11.fetchRelayInfo(relayUrl)
      this._relayInfoCache.set(relayUrl, { info, fetchedAt: Date.now() })
      return info
    } catch (err) {
      console.warn(`Failed to fetch NIP-11 info for ${relayUrl}:`, err.message)
      return null
    }
  }

  /**
   * Check if a relay supports a specific NIP.
   * @param {string} relayUrl
   * @param {number} nipNumber
   * @returns {Promise<boolean>}
   */
  async relaySupportsNip(relayUrl, nipNumber) {
    const info = await this.fetchRelayInfo(relayUrl)
    if (!info) return false
    return nip11.supportsNip(info, nipNumber)
  }

  /**
   * Fetch NIP-11 info for all connected relays.
   * @returns {Promise<Map<string, object>>} url → RelayInfo
   */
  async fetchAllRelayInfo() {
    const connected = this.getConnectedRelays()
    const results = new Map()

    await Promise.allSettled(
      connected.map(async (relay) => {
        const info = await this.fetchRelayInfo(relay.url)
        if (info) results.set(relay.url, info)
      })
    )

    return results
  }

  // ── Event Cache ─────────────────────────────────────────────────

  clearEventCache(filter) {
    cacheManager.invalidate('events', stableCacheKey(filter))
  }

  // ── Event Listeners ─────────────────────────────────────────────

  addEventListener(callback) {
    if (typeof callback !== 'function') return () => {}
    this._eventListeners.add(callback)
    return () => this._eventListeners.delete(callback)
  }

  emit(type, data) {
    for (const listener of this._eventListeners) {
      try {
        listener({ type, data, timestamp: new Date().toISOString() })
      } catch (err) {
        console.error('NostrService event listener error:', err)
      }
    }
  }

  // ── Internal: Connection ────────────────────────────────────────

  mergeRelayLists(userRelays, defaultRelays) {
    const map = new Map()
    for (const r of defaultRelays) map.set(r.url, r)
    for (const r of userRelays) map.set(r.url, r)
    return Array.from(map.values())
  }

  async _connectToRelays(relayConfigs) {
    const results = await Promise.allSettled(
      relayConfigs.map(cfg => this.connectToRelay(cfg.url, cfg))
    )

    let ok = 0
    let fail = 0
    for (const r of results) {
      if (r.status === 'fulfilled') ok++
      else fail++
    }

    if (ok === 0 && relayConfigs.length > 0) {
      throw new Error('Failed to connect to any relays')
    }
    return { successCount: ok, failureCount: fail }
  }

  async connectToRelay(url, config = { read: true, write: true }, retryCount = 0) {
    // Dedup concurrent connection attempts to the same relay
    if (this._connectionPromises.has(url)) {
      return this._connectionPromises.get(url)
    }

    this.setRelayStatus(url, 'connecting', config)

    const promise = this._attemptConnection(url, config, retryCount)
    this._connectionPromises.set(url, promise)

    try {
      const result = await promise
      return result
    } finally {
      this._connectionPromises.delete(url)
    }
  }

  async _attemptConnection(url, config, retryCount) {
    let timeoutId
    try {
      const relayPromise = this.pool.ensureRelay(url, {
        connectionTimeout: RELAY_CONNECTION_TIMEOUT,
      })
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Connection timeout')), RELAY_CONNECTION_TIMEOUT)
      })

      await Promise.race([relayPromise, timeoutPromise])
      clearTimeout(timeoutId)

      this.relayConnections.set(url, {
        url,
        config,
        connectedAt: new Date().toISOString(),
      })
      this.setRelayStatus(url, 'connected', config)
      this.emit('relayConnected', { url, config })

      return { url, config }
    } catch (error) {
      if (retryCount < RELAY_MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RELAY_RETRY_DELAY))
        return this._attemptConnection(url, config, retryCount + 1)
      }

      this.setRelayStatus(url, 'failed', config, error.message)
      this.emit('relayFailed', { url, config, error: error.message })
      throw new Error(`Failed to connect to ${url} after ${RELAY_MAX_RETRIES + 1} attempts: ${error.message}`)
    }
  }

  setRelayStatus(url, status, config = null, error = null) {
    const current = this.relayStatuses.get(url) || {}
    this.relayStatuses.set(url, {
      ...current,
      url,
      status,
      config: config || current.config,
      error,
      lastUpdated: new Date().toISOString(),
      lastConnected: status === 'connected' ? new Date().toISOString() : current.lastConnected,
    })
  }

  // ── Internal: Health Checks ─────────────────────────────────────

  _startHealthCheck() {
    this._stopHealthCheck()
    this._healthCheckTimer = setInterval(
      () => this._performHealthCheck(),
      RELAY_HEALTH_CHECK_INTERVAL
    )
  }

  _stopHealthCheck() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer)
      this._healthCheckTimer = null
    }
  }

  async _performHealthCheck() {
    let hadRecovery = false
    const statuses = this.getRelayStatuses()

    await Promise.allSettled(statuses.map(async (relayStatus) => {
      try {
        if (!this.relayConnections.has(relayStatus.url)) {
          await this.reconnectRelay(relayStatus.url)
          hadRecovery = true
          return
        }

        let hcTimeout
        const timeout = new Promise((_, reject) => {
          hcTimeout = setTimeout(() => reject(new Error('Health check timeout')), RELAY_HEALTH_CHECK_TIMEOUT)
        })
        try {
          await Promise.race([
            this.pool.ensureRelay(relayStatus.url),
            timeout,
          ])
        } finally {
          clearTimeout(hcTimeout)
        }

        if (relayStatus.status !== 'connected') {
          this.setRelayStatus(relayStatus.url, 'connected', relayStatus.config)
          this.emit('relayHealthy', { url: relayStatus.url })
          hadRecovery = true
        }
      } catch (error) {
        // Mark relay as disconnected (not just unhealthy) so UI shows accurate state
        this.relayConnections.delete(relayStatus.url)
        this.setRelayStatus(relayStatus.url, 'disconnected', relayStatus.config, error.message)
        this.emit('relayDisconnected', { url: relayStatus.url, error: error.message })
        setTimeout(() => this.reconnectRelay(relayStatus.url), RELAY_RETRY_DELAY)
      }
    }))

    // After health check, re-open any subscriptions that were waiting for relays
    if (hadRecovery) {
      this._reopenSubscriptions()
    }
  }

  /**
   * Re-open subscriptions that were registered but had no relays,
   * or whose relays disconnected. Called after a relay reconnects.
   */
  _reopenSubscriptions() {
    const healthyRelays = this._getHealthyReadRelayUrls()
    if (healthyRelays.length === 0) return

    for (const [id, entry] of this._subscriptionRegistry) {
      if (entry.closed) {
        this._subscriptionRegistry.delete(id)
        continue
      }

      // If the subscription has no open subs (was created with 0 relays),
      // or if we want to refresh it, open it now.
      const hasOpenSubs = entry.subs.length > 0
      if (!hasOpenSubs) {
        try {
          // Close any existing subs first
          for (const sub of entry.subs) {
            try { sub.close() } catch { /* ignore */ }
          }
          entry.subs = []

          // Re-open with current healthy relays
          for (const filter of entry.filters) {
            const sub = this.pool.subscribe(healthyRelays, filter, {
              onevent: (event) => entry.callbacks.onevent?.(event),
              oneose: () => entry.callbacks.oneose?.(),
              onclose: () => {},
              maxWait: entry.options.maxWait || 10_000,
            })
            entry.subs.push(sub)
          }

          this.emit('subscriptionReopened', { id, filters: entry.filters })
        } catch (err) {
          console.warn(`Failed to reopen subscription ${id}:`, err.message)
        }
      }
    }
  }

  // ── Internal: Backoff ───────────────────────────────────────────

  _isBackedOff(url) {
    const entry = this._relayBackoff.get(url)
    if (!entry) return false
    return Date.now() - entry.lastFail < entry.backoffMs
  }

  _markBackoff(url) {
    const entry = this._relayBackoff.get(url) || { backoffMs: 2000, lastFail: 0 }
    entry.backoffMs = Math.min(RELAY_MAX_BACKOFF, entry.backoffMs * 2)
    entry.lastFail = Date.now()
    this._relayBackoff.set(url, entry)
  }

  _resetBackoff(url) {
    this._relayBackoff.delete(url)
  }

  _getHealthyReadRelayUrls() {
    return this.getReadRelays()
      .filter(r => !this._isBackedOff(r.url))
      .map(r => r.url)
  }

  _getHealthyWriteRelayUrls() {
    return this.getWriteRelays()
      .filter(r => !this._isBackedOff(r.url))
      .map(r => r.url)
  }

  // ── Internal: Filter Validation ─────────────────────────────────

  _validateFilters(filters) {
    if (!Array.isArray(filters)) return []
    return filters.filter(f =>
      f && typeof f === 'object' && !Array.isArray(f) && Object.keys(f).length > 0
    )
  }

  // ── Internal: Subscription Management ───────────────────────────

  _deferSubscription(filters, callbacks, options) {
    let realSub = null
    let closed = false

    const deferTimeout = setTimeout(() => {
      if (!closed) {
        closed = true
        console.warn('Deferred subscription timed out after', DEFERRED_SUB_TIMEOUT, 'ms')
        callbacks.onclose?.('deferred subscription timed out')
      }
    }, DEFERRED_SUB_TIMEOUT)

    this._readyPromise.then(() => {
      clearTimeout(deferTimeout)
      if (!closed) {
        try {
          realSub = this.subscribe(filters, callbacks, options)
        } catch (e) {
          console.warn('Deferred subscription failed:', e.message)
        }
      }
    }).catch(() => {
      clearTimeout(deferTimeout)
      closed = true
    })

    return {
      close: () => {
        closed = true
        clearTimeout(deferTimeout)
        realSub?.close()
      },
    }
  }

  _queueSubscription(filters, callbacks, options) {
    let realSub = null
    const proxy = {
      close: () => { proxy._closed = true; realSub?.close() },
      _closed: false,
    }
    this._subscriptionQueue.push({
      filters, callbacks, options, proxy,
      setReal: (s) => { realSub = s },
    })
    return proxy
  }

  /**
   * Open a subscription across healthy read relays.
   *
   * nostr-core RelayPool.subscribe takes a single Filter, not an array.
   * For multiple filters, we open one pool subscription per filter and
   * aggregate EOSE across all of them.
   *
   * Registered in the subscription registry so it can be re-opened
   * after a relay reconnects.
   */
  _openSubscription(filters, callbacks, options) {
    const relayUrls = this._getHealthyReadRelayUrls()
    if (relayUrls.length === 0) {
      // Instead of throwing, return a no-op sub and emit a warning.
      // The subscription is still registered so it can be opened
      // when relays come back online.
      this.emit('noRelaysAvailable', { filters })
      const registryId = ++this._subIdCounter
      const entry = { filters, callbacks, options, subs: [], closed: false }
      this._subscriptionRegistry.set(registryId, entry)

      return {
        close: () => {
          entry.closed = true
          this._subscriptionRegistry.delete(registryId)
        },
      }
    }

    const subId = Symbol('sub')
    this._activeSubscriptions.add(subId)
    const registryId = ++this._subIdCounter

    let cleaned = false
    const cleanupSub = () => {
      if (cleaned) return
      cleaned = true
      this._activeSubscriptions.delete(subId)
      this._drainQueue()
    }

    // For multiple filters, open one pool.subscribe per filter.
    // Aggregate EOSE and onclose across all filter subs.
    // Dedup events across filters to prevent double-counting.
    const subs = []
    const totalFilters = filters.length
    const eoseCount = { value: 0 }
    const closeCount = { value: 0 }
    const seenIds = totalFilters > 1 ? new Set() : null

    for (const filter of filters) {
      const sub = this.pool.subscribe(relayUrls, filter, {
        onevent: (event) => {
          // Dedup across overlapping filters
          if (seenIds) {
            if (seenIds.has(event.id)) return
            seenIds.add(event.id)
          }
          callbacks.onevent?.(event)
        },
        oneose: () => {
          eoseCount.value++
          if (eoseCount.value >= totalFilters) {
            callbacks.oneose?.()
          }
        },
        onclose: (reason) => {
          closeCount.value++
          if (typeof reason === 'string' && reason.toLowerCase().includes('rate')) {
            relayUrls.forEach(url => this._markBackoff(url))
          }
          // Only fire consumer's onclose once (after all filter subs close)
          if (closeCount.value >= totalFilters) {
            cleanupSub()
            callbacks.onclose?.(reason)
          }
        },
        maxWait: options.maxWait || 10_000,
      })
      subs.push(sub)
    }

    // Register for potential re-open on reconnect
    const entry = { filters, callbacks, options, subs, closed: false }
    this._subscriptionRegistry.set(registryId, entry)

    // Composite close handle
    const compositeClose = () => {
      entry.closed = true
      this._subscriptionRegistry.delete(registryId)
      cleanupSub()
      for (const sub of subs) {
        try { sub.close() } catch { /* ignore */ }
      }
    }

    return { close: compositeClose }
  }

  _drainQueue() {
    while (this._subscriptionQueue.length > 0 && this._activeSubscriptions.size < MAX_CONCURRENT_SUBS) {
      const { filters, callbacks, options, proxy, setReal } = this._subscriptionQueue.shift()
      if (proxy._closed) continue
      try {
        const realSub = this._openSubscription(filters, callbacks, options)
        setReal(realSub)
        proxy.close = () => { proxy._closed = true; realSub.close() }
      } catch (e) {
        console.warn('Queued subscription failed:', e.message)
      }
    }
  }
}

// Singleton
export const nostrService = new NostrService()
