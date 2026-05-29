const NOSTR_WATCH_API_BASE = 'https://api.nostr.watch/v1'
const CACHE_DURATION = 15 * 60 * 1000

const FEATURED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://nostr.wine',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://nostr.bitcoiner.social',
  'wss://relay.snort.social'
]

class NostrNetworkService {
  constructor() {
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

  async fetchJson(path) {
    const response = await fetch(`${NOSTR_WATCH_API_BASE}${path}`)
    if (!response.ok) {
      throw new Error(`Nostr.watch request failed: ${response.status}`)
    }
    return response.json()
  }

  async getRelayLists() {
    return this.getCachedOrFetch('relay-lists', async () => {
      const [online, publicRelays, paid, offline, nip50, nip42] = await Promise.all([
        this.fetchJson('/online'),
        this.fetchJson('/public'),
        this.fetchJson('/paid'),
        this.fetchJson('/offline'),
        this.fetchJson('/nip/50'),
        this.fetchJson('/nip/42')
      ])

      return {
        online: this.normalizeRelayList(online),
        publicRelays: this.normalizeRelayList(publicRelays),
        paid: this.normalizeRelayList(paid),
        offline: this.normalizeRelayList(offline),
        nip50: this.normalizeRelayList(nip50),
        nip42: this.normalizeRelayList(nip42)
      }
    })
  }

  normalizeRelayList(value) {
    if (Array.isArray(value)) return value.filter(Boolean)
    if (value && typeof value === 'object') {
      return Object.values(value).flat().filter(Boolean)
    }
    return []
  }

  async getRelayInfo(relayUrl) {
    const httpUrl = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://')
    const startedAt = performance.now()

    const response = await fetch(httpUrl, {
      headers: { Accept: 'application/nostr+json' }
    })
    const responseMs = Math.round(performance.now() - startedAt)

    if (!response.ok) {
      throw new Error(`NIP-11 request failed for ${relayUrl}: ${response.status}`)
    }

    const info = await response.json()
    return {
      relayUrl,
      responseMs,
      name: info.name || new URL(httpUrl).hostname,
      software: info.software || 'Unknown',
      version: info.version || '',
      supportedNips: info.supported_nips || [],
      contact: info.contact || '',
      authRequired: Boolean(info.limitation?.auth_required),
      paymentRequired: Boolean(info.limitation?.payment_required || info.payments_url || info.fees)
    }
  }

  async getFeaturedRelayHealth() {
    return this.getCachedOrFetch('featured-relay-health', async () => {
      const results = await Promise.allSettled(FEATURED_RELAYS.map(relay => this.getRelayInfo(relay)))

      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            ...result.value,
            status: result.value.responseMs > 1500 ? 'slow' : 'online'
          }
        }

        return {
          relayUrl: FEATURED_RELAYS[index],
          name: FEATURED_RELAYS[index].replace('wss://', ''),
          responseMs: null,
          software: 'Unavailable',
          version: '',
          supportedNips: [],
          authRequired: false,
          paymentRequired: false,
          status: 'offline'
        }
      })
    })
  }

  async getNetworkStats() {
    try {
      const [lists, featuredRelays] = await Promise.all([
        this.getRelayLists(),
        this.getFeaturedRelayHealth()
      ])

      const onlineFeatured = featuredRelays.filter(relay => relay.status === 'online').length
      const slowFeatured = featuredRelays.filter(relay => relay.status === 'slow').length
      const offlineFeatured = featuredRelays.filter(relay => relay.status === 'offline').length
      const responseSamples = featuredRelays
        .map(relay => relay.responseMs)
        .filter(value => typeof value === 'number')
      const averageResponseMs = responseSamples.length
        ? Math.round(responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length)
        : null

      return {
        knownRelays: new Set([
          ...lists.online,
          ...lists.publicRelays,
          ...lists.offline,
          ...lists.paid
        ]).size,
        onlineRelays: lists.online.length,
        publicRelays: lists.publicRelays.length,
        paidRelays: lists.paid.length,
        offlineRelays: lists.offline.length,
        nip50Relays: lists.nip50.length,
        nip42Relays: lists.nip42.length,
        featuredRelays,
        onlineFeatured,
        slowFeatured,
        offlineFeatured,
        averageResponseMs,
        lastUpdated: Date.now(),
        isFallback: false
      }
    } catch (error) {
      console.error('Failed to load Nostr network stats:', error)
      return this.getFallbackStats()
    }
  }

  getFallbackStats() {
    const featuredRelays = FEATURED_RELAYS.map((relayUrl, index) => ({
      relayUrl,
      name: relayUrl.replace('wss://', ''),
      responseMs: index < 6 ? 400 + index * 90 : null,
      software: index < 6 ? 'NIP-11 relay' : 'Unavailable',
      version: '',
      supportedNips: index < 4 ? [1, 9, 11, 20, 42, 50] : [1, 11, 20],
      authRequired: index === 2,
      paymentRequired: index === 3,
      status: index < 6 ? 'online' : 'offline'
    }))

    return {
      knownRelays: 0,
      onlineRelays: 0,
      publicRelays: 0,
      paidRelays: 0,
      offlineRelays: 0,
      nip50Relays: 0,
      nip42Relays: 0,
      featuredRelays,
      onlineFeatured: 6,
      slowFeatured: 0,
      offlineFeatured: 2,
      averageResponseMs: 625,
      lastUpdated: Date.now(),
      isFallback: true
    }
  }

  formatNumber(value) {
    if (value === null || value === undefined) return 'N/A'
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toString()
  }

  formatLatency(value) {
    if (value === null || value === undefined) return 'N/A'
    return `${value} ms`
  }

  clearCache() {
    this.cache.clear()
  }
}

export const nostrNetworkService = new NostrNetworkService()
