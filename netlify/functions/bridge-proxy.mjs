/**
 * Content Bridge proxy — fetches public RSS/Atom feeds, HTML pages (for feed
 * discovery) and article images on behalf of the browser, which can't read
 * them directly because most blogs don't send CORS headers.
 *
 * GET /.netlify/functions/bridge-proxy?url=<encoded http(s) url>
 *
 * Guard rails: http(s) only, no private / loopback / link-local targets
 * (checked on every redirect hop), content-type allowlist, size cap, timeout.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_BYTES = 15 * 1024 * 1024
const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 4

const ALLOWED_TYPES = [
  /^application\/(rss|atom|rdf|feed)\+xml/,
  /^application\/xml/,
  /^text\/xml/,
  /^text\/html/,
  /^application\/xhtml\+xml/,
  /^application\/json/,
  /^application\/feed\+json/,
  /^text\/plain/,
  /^image\//
]

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

export function isPrivateAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  if (v6 === '::' || v6 === '::1') return true
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7))
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6)
}

async function assertPublicUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw Object.assign(new Error('Invalid URL'), { status: 400 })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('Only http(s) URLs are allowed'), { status: 400 })
  }
  if (url.username || url.password) {
    throw Object.assign(new Error('Credentials in URL are not allowed'), { status: 400 })
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw Object.assign(new Error('Host not allowed'), { status: 403 })
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => [])
  if (addresses.length === 0) {
    throw Object.assign(new Error('Host could not be resolved'), { status: 502 })
  }
  if (addresses.some(a => isPrivateAddress(a.address))) {
    throw Object.assign(new Error('Host not allowed'), { status: 403 })
  }
  return url
}

async function fetchFollowingRedirects(startUrl, signal) {
  let current = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current)
    const res = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'ZapTracker-ContentBridge/1.0 (+https://github.com/pratik227/zap_dashboard)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, image/*;q=0.9, */*;q=0.5'
      }
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString()
      continue
    }
    return { res, finalUrl: url.toString() }
  }
  throw Object.assign(new Error('Too many redirects'), { status: 502 })
}

async function readCapped(res) {
  const declared = Number(res.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) {
    throw Object.assign(new Error('Response too large'), { status: 413 })
  }
  const reader = res.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      reader.cancel()
      throw Object.assign(new Error('Response too large'), { status: 413 })
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'GET') {
    return jsonError(405, 'Method not allowed')
  }

  const target = new URL(req.url).searchParams.get('url')
  if (!target) return jsonError(400, 'Missing url parameter')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const { res, finalUrl } = await fetchFollowingRedirects(target, controller.signal)
    if (!res.ok) return jsonError(502, `Upstream responded ${res.status}`)

    const contentType = (res.headers.get('content-type') || 'application/octet-stream').toLowerCase()
    if (!ALLOWED_TYPES.some(re => re.test(contentType))) {
      return jsonError(415, `Content type not allowed: ${contentType}`)
    }

    const body = await readCapped(res)
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        'X-Final-Url': finalUrl,
        'Access-Control-Expose-Headers': 'X-Final-Url'
      }
    })
  } catch (err) {
    if (err.name === 'AbortError') return jsonError(504, 'Upstream timed out')
    return jsonError(err.status || 502, err.message || 'Fetch failed')
  } finally {
    clearTimeout(timer)
  }
}
