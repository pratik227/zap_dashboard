// Notification helper utilities for content detection and metadata

/**
 * Detect content type from event or context
 */
export const detectContentType = (data) => {
  if (!data) return null

  // Check explicit contentType
  if (data.contentType) return data.contentType

  // Check event kind
  if (data.kind) {
    if (data.kind === 1) return 'note'
    if (data.kind === 30023) return 'long_form'
    if (data.kind === 31923) return 'campaign'
    if (data.kind === 31922 || data.kind === 31925) return 'event'
  }

  // Check event tags
  if (data.tags && Array.isArray(data.tags)) {
    const hasArticleTag = data.tags.some(tag => tag[0] === 'article' || tag[0] === 'a')
    if (hasArticleTag) return 'article'

    const hasCampaignTag = data.tags.some(tag => tag[0] === 'campaign')
    if (hasCampaignTag) return 'campaign'

    const hasEventTag = data.tags.some(tag => tag[0] === 'event' || tag[0] === 'e')
    if (hasEventTag) return 'event'
  }

  // Check eventId pattern or context
  if (data.eventId) {
    const eventIdStr = data.eventId.toLowerCase()
    if (eventIdStr.includes('campaign')) return 'campaign'
    if (eventIdStr.includes('article') || eventIdStr.includes('long')) return 'article'
  }

  return 'note' // Default fallback
}

/**
 * Generate action URL for navigation
 */
export const generateActionUrl = (notificationType, data) => {
  const baseUrl = window.location.origin

  // Zap notifications
  if (notificationType === 'zap_received' || notificationType === 'zap_sent') {
    if (data.contentId) {
      const contentType = data.contentType || detectContentType(data)

      if (contentType === 'campaign') {
        return `${baseUrl}?page=campaign-view&id=${data.contentId}`
      }
      if (contentType === 'article' || contentType === 'long_form') {
        return `${baseUrl}?page=content&id=${data.contentId}`
      }
      if (contentType === 'event') {
        return `${baseUrl}?page=calendar&id=${data.contentId}`
      }
      if (contentType === 'note') {
        return `${baseUrl}?page=notes&id=${data.contentId}`
      }
    }
    return `${baseUrl}?page=zap-feed`
  }

  // Engagement notifications
  if (notificationType.startsWith('engagement_')) {
    if (data.contentId) {
      return `${baseUrl}?page=content&id=${data.contentId}`
    }
    return `${baseUrl}?page=analytics`
  }

  // Social notifications
  if (notificationType.startsWith('social_')) {
    if (data.pubkey) {
      return `${baseUrl}?page=audience&pubkey=${data.pubkey}`
    }
    return `${baseUrl}?page=audience`
  }

  // Wallet notifications
  if (notificationType === 'balance_change') {
    return `${baseUrl}?page=wallet`
  }

  // Content notifications
  if (notificationType.startsWith('content_')) {
    return `${baseUrl}?page=content`
  }

  // Default
  return `${baseUrl}?page=dashboard`
}

/**
 * Extract content metadata from event or data
 */
export const extractContentMetadata = (data) => {
  const metadata = {}

  if (!data) return metadata

  // Extract title
  if (data.title) {
    metadata.title = data.title
  } else if (data.content) {
    // Extract first line or truncate content
    const firstLine = data.content.split('\n')[0]
    metadata.title = firstLine.length > 50
      ? firstLine.substring(0, 50) + '...'
      : firstLine
  }

  // Extract author info
  if (data.author) {
    metadata.author = data.author
  } else if (data.pubkey) {
    metadata.authorPubkey = data.pubkey
  }

  // Extract tags
  if (data.tags && Array.isArray(data.tags)) {
    metadata.tags = data.tags
      .filter(tag => tag[0] === 't')
      .map(tag => tag[1])
      .slice(0, 5) // Limit to 5 tags
  }

  // Extract summary or description
  if (data.summary) {
    metadata.summary = data.summary
  } else if (data.description) {
    metadata.summary = data.description
  }

  // Extract image
  if (data.image) {
    metadata.image = data.image
  }

  // Extract published date
  if (data.created_at) {
    metadata.publishedAt = new Date(data.created_at * 1000).toISOString()
  } else if (data.timestamp) {
    metadata.publishedAt = data.timestamp
  }

  return metadata
}

/**
 * Format notification message with content context
 */
export const formatNotificationMessage = (type, data) => {
  const contentType = data.contentType || detectContentType(data)
  const amount = data.amount
  const sender = data.sender?.name || 'Anonymous'

  switch (type) {
    case 'zap_received':
      if (contentType === 'campaign') {
        return `${sender} zapped ${amount} sats to your campaign`
      }
      if (contentType === 'article' || contentType === 'long_form') {
        return `${sender} zapped ${amount} sats to your article`
      }
      if (contentType === 'event') {
        return `${sender} zapped ${amount} sats to your event`
      }
      if (contentType === 'note') {
        return `${sender} zapped ${amount} sats to your note`
      }
      return `${sender} sent you ${amount} sats`

    case 'engagement_reply':
      return `${sender} replied to your ${contentType || 'post'}`

    case 'engagement_repost':
      return `${sender} reposted your ${contentType || 'post'}`

    case 'engagement_reaction':
      return `${sender} reacted to your ${contentType || 'post'}`

    case 'engagement_mention':
      return `${sender} mentioned you in a ${contentType || 'post'}`

    case 'social_new_follower':
      return `${sender} started following you`

    case 'social_profile_mention':
      return `${sender} mentioned your profile`

    case 'content_published':
      return `Your ${contentType || 'content'} has been published`

    case 'content_milestone':
      const milestone = data.milestone || '100'
      return `Your ${contentType || 'content'} reached ${milestone} ${data.milestoneType || 'views'}`

    default:
      return data.message || 'New notification'
  }
}

