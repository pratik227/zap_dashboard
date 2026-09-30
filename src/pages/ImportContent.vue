<script setup>
import { ref, reactive, computed, inject, watch } from 'vue'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useContentImport, itemLabel } from '../composables/content/useContentImport.js'
import { IMPORT_PLATFORMS } from '../utils/import/detectExport.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import {
  IconUpload,
  IconFileZip,
  IconAlertTriangle,
  IconLoader2,
  IconPhoto,
  IconCheck,
  IconX,
  IconPlayerPause,
  IconPlayerPlay,
  IconExternalLink,
  IconMessageCircle,
  IconRepeat,
  IconFileText,
  IconRss
} from '@iconify-prerendered/vue-tabler'

const changePage = inject('changePage', () => {})
const { isAuthenticated } = useNostrAuth()
const {
  source, items, summary, selected, isParsing, parseError, job,
  loadFile, setSiteUrl, clearSource, setSelected, startImport, pause, resume, cancel
} = useContentImport()

const GUIDES = [
  { id: 'twitter', steps: 'Settings → Your account → Download an archive of your data', url: 'https://x.com/settings/download_your_data' },
  { id: 'instagram', steps: 'Accounts Center → Download your information → choose JSON format', url: 'https://accountscenter.instagram.com/info_and_permissions/dyi/' },
  { id: 'facebook', steps: 'Accounts Center → Download your information → choose JSON format', url: 'https://accountscenter.facebook.com/info_and_permissions/dyi/' },
  { id: 'tiktok', steps: 'Settings → Account → Download your data → choose JSON', url: 'https://www.tiktok.com/setting/download-your-data' },
  { id: 'substack', steps: 'Dashboard → Settings → Exports → Create new export', url: '' },
  { id: 'ghost', steps: 'Settings → Advanced → Import/Export → Export content', url: '' },
  { id: 'wordpress', steps: 'Tools → Export → All content (downloads an .xml file)', url: '' },
  { id: 'medium', steps: 'Settings → Security and apps → Download your information', url: 'https://medium.com/me/settings/security' },
  { id: 'blogger', steps: 'Google Takeout → select Blogger, or Settings → Back up content', url: 'https://takeout.google.com/' }
]

// ── File input ───────────────────────────────────────────────────
const dragging = ref(false)
const fileInput = ref(null)
const onFiles = (files) => {
  const file = files?.[0]
  if (file) loadFile(file)
}
const onDrop = (e) => {
  dragging.value = false
  onFiles(e.dataTransfer?.files)
}

// ── Review / filters ─────────────────────────────────────────────
const filters = reactive({ search: '', mediaOnly: false, replies: false, reposts: false, showImported: false })
const PAGE_SIZE = 50
const visibleCount = ref(PAGE_SIZE)
const siteUrlDraft = ref('')

watch(source, (s) => {
  visibleCount.value = PAGE_SIZE
  siteUrlDraft.value = s?.siteUrl || ''
  Object.assign(filters, { search: '', mediaOnly: false, replies: false, reposts: false, showImported: false })
})

const platformInfo = computed(() => IMPORT_PLATFORMS[source.value?.platform] || { label: 'Export', kind: 'blog' })
const isBlog = computed(() => platformInfo.value.kind === 'blog')

const filtered = computed(() => {
  const q = filters.search.trim().toLowerCase()
  return items.value
    .filter(i => filters.showImported || !i.imported)
    .filter(i => filters.replies || !i.isReply)
    .filter(i => filters.reposts || !i.isRepost)
    .filter(i => !filters.mediaOnly || i.media?.length)
    .filter(i => !q || itemLabel(i).toLowerCase().includes(q) || (i.text || i.html || '').toLowerCase().includes(q))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
})
const visible = computed(() => filtered.value.slice(0, visibleCount.value))
const selectableFiltered = computed(() => filtered.value.filter(i => !i.imported))
const selectedCount = computed(() => items.value.filter(i => selected.value.has(i.key) && !i.imported).length)
const allFilteredSelected = computed(() => selectableFiltered.value.length > 0 && selectableFiltered.value.every(i => selected.value.has(i.key)))

const toggleAllFiltered = () => setSelected(selectableFiltered.value.map(i => i.key), !allFilteredSelected.value)

// ── Options / run ────────────────────────────────────────────────
const options = reactive({ preserveDates: true, mirrorMedia: true, includeFooter: true, extraTags: '' })
const runError = ref('')

const handleStart = async () => {
  runError.value = ''
  try {
    await startImport({
      preserveDates: options.preserveDates,
      mirrorMedia: options.mirrorMedia,
      includeFooter: options.includeFooter,
      extraTags: options.extraTags.split(',').map(t => t.trim()).filter(Boolean)
    })
  } catch (err) {
    runError.value = getUserFriendlyError(err)
  }
}

