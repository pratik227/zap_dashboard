/**
 * useDeskFeed — Per-column Nostr feed with chronological insertion and infinite scroll.
 *
 * Architecture:
 * - Posts are ALWAYS kept in descending created_at order (newest first).
 * - After EOSE (initial load complete), incoming events are classified:
 *     Real-time (created_at within REALTIME_WINDOW of now): auto-prepended to top.
 *     Late historical (older): inserted at the correct chronological position.
 *   No "N new posts" buffer — events just appear in the right place.
 * - Infinite scroll: `loadMore()` opens a one-shot query with `until` set to the
 *   oldest visible post's timestamp. Appends results to the bottom.
 * - Deduplication via Set<eventId> with LRU eviction.
 * - Profile enrichment batched via ProfileService.
 */

import { ref, watch, onUnmounted, computed } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'
import { profileService } from '../../services/nostr/ProfileService.js'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useAudience } from '../audience/useAudience.js'
import { COLUMN_TYPES, LONGFORM_FILTER_MODES, parseLongformFilter } from './useDeskColumns.js'
import { nip19 } from '../../services/nostr/nostrImports.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'

// ── Constants ───────────────────────────────────────────────────
const PAGE_SIZE = 40
const DEDUP_MAX = 800
const PROFILE_BATCH_DEBOUNCE = 800
const LOADING_TIMEOUT = 15000
const REALTIME_WINDOW = 120 // seconds — events within 2 min of now are "real-time"
const NOTE_RECENCY_DAYS = 30
const LONGFORM_RECENCY_DAYS = 365

// ── Factory ─────────────────────────────────────────────────────

