/**
 * useContentBridge — syndicate RSS/Atom feeds (Ghost, Medium, Substack,
 * WordPress, Blogger, Discourse…) to Nostr.
 *
 * - Feeds and syndication history persist in localStorage, scoped per pubkey
 * - Feeds are re-checked from the global refresh cycle (while the app is open)
 * - Auto-publish only picks up posts newer than the moment the feed was added,
 *   so connecting a blog never floods relays with its back catalogue
 * - Long-form posts use a deterministic d-tag, so a re-publish replaces rather
 *   than duplicates; published/skipped items are remembered
 */

import { ref, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNostrLongForm } from './useNostrLongForm.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { registerRefresh, unregisterRefresh } from '../../utils/refreshCycle.js'
import { resolveFeed, loadFeed, mirrorImages } from '../../services/bridge/bridgeClient.js'
import { rewriteImageUrls } from '../../utils/bridge/htmlToMarkdown.js'
import {
  SYNDICATION_MODES,
  itemKey,
  bridgeDTag,
  buildArticleMarkdown,
  buildEventTemplate,
  normalizeTopic
} from '../../utils/bridge/articleToEvent.js'

export const FEED_CHECK_INTERVAL = 10 * 60 // seconds between automatic checks of one feed
const AUTO_PUBLISH_PER_CHECK = 3 // cap per feed per check, oldest first

export const ITEM_STATUS = {
  NEW: 'new', // newer than the feed connection — eligible for auto-publish
  BACKLOG: 'backlog', // older than the feed connection — manual only
  PUBLISHED: 'published',
  SKIPPED: 'skipped'
}

// ── Module-level singleton state ──────────────────────────────────
const allFeeds = ref(storageService.get(STORAGE_KEYS.BRIDGE_FEEDS, []))
const syndicated = ref(storageService.get(STORAGE_KEYS.BRIDGE_SYNDICATED, {}))
const feedItems = ref({}) // feedId → items[] (not persisted — refetched)
const checking = ref(new Set()) // feedIds currently being fetched
const publishing = ref({}) // recordKey → status message
let isInitialized = false
let autoRunning = false

watch(allFeeds, v => storageService.set(STORAGE_KEYS.BRIDGE_FEEDS, v), { deep: true })
watch(syndicated, v => storageService.set(STORAGE_KEYS.BRIDGE_SYNDICATED, v), { deep: true })

const nowSec = () => Math.floor(Date.now() / 1000)

