/**
 * Parsers for blog-platform exports → normalized article items.
 *
 * Article items use the same shape as Content Bridge feed items
 * ({ guid, link, title, html, summary, published, image, categories }), so
 * they go through the same NIP-23 builder and get the same d-tag — an
 * article imported here and later syndicated by the Bridge isn't duplicated.
 */

import { parseXml, parseFeed, parseAtomEntry, children, child, text, toUnix, summarize } from '../bridge/feedParser.js'
import { parseCsv, basename } from './textUtils.js'

function article(platform, fields) {
  const published = fields.published || null
  return {
    platform,
    type: 'article',
    id: fields.guid,
    created: published,
    published,
    guid: fields.guid,
    link: fields.link || '',
    title: fields.title || 'Untitled',
    html: fields.html || '',
    summary: fields.summary || summarize(fields.html || ''),
    image: fields.image || '',
    categories: fields.categories || [],
    sourceUrl: fields.link || ''
  }
}

const trimSlash = url => (url || '').trim().replace(/\/+$/, '')

// ── WordPress (WXR export) ───────────────────────────────────────

export function isWordPressExport(xmlText) {
  return /wordpress\.org\/export\//.test(xmlText.slice(0, 5000))
}

// Qualified-name lookup (content:encoded vs excerpt:encoded share a local name)
const qchild = (el, qname) => Array.from(el.children).find(c => c.tagName === qname) || null
const qtext = (el, qname) => qchild(el, qname)?.textContent.trim() || ''

// WordPress stores post bodies without <p> tags (wpautop runs at render time)
function wpautop(html) {
  const cleaned = html.replace(/\[\/?(caption|gallery|embed|audio|video|playlist)[^\]]*\]/g, '')
  if (/<p[\s>]/i.test(cleaned)) return cleaned
  return cleaned
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => (/^<(h\d|ul|ol|blockquote|pre|figure|table|div|hr)/i.test(block) ? block : `<p>${block.replace(/\n/g, '<br>')}</p>`))
    .join('\n')
}

function wpDate(value) {
  if (!value || value.startsWith('0000')) return null
  return toUnix(value.replace(' ', 'T') + 'Z')
}

export function parseWordPress(xmlText) {
  const channel = child(parseXml(xmlText).documentElement, 'channel')
  if (!channel) throw new Error('Not a WordPress export file')
  const all = children(channel, 'item')

  const attachments = new Map()
  for (const it of all) {
    if (qtext(it, 'wp:post_type') === 'attachment') attachments.set(qtext(it, 'wp:post_id'), qtext(it, 'wp:attachment_url'))
  }

  const items = all
    .filter(it => qtext(it, 'wp:post_type') === 'post' && qtext(it, 'wp:status') === 'publish')
    .map((it) => {
      const thumbMeta = children(it, 'postmeta').find(m => qtext(m, 'wp:meta_key') === '_thumbnail_id')
      const html = wpautop(qtext(it, 'content:encoded'))
      return article('wordpress', {
        guid: text(it, 'guid') || text(it, 'link'),
        link: text(it, 'link'),
        title: text(it, 'title'),
        html,
        summary: qtext(it, 'excerpt:encoded') ? summarize(qtext(it, 'excerpt:encoded')) : '',
        published: wpDate(qtext(it, 'wp:post_date_gmt')) || wpDate(qtext(it, 'wp:post_date')),
        image: thumbMeta ? attachments.get(qtext(thumbMeta, 'wp:meta_value')) || '' : '',
        categories: children(it, 'category').map(c => c.textContent.trim()).filter(Boolean)
      })
    })

  return { platform: 'wordpress', items, account: text(channel, 'title') || null, warnings: [] }
}

// ── Ghost (JSON export) ──────────────────────────────────────────

export function isGhostExport(json) {
  return !!(json?.db?.[0]?.data?.posts || json?.data?.posts)
}

export function parseGhost(json, { siteUrl = '' } = {}) {
  const data = json.db?.[0]?.data || json.data
  const site = trimSlash(siteUrl)
  const tagNames = new Map((data.tags || []).map(t => [t.id, t.name]))
  const tagsByPost = new Map()
  for (const pt of data.posts_tags || []) {
    if (!tagsByPost.has(pt.post_id)) tagsByPost.set(pt.post_id, [])
    const name = tagNames.get(pt.tag_id)
    if (name && !name.startsWith('#')) tagsByPost.get(pt.post_id).push(name) // "#internal" tags are hidden in Ghost
  }

  let needsSiteUrl = false
  const fixUrls = (str) => {
    if (!str || !str.includes('__GHOST_URL__')) return str
    if (!site) { needsSiteUrl = true; return str }
    return str.split('__GHOST_URL__').join(site)
  }

  const items = (data.posts || [])
    .filter(p => (p.type || 'post') === 'post' && p.status === 'published')
    .map((p) => {
      const html = fixUrls(p.html || (p.plaintext ? p.plaintext.split(/\n\s*\n/).map(x => `<p>${x}</p>`).join('') : ''))
      return article('ghost', {
        guid: site ? `${site}/${p.slug}/` : `ghost:${p.uuid || p.id}`,
        link: site ? `${site}/${p.slug}/` : '',
        title: p.title,
        html,
        summary: p.custom_excerpt || '',
        published: toUnix(p.published_at),
        image: fixUrls(p.feature_image || ''),
        categories: tagsByPost.get(p.id) || []
      })
    })

  return {
    platform: 'ghost',
    items,
    account: json.db?.[0]?.data?.settings?.find?.(s => s.key === 'title')?.value || null,
    warnings: needsSiteUrl ? ['Enter your Ghost site address so image links and article URLs resolve.'] : [],
    needsSiteUrl: needsSiteUrl || !site
  }
}

