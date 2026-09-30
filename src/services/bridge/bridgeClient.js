/**
 * Content Bridge network layer — fetches feeds and article media through the
 * bridge-proxy Netlify function and mirrors images to Blossom.
 */

import { uploadToAll, getConfiguredServers, BLOSSOM_MAX_FILE_SIZE } from '../blossomService.js'
import { storageService, STORAGE_KEYS } from '../StorageService.js'
import { parseFeed, discoverFeedLinks, guessFeedUrls, looksLikeFeed } from '../../utils/bridge/feedParser.js'

export const BRIDGE_PROXY_PATH = '/.netlify/functions/bridge-proxy'

export function proxyUrl(url) {
  return `${BRIDGE_PROXY_PATH}?url=${encodeURIComponent(url)}`
}

async function proxiedFetch(url) {
  const res = await fetch(proxyUrl(url))
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      message = (await res.json()).error || message
    } catch { /* non-JSON error body */ }
    throw new Error(message)
  }
  return res
}

export async function fetchText(url) {
  const res = await proxiedFetch(url)
  return {
    body: await res.text(),
    contentType: res.headers.get('content-type') || '',
    finalUrl: res.headers.get('x-final-url') || url
  }
}

function normalizeInput(input) {
  const trimmed = (input || '').trim()
  if (!trimmed) throw new Error('Enter a feed or site URL')
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withScheme).toString()
  } catch {
    throw new Error('That doesn’t look like a valid URL')
  }
}

async function tryFeed(url) {
  const { body, finalUrl } = await fetchText(url)
  if (!looksLikeFeed(body)) return null
  return { feedUrl: finalUrl, feed: parseFeed(body, finalUrl) }
}

/**
 * Resolve a feed from either a feed URL or a site URL.
 * Tries: the URL itself → <link rel="alternate"> on the page → common feed paths.
 * @returns {Promise<{ feedUrl: string, feed: object }>}
 */
export async function resolveFeed(input) {
  const url = normalizeInput(input)
  const { body, finalUrl } = await fetchText(url)

  if (looksLikeFeed(body)) {
    return { feedUrl: finalUrl, feed: parseFeed(body, finalUrl) }
  }

  const candidates = [...new Set([...discoverFeedLinks(body, finalUrl), ...guessFeedUrls(finalUrl)])]
  for (const candidate of candidates) {
    try {
      const found = await tryFeed(candidate)
      if (found) return found
    } catch { /* try next candidate */ }
  }
  throw new Error('No RSS or Atom feed found at that address')
}

/** Re-fetch a known feed URL. */
export async function loadFeed(feedUrl) {
  const { body, finalUrl } = await fetchText(feedUrl)
  return parseFeed(body, finalUrl)
}

function extensionFor(type) {
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' })[type] || 'bin'
}

/**
 * Copy article images to the user's Blossom servers.
 * Already-mirrored URLs are reused from a persistent cache.
 *
 * @param {string[]} urls
 * @param {object} opts — { pubkey, signEvent, onProgress?(done, total) }
 * @returns {Promise<{ map: Record<string,string>, failed: string[] }>}
 */
export async function mirrorImages(urls, { pubkey, signEvent, onProgress } = {}) {
  const cache = storageService.get(STORAGE_KEYS.BRIDGE_MEDIA_MAP, {})
  const servers = getConfiguredServers()
  const map = {}
  const failed = []
  const unique = [...new Set(urls.filter(Boolean))]

  for (let i = 0; i < unique.length; i++) {
    const src = unique[i]
    try {
      if (cache[src]) {
        map[src] = cache[src]
      } else {
        const res = await proxiedFetch(src)
        const type = (res.headers.get('content-type') || '').split(';')[0]
        if (!type.startsWith('image/')) throw new Error('Not an image')
        const blob = await res.blob()
        if (blob.size > BLOSSOM_MAX_FILE_SIZE) throw new Error('Image too large')
        const file = new File([blob], `bridge-${i}.${extensionFor(type)}`, { type })
        const result = await uploadToAll(file, servers, pubkey, signEvent)
        map[src] = result.url
        cache[src] = result.url
        storageService.set(STORAGE_KEYS.BRIDGE_MEDIA_MAP, cache)
      }
    } catch (err) {
      console.warn('[bridge] media mirror failed:', src, err.message)
      failed.push(src)
    }
    onProgress?.(i + 1, unique.length)
  }

  return { map, failed }
}
