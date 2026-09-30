/**
 * Feed parsing for the Content Bridge.
 *
 * Handles RSS 2.0, RSS 1.0 (RDF) and Atom — which covers Ghost (/rss/),
 * Medium (/feed/@user), Substack (/feed), WordPress (/feed/), Blogger
 * (/feeds/posts/default) and Discourse (/latest.rss).
 */

const PLATFORMS = [
  { id: 'substack', label: 'Substack', match: /substack\.com|substack/i },
  { id: 'medium', label: 'Medium', match: /medium/i },
  { id: 'ghost', label: 'Ghost', match: /ghost/i },
  { id: 'wordpress', label: 'WordPress', match: /wordpress/i },
  { id: 'blogger', label: 'Blogger', match: /blogger|blogspot/i },
  { id: 'discourse', label: 'Discourse', match: /discourse/i }
]

export const PLATFORM_LABELS = Object.fromEntries(
  [...PLATFORMS.map(p => [p.id, p.label]), ['rss', 'RSS']]
)

/** Guess the source platform from the feed URL and its <generator>. */
export function detectPlatform(feedUrl = '', generator = '') {
  const haystack = `${generator} ${feedUrl}`
  return PLATFORMS.find(p => p.match.test(haystack))?.id || 'rss'
}

// Namespaced tags are matched by local name so parsing doesn't depend on
// how a feed declares its prefixes (content:encoded, media:content, dc:creator…)
export function children(el, localName) {
  return Array.from(el?.children || []).filter(c => c.localName === localName || c.tagName === localName)
}

export function child(el, localName) {
  return children(el, localName)[0] || null
}

export function text(el, localName) {
  const node = child(el, localName)
  return node ? node.textContent.trim() : ''
}

export function toUnix(value) {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

function firstImageInHtml(html) {
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '')
  return match ? match[1] : ''
}

