import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

// ── Mocks ────────────────────────────────────────────────────────────────────

const { authUser, longForm, mockResolveFeed, mockLoadFeed, mockMirror, mockSignAndPublish, signer } = vi.hoisted(() => ({
  authUser: { pubkey: 'alice' },
  longForm: { list: [] },
  mockResolveFeed: vi.fn(),
  mockLoadFeed: vi.fn(),
  mockMirror: vi.fn(),
  mockSignAndPublish: vi.fn(),
  signer: { isConnected: true, signEvent: vi.fn() }
}))

vi.mock('../../src/services/StorageService.js', () => ({
  storageService: { get: vi.fn((_k, d) => d), set: vi.fn() },
  STORAGE_KEYS: { BRIDGE_FEEDS: 'f', BRIDGE_SYNDICATED: 's', BRIDGE_MEDIA_MAP: 'm' }
}))
vi.mock('../../src/utils/refreshCycle.js', () => ({ registerRefresh: vi.fn(), unregisterRefresh: vi.fn() }))
vi.mock('../../src/services/nostr/errors.js', () => ({ getUserFriendlyError: e => e.message }))
vi.mock('../../src/services/nostr/SignerService.js', () => ({ signerService: signer }))
vi.mock('../../src/services/nostr/PublishService.js', () => ({ publishService: { signAndPublish: mockSignAndPublish } }))
vi.mock('../../src/services/bridge/bridgeClient.js', () => ({
  resolveFeed: mockResolveFeed,
  loadFeed: mockLoadFeed,
  mirrorImages: mockMirror
}))

const currentUser = ref(authUser)
const isAuthenticated = ref(true)
vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({
  useNostrAuth: () => ({ currentUser, isAuthenticated })
}))
const longFormContent = ref([])
vi.mock('../../src/composables/content/useNostrLongForm.js', () => ({
  useNostrLongForm: () => ({ longFormContent })
}))

import { useContentBridge, ITEM_STATUS } from '../../src/composables/content/useContentBridge.js'
import { bridgeDTag } from '../../src/utils/bridge/articleToEvent.js'

const NOW = 1_800_000_000
const oldPost = { guid: 'g-old', link: 'https://blog.example/old', title: 'Old post', html: '<p>old</p>', summary: 'old', published: NOW - 86400, image: '', categories: [] }
const newPost = { guid: 'g-new', link: 'https://blog.example/new', title: 'New post', html: '<p>new <img src="https://blog.example/a.png"></p>', summary: 'new', published: NOW + 60, image: 'https://blog.example/cover.png', categories: ['nostr'] }

let bridge
let publishCount = 0

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW * 1000)
  vi.clearAllMocks()
  currentUser.value = { pubkey: 'alice' }
  longFormContent.value = []
  signer.isConnected = true
  publishCount = 0
  mockSignAndPublish.mockImplementation(async (t) => ({ event: { ...t, id: `ev${++publishCount}` }, result: { successful: 3 } }))
  mockMirror.mockImplementation(async (urls) => ({
    map: Object.fromEntries(urls.filter(Boolean).map(u => [u, `https://blossom.band/${u.split('/').pop()}`])),
    failed: []
  }))
  bridge = useContentBridge()
  // Reset singleton state between tests
  for (const f of [...bridge.feeds.value]) bridge.removeFeed(f.id)
  for (const key of ['g-old', 'g-new']) bridge.resetItem(key)
})

async function connect(opts = {}) {
  mockResolveFeed.mockResolvedValue({
    feedUrl: 'https://blog.example/feed',
    feed: { title: 'Example Blog', siteUrl: 'https://blog.example', platform: 'ghost', items: [oldPost] }
  })
  return bridge.addFeed('blog.example', opts)
}

