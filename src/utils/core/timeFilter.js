// Centralized time filtering utility for zap data
// This ensures consistent filtering logic across all components

/**
 * Filter zaps by time range
 * @param {Array} zaps - Array of zap objects with timestamp property
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d', 'all')
 * @returns {Array} Filtered array of zaps
 */
export function filterZapsByTimeRange(zaps, timeRange) {
  if (!Array.isArray(zaps) || zaps.length === 0) {
    return []
  }
  
  const now = new Date()
  let cutoffTime
  
  switch (timeRange) {
    case '24h':
      cutoffTime = new Date(now - 24 * 60 * 60 * 1000)
      break
    case '7d':
      cutoffTime = new Date(now - 7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      cutoffTime = new Date(now - 30 * 24 * 60 * 60 * 1000)
      break
    case 'all':
    default:
      return zaps // Return all zaps for 'all' time range
  }
  
  return zaps.filter(zap => {
    if (!zap.timestamp) return false
    return new Date(zap.timestamp) > cutoffTime
  })
}

/**
 * Get time range display text
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d', 'all')
 * @returns {string} Human-readable time range text
 */
export function getTimeRangeDisplayText(timeRange) {
  switch (timeRange) {
    case '24h':
      return 'last 24 hours'
    case '7d':
      return 'last 7 days'
    case '30d':
      return 'last 30 days'
    case 'all':
    default:
      return 'all time'
  }
}

/**
 * Get short time range display text
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d', 'all')
 * @returns {string} Short time range text
 */
export function getShortTimeRangeText(timeRange) {
  switch (timeRange) {
    case '24h':
      return '24h'
    case '7d':
      return '7d'
    case '30d':
      return '30d'
    case 'all':
    default:
      return 'All'
  }
}

/**
 * Get zaps for a specific period with custom end date
 * @param {Array} zaps - Array of zap objects with timestamp property
 * @param {string} timeRange - Time range filter ('24h', '7d', '30d')
 * @param {Date} endDate - End date for the period (defaults to now)
 * @returns {Array} Filtered array of zaps for the specified period
 */
export function getZapsForPeriod(zaps, timeRange, endDate = new Date()) {
  if (!Array.isArray(zaps) || zaps.length === 0) {
    return []
  }
  
  if (timeRange === 'all') {
    return zaps // Return all zaps for 'all' time range
  }
  
  let periodDuration
  
  switch (timeRange) {
    case '24h':
      periodDuration = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      break
    case '7d':
      periodDuration = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
      break
    case '30d':
      periodDuration = 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
      break
    default:
      return zaps
  }
  
  const endTime = endDate.getTime()
  const startTime = endTime - periodDuration
  
  return zaps.filter(zap => {
    if (!zap.timestamp) return false
    const zapTime = new Date(zap.timestamp).getTime()
    return zapTime >= startTime && zapTime <= endTime
  })
}

/**
 * Calculate percentage change between two values
 * @param {number} currentValue - Current period value
 * @param {number} previousValue - Previous period value
 * @returns {object} Object containing percentage change and metadata
 */
export function calculatePercentageChange(currentValue, previousValue) {
  // Handle edge cases
  if (previousValue === 0 && currentValue === 0) {
    return { percentage: 0, isNew: false, isInfinite: false, trend: 'neutral' }
  }
  
  if (previousValue === 0 && currentValue > 0) {
    return { percentage: 100, isNew: false, isInfinite: false, trend: 'positive' }
  }
  
  if (previousValue > 0 && currentValue === 0) {
    return { percentage: -100, isNew: false, isInfinite: false, trend: 'negative' }
  }
  
  // Calculate normal percentage change
  const percentage = ((currentValue - previousValue) / previousValue) * 100
  
  // Determine trend
  let trend = 'neutral'
  if (percentage > 0) {
    trend = 'positive'
  } else if (percentage < 0) {
    trend = 'negative'
  }
  
  return {
    percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
    isNew: false,
    isInfinite: false,
    trend
  }
}

/**
 * Calculate metrics for a given set of zaps
 * @param {Array} zaps - Array of zap objects
 * @returns {object} Object containing calculated metrics
 */
export function calculateZapMetrics(zaps) {
  if (!Array.isArray(zaps) || zaps.length === 0) {
    return {
      totalZaps: 0,
      totalSats: 0,
      uniqueSupporters: 0,
      avgZap: 0
    }
  }
  
  const totalZaps = zaps.length
  const totalSats = zaps.reduce((sum, zap) => sum + (zap.amount || 0), 0)
  
  // Calculate unique supporters based on sender pubkey
  const uniquePubkeys = new Set()
  zaps.forEach(zap => {
    const pubkey = zap.sender?.pubkey || zap.zapperPubkey || 'anonymous'
    uniquePubkeys.add(pubkey)
  })
  const uniqueSupporters = uniquePubkeys.size
  
  const avgZap = totalZaps > 0 ? Math.round(totalSats / totalZaps) : 0
  
  return {
    totalZaps,
    totalSats,
    uniqueSupporters,
    avgZap
  }
}

/**
 * Get period comparison data for dashboard metrics
 * @param {Array} allZaps - All zap data
 * @param {string} timeRange - Current time range ('24h', '7d', '30d', 'all')
 * @returns {object} Object containing current and previous period metrics with percentage changes
 */
export function getPeriodComparison(allZaps, timeRange) {
  console.log('🔍 getPeriodComparison called with:', {
    totalZaps: allZaps.length,
    timeRange,
    sampleZap: allZaps[0]
  })
  
  // Filter to only NIP-57 zaps (those with eventId)
  const nip57Zaps = allZaps.filter(zap => zap.eventId)
  
  console.log('📊 NIP-57 zaps found:', nip57Zaps.length)
  
  if (timeRange === 'all') {
    // For 'all' time, we can't calculate a meaningful percentage change
    const currentMetrics = calculateZapMetrics(nip57Zaps)
    return {
      current: currentMetrics,
      previous: { totalZaps: 0, totalSats: 0, uniqueSupporters: 0, avgZap: 0 },
      changes: {
        totalZaps: { percentage: 0, trend: 'neutral', isNew: false },
        totalSats: { percentage: 0, trend: 'neutral', isNew: false },
        uniqueSupporters: { percentage: 0, trend: 'neutral', isNew: false },
        avgZap: { percentage: 0, trend: 'neutral', isNew: false }
      }
    }
  }
  
  const now = new Date()
  
  // Get current period zaps
  const currentPeriodZaps = getZapsForPeriod(nip57Zaps, timeRange, now)
  
  console.log('📈 Current period zaps:', currentPeriodZaps.length)
  
  // Calculate previous period end date
  let periodDuration
  switch (timeRange) {
    case '24h':
      periodDuration = 24 * 60 * 60 * 1000
      break
    case '7d':
      periodDuration = 7 * 24 * 60 * 60 * 1000
      break
    case '30d':
      periodDuration = 30 * 24 * 60 * 60 * 1000
      break
    default:
      periodDuration = 7 * 24 * 60 * 60 * 1000 // Default to 7 days
  }
  
  const previousPeriodEndDate = new Date(now.getTime() - periodDuration)
  const previousPeriodZaps = getZapsForPeriod(nip57Zaps, timeRange, previousPeriodEndDate)
  
  console.log('📉 Previous period zaps:', previousPeriodZaps.length)
  
  // Calculate metrics for both periods
  const currentMetrics = calculateZapMetrics(currentPeriodZaps)
  const previousMetrics = calculateZapMetrics(previousPeriodZaps)
  
  // Calculate percentage changes
  const changes = {
    totalZaps: calculatePercentageChange(currentMetrics.totalZaps, previousMetrics.totalZaps),
    totalSats: calculatePercentageChange(currentMetrics.totalSats, previousMetrics.totalSats),
    uniqueSupporters: calculatePercentageChange(currentMetrics.uniqueSupporters, previousMetrics.uniqueSupporters),
    avgZap: calculatePercentageChange(currentMetrics.avgZap, previousMetrics.avgZap)
  }
  
  console.log('📊 Period comparison result:', {
    current: currentMetrics,
    previous: previousMetrics,
    changes,
    timeRange,
    currentPeriodCount: currentPeriodZaps.length,
    previousPeriodCount: previousPeriodZaps.length
  })
  
  const result = {
    current: currentMetrics,
    previous: previousMetrics,
    changes,
    timeRange,
    currentPeriodCount: currentPeriodZaps.length,
    previousPeriodCount: previousPeriodZaps.length
  }
  
  return result
}