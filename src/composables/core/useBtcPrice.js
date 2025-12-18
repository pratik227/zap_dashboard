import { ref, onMounted, onUnmounted } from 'vue'

// Storage key for BTC price data
const BTC_PRICE_STORAGE_KEY = 'btc_price_data'

// Default refresh interval: 5 minutes
const DEFAULT_REFRESH_INTERVAL = 5 * 60 * 1000

export function useBtcPrice() {
  // Reactive state
  const btcPriceUSD = ref(0)
  const lastFetched = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  
  // Refresh interval reference
  let refreshInterval = null
  
  // Load saved price data from localStorage
  const loadSavedPriceData = () => {
    try {
      const savedData = localStorage.getItem(BTC_PRICE_STORAGE_KEY)
      if (savedData) {
        const { price, timestamp } = JSON.parse(savedData)
        
        // Check if the saved data is still fresh (less than 1 hour old)
        const now = Date.now()
        const oneHour = 60 * 60 * 1000
        
        if (price && timestamp && (now - timestamp < oneHour)) {
          btcPriceUSD.value = price
          lastFetched.value = new Date(timestamp)
          console.log('Loaded BTC price from storage:', price)
          return true
        }
      }
    } catch (err) {
      console.error('Failed to load BTC price from storage:', err)
    }
    return false
  }
  
  // Save price data to localStorage
  const savePriceData = () => {
    try {
      const data = {
        price: btcPriceUSD.value,
        timestamp: Date.now()
      }
      localStorage.setItem(BTC_PRICE_STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.error('Failed to save BTC price to storage:', err)
    }
  }
  
  // Fetch the latest BTC price
  const fetchPrice = async () => {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      console.log('🔍 Fetching BTC price from API...')
      const response = await fetch('https://mempool.space/api/v1/prices')
      console.log('📡 API Response status:', response.status)

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }

      const data = await response.json()
      console.log('📊 API Response data:', data)

      if (data && data.USD) {
        console.log('💰 Previous BTC price:', btcPriceUSD.value)
        btcPriceUSD.value = data.USD
        console.log('💰 Updated BTC price to:', btcPriceUSD.value)
        lastFetched.value = new Date()

        // Save to localStorage
        savePriceData()
        console.log('💾 Saved BTC price data to localStorage')
        return data
      } else {
        console.error('❌ Invalid API response format:', data)
        throw new Error('Invalid API response format')
      }
    } catch (err) {
      console.error('❌ Failed to fetch BTC price:', err)
      error.value = err.message

      // If we have a previously loaded price, keep using it
      if (btcPriceUSD.value === 0) {
        const loaded = loadSavedPriceData()
        console.log('🔄 Attempted to load saved price data:', loaded ? 'success' : 'failed')
      }
    } finally {
      isLoading.value = false
    }
  }
  
  // Start periodic refresh
  const startAutoRefresh = (interval = DEFAULT_REFRESH_INTERVAL) => {
    stopAutoRefresh() // Clear any existing interval
    
    refreshInterval = setInterval(() => {
      fetchPrice()
    }, interval)
    
    console.log(`BTC price auto-refresh started (every ${interval / 1000} seconds)`)
  }
  
  // Stop periodic refresh
  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }
  
  // Convert satoshis to USD
  const satsToUSD = (sats) => {
    if (!sats || !btcPriceUSD.value) return 0
    console.log('🧮 Converting', sats, 'sats to USD with BTC price:', btcPriceUSD.value)
    // 1 BTC = 100,000,000 sats
    const usdValue = (sats / 100000000) * btcPriceUSD.value
    console.log('💵 Converted value:', usdValue)
    return usdValue
  }
  
  // Format USD amount
  const formatUSD = (amount, options = {}) => {
    const { decimals = 2, symbol = '$' } = options
    console.log('💲 Formatting USD amount:', amount)
    if (typeof amount !== 'number' || isNaN(amount)) return `${symbol}0.00`
    const formatted = `${symbol}${amount.toFixed(decimals)}`
    console.log('💲 Formatted USD:', formatted)
    return formatted
  }
  
  // Initialize on mount
  onMounted(() => {
    console.log('🚀 useBtcPrice composable mounted')
    // Try to load saved price first
    const hasSavedPrice = loadSavedPriceData()
    console.log('💾 Loaded saved price data:', hasSavedPrice ? 'success' : 'not found or expired')
    console.log('💰 Initial BTC price value:', btcPriceUSD.value)

    // Fetch fresh price data
    fetchPrice()

    // Start auto-refresh
    startAutoRefresh()
  })
  
  // Clean up on unmount
  onUnmounted(() => {
    stopAutoRefresh()
  })
  
  return {
    btcPriceUSD,
    lastFetched,
    isLoading,
    error,
    fetchPrice,
    startAutoRefresh,
    stopAutoRefresh,
    satsToUSD,
    formatUSD
  }
}