import { ref } from 'vue'
import { storageService } from '../../services/StorageService.js'

const BTC_PRICE_STORAGE_KEY = 'btc_price_data'
const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 minutes

// Module-scoped singleton state
const btcPriceUSD = ref(0)
const lastFetched = ref(null)
const isLoading = ref(false)
const error = ref(null)
let refreshInterval = null
let initialized = false

function loadSavedPriceData() {
  const saved = storageService.get(BTC_PRICE_STORAGE_KEY)
  if (!saved) return false
  const { price, timestamp } = saved
  if (price && timestamp && (Date.now() - timestamp < 3600000)) {
    btcPriceUSD.value = price
    lastFetched.value = new Date(timestamp)
    return true
  }
  return false
}

function savePriceData() {
  storageService.set(BTC_PRICE_STORAGE_KEY, {
    price: btcPriceUSD.value,
    timestamp: Date.now()
  })
}

async function fetchPrice() {
  if (isLoading.value) return
  isLoading.value = true
  error.value = null

  try {
    const response = await fetch('https://mempool.space/api/v1/prices')
    if (!response.ok) throw new Error(`API responded with status: ${response.status}`)

    const data = await response.json()
    if (data?.USD) {
      btcPriceUSD.value = data.USD
      lastFetched.value = new Date()
      savePriceData()
      return data
    }
    throw new Error('Invalid API response format')
  } catch (err) {
    error.value = err.message
    if (btcPriceUSD.value === 0) loadSavedPriceData()
  } finally {
    isLoading.value = false
  }
}

function startAutoRefresh() {
  if (refreshInterval) return
  refreshInterval = setInterval(fetchPrice, REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

function satsToUSD(sats) {
  if (!sats || !btcPriceUSD.value) return 0
  return (sats / 100000000) * btcPriceUSD.value
}

function formatUSD(amount, options = {}) {
  const { decimals = 2, symbol = '$' } = options
  if (typeof amount !== 'number' || isNaN(amount)) return `${symbol}0.00`
  return `${symbol}${amount.toFixed(decimals)}`
}

// Boot: load cached price immediately (synchronous, no lifecycle hook needed)
loadSavedPriceData()

export function useBtcPrice() {
  // Start polling on first consumer — runs for app lifetime
  if (!initialized) {
    initialized = true
    fetchPrice()
    startAutoRefresh()
  }

  return {
    btcPriceUSD,
    lastFetched,
    isLoading,
    error,
    fetchPrice,
    stopAutoRefresh,
    satsToUSD,
    formatUSD
  }
}
