const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://offchain.pub',
  'wss://nostr.mom',
  'wss://relayable.org'
]

const CACHE_DURATION = 5 * 60 * 1000
const PROBE_TIMEOUT = 4500
const COUNT_WINDOW_SECONDS = 60

const makeRelayId = () => Math.random().toString(36).slice(2)

const normalizeRelayUrl = (url) => url.replace(/\/$/, '')

const relayInfoUrl = (relayUrl) =>
  normalizeRelayUrl(relayUrl).replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://')

const withTimeout = (promise, timeoutMs, fallback) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ])

class NostrNetworkService {
  constructor(relays = DEFAULT_RELAYS) {
    this.relays = relays.map(normalizeRelayUrl)
    this.cache = new Map()
  }

  async getCachedOrFetch(key, fetchFn) {
    const cached = this.cache.get(key)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }

    try {
      const data = await fetchFn()
      this.cache.set(key, { data, timestamp: now })
      return data
    } catch (error) {
      if (cached) return cached.data
      throw error
    }
  }

  async fetchRelayInfo(url) {
    return withTimeout(
      fetch(relayInfoUrl(url), {
        headers: { Accept: 'application/nostr+json' }
      }).then((response) => (response.ok ? response.json() : null)).catch(() => null),
      PROBE_TIMEOUT,
      null
    )
  }

  probeRelay(url) {
    return new Promise((resolve) => {
      const startedAt = performance.now()
      const requestId = makeRelayId()
      let settled = false
      let eventCount = 0

      const finish = (result) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        try {
          socket?.close()
        } catch {
          // Ignore close failures after failed probes.
        }
        resolve(result)
      }

      const timeout = setTimeout(() => {
        finish({
          url,
          online: false,
          responseTimeMs: null,
          eventCount,
          error: 'Probe timed out'
        })
      }, PROBE_TIMEOUT)

      let socket
      try {
        socket = new WebSocket(url)
      } catch (error) {
        finish({
          url,
          online: false,
          responseTimeMs: null,
          eventCount,
          error: error.message
        })
        return
      }

      socket.onopen = () => {
        const since = Math.floor(Date.now() / 1000) - COUNT_WINDOW_SECONDS
        const responseTimeMs = Math.round(performance.now() - startedAt)
        socket.send(JSON.stringify(['COUNT', requestId, { kinds: [1], since }]))

        setTimeout(() => {
          finish({
            url,
            online: true,
            responseTimeMs,
            eventCount
          })
        }, 1200)
      }

      socket.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data)
          if (payload[0] === 'COUNT' && payload[1] === requestId) {
            eventCount = payload[2]?.count || 0
            finish({
              url,
              online: true,
              responseTimeMs: Math.round(performance.now() - startedAt),
              eventCount
            })
          }
        } catch {
          // Ignore malformed relay frames.
        }
      }

      socket.onerror = () => {
        finish({
          url,
          online: false,
          responseTimeMs: null,
          eventCount,
          error: 'WebSocket connection failed'
        })
      }
    })
  }

  async getRelayHealth() {
    return this.getCachedOrFetch('nostr-relay-health', async () => {
      const probes = await Promise.all(this.relays.map(async (url) => {
        const [health, info] = await Promise.all([
          this.probeRelay(url),
          this.fetchRelayInfo(url)
        ])

        const supportedNips = Array.isArray(info?.supported_nips) ? info.supported_nips : []
        return {
          ...health,
          name: info?.name || new URL(url).hostname,
          description: info?.description || '',
          supportedNips,
          supportsSearch: supportedNips.includes(50),
          supportsAuth: supportedNips.includes(42),
          software: info?.software || 'Unknown'
        }
      }))

      return probes
    })
  }

  async getNetworkStats() {
    const relays = await this.getRelayHealth()
    const onlineRelays = relays.filter((relay) => relay.online)
    const responseTimes = onlineRelays.map((relay) => relay.responseTimeMs).filter(Number.isFinite)
    const eventCount = onlineRelays.reduce((sum, relay) => sum + relay.eventCount, 0)

    return {
      latest: {
        relay_count: relays.length,
        online_relays: onlineRelays.length,
        offline_relays: relays.length - onlineRelays.length,
        avg_response_ms: responseTimes.length
          ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length)
          : 0,
        event_count: eventCount,
        events_per_second: Number((eventCount / COUNT_WINDOW_SECONDS).toFixed(2)),
        nip50_relays: onlineRelays.filter((relay) => relay.supportsSearch).length,
        nip42_relays: onlineRelays.filter((relay) => relay.supportsAuth).length,
        last_updated: Date.now()
      }
    }
  }

  async getTopNodesByCapacity() {
    const relays = await this.getRelayHealth()
    return relays
      .filter((relay) => relay.online)
      .sort((a, b) => b.eventCount - a.eventCount)
      .map((relay) => ({
        publicKey: relay.url,
        alias: relay.name,
        channels: relay.supportedNips.length,
        capacity: relay.eventCount,
        responseTimeMs: relay.responseTimeMs,
        url: relay.url
      }))
  }

  async getTopNodesByConnectivity() {
    const relays = await this.getRelayHealth()
    return relays
      .filter((relay) => relay.online)
      .sort((a, b) => a.responseTimeMs - b.responseTimeMs)
      .map((relay) => ({
        publicKey: relay.url,
        alias: relay.name,
        channels: relay.supportedNips.length,
        capacity: relay.responseTimeMs,
        responseTimeMs: relay.responseTimeMs,
        url: relay.url
      }))
  }

  async getNodesByCountry() {
    const relays = await this.getRelayHealth()
    const supportedNips = new Map()

    relays
      .filter((relay) => relay.online)
      .forEach((relay) => {
        relay.supportedNips.forEach((nip) => {
          supportedNips.set(nip, (supportedNips.get(nip) || 0) + 1)
        })
      })

    return Array.from(supportedNips.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([nip, count]) => ({
        iso: `NIP-${nip}`,
        name: { en: `NIP-${nip}` },
        count,
        share: relays.length ? Number(((count / relays.length) * 100).toFixed(1)) : 0
      }))
  }

  async getISPRanking() {
    const relays = await this.getRelayHealth()
    const onlineRelays = relays.filter((relay) => relay.online)
    const buckets = [
      ['fast', 'Fast response (<500ms)', 0, 0, 0],
      ['steady', 'Steady response (500-1200ms)', 0, 0, 0],
      ['slow', 'Slow response (>1200ms)', 0, 0, 0]
    ]

    onlineRelays.forEach((relay) => {
      const bucket = relay.responseTimeMs < 500 ? buckets[0] : relay.responseTimeMs <= 1200 ? buckets[1] : buckets[2]
      bucket[2] += relay.eventCount
      bucket[3] += relay.supportedNips.length
      bucket[4] += 1
    })

    return {
      ispRanking: buckets.filter((bucket) => bucket[4] > 0)
    }
  }

  async getHistoricalStats() {
    const stats = await this.getNetworkStats()
    return [stats]
  }

  formatSats(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M events/min`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K events/min`
    return `${value} events/min`
  }

  formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  clearCache() {
    this.cache.clear()
  }
}

export const lightningNetworkService = new NostrNetworkService()
