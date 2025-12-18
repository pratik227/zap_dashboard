/**
 * Lightning Network Statistics Service
 * Fetches data from Mempool.space API and provides caching
 */

const MEMPOOL_API_BASE = 'https://mempool.space/api/v1'
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

class LightningNetworkService {
  constructor() {
    this.cache = new Map()
  }

  /**
   * Get cached data or fetch fresh data
   */
  async getCachedOrFetch(key, fetchFn) {
    const cached = this.cache.get(key)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`✅ Using cached data for ${key}`)
      return cached.data
    }

    console.log(`🔄 Fetching fresh data for ${key}`)
    try {
      const data = await fetchFn()
      this.cache.set(key, {
        data,
        timestamp: now
      })
      return data
    } catch (error) {
      console.error(`❌ Failed to fetch ${key}:`, error)
      // Return cached data even if expired
      if (cached) {
        console.log(`⚠️ Using stale cache for ${key}`)
        return cached.data
      }
      throw error
    }
  }

  /**
   * Fetch Lightning Network nodes by country
   * Returns aggregate capacity and number of clearnet nodes per country
   */
  async getNodesByCountry() {
    return this.getCachedOrFetch('nodes-by-country', async () => {
      const response = await fetch(`${MEMPOOL_API_BASE}/lightning/nodes/countries`)
      if (!response.ok) {
        throw new Error(`Failed to fetch nodes by country: ${response.statusText}`)
      }
      const data = await response.json()

      // Process and enrich the data
      return data.map(country => ({
        ...country,
        capacityBTC: parseInt(country.capacity) / 100000000, // Convert sats to BTC
        capacitySats: country.capacity,
        flagEmoji: this.getFlagEmoji(country.iso)
      }))
    })
  }

  /**
   * Get Lightning Network statistics summary
   */
  async getNetworkStats() {
    return this.getCachedOrFetch('network-stats', async () => {
      const response = await fetch(`${MEMPOOL_API_BASE}/lightning/statistics/latest`)
      if (!response.ok) {
        throw new Error(`Failed to fetch network stats: ${response.statusText}`)
      }
      return response.json()
    })
  }

  /**
   * Get top 100 Lightning nodes
   */
  async getTopNodes() {
    return this.getCachedOrFetch('top-nodes', async () => {
      const response = await fetch(`${MEMPOOL_API_BASE}/lightning/nodes/rankings`)
      if (!response.ok) {
        throw new Error(`Failed to fetch top nodes: ${response.statusText}`)
      }
      return response.json()
    })
  }

  /**
   * Get aggregated global stats
   */
  async getGlobalStats() {
    try {
      const [countryData, networkStats] = await Promise.all([
        this.getNodesByCountry(),
        this.getNetworkStats()
      ])

      // Calculate totals
      const totalNodes = countryData.reduce((sum, country) => sum + country.count, 0)
      const totalCapacitySats = countryData.reduce((sum, country) => sum + parseInt(country.capacity), 0)
      const totalCapacityBTC = totalCapacitySats / 100000000

      // Top countries
      const topCountries = countryData
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalNodes,
        totalCapacitySats,
        totalCapacityBTC,
        totalCountries: countryData.length,
        topCountries,
        allCountries: countryData,
        networkStats,
        lastUpdated: Date.now()
      }
    } catch (error) {
      console.error('Failed to fetch global stats:', error)
      // Return fallback data
      return this.getFallbackStats()
    }
  }

  /**
   * Get flag emoji for country ISO code
   */
  getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌍'

    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt())

    return String.fromCodePoint(...codePoints)
  }

  /**
   * Fallback stats for when API is unavailable
   */
  getFallbackStats() {
    return {
      totalNodes: 15000,
      totalCapacitySats: 5000000000000,
      totalCapacityBTC: 50000,
      totalCountries: 120,
      topCountries: [
        {
          name: { en: 'United States' },
          iso: 'US',
          count: 5000,
          share: 33.3,
          capacity: '2000000000000',
          capacityBTC: 20000,
          flagEmoji: '🇺🇸'
        },
        {
          name: { en: 'Germany' },
          iso: 'DE',
          count: 2000,
          share: 13.3,
          capacity: '800000000000',
          capacityBTC: 8000,
          flagEmoji: '🇩🇪'
        },
        {
          name: { en: 'France' },
          iso: 'FR',
          count: 1500,
          share: 10.0,
          capacity: '600000000000',
          capacityBTC: 6000,
          flagEmoji: '🇫🇷'
        }
      ],
      allCountries: [],
      networkStats: null,
      lastUpdated: Date.now(),
      isFallback: true
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
    console.log('🗑️ Lightning Network cache cleared')
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    const now = Date.now()
    const stats = {}

    this.cache.forEach((value, key) => {
      const age = now - value.timestamp
      stats[key] = {
        age: Math.round(age / 1000), // seconds
        isStale: age > CACHE_DURATION,
        expiresIn: Math.max(0, Math.round((CACHE_DURATION - age) / 1000))
      }
    })

    return stats
  }
}

// Export singleton instance
export const lightningNetworkService = new LightningNetworkService()
