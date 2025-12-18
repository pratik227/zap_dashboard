/**
 * Chart Scaling Utilities
 * Google Analytics-style chart scaling with split-axis for small/large value ranges
 */

/**
 * Calculate percentile value from a sorted array
 * @param {number[]} sortedValues - Array of numbers sorted in ascending order
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} - Value at the specified percentile
 */
function calculatePercentile(sortedValues, percentile) {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  const index = (percentile / 100) * (sortedValues.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
}

/**
 * Round value up to next "nice" round number
 * Uses Google Analytics approach: 21, 50, 100, 200, 500, 1K, 2K, 5K, 10K, etc.
 * @param {number} value - Value to round
 * @returns {number} - Nice round number
 */
function roundToNiceNumber(value) {
  if (value <= 0) return 100

  // For very small values (1-21 sats), ensure minimum of 100 for visibility
  if (value <= 21) return 100

  // Find the magnitude (power of 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalized = value / magnitude

  // Round to nice increments: 1, 2, 5, 10
  let multiplier
  if (normalized <= 1) multiplier = 1
  else if (normalized <= 2) multiplier = 2
  else if (normalized <= 5) multiplier = 5
  else multiplier = 10

  const result = multiplier * magnitude

  // Ensure minimum of 100 for small zap visibility
  return Math.max(100, result)
}

/**
 * Format sats value for Y-axis labels
 * @param {number} value - Value in sats
 * @returns {string} - Formatted string
 */
export function formatSats(value) {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toString()
}

/**
 * Calculate median value from sorted array
 * @param {number[]} sortedValues - Sorted array of numbers
 * @returns {number} - Median value
 */
function calculateMedian(sortedValues) {
  if (sortedValues.length === 0) return 0
  const mid = Math.floor(sortedValues.length / 2)
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  }
  return sortedValues[mid]
}

/**
 * Transform value using piecewise linear scale (split axis)
 * Maps small values (0-threshold) to bottom 25% of chart
 * Maps large values (threshold-max) to top 75% of chart
 *
 * @param {number} value - Original value in sats
 * @param {number} splitThreshold - Threshold where axis splits (e.g., 50 sats)
 * @param {number} maxValue - Maximum value in dataset
 * @param {number} splitRatio - Ratio of chart height for small section (0-1, default 0.25)
 * @returns {number} - Transformed value for display
 */
function transformValueWithSplitAxis(value, splitThreshold, maxValue, splitRatio = 0.25) {
  if (value <= splitThreshold) {
    // Small values: map linearly to bottom section (0 to splitRatio * virtualMax)
    // The virtual max is calculated so that splitThreshold maps to splitRatio position
    const virtualMax = maxValue * splitRatio / (1 - splitRatio) + splitThreshold
    return (value / splitThreshold) * (virtualMax * splitRatio)
  } else {
    // Large values: map linearly to top section
    const virtualMax = maxValue * splitRatio / (1 - splitRatio) + splitThreshold
    const bottomSectionMax = virtualMax * splitRatio
    const normalizedLarge = (value - splitThreshold) / (maxValue - splitThreshold)
    const topSectionHeight = virtualMax * (1 - splitRatio)
    return bottomSectionMax + (normalizedLarge * topSectionHeight)
  }
}

/**
 * Calculate smart Y-axis range using nice round numbers
 * Google Analytics approach: detect extreme disparities and use split-axis scale
 *
 * @param {Array} dayData - Array of objects with value property
 * @returns {Object} - Scaling configuration
 */
