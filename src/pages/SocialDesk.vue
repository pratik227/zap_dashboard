<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import {
  IconColumns,
  IconPlus,
  IconHash,
  IconUser,
  IconUsers,
  IconAt,
  IconWorld,
  IconBolt,
  IconLoader,
  IconMenu2,
  IconX,
  IconArticle
} from '@iconify-prerendered/vue-tabler'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useDeskColumns, COLUMN_TYPES, LONGFORM_FILTER_MODES, createLongformFilter } from '../composables/social/useDeskColumns.js'
import { useDeskInteractions } from '../composables/social/useDeskInteractions.js'
import { useEngagementMetrics } from '../composables/analytics/useEngagementMetrics.js'
import { useContentZaps } from '../composables/content/useContentZaps.js'
import { usePublish } from '../composables/core/usePublish.js'
import { createReactionEventTemplate, createRepostEventTemplate } from '../services/nostr/nostrImports.js'
import { getUserFriendlyError } from '../services/nostr/errors.js'
import { profileService } from '../services/nostr/ProfileService.js'
import DeskColumn from '../components/socialdesk/DeskColumn.vue'
import DeskReplyComposer from '../components/socialdesk/DeskReplyComposer.vue'
import DeskQuoteComposer from '../components/socialdesk/DeskQuoteComposer.vue'
import DeskArticleViewer from '../components/socialdesk/DeskArticleViewer.vue'
import DeskMediaLightbox from '../components/socialdesk/DeskMediaLightbox.vue'
import DeskZapPopover from '../components/socialdesk/DeskZapPopover.vue'
import UserProfileModal from '../components/modals/UserProfileModal.vue'
import UserSearchInput from '../components/audience/UserSearchInput.vue'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'

const emit = defineEmits(['change-page', 'show-help', 'toggle-sidebar'])
const isSidebarOpen = inject('isMobileMenuOpen', ref(false))

const { isAuthenticated, currentUser, userProfile, login, isLoading: isLoginLoading } = useNostrAuth()
const {
  columns,
  columnCount,
  canAddColumn,
  hasColumns,
  maxColumns,
  addColumn,
  removeColumn,
  updateColumn
} = useDeskColumns()
const { getInteractions, recordLocalEvent } = useDeskInteractions()
const { getEngagementCounts, startLongFormContentTracking, startEngagementTracking } = useEngagementMetrics()
const { startZapTracking, getZapCount } = useContentZaps()
const { signAndPublish } = usePublish()

const deskAvatar = computed(() =>
  userProfile.value?.picture || generateAvatar(currentUser.value?.pubkey)
)

const DEFAULT_COLUMNS = [
  { type: COLUMN_TYPES.HASHTAG, filter: 'bitcoin' },
  { type: COLUMN_TYPES.HASHTAG, filter: 'nostr' },
  { type: COLUMN_TYPES.FOLLOWING, filter: '' },
  { type: COLUMN_TYPES.MENTIONS, filter: '' }
]

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
const visibleColumnSlots = computed(() => {
  if (viewportWidth.value >= 1024) return 4
  if (viewportWidth.value >= 768) return 3
  return 1
})
const addCardCount = computed(() => {
  if (!canAddColumn.value || visibleColumnSlots.value <= 1) return 0
  return Math.max(1, visibleColumnSlots.value - columnCount.value)
})

let hasSeededDefaults = false

function ensureDefaultColumns() {
  if (!isAuthenticated.value || hasColumns.value || hasSeededDefaults) return
  hasSeededDefaults = true
  DEFAULT_COLUMNS.forEach((column) => {
    if (canAddColumn.value) {
      addColumn(column.type, column.filter)
    }
  })
}

function syncViewportWidth() {
  viewportWidth.value = window.innerWidth
}

const topBarOffset = computed(() => {
  if (!isSidebarOpen.value) return '0px'
  return viewportWidth.value >= 1024 ? '18rem' : '0px'
})

const topBarStyle = computed(() => ({
  paddingLeft: topBarOffset.value,
  transition: 'padding-left 300ms ease'
}))

// ── Interaction state ─────────────────────────────────────────
const actionToast = ref(null)
let _toastTimer = null
const actionPulseKeys = reactive(new Set())
const actionPulseTimers = new Map()

function showToast(message, type = 'success') {
  clearTimeout(_toastTimer)
  actionToast.value = { message, type }
  _toastTimer = setTimeout(() => { actionToast.value = null }, 2500)
}

