import { ref, onMounted, computed } from 'vue'
import { nostrNetworkService } from '../../utils/network/nostrNetworkService.js'

export function useLightningNetwork() {
  const globalStats = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  const fetchGlobalStats = async () => {
    isLoading.value = true
    error.value = null

    try {
      const stats = await nostrNetworkService.getGlobalStats()
      globalStats.value = stats
      lastUpdated.value = new Date(stats.lastUpdated)
      return stats
    } catch (err) {
      console.error('Failed to fetch Nostr network stats:', err)
      error.value = err.message
    } finally {
      isLoading.value = false
    }
  }

  const formatNumber = (num) => {
    return nostrNetworkService.formatNumber(num)
  }

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return value + '%'
  }

  const formattedStats = computed(() => {
    if (!globalStats.value) return null

    return {
      totalRelays: formatNumber(globalStats.value.totalRelays),
      onlineRelays: formatNumber(globalStats.value.onlineRelays),
      onlinePercentage: globalStats.value.onlinePercentage,
      offlineRelays: formatNumber(globalStats.value.offlineRelays),
      searchSupportCount: formatNumber(globalStats.value.searchSupportCount),
      authSupportCount: formatNumber(globalStats.value.authSupportCount),
      zapSupportCount: formatNumber(globalStats.value.zapSupportCount),
      probedRelays: globalStats.value.probedRelays,
    }
  })

  const networkHealth = computed(() => {
    if (!globalStats.value) return 'unknown'
    const pct = globalStats.value.onlinePercentage
    if (pct > 80) return 'excellent'
    if (pct > 60) return 'good'
    if (pct > 40) return 'fair'
    return 'limited'
  })

  const refresh = async () => {
    nostrNetworkService.clearCache()
    return fetchGlobalStats()
  }

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
    formatPercentage,
  }
}
