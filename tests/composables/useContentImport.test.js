import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { deflateRawSync } from 'node:zlib'

const { mockSignAndPublish, mockUpload, mockMirror, signer, storage } = vi.hoisted(() => ({
  mockSignAndPublish: vi.fn(),
  mockUpload: vi.fn(),
  mockMirror: vi.fn(),
  signer: { isConnected: true, signEvent: vi.fn() },
  storage: {}
}))

vi.mock('../../src/services/StorageService.js', () => ({
  storageService: { get: vi.fn((k, d) => storage[k] ?? d), set: vi.fn((k, v) => { storage[k] = v }) },
  STORAGE_KEYS: { IMPORT_HISTORY: 'h', BRIDGE_MEDIA_MAP: 'm' }
}))
vi.mock('../../src/services/nostr/errors.js', () => ({ getUserFriendlyError: e => e.message }))
vi.mock('../../src/services/nostr/SignerService.js', () => ({ signerService: signer }))
vi.mock('../../src/services/nostr/PublishService.js', () => ({ publishService: { signAndPublish: mockSignAndPublish } }))
vi.mock('../../src/services/blossomService.js', () => ({
  uploadToAll: mockUpload,
  getConfiguredServers: () => ['https://blossom.band'],
  BLOSSOM_MAX_FILE_SIZE: 20 * 1024 * 1024
}))
vi.mock('../../src/services/bridge/bridgeClient.js', () => ({ mirrorImages: mockMirror }))
const currentUser = ref({ pubkey: 'alice' })
vi.mock('../../src/composables/auth/useNostrAuth.js', () => ({ useNostrAuth: () => ({ currentUser }) }))
vi.mock('../../src/composables/content/useNostrLongForm.js', () => ({ useNostrLongForm: () => ({ longFormContent: ref([]) }) }))

import { useContentImport } from '../../src/composables/content/useContentImport.js'

function zipOf(files) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const n = enc.encode(name)
    const raw = typeof content === 'string' ? enc.encode(content) : content
    const data = new Uint8Array(deflateRawSync(raw))
    const l = new Uint8Array(30 + n.length); const lv = new DataView(l.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(8, 8, true); lv.setUint32(18, data.length, true); lv.setUint32(22, raw.length, true); lv.setUint16(26, n.length, true); l.set(n, 30)
    const c = new Uint8Array(46 + n.length); const cv = new DataView(c.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(10, 8, true); cv.setUint32(20, data.length, true); cv.setUint32(24, raw.length, true); cv.setUint16(28, n.length, true); cv.setUint32(42, offset, true); c.set(n, 46)
    parts.push(l, data); central.push(c); offset += l.length + data.length
  }
  const size = central.reduce((a, c) => a + c.length, 0)
  const e = new Uint8Array(22); const ev = new DataView(e.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, central.length, true); ev.setUint16(10, central.length, true); ev.setUint32(12, size, true); ev.setUint32(16, offset, true)
  return new File([...parts, ...central, e], 'twitter.zip')
}

const tweets = [
  { tweet: { id_str: '1', created_at: 'Mon Jan 01 10:00:00 +0000 2018', full_text: 'Thread 1/2', entities: {} } },
  { tweet: { id_str: '2', created_at: 'Mon Jan 01 10:01:00 +0000 2018', full_text: 'Thread 2/2', in_reply_to_status_id_str: '1', in_reply_to_user_id_str: '42', entities: {} } },
  { tweet: { id_str: '3', created_at: 'Tue Jan 02 10:00:00 +0000 2018', full_text: 'Photo post', entities: {} } },
  { tweet: { id_str: '4', created_at: 'Wed Jan 03 10:00:00 +0000 2018', full_text: '@x reply to someone', in_reply_to_status_id_str: '99', in_reply_to_user_id_str: '7', entities: {} } }
]
const archive = () => zipOf({
  'data/tweets.js': `window.YTD.tweets.part0 = ${JSON.stringify(tweets)}`,
  'data/account.js': 'window.YTD.account.part0 = [{"account":{"accountId":"42","username":"alice"}}]',
  'data/tweets_media/3-pic.jpg': new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

let imp
let n

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(storage)) delete storage[k]
  signer.isConnected = true
  // History is module-level and scoped per pubkey — a fresh pubkey isolates each test
  currentUser.value = { pubkey: `user${Math.random()}` }
  n = 0
  mockSignAndPublish.mockImplementation(async t => ({ event: { ...t, id: `ev${++n}` }, result: { successful: 2 } }))
  mockUpload.mockImplementation(async file => ({ url: `https://blossom.band/${file.name}`, hash: 'h' + file.name, size: file.size }))
  imp = useContentImport()
  imp.clearSource()
})

