/**
 * useContentImport — bring posts from other platforms' data exports to Nostr.
 *
 * - Parses an uploaded export (see utils/import/detectExport.js)
 * - Lets the user choose what to import
 * - Uploads media to Blossom and publishes events one at a time, oldest
 *   first, so X/Twitter threads can be re-linked with NIP-10 reply tags
 * - Remembers what was imported (per pubkey) so re-running never duplicates
 *
 * State is module-level so an import keeps running while the user navigates.
 */

import { ref, shallowRef, reactive, computed } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { useNostrLongForm } from './useNostrLongForm.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { signerService } from '../../services/nostr/SignerService.js'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { uploadToAll, getConfiguredServers, BLOSSOM_MAX_FILE_SIZE } from '../../services/blossomService.js'
import { mirrorImages } from '../../services/bridge/bridgeClient.js'
import { detectAndParse } from '../../utils/import/detectExport.js'
import { buildNoteTemplate } from '../../utils/import/importToEvent.js'
import { buildArticleMarkdown, buildEventTemplate, bridgeDTag } from '../../utils/bridge/articleToEvent.js'
import { rewriteImageUrls } from '../../utils/bridge/htmlToMarkdown.js'
import { basename } from '../../utils/import/textUtils.js'

export const IMPORT_DELAY_MS = 1200 // pause between events — keeps relays from rate-limiting us

// ── Module-level state ───────────────────────────────────────────
const source = shallowRef(null) // { fileName, platform, items, account, warnings, needsSiteUrl, zip }
const sourceFile = shallowRef(null)
const isParsing = ref(false)
const parseError = ref('')
const selected = ref(new Set())
const history = ref(storageService.get(STORAGE_KEYS.IMPORT_HISTORY, {}))
const job = reactive({
  running: false,
  paused: false,
  cancelRequested: false,
  total: 0,
  done: 0,
  published: 0,
  failed: 0,
  current: '',
  errors: [],
  warnings: [],
  finishedAt: null
})

const sleep = ms => new Promise(r => setTimeout(r, ms))

function saveHistory() {
  storageService.set(STORAGE_KEYS.IMPORT_HISTORY, history.value)
}

export function itemLabel(item) {
  const raw = item.type === 'article' ? item.title : item.text
  const line = (raw || '').replace(/\s+/g, ' ').trim()
  if (line) return line.length > 90 ? line.slice(0, 90) + '…' : line
  return item.media?.length ? `${item.media.length} media file${item.media.length === 1 ? '' : 's'}` : 'Untitled'
}

