import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, verifyEvent } from 'nostr-tools/pure'

// Relay connection manager following nostr-tools best practices
class NostrRelayManager {
  constructor() {
    this.pool = new SimplePool()
    this.relayConnections = new Map() // Map of URL -> connection info
    this.relayStatuses = new Map() // Map of URL -> status info
    this.relayMeta = new Map() // Map of URL -> { successes, failures, rtt, score, lastFailure, attempts }
    this.relayMetrics = new Map() // Map of URL -> telemetry counts
    this.connectionPromises = new Map() // Map of URL -> connection promise
    this.eventListeners = new Set()
    this.isInitialized = false
  // Subscription registry to dedupe identical subscriptions and forward callbacks
  // key -> { sub: subscriptionObject, listeners: Set<{onevent, oneose, onclose}>, refCount }
  this.subscriptionRegistry = new Map()
    
    // Default reliable relays
    this.defaultRelays = [
      { url: 'wss://relay.damus.io', read: true, write: true },
      { url: 'wss://nos.lol', read: true, write: true },
      { url: 'wss://relay.snort.social', read: true, write: true },
      { url: 'wss://relay.primal.net', read: true, write: true },
      { url: 'wss://nostr.wine', read: true, write: true },
      { url: 'wss://relay.nostr.band', read: true, write: false } // Read-only
    ]
    
    // Connection timeouts and retry logic
    this.connectionTimeout = 10000 // 10 seconds
    this.maxRetries = 3
    this.retryDelay = 2000 // 2 seconds
    this.healthCheckInterval = 30000 // 30 seconds
    this.healthCheckTimer = null
    // Publish queue persisted to localStorage
    this.PUBLISH_QUEUE_KEY = 'zap_pending_publishes'
    this.publishQueue = []
    // Rate limiting / throttling parameters
    this.REQUEST_WINDOW_MS = 60_000 // 1 minute window
    this.MAX_REQUESTS_PER_WINDOW = 30 // max requests per relay per window
    this.PAUSE_BASE_MS = 30_000 // base pause for rate-limit violations
    // Caches
    this.profileCache = new Map() // pubkey -> { profile, ts }
    this.eventCache = new Map() // cacheKey -> { events, ts }
    this.PROFILE_CACHE_TTL = 60 * 60 * 1000 // 1hr
    this.EVENT_CACHE_TTL = 5 * 60 * 1000 // 5min
  }

  // Initialize the relay manager
  async initialize(userRelays = []) {
    if (this.isInitialized) {
      console.log('Relay manager already initialized')
      return
    }

    console.log('🚀 Initializing Nostr Relay Manager...')
    
    try {
      // Combine user relays with defaults, prioritizing user relays
  const allRelays = this.mergeRelayLists(userRelays, this.defaultRelays)
  // persist user relays for future sessions
  try { localStorage.setItem('nostrRelays', JSON.stringify(userRelays || [])) } catch (e) {}
      
      // Initialize relay meta & metrics entries
      allRelays.forEach(r => {
        const url = r.url || r
        if (!this.relayMeta.has(url)) this.relayMeta.set(url, { url, successes: 0, failures: 0, rtt: Infinity, score: 0, lastFailure: 0, attempts: 0 })
        if (!this.relayMetrics.has(url)) this.relayMetrics.set(url, { published: 0, publishFailed: 0, reads: 0, readFailed: 0 })
      })

      // Connect to all relays
      await this.connectToRelays(allRelays)

      // Load publish queue from storage
      try { this.publishQueue = JSON.parse(localStorage.getItem(this.PUBLISH_QUEUE_KEY) || '[]') } catch (e) { this.publishQueue = [] }

      // Start health check monitoring
      this.startHealthCheck()
      
      this.isInitialized = true
      console.log('✅ Nostr Relay Manager initialized successfully')
      
      // Emit initialization event
      this.emitEvent('initialized', { 
        connectedRelays: this.getConnectedRelays().length,
        totalRelays: allRelays.length 
      })
      
    } catch (error) {
      console.error('❌ Failed to initialize Nostr Relay Manager:', error)
      throw error
    }
  }

