/**
 * Build Nostr event templates for imported items.
 *
 * Notes → kind 1 with media URLs in the content and NIP-92 imeta tags.
 * Articles → NIP-23 via the Content Bridge builder (same d-tag scheme).
 */

import { buildEventTemplate, normalizeTopic } from '../bridge/articleToEvent.js'

export const NOTE_MAX_TOPICS = 10

/**
 * @param {object} item — note item from a social parser
 * @param {object} opts
 * @param {Array<{url, mime, sha256, size}>} [opts.uploads] — Blossom uploads for item.media
 * @param {boolean} [opts.preserveDate] — use the original post date as created_at
 * @param {string[]} [opts.extraTags]
 * @param {{ rootId: string, parentId: string }} [opts.thread] — NIP-10 threading for self-replies
 * @param {number} [opts.now]
 */
export function buildNoteTemplate(item, opts = {}) {
  const { uploads = [], preserveDate = true, extraTags = [], thread = null, now = Math.floor(Date.now() / 1000) } = opts

  const mediaUrls = uploads.map(u => u.url).filter(url => !item.text.includes(url))
  const content = [item.text, ...mediaUrls].filter(Boolean).join('\n\n')

  const topics = Array.from(new Set([...(item.tags || []), ...extraTags].map(normalizeTopic).filter(Boolean))).slice(0, NOTE_MAX_TOPICS)
  const tags = topics.map(t => ['t', t])

  for (const u of uploads) {
    const imeta = ['imeta', `url ${u.url}`]
    if (u.mime) imeta.push(`m ${u.mime}`)
    if (u.sha256) imeta.push(`x ${u.sha256}`)
    if (u.size) imeta.push(`size ${u.size}`)
    tags.push(imeta)
  }

  if (thread?.rootId) {
    tags.push(['e', thread.rootId, '', 'root'])
    if (thread.parentId && thread.parentId !== thread.rootId) tags.push(['e', thread.parentId, '', 'reply'])
  }

  tags.push(['client', 'ZapTracker'])

  return {
    kind: 1,
    created_at: preserveDate && item.created ? item.created : now,
    content,
    tags
  }
}

/**
 * @param {object} item — article item from a blog parser
 * @param {object} opts — { markdown?, image?, includeFooter?, extraTags?, now? }
 */
export function buildArticleTemplate(item, opts = {}) {
  return buildEventTemplate(item, { ...opts, feedTitle: opts.feedTitle || '' })
}