export function useContentBridge() {
  const { isAuthenticated, currentUser } = useNostrAuth()
  const { longFormContent } = useNostrLongForm()

  const pubkey = computed(() => currentUser.value?.pubkey || null)
  const feeds = computed(() => allFeeds.value.filter(f => f.ownerPubkey === pubkey.value))

  const recordKey = key => `${pubkey.value}:${key}`

  // d-tags of long-form posts already on relays — catches posts published
  // from another device or before local history existed
  const publishedDTags = computed(() => new Set((longFormContent.value || []).map(c => c.id)))

  const findFeed = id => allFeeds.value.find(f => f.id === id)
  const updateFeed = (id, patch) => {
    const feed = findFeed(id)
    if (feed) Object.assign(feed, patch)
  }

  function itemStatus(feed, item) {
    const record = syndicated.value[recordKey(itemKey(item))]
    if (record) return record.status
    if (feed.mode === SYNDICATION_MODES.LONGFORM && publishedDTags.value.has(bridgeDTag(item))) {
      return ITEM_STATUS.PUBLISHED
    }
    return (item.published || 0) >= feed.addedAt ? ITEM_STATUS.NEW : ITEM_STATUS.BACKLOG
  }

  function itemsFor(feedId) {
    const feed = findFeed(feedId)
    if (!feed) return []
    return (feedItems.value[feedId] || []).map(item => ({
      ...item,
      key: itemKey(item),
      status: itemStatus(feed, item),
      record: syndicated.value[recordKey(itemKey(item))] || null,
      publishingMessage: publishing.value[recordKey(itemKey(item))] || null
    }))
  }

  const stats = computed(() => {
    let pending = 0
    let published = 0
    for (const feed of feeds.value) {
      for (const item of itemsFor(feed.id)) {
        if (item.status === ITEM_STATUS.NEW) pending++
        if (item.status === ITEM_STATUS.PUBLISHED) published++
      }
    }
    return { feeds: feeds.value.length, pending, published }
  })

  // ── Feed management ─────────────────────────────────────────────

  /** Look up a feed without saving it (for the add-feed preview). */
  async function previewFeed(input) {
    return resolveFeed(input)
  }

  async function addFeed(input, options = {}) {
    if (!pubkey.value) throw new Error('Sign in to connect a feed')
    const { feedUrl, feed } = await resolveFeed(input)

    if (feeds.value.some(f => f.url === feedUrl)) {
      throw new Error('This feed is already connected')
    }

    const entry = {
      id: `feed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      ownerPubkey: pubkey.value,
      url: feedUrl,
      title: feed.title,
      siteUrl: feed.siteUrl,
      platform: feed.platform,
      mode: options.mode || SYNDICATION_MODES.LONGFORM,
      autoPublish: !!options.autoPublish,
      mirrorMedia: options.mirrorMedia ?? true,
      includeFooter: options.includeFooter ?? true,
      extraTags: (options.extraTags || []).map(normalizeTopic).filter(Boolean),
      addedAt: nowSec(),
      lastChecked: nowSec(),
      lastError: null
    }
    allFeeds.value.push(entry)
    feedItems.value = { ...feedItems.value, [entry.id]: feed.items }
    return entry
  }

  function removeFeed(id) {
    allFeeds.value = allFeeds.value.filter(f => f.id !== id)
    const { [id]: _removed, ...rest } = feedItems.value
    feedItems.value = rest
  }

  function updateFeedSettings(id, patch) {
    const allowed = ['mode', 'autoPublish', 'mirrorMedia', 'includeFooter', 'extraTags', 'title']
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)))
    if (clean.extraTags) clean.extraTags = clean.extraTags.map(normalizeTopic).filter(Boolean)
    updateFeed(id, clean)
  }

  // ── Fetching ────────────────────────────────────────────────────

  async function checkFeed(id, { autoPublish = true } = {}) {
    const feed = findFeed(id)
    if (!feed || checking.value.has(id)) return
    checking.value = new Set([...checking.value, id])
    try {
      const parsed = await loadFeed(feed.url)
      feedItems.value = { ...feedItems.value, [id]: parsed.items }
      updateFeed(id, { lastChecked: nowSec(), lastError: null })
      if (autoPublish && feed.autoPublish) await autoPublishFeed(id)
    } catch (err) {
      updateFeed(id, { lastChecked: nowSec(), lastError: getUserFriendlyError(err) })
    } finally {
      const next = new Set(checking.value)
      next.delete(id)
      checking.value = next
    }
  }

  async function checkAll({ force = false } = {}) {
    const due = feeds.value.filter(f =>
      force || !feedItems.value[f.id] || nowSec() - (f.lastChecked || 0) >= FEED_CHECK_INTERVAL
    )
    for (const feed of due) await checkFeed(feed.id)
  }

  async function autoPublishFeed(id) {
    if (autoRunning || !signerService.isConnected) return
    autoRunning = true
    try {
      const candidates = itemsFor(id)
        .filter(i => i.status === ITEM_STATUS.NEW && !i.publishingMessage)
        .sort((a, b) => (a.published || 0) - (b.published || 0))
        .slice(0, AUTO_PUBLISH_PER_CHECK)
      for (const item of candidates) {
        try {
          await publishItem(id, item.key, { auto: true })
        } catch (err) {
          console.warn('[bridge] auto-publish failed:', item.link, err.message)
        }
      }
    } finally {
      autoRunning = false
    }
  }

  // ── Publishing ──────────────────────────────────────────────────

  function getItem(feedId, key) {
    return (feedItems.value[feedId] || []).find(i => itemKey(i) === key) || null
  }

  /** Build the event locally, without uploading media or signing. */
  function previewItem(feedId, key, overrides = {}) {
    const feed = findFeed(feedId)
    const item = getItem(feedId, key)
    if (!feed || !item) return null
    const settings = { ...feed, ...overrides }
    const { markdown, images } = buildArticleMarkdown(item, { includeFooter: settings.includeFooter, feedTitle: feed.title })
    const template = buildEventTemplate(item, {
      mode: settings.mode,
      markdown,
      includeFooter: settings.includeFooter,
      feedTitle: feed.title,
      extraTags: settings.extraTags
    })
    return { item, template, images: [...new Set([...images, item.image].filter(Boolean))] }
  }

  async function publishItem(feedId, key, { mode, auto = false } = {}) {
    if (!isAuthenticated.value || !signerService.isConnected) {
      throw new Error('Your Nostr signer isn\u2019t connected yet. Unlock your extension or wait a moment for it to reconnect, then try again.')
    }
    const feed = findFeed(feedId)
    const item = getItem(feedId, key)
    if (!feed || !item) throw new Error('Item not found')

    const rk = recordKey(key)
    if (publishing.value[rk]) return null
    const setMessage = msg => { publishing.value = { ...publishing.value, [rk]: msg } }

    const finalMode = mode || feed.mode
    try {
      setMessage('Preparing…')
      let { markdown, images } = buildArticleMarkdown(item, { includeFooter: feed.includeFooter, feedTitle: feed.title })
      let cover = item.image
      let failedMedia = []

      if (feed.mirrorMedia) {
        const toMirror = finalMode === SYNDICATION_MODES.LONGFORM ? [...images, cover] : [cover]
        if (toMirror.some(Boolean)) {
          const { map, failed } = await mirrorImages(toMirror, {
            pubkey: pubkey.value,
            signEvent: t => signerService.signEvent(t),
            onProgress: (done, total) => setMessage(`Uploading media to Blossom ${done}/${total}…`)
          })
          markdown = rewriteImageUrls(markdown, map)
          cover = map[cover] || cover
          failedMedia = failed
        }
      }

      setMessage('Signing and publishing…')
      const template = buildEventTemplate(item, {
        mode: finalMode,
        markdown,
        image: cover,
        includeFooter: feed.includeFooter,
        feedTitle: feed.title,
        extraTags: feed.extraTags
      })
      const { event, result } = await publishService.signAndPublish(template)

      syndicated.value = {
        ...syndicated.value,
        [rk]: {
          status: ITEM_STATUS.PUBLISHED,
          feedId,
          eventId: event.id,
          kind: event.kind,
          dTag: finalMode === SYNDICATION_MODES.LONGFORM ? bridgeDTag(item) : null,
          title: item.title,
          link: item.link,
          at: nowSec(),
          auto,
          relays: result.successful,
          failedMedia: failedMedia.length
        }
      }
      return { event, result, failedMedia }
    } finally {
      const { [rk]: _done, ...rest } = publishing.value
      publishing.value = rest
    }
  }

  function skipItem(feedId, key) {
    const item = getItem(feedId, key)
    syndicated.value = {
      ...syndicated.value,
      [recordKey(key)]: { status: ITEM_STATUS.SKIPPED, feedId, title: item?.title || '', link: item?.link || '', at: nowSec() }
    }
  }

  /** Forget a skip / publish record so the item can be handled again. */
  function resetItem(key) {
    const { [recordKey(key)]: _removed, ...rest } = syndicated.value
    syndicated.value = rest
  }

  // ── Lifecycle ───────────────────────────────────────────────────
  if (!isInitialized) {
    isInitialized = true
    watch(isAuthenticated, (authed) => {
      if (authed) {
        registerRefresh('content-bridge', () => checkAll(), 'global')
      } else {
        unregisterRefresh('content-bridge')
        feedItems.value = {}
      }
    }, { immediate: true })
  }

  return {
    feeds,
    stats,
    checking: computed(() => checking.value),
    itemsFor,
    previewFeed,
    addFeed,
    removeFeed,
    updateFeedSettings,
    checkFeed,
    checkAll,
    previewItem,
    publishItem,
    skipItem,
    resetItem
  }
}