function pulseAction(postId, action) {
  const key = `${postId}:${action}`
  actionPulseKeys.add(key)
  if (actionPulseTimers.has(key)) {
    clearTimeout(actionPulseTimers.get(key))
  }
  actionPulseTimers.set(key, setTimeout(() => {
    actionPulseKeys.delete(key)
    actionPulseTimers.delete(key)
  }, 650))
}

// Per-post action locks — prevents multi-click duplicate publishes
const actionLocks = reactive(new Set())

function isLocked(postId, action) {
  return actionLocks.has(`${postId}:${action}`)
}

function lock(postId, action) {
  actionLocks.add(`${postId}:${action}`)
}

function unlock(postId, action) {
  actionLocks.delete(`${postId}:${action}`)
}

function getActionState(postId) {
  return {
    reactBusy: isLocked(postId, 'react'),
    repostBusy: isLocked(postId, 'repost'),
    quoteBusy: isLocked(postId, 'quote'),
    reactAnimated: actionPulseKeys.has(`${postId}:react`),
    repostAnimated: actionPulseKeys.has(`${postId}:repost`)
  }
}

function formatTime(timestamp) {
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`
  return new Date(timestamp * 1000).toLocaleDateString()
}

// Media lightbox
const mediaViewer = ref(null)

function handleMediaOpen(payload) {
  if (!payload?.media?.length) return
  closeReply()
  closeQuote()
  closeZap()
  showProfileModal.value = false
  mediaViewer.value = {
    media: payload.media,
    index: payload.index || 0
  }
}

function closeMediaViewer() {
  mediaViewer.value = null
}

const articleViewerTarget = ref(null)
const articleViewerProfile = computed(() => {
  if (!articleViewerTarget.value?.pubkey) return null
  return articleViewerTarget.value.profile || profileService.getCached(articleViewerTarget.value.pubkey) || null
})
const articleViewerEngagementCounts = computed(() => {
  const eventId = articleViewerTarget.value?.rawEvent?.id
  return eventId ? getEngagementCounts(eventId) : { likes: 0, reposts: 0, bookmarks: 0, totalEngagement: 0 }
})
const articleViewerZapCount = computed(() => {
  const eventId = articleViewerTarget.value?.rawEvent?.id
  return eventId ? getZapCount(eventId) : 0
})
const articleViewerInteractions = computed(() => {
  const post = articleViewerTarget.value
  if (!post) {
    return { reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false }
  }

  const deskCounts = getInteractions(post.id)
  const engagementCounts = post.rawEvent?.id ? getEngagementCounts(post.rawEvent.id) : null
  const zapCount = post.rawEvent?.id ? getZapCount(post.rawEvent.id) : 0

  return {
    ...deskCounts,
    reactions: Math.max(deskCounts.reactions || 0, engagementCounts?.likes || 0),
    reposts: Math.max(deskCounts.reposts || 0, engagementCounts?.reposts || 0),
    zaps: Math.max(deskCounts.zaps || 0, zapCount || 0)
  }
})

async function handleArticleOpen(post) {
  if (post?.rawEvent?.id) {
    startZapTracking(post.rawEvent.id)
    if (post.rawEvent.kind === 30023) {
      const dTag = post.rawEvent.tags?.find((tag) => tag[0] === 'd')?.[1] || post.id
      startLongFormContentTracking(post.rawEvent.id, post.pubkey, dTag)
    } else {
      startEngagementTracking(post.rawEvent.id)
    }
  }

  closeReply()
  closeQuote()
  closeZap()
  closeMediaViewer()
  showProfileModal.value = false
  articleViewerTarget.value = post

  if (!post?.pubkey) return

  try {
    const freshProfile = await profileService.get(post.pubkey)
    if (articleViewerTarget.value?.pubkey === post.pubkey) {
      articleViewerTarget.value = {
        ...articleViewerTarget.value,
        profile: freshProfile || articleViewerTarget.value?.profile || null
      }
    }
  } catch {
    // Best effort: keep the existing profile payload or cached profile.
  }
}

function closeArticleViewer() {
  articleViewerTarget.value = null
}

// Reply composer
const replyTarget = ref(null)

function handleReply(post) {
  closeArticleViewer()
  closeMediaViewer()
  closeQuote()
  closeZap()
  showProfileModal.value = false
  replyTarget.value = post
}

function closeReply() {
  replyTarget.value = null
}

// Quote composer
const quoteTarget = ref(null)

function handleQuote(post) {
  closeArticleViewer()
  closeMediaViewer()
  closeReply()
  closeZap()
  showProfileModal.value = false
  quoteTarget.value = post
}

function closeQuote() {
  quoteTarget.value = null
}

// Zap popover
const zapTarget = ref(null)

function handleZap(post) {
  closeArticleViewer()
  closeMediaViewer()
  closeReply()
  closeQuote()
  showProfileModal.value = false
  zapTarget.value = post
}

function closeZap() {
  zapTarget.value = null
}

// Profile modal
const showProfileModal = ref(false)
const profileTarget = ref(null)

async function handleProfileClick(payload) {
  const pubkey = typeof payload === 'string' ? payload : payload?.pubkey
  if (!pubkey) return

  closeReply()
  closeQuote()
  closeZap()
  closeArticleViewer()
  closeMediaViewer()
  const cachedProfile = typeof payload === 'object' ? payload?.profile : null
  profileTarget.value = { pubkey, profile: cachedProfile || profileService.getCached(pubkey) || null }
  showProfileModal.value = true

  try {
    const profile = await profileService.get(pubkey)
    if (showProfileModal.value && profileTarget.value?.pubkey === pubkey) {
      profileTarget.value = { pubkey, profile }
    }
  } catch {
    // Best effort: keep cached or null profile if fresh fetch fails.
  }
}

// Cleanup toast timer
onMounted(() => {
  ensureDefaultColumns()
  window.addEventListener('resize', syncViewportWidth)
})

onUnmounted(() => {
  clearTimeout(_toastTimer)
  actionPulseTimers.forEach((timer) => clearTimeout(timer))
  actionPulseTimers.clear()
  window.removeEventListener('resize', syncViewportWidth)
})

watch([isAuthenticated, hasColumns], () => {
  ensureDefaultColumns()
}, { immediate: true })

// React (like) — idempotent: checks myReaction before publishing
async function handleReact(post) {
  if (!post?.rawEvent) return
  const postId = post.id
  // Already reacted or action in flight
  const counts = getInteractions(postId)
  if (counts?.myReaction || isLocked(postId, 'react')) return

  lock(postId, 'react')
  showToast('Sending like...', 'info')
  try {
    const template = createReactionEventTemplate(post.rawEvent, '+')
    const { event } = await signAndPublish(template)
    recordLocalEvent(postId, 7, event?.id)
    pulseAction(postId, 'react')
    showToast('Liked')
  } catch (err) {
    showToast(getUserFriendlyError(err), 'error')
  } finally {
    unlock(postId, 'react')
  }
}

// Repost — idempotent: checks myRepost before publishing
async function handleRepost(post) {
  if (!post?.rawEvent) return
  const postId = post.id
  const counts = getInteractions(postId)
  if (counts?.myRepost || isLocked(postId, 'repost')) return

  lock(postId, 'repost')
  showToast('Publishing repost...', 'info')
  try {
    const template = createRepostEventTemplate(post.rawEvent)
    const { event } = await signAndPublish(template)
    recordLocalEvent(postId, 6, event?.id)
    pulseAction(postId, 'repost')
    showToast('Reposted')
  } catch (err) {
    showToast(getUserFriendlyError(err), 'error')
  } finally {
    unlock(postId, 'repost')
  }
}

function handleQuoteSent({ eventId, postId }) {
  if (postId) {
    recordLocalEvent(postId, 16, eventId)
    pulseAction(postId, 'repost')
  }
  closeQuote()
  showToast('Quote posted')
}

// ── Add column modal ──────────────────────────────────────────
const showAddModal = ref(false)
const newColumnType = ref(COLUMN_TYPES.HASHTAG)
const newColumnFilter = ref('')
const newLongformMode = ref(LONGFORM_FILTER_MODES.TAG)
const selectedUser = ref(null)
const addColumnError = ref('')

const columnTypeOptions = [
  { type: COLUMN_TYPES.HASHTAG, label: 'Hashtag', icon: IconHash, description: 'Posts with a specific hashtag', placeholder: 'bitcoin' },
  { type: COLUMN_TYPES.USER, label: 'User', icon: IconUser, description: 'Posts from a specific user', placeholder: '' },
  { type: COLUMN_TYPES.FOLLOWING, label: 'Following', icon: IconUsers, description: 'Posts from people you follow', placeholder: '' },
  { type: COLUMN_TYPES.MENTIONS, label: 'Mentions', icon: IconAt, description: 'Posts that mention you', placeholder: '' },
  { type: COLUMN_TYPES.GLOBAL, label: 'Global', icon: IconWorld, description: 'Latest posts from all relays', placeholder: '' },
  { type: COLUMN_TYPES.LONGFORM, label: 'Longform', icon: IconArticle, description: 'Track longform articles by tag or author', placeholder: 'nostr' }
]

const selectedTypeOption = computed(() =>
  columnTypeOptions.find(o => o.type === newColumnType.value)
)

const needsFilter = computed(() =>
  newColumnType.value === COLUMN_TYPES.HASHTAG
  || newColumnType.value === COLUMN_TYPES.USER
  || newColumnType.value === COLUMN_TYPES.LONGFORM
)

function openAddModal() {
  showAddModal.value = true
  newColumnType.value = COLUMN_TYPES.HASHTAG
  newColumnFilter.value = ''
  newLongformMode.value = LONGFORM_FILTER_MODES.TAG
  selectedUser.value = null
  addColumnError.value = ''
}

function closeAddModal() {
  showAddModal.value = false
}

function handleAddColumn() {
  addColumnError.value = ''

  if (newColumnType.value === COLUMN_TYPES.USER && !newColumnFilter.value.trim()) {
    addColumnError.value = 'Select a user'
    return
  }

  if (newColumnType.value === COLUMN_TYPES.LONGFORM && !newColumnFilter.value.trim()) {
    addColumnError.value = newLongformMode.value === LONGFORM_FILTER_MODES.TAG
      ? 'Enter a hashtag to follow'
      : 'Select a user'
    return
  }

  if (newColumnType.value === COLUMN_TYPES.HASHTAG && !newColumnFilter.value.trim()) {
    addColumnError.value = 'Enter a hashtag to follow'
    return
  }

  const trimmedFilter = newColumnFilter.value.trim().replace(/^#/, '')
  const filter = newColumnType.value === COLUMN_TYPES.LONGFORM
    ? createLongformFilter(newLongformMode.value, trimmedFilter)
    : trimmedFilter
  const label = newColumnType.value === COLUMN_TYPES.USER
    ? (selectedUser.value?.name || selectedUser.value?.nip05 || 'User')
    : newColumnType.value === COLUMN_TYPES.LONGFORM && newLongformMode.value === LONGFORM_FILTER_MODES.USER
      ? `Longform ${selectedUser.value?.name || selectedUser.value?.nip05 || 'User'}`
      : ''
  addColumn(newColumnType.value, filter, label)
  closeAddModal()
}

function selectColumnType(type) {
  newColumnType.value = type
  newColumnFilter.value = ''
  newLongformMode.value = LONGFORM_FILTER_MODES.TAG
  selectedUser.value = null
  addColumnError.value = ''
}

function handleUserSelected(user) {
  newColumnFilter.value = user.pubkey
  selectedUser.value = user
  addColumnError.value = ''
}

// ── Mobile tab index ──────────────────────────────────────────
const mobileActiveIndex = ref(0)

// Clamp index when columns are removed
watch(columnCount, (count) => {
  if (count === 0) {
    mobileActiveIndex.value = 0
  } else if (mobileActiveIndex.value >= count) {
    mobileActiveIndex.value = count - 1
  }
})

function mobileGoTo(idx) {
  mobileActiveIndex.value = idx
  swipeOffset.value = 0
}

// ── Touch swipe gestures ──────────────────────────────────────
const swipeContainer = ref(null)
const swipeOffset = ref(0)
let touchStartX = 0
let touchStartY = 0
let isSwiping = false
let swipeBlocked = false
const SWIPE_THRESHOLD = 60

// Elements that should block swipe capture
const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'])

function onTouchStart(e) {
  const target = e.target
  // Block swipe if starting on an interactive element or a horizontally scrollable region
  swipeBlocked = INTERACTIVE_TAGS.has(target.tagName)
    || target.closest('button, a, input, textarea, [role="button"]')
    || target.closest('.overflow-x-auto, .scrollbar-hide')
  if (swipeBlocked) return

  const touch = e.touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  isSwiping = false
  swipeOffset.value = 0
}

function onTouchMove(e) {
  if (swipeBlocked) return

  const touch = e.touches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY

  // Determine intent: horizontal swipe vs vertical scroll
  if (!isSwiping && Math.abs(dx) > 10) {
    // Only claim horizontal if clearly more horizontal than vertical
    if (Math.abs(dx) > Math.abs(dy) * 1.5) {
      isSwiping = true
    }
  }

  if (!isSwiping) return

  e.preventDefault()

  // Apply resistance at edges
  const atLeftEdge = mobileActiveIndex.value === 0 && dx > 0
  const atRightEdge = mobileActiveIndex.value === columnCount.value - 1 && dx < 0
  const resistance = (atLeftEdge || atRightEdge) ? 0.25 : 1
  swipeOffset.value = dx * resistance
}

function onTouchEnd() {
  if (swipeBlocked || !isSwiping) {
    swipeOffset.value = 0
    swipeBlocked = false
    return
  }

  if (swipeOffset.value < -SWIPE_THRESHOLD && mobileActiveIndex.value < columnCount.value - 1) {
    mobileActiveIndex.value++
  } else if (swipeOffset.value > SWIPE_THRESHOLD && mobileActiveIndex.value > 0) {
    mobileActiveIndex.value--
  }

  swipeOffset.value = 0
  isSwiping = false
  swipeBlocked = false
}

// ── Login ─────────────────────────────────────────────────────
const handleLogin = async () => {
  try {
    await login()
  } catch { /* handled globally */ }
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,_rgba(248,250,252,0.98),_rgba(255,255,255,1)_18rem)]">
    <div
      v-if="isAuthenticated"
      :style="topBarStyle"
      class="pointer-events-none fixed inset-x-0 top-0 z-[60] px-3 py-3 sm:px-4 sm:py-4"
    >
      <div class="rounded-[1.75rem] border border-slate-200/90 bg-white/92 px-3 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div class="grid grid-cols-[auto,1fr,auto] items-center gap-3 sm:gap-4">
          <button
            @click="emit('toggle-sidebar')"
            class="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            aria-label="Open navigation"
            title="Open navigation"
          >
            <IconMenu2 class="h-5 w-5" />
          </button>

          <div class="min-w-0 text-center">
            <p class="truncate text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">ZapTracker</p>
            <p class="truncate text-sm font-semibold text-slate-900 sm:text-base">Social Desk</p>
          </div>

          <button
            @click="emit('change-page', 'settings')"
            class="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50"
            aria-label="Open settings"
            title="Open settings"
          >
            <img
              :src="deskAvatar"
              alt=""
              class="h-11 w-11 object-cover"
              @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         NOT AUTHENTICATED — Enterprise empty state
         ═══════════════════════════════════════════════════════════ -->
    <div v-if="!isAuthenticated" class="flex-1 flex items-center justify-center p-6">
      <div class="max-w-lg w-full text-center">
        <!-- Icon -->
        <div class="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl flex items-center justify-center">
          <IconColumns class="w-10 h-10 text-orange-500" />
        </div>

        <h1 class="text-2xl font-bold text-gray-900 mb-3">SocialDesk</h1>
        <p class="text-gray-500 text-base mb-8 leading-relaxed max-w-md mx-auto">
          Your multi-column Nostr feed. Follow hashtags, track users, and stay on top of your network — all in one view.
        </p>

        <button
          @click="handleLogin"
          :disabled="isLoginLoading"
          :class="[
            'inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl shadow-sm transition-all duration-150',
            isLoginLoading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md'
          ]"
        >
          <IconLoader v-if="isLoginLoading" class="w-5 h-5 animate-spin" />
          <IconBolt v-else class="w-5 h-5" />
          {{ isLoginLoading ? 'Connecting...' : 'Connect with Nostr' }}
        </button>

        <!-- Feature highlights -->
        <div class="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div class="bg-white rounded-xl border border-gray-200/60 p-4">
            <div class="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
              <IconHash class="w-4.5 h-4.5 text-orange-600" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 mb-1">Hashtag feeds</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Track any topic across the Nostr network in real time.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200/60 p-4">
            <div class="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
              <IconUsers class="w-4.5 h-4.5 text-orange-600" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 mb-1">Multi-column</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Up to {{ maxColumns }} columns side by side. Your personal command center.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200/60 p-4">
            <div class="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
              <IconBolt class="w-4.5 h-4.5 text-orange-600" />
            </div>
            <h3 class="text-sm font-semibold text-gray-900 mb-1">Zap & engage</h3>
            <p class="text-xs text-gray-500 leading-relaxed">Reply, repost, react, and zap — directly from your desk.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         AUTHENTICATED — NO COLUMNS YET — Onboarding empty state
         ═══════════════════════════════════════════════════════════ -->
    <div v-else-if="!hasColumns" class="flex-1 flex items-center justify-center px-6 pb-6 pt-20">
      <div class="max-w-xl w-full text-center">
        <div class="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl flex items-center justify-center">
          <IconColumns class="w-10 h-10 text-orange-500" />
        </div>

        <h1 class="text-2xl font-bold text-gray-900 mb-3">Set up your desk</h1>
        <p class="text-gray-500 text-base mb-8 leading-relaxed max-w-md mx-auto">
          Add your first column to start following topics and users across Nostr. You can add up to {{ maxColumns }} columns.
        </p>

        <!-- Quick-add presets -->
        <div class="flex flex-wrap justify-center gap-2 mb-8">
          <button
            v-for="preset in [
              { type: 'hashtag', filter: 'bitcoin', label: '#bitcoin' },
              { type: 'hashtag', filter: 'nostr', label: '#nostr' },
              { type: 'hashtag', filter: 'lightning', label: '#lightning' },
              { type: 'following', filter: '', label: 'Following' },
              { type: 'mentions', filter: '', label: 'Mentions' }
            ]"
            :key="preset.label"
            @click="addColumn(preset.type, preset.filter)"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-orange-300 hover:text-orange-600 transition-colors duration-150"
          >
            <IconHash v-if="preset.type === 'hashtag'" class="w-3.5 h-3.5" />
            <IconUsers v-else-if="preset.type === 'following'" class="w-3.5 h-3.5" />
            <IconAt v-else-if="preset.type === 'mentions'" class="w-3.5 h-3.5" />
            {{ preset.label }}
          </button>
        </div>

        <button
          @click="openAddModal"
          class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all duration-150"
        >
          <IconPlus class="w-5 h-5" />
          Custom column
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════
         DESK — Desktop: multi-column grid
         ═══════════════════════════════════════════════════════════ -->
    <div v-else class="flex-1 flex flex-col min-h-0 overflow-hidden px-2 pb-2 pt-20 sm:px-3 sm:pb-3 sm:pt-24">

      <!-- Mobile: swipeable single-column view -->
      <div class="md:hidden flex-1 flex min-h-0 flex-col overflow-hidden">
        <!-- Mobile header: scrollable tabs + dot indicators -->
        <div class="flex-shrink-0 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
          <!-- Tab pills -->
          <div class="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-hide">
            <button
              v-for="(col, idx) in columns"
              :key="col.id"
              @click="mobileGoTo(idx)"
              :class="[
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150',
                mobileActiveIndex === idx
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              ]"
            >
              {{ col.label }}
            </button>
            <button
              v-if="canAddColumn"
              @click="openAddModal"
              class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-orange-600 transition-colors"
              aria-label="Add column"
            >
              <IconPlus class="w-4 h-4" />
            </button>
          </div>

          <!-- Dot indicators -->
          <div v-if="columnCount > 1" class="flex items-center justify-center gap-1.5 pb-2">
            <div
              v-for="(col, idx) in columns"
              :key="'dot-' + col.id"
              :class="[
                'rounded-full transition-all duration-200',
                mobileActiveIndex === idx
                  ? 'w-5 h-1.5 bg-orange-500'
                  : 'w-1.5 h-1.5 bg-gray-300'
              ]"
            ></div>
          </div>
        </div>

        <!-- Swipeable column area -->
        <div
          ref="swipeContainer"
          class="socialdesk-swipe-host relative flex-1 min-h-0 overflow-hidden"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
        >
          <div
            class="h-full min-h-0 transition-transform duration-300 ease-out"
            :style="{ transform: `translateX(${swipeOffset}px)` }"
          >
            <DeskColumn
              v-if="columns[mobileActiveIndex]"
              :key="columns[mobileActiveIndex].id"
              :column="columns[mobileActiveIndex]"
              @remove="removeColumn(columns[mobileActiveIndex].id)"
              @update="(updates) => updateColumn(columns[mobileActiveIndex].id, updates)"
              :get-action-state="getActionState"
              @reply="handleReply"
              @repost="handleRepost"
              @quote="handleQuote"
              @react="handleReact"
              @zap="handleZap"
              @profile-click="handleProfileClick"
              @media-open="handleMediaOpen"
              @article-open="handleArticleOpen"
            />
          </div>
        </div>
      </div>

      <!-- Desktop: multi-column grid -->
      <div class="hidden md:flex md:flex-col flex-1 min-h-0 overflow-hidden">
        <div class="desk-columns-track flex flex-1 min-h-0 min-w-full items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-1">
        <DeskColumn
          v-for="col in columns"
          :key="col.id"
          :column="col"
          class="desk-column-slot"
          :get-action-state="getActionState"
          @remove="removeColumn(col.id)"
          @update="(updates) => updateColumn(col.id, updates)"
          @reply="handleReply"
          @repost="handleRepost"
          @quote="handleQuote"
          @react="handleReact"
          @zap="handleZap"
          @profile-click="handleProfileClick"
          @media-open="handleMediaOpen"
          @article-open="handleArticleOpen"
        />

        <!-- Add column card (fills remaining space) -->
        <div
          v-for="idx in addCardCount"
          :key="`add-column-${idx}`"
          class="desk-column-slot flex items-center justify-center bg-white/50 border border-gray-200/60 rounded-2xl cursor-pointer hover:bg-orange-50/30 transition-colors duration-150"
          @click="openAddModal"
        >
          <div class="text-center p-6">
            <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <IconPlus class="w-6 h-6 text-gray-400" />
            </div>
            <p class="text-sm font-medium text-gray-500">Add column</p>
            <p class="text-xs text-gray-400 mt-1">{{ columnCount }}/{{ maxColumns }}</p>
          </div>
        </div>
        </div>
      </div>
    </div>

    <!-- Action toast -->
    <transition name="modal-fade">
      <div
        v-if="actionToast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none"
      >
        <div :class="[
          'px-4 py-2 rounded-xl text-sm font-medium shadow-lg pointer-events-auto',
          actionToast.type === 'error'
            ? 'bg-red-600 text-white'
            : actionToast.type === 'info'
              ? 'border border-gray-200 bg-white text-gray-900'
              : 'bg-gray-900 text-white'
        ]">
          {{ actionToast.message }}
        </div>
      </div>
    </transition>

    <!-- Reply composer overlay -->
    <DeskReplyComposer
      v-if="replyTarget"
      :post="replyTarget"
      @close="closeReply"
      @sent="closeReply(); showToast('Reply sent')"
    />

    <DeskQuoteComposer
      v-if="quoteTarget"
      :post="quoteTarget"
      @close="closeQuote"
      @sent="handleQuoteSent"
    />

    <DeskArticleViewer
      v-if="articleViewerTarget"
      :post="articleViewerTarget"
      :profile="articleViewerProfile"
      :engagement-counts="articleViewerEngagementCounts"
      :article-metrics="articleViewerInteractions"
      :action-state="getActionState(articleViewerTarget.id)"
      :zap-count="articleViewerZapCount"
      :format-time="(value) => formatTime(value)"
      @close="closeArticleViewer"
      @reply="handleReply"
      @repost="handleRepost"
      @quote="handleQuote"
      @react="handleReact"
      @zap="handleZap"
      @profile-click="handleProfileClick"
      @media-open="handleMediaOpen"
    />

    <DeskMediaLightbox
      v-if="mediaViewer"
      :media="mediaViewer.media"
      :initial-index="mediaViewer.index"
      @close="closeMediaViewer"
    />

    <!-- Zap popover overlay -->
    <DeskZapPopover
      v-if="zapTarget"
      :post="zapTarget"
      @close="closeZap"
      @sent="(amount) => { recordLocalEvent(zapTarget.id, 9735); closeZap(); showToast(`Zapped ${amount} sats`) }"
    />

    <!-- Profile modal -->
    <UserProfileModal
      :show="showProfileModal"
      :user-profile-data="profileTarget"
      @close="showProfileModal = false"
    />

    <!-- ═══════════════════════════════════════════════════════════
         ADD COLUMN MODAL
         ═══════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <transition name="modal-fade">
        <div
          v-if="showAddModal"
          class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4"
          @click.self="closeAddModal"
          @keydown.escape="closeAddModal"
          tabindex="-1"
        >
          <div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 class="text-lg font-semibold text-gray-900">Add column</h3>
              <button @click="closeAddModal" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                <IconX class="w-4.5 h-4.5" />
              </button>
            </div>

            <div class="p-5 space-y-5">
              <!-- Column type picker -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-gray-700">Column type</label>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    v-for="opt in columnTypeOptions"
                    :key="opt.type"
                    @click="selectColumnType(opt.type)"
                    :class="[
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all duration-150',
                      newColumnType === opt.type
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    ]"
                  >
                    <component :is="opt.icon" class="w-5 h-5" />
                    <span class="text-xs font-medium">{{ opt.label }}</span>
                  </button>
                </div>
                <p class="text-xs text-gray-500">{{ selectedTypeOption?.description }}</p>
              </div>

              <!-- Filter input -->
              <div v-if="needsFilter" class="space-y-1.5">
                <label class="text-sm font-medium text-gray-700">
                  {{
                    newColumnType === COLUMN_TYPES.HASHTAG
                      ? 'Hashtag'
                      : newColumnType === COLUMN_TYPES.USER
                        ? 'User'
                        : 'Longform filter'
                  }}
                </label>

                <div v-if="newColumnType === COLUMN_TYPES.LONGFORM" class="flex gap-2">
                  <button
                    @click="newLongformMode = LONGFORM_FILTER_MODES.TAG; newColumnFilter = ''; selectedUser = null; addColumnError = ''"
                    :class="[
                      'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      newLongformMode === LONGFORM_FILTER_MODES.TAG ? 'border border-orange-200 bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'
                    ]"
                  >
                    By tag
                  </button>
                  <button
                    @click="newLongformMode = LONGFORM_FILTER_MODES.USER; newColumnFilter = ''; selectedUser = null; addColumnError = ''"
                    :class="[
                      'flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      newLongformMode === LONGFORM_FILTER_MODES.USER ? 'border border-orange-200 bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-600'
                    ]"
                  >
                    By user
                  </button>
                </div>

                <div
                  v-if="newColumnType === COLUMN_TYPES.HASHTAG || (newColumnType === COLUMN_TYPES.LONGFORM && newLongformMode === LONGFORM_FILTER_MODES.TAG)"
                  class="relative"
                >
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">#</span>
                  <input
                    v-model="newColumnFilter"
                    type="text"
                    :placeholder="selectedTypeOption?.placeholder"
                    :class="[
                      'w-full border rounded-xl text-sm py-2.5 focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors',
                      'pl-7 pr-3',
                      addColumnError ? 'border-red-300' : 'border-gray-200'
                    ]"
                    @keyup.enter="handleAddColumn"
                  />
                </div>

                <div v-else class="space-y-2">
                  <UserSearchInput
                    :placeholder="'Search by name, npub, or NIP-05...'"
                    :show-role="false"
                    @user-selected="handleUserSelected"
                  />
                  <p v-if="newColumnFilter" class="text-xs text-gray-500 truncate">
                    Selected: {{ selectedUser?.name || selectedUser?.nip05 || newColumnFilter }}
                  </p>
                </div>

                <p v-if="addColumnError" class="text-xs text-red-600">{{ addColumnError }}</p>
              </div>

              <!-- Actions -->
              <div class="flex gap-3 pt-1">
                <button
                  @click="closeAddModal"
                  class="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleAddColumn"
                  class="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl text-sm font-medium shadow-sm hover:shadow-md transition-all duration-150"
                >
                  Add column
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.desk-columns-track {
  --desk-gap: 0.5rem;
  --desk-visible-columns: 3;
  overscroll-behavior-x: contain;
}

.desk-column-slot {
  flex: 0 0 calc((100% - (var(--desk-visible-columns) - 1) * var(--desk-gap)) / var(--desk-visible-columns));
  min-width: calc((100% - (var(--desk-visible-columns) - 1) * var(--desk-gap)) / var(--desk-visible-columns));
  height: 100%;
  min-height: 0;
  align-self: stretch;
}

.socialdesk-swipe-host {
  touch-action: pan-y pinch-zoom;
  overscroll-behavior-y: contain;
}

@media (min-width: 1024px) {
  .desk-columns-track {
    --desk-visible-columns: 4;
  }
}
</style>