export function calculateSmartYAxisRange(dayData) {
  // Extract all non-zero values
  const values = dayData.map(d => d.value).filter(v => v > 0)

  if (values.length === 0) {
    return {
      yAxisMax: 100,
      outliers: [],
      hasOutliers: false,
      percentile95: 0,
      useSplitAxis: false,
      transformValue: (val) => val
    }
  }

  const maxValue = Math.max(...values)
  const minValue = Math.min(...values.filter(v => v > 0))
  const sortedValues = [...values].sort((a, b) => a - b)
  const medianValue = calculateMedian(sortedValues)

  // Calculate 95th percentile for outlier detection
  const percentile95 = calculatePercentile(sortedValues, 95)

  // Detect extreme disparity: if max is 20x greater than median, use split axis
  const disparity = maxValue / Math.max(medianValue, 1)
  const useSplitAxis = disparity > 20 && maxValue > 100

  // Determine split threshold for small zaps (1-50 sats by default)
  // Use 25th percentile or 50 sats, whichever is smaller
  const percentile25 = calculatePercentile(sortedValues, 25)
  const splitThreshold = useSplitAxis ? Math.min(50, Math.max(percentile25, 20)) : 0

  // Detect potential outliers (values significantly above 95th percentile)
  const outlierThreshold = percentile95 * 2

  const outlierIndices = []
  dayData.forEach((day, index) => {
    if (day.value > outlierThreshold && day.value > percentile95 * 1.5) {
      outlierIndices.push({
        index,
        value: day.value,
        date: day.label || day.date
      })
    }
  })

  // Calculate Y-axis max
  let yAxisMax = roundToNiceNumber(maxValue * 1.1)

  // Calculate virtual max for split axis
  const virtualMax = useSplitAxis
    ? yAxisMax * 0.25 / 0.75 + splitThreshold
    : yAxisMax

  return {
    yAxisMax,
    virtualMax: Math.round(virtualMax),
    outliers: outlierIndices,
    hasOutliers: outlierIndices.length > 0,
    percentile95: Math.round(percentile95),
    useSplitAxis,
    splitThreshold: Math.round(splitThreshold),
    minValue,
    maxValue,
    disparity: Math.round(disparity),
    transformValue: useSplitAxis
      ? (val) => transformValueWithSplitAxis(val, splitThreshold, yAxisMax, 0.25)
      : (val) => val
  }
}

/**
 * Generate custom Y-axis intervals for split axis
 * Creates intervals that clearly show both small and large value ranges
 *
 * @param {Object} scalingResult - Result from calculateSmartYAxisRange
 * @returns {Array} - Array of axis mark points
 */
export function generateSplitAxisIntervals(scalingResult) {
  const { useSplitAxis, splitThreshold, yAxisMax, virtualMax, transformValue } = scalingResult

  if (!useSplitAxis) {
    return null
  }

  // Create intervals for small section (0, 10, 20, 30, 40, 50)
  const smallIntervals = []
  const smallStep = splitThreshold <= 30 ? 10 : 20
  for (let i = 0; i <= splitThreshold; i += smallStep) {
    smallIntervals.push({
      value: transformValue(i),
      label: i.toString()
    })
  }

  // Create intervals for large section
  const largeIntervals = []
  const niceMax = roundToNiceNumber(yAxisMax)
  const largeStep = niceMax / 4 // Create ~4 intervals in large section

  for (let i = splitThreshold + largeStep; i <= niceMax; i += largeStep) {
    largeIntervals.push({
      value: transformValue(i),
      label: formatSats(Math.round(i))
    })
  }

  return [...smallIntervals, ...largeIntervals]
}

/**
 * Generate ECharts markPoint configuration for outlier points
 * Shows a subtle indicator on the actual data point
 * @param {Array} outliers - Array of outlier objects
 * @param {string} color - Color for markers (default orange)
 * @returns {Object} - ECharts markPoint configuration
 */
export function generateOutlierMarkers(outliers, color = '#f97316') {
  if (!outliers || outliers.length === 0) {
    return null
  }

  return {
    symbol: 'circle',
    symbolSize: 10,
    itemStyle: {
      color: color,
      borderColor: '#fff',
      borderWidth: 2,
      shadowBlur: 6,
      shadowColor: 'rgba(249, 115, 22, 0.4)'
    },
    label: {
      show: false
    },
    data: outliers.map(outlier => ({
      name: 'High Activity',
      coord: [outlier.index, outlier.value],
      value: outlier.value
    }))
  }
}

/**
 * Generate enhanced tooltip formatter with outlier indicators
 * @param {Array} outliers - Array of outlier objects
 * @param {string} unit - Unit label (default 'sats')
 * @param {Object} scalingResult - Result from calculateSmartYAxisRange
 * @returns {Function} - Formatter function for ECharts tooltip
 */
