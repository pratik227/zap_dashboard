<script setup>
import { computed } from 'vue'
import {
  IconFileText,
  IconMessageCircle,
  IconRepeat,
  IconHeart,
  IconBolt,
  IconQuote
} from '@iconify-prerendered/vue-tabler'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const props = defineProps({
  post: { type: Object, required: true },
  profile: { type: Object, default: null },
  interactions: { type: Object, default: () => ({ reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false }) },
  actionState: { type: Object, default: () => ({ reactBusy: false, repostBusy: false, quoteBusy: false, reactAnimated: false, repostAnimated: false }) },
  formatTime: { type: Function, default: () => '' }
})

const emit = defineEmits(['reply', 'repost', 'quote', 'react', 'zap', 'profile-click', 'article-open'])

function postPayload() {
  return {
    ...props.post,
    profile: props.profile || null
  }
}

const authorName = computed(() =>
  props.profile?.name || props.profile?.display_name || props.post.pubkey.slice(0, 8) + '...'
)

const authorAvatar = computed(() =>
  props.profile?.picture || generateAvatar(props.post.pubkey)
)

const title = computed(() =>
  props.post.rawEvent?.tags?.find((tag) => tag[0] === 'title')?.[1]
  || props.post.content.split('\n')[0]?.slice(0, 90)
  || 'Untitled article'
)

const summary = computed(() =>
  props.post.rawEvent?.tags?.find((tag) => tag[0] === 'summary')?.[1]
  || props.post.content.replace(/\n+/g, ' ').trim().slice(0, 220)
)

const coverImage = computed(() =>
  props.post.rawEvent?.tags?.find((tag) => tag[0] === 'image')?.[1] || null
)

const hashtags = computed(() =>
  (props.post.rawEvent?.tags || [])
    .filter((tag) => tag[0] === 't' && tag[1])
    .map((tag) => tag[1])
    .slice(0, 4)
)

const publishedTime = computed(() => props.formatTime(props.post.created_at))
</script>

<template>
  <article class="px-3 py-3">
    <button
      type="button"
      class="group block w-full overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      @click="emit('article-open', postPayload())"
    >
      <div v-if="coverImage" class="aspect-[16/8] overflow-hidden bg-slate-100">
        <img
          :src="coverImage"
          :alt="title"
          class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          @error="$event.target.style.display = 'none'"
        />
      </div>

      <div class="p-4">
        <div class="mb-3 flex items-center gap-2">
          <button
            type="button"
            class="flex-shrink-0"
            @click.stop="emit('profile-click', { pubkey: post.pubkey, profile: profile || null })"
          >
            <img
              :src="authorAvatar"
              :alt="authorName"
              class="h-9 w-9 rounded-full object-cover border border-slate-200"
              @error="$event.target.src = generateAvatar(post.pubkey)"
            />
          </button>
          <div class="min-w-0">
            <button
              type="button"
              class="truncate text-sm font-semibold text-slate-900 hover:underline"
              @click.stop="emit('profile-click', { pubkey: post.pubkey, profile: profile || null })"
            >
              {{ authorName }}
            </button>
            <p class="text-xs text-slate-500">{{ publishedTime }}</p>
          </div>
          <div class="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <IconFileText class="h-3.5 w-3.5" />
            Article
          </div>
        </div>

        <h3 class="text-lg font-semibold leading-tight text-slate-950">{{ title }}</h3>
        <p v-if="summary" class="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {{ summary }}
        </p>

        <div v-if="hashtags.length" class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="tag in hashtags"
            :key="tag"
            class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
          >
            #{{ tag }}
          </span>
        </div>

        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>{{ interactions.reactions }} likes</span>
          <span>{{ interactions.reposts }} reposts</span>
          <span>{{ interactions.replies }} replies</span>
          <span>{{ interactions.zaps }} zaps</span>
        </div>
      </div>
    </button>

    <div class="mt-2 flex items-center gap-1 px-1">
      <button
        @click.stop="emit('reply', postPayload())"
        class="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors text-xs"
        title="Reply"
        aria-label="Reply to this article"
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
        aria-label="Repost article"
      >
        <IconRepeat class="w-3.5 h-3.5" />
        <span v-if="interactions.reposts > 0" class="tabular-nums">{{ interactions.reposts }}</span>
      </button>
      <button
        @click.stop="emit('quote', postPayload())"
        :disabled="actionState.quoteBusy"
        class="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-emerald-50/70 disabled:text-emerald-500"
        aria-label="Quote repost article"
      >
        <IconQuote class="w-3.5 h-3.5" />
      </button>
      <button
        @click.stop="emit('react', postPayload())"
        :disabled="actionState.reactBusy || interactions.myReaction"
        :class="[
          'flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-xs disabled:cursor-not-allowed',
          interactions.myReaction || actionState.reactBusy ? 'bg-pink-50 text-pink-600' : 'text-gray-400 hover:text-pink-500 hover:bg-pink-50'
        ]"
        aria-label="Like article"
      >
        <IconHeart class="w-3.5 h-3.5" />
        <span v-if="interactions.reactions > 0" class="tabular-nums">{{ interactions.reactions }}</span>
      </button>
      <button
        @click.stop="emit('zap', postPayload())"
        class="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors text-xs"
        aria-label="Zap article"
      >
        <IconBolt class="w-3.5 h-3.5" />
        <span v-if="interactions.zaps > 0" class="tabular-nums">{{ interactions.zaps }}</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
