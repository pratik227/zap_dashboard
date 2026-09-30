/**
 * Detect which platform an uploaded export came from and parse it.
 *
 * Accepts the ZIP archive a platform hands out, or a single file from it
 * (tweets.js, posts_1.json, WordPress .xml, Ghost .json, feed.atom …).
 */

import { ZipArchive } from './zipReader.js'
import {
  TWITTER_FILES, INSTAGRAM_FILES, FACEBOOK_FILES,
  parseTwitter, parseInstagram, parseFacebook, parseFacebookPosts, parseTikTok, isTikTokExport
} from './socialParsers.js'
import {
  MEDIUM_POSTS,
  isWordPressExport, parseWordPress, isGhostExport, parseGhost, parseMedium, parseSubstack,
  isBloggerExport, parseBlogger, parseFeedFile
} from './blogParsers.js'
import { looksLikeFeed } from '../bridge/feedParser.js'
import { fixMetaEncodingDeep } from './textUtils.js'

export const IMPORT_PLATFORMS = {
  twitter: { label: 'X / Twitter', kind: 'social' },
  instagram: { label: 'Instagram', kind: 'social' },
  facebook: { label: 'Facebook', kind: 'social' },
  tiktok: { label: 'TikTok', kind: 'social' },
  substack: { label: 'Substack', kind: 'blog' },
  ghost: { label: 'Ghost', kind: 'blog' },
  wordpress: { label: 'WordPress', kind: 'blog' },
  medium: { label: 'Medium', kind: 'blog' },
  blogger: { label: 'Blogger', kind: 'blog' },
  rss: { label: 'RSS / Atom', kind: 'blog' },
  discourse: { label: 'Discourse', kind: 'blog' }
}

function parseJsonExport(json, opts) {
  if (isGhostExport(json)) return parseGhost(json, opts)
  if (isTikTokExport(json)) return parseTikTok(json)
  const list = Array.isArray(json) ? json : null
  if (list?.some(p => Array.isArray(p.media) && ('creation_timestamp' in p || p.media[0]?.creation_timestamp))) {
    // A lone Instagram posts_1.json — captions and dates only, no media files
    const fixed = fixMetaEncodingDeep(list)
    return {
      platform: 'instagram',
      items: fixed.map(p => ({
        id: p.media[0].uri,
        platform: 'instagram',
        type: 'note',
        created: p.creation_timestamp || p.media[0].creation_timestamp,
        text: (p.title || p.media[0].title || '').trim(),
        media: [],
        tags: [],
        isRepost: false,
        isReply: false,
        replyToId: null,
        sourceUrl: ''
      })).filter(i => i.text),
      account: null,
      warnings: ['Only captions were imported. Upload the whole ZIP archive to include photos and videos.']
    }
  }
  if (list?.some(p => 'timestamp' in p && (p.data || p.attachments))) {
    return {
      platform: 'facebook',
      items: parseFacebookPosts(list),
      account: null,
      warnings: ['Only text was imported. Upload the whole ZIP archive to include photos and videos.']
    }
  }
  throw new Error('This JSON file isn’t a supported export')
}

function parseXmlExport(text) {
  if (isWordPressExport(text)) return parseWordPress(text)
  if (isBloggerExport(text)) return parseBlogger(text)
  if (looksLikeFeed(text)) return parseFeedFile(text)
  throw new Error('This XML file isn’t a supported export')
}

async function parseZip(zip, opts) {
  if (zip.find(TWITTER_FILES).length) return parseTwitter(zip)
  if (zip.find(FACEBOOK_FILES).length || zip.find(/posts\/your_posts[^/]*\.html$/).length) return parseFacebook(zip)
  if (zip.find(INSTAGRAM_FILES).length || zip.find(/(content|media)\/posts_\d+\.html$/).length) return parseInstagram(zip)
  if (zip.find(/(^|\/)posts\.csv$/).length) return parseSubstack(zip, opts)
  if (zip.find(MEDIUM_POSTS).length) return parseMedium(zip)

  const tiktok = zip.find(/(^|\/)user_data[^/]*\.json$/)[0]
  if (tiktok) return parseTikTok(JSON.parse(await zip.readText(tiktok)))

  const atom = zip.find(/(^|\/)feed\.atom$/)[0]
  if (atom) return parseBlogger(await zip.readText(atom))

  for (const path of zip.find(/\.xml$/i)) {
    const text = await zip.readText(path)
    if (isWordPressExport(text) || isBloggerExport(text)) return parseXmlExport(text)
  }
  for (const path of zip.find(/\.json$/i)) {
    try {
      const json = JSON.parse(await zip.readText(path))
      if (isGhostExport(json)) return parseGhost(json, opts)
    } catch { /* not the export file */ }
  }
  throw new Error('Couldn’t recognize this archive. Supported: X/Twitter, Instagram, Facebook, TikTok, Substack, Medium, Ghost, WordPress and Blogger exports.')
}

/**
 * @param {File} file
 * @param {object} [opts] — { siteUrl } for Ghost/Substack link resolution
 * @returns {Promise<{ platform, items, account, warnings, needsSiteUrl?, zip? }>}
 */
export async function detectAndParse(file, opts = {}) {
  if (await ZipArchive.isZip(file)) {
    const zip = await ZipArchive.open(file)
    return { ...(await parseZip(zip, opts)), zip }
  }

  const text = await file.text()
  const trimmed = text.trimStart()
  if (/^window\.YTD\./.test(trimmed)) {
    // A lone tweets.js: present it as a one-file archive so the ZIP parser can read it
    const single = {
      paths: ['data/tweets.js'],
      find: re => (re.test('data/tweets.js') ? ['data/tweets.js'] : []),
      has: p => p === 'data/tweets.js',
      readText: async () => text
    }
    const result = await parseTwitter(single)
    return { ...result, warnings: ['Only text was imported. Upload the whole ZIP archive to include photos and videos.'] }
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonExport(JSON.parse(text), opts)
  }
  if (trimmed.startsWith('<')) return parseXmlExport(text)
  throw new Error('Unsupported file. Upload the ZIP archive from your platform’s data export.')
}
