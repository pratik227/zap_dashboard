<script setup>
import { ref, computed } from 'vue'
import {
  IconMessageCircle,
  IconRepeat,
  IconHeart,
  IconBolt,
  IconQuote,
} from '@iconify-prerendered/vue-tabler'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import NoteContentRenderer from '../content/NoteContentRenderer.vue'
import DeskThread from './DeskThread.vue'

const props = defineProps({
  post: { type: Object, required: true },
  profile: { type: Object, default: null },
  interactions: { type: Object, default: () => ({ reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false }) },
  actionState: { type: Object, default: () => ({ reactBusy: false, repostBusy: false, quoteBusy: false, reactAnimated: false, repostAnimated: false }) },
  formatTime: { type: Function, default: (t) => '' }
})

const emit = defineEmits(['reply', 'repost', 'quote', 'react', 'zap', 'profile-click'])

function postPayload() {
  return {
    ...props.post,
    profile: props.profile || null
  }
}

// ── Author info ───────────────────────────────────────────────
const authorName = computed(() =>
  props.profile?.name || props.profile?.display_name || props.post.pubkey.slice(0, 8) + '...'
)

const authorNip05 = computed(() => props.profile?.nip05 || null)

const authorAvatar = computed(() =>
  props.profile?.picture || generateAvatar(props.post.pubkey)
)

// ── Hashtag rendering (shown as tags below content) ───────────
const hashtags = computed(() =>
  props.post.tags
    .filter(t => t[0] === 't')
    .map(t => t[1])
)

// ── Content warning ───────────────────────────────────────────
const contentWarning = computed(() => {
  const cw = props.post.tags.find(t => t[0] === 'content-warning')
  return cw ? (cw[1] || 'Sensitive content') : null
})

// ── Content warning reveal ────────────────────────────────────
const cwRevealed = ref(false)

// ── Timestamp ─────────────────────────────────────────────────
const timeAgo = computed(() => props.formatTime(props.post.created_at))
</script>

