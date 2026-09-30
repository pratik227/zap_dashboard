import { describe, it, expect } from 'vitest'
import { parseFeed, detectPlatform, discoverFeedLinks, guessFeedUrls, looksLikeFeed } from '../../src/utils/bridge/feedParser.js'
import { htmlToMarkdown, rewriteImageUrls } from '../../src/utils/bridge/htmlToMarkdown.js'
import { buildEventTemplate, bridgeDTag, itemKey, SYNDICATION_MODES } from '../../src/utils/bridge/articleToEvent.js'
import { isPrivateAddress } from '../../netlify/functions/bridge-proxy.mjs'

const SUBSTACK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <title><![CDATA[Sats &amp; Stories]]></title>
    <link>https://sats.substack.com</link>
    <generator>Substack</generator>
    <item>
      <title><![CDATA[Why I moved to Nostr]]></title>
      <description><![CDATA[A short <b>teaser</b>.]]></description>
      <link>https://sats.substack.com/p/why-i-moved?utm_source=rss</link>
      <guid isPermaLink="false">https://sats.substack.com/p/why-i-moved</guid>
      <dc:creator><![CDATA[Alice]]></dc:creator>
      <pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate>
      <enclosure url="https://substackcdn.com/image/cover.jpg" length="0" type="image/jpeg"/>
      <content:encoded><![CDATA[<h2>Intro</h2><p>Hello <a href="/p/other">world</a>.</p><p><img src="https://substackcdn.com/image/a.png" alt="A"></p>]]></content:encoded>
      <category>Bitcoin</category>
      <category>Open Web</category>
    </item>
  </channel>
</rss>`

const GHOST_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Ghost Blog</title><link>https://blog.example.com/</link><generator>Ghost 5.80</generator>
    <item>
      <title>Post</title><link>https://blog.example.com/post/</link><guid isPermaLink="false">65f0</guid>
      <pubDate>Mon, 31 Aug 2026 08:00:00 GMT</pubDate>
      <media:content url="https://blog.example.com/content/images/feature.jpg" medium="image"/>
      <content:encoded><![CDATA[<p>Body</p>]]></content:encoded>
    </item>
  </channel>
</rss>`

const BLOGGER_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">My Blogspot</title>
  <link rel="alternate" type="text/html" href="https://me.blogspot.com/"/>
  <generator version="7.00" uri="http://www.blogger.com">Blogger</generator>
  <entry>
    <id>tag:blogger.com,1999:blog-1.post-2</id>
    <published>2026-08-30T12:00:00.000Z</published>
    <category scheme="http://www.blogger.com/atom/ns#" term="travel"/>
    <title type="text">Atom post</title>
    <content type="html">&lt;p&gt;Atom &lt;em&gt;body&lt;/em&gt;&lt;/p&gt;&lt;img src="/pic.jpg"&gt;</content>
    <link rel="replies" type="application/atom+xml" href="https://me.blogspot.com/feeds/2/comments/default"/>
    <link rel="alternate" type="text/html" href="https://me.blogspot.com/2026/08/atom-post.html"/>
    <author><name>Bob</name></author>
  </entry>
