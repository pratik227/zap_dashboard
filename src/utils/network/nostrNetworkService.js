/**
 * Nostr Network Statistics Service
 *
 * Three independent sources — any of them can fail without blanking the page:
 *
 * 1. NIP-66 relay monitors (network-wide): monitors publish kind 30166
 *    "relay discovery" events per relay with round-trip times (`rtt-open`,
 *    `rtt-read`), supported NIPs (`N`), requirements (`R`) and network (`n`).
 * 2. Live probe (from this browser): connect to popular relays, time the
 *    WebSocket handshake and a query, and count notes from the last minute.
 * 3. NIP-11 info for probed relays, via nostrService's cached fetcher.
 *
 * Nothing here is estimated: a source that fails is reported as unavailable.
 */

import { nostrService } from '../../services/nostr/NostrService.js'

const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes
const MONITOR_WINDOW = 24 * 60 * 60 // NIP-66 events from the last 24h
const QUERY_TIMEOUT = 6000
const NIP11_TIMEOUT = 5000
const MONITOR_GRACE = 5000 // after the first monitor answers, wait this long for the others (they overlap but differ)

// Relays that aggregate NIP-66 monitor events
export const MONITOR_RELAYS = [
  'wss://relay.nostr.watch',
  'wss://monitorlizard.nostr1.com',
  'wss://relaypag.es',
]

// Popular general-purpose relays probed live from the browser
export const PROBE_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://offchain.pub',
  'wss://relay.nostr.net',
  'wss://nostr.oxtr.dev',
  'wss://nostr-pub.wellorder.net',
  'wss://nostr.bitcoiner.social',
  'wss://relay.nos.social',
]

export const NIP_DESCRIPTIONS = {
  1: 'Basic protocol',
  2: 'Follow lists',
  4: 'Encrypted DMs (legacy)',
  5: 'DNS-based identifiers',
  9: 'Event deletion',
  10: 'Reply threading',
  11: 'Relay information document',
  12: 'Generic tag queries (now NIP-01)',
  13: 'Proof of work',
  15: 'Marketplace',
  16: 'Event treatment (now NIP-01)',
  17: 'Private direct messages',
  18: 'Reposts',
  20: 'Command results (now NIP-01)',
  22: 'Comments',
  23: 'Long-form content',
  25: 'Reactions',
  26: 'Delegated event signing',
  28: 'Public chat',
  29: 'Relay-based groups',
  30: 'Custom emoji',
  32: 'Labeling',
  33: 'Addressable events (now NIP-01)',
  40: 'Expiration timestamp',
  42: 'Client authentication',
  44: 'Encrypted payloads',
  45: 'Event counts',
  46: 'Remote signing',
  47: 'Wallet Connect',
  50: 'Search',
  51: 'Lists',
  56: 'Reporting',
  57: 'Lightning zaps',
  58: 'Badges',
  59: 'Gift wrap',
  62: 'Request to vanish',
  65: 'Relay list metadata',
  66: 'Relay discovery & liveness',
  70: 'Protected events',
  77: 'Negentropy syncing',
  86: 'Relay management API',
  89: 'App handlers',
  90: 'Data vending machines',
  94: 'File metadata',
  96: 'HTTP file storage',
  98: 'HTTP auth',
  99: 'Classified listings',
}

const nowSec = () => Math.floor(Date.now() / 1000)

export function normalizeRelayUrl(url) {
  return (url || '').trim().toLowerCase().replace(/\/+$/, '')
}

function median(values) {
  const sorted = values.filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

/**
 * Resolve with every settled result once one satisfies `isGood` and `graceMs`
 * has passed (or all have settled). Monitors overlap heavily, so one is enough.
 */
export function firstWithGrace(promises, isGood, graceMs) {
  return new Promise((resolve) => {
    const results = new Array(promises.length).fill(null)
    let pending = promises.length
    let graceTimer = null
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(graceTimer)
      resolve(results.filter(Boolean))
    }
    promises.forEach((p, i) => {
      Promise.resolve(p).then((value) => {
        results[i] = value
        if (isGood(value) && !graceTimer) graceTimer = setTimeout(finish, graceMs)
      }, () => {}).finally(() => {
        if (--pending === 0) finish()
      })
    })
  })
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))])
}

/**
 * Open a WebSocket, send one REQ, collect events until EOSE.
 * @returns {Promise<{ ok, events, connectMs, eoseMs, error }>}
 */
