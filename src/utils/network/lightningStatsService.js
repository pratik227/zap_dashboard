const MEMPOOL_API_BASE = 'https://mempool.space/api/v1'
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

const cache = {
  ispRanking: { data: null, timestamp: 0 },
  nodeRankings: { data: null, timestamp: 0 },
  statistics: { data: null, timestamp: 0 }
}

function isCacheValid(cacheEntry) {
  return cacheEntry.data && (Date.now() - cacheEntry.timestamp) < CACHE_DURATION
}

export async function getISPRanking() {
  if (isCacheValid(cache.ispRanking)) {
    return cache.ispRanking.data
  }

  try {
    const response = await fetch(`${MEMPOOL_API_BASE}/lightning/nodes/isp-ranking`)
    if (!response.ok) throw new Error('Failed to fetch ISP ranking')

    const data = await response.json()
    cache.ispRanking = { data, timestamp: Date.now() }
    return data
  } catch (error) {
    console.error('Error fetching ISP ranking:', error)
    return cache.ispRanking.data || null
  }
}

export async function getNodeRankings() {
  if (isCacheValid(cache.nodeRankings)) {
    return cache.nodeRankings.data
  }

  try {
    const response = await fetch(`${MEMPOOL_API_BASE}/lightning/nodes/rankings`)
    if (!response.ok) throw new Error('Failed to fetch node rankings')

    const data = await response.json()
    cache.nodeRankings = { data, timestamp: Date.now() }
    return data
  } catch (error) {
    console.error('Error fetching node rankings:', error)
    return cache.nodeRankings.data || null
  }
}

export async function getLightningStatistics() {
  if (isCacheValid(cache.statistics)) {
    return cache.statistics.data
  }

  try {
    const response = await fetch(`${MEMPOOL_API_BASE}/lightning/statistics/latest`)
    if (!response.ok) throw new Error('Failed to fetch lightning statistics')

    const data = await response.json()
    cache.statistics = { data, timestamp: Date.now() }
    return data
  } catch (error) {
    console.error('Error fetching lightning statistics:', error)
    return cache.statistics.data || null
  }
}

export function formatSats(sats) {
  if (sats >= 100000000) {
    return `${(sats / 100000000).toFixed(2)} BTC`
  } else if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(2)}M sats`
  } else if (sats >= 1000) {
    return `${(sats / 1000).toFixed(2)}K sats`
  }
  return `${sats} sats`
}