export function generateEnhancedTooltipFormatter(outliers = [], unit = 'sats', scalingResult = null) {
  return function(params) {
    if (!params || !params[0]) return ''

    const data = params[0]
    const dataIndex = data.dataIndex

    // Get original value (before transformation)
    let value = data.value
    if (scalingResult && scalingResult.useSplitAxis && data.data && typeof data.data === 'object') {
      value = data.data.originalValue || data.value
    }

    // Check if this point is an outlier
    const isOutlier = outliers.some(o => o.index === dataIndex)

    let html = `<div style="padding: 8px 12px;">`
    html += `<div style="font-weight: 500; font-size: 12px; color: #6b7280; margin-bottom: 4px;">`
    html += `${data.name}`
    html += `</div>`

    if (isOutlier) {
      html += `<div style="display: flex; align-items: center; gap: 6px;">`
      html += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f97316;"></span>`
      html += `<span style="font-size: 15px; color: #111827; font-weight: 600;">${value.toLocaleString()} ${unit}</span>`
      html += `</div>`
      html += `<div style="font-size: 11px; color: #f97316; margin-top: 2px; margin-left: 14px;">High activity day</div>`
    } else {
      html += `<div style="font-size: 15px; color: #111827; font-weight: 600;">`
      html += `${value.toLocaleString()} ${unit}`
      html += `</div>`
    }

    html += `</div>`
    return html
  }
}

/**
 * Generate split-axis visual indicator (break line)
 * Creates a visual break in the chart to show axis is split
 *
 * @param {Object} scalingResult - Result from calculateSmartYAxisRange
 * @param {string} color - Color for break line
 * @returns {Object} - ECharts markLine configuration
 */
export function generateSplitAxisBreakLine(scalingResult, color = '#e5e7eb') {
  const { useSplitAxis, splitThreshold, transformValue } = scalingResult

  if (!useSplitAxis) {
    return null
  }

  const breakPosition = transformValue(splitThreshold)

  return {
    silent: true,
    symbol: 'none',
    lineStyle: {
      color: color,
      width: 2,
      type: [4, 4]
    },
    label: {
      show: true,
      position: 'insideEndTop',
      formatter: '//  //  //',
      color: '#9ca3af',
      fontSize: 10
    },
    data: [{
      yAxis: breakPosition
    }]
  }
}

/**
 * Apply split-axis transformation to chart data (minimal styling changes)
 * @param {Object} baseConfig - Base ECharts configuration
 * @param {Object} scalingResult - Result from calculateSmartYAxisRange
 * @returns {Object} - Enhanced ECharts configuration with split-axis data transformation
 */
export function applySplitAxisTransformation(baseConfig, scalingResult) {
  const { yAxisMax, virtualMax, useSplitAxis, splitThreshold, transformValue } = scalingResult

  // If not using split axis, return original config
  if (!useSplitAxis) {
    return baseConfig
  }

  // Transform data if using split axis
  let transformedData = baseConfig.series[0]?.data || []
  if (transformedData.length > 0) {
    transformedData = transformedData.map((point) => {
      const originalValue = typeof point === 'object' ? point.value : point
      const transformed = transformValue(originalValue)
      return {
        value: transformed,
        originalValue: originalValue
      }
    })
  }

  // Generate custom intervals for proper y-axis labeling
  const customIntervals = generateSplitAxisIntervals(scalingResult)

  // Update Y-axis to use virtual max with custom intervals
  const yAxisConfig = {
    ...baseConfig.yAxis,
    type: 'value',
    min: 0,
    max: virtualMax,
    interval: null,
    splitNumber: customIntervals?.length || 5,
    axisLabel: {
      ...baseConfig.yAxis?.axisLabel,
      show: true,
      formatter: (value) => {
        if (!customIntervals) return formatSats(value)
        const closest = customIntervals.reduce((prev, curr) =>
          Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
        )
        return Math.abs(closest.value - value) < virtualMax * 0.01 ? closest.label : ''
      }
    },
    splitLine: baseConfig.yAxis?.splitLine || {
      lineStyle: { color: '#f3f4f6' }
    }
  }

  // Update series with transformed data
  const seriesConfig = baseConfig.series.map((series, idx) => ({
    ...series,
    data: idx === 0 ? transformedData : series.data
  }))

  // Update tooltip to show original values
  const tooltipConfig = {
    ...baseConfig.tooltip,
    formatter: function(params) {
      if (!params || !params[0]) return ''
      const data = params[0]
      const value = data.data?.originalValue || data.value
      return `${data.name}: ${Math.round(value).toLocaleString()} sats`
    }
  }

  return {
    ...baseConfig,
    yAxis: yAxisConfig,
    series: seriesConfig,
    tooltip: tooltipConfig
  }
}