export function queryRelay(url, filter, { timeout = QUERY_TIMEOUT, WebSocketImpl = globalThis.WebSocket } = {}) {
  return new Promise((resolve) => {
    const started = performance.now()
    const events = []
    let ws
    let connectMs = null
    let requestedAt = null
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws?.close() } catch { /* already closed */ }
      resolve({ ok: false, events, connectMs, eoseMs: null, error: null, ...result })
    }
    const timer = setTimeout(() => finish({ error: 'timeout' }), timeout)

    try {
      ws = new WebSocketImpl(url)
    } catch (err) {
      finish({ error: err.message })
      return
    }

    ws.onopen = () => {
      connectMs = Math.round(performance.now() - started)
      requestedAt = performance.now()
      ws.send(JSON.stringify(['REQ', 'stats', filter]))
    }
    ws.onmessage = (msg) => {
      let data
      try { data = JSON.parse(msg.data) } catch { return }
      if (data[0] === 'EVENT' && data[2]) events.push(data[2])
      else if (data[0] === 'EOSE') finish({ ok: true, eoseMs: Math.round(performance.now() - requestedAt) })
      else if (data[0] === 'CLOSED') finish({ error: data[2] || 'closed by relay' })
    }
    ws.onerror = () => finish({ error: 'connection failed' })
    ws.onclose = () => finish({ error: 'connection closed' })
  })
}

const tagValue = (event, name) => event.tags.find(t => t[0] === name)?.[1]
const tagValues = (event, name) => event.tags.filter(t => t[0] === name).map(t => t[1])

/**
 * Aggregate NIP-66 kind 30166 events into network-wide stats.
 * Keeps the newest event per relay (the `d` tag).
 */