function stripHtml(html) {
  return (html || '')
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol|blockquote|pre|tr|td|th|figure|figcaption|section|article|hr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function decodeEntities(str) {
  if (!str || !str.includes('&')) return str
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${str}`, 'text/html')
  return doc.body.textContent
}

export function summarize(html, max = 280) {
  const plain = decodeEntities(stripHtml(html))
  if (plain.length <= max) return plain
  return plain.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

function mediaImage(item) {
  for (const tag of ['content', 'thumbnail']) {
    for (const node of children(item, tag)) {
      const url = node.getAttribute('url')
      const medium = node.getAttribute('medium') || node.getAttribute('type') || ''
      if (url && (tag === 'thumbnail' || /image/.test(medium) || !medium)) return url
    }
  }
  const group = child(item, 'group')
  if (group) return mediaImage(group)
  for (const enc of children(item, 'enclosure')) {
    if (/^image\//.test(enc.getAttribute('type') || '')) return enc.getAttribute('url')
  }
  return ''
}

export function parseRssItem(item) {
  const html = text(item, 'encoded') || text(item, 'description')
  const guid = text(item, 'guid')
  const link = text(item, 'link') || (/^https?:/.test(guid) ? guid : '')
  return {
    guid: guid || link,
    link,
    title: decodeEntities(text(item, 'title')) || 'Untitled',
    html,
    summary: summarize(text(item, 'description') || html),
    author: text(item, 'creator') || text(item, 'author'),
    published: toUnix(text(item, 'pubDate') || text(item, 'date')),
    image: mediaImage(item) || firstImageInHtml(html),
    categories: children(item, 'category').map(c => c.textContent.trim()).filter(Boolean)
  }
}

function atomLink(entry) {
  const links = children(entry, 'link')
  const alt = links.find(l => (l.getAttribute('rel') || 'alternate') === 'alternate' && !/xml/.test(l.getAttribute('type') || ''))
  return (alt || links[0])?.getAttribute('href') || ''
}

export function parseAtomEntry(entry) {
  const html = text(entry, 'content') || text(entry, 'summary')
  const link = atomLink(entry)
  const author = child(entry, 'author')
  return {
    guid: text(entry, 'id') || link,
    link,
    title: decodeEntities(text(entry, 'title')) || 'Untitled',
    html,
    summary: summarize(text(entry, 'summary') || html),
    author: author ? text(author, 'name') : '',
    published: toUnix(text(entry, 'published') || text(entry, 'updated')),
    image: mediaImage(entry) || firstImageInHtml(html),
    categories: children(entry, 'category')
      .map(c => (c.getAttribute('label') || c.getAttribute('term') || '').trim())
      .filter(Boolean)
  }
}

/**
 * Parse feed XML into { title, siteUrl, description, generator, platform, items }.
 * @throws {Error} when the document isn't a recognizable feed
 */
// CDATA → escaped text: identical meaning, and works with XML parsers that
// don't implement CDATA sections (happy-dom)
function inlineCdata(xml) {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, body) =>
    body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  )
}

/** Parse an XML document, throwing on malformed input. */
export function parseXml(xml) {
  const doc = new DOMParser().parseFromString(inlineCdata(xml), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('Feed is not valid XML')
  }
  return doc
}

export function parseFeed(xml, feedUrl = '') {
  const root = parseXml(xml).documentElement
  let meta, items

  if (root.localName === 'feed') {
    meta = {
      title: text(root, 'title'),
      siteUrl: atomLink(root),
      description: text(root, 'subtitle'),
      generator: text(root, 'generator')
    }
    items = children(root, 'entry').map(parseAtomEntry)
  } else if (root.localName === 'rss' || root.localName === 'RDF') {
    const channel = child(root, 'channel')
    if (!channel) throw new Error('RSS feed has no channel')
    meta = {
      title: text(channel, 'title'),
      siteUrl: text(channel, 'link'),
      description: text(channel, 'description'),
      generator: text(channel, 'generator')
    }
    // RSS 2.0 nests items in <channel>, RSS 1.0 puts them beside it
    const itemParent = children(channel, 'item').length ? channel : root
    items = children(itemParent, 'item').map(parseRssItem)
  } else {
    throw new Error('Not an RSS or Atom feed')
  }

  const base = meta.siteUrl || feedUrl
  items = items
    .filter(i => i.guid)
    .map(i => ({ ...i, link: absolutize(i.link, base), image: absolutize(i.image, i.link || base) }))

  return {
    ...meta,
    title: decodeEntities(meta.title) || feedUrl,
    platform: detectPlatform(feedUrl, meta.generator),
    items
  }
}

function absolutize(url, base) {
  if (!url) return ''
  try {
    return new URL(url, base || undefined).toString()
  } catch {
    return url
  }
}

/**
 * Find feed URLs advertised by an HTML page (<link rel="alternate" type="application/rss+xml">).
 */
export function discoverFeedLinks(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('link[rel~="alternate"]'))
    .filter(l => /(rss|atom)\+xml|application\/xml/i.test(l.getAttribute('type') || ''))
    .map(l => absolutize(l.getAttribute('href'), pageUrl))
    .filter(Boolean)
}

/**
 * Conventional feed locations to try when a site doesn't advertise one.
 */
export function guessFeedUrls(siteUrl) {
  let url
  try {
    url = new URL(siteUrl)
  } catch {
    return []
  }
  const host = url.hostname
  if (host === 'medium.com' && url.pathname.startsWith('/@')) {
    return [`https://medium.com/feed/${url.pathname.split('/')[1]}`]
  }
  if (host.endsWith('.medium.com')) return [`https://${host}/feed`]
  if (host.endsWith('.substack.com')) return [`https://${host}/feed`]
  if (host.endsWith('.blogspot.com')) return [`https://${host}/feeds/posts/default`]
  return ['/feed', '/rss/', '/feed.xml', '/atom.xml', '/rss.xml', '/index.xml']
    .map(path => new URL(path, url.origin).toString())
}

/** True if the text looks like a feed document rather than an HTML page. */
export function looksLikeFeed(body) {
  const head = (body || '').slice(0, 1000).toLowerCase()
  return /<(rss|feed|rdf:rdf)[\s>]/.test(head)
}
