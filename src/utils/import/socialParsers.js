/**
 * Parsers for social-network data exports → normalized note items.
 *
 * Note item: {
 *   id, platform, type: 'note', created (unix), text,
 *   media: [{ path, mime }]   (paths inside the export ZIP),
 *   tags: string[], isReply, isRepost, replyToId, sourceUrl
 * }
 */

import { mimeFromName } from './zipReader.js'
import { fixMetaEncodingDeep, decodeBasicEntities, basename, shortHash } from './textUtils.js'

const hashtagsIn = text => Array.from(new Set((text.match(/(?:^|\s)#([\p{L}\p{N}_]+)/gu) || []).map(t => t.trim().slice(1))))

/** Resolve a path referenced inside an export against the actual ZIP layout (which may add a root folder). */
export function makePathResolver(zip) {
  const byBase = new Map()
  for (const p of zip.paths) {
    const b = basename(p)
    if (!byBase.has(b)) byBase.set(b, [])
    byBase.get(b).push(p)
  }
  return (rel) => {
    if (!rel) return null
    const clean = rel.replace(/^\.?\//, '')
    if (zip.has(clean)) return clean
    const candidates = byBase.get(basename(clean)) || []
    return candidates.find(p => p.endsWith('/' + clean)) || candidates[0] || null
  }
}

function parseYtdJs(text) {
  // "window.YTD.tweets.part0 = [ ... ]"
  const start = text.indexOf('[')
  if (start < 0) throw new Error('Unrecognized X/Twitter archive file')
  return JSON.parse(text.slice(start))
}

// ── X / Twitter ──────────────────────────────────────────────────

export const TWITTER_FILES = /(^|\/)data\/tweets?(-part\d+)?\.js$/

export async function parseTwitter(zip) {
  const files = zip.find(TWITTER_FILES)
  if (!files.length) throw new Error('No tweets found in this archive')

  let accountId = null
  let username = null
  const accountFile = zip.find(/(^|\/)data\/account\.js$/)[0]
  if (accountFile) {
    try {
      const acct = parseYtdJs(await zip.readText(accountFile))[0]?.account
      accountId = acct?.accountId || null
      username = acct?.username || null
    } catch { /* account info is optional */ }
  }

  // Media files are named "<tweet id>-<original file name>"
  const mediaById = new Map()
  for (const p of zip.find(/(^|\/)data\/tweets?_media\/[^/]+$/)) {
    const id = basename(p).split('-')[0]
    if (!mediaById.has(id)) mediaById.set(id, [])
    mediaById.get(id).push(p)
  }

  const items = []
  for (const file of files) {
    for (const row of parseYtdJs(await zip.readText(file))) {
      const t = row.tweet || row
      if (!t?.id_str) continue

      let text = t.full_text || t.text || ''
      for (const m of t.entities?.media || []) text = text.split(m.url).join('')
      for (const u of t.entities?.urls || []) {
        if (u.url && u.expanded_url) text = text.split(u.url).join(u.expanded_url)
      }
      text = decodeBasicEntities(text).trim()

      const replyUser = t.in_reply_to_user_id_str || t.in_reply_to_user_id
      const isSelfReply = !!t.in_reply_to_status_id_str && accountId && replyUser === accountId

      items.push({
        id: t.id_str,
        platform: 'twitter',
        type: 'note',
        created: Math.floor(Date.parse(t.created_at) / 1000) || null,
        text,
        media: (mediaById.get(t.id_str) || []).map(path => ({ path, mime: mimeFromName(path) })),
        tags: (t.entities?.hashtags || []).map(h => h.text).filter(Boolean),
        isRepost: /^RT @/.test(t.full_text || ''),
        isReply: !!t.in_reply_to_status_id_str && !isSelfReply,
        replyToId: isSelfReply ? t.in_reply_to_status_id_str : null,
        sourceUrl: `https://x.com/${username || 'i/web'}/status/${t.id_str}`
      })
    }
  }
  return { platform: 'twitter', items, account: username ? `@${username}` : null, warnings: [] }
}

// ── Instagram ────────────────────────────────────────────────────

export const INSTAGRAM_FILES = /(^|\/)(content|media)\/(posts_\d+|reels)\.json$/

export async function parseInstagram(zip) {
  const files = zip.find(INSTAGRAM_FILES)
  if (!files.length) {
    if (zip.find(/(content|media)\/posts_\d+\.html$/).length) {
      throw new Error('This Instagram export is in HTML format. Request a new export and choose “JSON” as the format.')
    }
    throw new Error('No Instagram posts found in this archive')
  }
  const resolve = makePathResolver(zip)
  const items = []
  const warnings = []

  for (const file of files) {
    const json = fixMetaEncodingDeep(JSON.parse(await zip.readText(file)))
    const posts = Array.isArray(json) ? json : (json.ig_reels_media || [])
    for (const post of posts) {
      const media = post.media || []
      if (!media.length) continue
      const text = (post.title || media[0].title || '').trim()
      const created = post.creation_timestamp || media[0].creation_timestamp || null
      const resolved = media
        .map(m => resolve(m.uri))
        .filter(Boolean)
        .map(path => ({ path, mime: mimeFromName(path) }))
      if (resolved.length < media.length) warnings.push(`Some media files for a post from ${new Date(created * 1000).toLocaleDateString()} are missing from the archive`)
      items.push({
        id: media[0].uri,
        platform: 'instagram',
        type: 'note',
        created,
        text,
        media: resolved,
        tags: hashtagsIn(text),
        isRepost: false,
        isReply: false,
        replyToId: null,
        sourceUrl: ''
      })
    }
  }
  return { platform: 'instagram', items, account: null, warnings: [...new Set(warnings)] }
}

// ── Facebook ─────────────────────────────────────────────────────

export const FACEBOOK_FILES = /(^|\/)posts\/your_posts[^/]*\.json$/

export function parseFacebookPosts(json, resolve = () => null) {
  const posts = Array.isArray(json) ? json : (json.status_updates_v2 || [])
  const items = []
  for (const post of fixMetaEncodingDeep(posts)) {
    const text = ((post.data || []).find(d => d.post)?.post || '').trim()
    const media = []
    const links = []
    for (const att of post.attachments || []) {
      for (const d of att.data || []) {
        if (d.media?.uri) {
          const path = resolve(d.media.uri)
          if (path) media.push({ path, mime: mimeFromName(path) })
        }
        if (d.external_context?.url) links.push(d.external_context.url)
      }
    }
    const extraLinks = links.filter(l => !text.includes(l))
    const body = [text, ...extraLinks].filter(Boolean).join('\n\n')
    if (!body && !media.length) continue
    items.push({
      id: `${post.timestamp}-${shortHash(body + media.map(m => m.path).join())}`,
      platform: 'facebook',
      type: 'note',
      created: post.timestamp || null,
      text: body,
      media,
      tags: hashtagsIn(text),
      isRepost: !text && !media.length,
      isReply: false,
      replyToId: null,
      sourceUrl: ''
    })
  }
  return items
}

export async function parseFacebook(zip) {
  const files = zip.find(FACEBOOK_FILES)
  if (!files.length) {
    if (zip.find(/posts\/your_posts[^/]*\.html$/).length) {
      throw new Error('This Facebook export is in HTML format. Request a new export and choose “JSON” as the format.')
    }
    throw new Error('No Facebook posts found in this archive')
  }
  const resolve = makePathResolver(zip)
  const items = []
  for (const file of files) {
    items.push(...parseFacebookPosts(JSON.parse(await zip.readText(file)), resolve))
  }
  return { platform: 'facebook', items, account: null, warnings: [] }
}

// ── TikTok ───────────────────────────────────────────────────────

function findKey(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return null
  if (Array.isArray(obj[key])) return obj[key]
  for (const v of Object.values(obj)) {
    const found = findKey(v, key, depth + 1)
    if (found) return found
  }
  return null
}

export function isTikTokExport(json) {
  return !!findKey(json, 'VideoList')
}

export function parseTikTok(json) {
  const videos = findKey(json, 'VideoList') || []
  const items = videos.map((v) => {
    const caption = (v.Title || v.Description || v.Desc || '').trim()
    const link = v.Link || v.VideoLink || ''
    // TikTok export dates are "YYYY-MM-DD HH:MM:SS" in UTC
    const created = v.Date ? Math.floor(Date.parse(v.Date.replace(' ', 'T') + 'Z') / 1000) || null : null
    return {
      id: link || `${v.Date}-${shortHash(caption)}`,
      platform: 'tiktok',
      type: 'note',
      created,
      text: [caption, link].filter(Boolean).join('\n\n'),
      media: [],
      tags: hashtagsIn(caption),
      isRepost: false,
      isReply: false,
      replyToId: null,
      sourceUrl: link
    }
  })
  return {
    platform: 'tiktok',
    items,
    account: null,
    warnings: items.length ? ['TikTok exports only contain links to your videos, so each note links to the video on TikTok.'] : []
  }
}
