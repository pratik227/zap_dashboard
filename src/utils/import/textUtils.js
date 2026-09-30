/**
 * Text helpers for platform exports.
 */

/**
 * Facebook and Instagram JSON exports write UTF-8 bytes as individual
 * \u00XX escapes ("cafÃ©" for "café"). Re-decode those strings.
 */
export function fixMetaEncoding(str) {
  if (typeof str !== 'string' || !/[Â-ô][\u0080-¿]/.test(str)) return str
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-ÿ]/.test(str)) return str
  try {
    const bytes = Uint8Array.from(str, c => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return str
  }
}

/** Recursively apply fixMetaEncoding to every string in a parsed JSON value. */
export function fixMetaEncodingDeep(value) {
  if (typeof value === 'string') return fixMetaEncoding(value)
  if (Array.isArray(value)) return value.map(fixMetaEncodingDeep)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixMetaEncodingDeep(v)]))
  }
  return value
}

/**
 * RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes).
 * @returns {object[]} rows keyed by header
 */
export function parseCsv(input) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const text = input.replace(/^﻿/, '')

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else {
      field += c
    }
  }
  if (field || row.length) { row.push(field); rows.push(row) }

  const [header, ...body] = rows.filter(r => r.some(Boolean))
  if (!header) return []
  return body.map(r => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ''])))
}

/** Decode the handful of HTML entities X/Twitter archives escape in tweet text. */
export function decodeBasicEntities(str) {
  return (str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

export function basename(path) {
  return (path || '').split(/[\\/]/).pop()
}

// Small stable string hash for synthesizing ids
export function shortHash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
