/**
 * Nostr Network Statistics Service
 * Fetches data from public Nostr APIs and relay NIP-11 info documents
 */

const NOSTR_WATCH_API = 'https://api.nostr.watch/v1'
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

// Well-known relays for NIP-11 probing (top relays by traffic)
const PROBE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://eden.nostr.land',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
  'wss://relay.current.fyi',
]

class NostrNetworkService {
  constructor() {
    this.cache = new Map()
  }

  async getCachedOrFetch(key, fetchFn, ttl = CACHE_DURATION) {
    const cached = this.cache.get(key)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < ttl) {
      return cached.data
    }

    try {
      const data = await fetchFn()
      this.cache.set(key, { data, timestamp: now })
      return data
    } catch (error) {
      console.error(`Failed to fetch ${key}:`, error)
      if (cached) return cached.data
      throw error
    }
  }

  /**
   * Get total number of known Nostr relays
   */
  async getTotalRelayCount() {
    return this.getCachedOrFetch('total-relays', async () => {
      const response = await fetch(`${NOSTR_WATCH_API}/relay`)
      if (!response.ok) throw new Error(`Failed to fetch relay list: ${response.statusText}`)
      const data = await response.json()
      return Array.isArray(data) ? data.length : 0
    })
  }

  /**
   * Get list of currently online relays from nostr.watch
   */
  async getOnlineRelays() {
    return this.getCachedOrFetch('online-relays', async () => {
      const response = await fetch(`${NOSTR_WATCH_API}/online`)
      if (!response.ok) throw new Error(`Failed to fetch online relays: ${response.statusText}`)
      const data = await response.json()
      // Returns array of relay URLs
      return Array.isArray(data) ? data : []
    })
  }

  /**
   * Get relay info (NIP-11) for a list of relays
   */
  async getRelayInfo(relayUrl) {
    const host = relayUrl.replace(/^wss?:\/\//, '').replace(/\/.*$/, '')
    const infoUrl = `https://${host}`

    return this.getCachedOrFetch(`relay-info-${host}`, async () => {
      try {
        const response = await fetch(infoUrl, {
          headers: { Accept: 'application/nostr+json' },
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) return null
        return response.json()
      } catch (e) {
        return null // Relay unreachable or no NIP-11
      }
    }, 30 * 60 * 1000) // Cache relay info longer (30 min)
  }

  /**
   * Probe a sample of relays for NIP-11 support info
   */
  async getRelayCapabilities() {
    return this.getCachedOrFetch('relay-capabilities', async () => {
      const results = await Promise.allSettled(
        PROBE_RELAYS.map(async (url) => {
          const info = await this.getRelayInfo(url)
          if (!info) return { url, supported: false }

          const nips = info.support || []
          return {
            url,
            name: info.name || url,
            description: info.description || '',
            nips,
            software: info.software || '',
            version: info.version || '',
            supported: true,
          }
        })
      )

      const relays = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

      // Aggregate NIP support statistics
      const nipSupport = new Map()
      relays.filter(r => r.supported).forEach(relay => {
        relay.nips.forEach(nip => {
          nipSupport.set(nip, (nipSupport.get(nip) || 0) + 1)
        })
      })

      // NIP descriptions for display
      const nipDescriptions = {
        1: 'Basic event publishing',
        4: 'Encrypted DMs',
        5: 'Event deletion',
        7: 'Reactions',
        8: 'Badges',
        9: 'Event deletion sets',
        10: 'Relay discovery',
        11: 'Relay info document',
        13: 'Proof of Work',
        14: 'Subject tag',
        15: 'End of Stored Events',
        18: 'Repost',
        19: 'Encrypted P tags',
        20: 'Anonymous event signing',
        22: 'Comment',
        23: 'Swiss Army Knife events',
        25: 'Reactions',
        26: 'Delegated event signing',
        27: 'Group chat',
        28: 'Public chat',
        29: 'Group metadata events',
        30: 'Groups',
        31: 'Group members',
        32: 'Labeling',
        33: 'Relay list',
        34: 'Dedup',
        36: 'Sensitive content',
        38: 'Status',
        39: 'External identities',
        40: 'Expiration',
        42: 'Authentication',
        45: 'Event counts',
        46: 'NIP-46 Nostr Connect',
        47: 'NIP-47 NWC',
        49: 'Private key encryption',
        50: 'Search',
        51: 'Lists',
        56: 'Reporting',
        57: 'Lightning Zaps',
        58: 'Badges',
        59: 'Badge Awards',
        64: 'Media URLs',
        65: 'Relay list metadata',
        66: 'Relay metadata',
        70: 'Protected events',
        71: 'Video events',
        72: 'Moderation',
        73: 'External content IDs',
        75: 'Zap goals',
        78: 'Application-specific data',
        89: 'Gift Wraps',
        90: 'Event timestamps',
        92: 'Media attachments',
        94: 'File metadata',
        96: 'HTTP File Storage (Blossom)',
        98: 'Live activities',
        99: 'Classifieds'
      }

      return {
        relays,
        nipSupport: Array.from(nipSupport.entries())
          .map(([nip, count]) => ({
            nip,
            count,
            total: relays.filter(r => r.supported).length,
            percentage: Math.round((count / relays.filter(r => r.supported).length) * 100),
            description: nipDescriptions[nip] || `NIP-${nip}`,
          }))
          .sort((a, b) => b.count - a.count),
      }
    })
  }

  /**
   * Get comprehensive Nostr network stats
   */
  async getGlobalStats() {
    return this.getCachedOrFetch('global-stats', async () => {
      const [onlineRelays, totalCount, capabilities] = await Promise.all([
        this.getOnlineRelays(),
        this.getTotalRelayCount(),
        this.getRelayCapabilities(),
      ])

      const onlineCount = onlineRelays.length
      const offlineCount = Math.max(0, totalCount - onlineCount)

      // NIP-50 (search) support count
      const searchSupportCount = capabilities.nipSupport.find(n => n.nip === 50)?.count || 0
      const authSupportCount = capabilities.nipSupport.find(n => n.nip === 42)?.count || 0
      const zapSupportCount = capabilities.nipSupport.find(n => n.nip === 57)?.count || 0

      return {
        totalRelays: totalCount,
        onlineRelays: onlineCount,
        offlineRelays: offlineCount,
        onlinePercentage: totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0,
        relayCapabilities: capabilities,
        topRelays: capabilities.relays.filter(r => r.supported).slice(0, 10),
        searchSupportCount,
        authSupportCount,
        zapSupportCount,
        probedRelays: capabilities.relays.length,
        lastUpdated: Date.now(),
      }
    })
  }

  /**
   * Format number with abbreviations
   */
  formatNumber(num) {
    if (typeof num !== 'number') return 'N/A'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    const now = Date.now()
    const stats = {}
    this.cache.forEach((value, key) => {
      stats[key] = {
        age: Math.round((now - value.timestamp) / 1000),
        isStale: (now - value.timestamp) > CACHE_DURATION,
      }
    })
    return stats
  }
}

export const nostrNetworkService = new NostrNetworkService()