  // Merge user relays with defaults, avoiding duplicates
  mergeRelayLists(userRelays, defaultRelays) {
    const relayMap = new Map()
    
    // Add default relays first
    defaultRelays.forEach(relay => {
      relayMap.set(relay.url, relay)
    })
    
    // Override with user relays
    userRelays.forEach(relay => {
      // allow either string or {url,read,write}
      const entry = typeof relay === 'string' ? { url: relay, read: true, write: true } : relay
      relayMap.set(entry.url, entry)
    })
    
    return Array.from(relayMap.values())
  }

  // Connect to multiple relays with proper error handling
  async connectToRelays(relayConfigs) {
    console.log(`🔌 Connecting to ${relayConfigs.length} relays...`)
    
    const connectionPromises = relayConfigs.map(config => 
      this.connectToRelay(config.url, config)
    )
    
    // Wait for all connections to complete (success or failure)
    const results = await Promise.allSettled(connectionPromises)
    
    let successCount = 0
    let failureCount = 0
    
    results.forEach((result, index) => {
      const relayUrl = relayConfigs[index].url
      if (result.status === 'fulfilled') {
        successCount++
        console.log(`✅ Connected to ${relayUrl}`)
      } else {
        failureCount++
        console.warn(`❌ Failed to connect to ${relayUrl}:`, result.reason?.message)
      }
    })
    
    console.log(`📊 Relay connection summary: ${successCount} connected, ${failureCount} failed`)
    
    if (successCount === 0) {
      throw new Error('Failed to connect to any relays')
    }
    
    return { successCount, failureCount }
  }

  // Connect to a single relay with retry logic
  async connectToRelay(url, config = { read: true, write: true }, retryCount = 0) {
    // Check if already connecting
    if (this.connectionPromises.has(url)) {
      return this.connectionPromises.get(url)
    }

    // Set initial status
    this.setRelayStatus(url, 'connecting', config)

    const connectionPromise = this._attemptConnection(url, config, retryCount)
    this.connectionPromises.set(url, connectionPromise)

    try {
      const result = await connectionPromise
      this.connectionPromises.delete(url)
      return result
    } catch (error) {
      this.connectionPromises.delete(url)
      throw error
    }
  }