</feed>`

describe('parseFeed', () => {
  it('parses Substack RSS with content:encoded, enclosure and categories', () => {
    const feed = parseFeed(SUBSTACK_RSS, 'https://sats.substack.com/feed')
    expect(feed.title).toBe('Sats & Stories')
    expect(feed.platform).toBe('substack')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]
    expect(item.title).toBe('Why I moved to Nostr')
    expect(item.guid).toBe('https://sats.substack.com/p/why-i-moved')
    expect(item.author).toBe('Alice')
    expect(item.published).toBe(Date.parse('2026-09-01T10:00:00Z') / 1000)
    expect(item.image).toBe('https://substackcdn.com/image/cover.jpg')
    expect(item.html).toContain('<h2>Intro</h2>')
    expect(item.summary).toBe('A short teaser.')
    expect(item.categories).toEqual(['Bitcoin', 'Open Web'])
  })

  it('detects Ghost and reads media:content images', () => {
    const feed = parseFeed(GHOST_RSS, 'https://blog.example.com/rss/')
    expect(feed.platform).toBe('ghost')
    expect(feed.items[0].image).toBe('https://blog.example.com/content/images/feature.jpg')
  })

  it('parses Blogger Atom, picking the alternate link and resolving relative images', () => {
    const feed = parseFeed(BLOGGER_ATOM, 'https://me.blogspot.com/feeds/posts/default')
    expect(feed.platform).toBe('blogger')
    expect(feed.siteUrl).toBe('https://me.blogspot.com/')
    const item = feed.items[0]
    expect(item.link).toBe('https://me.blogspot.com/2026/08/atom-post.html')
    expect(item.author).toBe('Bob')
    expect(item.categories).toEqual(['travel'])
    expect(item.image).toBe('https://me.blogspot.com/pic.jpg')
  })

  it('rejects non-feed documents', () => {
    expect(() => parseFeed('<html><body>hi</body></html>')).toThrow()
    expect(() => parseFeed('not xml <<<')).toThrow()
  })
})

describe('feed discovery helpers', () => {
  it('finds advertised feed links', () => {
    const html = '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/"></head></html>'
    expect(discoverFeedLinks(html, 'https://example.com/blog')).toEqual(['https://example.com/feed/'])
  })

  it('guesses platform-specific feed URLs', () => {
    expect(guessFeedUrls('https://medium.com/@alice')).toEqual(['https://medium.com/feed/@alice'])
    expect(guessFeedUrls('https://x.substack.com/')).toEqual(['https://x.substack.com/feed'])
    expect(guessFeedUrls('https://example.com/')).toContain('https://example.com/rss/')
  })

  it('distinguishes feeds from HTML', () => {
    expect(looksLikeFeed(SUBSTACK_RSS)).toBe(true)
    expect(looksLikeFeed(BLOGGER_ATOM)).toBe(true)
    expect(looksLikeFeed('<!doctype html><html>')).toBe(false)
  })

  it('detects platform from URL when generator is missing', () => {
    expect(detectPlatform('https://medium.com/feed/@a')).toBe('medium')
    expect(detectPlatform('https://example.com/feed', 'https://wordpress.org/?v=6.5')).toBe('wordpress')
    expect(detectPlatform('https://example.com/feed')).toBe('rss')
    expect(detectPlatform('', 'Medium')).toBe('medium')
  })
})

describe('htmlToMarkdown', () => {
  it('converts common blog markup', () => {
    const html = `
      <h2>Title</h2>
      <p>Some <strong>bold</strong> and <em>italic</em> with a <a href="/x">link</a>.</p>
      <ul><li>one</li><li>two</li></ul>
      <ol start="3"><li>three</li></ol>
      <blockquote><p>quoted</p></blockquote>
      <pre><code class="language-js">const a = 1
  indented()</code></pre>
      <figure><img src="https://cdn.example.com/i.jpg" alt="An image"><figcaption>Caption</figcaption></figure>
      <script>alert(1)</script>
    `
    const { markdown, images } = htmlToMarkdown(html, { baseUrl: 'https://example.com/post' })
    expect(markdown).toContain('## Title')
    expect(markdown).toContain('Some **bold** and *italic* with a [link](https://example.com/x).')
    expect(markdown).toContain('- one\n- two')
    expect(markdown).toContain('3. three')
    expect(markdown).toContain('> quoted')
    expect(markdown).toContain('```js\nconst a = 1\n  indented()\n```')
    expect(markdown).toContain('![An image](https://cdn.example.com/i.jpg)')
    expect(markdown).toContain('*Caption*')
    expect(markdown).not.toContain('alert')
    expect(images).toEqual(['https://cdn.example.com/i.jpg'])
  })

  it('uses lazy-load attributes and unwraps image links', () => {
    const html = '<a href="https://cdn.example.com/big.jpg"><img src="data:image/gif;base64,xx" data-src="https://cdn.example.com/big.jpg"></a>'
    const { markdown } = htmlToMarkdown(html)
    expect(markdown).toBe('![](https://cdn.example.com/big.jpg)')
  })

  it('keeps whitespace outside emphasis markers', () => {
    expect(htmlToMarkdown('<p><em>By </em><a href="https://x.y/">Dhruv</a> and<strong> bold</strong></p>').markdown)
      .toBe('*By* [Dhruv](https://x.y/) and **bold**')
  })

  it('converts tables', () => {
    const { markdown } = htmlToMarkdown('<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>')
    expect(markdown).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })

  it('escapes markdown characters in text', () => {
    expect(htmlToMarkdown('<p>2*3 = [six]</p>').markdown).toBe('2\\*3 = \\[six\\]')
  })

  it('rewrites image URLs', () => {
    expect(rewriteImageUrls('![](https://a/x.png) and ![](https://a/x.png)', { 'https://a/x.png': 'https://blossom/h' }))
      .toBe('![](https://blossom/h) and ![](https://blossom/h)')
  })
})

describe('buildEventTemplate', () => {
  const item = parseFeed(SUBSTACK_RSS, 'https://sats.substack.com/feed').items[0]

  it('builds a NIP-23 long-form event with source metadata', () => {
    const t = buildEventTemplate(item, { now: 1800000000, feedTitle: 'Sats & Stories', extraTags: ['#Nostr'] })
    expect(t.kind).toBe(30023)
    const tag = name => t.tags.filter(x => x[0] === name).map(x => x[1])
    expect(tag('d')).toEqual([bridgeDTag(item)])
    expect(tag('title')).toEqual(['Why I moved to Nostr'])
    expect(tag('published_at')).toEqual([String(item.published)])
    expect(tag('image')).toEqual(['https://substackcdn.com/image/cover.jpg'])
    expect(tag('t')).toEqual(['bitcoin', 'open-web', 'nostr'])
    expect(tag('r')).toEqual([item.link])
    expect(t.content).toContain('## Intro')
    expect(t.content).toContain('Originally published on [Sats & Stories]')
  })

  it('omits the footer when disabled', () => {
    const t = buildEventTemplate(item, { includeFooter: false })
    expect(t.content).not.toContain('Originally published')
  })

  it('builds a kind 1 note with the link', () => {
    const t = buildEventTemplate(item, { mode: SYNDICATION_MODES.NOTE, now: 1 })
    expect(t.kind).toBe(1)
    expect(t.content).toContain('Why I moved to Nostr')
    expect(t.content).toContain(item.link)
    expect(t.tags.find(x => x[0] === 'd')).toBeUndefined()
  })

  it('produces a stable d-tag that ignores tracking params and hashes', () => {
    const a = bridgeDTag({ title: 'Hello World!', link: 'https://www.ex.com/p/hello/?utm_source=rss#top' })
    const b = bridgeDTag({ title: 'Hello World!', link: 'https://ex.com/p/hello' })
    expect(a).toBe(b)
    expect(a).toMatch(/^hello-world-[0-9a-f]{8}$/)
    expect(bridgeDTag({ title: 'Hello World!', link: 'https://ex.com/p/other' })).not.toBe(a)
  })

  it('uses guid as the item key', () => {
    expect(itemKey(item)).toBe('https://sats.substack.com/p/why-i-moved')
  })
})

describe('bridge-proxy isPrivateAddress', () => {
  it.each([
    ['127.0.0.1', true], ['10.1.2.3', true], ['172.20.0.1', true], ['192.168.1.1', true],
    ['169.254.169.254', true], ['100.64.0.1', true], ['0.0.0.0', true], ['::1', true],
    ['fd00::1', true], ['fe80::1', true], ['::ffff:10.0.0.1', true],
    ['8.8.8.8', false], ['172.32.0.1', false], ['2606:4700::1111', false]
  ])('%s → %s', (ip, expected) => {
    expect(isPrivateAddress(ip)).toBe(expected)
  })
})
