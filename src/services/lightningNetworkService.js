const MEMPOOL_API_BASE = 'https://mempool.space/api/v1/lightning'

export const lightningNetworkService = {
  async getNetworkStats(interval = 'latest') {
    try {
      const response = await fetch(`${MEMPOOL_API_BASE}/statistics/${interval}`)
      if (!response.ok) throw new Error('Failed to fetch network stats')
      return await response.json()
    } catch (error) {
      console.error('Error fetching network stats:', error)
      throw error
    }
  },

  async getTopNodesByCapacity() {
    try {
      const response = await fetch(`${MEMPOOL_API_BASE}/nodes/rankings/liquidity`)
      if (!response.ok) throw new Error('Failed to fetch top nodes by capacity')
      return await response.json()
    } catch (error) {
      console.error('Error fetching top nodes by capacity:', error)
      throw error
    }
  },

  async getTopNodesByConnectivity() {
    try {
      const response = await fetch(`${MEMPOOL_API_BASE}/nodes/rankings/connectivity`)
      if (!response.ok) throw new Error('Failed to fetch top nodes by connectivity')
      return await response.json()
    } catch (error) {
      console.error('Error fetching top nodes by connectivity:', error)
      throw error
    }
  },

  async getNodesByCountry() {
    try {
      const response = await fetch(`${MEMPOOL_API_BASE}/nodes/countries`)
      if (!response.ok) throw new Error('Failed to fetch nodes by country')
      return await response.json()
    } catch (error) {
      console.error('Error fetching nodes by country:', error)
      throw error
    }
  },

  async getISPRanking() {
    try {
      const response = await fetch(`${MEMPOOL_API_BASE}/nodes/isp-ranking`)
      if (!response.ok) throw new Error('Failed to fetch ISP ranking')
      return await response.json()
    } catch (error) {
      console.error('Error fetching ISP ranking:', error)
      throw error
    }
  },

  async getHistoricalStats() {
    try {
      const intervals = ['1w', '1m', '3m', '6m']
      const promises = intervals.map(interval =>
        fetch(`${MEMPOOL_API_BASE}/statistics/${interval}`)
          .then(res => res.ok ? res.json() : null)
      )
      const results = await Promise.all(promises)
      return results.filter(r => r !== null)
    } catch (error) {
      console.error('Error fetching historical stats:', error)
      throw error
    }
  },

  formatSats(sats) {
    if (sats >= 100000000) {
      return `${(sats / 100000000).toFixed(2)} BTC`
    } else if (sats >= 1000) {
      return `${(sats / 1000).toFixed(0)}K sats`
    }
    return `${sats} sats`
  },

  formatNumber(num) {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }
}
