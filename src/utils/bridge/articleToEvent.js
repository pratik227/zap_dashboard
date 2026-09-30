/**
 * Turn a parsed feed item into an unsigned Nostr event template.
 *
 * Long-form (NIP-23 kind 30023) posts use a d-tag derived from the source
 * URL, so re-syndicating the same article replaces the earlier event instead
 * of creating a duplicate.
 */

import { htmlToMarkdown } from './htmlToMarkdown.js'

export const SYNDICATION_MODES = {
  LONGFORM: 'longform',
  NOTE: 'note'
}

/** Stable key identifying a feed item across fetches. */
export function itemKey(item) {
  return (item.guid || item.link || '').trim()
}

// FNV-1a 32-bit — small, synchronous and stable across sessions
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function canonicalUrl(url) {
  try {
    const u = new URL(url)
    u.hash = ''
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|r$)/.test(p)) u.searchParams.delete(p)
    }
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`
  } catch {
    return url
  }
}

/** Deterministic NIP-23 identifier: "<slug>-<hash of canonical source url>". */
export function bridgeDTag(item) {
  const source = canonicalUrl(item.link || item.guid)
  const slug = (item.title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return `${slug || 'post'}-${fnv1a(source)}`
}

export function normalizeTopic(tag) {
  return tag.toLowerCase().trim().replace(/^#/, '').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '')
}

function topicTags(item, extraTags = []) {
  const topics = new Set([...(item.categories || []), ...extraTags].map(normalizeTopic).filter(Boolean))
  return Array.from(topics).slice(0, 10).map(t => ['t', t])
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Build the markdown body for a long-form post.
 * @returns {{ markdown: string, images: string[] }}
 */
export function buildArticleMarkdown(item, { includeFooter = true, feedTitle = '' } = {}) {
  const { markdown, images } = htmlToMarkdown(item.html, { baseUrl: item.link })
  let body = markdown
  if (includeFooter && item.link) {
    const where = feedTitle || hostOf(item.link) || 'the original site'
    body += `\n\n---\n\n*Originally published on [${where}](${item.link}).*`
  }
  return { markdown: body, images }
}

/**
 * @param {object} item — parsed feed item
 * @param {object} opts
 * @param {string} [opts.mode] — 'longform' | 'note'
 * @param {string} [opts.markdown] — pre-built (and media-rewritten) body for longform
 * @param {string} [opts.image] — cover image override (e.g. Blossom URL)
 * @param {boolean} [opts.includeFooter]
 * @param {string} [opts.feedTitle]
 * @param {string[]} [opts.extraTags]
 * @param {number} [opts.now] — unix seconds
 */
export function buildEventTemplate(item, opts = {}) {
  const {
    mode = SYNDICATION_MODES.LONGFORM,
    image = item.image,
    includeFooter = true,
    feedTitle = '',
    extraTags = [],
    now = Math.floor(Date.now() / 1000)
  } = opts

  const common = [
    ...topicTags(item, extraTags),
    ...(item.link ? [['r', item.link]] : []),
    ['client', 'ZapTracker']
  ]

  if (mode === SYNDICATION_MODES.NOTE) {
    const parts = [item.title, item.summary, item.link, image].filter(Boolean)
    return {
      kind: 1,
      created_at: now,
      content: parts.join('\n\n'),
      tags: common
    }
  }

  const markdown = opts.markdown ?? buildArticleMarkdown(item, { includeFooter, feedTitle }).markdown
  const tags = [
    ['d', bridgeDTag(item)],
    ['title', item.title],
    ['summary', item.summary || ''],
    ['published_at', String(item.published || now)],
    ...(image ? [['image', image]] : []),
    ...common
  ]
  return { kind: 30023, created_at: now, content: markdown, tags }
}
