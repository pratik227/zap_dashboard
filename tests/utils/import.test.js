import { describe, it, expect } from 'vitest'
import { deflateRawSync } from 'node:zlib'
import { ZipArchive, mimeFromName } from '../../src/utils/import/zipReader.js'
import { fixMetaEncoding, parseCsv, decodeBasicEntities } from '../../src/utils/import/textUtils.js'
import { detectAndParse } from '../../src/utils/import/detectExport.js'
import { parseTikTok } from '../../src/utils/import/socialParsers.js'
import { parseWordPress, parseGhost, parseBlogger, parseMediumPost } from '../../src/utils/import/blogParsers.js'
import { buildNoteTemplate, buildArticleTemplate } from '../../src/utils/import/importToEvent.js'
import { bridgeDTag } from '../../src/utils/bridge/articleToEvent.js'

// ── Test ZIP builder (stored + deflate entries) ───────────────────
function createZip(files) {
  const enc = new TextEncoder()
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name)
    const raw = typeof content === 'string' ? enc.encode(content) : content
    const deflate = raw.length > 16
    const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, deflate ? 8 : 0, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(8, 0x800, true)
    cv.setUint16(10, deflate ? 8 : 0, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    locals.push(local, data)
    centrals.push(central)
    offset += local.length + data.length
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, centrals.length, true)
  ev.setUint16(10, centrals.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  return new File([...locals, ...centrals, eocd], 'export.zip', { type: 'application/zip' })
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

describe('ZipArchive', () => {
  it('lists and reads stored and deflated entries', async () => {
    const long = 'hello world '.repeat(200)
    const zip = await ZipArchive.open(createZip({ 'a.txt': 'hi', 'dir/b.txt': long, 'img.png': PNG }))
    expect(zip.paths).toEqual(['a.txt', 'dir/b.txt', 'img.png'])
    expect(await zip.readText('a.txt')).toBe('hi')
    expect(await zip.readText('dir/b.txt')).toBe(long)
    expect(Array.from(await zip.readBytes('img.png'))).toEqual(Array.from(PNG))
    const blob = await zip.readBlob('img.png')
    expect(blob.type).toBe('image/png')
  })

  it('detects zip signatures and rejects junk', async () => {
    expect(await ZipArchive.isZip(createZip({ 'a.txt': 'x' }))).toBe(true)
    expect(await ZipArchive.isZip(new File(['{"a":1}'], 'a.json'))).toBe(false)
    await expect(ZipArchive.open(new File(['not a zip at all'], 'x.zip'))).rejects.toThrow('Not a valid ZIP')
  })

  it('maps extensions to mime types', () => {
    expect(mimeFromName('x/y/photo.JPG')).toBe('image/jpeg')
    expect(mimeFromName('clip.mp4')).toBe('video/mp4')
  })
})

describe('text utils', () => {
  it('repairs Meta export mojibake', () => {
    expect(fixMetaEncoding('cafÃ© ð\u009f\u0098\u0080')).toBe('café 😀')
    expect(fixMetaEncoding('plain ascii')).toBe('plain ascii')
    expect(fixMetaEncoding('already café')).toBe('already café')
  })

  it('parses CSV with quotes and newlines', () => {
    const rows = parseCsv('﻿id,title,sub\n1,"Hello, world","line1\nline2"\n2,"He said ""hi""",\n')
    expect(rows).toEqual([
      { id: '1', title: 'Hello, world', sub: 'line1\nline2' },
      { id: '2', title: 'He said "hi"', sub: '' }
    ])
  })

  it('decodes tweet entities', () => {
    expect(decodeBasicEntities('a &amp; b &lt;3 &gt;')).toBe('a & b <3 >')
  })
})

// ── X / Twitter ──────────────────────────────────────────────────
const tweetsJs = `window.YTD.tweets.part0 = ${JSON.stringify([
  { tweet: { id_str: '100', created_at: 'Wed Oct 10 20:19:24 +0000 2018', full_text: 'Thread start &amp; more https://t.co/abc #nostr https://t.co/img', entities: { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://example.com/page' }], hashtags: [{ text: 'nostr' }], media: [{ url: 'https://t.co/img' }] } } },
  { tweet: { id_str: '101', created_at: 'Wed Oct 10 20:25:00 +0000 2018', full_text: 'Second part', in_reply_to_status_id_str: '100', in_reply_to_user_id_str: '42', entities: {} } },
  { tweet: { id_str: '102', created_at: 'Thu Oct 11 09:00:00 +0000 2018', full_text: '@bob I disagree', in_reply_to_status_id_str: '999', in_reply_to_user_id_str: '7', entities: {} } },
  { tweet: { id_str: '103', created_at: 'Thu Oct 11 10:00:00 +0000 2018', full_text: 'RT @carol: something', entities: {} } }
])}`
const accountJs = `window.YTD.account.part0 = [{"account":{"accountId":"42","username":"alice"}}]`

describe('X / Twitter archive', () => {
  it('parses tweets, media, threads, replies and retweets', async () => {
    const res = await detectAndParse(createZip({
      'twitter-2024/data/tweets.js': tweetsJs,
      'twitter-2024/data/account.js': accountJs,
      'twitter-2024/data/tweets_media/100-photo.jpg': PNG
    }))
    expect(res.platform).toBe('twitter')
    expect(res.account).toBe('@alice')
    const [a, b, c, d] = res.items
    expect(a.text).toBe('Thread start & more https://example.com/page #nostr')
    expect(a.created).toBe(Date.parse('2018-10-10T20:19:24Z') / 1000)
    expect(a.media).toEqual([{ path: 'twitter-2024/data/tweets_media/100-photo.jpg', mime: 'image/jpeg' }])
    expect(a.tags).toEqual(['nostr'])
    expect(a.sourceUrl).toBe('https://x.com/alice/status/100')
    expect(b.replyToId).toBe('100')
    expect(b.isReply).toBe(false)
    expect(c.isReply).toBe(true)
    expect(d.isRepost).toBe(true)
    expect(res.zip).toBeInstanceOf(ZipArchive)
  })

  it('accepts a lone tweets.js without media', async () => {
    const res = await detectAndParse(new File([tweetsJs], 'tweets.js'))
    expect(res.platform).toBe('twitter')
    expect(res.items).toHaveLength(4)
    expect(res.warnings[0]).toMatch(/Only text/)
  })
})

describe('Instagram and Facebook archives', () => {
  it('parses Instagram posts with repaired captions and resolved media', async () => {
    const posts = [{ media: [{ uri: 'media/posts/202301/a.jpg', creation_timestamp: 1672531200, title: 'CafÃ© day #coffee' }, { uri: 'media/posts/202301/b.mp4', creation_timestamp: 1672531200, title: '' }] }]
    const res = await detectAndParse(createZip({
      'instagram-alice/your_instagram_activity/media/posts_1.json': JSON.stringify(posts),
      'instagram-alice/media/posts/202301/a.jpg': PNG,
      'instagram-alice/media/posts/202301/b.mp4': PNG
    }))
    expect(res.platform).toBe('instagram')
    expect(res.items[0].text).toBe('Café day #coffee')
    expect(res.items[0].tags).toEqual(['coffee'])
    expect(res.items[0].media.map(m => m.path)).toEqual(['instagram-alice/media/posts/202301/a.jpg', 'instagram-alice/media/posts/202301/b.mp4'])
    expect(res.items[0].media[1].mime).toBe('video/mp4')
  })

  it('explains HTML-format Instagram exports', async () => {
    await expect(detectAndParse(createZip({ 'content/posts_1.html': '<html></html>' }))).rejects.toThrow(/JSON/)
  })

  it('parses Facebook posts with links and photos', async () => {
    const posts = [
      { timestamp: 1600000000, data: [{ post: 'Look at this ð\u009f\u0091\u0080' }], attachments: [{ data: [{ media: { uri: 'your_facebook_activity/posts/media/x.jpg' } }, { external_context: { url: 'https://news.example/story' } }] }] },
      { timestamp: 1600000100, data: [{ update_timestamp: 1 }] }
    ]
    const res = await detectAndParse(createZip({
      'your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json': JSON.stringify(posts),
      'your_facebook_activity/posts/media/x.jpg': PNG
    }))
    expect(res.platform).toBe('facebook')
    expect(res.items).toHaveLength(1)
    expect(res.items[0].text).toBe('Look at this 👀\n\nhttps://news.example/story')
    expect(res.items[0].media).toHaveLength(1)
  })
})

describe('TikTok export', () => {
  it('parses VideoList anywhere in user_data.json', async () => {
    const json = { Video: { Videos: { VideoList: [{ Date: '2024-01-05 18:27:34', Link: 'https://www.tiktokv.com/share/video/1/', Title: 'Dance #fyp' }] } } }
    const res = parseTikTok(json)
    expect(res.items[0].created).toBe(Date.parse('2024-01-05T18:27:34Z') / 1000)
    expect(res.items[0].text).toBe('Dance #fyp\n\nhttps://www.tiktokv.com/share/video/1/')
    const detected = await detectAndParse(new File([JSON.stringify(json)], 'user_data_tiktok.json'))
    expect(detected.platform).toBe('tiktok')
  })
})

// ── Blogs ────────────────────────────────────────────────────────
const WXR = `<?xml version="1.0"?>
<rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>My WP</title>
  <item>
    <title>Hello WP</title><link>https://wp.example/hello/</link><guid isPermaLink="false">https://wp.example/?p=1</guid>
    <content:encoded><![CDATA[First paragraph.

Second <strong>para</strong>.
[caption id="x"]<img src="https://wp.example/a.jpg">[/caption]]]></content:encoded>
    <excerpt:encoded><![CDATA[Short excerpt]]></excerpt:encoded>
    <wp:post_id>1</wp:post_id><wp:post_date_gmt>2020-02-03 04:05:06</wp:post_date_gmt>
    <wp:status>publish</wp:status><wp:post_type>post</wp:post_type>
    <category domain="category" nicename="news"><![CDATA[News]]></category>
    <wp:postmeta><wp:meta_key>_thumbnail_id</wp:meta_key><wp:meta_value>9</wp:meta_value></wp:postmeta>
  </item>
  <item><title>Draft</title><wp:status>draft</wp:status><wp:post_type>post</wp:post_type></item>
  <item><title>cover</title><wp:post_id>9</wp:post_id><wp:post_type>attachment</wp:post_type><wp:attachment_url>https://wp.example/cover.jpg</wp:attachment_url></item>
</channel></rss>`

describe('blog exports', () => {
  it('parses WordPress WXR: published posts, wpautop, featured image', () => {
    const res = parseWordPress(WXR)
    expect(res.items).toHaveLength(1)
    const post = res.items[0]
    expect(post.title).toBe('Hello WP')
    expect(post.published).toBe(Date.parse('2020-02-03T04:05:06Z') / 1000)
    expect(post.html).toContain('<p>First paragraph.</p>')
    expect(post.html).not.toContain('[caption')
    expect(post.image).toBe('https://wp.example/cover.jpg')
    expect(post.summary).toBe('Short excerpt')
    expect(post.categories).toEqual(['News'])
  })

  it('detects WordPress XML uploads', async () => {
    const res = await detectAndParse(new File([WXR], 'export.xml'))
    expect(res.platform).toBe('wordpress')
  })

  it('parses Ghost JSON and resolves __GHOST_URL__ once a site URL is given', () => {
    const json = { db: [{ data: {
      posts: [
        { id: 'p1', uuid: 'u1', title: 'Ghosted', slug: 'ghosted', html: '<p>Hi <img src="__GHOST_URL__/content/images/x.png"></p>', status: 'published', type: 'post', published_at: '2023-05-01T10:00:00.000Z', feature_image: '__GHOST_URL__/content/images/f.png' },
        { id: 'p2', title: 'Draft', status: 'draft', type: 'post' },
        { id: 'p3', title: 'About', status: 'published', type: 'page' }
      ],
      tags: [{ id: 't1', name: 'Bitcoin' }, { id: 't2', name: '#internal' }],
      posts_tags: [{ post_id: 'p1', tag_id: 't1' }, { post_id: 'p1', tag_id: 't2' }]
    } }] }
    const without = parseGhost(json)
    expect(without.items).toHaveLength(1)
    expect(without.needsSiteUrl).toBe(true)
    const withSite = parseGhost(json, { siteUrl: 'https://blog.example/' })
    const post = withSite.items[0]
    expect(post.link).toBe('https://blog.example/ghosted/')
    expect(post.html).toContain('https://blog.example/content/images/x.png')
    expect(post.image).toBe('https://blog.example/content/images/f.png')
    expect(post.categories).toEqual(['Bitcoin'])
    expect(withSite.needsSiteUrl).toBe(false)
  })

  it('parses a Medium post and drops the duplicated title', () => {
    const html = `<html><head><title>T</title></head><body><article>
      <h1 class="p-name">My Medium Story</h1>
      <section data-field="subtitle">A subtitle</section>
      <section data-field="body" class="e-content"><h3 class="graf--title">My Medium Story</h3><p>Body text</p><img src="https://cdn-images-1.medium.com/x.png"></section>
      <footer><time class="dt-published" datetime="2021-06-01T12:00:00.000Z">June 1</time><a class="p-canonical" href="https://medium.com/@a/my-story-123">Canonical</a></footer>
    </article></body></html>`
    const post = parseMediumPost(html, 'posts/2021-06-01_My-Medium-Story-123.html')
    expect(post.title).toBe('My Medium Story')
    expect(post.link).toBe('https://medium.com/@a/my-story-123')
    expect(post.published).toBe(Date.parse('2021-06-01T12:00:00Z') / 1000)
    expect(post.html).not.toContain('graf--title')
    expect(post.summary).toBe('A subtitle')
    expect(post.image).toBe('https://cdn-images-1.medium.com/x.png')
  })

  it('parses a Medium ZIP and skips drafts', async () => {
    const page = '<html><body><h1 class="p-name">X</h1><section data-field="body"><p>b</p></section></body></html>'
    const res = await detectAndParse(createZip({ 'posts/2021_x-1.html': page, 'posts/draft_y-2.html': page, 'profile/profile.html': '<html></html>' }))
    expect(res.platform).toBe('medium')
    expect(res.items).toHaveLength(1)
    expect(res.warnings[0]).toMatch(/1 draft/)
  })

  it('parses a Substack ZIP (posts.csv + html)', async () => {
    const csv = 'post_id,post_date,is_published,type,title,subtitle\n123.first-post,2022-03-04T05:06:07.000Z,true,newsletter,First Post,Sub one\n124.draft,,false,newsletter,Draft,\n125.pod,2022-04-01T00:00:00.000Z,true,podcast,Pod,\n'
    const zipFile = createZip({ 'posts.csv': csv, 'posts/123.first-post.html': '<p>Hello <img src="https://substackcdn.com/a.png"></p>' })
    const res = await detectAndParse(zipFile, { siteUrl: 'https://me.substack.com' })
    expect(res.platform).toBe('substack')
    expect(res.items).toHaveLength(1)
    expect(res.items[0].link).toBe('https://me.substack.com/p/first-post')
    expect(res.items[0].image).toBe('https://substackcdn.com/a.png')
    expect(res.warnings[0]).toMatch(/skipped/)
  })

  it('parses Blogger Takeout atom, keeping live posts only', () => {
    const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:blogger="http://schemas.google.com/blogger/2018">
      <title>My Blog</title>
      <entry><id>tag:1</id><blogger:type>POST</blogger:type><blogger:status>LIVE</blogger:status><title>Live one</title><content type="html">&lt;p&gt;x&lt;/p&gt;</content><published>2019-01-01T00:00:00Z</published><link rel="alternate" href="https://me.blogspot.com/2019/01/live.html"/></entry>
      <entry><id>tag:2</id><blogger:type>POST</blogger:type><blogger:status>DRAFT</blogger:status><title>Draft</title></entry>
      <entry><id>tag:3</id><blogger:type>COMMENT</blogger:type><title>Comment</title></entry>
    </feed>`
    const res = parseBlogger(atom)
    expect(res.items.map(i => i.title)).toEqual(['Live one'])
    expect(res.items[0].link).toBe('https://me.blogspot.com/2019/01/live.html')
  })

  it('rejects unrelated files with a helpful message', async () => {
    await expect(detectAndParse(new File(['hello'], 'notes.txt'))).rejects.toThrow(/Unsupported file/)
    await expect(detectAndParse(createZip({ 'random.txt': 'x' }))).rejects.toThrow(/Couldn’t recognize/)
  })
})

describe('event builders', () => {
  const note = { platform: 'twitter', id: '1', type: 'note', created: 1539202764, text: 'Hello #Nostr', tags: ['Nostr'], media: [] }

  it('builds a backdated kind 1 note with imeta tags', () => {
    const t = buildNoteTemplate(note, {
      uploads: [{ url: 'https://blossom.band/abc.jpg', mime: 'image/jpeg', sha256: 'abc', size: 12 }],
      extraTags: ['imported'],
      now: 2000000000
    })
    expect(t.kind).toBe(1)
    expect(t.created_at).toBe(1539202764)
    expect(t.content).toBe('Hello #Nostr\n\nhttps://blossom.band/abc.jpg')
    expect(t.tags).toContainEqual(['t', 'nostr'])
    expect(t.tags).toContainEqual(['t', 'imported'])
    expect(t.tags).toContainEqual(['imeta', 'url https://blossom.band/abc.jpg', 'm image/jpeg', 'x abc', 'size 12'])
  })

  it('uses the current time when dates are not preserved', () => {
    expect(buildNoteTemplate(note, { preserveDate: false, now: 5 }).created_at).toBe(5)
  })

  it('adds NIP-10 root and reply markers for threads', () => {
    const t = buildNoteTemplate(note, { thread: { rootId: 'root', parentId: 'parent' } })
    expect(t.tags).toContainEqual(['e', 'root', '', 'root'])
    expect(t.tags).toContainEqual(['e', 'parent', '', 'reply'])
    const direct = buildNoteTemplate(note, { thread: { rootId: 'root', parentId: 'root' } })
    expect(direct.tags.filter(x => x[0] === 'e')).toEqual([['e', 'root', '', 'root']])
  })

  it('builds articles with the same d-tag as the Content Bridge', () => {
    const item = parseWordPress(WXR).items[0]
    const t = buildArticleTemplate(item, { now: 1 })
    expect(t.kind).toBe(30023)
    expect(t.tags).toContainEqual(['d', bridgeDTag({ title: 'Hello WP', link: 'https://wp.example/hello/' })])
    expect(t.tags).toContainEqual(['published_at', String(item.published)])
  })
})