/**
 * Apply Google Analytics styling to ECharts configuration with split-axis support
 * @param {Object} baseConfig - Base ECharts configuration
 * @param {Object} scalingResult - Result from calculateSmartYAxisRange
 * @param {string} color - Primary color (default orange)
 * @returns {Object} - Enhanced ECharts configuration
 */
export function applyGoogleAnalyticsStyling(baseConfig, scalingResult, color = '#f97316') {
  const { yAxisMax, virtualMax, outliers, hasOutliers, useSplitAxis, splitThreshold, disparity, transformValue } = scalingResult

  // Transform data if using split axis
  let transformedData = baseConfig.series[0]?.data || []
  if (useSplitAxis && transformedData.length > 0) {
    transformedData = transformedData.map((point, index) => {
      const originalValue = typeof point === 'object' ? point.value : point
      const transformed = transformValue(originalValue)
      return {
        value: transformed,
        originalValue: originalValue,
        itemStyle: originalValue <= splitThreshold ? {
          color: color,
          opacity: 0.9
        } : undefined
      }
    })
  }

  // Enhanced Y-axis configuration
  const customIntervals = useSplitAxis ? generateSplitAxisIntervals(scalingResult) : null

  const yAxisConfig = {
    ...baseConfig.yAxis,
    type: 'value',
    min: 0,
    max: virtualMax,
    interval: useSplitAxis ? null : undefined,
    splitNumber: useSplitAxis ? customIntervals?.length : 5,
    axisLabel: {
      ...baseConfig.yAxis?.axisLabel,
      fontSize: 11,
      color: '#9ca3af',
      formatter: useSplitAxis ? (value) => {
        // Find the closest custom interval
        if (!customIntervals) return formatSats(value)
        const closest = customIntervals.reduce((prev, curr) =>
          Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
        )
        return Math.abs(closest.value - value) < virtualMax * 0.01 ? closest.label : ''
      } : (value) => formatSats(value)
    },
    splitLine: {
      lineStyle: {
        color: '#f3f4f6',
        type: 'solid',
        width: 1
      }
    }
  }

  // Enhanced series configuration with split-axis support
  const seriesConfig = baseConfig.series.map((series, idx) => ({
    ...series,
    data: idx === 0 && useSplitAxis ? transformedData : series.data,
    smooth: 0.3,
    symbolSize: 6,
    showSymbol: useSplitAxis,
    areaStyle: series.areaStyle ? {
      ...series.areaStyle,
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: `${color}30` },
          { offset: 1, color: `${color}05` }
        ]
      }
    } : undefined,
    markPoint: hasOutliers ? {
      ...generateOutlierMarkers(outliers, color),
      data: outliers.map(outlier => ({
        name: 'High Activity',
        coord: [outlier.index, useSplitAxis ? transformValue(outlier.value) : outlier.value],
        value: outlier.value
      }))
    } : undefined,
    markLine: useSplitAxis ? generateSplitAxisBreakLine(scalingResult) : undefined
  }))

  // Enhanced tooltip
  const tooltipConfig = {
    ...baseConfig.tooltip,
    formatter: generateEnhancedTooltipFormatter(outliers, 'sats', scalingResult),
    borderWidth: 0,
    padding: 0,
    backgroundColor: '#ffffff',
    extraCssText: 'box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15); border-radius: 6px;'
  }

  // Enhanced grid for better spacing
  const gridConfig = {
    ...baseConfig.grid,
    top: useSplitAxis ? '15%' : '12%',
    left: '3%',
    right: '4%',
    bottom: '10%',
    containLabel: true
  }

  // Add title/subtitle if using split axis
  const titleConfig = useSplitAxis ? {
    text: '',
    subtext: `Split axis: 0-${splitThreshold} sats (25% height), ${splitThreshold}+ sats (75% height) · ${disparity}x range`,
    subtextStyle: {
      color: '#9ca3af',
      fontSize: 10,
      fontWeight: 'normal'
    },
    left: 'center',
    top: 0
  } : baseConfig.title

  return {
    ...baseConfig,
    yAxis: yAxisConfig,
    series: seriesConfig,
    tooltip: tooltipConfig,
    grid: gridConfig,
    title: titleConfig
  }
}