describe('useContentImport', () => {
  it('parses an archive and preselects everything except replies to others', async () => {
    await imp.loadFile(archive())
    expect(imp.parseError.value).toBe('')
    expect(imp.source.value.platform).toBe('twitter')
    expect(imp.summary.value.total).toBe(4)
    expect([...imp.selected.value].sort()).toEqual(['twitter:1', 'twitter:2', 'twitter:3'])
  })

  it('imports oldest first, uploads media, links threads and never re-imports', async () => {
    await imp.loadFile(archive())
    await imp.startImport({ delayMs: 0 })

    expect(imp.job.published).toBe(3)
    expect(imp.job.failed).toBe(0)
    const [first, second, third] = mockSignAndPublish.mock.calls.map(c => c[0])
    expect(first.content).toBe('Thread 1/2')
    expect(first.created_at).toBe(Date.parse('2018-01-01T10:00:00Z') / 1000)
    expect(second.tags).toContainEqual(['e', 'ev1', '', 'root'])
    expect(third.content).toBe('Photo post\n\nhttps://blossom.band/3-pic.jpg')
    expect(third.tags).toContainEqual(['imeta', 'url https://blossom.band/3-pic.jpg', 'm image/jpeg', 'x h3-pic.jpg', 'size 10'])
    expect(mockUpload).toHaveBeenCalledTimes(1)

    expect(imp.items.value.filter(i => i.imported).map(i => i.id).sort()).toEqual(['1', '2', '3'])
    expect(imp.selected.value.size).toBe(0)

    // Re-loading the same archive recognizes the history
    await imp.loadFile(archive())
    expect(imp.summary.value.imported).toBe(3)
    expect(imp.selected.value.size).toBe(0)
  })

  it('keeps going after a failed item and reports it', async () => {
    mockSignAndPublish.mockImplementationOnce(async () => { throw new Error('relay said no') })
    await imp.loadFile(archive())
    await imp.startImport({ delayMs: 0 })
    expect(imp.job.failed).toBe(1)
    expect(imp.job.published).toBe(2)
    expect(imp.job.errors[0]).toEqual({ label: 'Thread 1/2', message: 'relay said no' })
    // The thread parent failed, so the reply is published unthreaded
    expect(mockSignAndPublish.mock.calls[1][0].tags.some(t => t[0] === 'e')).toBe(false)
  })

  it('stops when cancelled', async () => {
    await imp.loadFile(archive())
    mockSignAndPublish.mockImplementation(async (t) => {
      imp.cancel()
      return { event: { ...t, id: `ev${++n}` }, result: { successful: 1 } }
    })
    await imp.startImport({ delayMs: 0 })
    expect(imp.job.published).toBe(1)
    expect(imp.job.done).toBe(1)
  })

  it('requires a connected signer', async () => {
    signer.isConnected = false
    await imp.loadFile(archive())
    await expect(imp.startImport()).rejects.toThrow(/signer isn/)
  })

  it('reports unrecognized files', async () => {
    await imp.loadFile(new File(['hello'], 'x.txt'))
    expect(imp.parseError.value).toMatch(/Unsupported/)
    expect(imp.source.value).toBeNull()
  })
})