export function aggregateMonitorEvents(events) {
  const latest = new Map()
  const monitors = new Set()
  for (const e of events) {
    if (e?.kind !== 30166) continue
    const relay = normalizeRelayUrl(tagValue(e, 'd'))
    if (!/^wss?:\/\//.test(relay)) continue
    monitors.add(e.pubkey)
    const prev = latest.get(relay)
    if (!prev || e.created_at > prev.created_at) latest.set(relay, e)
  }

  const relays = Array.from(latest.entries()).map(([url, e]) => {
    const requirements = tagValues(e, 'R')
    return {
      url,
      network: tagValue(e, 'n') || (url.includes('.onion') ? 'tor' : 'clearnet'),
      rttOpen: Number(tagValue(e, 'rtt-open')) || null,
      rttRead: Number(tagValue(e, 'rtt-read')) || null,
      nips: tagValues(e, 'N').map(Number).filter(Number.isInteger),
      auth: requirements.includes('auth'),
      payment: requirements.includes('payment'),
      pow: requirements.includes('pow'),
      software: softwareName(tagValue(e, 's')),
      seenAt: e.created_at,
    }
  })

  const byNetwork = { clearnet: 0, tor: 0, i2p: 0 }
  for (const r of relays) byNetwork[r.network] = (byNetwork[r.network] || 0) + 1

  const withNips = relays.filter(r => r.nips.length)
  const nipCounts = new Map()
  for (const r of withNips) for (const nip of new Set(r.nips)) nipCounts.set(nip, (nipCounts.get(nip) || 0) + 1)

  const software = new Map()
  for (const r of relays) if (r.software) software.set(r.software, (software.get(r.software) || 0) + 1)

  return {
    onlineRelays: relays.length,
    byNetwork,
    monitors: monitors.size,
    medianRttOpen: median(relays.map(r => r.rttOpen)),
    medianRttRead: median(relays.map(r => r.rttRead)),
    authRequired: relays.filter(r => r.auth).length,
    paymentRequired: relays.filter(r => r.payment).length,
    powRequired: relays.filter(r => r.pow).length,
    openAccess: relays.filter(r => !r.auth && !r.payment && !r.pow).length,
    relaysWithNipInfo: withNips.length,
    nipSupport: nipSupportList(nipCounts, withNips.length),
    fastestRelays: relays
      .filter(r => r.network === 'clearnet' && r.rttOpen && r.rttRead)
      .sort((a, b) => (a.rttOpen + a.rttRead) - (b.rttOpen + b.rttRead))
      .slice(0, 10),
    topSoftware: Array.from(software.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  }
}

// "https://github.com/hoytech/strfry" → "strfry"
function softwareName(value) {
  if (!value) return ''
  const clean = value.replace(/\.git$/, '').replace(/\/+$/, '')
  return clean.split('/').pop() || clean
}

function nipSupportList(counts, total) {
  return Array.from(counts.entries())
    .map(([nip, count]) => ({
      nip,
      count,
      total,
      percentage: total ? Math.round((count / total) * 100) : 0,
      description: NIP_DESCRIPTIONS[nip] || `NIP-${nip}`,
    }))
    .sort((a, b) => b.count - a.count || a.nip - b.nip)
}

/**
 * Aggregate live probe results. Notes are de-duplicated by id across relays.
 */
export function aggregateProbes(probes) {
  const reachable = probes.filter(p => p.ok)
  const noteIds = new Set()
  for (const p of reachable) for (const id of p.noteIds || []) noteIds.add(id)
  return {
    probed: probes.length,
    reachable: reachable.length,
    reachablePercentage: probes.length ? Math.round((reachable.length / probes.length) * 100) : 0,
    medianConnectMs: median(reachable.map(p => p.connectMs)),
    medianQueryMs: median(reachable.map(p => p.eoseMs)),
    notesLastMinute: reachable.length ? noteIds.size : null,
  }
}

class NostrNetworkService {
  constructor() {
    this.cache = new Map()
  }

  async getCachedOrFetch(key, fetchFn, ttl = CACHE_DURATION) {
    const cached = this.cache.get(key)
    if (cached && (Date.now() - cached.timestamp) < ttl) return cached.data
    try {
      const data = await fetchFn()
      this.cache.set(key, { data, timestamp: Date.now() })
      return data
    } catch (error) {
      if (cached) return cached.data
      throw error
    }
  }

  /** Network-wide stats from NIP-66 monitors, or null if no monitor relay answered. */
  async getMonitorStats() {
    return this.getCachedOrFetch('monitor-stats', async () => {
      const filter = { kinds: [30166], since: nowSec() - MONITOR_WINDOW, limit: 10000 }
      const results = await firstWithGrace(
        MONITOR_RELAYS.map(url => queryRelay(url, filter, { timeout: 15000 }).then(r => ({ url, ...r }))),
        r => r.ok && r.events.length > 0,
        MONITOR_GRACE
      )
      const answered = results.filter(r => r.ok && r.events.length)
      if (!answered.length) return null
      return {
        ...aggregateMonitorEvents(answered.flatMap(r => r.events)),
        sources: answered.map(r => r.url),
      }
    })
  }

  /** Live probe of popular relays from this browser. */
  async getProbeResults() {
    return this.getCachedOrFetch('probe-results', async () => {
      const filter = { kinds: [1], since: nowSec() - 60, limit: 500 }
      const probes = await Promise.all(PROBE_RELAYS.map(async (url) => {
        const [res, info] = await Promise.all([
          queryRelay(url, filter),
          withTimeout(nostrService.fetchRelayInfo(url), NIP11_TIMEOUT),
        ])
        return {
          url,
          name: info?.name || url.replace(/^wss:\/\//, ''),
          software: softwareName(info?.software),
          version: info?.version || '',
          nips: Array.isArray(info?.supported_nips) ? info.supported_nips : [],
          ok: res.ok,
          error: res.error,
          connectMs: res.connectMs,
          eoseMs: res.eoseMs,
          notesLastMinute: res.ok ? res.events.length : null,
          noteIds: res.events.map(e => e.id),
        }
      }))
      return { relays: probes, summary: aggregateProbes(probes) }
    })
  }

  /** The user's own relay pool, or null when not connected. */
  async getPersonalStats() {
    const ready = await withTimeout(nostrService.ready().then(() => true).catch(() => false), 3000)
    if (!ready) return null
    const stats = nostrService.getConnectionStats()
    return stats.total ? stats : null
  }

  /**
   * Everything the dashboards need. Each section is null when its source failed.
   * Probes run first: the monitor download is large and would inflate measured latency.
   */
  async getGlobalStats() {
    const [probe, personal] = await Promise.allSettled([this.getProbeResults(), this.getPersonalStats()])
    const [monitor] = await Promise.allSettled([this.getMonitorStats()])
    const value = r => (r.status === 'fulfilled' ? r.value : null)
    return combineStats({ network: value(monitor), probes: value(probe), personal: value(personal) })
  }

  clearCache() {
    this.cache.clear()
  }
}

/**
 * Merge the three sources into the shape the dashboards render.
 * Prefers network-wide NIP data, falling back to NIP-11 of the probed relays.
 */
export function combineStats({ network = null, probes = null, personal = null }) {
  const probeNipCounts = new Map()
  const probedWithNips = (probes?.relays || []).filter(r => r.nips.length)
  for (const r of probedWithNips) for (const nip of new Set(r.nips)) probeNipCounts.set(nip, (probeNipCounts.get(nip) || 0) + 1)
  const nipSupport = network?.nipSupport?.length ? network.nipSupport : nipSupportList(probeNipCounts, probedWithNips.length)
  const nipCount = nip => nipSupport.find(n => n.nip === nip)?.count ?? null

  return {
    network,
    probes,
    personal,
    nipSupport,
    nipSource: network?.nipSupport?.length ? 'nip66' : (probedWithNips.length ? 'probe' : null),
    nipSampleSize: nipSupport[0]?.total || 0,
    searchSupportCount: nipCount(50),
    authSupportCount: nipCount(42),
    lastUpdated: Date.now(),
  }
}

export const nostrNetworkService = new NostrNetworkService()
