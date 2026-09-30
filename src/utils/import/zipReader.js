/**
 * Random-access ZIP reader over a Blob/File.
 *
 * Reads only the central directory up front and each entry on demand via
 * Blob.slice(), so multi-gigabyte platform exports (X/Twitter, Instagram,
 * Facebook) never have to fit in memory. Inflates with the browser's native
 * DecompressionStream — no dependency. Supports ZIP64.
 */

const SIG_EOCD = 0x06054b50
const SIG_ZIP64_LOCATOR = 0x07064b50
const SIG_ZIP64_EOCD = 0x06064b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  heic: 'image/heic', avif: 'image/avif', svg: 'image/svg+xml',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav',
  json: 'application/json', js: 'text/javascript', html: 'text/html', csv: 'text/csv', xml: 'application/xml'
}

export function mimeFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

const u64 = (view, off) => view.getUint32(off, true) + view.getUint32(off + 4, true) * 2 ** 32

async function readBytes(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer())
}

async function inflateRaw(bytes) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    }
  }).pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

export class ZipArchive {
  /** @param {Blob} blob */
  constructor(blob, entries) {
    this.blob = blob
    /** @type {Map<string, {path, size, compressedSize, method, flags, localOffset}>} */
    this.entries = entries
  }

  /** True if the blob starts with a ZIP local-file signature. */
  static async isZip(blob) {
    if (blob.size < 4) return false
    const head = await readBytes(blob, 0, 4)
    return new DataView(head.buffer).getUint32(0, true) === SIG_LOCAL
  }

  static async open(blob) {
    const tailLen = Math.min(blob.size, 22 + 0xffff)
    const tail = await readBytes(blob, blob.size - tailLen, blob.size)
    const tv = new DataView(tail.buffer)

    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tv.getUint32(i, true) === SIG_EOCD) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP archive')

    let count = tv.getUint16(eocd + 10, true)
    let cdSize = tv.getUint32(eocd + 12, true)
    let cdOffset = tv.getUint32(eocd + 16, true)

    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20
      if (loc < 0 || tv.getUint32(loc, true) !== SIG_ZIP64_LOCATOR) throw new Error('Corrupt ZIP64 archive')
      const z64Offset = u64(tv, loc + 8)
      const z64 = new DataView((await readBytes(blob, z64Offset, z64Offset + 56)).buffer)
      if (z64.getUint32(0, true) !== SIG_ZIP64_EOCD) throw new Error('Corrupt ZIP64 archive')
      count = u64(z64, 32)
      cdSize = u64(z64, 40)
      cdOffset = u64(z64, 48)
    }

    const cd = await readBytes(blob, cdOffset, cdOffset + cdSize)
    const v = new DataView(cd.buffer)
    const decoder = new TextDecoder()
    const entries = new Map()
    let p = 0

    for (let n = 0; n < count && p + 46 <= cd.length; n++) {
      if (v.getUint32(p, true) !== SIG_CENTRAL) throw new Error('Corrupt ZIP central directory')
      const flags = v.getUint16(p + 8, true)
      const method = v.getUint16(p + 10, true)
      let compressedSize = v.getUint32(p + 20, true)
      let size = v.getUint32(p + 24, true)
      const nameLen = v.getUint16(p + 28, true)
      const extraLen = v.getUint16(p + 30, true)
      const commentLen = v.getUint16(p + 32, true)
      let localOffset = v.getUint32(p + 42, true)
      const path = decoder.decode(cd.subarray(p + 46, p + 46 + nameLen))

      // ZIP64 extended info: only the fields that overflowed are present, in this order
      let e = p + 46 + nameLen
      const extraEnd = e + extraLen
      while (e + 4 <= extraEnd) {
        const id = v.getUint16(e, true)
        const len = v.getUint16(e + 2, true)
        if (id === 0x0001) {
          let f = e + 4
          if (size === 0xffffffff) { size = u64(v, f); f += 8 }
          if (compressedSize === 0xffffffff) { compressedSize = u64(v, f); f += 8 }
          if (localOffset === 0xffffffff) { localOffset = u64(v, f) }
        }
        e += 4 + len
      }

      if (!path.endsWith('/')) {
        entries.set(path, { path, size, compressedSize, method, flags, localOffset })
      }
      p += 46 + nameLen + extraLen + commentLen
    }

    return new ZipArchive(blob, entries)
  }

  get paths() {
    return Array.from(this.entries.keys())
  }

  /** Find entry paths matching a regex. */
  find(re) {
    return this.paths.filter(p => re.test(p))
  }

  has(path) {
    return this.entries.has(path)
  }

  async readBytes(path) {
    const entry = this.entries.get(path)
    if (!entry) throw new Error(`Missing file in archive: ${path}`)
    if (entry.flags & 1) throw new Error('Encrypted archives are not supported')

    const header = new DataView((await readBytes(this.blob, entry.localOffset, entry.localOffset + 30)).buffer)
    if (header.getUint32(0, true) !== SIG_LOCAL) throw new Error('Corrupt ZIP entry')
    const start = entry.localOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true)
    const raw = await readBytes(this.blob, start, start + entry.compressedSize)

    if (entry.method === 0) return raw
    if (entry.method === 8) return inflateRaw(raw)
    throw new Error(`Unsupported ZIP compression method ${entry.method}`)
  }

  async readText(path) {
    return new TextDecoder().decode(await this.readBytes(path))
  }

  async readBlob(path) {
    return new Blob([await this.readBytes(path)], { type: mimeFromName(path) })
  }
}
