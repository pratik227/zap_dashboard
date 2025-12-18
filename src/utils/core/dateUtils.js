// Date utility functions for calendar functionality

/**
 * Format a date to a readable string
 * @param {Date} date - The date to format
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
 * Format a time to a readable string
 * @param {Date} date - The date to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted time string
 */
export function formatTime(date, options = {}) {
  const defaultOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }

  return date.toLocaleTimeString('en-US', { ...defaultOptions, ...options })
}

/**
 * Format a date and time together
 * @param {Date} date - The date to format
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date) {
  return `${formatDate(date)} at ${formatTime(date)}`
}

/**
 * Check if a date is today
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is today
 */
export function isToday(date) {
  const today = new Date()
  return isSameDay(date, today)
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if the dates are the same day
 */
export function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate()
}

/**
 * Check if a date is in the past
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is in the past
 */
export function isPast(date) {
  return date < new Date()
}

/**
 * Check if a date is in the future
 * @param {Date} date - The date to check
 * @returns {boolean} True if the date is in the future
 */
export function isFuture(date) {
  return date > new Date()
}

/**
 * Get the start of the week for a given date
 * @param {Date} date - The date
 * @param {number} startDay - Day of week to start (0 = Sunday, 1 = Monday)
 * @returns {Date} Start of the week
 */
export function getStartOfWeek(date, startDay = 0) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = (day < startDay ? 7 : 0) + day - startDay
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get the end of the week for a given date
 * @param {Date} date - The date
 * @param {number} startDay - Day of week to start (0 = Sunday, 1 = Monday)
 * @returns {Date} End of the week
 */
export function getEndOfWeek(date, startDay = 0) {
  const result = getStartOfWeek(date, startDay)
  result.setDate(result.getDate() + 6)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get the start of the month for a given date
 * @param {Date} date - The date
 * @returns {Date} Start of the month
 */
export function getStartOfMonth(date) {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get the end of the month for a given date
 * @param {Date} date - The date
 * @returns {Date} End of the month
 */
export function getEndOfMonth(date) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + 1, 0)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Add days to a date
 * @param {Date} date - The date
 * @param {number} days - Number of days to add
 * @returns {Date} New date with days added
 */
export function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Add months to a date
 * @param {Date} date - The date
 * @param {number} months - Number of months to add
 * @returns {Date} New date with months added
 */
export function addMonths(date, months) {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {Date} date - The date to compare
 * @param {Date} baseDate - The base date to compare against (defaults to now)
 * @returns {string} Relative time string
 */
export function getRelativeTime(date, baseDate = new Date()) {
  const diff = date.getTime() - baseDate.getTime()
  const absDiff = Math.abs(diff)
  const isPast = diff < 0

  const minute = 60 * 1000
  const hour = minute * 60
  const day = hour * 24
  const week = day * 7
  const month = day * 30
  const year = day * 365

  let value, unit

  if (absDiff < minute) {
    return isPast ? 'just now' : 'in a moment'
  } else if (absDiff < hour) {
    value = Math.floor(absDiff / minute)
    unit = value === 1 ? 'minute' : 'minutes'
  } else if (absDiff < day) {
    value = Math.floor(absDiff / hour)
    unit = value === 1 ? 'hour' : 'hours'
  } else if (absDiff < week) {
    value = Math.floor(absDiff / day)
    unit = value === 1 ? 'day' : 'days'
  } else if (absDiff < month) {
    value = Math.floor(absDiff / week)
    unit = value === 1 ? 'week' : 'weeks'
  } else if (absDiff < year) {
    value = Math.floor(absDiff / month)
    unit = value === 1 ? 'month' : 'months'
  } else {
    value = Math.floor(absDiff / year)
    unit = value === 1 ? 'year' : 'years'
  }

  return isPast ? `${value} ${unit} ago` : `in ${value} ${unit}`
}

/**
 * Parse a date string in YYYY-MM-DD format
 * @param {string} dateString - The date string to parse
 * @returns {Date} Parsed date
 */
export function parseDateString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a date to YYYY-MM-DD string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a date to HH:MM string
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string
 */
export function toTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Get the number of days in a month
 * @param {number} year - The year
 * @param {number} month - The month (0-11)
 * @returns {number} Number of days in the month
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Get an array of dates for a calendar month view
 * @param {Date} date - The date to get the month for
 * @returns {Array<Date>} Array of dates for the calendar view
 */
export function getCalendarDates(date) {
  const year = date.getFullYear()
  const month = date.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = getStartOfWeek(firstDay)

  const dates = []
  const current = new Date(startDate)

  // Generate 6 weeks (42 days) for consistent calendar grid
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}