// ── Medium (ZIP export: posts/*.html) ────────────────────────────

export const MEDIUM_POSTS = /(^|\/)posts\/[^/]+\.html$/

export function parseMediumPost(html, path) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const title = doc.querySelector('.p-name')?.textContent.trim() || doc.title || basename(path)
  const body = doc.querySelector('section[data-field="body"]') || doc.body
  // Medium repeats the title (and subtitle) as the first paragraphs of the body
  body.querySelectorAll('.graf--title, .graf--subtitle').forEach(el => el.remove())
  const subtitle = doc.querySelector('section[data-field="subtitle"]')?.textContent.trim() || ''
  const canonical = doc.querySelector('a.p-canonical')?.getAttribute('href') || ''
  const published = toUnix(doc.querySelector('time.dt-published')?.getAttribute('datetime'))
  const cover = body.querySelector('img')?.getAttribute('src') || ''

  return article('medium', {
    guid: canonical || `medium:${basename(path)}`,
    link: canonical,
    title,
    html: body.innerHTML,
    summary: subtitle,
    published,
    image: cover,
    categories: []
  })
}

export async function parseMedium(zip) {
  const files = zip.find(MEDIUM_POSTS).filter(p => !basename(p).startsWith('draft_'))
  const items = []
  for (const file of files) items.push(parseMediumPost(await zip.readText(file), file))
  const drafts = zip.find(MEDIUM_POSTS).length - files.length
  return {
    platform: 'medium',
    items,
    account: null,
    warnings: drafts ? [`${drafts} draft${drafts === 1 ? '' : 's'} skipped.`] : []
  }
}

// ── Substack (ZIP export: posts.csv + posts/<id>.html) ───────────

export async function parseSubstack(zip, { siteUrl = '' } = {}) {
  const csvPath = zip.find(/(^|\/)posts\.csv$/)[0]
  if (!csvPath) throw new Error('No posts.csv found in this Substack export')
  const dir = csvPath.slice(0, csvPath.length - 'posts.csv'.length)
  const site = trimSlash(siteUrl)
  const rows = parseCsv(await zip.readText(csvPath)).filter(r => r.is_published === 'true')

  const items = []
  let missing = 0
  for (const row of rows) {
    const htmlPath = `${dir}posts/${row.post_id}.html`
    if (!zip.has(htmlPath)) { missing++; continue }
    const slug = (row.post_id || '').split('.').slice(1).join('.')
    const link = site && slug ? `${site}/p/${slug}` : ''
    const html = await zip.readText(htmlPath)
    items.push(article('substack', {
      guid: link || `substack:${row.post_id}`,
      link,
      title: row.title,
      html,
      summary: row.subtitle || '',
      published: toUnix(row.post_date),
      image: /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1] || '',
      categories: []
    }))
  }

  const warnings = []
  if (missing) warnings.push(`${missing} published post${missing === 1 ? ' has' : 's have'} no content in the export (for example podcasts) and ${missing === 1 ? 'was' : 'were'} skipped.`)
  return { platform: 'substack', items, account: null, warnings, needsSiteUrl: !site }
}

// ── Blogger (Takeout feed.atom or Settings → Back up content .xml) ──

export function isBloggerExport(xmlText) {
  return /schemas\.google\.com\/blogger|<blogger:type>/.test(xmlText.slice(0, 20000))
}

export function parseBlogger(xmlText) {
  const root = parseXml(xmlText).documentElement
  const entries = children(root, 'entry').filter((e) => {
    const type = text(e, 'type') // Takeout: <blogger:type>POST</blogger:type>
    if (type) return type === 'POST' && (!text(e, 'status') || text(e, 'status') === 'LIVE')
    const isPost = children(e, 'category').some(c => /#post$/.test(c.getAttribute('term') || ''))
    const control = child(e, 'control')
    const isDraft = control && text(control, 'draft') === 'yes'
    return isPost && !isDraft
  })

  const items = entries.map((e) => {
    const parsed = parseAtomEntry(e)
    return article('blogger', {
      ...parsed,
      categories: parsed.categories.filter(c => !/^https?:/.test(c))
    })
  })
  return { platform: 'blogger', items, account: text(root, 'title') || null, warnings: [] }
}

// ── Any RSS / Atom file ──────────────────────────────────────────

export function parseFeedFile(xmlText) {
  const feed = parseFeed(xmlText)
  return {
    platform: feed.platform,
    items: feed.items.map(i => article(feed.platform, i)),
    account: feed.title,
    warnings: []
  }
}
