<script setup>
import { ref, computed, toRef, watch, onUnmounted } from 'vue'
import {
  IconX,
  IconRefresh,
  IconHash,
  IconUser,
  IconUsers,
  IconAt,
  IconWorld,
  IconSettings,
  IconLoader,
  IconArticle
} from '@iconify-prerendered/vue-tabler'
import { useDeskFeed } from '../../composables/social/useDeskFeed.js'
import { useDeskInteractions } from '../../composables/social/useDeskInteractions.js'
import { COLUMN_TYPES } from '../../composables/social/useDeskColumns.js'
import { useEngagementMetrics } from '../../composables/analytics/useEngagementMetrics.js'
import { useContentZaps } from '../../composables/content/useContentZaps.js'
import DeskPost from './DeskPost.vue'
import DeskArticleCard from './DeskArticleCard.vue'
import DeskColumnSettings from './DeskColumnSettings.vue'

const props = defineProps({
  column: { type: Object, required: true },
  getActionState: { type: Function, default: () => ({}) }
})

const emit = defineEmits(['remove', 'update', 'reply', 'repost', 'quote', 'react', 'zap', 'profile-click'])

const columnRef = toRef(props, 'column')

const {
  posts,
  isLoading,
  isLoadingMore,
  hasMore,
  isLive,
  error,
  refresh,
  loadMore,
  getProfile
} = useDeskFeed(columnRef)

const { getInteractions, trackPosts, untrackPosts } = useDeskInteractions()
const { getEngagementCounts, startEngagementTracking, startLongFormContentTracking } = useEngagementMetrics()
const { startZapTracking, getZapCount } = useContentZaps()

// Track interaction counts when posts arrive, untrack when they leave
let trackedPostIds = []
watch(posts, (newPosts) => {
  const newIds = newPosts.map(p => p.id).filter(Boolean)
  // Untrack posts that are no longer in the list
  const removedIds = trackedPostIds.filter(id => !newIds.includes(id))
  if (removedIds.length > 0) untrackPosts(removedIds)
  // Track new posts
  const addedIds = newIds.filter(id => !trackedPostIds.includes(id))
  if (addedIds.length > 0) trackPosts(addedIds)
  newPosts.forEach((post) => {
    if (!post?.rawEvent?.id) return
    startZapTracking(post.rawEvent.id)
    if (post.rawEvent.kind === 30023) {
      const dTag = post.rawEvent.tags.find((tag) => tag[0] === 'd')?.[1] || post.id
      startLongFormContentTracking(post.rawEvent.id, post.pubkey, dTag)
    } else {
      startEngagementTracking(post.rawEvent.id)
    }
  })
  trackedPostIds = newIds
}, { immediate: true })

// Cleanup tracked posts on unmount
onUnmounted(() => {
  if (trackedPostIds.length > 0) {
    untrackPosts(trackedPostIds)
    trackedPostIds = []
  }
})

// ── Settings popover ──────────────────────────────────────────
const showSettings = ref(false)

// ── Column icon ───────────────────────────────────────────────
const columnIcon = computed(() => {
  switch (props.column.type) {
    case COLUMN_TYPES.HASHTAG: return IconHash
    case COLUMN_TYPES.USER: return IconUser
    case COLUMN_TYPES.FOLLOWING: return IconUsers
    case COLUMN_TYPES.MENTIONS: return IconAt
    case COLUMN_TYPES.GLOBAL: return IconWorld
    case COLUMN_TYPES.LONGFORM: return IconArticle
    default: return IconHash
  }
})

// ── Scroll: infinite scroll detection ─────────────────────────
const feedContainer = ref(null)

function onFeedScroll() {
  const el = feedContainer.value
  if (!el || isLoadingMore.value || !hasMore.value) return
  // Trigger load when within 200px of bottom
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
    loadMore()
  }
}

function getDisplayInteractions(post) {
  const deskCounts = getInteractions(post.id)
  const eventId = post.rawEvent?.id
  const engagementCounts = eventId ? getEngagementCounts(eventId) : null
  const zapCount = eventId ? getZapCount(eventId) : 0

  return {
    ...deskCounts,
    reactions: Math.max(deskCounts.reactions || 0, engagementCounts?.likes || 0),
    reposts: Math.max(deskCounts.reposts || 0, engagementCounts?.reposts || 0),
    zaps: Math.max(deskCounts.zaps || 0, zapCount || 0)
  }
}