const progressPct = computed(() => (job.total ? Math.round((job.done / job.total) * 100) : 0))
const showResults = computed(() => !job.running && job.finishedAt && job.total > 0)

const formatDate = unix => (unix ? new Date(unix * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date')
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-gray-600 max-w-3xl">
      Coming from another platform? Bring your posts, photos and articles with you so your Nostr profile isn’t empty on day one.
      Upload the data export your platform gives you. Everything is read in your browser, and media is uploaded to your Blossom servers.
    </p>

    <div v-if="!isAuthenticated" class="text-center py-16 px-4 bg-white rounded-xl border border-gray-200">
      <IconUpload class="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Sign in to import your content</h3>
      <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">Connect your Nostr identity first. Imported posts are published under your key.</p>
    </div>

    <template v-else>
      <!-- Step 1: upload -->
      <template v-if="!source">
        <div
          :class="['rounded-xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors', dragging ? 'border-orange-400 bg-orange-50' : 'border-gray-300 bg-white']"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <IconLoader2 v-if="isParsing" class="w-10 h-10 mx-auto mb-3 text-orange-500 animate-spin" />
          <IconFileZip v-else class="w-10 h-10 mx-auto mb-3 text-orange-500" />
          <p class="font-semibold text-gray-900">{{ isParsing ? 'Reading your export…' : 'Drop your export here' }}</p>
          <p class="text-sm text-gray-500 mt-1">ZIP archive, or a single .json, .js, .xml or .atom file from it</p>
          <button
            type="button"
            class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60"
            :disabled="isParsing"
            @click="fileInput?.click()"
          >
            <IconUpload class="w-4 h-4" /> Choose file
          </button>
          <input ref="fileInput" type="file" class="hidden" accept=".zip,.json,.js,.xml,.atom,.rss" @change="onFiles($event.target.files); $event.target.value = ''">
          <p v-if="parseError" class="mt-4 text-sm text-red-700 flex items-center justify-center gap-1" role="alert">
            <IconAlertTriangle class="w-4 h-4 flex-shrink-0" /> {{ parseError }}
          </p>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-900 mb-3">How to get your export</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div v-for="g in GUIDES" :key="g.id" class="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-medium text-gray-900">{{ IMPORT_PLATFORMS[g.id].label }}</p>
                <a v-if="g.url" :href="g.url" target="_blank" rel="noopener noreferrer" class="text-gray-400 hover:text-orange-600" :aria-label="`Open ${IMPORT_PLATFORMS[g.id].label} export page`">
                  <IconExternalLink class="w-4 h-4" />
                </a>
              </div>
              <p class="text-xs text-gray-600 mt-1 leading-relaxed">{{ g.steps }}</p>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
            <IconRss class="w-4 h-4 text-orange-500 flex-shrink-0" />
            Still publishing on your blog? The
            <button type="button" class="text-orange-600 hover:underline font-medium" @click="changePage('content-bridge')">Content Bridge</button>
            keeps new posts in sync automatically.
          </p>
        </div>
      </template>

      <!-- Step 2 & 3: review / import -->
      <template v-else>
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-medium text-orange-600 uppercase tracking-wide">{{ platformInfo.label }} export</p>
              <h2 class="text-lg font-semibold text-gray-900 truncate">{{ source.account || source.fileName }}</h2>
              <p class="text-sm text-gray-600 mt-1">
                {{ summary.total }} {{ isBlog ? 'article' : 'post' }}{{ summary.total === 1 ? '' : 's' }}
                <template v-if="summary.from"> · {{ formatDate(summary.from) }} to {{ formatDate(summary.to) }}</template>
                <template v-if="summary.withMedia"> · {{ summary.withMedia }} with media</template>
                <template v-if="summary.imported"> · {{ summary.imported }} already imported</template>
              </p>
            </div>
            <button v-if="!job.running" type="button" class="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 self-start" @click="clearSource">
              <IconX class="w-4 h-4" /> Choose another file
            </button>
          </div>

          <ul v-if="source.warnings?.length" class="mt-3 space-y-1">
            <li v-for="w in source.warnings" :key="w" class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <IconAlertTriangle class="w-4 h-4 mt-0.5 flex-shrink-0" /> {{ w }}
            </li>
          </ul>

          <form v-if="['ghost', 'substack'].includes(source.platform)" class="mt-4 flex flex-col sm:flex-row gap-2 sm:items-end" @submit.prevent="setSiteUrl(siteUrlDraft)">
            <label class="flex-1 flex flex-col gap-1 text-sm">
              <span class="font-medium text-gray-700">Your {{ platformInfo.label }} site address <span class="font-normal text-gray-400">(recommended)</span></span>
              <input v-model="siteUrlDraft" type="url" placeholder="https://yourblog.com" class="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <span class="text-xs text-gray-500">Used for article links and images, and so posts match anything the Content Bridge syndicates.</span>
            </label>
            <button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 sm:mb-6" :disabled="isParsing || job.running">Apply</button>
          </form>
        </div>

        <!-- Progress / results -->
        <div v-if="job.running || showResults" class="bg-white rounded-xl border border-gray-200 p-5 space-y-3" role="status" aria-live="polite">
          <div class="flex items-center justify-between gap-3">
            <p class="font-semibold text-gray-900">
              <template v-if="job.running">{{ job.paused ? 'Paused' : 'Importing…' }} {{ job.done }} of {{ job.total }}</template>
              <template v-else>Import finished: {{ job.published }} published<template v-if="job.failed">, {{ job.failed }} failed</template><template v-if="job.done < job.total">, {{ job.total - job.done }} not started (cancelled)</template></template>
            </p>
            <div v-if="job.running" class="flex gap-2">
              <button v-if="!job.paused" type="button" class="px-3 py-1.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1" @click="pause"><IconPlayerPause class="w-4 h-4" /> Pause</button>
              <button v-else type="button" class="px-3 py-1.5 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1" @click="resume"><IconPlayerPlay class="w-4 h-4" /> Resume</button>
              <button type="button" class="px-3 py-1.5 rounded-lg text-sm text-red-700 hover:bg-red-50 border border-red-200" :disabled="job.cancelRequested" @click="cancel">Cancel</button>
            </div>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-orange-500 transition-all" :style="{ width: `${progressPct}%` }" />
          </div>
          <p v-if="job.current" class="text-sm text-gray-600 truncate">{{ job.current }}</p>
          <p v-if="job.running" class="text-xs text-gray-500">Your signer may ask you to approve each event and upload. Choosing “always allow” for this site makes large imports much smoother.</p>
          <details v-if="job.errors.length || job.warnings.length" class="text-sm">
            <summary class="cursor-pointer text-gray-700">{{ job.errors.length }} error{{ job.errors.length === 1 ? '' : 's' }}, {{ job.warnings.length }} warning{{ job.warnings.length === 1 ? '' : 's' }}</summary>
            <ul class="mt-2 space-y-1 max-h-48 overflow-y-auto">
              <li v-for="(e, i) in job.errors" :key="'e' + i" class="text-red-700"><span class="font-medium">{{ e.label }}</span>: {{ e.message }}</li>
              <li v-for="(w, i) in job.warnings" :key="'w' + i" class="text-amber-800">{{ w }}</li>
            </ul>
          </details>
          <div v-if="showResults && job.published" class="flex flex-wrap gap-2 pt-1">
            <button type="button" class="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white" @click="changePage(isBlog ? 'content' : 'notes')">View your {{ isBlog ? 'articles' : 'notes' }}</button>
          </div>
        </div>

        <!-- Options -->
        <div v-if="!job.running" class="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label v-if="!isBlog" class="flex items-start gap-2 cursor-pointer">
            <input v-model="options.preserveDates" type="checkbox" class="mt-0.5 accent-orange-500">
            <span><span class="font-medium text-gray-700">Keep original post dates</span><br><span class="text-xs text-gray-500">Posts appear in your history at the date you first published them, instead of flooding your followers’ feeds today.</span></span>
          </label>
          <label v-if="isBlog" class="flex items-start gap-2 cursor-pointer">
            <input v-model="options.mirrorMedia" type="checkbox" class="mt-0.5 accent-orange-500">
            <span><span class="font-medium text-gray-700">Copy article images to Blossom</span><br><span class="text-xs text-gray-500">So your articles don’t depend on the old site staying online.</span></span>
          </label>
          <label v-if="isBlog" class="flex items-start gap-2 cursor-pointer">
            <input v-model="options.includeFooter" type="checkbox" class="mt-0.5 accent-orange-500">
            <span class="font-medium text-gray-700">Add “Originally published on” link</span>
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-medium text-gray-700">Extra hashtags <span class="font-normal text-gray-400">(comma-separated)</span></span>
            <input v-model="options.extraTags" type="text" placeholder="introductions" class="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400">
          </label>
          <p v-if="!isBlog" class="text-xs text-gray-500 sm:col-span-2">Photos and videos are uploaded to your Blossom servers (up to 20 MB each). X/Twitter threads stay linked as replies.</p>
        </div>

        <!-- Item list -->
        <div class="bg-white rounded-xl border border-gray-200">
          <div class="p-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-3">
            <input v-model="filters.search" type="search" placeholder="Search posts" aria-label="Search posts" class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <div class="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
              <label v-if="summary.withMedia" class="flex items-center gap-1.5 cursor-pointer"><input v-model="filters.mediaOnly" type="checkbox" class="accent-orange-500"> With media</label>
              <label v-if="summary.replies" class="flex items-center gap-1.5 cursor-pointer"><input v-model="filters.replies" type="checkbox" class="accent-orange-500"> Replies ({{ summary.replies }})</label>
              <label v-if="summary.reposts" class="flex items-center gap-1.5 cursor-pointer"><input v-model="filters.reposts" type="checkbox" class="accent-orange-500"> Reposts ({{ summary.reposts }})</label>
              <label v-if="summary.imported" class="flex items-center gap-1.5 cursor-pointer"><input v-model="filters.showImported" type="checkbox" class="accent-orange-500"> Already imported</label>
            </div>
          </div>

          <div class="px-4 py-2 flex items-center justify-between gap-3 text-sm border-b border-gray-100">
            <label class="flex items-center gap-2 cursor-pointer text-gray-700">
              <input type="checkbox" class="accent-orange-500" :checked="allFilteredSelected" :disabled="job.running || !selectableFiltered.length" @change="toggleAllFiltered">
              Select all {{ selectableFiltered.length }} shown
            </label>
            <span class="text-gray-500 tabular-nums">{{ selectedCount }} selected</span>
          </div>

          <p v-if="!filtered.length" class="px-5 py-10 text-center text-sm text-gray-500">No posts match these filters.</p>
          <ul v-else class="divide-y divide-gray-100">
            <li v-for="item in visible" :key="item.key">
              <label :class="['px-4 py-3 flex items-start gap-3', item.imported ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50']">
                <input
                  type="checkbox"
                  class="mt-1 accent-orange-500"
                  :checked="selected.has(item.key) && !item.imported"
                  :disabled="item.imported || job.running"
                  @change="setSelected([item.key], $event.target.checked)"
                >
                <div class="min-w-0 flex-1">
                  <p :class="['text-sm text-gray-900 break-words', item.type === 'article' ? 'font-medium' : '']">{{ itemLabel(item) }}</p>
                  <p class="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{{ formatDate(item.created) }}</span>
                    <span v-if="item.type === 'article'" class="inline-flex items-center gap-1"><IconFileText class="w-3.5 h-3.5" /> Article</span>
                    <span v-if="item.media?.length" class="inline-flex items-center gap-1"><IconPhoto class="w-3.5 h-3.5" /> {{ item.media.length }}</span>
                    <span v-if="item.replyToId" class="inline-flex items-center gap-1"><IconMessageCircle class="w-3.5 h-3.5" /> Thread</span>
                    <span v-if="item.isReply" class="inline-flex items-center gap-1"><IconMessageCircle class="w-3.5 h-3.5" /> Reply</span>
                    <span v-if="item.isRepost" class="inline-flex items-center gap-1"><IconRepeat class="w-3.5 h-3.5" /> Repost</span>
                    <span v-if="item.imported" class="inline-flex items-center gap-1 text-green-700"><IconCheck class="w-3.5 h-3.5" /> Imported</span>
                    <a v-if="item.sourceUrl" :href="item.sourceUrl" target="_blank" rel="noopener noreferrer" class="hover:text-orange-600 inline-flex items-center gap-1" @click.stop><IconExternalLink class="w-3.5 h-3.5" /> Original</a>
                  </p>
                </div>
              </label>
            </li>
          </ul>
          <div v-if="visible.length < filtered.length" class="p-4 text-center border-t border-gray-100">
            <button type="button" class="text-sm font-medium text-orange-600 hover:underline" @click="visibleCount += PAGE_SIZE">Show {{ Math.min(PAGE_SIZE, filtered.length - visible.length) }} more of {{ filtered.length - visible.length }}</button>
          </div>
        </div>

        <!-- Action bar -->
        <div v-if="!job.running" class="sticky bottom-4 z-10">
          <div class="bg-gray-900 text-white rounded-xl shadow-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p class="text-sm">
              <span class="font-semibold tabular-nums">{{ selectedCount }}</span> {{ isBlog ? 'article' : 'post' }}{{ selectedCount === 1 ? '' : 's' }} selected
              <span v-if="runError" class="block text-red-300 mt-1">{{ runError }}</span>
            </p>
            <button type="button" class="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 disabled:opacity-50 inline-flex items-center justify-center gap-2" :disabled="!selectedCount" @click="handleStart">
              <IconUpload class="w-4 h-4" /> Import to Nostr
            </button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
