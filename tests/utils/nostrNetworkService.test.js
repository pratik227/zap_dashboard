import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { nostrServiceMock } = vi.hoisted(() => ({
  nostrServiceMock: {
    fetchRelayInfo: vi.fn(async url => ({ name: `Relay ${url}`, supported_nips: [1, 11, 42], software: 'git+https://github.com/hoytech/strfry.git' })),
    ready: vi.fn(async () => {}),
    getConnectionStats: vi.fn(() => ({ total: 4, connected: 3, disconnected: 1, healthyPercentage: 75 }))
  }
}))
vi.mock('../../src/services/nostr/NostrService.js', () => ({ nostrService: nostrServiceMock }))

import {
  aggregateMonitorEvents,
  aggregateProbes,
  queryRelay,
  normalizeRelayUrl,
  nostrNetworkService,
  MONITOR_RELAYS,
  PROBE_RELAYS
} from '../../src/utils/network/nostrNetworkService.js'

const monitorEvent = (relay, { at = 100, pubkey = 'mon1', rttOpen = 300, rttRead = 100, nips = [1, 11], reqs = ['!auth', '!payment'], net = 'clearnet', sw = 'https://github.com/hoytech/strfry' } = {}) => ({
  id: `${relay}-${at}-${pubkey}`,
  kind: 30166,
  pubkey,
  created_at: at,
  tags: [
    ['d', relay],
    ['rtt-open', String(rttOpen)],
    ['rtt-read', String(rttRead)],
    ['n', net],
    ...nips.map(n => ['N', String(n)]),
    ...reqs.map(r => ['R', r]),
    ['s', sw]
  ]
})

// Fake WebSocket: behaviour keyed by URL
let relayBehaviour = {}
class FakeWebSocket {
  constructor(url) {
    this.url = url
    const b = relayBehaviour[url] || { fail: true }
    setTimeout(() => {
      if (b.fail) return this.onerror?.()
      if (b.hang) return
      this.onopen?.()
    }, 1)
    this.b = b
  }
  send(msg) {
    const [, sub] = JSON.parse(msg)
    setTimeout(() => {
      for (const e of this.b.events || []) this.onmessage?.({ data: JSON.stringify(['EVENT', sub, e]) })
      this.onmessage?.({ data: JSON.stringify(this.b.closed ? ['CLOSED', sub, this.b.closed] : ['EOSE', sub]) })
    }, 1)
  }
  close() {}
}

describe('aggregateMonitorEvents', () => {
  it('keeps the newest event per relay and aggregates stats', () => {
    const stats = aggregateMonitorEvents([
      monitorEvent('wss://a.example/', { at: 100, rttOpen: 900 }),
      monitorEvent('wss://A.example', { at: 200, rttOpen: 200, rttRead: 50, pubkey: 'mon2' }), // newer, same relay after normalizing
      monitorEvent('wss://b.example', { rttOpen: 400, nips: [1, 50], reqs: ['auth'] }),
      monitorEvent('wss://c.example', { rttOpen: 600, reqs: ['payment', 'auth'] }),
      monitorEvent('ws://xyz.onion', { net: 'tor', rttOpen: 2000, nips: [] }),
      { kind: 1, tags: [], pubkey: 'x', created_at: 1 }, // ignored
      monitorEvent('not-a-url')
    ])
    expect(stats.onlineRelays).toBe(4)
    expect(stats.monitors).toBe(2)
    expect(stats.byNetwork).toEqual({ clearnet: 3, tor: 1, i2p: 0 })
    expect(stats.medianRttOpen).toBe(500) // 200, 400, 600, 2000
    expect(stats.authRequired).toBe(2)
    expect(stats.paymentRequired).toBe(1)
    expect(stats.openAccess).toBe(2)
    expect(stats.relaysWithNipInfo).toBe(3)
    expect(stats.nipSupport.find(n => n.nip === 1)).toMatchObject({ count: 3, total: 3, percentage: 100, description: 'Basic protocol' })
    expect(stats.nipSupport.find(n => n.nip === 50)).toMatchObject({ count: 1, percentage: 33, description: 'Search' })
    expect(stats.fastestRelays.map(r => r.url)).toEqual(['wss://a.example', 'wss://b.example', 'wss://c.example'])
    expect(stats.topSoftware).toEqual([{ name: 'strfry', count: 4 }])
  })

  it('labels NIPs correctly', () => {
    const stats = aggregateMonitorEvents([monitorEvent('wss://x', { nips: [5, 10, 23, 59, 89, 90, 98, 12345] })])
    const d = Object.fromEntries(stats.nipSupport.map(n => [n.nip, n.description]))
    expect(d).toMatchObject({ 5: 'DNS-based identifiers', 10: 'Reply threading', 23: 'Long-form content', 59: 'Gift wrap', 89: 'App handlers', 90: 'Data vending machines', 98: 'HTTP auth', 12345: 'NIP-12345' })
  })
})