describe('useContentBridge', () => {
  it('treats posts that predate the connection as backlog', async () => {
    const feed = await connect()
    const items = bridge.itemsFor(feed.id)
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe(ITEM_STATUS.BACKLOG)
  })

  it('rejects connecting the same feed twice', async () => {
    await connect()
    await expect(connect()).rejects.toThrow('already connected')
  })

  it('auto-publishes only new posts, mirrors media, and never republishes', async () => {
    const feed = await connect({ autoPublish: true })
    mockLoadFeed.mockResolvedValue({ items: [oldPost, newPost] })

    await bridge.checkFeed(feed.id)

    expect(mockSignAndPublish).toHaveBeenCalledTimes(1)
    const template = mockSignAndPublish.mock.calls[0][0]
    expect(template.kind).toBe(30023)
    expect(template.tags).toContainEqual(['d', bridgeDTag(newPost)])
    expect(template.tags).toContainEqual(['image', 'https://blossom.band/cover.png'])
    expect(template.content).toContain('![](https://blossom.band/a.png)')
    expect(template.content).not.toContain('https://blog.example/a.png')

    const byKey = Object.fromEntries(bridge.itemsFor(feed.id).map(i => [i.key, i]))
    expect(byKey['g-new'].status).toBe(ITEM_STATUS.PUBLISHED)
    expect(byKey['g-new'].record.auto).toBe(true)
    expect(byKey['g-old'].status).toBe(ITEM_STATUS.BACKLOG)

    await bridge.checkFeed(feed.id)
    expect(mockSignAndPublish).toHaveBeenCalledTimes(1)
  })

  it('does not auto-publish when the feed has auto-publish off', async () => {
    const feed = await connect({ autoPublish: false })
    mockLoadFeed.mockResolvedValue({ items: [oldPost, newPost] })
    await bridge.checkFeed(feed.id)
    expect(mockSignAndPublish).not.toHaveBeenCalled()
    expect(bridge.itemsFor(feed.id).find(i => i.key === 'g-new').status).toBe(ITEM_STATUS.NEW)
    expect(bridge.stats.value.pending).toBe(1)
  })

  it('skips auto-publish without a connected signer', async () => {
    signer.isConnected = false
    const feed = await connect({ autoPublish: true })
    mockLoadFeed.mockResolvedValue({ items: [newPost] })
    await bridge.checkFeed(feed.id)
    expect(mockSignAndPublish).not.toHaveBeenCalled()
  })

  it('recognizes articles already on relays by d-tag', async () => {
    const feed = await connect()
    longFormContent.value = [{ id: bridgeDTag(oldPost) }]
    await nextTick()
    expect(bridge.itemsFor(feed.id)[0].status).toBe(ITEM_STATUS.PUBLISHED)
  })

  it('publishes a backlog post manually as a kind 1 note without mirroring', async () => {
    const feed = await connect({ mode: 'note', mirrorMedia: false })
    await bridge.publishItem(feed.id, 'g-old')
    expect(mockMirror).not.toHaveBeenCalled()
    const template = mockSignAndPublish.mock.calls[0][0]
    expect(template.kind).toBe(1)
    expect(template.content).toContain('https://blog.example/old')
  })

  it('skip and undo', async () => {
    const feed = await connect()
    bridge.skipItem(feed.id, 'g-old')
    expect(bridge.itemsFor(feed.id)[0].status).toBe(ITEM_STATUS.SKIPPED)
    bridge.resetItem('g-old')
    expect(bridge.itemsFor(feed.id)[0].status).toBe(ITEM_STATUS.BACKLOG)
  })

  it('records a feed error instead of throwing', async () => {
    const feed = await connect()
    mockLoadFeed.mockRejectedValue(new Error('Upstream responded 500'))
    await bridge.checkFeed(feed.id)
    expect(bridge.feeds.value[0].lastError).toBe('Upstream responded 500')
  })

  it('scopes feeds to the signed-in pubkey', async () => {
    await connect()
    expect(bridge.feeds.value).toHaveLength(1)
    currentUser.value = { pubkey: 'bob' }
    expect(bridge.feeds.value).toHaveLength(0)
  })
})
