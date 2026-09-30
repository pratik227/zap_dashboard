/**
 * Minimal HTML → Markdown converter for syndicated articles (NIP-23 content
 * is Markdown). Covers what blog platforms actually emit; anything unknown
 * falls through as its text content.
 */

const DROP = new Set(['script', 'style', 'noscript', 'template', 'form', 'button', 'input', 'select', 'svg', 'head'])
const BLOCK = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'table', 'details'])

function escapeInline(str) {
  return str.replace(/([*_`\[\]])/g, '\\$1')
}

function collapse(str) {
  return str.replace(/[ \t\r\n\u00a0]+/g, ' ')
}

function absolutize(url, base) {
  if (!url) return ''
  try {
    return new URL(url, base || undefined).toString()
  } catch {
    return url
  }
}

function pickSrc(img, base) {
  // Lazy-loading themes (Ghost, WordPress, Medium) stash the real URL elsewhere
  const src = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('src') || ''
  if (src && !src.startsWith('data:')) return absolutize(src, base)
  const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || ''
  const last = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean).pop()
  return last ? absolutize(last, base) : ''
}

// Emphasis markers must hug the text: "<em>By </em>x" → "*By* x", not "*By*x"
function wrapInline(inner, marker) {
  const trimmed = inner.trim()
  if (!trimmed) return inner.replace(/\S/g, '')
  const lead = /^\s/.test(inner) ? ' ' : ''
  const trail = /\s$/.test(inner) ? ' ' : ''
  return `${lead}${marker}${trimmed}${marker}${trail}`
}

function convertChildren(node, ctx) {
  let out = ''
  for (const c of node.childNodes) out += convertNode(c, ctx)
  return out
}

function listItems(node, ctx, ordered) {
  const depth = ctx.listDepth
  const indent = '   '.repeat(depth)
  let n = Number(node.getAttribute('start')) || 1
  let out = '\n'
  for (const li of node.children) {
    if (li.localName !== 'li') continue
    const marker = ordered ? `${n++}.` : '-'
    const body = convertChildren(li, { ...ctx, listDepth: depth + 1 })
      .replace(/\n{2,}/g, '\n')
      .trim()
      .replace(/\n/g, `\n${indent}   `)
    out += `${indent}${marker} ${body}\n`
  }
  return out + '\n'
}

function convertTable(node, ctx) {
  const rows = Array.from(node.querySelectorAll('tr')).map(tr =>
    Array.from(tr.children).map(cell => convertChildren(cell, ctx).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim())
  ).filter(r => r.length)
  if (!rows.length) return ''
  const width = Math.max(...rows.map(r => r.length))
  const pad = r => [...r, ...Array(width - r.length).fill('')]
  const lines = [
    `| ${pad(rows[0]).join(' | ')} |`,
    `| ${Array(width).fill('---').join(' | ')} |`,
    ...rows.slice(1).map(r => `| ${pad(r).join(' | ')} |`)
  ]
  return `\n\n${lines.join('\n')}\n\n`
}

function convertNode(node, ctx) {
  if (node.nodeType === 3) return escapeInline(collapse(node.textContent))
  if (node.nodeType !== 1) return ''

  const tag = node.localName
  if (DROP.has(tag)) return ''

  switch (tag) {
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const inner = convertChildren(node, ctx).trim()
      return inner ? `\n\n${'#'.repeat(Number(tag[1]))} ${inner}\n\n` : ''
    }
    case 'br':
      return '  \n'
    case 'hr':
      return '\n\n---\n\n'
    case 'strong': case 'b':
      return wrapInline(convertChildren(node, ctx), '**')
    case 'em': case 'i':
      return wrapInline(convertChildren(node, ctx), '*')
    case 's': case 'del': case 'strike':
      return wrapInline(convertChildren(node, ctx), '~~')
    case 'code':
      return `\`${node.textContent.replace(/`/g, '\\`')}\``
    case 'pre': {
      const codeEl = node.querySelector('code')
      const lang = (codeEl?.className.match(/language-([\w-]+)/) || [])[1] || ''
      const body = (codeEl || node).textContent.replace(/\n+$/, '')
      return `\n\n\`\`\`${lang}\n${body}\n\`\`\`\n\n`
    }
    case 'blockquote': {
      const inner = convertChildren(node, ctx).trim().replace(/\n{3,}/g, '\n\n')
      return inner ? `\n\n${inner.split('\n').map(l => `> ${l}`.trimEnd()).join('\n')}\n\n` : ''
    }
    case 'a': {
      const href = absolutize(node.getAttribute('href'), ctx.base)
      const inner = convertChildren(node, ctx).trim()
      if (!href || href.startsWith('javascript:')) return inner
      if (!inner) return ''
      // Image-only links: keep the image, the link is almost always to the image itself
      if (/^!\[[^\]]*\]\([^)]*\)$/.test(inner)) return inner
      return `[${inner}](${href})`
    }
    case 'img': {
      const src = pickSrc(node, ctx.base)
      if (!src) return ''
      ctx.images.add(src)
      const alt = collapse(node.getAttribute('alt') || '').replace(/[\[\]]/g, '').trim()
      return `![${alt}](${src})`
    }
    case 'picture': {
      const img = node.querySelector('img')
      return img ? convertNode(img, ctx) : ''
    }
    case 'figcaption': {
      const inner = convertChildren(node, ctx).trim()
      return inner ? `\n*${inner}*\n` : ''
    }
    case 'iframe': case 'video': case 'audio': {
      const src = absolutize(node.getAttribute('src') || node.querySelector('source')?.getAttribute('src'), ctx.base)
      return src ? `\n\n${src}\n\n` : ''
    }
    case 'ul':
      return listItems(node, ctx, false)
    case 'ol':
      return listItems(node, ctx, true)
    case 'table':
      return convertTable(node, ctx)
    default: {
      const inner = convertChildren(node, ctx)
      return BLOCK.has(tag) ? `\n\n${inner.trim()}\n\n` : inner
    }
  }
}

/**
 * Convert an HTML fragment to Markdown.
 * @param {string} html
 * @param {object} [opts]
 * @param {string} [opts.baseUrl] — resolves relative links and images
 * @returns {{ markdown: string, images: string[] }}
 */
export function htmlToMarkdown(html, { baseUrl = '' } = {}) {
  if (!html) return { markdown: '', images: [] }
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html')
  const ctx = { base: baseUrl, listDepth: 0, images: new Set() }
  let md = convertChildren(doc.body, ctx)

  md = md
    .split('\n')
    .map(l => l.replace(/[ \t]+$/g, m => (m === '  ' ? m : '')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { markdown: md, images: Array.from(ctx.images) }
}

/**
 * Replace image URLs in markdown using a { oldUrl: newUrl } map.
 */
export function rewriteImageUrls(markdown, urlMap) {
  let out = markdown
  for (const [from, to] of Object.entries(urlMap)) {
    if (from && to && from !== to) out = out.split(from).join(to)
  }
  return out
}
