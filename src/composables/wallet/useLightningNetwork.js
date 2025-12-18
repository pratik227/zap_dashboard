import { ref, onMounted, computed } from 'vue'
import { lightningNetworkService } from '../../utils/network/lightningNetworkService.js'

export function useLightningNetwork() {
  const globalStats = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  /**
   * Fetch global Lightning Network statistics
   */
  const fetchGlobalStats = async () => {
    isLoading.value = true
    error.value = null

    try {
      const stats = await lightningNetworkService.getGlobalStats()
      globalStats.value = stats
      lastUpdated.value = new Date(stats.lastUpdated)
      return stats
    } catch (err) {
      console.error('Failed to fetch Lightning Network stats:', err)
      error.value = err.message
      // Set fallback data
      globalStats.value = lightningNetworkService.getFallbackStats()
      return globalStats.value
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Format large numbers with abbreviations
   */
  const formatNumber = (num) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B'
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  /**
   * Format BTC amount
   */
  const formatBTC = (btc) => {
    if (btc >= 1000) {
      return (btc / 1000).toFixed(1) + 'K BTC'
    }
    return btc.toFixed(2) + ' BTC'
  }

  /**
   * Format capacity in sats
   */
  const formatCapacity = (sats) => {
    return formatNumber(sats) + ' sats'
  }

  /**
   * Get formatted stats for display
   */
  const formattedStats = computed(() => {
    if (!globalStats.value) return null

    return {
      totalNodes: formatNumber(globalStats.value.totalNodes),
      totalCapacity: formatBTC(globalStats.value.totalCapacityBTC),
      totalCountries: globalStats.value.totalCountries,
      topCountries: globalStats.value.topCountries,
      isFallback: globalStats.value.isFallback || false
    }
  })

  /**
   * Get network health indicator
   */
  const networkHealth = computed(() => {
    if (!globalStats.value) return 'unknown'

    const nodeCount = globalStats.value.totalNodes

    if (nodeCount > 12000) return 'excellent'
    if (nodeCount > 8000) return 'good'
    if (nodeCount > 5000) return 'fair'
    return 'limited'
  })

  /**
   * Refresh data
   */
  const refresh = async () => {
    lightningNetworkService.clearCache()
    return fetchGlobalStats()
  }

  // Auto-fetch on mount
  onMounted(() => {
    fetchGlobalStats()
  })

  return {
    globalStats,
    formattedStats,
    isLoading,
    error,
    lastUpdated,
    networkHealth,
    fetchGlobalStats,
    refresh,
    formatNumber,
    formatBTC,
    formatCapacity
  }
}