// ── Time formatting ───────────────────────────────────────────
function formatTime(timestamp) {
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`
  return new Date(timestamp * 1000).toLocaleDateString()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white/94 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">

    <!-- Column header -->
    <div class="flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 flex-shrink-0">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <component :is="columnIcon" class="w-4 h-4 text-orange-500 flex-shrink-0" />
        <span class="text-sm font-semibold text-gray-900 truncate">{{ column.label }}</span>
        <div
          v-if="isLive"
          class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"
          title="Live"
        ></div>
      </div>
      <div class="flex items-center gap-0.5 flex-shrink-0 relative">
        <button
          @click="showSettings = !showSettings"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Column settings"
          aria-label="Column settings"
        >
          <IconSettings class="w-3.5 h-3.5" />
        </button>
        <button
          @click="refresh"
          :disabled="isLoading"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
          title="Refresh"
          aria-label="Refresh column"
        >
          <IconRefresh :class="['w-3.5 h-3.5', isLoading ? 'animate-spin' : '']" />
        </button>
        <button
          @click="emit('remove')"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Remove column"
          aria-label="Remove column"
        >
          <IconX class="w-3.5 h-3.5" />
        </button>

        <!-- Settings popover -->
        <DeskColumnSettings
          v-if="showSettings"
          :column="column"
          @close="showSettings = false"
          @update="(updates) => { emit('update', updates); showSettings = false }"
        />
      </div>
    </div>

    <!-- Feed content -->
    <div
      ref="feedContainer"
      class="desk-column-feed flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      tabindex="0"
      @scroll="onFeedScroll"
    >

      <!-- Loading skeleton -->
      <div v-if="isLoading && posts.length === 0" class="p-3 space-y-3">
        <div v-for="i in 4" :key="i" class="animate-pulse">
          <div class="flex items-start gap-2.5">
            <div class="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <div class="h-3 bg-gray-200 rounded w-20"></div>
                <div class="h-2.5 bg-gray-100 rounded w-12"></div>
              </div>
              <div class="space-y-1.5">
                <div class="h-3 bg-gray-100 rounded w-full"></div>
                <div class="h-3 bg-gray-100 rounded w-4/5"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="p-4 text-center">
        <p class="text-sm text-red-600 mb-2">{{ error }}</p>
        <button @click="refresh" class="text-xs text-orange-600 font-medium hover:underline">
          Try again
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="!isLoading && posts.length === 0" class="p-6 text-center">
        <component :is="columnIcon" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
        <p class="text-sm text-gray-500 mb-1">No posts yet</p>
        <p class="text-xs text-gray-400">
          {{ column.type === COLUMN_TYPES.HASHTAG ? `No posts with #${column.filter} found` :
             column.type === COLUMN_TYPES.LONGFORM ? 'No longform posts found for this filter' :
             column.type === COLUMN_TYPES.MENTIONS ? 'No one has mentioned you yet' :
             'Waiting for new posts...' }}
        </p>
      </div>

      <!-- Posts -->
      <div v-else class="divide-y divide-gray-100">
        <component
          v-for="post in posts"
          :key="post.id"
          :is="post.rawEvent?.kind === 30023 ? DeskArticleCard : DeskPost"
          :post="post"
          :profile="getProfile(post.pubkey)"
          :interactions="getDisplayInteractions(post)"
          :action-state="props.getActionState(post.id)"
          :format-time="formatTime"
          @reply="(p) => emit('reply', p)"
          @repost="(p) => emit('repost', p)"
          @quote="(p) => emit('quote', p)"
          @react="(p) => emit('react', p)"
          @zap="(p) => emit('zap', p)"
          @profile-click="(data) => emit('profile-click', data)"
        />

        <!-- Loading more indicator -->
        <div v-if="isLoadingMore" class="flex items-center justify-center py-4">
          <IconLoader class="w-4 h-4 text-gray-400 animate-spin" />
        </div>

        <!-- End of feed -->
        <div v-else-if="!hasMore && posts.length > 0" class="py-4 text-center">
          <p class="text-[11px] text-gray-300">No more posts</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Column-local scroll behavior */
.desk-column-feed {
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}

/* Thin scrollbar */
.desk-column-feed {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.2) transparent;
}
.desk-column-feed::-webkit-scrollbar {
  width: 4px;
}
.desk-column-feed::-webkit-scrollbar-track {
  background: transparent;
}
.desk-column-feed::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.2);
  border-radius: 2px;
}
.desk-column-feed::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.4);
}
</style>
