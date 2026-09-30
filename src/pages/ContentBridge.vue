<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useContentBridge, ITEM_STATUS } from '../composables/content/useContentBridge.js'
import { SYNDICATION_MODES } from '../utils/bridge/articleToEvent.js'
import { PLATFORM_LABELS } from '../utils/bridge/feedParser.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import BridgePreviewModal from '../components/bridge/BridgePreviewModal.vue'
import {
  IconRss,
  IconRefresh,
  IconTrash,
  IconSettings,
  IconPlus,
  IconCheck,
  IconPlayerSkipForward,
  IconEye,
  IconAlertTriangle,
  IconArrowBackUp,
  IconLoader2,
  IconExternalLink,
  IconSend,
  IconChevronDown,
  IconChevronUp
} from '@iconify-prerendered/vue-tabler'

const { isAuthenticated } = useNostrAuth()
const {
  feeds,
  stats,
  checking,
  itemsFor,
  addFeed,
  removeFeed,
  updateFeedSettings,
  checkFeed,
  checkAll,
  previewItem,
  publishItem,
  skipItem,
  resetItem
} = useContentBridge()

// ── Inline status ────────────────────────────────────────────────
const status = ref(null)
let statusTimer = null
const showStatus = (message, type = 'info') => {
  clearTimeout(statusTimer)
  status.value = { message, type }
  statusTimer = setTimeout(() => { status.value = null }, 6000)
}

// ── Add feed ─────────────────────────────────────────────────────
const addForm = reactive({
  url: '',
  mode: SYNDICATION_MODES.LONGFORM,
  autoPublish: false,
  mirrorMedia: true,
  includeFooter: true,
  extraTags: ''
})
const isAdding = ref(false)
const addError = ref('')

const parseTagInput = value => value.split(',').map(t => t.trim()).filter(Boolean)

const handleAddFeed = async () => {
  addError.value = ''
  isAdding.value = true
  try {
    const feed = await addFeed(addForm.url, { ...addForm, extraTags: parseTagInput(addForm.extraTags) })
    expanded[feed.id] = true
    addForm.url = ''
    addForm.extraTags = ''
    showStatus(`Connected “${feed.title}”. Existing posts are listed under Backlog, and new posts will show up as they’re published.`, 'success')
  } catch (err) {
    addError.value = getUserFriendlyError(err)
  } finally {
    isAdding.value = false
  }
}

const PLATFORM_HINTS = [
  { label: 'Ghost', example: 'yourblog.com/rss/' },
  { label: 'Substack', example: 'you.substack.com' },
  { label: 'Medium', example: 'medium.com/@you' },
  { label: 'WordPress', example: 'yourblog.com/feed/' },
  { label: 'Blogger', example: 'you.blogspot.com' },
  { label: 'Discourse', example: 'forum.example.com/latest.rss' }
]

// ── Feed cards ───────────────────────────────────────────────────
const expanded = reactive({})
const settingsOpen = reactive({})
const confirmingRemove = ref(null)
const filters = reactive({})
const tagDrafts = reactive({})

const FILTERS = [
  { id: ITEM_STATUS.NEW, label: 'New' },
  { id: ITEM_STATUS.BACKLOG, label: 'Backlog' },
  { id: ITEM_STATUS.PUBLISHED, label: 'Published' },
  { id: ITEM_STATUS.SKIPPED, label: 'Skipped' },
  { id: 'all', label: 'All' }
]

const STATUS_STYLES = {
  [ITEM_STATUS.NEW]: 'bg-orange-100 text-orange-800',
  [ITEM_STATUS.BACKLOG]: 'bg-gray-100 text-gray-700',
  [ITEM_STATUS.PUBLISHED]: 'bg-green-100 text-green-800',
  [ITEM_STATUS.SKIPPED]: 'bg-gray-100 text-gray-500'
}

const feedView = computed(() => feeds.value.map(feed => {
  const items = itemsFor(feed.id)
  const counts = Object.fromEntries(FILTERS.map(f => [f.id, f.id === 'all' ? items.length : items.filter(i => i.status === f.id).length]))
  const active = filters[feed.id] || (counts[ITEM_STATUS.NEW] ? ITEM_STATUS.NEW : 'all')
  return {
    feed,
    counts,
    activeFilter: active,
    items: (active === 'all' ? items : items.filter(i => i.status === active))
      .slice()
      .sort((a, b) => (b.published || 0) - (a.published || 0)),
    isChecking: checking.value.has(feed.id)
  }
}))