describe('aggregateProbes', () => {
  it('de-duplicates notes across relays and ignores failed probes', () => {
    const s = aggregateProbes([
      { ok: true, connectMs: 100, eoseMs: 50, noteIds: ['a', 'b'] },
      { ok: true, connectMs: 300, eoseMs: 70, noteIds: ['b', 'c'] },
      { ok: false, connectMs: null, noteIds: [] }
    ])
    expect(s).toEqual({ probed: 3, reachable: 2, reachablePercentage: 67, medianConnectMs: 200, medianQueryMs: 60, notesLastMinute: 3 })
  })

  it('reports no throughput when nothing responded', () => {
    expect(aggregateProbes([{ ok: false, noteIds: [] }]).notesLastMinute).toBeNull()
  })
})

describe('queryRelay', () => {
  beforeEach(() => { relayBehaviour = {} })

  it('collects events until EOSE and times the request', async () => {
    relayBehaviour['wss://r'] = { events: [{ id: '1' }, { id: '2' }] }
    const res = await queryRelay('wss://r', {}, { WebSocketImpl: FakeWebSocket })
    expect(res.ok).toBe(true)
    expect(res.events).toHaveLength(2)
    expect(res.connectMs).toBeGreaterThanOrEqual(0)
    expect(res.eoseMs).toBeGreaterThanOrEqual(0)
  })

  it('reports CLOSED, errors and timeouts', async () => {
    relayBehaviour['wss://closed'] = { closed: 'auth-required: login' }
    relayBehaviour['wss://hang'] = { hang: true }
    expect((await queryRelay('wss://closed', {}, { WebSocketImpl: FakeWebSocket })).error).toBe('auth-required: login')
    expect((await queryRelay('wss://down', {}, { WebSocketImpl: FakeWebSocket })).error).toBe('connection failed')
    expect((await queryRelay('wss://hang', {}, { WebSocketImpl: FakeWebSocket, timeout: 20 })).error).toBe('timeout')
  })
})

describe('getGlobalStats', () => {
  const realWebSocket = globalThis.WebSocket
  beforeEach(() => {
    relayBehaviour = {}
    nostrNetworkService.clearCache()
    globalThis.WebSocket = FakeWebSocket
  })
  afterEach(() => { globalThis.WebSocket = realWebSocket })

  it('combines monitor, probe and personal data', async () => {
    relayBehaviour[MONITOR_RELAYS[0]] = { events: [monitorEvent('wss://a', { nips: [1, 50] }), monitorEvent('wss://b')] }
    relayBehaviour[PROBE_RELAYS[0]] = { events: [{ id: 'n1' }, { id: 'n2' }] }
    relayBehaviour[PROBE_RELAYS[1]] = { events: [{ id: 'n2' }] }

    const s = await nostrNetworkService.getGlobalStats()
    expect(s.network.onlineRelays).toBe(2)
    expect(s.network.sources).toEqual([MONITOR_RELAYS[0]])
    expect(s.nipSource).toBe('nip66')
    expect(s.searchSupportCount).toBe(1)
    expect(s.probes.summary.reachable).toBe(2)
    expect(s.probes.summary.notesLastMinute).toBe(2)
    expect(s.probes.relays[0]).toMatchObject({ ok: true, name: `Relay ${PROBE_RELAYS[0]}`, software: 'strfry', notesLastMinute: 2 })
    expect(s.personal).toMatchObject({ connected: 3, healthyPercentage: 75 })
  }, 20000)

  it('still returns probe data and NIP-11 fallback when every monitor is down', async () => {
    relayBehaviour[PROBE_RELAYS[0]] = { events: [] }
    const s = await nostrNetworkService.getGlobalStats()
    expect(s.network).toBeNull()
    expect(s.probes.summary.reachable).toBe(1)
    expect(s.nipSource).toBe('probe')
    expect(s.authSupportCount).toBe(PROBE_RELAYS.length) // NIP-11 mock lists 42 for every probed relay
  }, 20000)
})

describe('normalizeRelayUrl', () => {
  it('lowercases and strips trailing slashes', () => {
    expect(normalizeRelayUrl(' WSS://Relay.Example.com/// ')).toBe('wss://relay.example.com')
  })
})

describe('firstWithGrace', () => {
  it('resolves shortly after the first good result instead of waiting for slow ones', async () => {
    const { firstWithGrace } = await import('../../src/utils/network/nostrNetworkService.js')
    const slow = new Promise(r => setTimeout(() => r({ ok: true, n: 'slow' }), 5000))
    const fast = new Promise(r => setTimeout(() => r({ ok: true, n: 'fast' }), 5))
    const bad = Promise.resolve({ ok: false, n: 'bad' })
    const t0 = Date.now()
    const res = await firstWithGrace([slow, fast, bad], r => r.ok, 30)
    expect(Date.now() - t0).toBeLessThan(1000)
    expect(res.map(r => r.n).sort()).toEqual(['bad', 'fast'])
  })

  it('resolves when everything settles without a good result', async () => {
    const { firstWithGrace } = await import('../../src/utils/network/nostrNetworkService.js')
    const res = await firstWithGrace([Promise.resolve({ ok: false }), Promise.reject(new Error('x'))], r => r.ok, 30)
    expect(res).toEqual([{ ok: false }])
  })
})