  // Attempt connection to a relay using pool.ensureRelay
  async _attemptConnection(url, config, retryCount) {
    try {
      console.log(`🔌 Attempting to connect to ${url} (attempt ${retryCount + 1})`)
      
  // Use pool.ensureRelay which returns a promise that resolves when connected
  const relayPromise = this.pool.ensureRelay(url)
      
      // Add timeout to the connection attempt
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
      )
      
      // Wait for either connection or timeout
      await Promise.race([relayPromise, timeoutPromise])

      // Store connection info
      this.relayConnections.set(url, {
        url,
        config,
        connectedAt: new Date().toISOString()
      })

      // update meta success
      const meta = this.relayMeta.get(url) || { url }
      meta.successes = (meta.successes || 0) + 1
      meta.rtt = (Date.now() - (meta._lastProbeStart || Date.now())) || 0
      meta.lastFailure = meta.lastFailure || 0
      meta.attempts = 0
      this.relayMeta.set(url, meta)

      this.setRelayStatus(url, 'connected', config)

      console.log(`✅ Successfully connected to ${url}`)
      this.emitEvent('relayConnected', { url, config })
      
      return { url, config }
      
    } catch (error) {
      console.warn(`❌ Connection attempt ${retryCount + 1} failed for ${url}:`, error.message)
      
      // Retry logic with exponential backoff
      const meta = this.relayMeta.get(url) || { url, attempts: 0 }
      meta.failures = (meta.failures || 0) + 1
      meta.attempts = (meta.attempts || 0) + 1
      meta.lastFailure = Date.now()
      this.relayMeta.set(url, meta)

      if (retryCount < this.maxRetries) {
        const backoff = this.retryDelay * Math.pow(2, retryCount)
        console.log(`🔄 Retrying connection to ${url} in ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
        return this._attemptConnection(url, config, retryCount + 1)
      } else {
        this.setRelayStatus(url, 'failed', config, error.message)
        this.emitEvent('relayFailed', { url, config, error: error.message })
        throw new Error(`Failed to connect to ${url} after ${this.maxRetries + 1} attempts: ${error.message}`)
      }
    }
  }

  // Reconnect to a specific relay
  async reconnectRelay(url) {
    const status = this.relayStatuses.get(url)
    if (!status) return

    console.log(`🔄 Attempting to reconnect to ${url}`)
    
    try {
      // Remove old connection info
      this.relayConnections.delete(url)
      
      // Attempt new connection
      await this.connectToRelay(url, status.config)
    } catch (error) {
      console.warn(`❌ Failed to reconnect to ${url}:`, error.message)
    }
  }

  // Set relay status with metadata
  setRelayStatus(url, status, config = null, error = null) {
    const currentStatus = this.relayStatuses.get(url) || {}
    
    this.relayStatuses.set(url, {
      ...currentStatus,
      url,
      status,
      config: config || currentStatus.config,
      error,
      lastUpdated: new Date().toISOString(),
      lastConnected: status === 'connected' ? new Date().toISOString() : currentStatus.lastConnected
    })
    // ensure meta entry exists
    if (!this.relayMeta.has(url)) this.relayMeta.set(url, { url, successes: 0, failures: 0, rtt: Infinity, score: 0, lastFailure: 0, attempts: 0 })
  }

  // Get all relay statuses
  getRelayStatuses() {
    return Array.from(this.relayStatuses.values())
  }

  // Get connected relays
  getConnectedRelays() {
    return this.getRelayStatuses().filter(relay => relay.status === 'connected')
  }

  // Get write-enabled connected relays
  getWriteRelays() {
    return this.getConnectedRelays().filter(relay => relay.config?.write === true)
  }

  // Get read-enabled connected relays
  getReadRelays() {
    return this.getConnectedRelays().filter(relay => relay.config?.read === true)
  }

  // Select relays for read operations based on score and config
  selectRelaysForRead(limit = 4) {
    // prefer read-enabled connected relays
  const readRelays = this.getReadRelays().map(r => r.url)
    if (!readRelays || readRelays.length === 0) return []

    // combine scores from relayMeta
  const now = Date.now()
  const metas = Array.from(this.relayMeta.values()).filter(m => readRelays.includes(m.url) && (!(m.pausedUntil) || (m.pausedUntil <= now)))
    metas.sort((a,b) => (b.score || 0) - (a.score || 0))
    const selected = metas.slice(0, limit).map(m => m.url)
    // fallback: if not enough scored relays, fill from readRelays
    if (selected.length < limit) {
      const fill = readRelays.filter(u => !selected.includes(u)).slice(0, limit - selected.length)
      return selected.concat(fill)
    }
    return selected
  }

  // Record a request against a relay and apply pause/backoff if threshold exceeded
  recordRelayRequest(url) {
    if (!url) return
    const now = Date.now()
    const meta = this.relayMeta.get(url) || { url, requestTimestamps: [], attempts: 0 }
    meta.requestTimestamps = (meta.requestTimestamps || []).filter(ts => (now - ts) <= this.REQUEST_WINDOW_MS)
    meta.requestTimestamps.push(now)
    // if exceeded
    if ((meta.requestTimestamps.length || 0) > this.MAX_REQUESTS_PER_WINDOW) {
      meta.attempts = (meta.attempts || 0) + 1
      const pause = Math.min(5 * this.PAUSE_BASE_MS, this.PAUSE_BASE_MS * Math.pow(2, meta.attempts - 1))
      meta.pausedUntil = now + pause
      this.emitEvent('relayRateLimited', { url, pausedUntil: meta.pausedUntil })
      console.warn(`Relay ${url} paused for ${pause}ms due to request rate`) 
    }
    this.relayMeta.set(url, meta)
  }

  // Promise timeout helper
  withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
    ])
  }

  // Enqueue a publish for retry later; persisted to localStorage
  enqueuePublish(event) {
    try {
      const item = { event, attempts: 0, lastTried: 0 }
      this.publishQueue.push(item)
      localStorage.setItem(this.PUBLISH_QUEUE_KEY, JSON.stringify(this.publishQueue))
      console.log('🗃️ Enqueued publish for later', event.id)
    } catch (e) {
      console.warn('Failed to enqueue publish', e)
    }
  }

  // Flush publish queue with simple backoff and retry policies
  async flushPublishQueue() {
    if (!this.publishQueue || this.publishQueue.length === 0) return
    if (!this.isInitialized) return

    const queue = [...this.publishQueue]
    for (const item of queue) {
      // backoff check
      const now = Date.now()
      const wait = Math.min(60_000, 1000 * Math.pow(2, item.attempts || 0))
      if (item.lastTried && (now - item.lastTried) < wait) continue

      try {
        await this.publishEvent(item.event)
        // remove from queue
        this.publishQueue = this.publishQueue.filter(q => q !== item)
        localStorage.setItem(this.PUBLISH_QUEUE_KEY, JSON.stringify(this.publishQueue))
        console.log('✅ Flushed queued publish', item.event.id)
      } catch (e) {
        item.attempts = (item.attempts || 0) + 1
        item.lastTried = Date.now()
        localStorage.setItem(this.PUBLISH_QUEUE_KEY, JSON.stringify(this.publishQueue))
        console.warn('Publish retry failed for', item.event.id)
      }
    }
  }

  // Publish event to write relays using the correct pool.publish API
  async publishEvent(event, targetRelays = null) {
    if (!this.isInitialized) {
      throw new Error('Relay manager not initialized')
    }

    // Verify event before publishing
    const isValid = verifyEvent(event)
    if (!isValid) {
      throw new Error('Invalid event signature')
    }

    // Determine which relays to use: prefer healthy write-enabled relays
    const writeRelays = this.getWriteRelays()
    const preferred = (targetRelays && targetRelays.length) ? targetRelays.map(r => (r.url? r.url: r)) : writeRelays.map(r => r.url)
    const healthy = Array.from(this.relayMeta.values()).filter(m => m && (m.score || 0) > 0).sort((a,b)=> (b.score||0)-(a.score||0)).map(m=>m.url)
    const relayUrls = preferred.length ? preferred.filter(u=>u) : healthy
    const targets = relayUrls.length ? relayUrls : writeRelays.map(r=>r.url)

    if (targets.length === 0) {
      // enqueue for later if no write relays
      this.enqueuePublish(event)
      throw new Error('No write-enabled relays available; event queued')
    }

    console.log(`📤 Publishing event ${event.id} to ${targets.length} relays:` , targets)

    try {
      const publishPromises = this.pool.publish(targets, event)

      // attach callbacks for nostr-tools publish object
      if (publishPromises && typeof publishPromises.on === 'function') {
        publishPromises.on('ok', (relay)=> {
          const m = this.relayMeta.get(relay) || { url: relay }
          m.successes = (m.successes||0)+1
          this.relayMeta.set(relay, m)
          const metrics = this.relayMetrics.get(relay) || { published:0 }
          metrics.published = (metrics.published||0) + 1
          this.relayMetrics.set(relay, metrics)
        })
        publishPromises.on('failed', (relay)=> {
          const m = this.relayMeta.get(relay) || { url: relay }
          m.failures = (m.failures||0)+1
          m.lastFailure = Date.now()
          this.relayMeta.set(relay, m)
          const metrics = this.relayMetrics.get(relay) || { publishFailed:0 }
          metrics.publishFailed = (metrics.publishFailed||0) + 1
          this.relayMetrics.set(relay, metrics)
        })
      }

      // Wait for publish promises to settle (nostr-tools may return an array of promises)
      let results = []
      try { results = await Promise.allSettled(publishPromises) } catch(e) { results = [] }

      const successful = results.filter(r => r.status === 'fulfilled')
      const failed = results.filter(r => r.status === 'rejected')

      if (successful.length === 0) {
        // enqueue for retry
        this.enqueuePublish(event)
        this.emitEvent('publishFailed', { eventId: event.id, error: 'No successful publishes; queued' })
        throw new Error('Failed to publish to any relays; queued for retry')
      }

      this.emitEvent('eventPublished', {
        eventId: event.id,
        successfulRelays: successful.length,
        failedRelays: failed.length,
        totalRelays: targets.length
      })

      return { successful: successful.length, failed: failed.length, total: targets.length }
    } catch (error) {
      console.error('❌ Failed to publish event:', error)
      // enqueue on unexpected error
      this.enqueuePublish(event)
      this.emitEvent('publishFailed', { eventId: event.id, error: error?.message || String(error) })
      throw error
    }
  }

  // Subscribe to events from read relays
  subscribeToEvents(filters, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Relay manager not initialized')
    }
    const selected = this.selectRelaysForRead(options.limit || 6)
    if (!selected || selected.length === 0) throw new Error('No read-enabled relays available')

    // Normalize filters into a key to dedupe subscriptions
    const key = this._normalizeSubscriptionKey(filters, selected)
    if (this.subscriptionRegistry.has(key)) {
      // reuse existing subscription: add listeners and bump refCount
      const entry = this.subscriptionRegistry.get(key)
      entry.refCount = (entry.refCount || 1) + 1
      // attach additional listeners from options
      if (options.onevent) entry.listeners.add(options.onevent)
      if (options.oneose) entry.listeners.add(options.oneose)
      if (options.onclose) entry.listeners.add(options.onclose)
      this.subscriptionRegistry.set(key, entry)
      return {
        unsubscribe: () => {
          entry.refCount -= 1
          entry.listeners.delete(options.onevent)
          entry.listeners.delete(options.oneose)
          entry.listeners.delete(options.onclose)
          if (entry.refCount <= 0) {
            try { entry.sub.unsub() } catch(e) {}
            this.subscriptionRegistry.delete(key)
          }
        }
      }
    }

    console.log(`📥 Subscribing to events from ${selected.length} relays`) 
    const sub = this.pool.subscribeMany(selected, filters, { ...options, maxWait: options.maxWait || 10000 })

    // Wrap and forward events to registered listeners
    const listeners = new Set()
    if (options.onevent) listeners.add(options.onevent)
    if (options.oneose) listeners.add(options.oneose)
    if (options.onclose) listeners.add(options.onclose)

    // pool.subscribeMany typically returns an object with unsub or close and sets callbacks on it
    // We attach a small adapter if sub provides on('event') style
    if (sub && typeof sub.on === 'function') {
      sub.on('event', (event) => listeners.forEach(fn => { try { fn(event) } catch(e){ console.error('subscription listener', e) } }))
      sub.on('eose', () => listeners.forEach(fn => { try { if (typeof fn === 'function') fn({ type: 'eose' }) } catch(e){}}))
      sub.on('close', (r) => listeners.forEach(fn => { try { if (typeof fn === 'function') fn({ type: 'close', reasons: r }) } catch(e){}}))
    }

    this.subscriptionRegistry.set(key, { sub, listeners, refCount: 1 })

    return {
      unsubscribe: () => {
        const entry = this.subscriptionRegistry.get(key)
        if (!entry) return
        entry.refCount -= 1
        if (entry.refCount <= 0) {
          try { entry.sub.unsub() } catch(e) {}
          this.subscriptionRegistry.delete(key)
        }
      }
    }
  }

  // Normalize filters + relay list into a stable key string
  _normalizeSubscriptionKey(filters, relays) {
    try {
      const sortedRelays = (relays || []).slice().sort().join(',')
      const norm = JSON.stringify(filters, Object.keys(filters).sort())
      return `${sortedRelays}|${norm}`
    } catch (e) {
      return `${Date.now()}`
    }
  }

  // Get a single event
  async getEvent(filters, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Relay manager not initialized')
    }
    // caching for profile lookups (kind:0 + single author)
    try {
      if (filters && filters.kinds && filters.kinds.includes(0) && filters.authors && filters.authors.length === 1) {
        const pub = filters.authors[0]
        const cached = this.profileCache.get(pub)
        if (cached && (Date.now() - cached.ts) < this.PROFILE_CACHE_TTL) return cached.profile
      }

      // select prioritized relays
      const selected = this.selectRelaysForRead(options.limit || 4)
      if (!selected || selected.length === 0) throw new Error('No read-enabled relays available')

      // try prioritized read with timeout
      const READ_TIMEOUT = (options.readTimeoutMs || 3000)
      let ev = null
      try {
          // record requests against selected relays for throttling
          selected.forEach(u => this.recordRelayRequest(u))
          ev = await this.withTimeout(this.pool.get(selected, filters), READ_TIMEOUT)
      } catch (e) {
        // fallback to full list
        try {
          const all = this.getReadRelays().map(r=>r.url)
            // record requests for fallback relays as well
            all.forEach(u => this.recordRelayRequest(u))
            ev = await this.pool.get(all, filters)
        } catch (e2) {
          throw e2
        }
      }

      // if profile event, cache
      if (ev && ev.kind === 0 && ev.pubkey) {
        try { this.profileCache.set(ev.pubkey, { profile: ev, ts: Date.now() }) } catch (e) {}
      }

      return ev
    } catch (error) {
      console.error('❌ Failed to get event:', error)
      throw error
    }
  }

  // Start health check monitoring
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)

    console.log(`💓 Started relay health check (every ${this.healthCheckInterval / 1000}s)`)
  }

  // Perform health check on all relays
  async performHealthCheck() {
    console.log('💓 Performing relay health check...')
    const relayStatuses = this.getRelayStatuses()
    const healthPromises = relayStatuses.map(async (relayStatus) => {
      const url = relayStatus.url
      try {
        const connection = this.relayConnections.get(url)
        if (!connection) {
          // Connection not in our map, try to reconnect
          await this.reconnectRelay(url)
          return
  // record publish requests for throttling
  targets.forEach(u => this.recordRelayRequest(u))
        }

        // Check responsiveness via pool.get on this relay with a short timeout
        const testFilters = { kinds: [0], limit: 1 }
        const start = Date.now()
        await this.withTimeout(this.pool.get([url], testFilters), 4000)

        // success: update meta
        const meta = this.relayMeta.get(url) || { url }
        meta.successes = (meta.successes || 0) + 1
        meta.rtt = Date.now() - start
        meta.lastFailure = meta.lastFailure || 0
        meta.attempts = 0
        this.relayMeta.set(url, meta)

        if (relayStatus.status !== 'connected') {
          this.setRelayStatus(url, 'connected', relayStatus.config)
          this.emitEvent('relayHealthy', { url })
        }

      } catch (error) {
        console.warn(`💔 Health check failed for ${url}:`, error?.message || error)
        const meta = this.relayMeta.get(url) || { url }
        meta.failures = (meta.failures || 0) + 1
        meta.lastFailure = Date.now()
        meta.attempts = (meta.attempts || 0) + 1
        this.relayMeta.set(url, meta)

        this.setRelayStatus(url, 'unhealthy', relayStatus.config, error?.message || String(error))
        this.emitEvent('relayUnhealthy', { url, error: error?.message || String(error) })

        // exponential backoff before reconnecting
        const backoff = Math.min(60_000, this.retryDelay * Math.pow(2, meta.attempts || 0))
        setTimeout(() => this.reconnectRelay(url), backoff)
      }
    })

    await Promise.allSettled(healthPromises)

    // recompute scores for prioritization
    Array.from(this.relayMeta.values()).forEach(m => {
      const successRate = (m.successes || 0) + (m.failures || 0) > 0 ? (m.successes || 0) / ((m.successes || 0) + (m.failures || 0)) : 0
      const rttFactor = m.rtt === Infinity ? 0 : 1 / (1 + (m.rtt || 200) / 200)
      m.score = successRate * 0.75 + rttFactor * 0.25
      this.relayMeta.set(m.url, m)
    })

    // try flushing publish queue when health check runs
    this.flushPublishQueue().catch(()=>{})
  }

  // Stop health check monitoring
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
      console.log('💓 Stopped relay health check')
    }
  }

  // Add event listener
  addEventListener(callback) {
    // Type check to ensure only functions are added
    if (typeof callback !== 'function') {
      console.warn('addEventListener: callback must be a function')
      return () => {} // Return empty cleanup function
    }
    this.eventListeners.add(callback)
    return () => this.eventListeners.delete(callback)
  }

  // Emit event to all listeners
  emitEvent(type, data) {
    this.eventListeners.forEach(listener => {
      try {
        if (typeof listener !== 'function') {
          console.warn('Invalid event listener found, removing:', typeof listener)
          this.eventListeners.delete(listener)
          return
        }
        // Defensive type check before calling
        if (typeof listener === 'function') {
        listener({ type, data, timestamp: new Date().toISOString() })
        } else {
          console.warn('emitEvent: listener is not a function, removing from set')
          this.eventListeners.delete(listener)
        }
      } catch (error) {
        console.error('Event listener error:', error)
      }
    })
  }

  // Add a new relay
  async addRelay(url, config = { read: true, write: true }) {
    console.log(`➕ Adding new relay: ${url}`)
    
    try {
      await this.connectToRelay(url, config)
      this.emitEvent('relayAdded', { url, config })
      return true
    } catch (error) {
      console.error(`❌ Failed to add relay ${url}:`, error)
      throw error
    }
  }

  // Remove a relay
  removeRelay(url) {
    console.log(`➖ Removing relay: ${url}`)
    
    // Remove from our tracking
    this.relayConnections.delete(url)
    this.relayStatuses.delete(url)
    this.connectionPromises.delete(url)
    
    // The pool will handle closing the actual connection
    this.emitEvent('relayRemoved', { url })
  }

  // Get connection statistics
  getConnectionStats() {
    const statuses = this.getRelayStatuses()
    const connected = statuses.filter(r => r.status === 'connected').length
    const total = statuses.length
    const writeEnabled = this.getWriteRelays().length
    const readEnabled = this.getReadRelays().length
    
    return {
      total,
      connected,
      disconnected: total - connected,
      writeEnabled,
      readEnabled,
      healthyPercentage: total > 0 ? Math.round((connected / total) * 100) : 0
    }
  }

  // Cleanup and close all connections
  async cleanup() {
    console.log('🧹 Cleaning up Nostr Relay Manager...')
    
    this.stopHealthCheck()
    
    // Close the pool with all relay URLs
    const allUrls = Array.from(this.relayStatuses.keys())
    if (allUrls.length > 0) {
      this.pool.close(allUrls)
    }
    
    // Clear all data
    this.relayConnections.clear()
    this.relayStatuses.clear()
    this.connectionPromises.clear()
    this.eventListeners.clear()
    
    this.isInitialized = false
    console.log('✅ Nostr Relay Manager cleanup complete')
  }
}

// Create singleton instance
export const nostrRelayManager = new NostrRelayManager()

// Export the class for testing or multiple instances
export { NostrRelayManager }

// Convenience functions
export const initializeRelays = (userRelays) => nostrRelayManager.initialize(userRelays)
export const publishToNostr = (event, targetRelays) => nostrRelayManager.publishEvent(event, targetRelays)
export const subscribeToNostr = (filters, options) => nostrRelayManager.subscribeToEvents(filters, options)
export const getNostrEvent = (filters, options) => nostrRelayManager.getEvent(filters, options)
export const getRelayStats = () => nostrRelayManager.getConnectionStats()
export const addNostrRelay = (url, config) => nostrRelayManager.addRelay(url, config)
export const removeNostrRelay = (url) => nostrRelayManager.removeRelay(url)