const toggleSettings = (feed) => {
  settingsOpen[feed.id] = !settingsOpen[feed.id]
  if (settingsOpen[feed.id]) tagDrafts[feed.id] = (feed.extraTags || []).join(', ')
}

const saveTags = (feed) => {
  updateFeedSettings(feed.id, { extraTags: parseTagInput(tagDrafts[feed.id] || '') })
}

const handleRemove = (feed) => {
  if (confirmingRemove.value !== feed.id) {
    confirmingRemove.value = feed.id
    return
  }
  removeFeed(feed.id)
  confirmingRemove.value = null
  showStatus(`Disconnected “${feed.title}”.`)
}

const handleCheck = async (feed) => {
  await checkFeed(feed.id)
  const updated = feeds.value.find(f => f.id === feed.id)
  if (updated?.lastError) showStatus(updated.lastError, 'error')
}

// ── Preview / publish ────────────────────────────────────────────
const previewState = reactive({ show: false, feedId: null, key: null, data: null })

const openPreview = (feed, item) => {
  previewState.feedId = feed.id
  previewState.key = item.key
  previewState.data = previewItem(feed.id, item.key)
  previewState.show = !!previewState.data
}

const previewBusyMessage = computed(() => {
  if (!previewState.show) return ''
  return itemsFor(previewState.feedId).find(i => i.key === previewState.key)?.publishingMessage || ''
})

const previewMirrorMedia = computed(() => feeds.value.find(f => f.id === previewState.feedId)?.mirrorMedia ?? true)

const handlePublish = async (feedId, key) => {
  try {
    const res = await publishItem(feedId, key)
    if (!res) return
    const relays = res.result.successful
    const mediaNote = res.failedMedia.length ? ` ${res.failedMedia.length} image(s) couldn’t be copied to Blossom and still link to the original.` : ''
    showStatus(`Published to ${relays} relay${relays === 1 ? '' : 's'}.${mediaNote}`, res.failedMedia.length ? 'info' : 'success')
    if (previewState.key === key) previewState.show = false
  } catch (err) {
    showStatus(`Publish failed: ${getUserFriendlyError(err)}`, 'error')
  }
}