export function useContentImport() {
  const { currentUser } = useNostrAuth()
  const { longFormContent } = useNostrLongForm()
  const pubkey = computed(() => currentUser.value?.pubkey || null)

  const historyKey = item => `${pubkey.value}:${item.platform}:${item.id}`
  const publishedDTags = computed(() => new Set((longFormContent.value || []).map(c => c.id)))

  function isImported(item) {
    if (history.value[historyKey(item)]) return true
    return item.type === 'article' && publishedDTags.value.has(bridgeDTag(item))
  }

  const items = computed(() => (source.value?.items || []).map(item => ({
    ...item,
    key: `${item.platform}:${item.id}`,
    imported: isImported(item)
  })))

  const summary = computed(() => {
    const list = items.value
    const dates = list.map(i => i.created).filter(Boolean)
    return {
      total: list.length,
      withMedia: list.filter(i => i.media?.length).length,
      replies: list.filter(i => i.isReply).length,
      reposts: list.filter(i => i.isRepost).length,
      imported: list.filter(i => i.imported).length,
      from: dates.length ? Math.min(...dates) : null,
      to: dates.length ? Math.max(...dates) : null
    }
  })

  function defaultSelection() {
    return new Set(items.value.filter(i => !i.imported && !i.isReply && !i.isRepost).map(i => i.key))
  }

  async function loadFile(file, opts = {}) {
    parseError.value = ''
    isParsing.value = true
    try {
      const parsed = await detectAndParse(file, opts)
      if (!parsed.items.length) throw new Error('No posts found in this export')
      sourceFile.value = file
      source.value = { ...parsed, fileName: file.name, siteUrl: opts.siteUrl || '' }
      selected.value = defaultSelection()
      Object.assign(job, { total: 0, done: 0, published: 0, failed: 0, errors: [], warnings: [], finishedAt: null, current: '' })
    } catch (err) {
      parseError.value = getUserFriendlyError(err)
    } finally {
      isParsing.value = false
    }
  }

  /** Re-parse with a site URL (Ghost / Substack links and images). */
  async function setSiteUrl(siteUrl) {
    if (!sourceFile.value) return
    const keepSelection = selected.value.size !== defaultSelection().size
    const previous = new Set(selected.value)
    await loadFile(sourceFile.value, { siteUrl })
    if (keepSelection) selected.value = new Set([...previous].filter(k => items.value.some(i => i.key === k)))
  }

  function clearSource() {
    if (job.running) return
    source.value = null
    sourceFile.value = null
    selected.value = new Set()
    parseError.value = ''
  }

  function setSelected(keys, on) {
    const next = new Set(selected.value)
    for (const k of keys) on ? next.add(k) : next.delete(k)
    selected.value = next
  }

  // ── Import job ─────────────────────────────────────────────────

  async function uploadNoteMedia(item) {
    const uploads = []
    const servers = getConfiguredServers()
    for (const m of item.media || []) {
      const entry = source.value.zip?.entries.get(m.path)
      if (!entry) continue
      if (entry.size > BLOSSOM_MAX_FILE_SIZE) {
        job.warnings.push(`${basename(m.path)} is larger than 20 MB and was left out.`)
        continue
      }
      const blob = await source.value.zip.readBlob(m.path)
      const file = new File([blob], basename(m.path), { type: m.mime || blob.type })
      const res = await uploadToAll(file, servers, pubkey.value, t => signerService.signEvent(t))
      uploads.push({ url: res.url, mime: file.type, sha256: res.hash, size: res.size })
    }
    return uploads
  }

  async function buildTemplate(item, options) {
    if (item.type === 'article') {
      let { markdown, images } = buildArticleMarkdown(item, { includeFooter: options.includeFooter, feedTitle: source.value.account || '' })
      let cover = item.image
      if (options.mirrorMedia && [...images, cover].some(Boolean)) {
        const { map, failed } = await mirrorImages([...images, cover], {
          pubkey: pubkey.value,
          signEvent: t => signerService.signEvent(t)
        })
        markdown = rewriteImageUrls(markdown, map)
        cover = map[cover] || cover
        if (failed.length) job.warnings.push(`“${item.title}”: ${failed.length} image(s) still link to the original site.`)
      }
      return {
        template: buildEventTemplate(item, { markdown, image: cover, extraTags: options.extraTags, feedTitle: source.value.account || '' }),
        thread: null
      }
    }

    const uploads = await uploadNoteMedia(item)
    let thread = null
    if (item.replyToId) {
      const parent = history.value[`${pubkey.value}:${item.platform}:${item.replyToId}`]
      if (parent?.eventId) thread = { rootId: parent.rootId || parent.eventId, parentId: parent.eventId }
    }
    return {
      template: buildNoteTemplate(item, { uploads, preserveDate: options.preserveDates, extraTags: options.extraTags, thread }),
      thread
    }
  }

  /**
   * @param {object} options — { preserveDates, mirrorMedia, includeFooter, extraTags, delayMs }
   */
  async function startImport(options = {}) {
    if (job.running || !source.value) return
    if (!signerService.isConnected) throw new Error('Your Nostr signer isn\u2019t connected yet. Unlock your extension or wait a moment for it to reconnect, then try again.')

    const opts = { preserveDates: true, mirrorMedia: true, includeFooter: true, extraTags: [], delayMs: IMPORT_DELAY_MS, ...options }
    const queue = items.value
      .filter(i => selected.value.has(i.key) && !i.imported)
      .sort((a, b) => (a.created || 0) - (b.created || 0))

    Object.assign(job, {
      running: true, paused: false, cancelRequested: false,
      total: queue.length, done: 0, published: 0, failed: 0,
      current: '', errors: [], warnings: [], finishedAt: null
    })

    try {
      for (const item of queue) {
        while (job.paused && !job.cancelRequested) await sleep(250)
        if (job.cancelRequested) break
        if (isImported(item)) { job.done++; continue }

        job.current = itemLabel(item)
        try {
          const { template, thread } = await buildTemplate(item, opts)
          const { event } = await publishService.signAndPublish(template)
          history.value = {
            ...history.value,
            [historyKey(item)]: { eventId: event.id, rootId: thread?.rootId || event.id, kind: event.kind, at: Math.floor(Date.now() / 1000) }
          }
          saveHistory()
          job.published++
        } catch (err) {
          job.failed++
          job.errors.push({ label: itemLabel(item), message: getUserFriendlyError(err) })
        }
        job.done++
        if (job.done < job.total && !job.cancelRequested) await sleep(opts.delayMs)
      }
    } finally {
      job.running = false
      job.paused = false
      job.current = ''
      job.finishedAt = Math.floor(Date.now() / 1000)
      selected.value = new Set([...selected.value].filter(k => !items.value.find(i => i.key === k)?.imported))
    }
  }

  const pause = () => { if (job.running) job.paused = true }
  const resume = () => { job.paused = false }
  const cancel = () => { if (job.running) job.cancelRequested = true }

  return {
    source: computed(() => source.value),
    items,
    summary,
    selected: computed(() => selected.value),
    isParsing: computed(() => isParsing.value),
    parseError: computed(() => parseError.value),
    job,
    loadFile,
    setSiteUrl,
    clearSource,
    setSelected,
    startImport,
    pause,
    resume,
    cancel
  }
}