<template>
  <article class="px-3 py-3 hover:bg-gray-50/50 transition-colors duration-100">
    <div class="flex items-start gap-2.5">
      <!-- Avatar -->
      <button
        @click="emit('profile-click', { pubkey: post.pubkey, profile: profile || null })"
        class="flex-shrink-0"
      >
        <img
          :src="authorAvatar"
          :alt="authorName"
          class="w-9 h-9 rounded-full object-cover border border-gray-200/60"
          @error="$event.target.src = generateAvatar(post.pubkey)"
        />
      </button>

      <!-- Body -->
      <div class="flex-1 min-w-0">
        <!-- Author row -->
        <div class="flex items-baseline gap-1.5 mb-0.5">
          <button
            @click="emit('profile-click', { pubkey: post.pubkey, profile: profile || null })"
            class="text-sm font-semibold text-gray-900 truncate hover:underline"
          >
            {{ authorName }}
          </button>
          <span v-if="authorNip05" class="text-xs text-gray-400 truncate hidden sm:inline">
            {{ authorNip05 }}
          </span>
          <span class="text-xs text-gray-400 flex-shrink-0">&middot;</span>
          <span class="text-xs text-gray-400 flex-shrink-0">{{ timeAgo }}</span>
        </div>

        <!-- Content warning -->
        <div v-if="contentWarning && !cwRevealed" class="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2">
          <p class="text-xs text-amber-700 font-medium">{{ contentWarning }}</p>
          <button
            @click.stop="cwRevealed = true"
            class="text-xs text-amber-600 font-medium hover:text-amber-800 flex-shrink-0"
          >
            Show
          </button>
        </div>

        <!-- Rich content: mentions, URLs, media embeds, nostr refs -->
        <div v-if="!contentWarning || cwRevealed" class="text-sm text-gray-800 desk-post-content">
          <NoteContentRenderer
            :content="post.content"
            :compact="false"
            :show-profile-on-click="false"
            @mention-click="(data) => emit('profile-click', data)"
          />
        </div>

        <!-- Hashtags -->
        <div v-if="hashtags.length > 0" class="flex flex-wrap gap-1 mt-1.5">
          <span
            v-for="tag in hashtags"
            :key="tag"
            class="text-xs text-orange-600 font-medium"
          >
            #{{ tag }}
          </span>
        </div>

        <!-- Action bar -->
        <div class="flex items-center gap-1 mt-2 -ml-1.5">
          <button
            @click.stop="emit('reply', postPayload())"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors text-xs"
            title="Reply"
            aria-label="Reply to this post"
          >
            <IconMessageCircle class="w-3.5 h-3.5" />
            <span v-if="interactions.replies > 0" class="tabular-nums">{{ interactions.replies }}</span>
          </button>
          <button
            @click.stop="emit('repost', postPayload())"
            :disabled="actionState.repostBusy || interactions.myRepost"
            :class="[
              'flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs disabled:cursor-not-allowed',
              interactions.myRepost || actionState.repostBusy ? 'bg-green-50 text-green-600' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
            ]"
            title="Repost"
            aria-label="Repost"
            :aria-busy="actionState.repostBusy"
          >
            <IconRepeat :class="[
              'w-3.5 h-3.5',
              actionState.repostBusy ? 'desk-action-icon-busy' : '',
              actionState.repostAnimated ? 'desk-action-icon-pop' : ''
            ]" />
            <span v-if="interactions.reposts > 0" class="tabular-nums">{{ interactions.reposts }}</span>
          </button>
          <button
            @click.stop="emit('quote', postPayload())"
            :disabled="actionState.quoteBusy"
            class="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-emerald-50/70 disabled:text-emerald-500"
            title="Quote repost"
            aria-label="Quote repost this post"
            :aria-busy="actionState.quoteBusy"
          >
            <IconQuote :class="['w-3.5 h-3.5', actionState.quoteBusy ? 'desk-action-icon-busy' : '']" />
          </button>
          <button
            @click.stop="emit('react', postPayload())"
            :disabled="actionState.reactBusy || interactions.myReaction"
            :class="[
              'flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs disabled:cursor-not-allowed',
              interactions.myReaction || actionState.reactBusy ? 'bg-pink-50 text-pink-600' : 'text-gray-400 hover:text-pink-500 hover:bg-pink-50'
            ]"
            title="Like"
            aria-label="Like this post"
            :aria-busy="actionState.reactBusy"
          >
            <IconHeart :class="[
              'w-3.5 h-3.5',
              actionState.reactBusy ? 'desk-action-icon-busy' : '',
              actionState.reactAnimated ? 'desk-action-icon-pop' : ''
            ]" />
            <span v-if="interactions.reactions > 0" class="tabular-nums">{{ interactions.reactions }}</span>
          </button>
          <button
            @click.stop="emit('zap', postPayload())"
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors text-xs"
            title="Zap"
            aria-label="Send a zap"
          >
            <IconBolt class="w-3.5 h-3.5" />
            <span v-if="interactions.zaps > 0" class="tabular-nums">{{ interactions.zaps }}</span>
          </button>
        </div>

        <!-- Thread: collapsible replies (outside action bar) -->
        <DeskThread
          v-if="interactions.replies > 0"
          :post="post"
          :reply-count="interactions.replies"
          @profile-click="(data) => emit('profile-click', data)"
          @reply="(p) => emit('reply', p)"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.desk-post-content {
  line-height: 1.55;
}
.desk-post-content :deep(.note-content-renderer) {
  font-size: inherit;
  line-height: inherit;
}

.desk-action-icon-busy {
  animation: desk-action-busy 0.9s ease-in-out infinite;
  transform-origin: center;
}

.desk-action-icon-pop {
  animation: desk-action-pop 0.5s cubic-bezier(0.2, 0.9, 0.2, 1);
  transform-origin: center;
}

@keyframes desk-action-busy {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.14);
  }
}

@keyframes desk-action-pop {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.24);
  }
  70% {
    transform: scale(0.94);
  }
  100% {
    transform: scale(1);
  }
}
</style>
