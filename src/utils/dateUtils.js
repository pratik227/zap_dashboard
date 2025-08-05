/**
 * Format a date for display
 * @param {number|string|Date} timestamp - Unix timestamp, ISO string, or Date object
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp, options = {}) {
  if (!timestamp) return ''
  
  let date
  
  // Handle different timestamp formats
  if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === 'number') {
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1))
  } else {
    date = new Date(timestamp)
  }
  
  // Default options
  const defaultOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }
  
  // Merge options
  const formatOptions = { ...defaultOptions, ...options }
  
  return date.toLocaleDateString('en-US', formatOptions)
}

/**
 * Format a time ago string (e.g., "2 hours ago")
 * @param {number|string|Date} timestamp - Unix timestamp, ISO string, or Date object
 * @returns {string} Time ago string
 */
export function formatTimeAgo(timestamp) {
  if (!timestamp) return ''
  
  let date
  
  // Handle different timestamp formats
  if (timestamp instanceof Date) {
    date = timestamp
  } else if (typeof timestamp === 'number') {
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    date = new Date(timestamp * (timestamp < 10000000000 ? 1000 : 1))
  } else {
    date = new Date(timestamp)
  }
  
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  if (diff < 2629800000) return `${Math.floor(diff / 604800000)}w ago`
  if (diff < 31557600000) return `${Math.floor(diff / 2629800000)}mo ago`
  return `${Math.floor(diff / 31557600000)}y ago`
}

/**
 * Calculate days remaining until a date
 * @param {number|string|Date} endDate - End date (Unix timestamp, ISO string, or Date object)
 * @returns {Object} Days remaining info
 */
export function getDaysRemaining(endDate) {
  if (!endDate) return { days: null, text: 'No deadline' }
  
  let date
  
  // Handle different timestamp formats
  if (endDate instanceof Date) {
    date = endDate
  } else if (typeof endDate === 'number') {
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    date = new Date(endDate * (endDate < 10000000000 ? 1000 : 1))
  } else {
    date = new Date(endDate)
  }
  
  const now = new Date()
  const diff = date - now
  
  if (diff <= 0) return { days: 0, text: 'Ended' }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const text = days === 1 ? '1 day left' : `${days} days left`
  
  return { days, text }
}

/**
 * Format a date range
 * @param {number|string|Date} startDate - Start date
 * @param {number|string|Date} endDate - End date
 * @returns {string} Formatted date range
 */
export function formatDateRange(startDate, endDate) {
  if (!startDate || !endDate) return ''
  
  const start = formatDate(startDate, { month: 'short', day: 'numeric' })
  const end = formatDate(endDate, { month: 'short', day: 'numeric', year: 'numeric' })
  
  return `${start} - ${end}`
}