/**
 * Get icon name for content type
 */
export const getContentTypeIcon = (contentType) => {
  const icons = {
    campaign: 'IconTarget',
    article: 'IconFileText',
    note: 'IconNote',
    event: 'IconCalendar',
    long_form: 'IconBook'
  }
  return icons[contentType] || 'IconFileText'
}

/**
 * Enrich notification data with content metadata
 */
export const enrichNotificationData = async (notificationType, rawData) => {
  const contentType = detectContentType(rawData)
  const metadata = extractContentMetadata(rawData)
  const actionUrl = generateActionUrl(notificationType, { ...rawData, contentType })

  return {
    ...rawData,
    contentType,
    metadata,
    actionUrl,
    message: formatNotificationMessage(notificationType, { ...rawData, contentType })
  }
}

/**
 * Group notifications by content
 */
export const groupNotificationsByContent = (notifications) => {
  const grouped = {}

  notifications.forEach(notification => {
    const contentId = notification.contentId || 'no-content'

    if (!grouped[contentId]) {
      grouped[contentId] = {
        contentId,
        contentType: notification.contentType,
        notifications: [],
        totalAmount: 0,
        uniqueSenders: new Set()
      }
    }

    grouped[contentId].notifications.push(notification)

    if (notification.data?.amount) {
      grouped[contentId].totalAmount += notification.data.amount
    }

    if (notification.data?.sender?.pubkey) {
      grouped[contentId].uniqueSenders.add(notification.data.sender.pubkey)
    }
  })

  // Convert to array and sort by notification count
  return Object.values(grouped)
    .map(group => ({
      ...group,
      uniqueSenders: group.uniqueSenders.size,
      count: group.notifications.length
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Calculate notification summary statistics
 */
export const calculateNotificationStats = (notifications, timeRange = '24h') => {
  const now = Date.now()
  let cutoffTime = now

  // Calculate cutoff time
  switch (timeRange) {
    case '1h':
      cutoffTime = now - (60 * 60 * 1000)
      break
    case '24h':
      cutoffTime = now - (24 * 60 * 60 * 1000)
      break
    case '7d':
      cutoffTime = now - (7 * 24 * 60 * 60 * 1000)
      break
    case '30d':
      cutoffTime = now - (30 * 24 * 60 * 60 * 1000)
      break
    default:
      cutoffTime = 0
  }

  const filteredNotifications = notifications.filter(n =>
    new Date(n.timestamp).getTime() > cutoffTime
  )

  const stats = {
    total: filteredNotifications.length,
    unread: filteredNotifications.filter(n => !n.read).length,
    byCategory: {},
    byPriority: {},
    totalZapAmount: 0,
    uniqueSenders: new Set()
  }

  filteredNotifications.forEach(notification => {
    // Count by category
    const category = notification.category || 'other'
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1

    // Count by priority
    const priority = notification.priority || 'normal'
    stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1

    // Sum zap amounts
    if (notification.data?.amount) {
      stats.totalZapAmount += notification.data.amount
    }

    // Track unique senders
    if (notification.data?.sender?.pubkey) {
      stats.uniqueSenders.add(notification.data.sender.pubkey)
    }
  })

  stats.uniqueSenders = stats.uniqueSenders.size

  return stats
}

/**
 * Create notification digest/summary
 */
export const createNotificationDigest = (notifications, period = 'daily') => {
  const stats = calculateNotificationStats(notifications, period === 'daily' ? '24h' : '7d')
  const grouped = groupNotificationsByContent(notifications)

  const digest = {
    period,
    generated: new Date().toISOString(),
    summary: {
      totalNotifications: stats.total,
      unreadNotifications: stats.unread,
      totalZapAmount: stats.totalZapAmount,
      uniqueSenders: stats.uniqueSenders
    },
    topContent: grouped.slice(0, 5),
    byCategory: stats.byCategory,
    highlights: []
  }

  // Add highlights
  if (stats.totalZapAmount > 0) {
    digest.highlights.push({
      type: 'zaps',
      message: `Received ${stats.totalZapAmount} sats from ${stats.uniqueSenders} people`
    })
  }

  const highPriorityCount = stats.byPriority.high || 0 + stats.byPriority.urgent || 0
  if (highPriorityCount > 0) {
    digest.highlights.push({
      type: 'priority',
      message: `${highPriorityCount} important notifications need attention`
    })
  }

  return digest
}