export function useDeskFeed(columnRef) {
  const { currentUser } = useNostrAuth()
  const { following } = useAudience()

  // ── Reactive state ────────────────────────────────────────────
  const posts = ref([])           // always sorted desc by created_at
  const isLoading = ref(false)    // initial load
  const isLoadingMore = ref(false) // infinite scroll page load
  const hasMore = ref(true)       // false when a page returns 0 results
  const error = ref('')
  const isLive = ref(false)       // live subscription active post-EOSE

  // ── Internal ──────────────────────────────────────────────────
  const seenIds = new Set()
  let liveSub = null
  let profileBatchTimer = null
  let loadingTimer = null
  const pendingProfilePubkeys = new Set()

  // ── Subscription key (triggers re-subscribe on config change) ─
  const subscriptionKey = computed(() => {
    const col = columnRef.value
    if (!col) return ''
    if (col.type === COLUMN_TYPES.FOLLOWING) {
      return `following:${currentUser.value?.pubkey || ''}:${following.value?.length || 0}`
    }
    if (col.type === COLUMN_TYPES.MENTIONS) {
      return `mentions:${currentUser.value?.pubkey || ''}`
    }
    return `${col.type}:${col.filter || ''}`
  })

  // ── Filter builder ────────────────────────────────────────────

  function resolveUserPubkey(input) {
    if (!input) return null
    if (input.startsWith('npub1')) {
      try { return nip19.decode(input).data } catch { return null }
    }
    return input
  }

  function buildBaseFilters(column) {
    if (!column) return null
    const now = Math.floor(Date.now() / 1000)
    const noteSince = now - NOTE_RECENCY_DAYS * 86400
    const longformSince = now - LONGFORM_RECENCY_DAYS * 86400

    switch (column.type) {
      case COLUMN_TYPES.HASHTAG:
        if (!column.filter) return null
        return [{ kinds: [1], '#t': [column.filter.toLowerCase()], since: noteSince }]

      case COLUMN_TYPES.USER: {
        const pk = resolveUserPubkey(column.filter)
        if (!pk) return null
        return [{ kinds: [1], authors: [pk], since: noteSince }]
      }

      case COLUMN_TYPES.FOLLOWING: {
        if (!currentUser.value?.pubkey) return null
        const pks = (following.value || []).filter(Boolean)
        if (pks.length === 0) return null
        const filters = []
        for (let i = 0; i < pks.length; i += 150) {
          filters.push({ kinds: [1], authors: pks.slice(i, i + 150), since: noteSince })
        }
        return filters
      }

      case COLUMN_TYPES.MENTIONS:
        if (!currentUser.value?.pubkey) return null
        return [{ kinds: [1], '#p': [currentUser.value.pubkey], since: noteSince }]

      case COLUMN_TYPES.GLOBAL:
        return [{ kinds: [1], since: noteSince }]

      case COLUMN_TYPES.LONGFORM: {
        const { mode, value } = parseLongformFilter(column.filter)
        if (!value) return null
        if (mode === LONGFORM_FILTER_MODES.USER) {
          const pk = resolveUserPubkey(value)
          if (!pk) return null
          return [{ kinds: [30023], authors: [pk], since: longformSince }]
        }
        return [{ kinds: [30023], '#t': [value.toLowerCase()], since: longformSince }]
      }

      default:
        return null
    }
  }

  // ── Profile enrichment ────────────────────────────────────────

  function scheduleProfileBatch(pubkey) {
    pendingProfilePubkeys.add(pubkey)
    if (profileBatchTimer) clearTimeout(profileBatchTimer)
    profileBatchTimer = setTimeout(async () => {
      const batch = Array.from(pendingProfilePubkeys)
      pendingProfilePubkeys.clear()
      if (batch.length === 0) return
      try { await profileService.batch(batch) } catch { /* best-effort */ }
    }, PROFILE_BATCH_DEBOUNCE)
  }

  function getProfile(pubkey) {
    return profileService.getCached(pubkey)
  }

  // ── Event processing ──────────────────────────────────────────

  function isDuplicate(eventId) {
    if (seenIds.has(eventId)) return true
    seenIds.add(eventId)
    // LRU eviction
    if (seenIds.size > DEDUP_MAX) {
      const iter = seenIds.values()
      for (let i = 0; i < 100; i++) seenIds.delete(iter.next().value)
    }
    return false
  }

  function eventToPost(event) {
    return {
      id: event.id,
      pubkey: event.pubkey,
      content: event.content,
      created_at: event.created_at,
      tags: event.tags,
      rawEvent: event
    }
  }

  /**
   * Insert a post at the correct chronological position (descending).
   * Returns true if inserted, false if duplicate.
   */
  function insertChronological(post) {
    const arr = posts.value

    // Fast path: newer than the newest — prepend
    if (arr.length === 0 || post.created_at >= arr[0].created_at) {
      arr.unshift(post)
      return true
    }

    // Fast path: older than the oldest — append
    if (post.created_at <= arr[arr.length - 1].created_at) {
      arr.push(post)
      return true
    }

    // Binary search for insertion point
    let lo = 0
    let hi = arr.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (arr[mid].created_at > post.created_at) {
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    arr.splice(lo, 0, post)
    return true
  }

  // ── Live subscription (initial load + streaming) ──────────────

  async function openLiveSubscription() {
    closeLiveSubscription()

    const column = columnRef.value
    if (!column) return

    const filters = buildBaseFilters(column)
    if (!filters) {
      error.value = ''
      isLoading.value = false
      return
    }

    isLoading.value = true
    error.value = ''
    hasMore.value = true
    let gotEose = false

    try {
      await nostrService.ready()
    } catch {
      error.value = 'Relay network not available. Try again.'
      isLoading.value = false
      return
    }

    // Safety timeout
    if (loadingTimer) clearTimeout(loadingTimer)
    loadingTimer = setTimeout(() => {
      if (isLoading.value && !gotEose) {
        isLoading.value = false
        isLive.value = true
      }
    }, LOADING_TIMEOUT)

    // Add limit to each filter for initial page
    const pagedFilters = filters.map(f => ({ ...f, limit: PAGE_SIZE }))

    try {
      const sub = nostrService.subscribe(pagedFilters, {
        onevent: (event) => {
          if (isDuplicate(event.id)) return
          const post = eventToPost(event)
          scheduleProfileBatch(event.pubkey)

          if (!gotEose) {
            // Initial load: just collect, will sort on EOSE
            posts.value.push(post)
          } else {
            // Post-EOSE: insert at correct position (real-time or late arrival)
            insertChronological(post)
          }
        },
        oneose: () => {
          gotEose = true
          isLoading.value = false
          isLive.value = true
          if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null }
          // Sort initial batch once
          posts.value.sort((a, b) => b.created_at - a.created_at)
          // If we got fewer than PAGE_SIZE, there's probably no more history
          if (posts.value.length < PAGE_SIZE) hasMore.value = false
        },
        onclose: () => {
          isLive.value = false
        }
      })

      liveSub = sub
    } catch (err) {
      error.value = getUserFriendlyError(err)
      isLoading.value = false
      if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null }
    }
  }

  function closeLiveSubscription() {
    if (liveSub) { liveSub.close(); liveSub = null }
    isLive.value = false
    if (profileBatchTimer) { clearTimeout(profileBatchTimer); profileBatchTimer = null }
    if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = null }
    pendingProfilePubkeys.clear()
  }

  // ── Infinite scroll: load older posts ─────────────────────────

  async function loadMore() {
    if (isLoadingMore.value || !hasMore.value || posts.value.length === 0) return

    const column = columnRef.value
    if (!column) return

    const filters = buildBaseFilters(column)
    if (!filters) return

    const oldestTimestamp = posts.value[posts.value.length - 1].created_at

    // Build "next page" filters: same base but with `until` and no `since`
    const pageFilters = filters.map(f => {
      const { since, ...rest } = f
      return { ...rest, until: oldestTimestamp, limit: PAGE_SIZE }
    })

    isLoadingMore.value = true

    try {
      await nostrService.ready()

      let pageCount = 0

      await new Promise((resolve) => {
        const sub = nostrService.subscribe(pageFilters, {
          onevent: (event) => {
            if (isDuplicate(event.id)) return
            const post = eventToPost(event)
            scheduleProfileBatch(event.pubkey)
            insertChronological(post)
            pageCount++
          },
          oneose: () => {
            sub.close()
            if (pageCount < PAGE_SIZE) hasMore.value = false
            resolve()
          },
          onclose: () => resolve()
        })

        // Safety timeout for loadMore
        setTimeout(() => {
          sub.close()
          resolve()
        }, 10000)
      })
    } catch (err) {
      error.value = getUserFriendlyError(err)
    } finally {
      isLoadingMore.value = false
    }
  }

  // ── Public methods ────────────────────────────────────────────

  function refresh() {
    posts.value = []
    seenIds.clear()
    hasMore.value = true
    openLiveSubscription()
  }

  function reset() {
    closeLiveSubscription()
    posts.value = []
    seenIds.clear()
    error.value = ''
    hasMore.value = true
  }

  // ── Reactivity ────────────────────────────────────────────────

  watch(subscriptionKey, (newKey, oldKey) => {
    if (!newKey) { reset(); return }
    if (newKey === oldKey) return
    refresh()
  }, { immediate: true })

  onUnmounted(() => {
    closeLiveSubscription()
  })

  return {
    posts,
    isLoading,
    isLoadingMore,
    hasMore,
    isLive,
    error,
    refresh,
    reset,
    loadMore,
    getProfile
  }
}
