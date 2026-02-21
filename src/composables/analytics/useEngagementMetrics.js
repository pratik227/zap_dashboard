import { ref, reactive, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'

const engagementMetrics = reactive(new Map()) 
const activeSubscriptions = reactive(new Map())
const isLoading = ref(false)
const processedEventIds = new Set()

const batchQueue = reactive(new Set())
const batchTimer = ref(null)
const BATCH_DELAY = 1000
const MAX_BATCH_SIZE = 50

// Load cached engagement metrics from localStorage immediately
const ENGAGEMENT_STORAGE_KEY = 'engagement_metrics_cache'
try {
  const cached = localStorage.getItem(ENGAGEMENT_STORAGE_KEY)
  if (cached) {
    const parsed = JSON.parse(cached)
    Object.entries(parsed).forEach(([eventId, metrics]) => {
      engagementMetrics.set(eventId, metrics)
    })
  }
} catch (e) {
  console.warn('Failed to load engagement metrics from storage at startup:', e)
}

// Background refresh: once relay manager is initialized, refresh engagement for cached eventIds
const _startEngagementBackgroundRefresh = async () => {
  const eventIds = Array.from(engagementMetrics.keys())
  if (!eventIds.length) return
  await nostrRelayManager.ready()
  try {
    // Use batch fetch for all cached eventIds
    for (let i = 0; i < eventIds.length; i += MAX_BATCH_SIZE) {
      fetchEngagementMetricsBatch(eventIds.slice(i, i + MAX_BATCH_SIZE))
    }
  } catch (err) {
    console.warn('Engagement background batch fetch failed:', err)
  }
}
setTimeout(() => { _startEngagementBackgroundRefresh().catch(err => console.warn('Engagement background refresh error:', err)) }, 0)

export function useEngagementMetrics() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  const initializeEngagementData = (eventId) => {
    if (!engagementMetrics.has(eventId)) {
      engagementMetrics.set(eventId, {
        likes: [],
        reposts: [],
        bookmarks: [],
        zaps: [],
        lastFetched: null,
        isLoading: false
      })
    }
  }

  const createEngagementData = (event, type, targetEventId = null) => {
    const authorPubkey = event.pubkey
    const createdAt = event.created_at
    const eventId = event.id

    const referencedEventId = targetEventId || event.tags.find(tag => tag[0] === 'e')?.[1]
    
    if (!referencedEventId) {
      return null
    }

    const baseData = {
      id: eventId,
      authorPubkey,
      createdAt,
      referencedEventId,
      type
    }

    switch (type) {
      case 'like':
        const reaction = event.content || '+'
        return {
          ...baseData,
          reaction,
          isPositive: reaction === '+' || reaction === '❤️' || reaction === '🤙' || reaction === '👍'
        }

      case 'repost':
        return {
          ...baseData,
          content: event.content || '',
          isQuote: event.content.length > 0
        }

      case 'bookmark':
        return {
          ...baseData,
          tags: event.tags || []
        }

      default:
        return baseData
    }
  }

  const processEngagementEvent = (event, targetEventId = null) => {
    if (processedEventIds.has(event.id)) {
      return
    }
    processedEventIds.add(event.id)

    if ([10001, 10002, 10003, 30001, 30002, 30003].includes(event.kind)) {
      const bookmarkedEventIds = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1])
      
      const aTagEventIds = []
      if (targetEventId) {
        aTagEventIds.push(targetEventId)
      }
      
      const allEventIds = [...bookmarkedEventIds, ...aTagEventIds]
      
      if (allEventIds.length > 0) {
        allEventIds.forEach(eventId => {
          if (eventId) {
            initializeEngagementData(eventId)
            const metrics = engagementMetrics.get(eventId)

            const bookmarkData = {
              id: `${event.id}-${eventId}`,
              authorPubkey: event.pubkey,
              createdAt: event.created_at,
              referencedEventId: eventId,
              type: 'bookmark',
              tags: event.tags || [],
              listId: event.id
            }

            const exists = metrics.bookmarks.find(item => item.id === bookmarkData.id)
            if (!exists) {
              metrics.bookmarks.unshift(bookmarkData)
            }
          }
        })
        
        return
      }
    }

    let referencedEventId = targetEventId || event.tags.find(tag => tag[0] === 'e')?.[1]
    
    if (!referencedEventId && !targetEventId) {
      return
    }

    initializeEngagementData(referencedEventId)
    const metrics = engagementMetrics.get(referencedEventId)

    let engagementData = null
    let targetArray = null

    switch (event.kind) {
      case 7:
        engagementData = createEngagementData(event, 'like', referencedEventId)
        targetArray = metrics.likes
        break

      case 6:
        engagementData = createEngagementData(event, 'repost', referencedEventId)
        targetArray = metrics.reposts
        break

      case 10001:
      case 10002:
      case 10003:
      case 30001:
      case 30002:
      case 30003:
        engagementData = createEngagementData(event, 'bookmark', referencedEventId)
        targetArray = metrics.bookmarks
        break

      default:
        return
    }

    if (engagementData && targetArray) {
      const exists = targetArray.find(item => item.id === engagementData.id)
      if (!exists) {
        targetArray.unshift(engagementData)
      }
    }
  }

  const fetchEngagementMetricsBatch = async (eventIds) => {
    if (!eventIds.length || !isAuthenticated.value) return

    const uniqueEventIds = [...new Set(eventIds)]

    uniqueEventIds.forEach(eventId => {
      initializeEngagementData(eventId)
      const metrics = engagementMetrics.get(eventId)
      metrics.isLoading = true
    })

    try {
      const filters = [
        {
          kinds: [7],
          "#e": uniqueEventIds,
          limit: 500
        },
        {
          kinds: [6],
          "#e": uniqueEventIds,
          limit: 200
        },
        {
          kinds: [10001, 10002, 10003, 30001, 30002, 30003],
          "#e": uniqueEventIds,
          limit: 100
        }
      ]

      if (currentUser.value?.pubkey) {
        filters.push({
          kinds: [10001, 10002, 10003, 30001, 30002, 30003],
          authors: [currentUser.value.pubkey],
          limit: 50
        })
      }

      // Rely on relay manager for deduplication
      const subscriptionId = `engagement-batch-${Date.now()}`

      const subscription = nostrRelayManager.subscribeToEvents(filters, {
        onevent: (event) => {
          processEngagementEvent(event)
        },
        oneose: () => {
          uniqueEventIds.forEach(eventId => {
            const metrics = engagementMetrics.get(eventId)
            if (metrics) {
              metrics.isLoading = false
              metrics.lastFetched = new Date().toISOString()
            }
          })
          // Close after grace period for late-arriving events
          setTimeout(() => {
            subscription?.close()
            activeSubscriptions.delete(subscriptionId)
          }, 3000)
        },
        onclose: (reason) => {
          uniqueEventIds.forEach(eventId => {
            const metrics = engagementMetrics.get(eventId)
            if (metrics) {
              metrics.isLoading = false
            }
          })
          activeSubscriptions.delete(subscriptionId)
        }
      })

      activeSubscriptions.set(subscriptionId, subscription)

      // Hard timeout fallback in case EOSE never arrives
      setTimeout(() => {
        if (activeSubscriptions.has(subscriptionId)) {
          subscription?.close()
          activeSubscriptions.delete(subscriptionId)
        }
      }, 30000)

    } catch (error) {
      console.error('Failed to fetch engagement metrics:', error)
      uniqueEventIds.forEach(eventId => {
        const metrics = engagementMetrics.get(eventId)
        if (metrics) {
          metrics.isLoading = false
        }
      })
    }
  }

  const queueEngagementFetch = (eventId) => {
    if (!eventId || activeSubscriptions.has(`engagement-${eventId}`)) {
      return
    }

    batchQueue.add(eventId)

    if (batchTimer.value) {
      clearTimeout(batchTimer.value)
    }

    batchTimer.value = setTimeout(() => {
      if (batchQueue.size > 0) {
        const eventIds = Array.from(batchQueue)
        batchQueue.clear()
        
        const chunks = []
        for (let i = 0; i < eventIds.length; i += MAX_BATCH_SIZE) {
          chunks.push(eventIds.slice(i, i + MAX_BATCH_SIZE))
        }

        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            fetchEngagementMetricsBatch(chunk)
          }, index * 500)
        })
      }
    }, BATCH_DELAY)
  }

  const startEngagementTracking = (eventId) => {
    if (!eventId) return

    if (activeSubscriptions.has(`engagement-${eventId}`)) {
      return
    }

    const existingMetrics = engagementMetrics.get(eventId)
    if (existingMetrics?.lastFetched) {
      const lastFetched = new Date(existingMetrics.lastFetched)
      const now = new Date()
      const timeDiff = now - lastFetched
      if (timeDiff < 5 * 60 * 1000) {
        return
      }
    }

    queueEngagementFetch(eventId)
  }

  const getEngagementMetrics = (eventId) => {
    if (!eventId) return null
    return engagementMetrics.get(eventId) || null
  }

  const getEngagementCounts = (eventId) => {
    const metrics = getEngagementMetrics(eventId)
    if (!metrics) {
      return {
        likes: 0,
        reposts: 0,
        bookmarks: 0,
        totalEngagement: 0
      }
    }

    const likes = metrics.likes.length
    const reposts = metrics.reposts.length
    const bookmarks = metrics.bookmarks.length

    return {
      likes,
      reposts,
      bookmarks,
      totalEngagement: likes + reposts + bookmarks
    }
  }

  const getCombinedEngagement = (eventId, zapData = null) => {
    const engagementCounts = getEngagementCounts(eventId)
    const zapCount = zapData?.count || 0
    const zapAmount = zapData?.totalAmount || 0

    return {
      ...engagementCounts,
      zaps: zapCount,
      zapAmount,
      totalEngagement: engagementCounts.totalEngagement + zapCount
    }
  }

  const cleanup = () => {
    activeSubscriptions.forEach((subscription) => {
      try {
        if (subscription && typeof subscription.close === 'function') {
          subscription.close()
        }
      } catch (error) {
        console.warn('Error closing engagement subscription:', error)
      }
    })
    
    activeSubscriptions.clear()
    batchQueue.clear()
    
    if (batchTimer.value) {
      clearTimeout(batchTimer.value)
      batchTimer.value = null
    }
  }

  const allEngagementMetrics = computed(() => {
    const result = {}
    engagementMetrics.forEach((value, key) => {
      result[key] = value
    })
    return result
  })

  const startLongFormContentTracking = (eventId, pubkey, dTag) => {
    if (!eventId || !pubkey || !dTag) {
      startEngagementTracking(eventId)
      return
    }

    startEngagementTracking(eventId)

    const aTagIdentifier = `30023:${pubkey}:${dTag}`

    const aSubKey = `engagement-a-${aTagIdentifier}`
    if (!activeSubscriptions.has(aSubKey)) {
      const aTagFilters = [
        {
          kinds: [7],
          "#a": [aTagIdentifier],
          limit: 200
        },
        {
          kinds: [6],
          "#a": [aTagIdentifier],
          limit: 100
        },
        {
          kinds: [10001, 10002, 10003, 30001, 30002, 30003],
          "#a": [aTagIdentifier],
          limit: 50
        }
      ]

      const subscription = nostrRelayManager.subscribeToEvents(aTagFilters, {
        onevent: (event) => {
          processEngagementEvent(event, eventId)
        },
        oneose: () => {
          // Close after grace period for late-arriving events
          setTimeout(() => {
            subscription?.close()
            activeSubscriptions.delete(aSubKey)
          }, 3000)
        },
        onclose: () => {
          activeSubscriptions.delete(aSubKey)
        }
      })

      activeSubscriptions.set(aSubKey, subscription)

      // Hard timeout fallback
      setTimeout(() => {
        if (activeSubscriptions.has(aSubKey)) {
          subscription?.close()
          activeSubscriptions.delete(aSubKey)
        }
      }, 30000)
    }
  }

  return {
    startEngagementTracking,
    startLongFormContentTracking,
    getEngagementMetrics,
    getEngagementCounts,
    getCombinedEngagement,
    cleanup,

    allEngagementMetrics,
    isLoading,

    activeSubscriptions: computed(() => Array.from(activeSubscriptions.keys())),
    processedEventIds: computed(() => processedEventIds.size)
  }
}