const formatDate = (unix) => {
  if (!unix) return 'Unknown date'
  return new Date(unix * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatAgo = (unix) => {
  if (!unix) return 'never'
  const diff = Math.floor(Date.now() / 1000) - unix
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return formatDate(unix)
}

onMounted(() => {
  if (isAuthenticated.value) checkAll()
})
watch(isAuthenticated, authed => { if (authed) checkAll() })
</script>

<template>
  <div class="space-y-6">
    <transition name="slide-down">
      <div v-if="status" role="status" aria-live="polite" :class="[
        'px-4 py-3 rounded-lg text-sm font-medium',
        status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
        status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
        'bg-blue-50 text-blue-800 border border-blue-200'
      ]">
        {{ status.message }}
      </div>
    </transition>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p class="text-sm text-gray-600 max-w-2xl">
          Keep publishing on Ghost, Substack, Medium, WordPress or any blog with an RSS feed. The Bridge picks up new posts and publishes them to Nostr, with images copied to Blossom.
        </p>
      </div>
      <button
        v-if="isAuthenticated && feeds.length"
        class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 self-start sm:self-auto"
        :disabled="checking.size > 0"
        @click="checkAll({ force: true })"
      >
        <IconRefresh :class="['w-4 h-4', checking.size ? 'animate-spin' : '']" /> Check all feeds
      </button>
    </div>

    <div v-if="!isAuthenticated" class="text-center py-16 px-4 bg-white rounded-xl border border-gray-200">
      <IconRss class="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Sign in to connect your blog</h3>
      <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">Connect your Nostr identity to syndicate posts from your existing publishing tools to Nostr.</p>
    </div>

    <template v-else>
      <!-- Stats -->
      <div v-if="feeds.length" class="grid grid-cols-3 gap-3">
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs text-gray-500">Connected feeds</p>
          <p class="text-2xl font-bold text-gray-900 tabular-nums">{{ stats.feeds }}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs text-gray-500">New, not yet on Nostr</p>
          <p class="text-2xl font-bold text-orange-600 tabular-nums">{{ stats.pending }}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
          <p class="text-xs text-gray-500">Published to Nostr</p>
          <p class="text-2xl font-bold text-green-600 tabular-nums">{{ stats.published }}</p>
        </div>
      </div>

      <!-- Add feed -->
      <form class="bg-white rounded-xl border border-gray-200 p-5 space-y-4" @submit.prevent="handleAddFeed">
        <div>
          <label for="bridge-feed-url" class="block text-sm font-semibold text-gray-900 mb-1">Connect a blog or feed</label>
          <p class="text-xs text-gray-500 mb-3">Paste your blog’s address or its RSS/Atom feed URL. The feed is found automatically.</p>
          <div class="flex flex-col sm:flex-row gap-2">
            <input
              id="bridge-feed-url"
              v-model="addForm.url"
              type="text"
              inputmode="url"
              autocomplete="url"
              placeholder="yourblog.substack.com"
              class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
              :aria-invalid="!!addError"
              aria-describedby="bridge-add-error"
            >
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60"
              :disabled="isAdding || !addForm.url.trim()"
            >
              <IconLoader2 v-if="isAdding" class="w-4 h-4 animate-spin" />
              <IconPlus v-else class="w-4 h-4" />
              {{ isAdding ? 'Finding feed…' : 'Connect' }}
            </button>
          </div>
          <p v-if="addError" id="bridge-add-error" class="text-sm text-red-700 mt-2 flex items-center gap-1">
            <IconAlertTriangle class="w-4 h-4 flex-shrink-0" /> {{ addError }}
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label class="flex flex-col gap-1">
            <span class="text-gray-700 font-medium">Publish as</span>
            <select v-model="addForm.mode" class="px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option :value="SYNDICATION_MODES.LONGFORM">Full article (long-form, kind 30023)</option>
              <option :value="SYNDICATION_MODES.NOTE">Short note with link (kind 1)</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-gray-700 font-medium">Extra hashtags <span class="text-gray-400 font-normal">(comma-separated)</span></span>
            <input v-model="addForm.extraTags" type="text" placeholder="writing, bitcoin" class="px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400">
          </label>
          <label class="flex items-start gap-2 cursor-pointer">
            <input v-model="addForm.autoPublish" type="checkbox" class="mt-0.5 accent-orange-500">
            <span><span class="font-medium text-gray-700">Auto-publish new posts</span><br><span class="text-xs text-gray-500">Checked every 10 minutes while ZapTracker is open. Only posts published after you connect.</span></span>
          </label>
          <label class="flex items-start gap-2 cursor-pointer">
            <input v-model="addForm.mirrorMedia" type="checkbox" class="mt-0.5 accent-orange-500">
            <span><span class="font-medium text-gray-700">Copy images to Blossom</span><br><span class="text-xs text-gray-500">Uploads article images to your Blossom servers, so the post doesn’t depend on the original site.</span></span>
          </label>
          <label class="flex items-start gap-2 cursor-pointer">
            <input v-model="addForm.includeFooter" type="checkbox" class="mt-0.5 accent-orange-500">
            <span><span class="font-medium text-gray-700">Add “Originally published on” link</span></span>
          </label>
        </div>

        <div v-if="!feeds.length" class="flex flex-wrap gap-2 pt-1">
          <span v-for="hint in PLATFORM_HINTS" :key="hint.label" class="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-600">
            <span class="font-medium text-gray-800">{{ hint.label }}</span> · {{ hint.example }}
          </span>
        </div>
      </form>

      <!-- Feeds -->
      <div v-for="view in feedView" :key="view.feed.id" class="bg-white rounded-xl border border-gray-200">
        <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3">
          <button class="flex-1 min-w-0 text-left" :aria-expanded="!!expanded[view.feed.id]" @click="expanded[view.feed.id] = !expanded[view.feed.id]">
            <div class="flex items-center gap-2 flex-wrap">
              <component :is="expanded[view.feed.id] ? IconChevronUp : IconChevronDown" class="w-4 h-4 text-gray-400 flex-shrink-0" />
              <h2 class="font-semibold text-gray-900 truncate">{{ view.feed.title }}</h2>
              <span class="text-xs bg-gray-100 text-gray-700 rounded-md px-2 py-0.5">{{ PLATFORM_LABELS[view.feed.platform] || 'RSS' }}</span>
              <span v-if="view.feed.autoPublish" class="text-xs bg-orange-100 text-orange-800 rounded-md px-2 py-0.5">Auto-publish</span>
              <span v-if="view.counts[ITEM_STATUS.NEW]" class="text-xs bg-orange-500 text-white rounded-full px-2 py-0.5 tabular-nums">{{ view.counts[ITEM_STATUS.NEW] }} new</span>
            </div>
            <p class="text-xs text-gray-500 mt-1 ml-6 truncate">{{ view.feed.url }} · checked {{ formatAgo(view.feed.lastChecked) }}</p>
            <p v-if="view.feed.lastError" class="text-xs text-red-700 mt-1 ml-6 flex items-center gap-1">
              <IconAlertTriangle class="w-3.5 h-3.5 flex-shrink-0" /> {{ view.feed.lastError }}
            </p>
          </button>
          <div class="flex items-center gap-1 ml-6 sm:ml-0">
            <button class="p-2 rounded-lg hover:bg-gray-100 text-gray-600" :aria-label="`Check ${view.feed.title} now`" :disabled="view.isChecking" @click="handleCheck(view.feed)">
              <IconRefresh :class="['w-4 h-4', view.isChecking ? 'animate-spin' : '']" />
            </button>
            <button class="p-2 rounded-lg hover:bg-gray-100 text-gray-600" :aria-label="`Settings for ${view.feed.title}`" :aria-expanded="!!settingsOpen[view.feed.id]" @click="toggleSettings(view.feed)">
              <IconSettings class="w-4 h-4" />
            </button>
            <button
              :class="['rounded-lg text-sm', confirmingRemove === view.feed.id ? 'px-3 py-1.5 bg-red-600 text-white hover:bg-red-700' : 'p-2 hover:bg-gray-100 text-gray-600']"
              :aria-label="`Disconnect ${view.feed.title}`"
              @click="handleRemove(view.feed)"
              @blur="confirmingRemove = null"
            >
              <span v-if="confirmingRemove === view.feed.id">Disconnect?</span>
              <IconTrash v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Settings -->
        <div v-if="settingsOpen[view.feed.id]" class="px-4 sm:px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t border-gray-100 pt-4">
          <label class="flex flex-col gap-1">
            <span class="text-gray-700 font-medium">Publish as</span>
            <select :value="view.feed.mode" class="px-3 py-2 rounded-lg border border-gray-300 bg-white" @change="updateFeedSettings(view.feed.id, { mode: $event.target.value })">
              <option :value="SYNDICATION_MODES.LONGFORM">Full article (long-form, kind 30023)</option>
              <option :value="SYNDICATION_MODES.NOTE">Short note with link (kind 1)</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-gray-700 font-medium">Extra hashtags</span>
            <input v-model="tagDrafts[view.feed.id]" type="text" class="px-3 py-2 rounded-lg border border-gray-300" @blur="saveTags(view.feed)" @keydown.enter.prevent="saveTags(view.feed)">
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="accent-orange-500" :checked="view.feed.autoPublish" @change="updateFeedSettings(view.feed.id, { autoPublish: $event.target.checked })">
            <span class="text-gray-700">Auto-publish new posts</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="accent-orange-500" :checked="view.feed.mirrorMedia" @change="updateFeedSettings(view.feed.id, { mirrorMedia: $event.target.checked })">
            <span class="text-gray-700">Copy images to Blossom</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="accent-orange-500" :checked="view.feed.includeFooter" @change="updateFeedSettings(view.feed.id, { includeFooter: $event.target.checked })">
            <span class="text-gray-700">Add “Originally published on” link</span>
          </label>
        </div>

        <!-- Items -->
        <div v-if="expanded[view.feed.id]" class="border-t border-gray-100">
          <div class="flex gap-1 px-4 sm:px-5 pt-3 overflow-x-auto" role="tablist">
            <button
              v-for="f in FILTERS"
              :key="f.id"
              role="tab"
              :aria-selected="view.activeFilter === f.id"
              :class="['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap', view.activeFilter === f.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100']"
              @click="filters[view.feed.id] = f.id"
            >
              {{ f.label }} <span class="tabular-nums opacity-70">{{ view.counts[f.id] }}</span>
            </button>
          </div>

          <p v-if="view.isChecking && !view.items.length" class="px-5 py-8 text-center text-sm text-gray-500">Loading posts…</p>
          <p v-else-if="!view.items.length" class="px-5 py-8 text-center text-sm text-gray-500">
            {{ view.activeFilter === ITEM_STATUS.NEW ? 'Nothing new. Posts you publish on your blog from now on will show up here.' : 'No posts here.' }}
          </p>

          <ul v-else class="divide-y divide-gray-100">
            <li v-for="item in view.items" :key="item.key" class="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <img v-if="item.image" :src="item.image" alt="" class="hidden sm:block w-16 h-12 object-cover rounded-md border border-gray-200 flex-shrink-0" loading="lazy" referrerpolicy="no-referrer">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span :class="['text-[11px] font-medium rounded px-1.5 py-0.5', STATUS_STYLES[item.status]]">{{ FILTERS.find(f => f.id === item.status)?.label }}</span>
                  <a :href="item.link" target="_blank" rel="noopener noreferrer" class="font-medium text-gray-900 hover:text-orange-600 truncate max-w-full">{{ item.title }}</a>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ formatDate(item.published) }}
                  <template v-if="item.record?.status === ITEM_STATUS.PUBLISHED">
                    · {{ item.record.auto ? 'auto-published' : 'published' }} {{ formatAgo(item.record.at) }}
                  </template>
                  <template v-else-if="item.status === ITEM_STATUS.PUBLISHED"> · already on Nostr</template>
                </p>
                <p v-if="item.publishingMessage" class="text-xs text-orange-700 mt-1 flex items-center gap-1" role="status">
                  <IconLoader2 class="w-3.5 h-3.5 animate-spin" /> {{ item.publishingMessage }}
                </p>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 inline-flex items-center gap-1" @click="openPreview(view.feed, item)">
                  <IconEye class="w-3.5 h-3.5" /> Preview
                </button>
                <template v-if="item.status === ITEM_STATUS.NEW || item.status === ITEM_STATUS.BACKLOG">
                  <button class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 inline-flex items-center gap-1" :disabled="!!item.publishingMessage" @click="skipItem(view.feed.id, item.key)">
                    <IconPlayerSkipForward class="w-3.5 h-3.5" /> Skip
                  </button>
                  <button class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60 inline-flex items-center gap-1" :disabled="!!item.publishingMessage" @click="handlePublish(view.feed.id, item.key)">
                    <IconSend class="w-3.5 h-3.5" /> Publish
                  </button>
                </template>
                <template v-else>
                  <span v-if="item.status === ITEM_STATUS.PUBLISHED" class="text-green-600 px-1" aria-label="Published"><IconCheck class="w-4 h-4" /></span>
                  <button
                    v-if="item.record"
                    class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 inline-flex items-center gap-1"
                    :title="item.status === ITEM_STATUS.PUBLISHED ? 'Mark as not published so it can be published again (long-form updates the existing article)' : 'Undo skip'"
                    @click="resetItem(item.key)"
                  >
                    <IconArrowBackUp class="w-3.5 h-3.5" /> {{ item.status === ITEM_STATUS.SKIPPED ? 'Undo' : 'Republish' }}
                  </button>
                  <a v-if="item.link" :href="item.link" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Open original">
                    <IconExternalLink class="w-3.5 h-3.5" />
                  </a>
                </template>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <BridgePreviewModal
      :show="previewState.show"
      :preview="previewState.data"
      :mirror-media="previewMirrorMedia"
      :busy="!!previewBusyMessage"
      :busy-message="previewBusyMessage"
      @close="previewState.show = false"
      @publish="handlePublish(previewState.feedId, previewState.key)"
    />
  </div>
</template>
