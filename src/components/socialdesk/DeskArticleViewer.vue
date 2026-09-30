<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  IconArrowLeft,
  IconArticle,
  IconBolt,
  IconClock,
  IconHeart,
  IconMessageCircle,
  IconQuote,
  IconRepeat,
  IconUser,
  IconX
} from '@iconify-prerendered/vue-tabler'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import EngagementMetrics from '../analytics/EngagementMetrics.vue'

const props = defineProps({
  post: { type: Object, required: true },
  profile: { type: Object, default: null },
  engagementCounts: {
    type: Object,
    default: () => ({ likes: 0, reposts: 0, bookmarks: 0, totalEngagement: 0 })
  },
  articleMetrics: {
    type: Object,
    default: () => ({ reactions: 0, reposts: 0, replies: 0, zaps: 0, myReaction: false, myRepost: false })
  },
  actionState: {
    type: Object,
    default: () => ({ reactBusy: false, repostBusy: false, quoteBusy: false, reactAnimated: false, repostAnimated: false })
  },
  zapCount: { type: Number, default: 0 },
  formatTime: { type: Function, default: () => '' }
})

const emit = defineEmits(['close', 'reply', 'repost', 'quote', 'react', 'zap', 'profile-click', 'media-open'])

const closeButton = ref(null)
let previousBodyOverflow = ''

const rawTags = computed(() => props.post.rawEvent?.tags || [])

const authorName = computed(() =>
  props.profile?.name || props.profile?.display_name || props.post.pubkey.slice(0, 8) + '...'
)

const authorAvatar = computed(() =>
  props.profile?.picture || generateAvatar(props.post.pubkey)
)

const authorMeta = computed(() => props.profile?.nip05 || props.profile?.about || null)

const title = computed(() =>
  rawTags.value.find((tag) => tag[0] === 'title')?.[1]
  || props.post.content.split('\n')[0]?.slice(0, 110)
  || 'Untitled article'
)

const summary = computed(() =>
  rawTags.value.find((tag) => tag[0] === 'summary')?.[1]
  || extractSummary(props.post.content || '')
)

const coverImage = computed(() =>
  rawTags.value.find((tag) => tag[0] === 'image')?.[1] || null
)

const hashtags = computed(() =>
  rawTags.value.filter((tag) => tag[0] === 't' && tag[1]).map((tag) => tag[1]).slice(0, 6)
)

const articleHtml = computed(() => parseMarkdown(props.post.content || ''))
const publishedTime = computed(() => props.formatTime(props.post.created_at))
const wordCount = computed(() => (props.post.content || '').trim().split(/\s+/).filter(Boolean).length)
const readingMinutes = computed(() => Math.max(1, Math.round(wordCount.value / 220)))
const surfaceImage = computed(() => coverImage.value ? [{
  url: coverImage.value,
  alt: title.value,
  filename: `article-cover-${props.post.rawEvent?.id || props.post.id || 'cover'}${inferExtension(coverImage.value)}`
}] : [])

function extractSummary(content) {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220)
}

function inferExtension(url) {
  const match = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(?:\?|#|$)/i)
  return match ? `.${match[1].toLowerCase()}` : '.jpg'
}

function buildPostPayload() {
  return {
    ...props.post,
    profile: props.profile || null
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

function openCoverImage() {
  if (!surfaceImage.value.length) return
  emit('media-open', {
    post: buildPostPayload(),
    media: surfaceImage.value,
    index: 0
  })
}

function parseMarkdown(content) {
  if (!content) return ''

  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^[\s]*[-*+] (.+)$/gm, '<li>$1</li>')
    .replace(/^[\s]*\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>')) {
    html = `<p>${html}</p>`
  } else if (html.includes('</p><p>')) {
    html = `<p>${html}</p>`
  }

  html = html.replace(/(<li>.*?<\/li>)/gs, (match) => `<ul>${match}</ul>`)
  return html
}

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeydown)
  closeButton.value?.focus()
})

onUnmounted(() => {
  document.body.style.overflow = previousBodyOverflow
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[10010] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(241,245,249,0.92)_32%,_rgba(15,23,42,0.82)_100%)] backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      @click.self="emit('close')"
    >
      <div class="flex h-full flex-col px-0 pb-0 pt-0 sm:px-6 sm:pb-6 sm:pt-6">
        <div class="mx-auto flex h-full w-full max-w-[92rem] flex-col overflow-hidden bg-white/96 shadow-[0_28px_80px_rgba(15,23,42,0.18)] sm:rounded-[2rem]">
          <header class="border-b border-slate-200/80 bg-white/92 px-4 py-3 backdrop-blur xl:px-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <button
                  ref="closeButton"
                  type="button"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  aria-label="Back to Social Desk"
                  @click="emit('close')"
                >
                  <IconArrowLeft class="h-5 w-5" />
                </button>
                <div class="min-w-0">
                  <p class="truncate text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">ZapTracker Social Desk</p>
                  <p class="truncate text-sm font-semibold text-slate-900">Article Reader</p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <div class="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex">
                  <IconArticle class="h-3.5 w-3.5 text-slate-500" />
                  Longform
                </div>
                <button
                  type="button"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                  aria-label="Close article"
                  @click="emit('close')"
                >
                  <IconX class="h-5 w-5" />
                </button>
              </div>
            </div>
          </header>

          <div class="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
            <aside class="border-b border-slate-200/80 bg-[linear-gradient(180deg,_rgba(248,250,252,1),_rgba(255,255,255,1))] xl:w-[23rem] xl:flex-shrink-0 xl:overflow-y-auto xl:border-b-0 xl:border-r">
              <div class="space-y-6 p-4 sm:p-6">
                <button
                  type="button"
                  class="group block w-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                  @click="coverImage ? openCoverImage() : emit('profile-click', { pubkey: post.pubkey, profile: profile || null })"
                >
                  <div v-if="coverImage" class="aspect-[4/3] overflow-hidden bg-slate-100">
                    <img :src="coverImage" :alt="title" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" @error="$event.target.style.display = 'none'" />
                  </div>
                  <div v-else class="flex aspect-[4/3] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_rgba(255,255,255,1)_58%)]">
                    <div class="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                      <IconArticle class="h-9 w-9 text-slate-600" />
                    </div>
                  </div>
                </button>

                <div class="space-y-4">
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:bg-slate-50"
                    @click="emit('profile-click', { pubkey: post.pubkey, profile: profile || null })"
                  >
                    <img :src="authorAvatar" :alt="authorName" class="h-12 w-12 rounded-full border border-slate-200 object-cover" @error="$event.target.src = generateAvatar(post.pubkey)" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold text-slate-900">{{ authorName }}</p>
                      <p class="truncate text-xs text-slate-500">{{ authorMeta || 'Open author profile' }}</p>
                    </div>
                    <div class="rounded-full bg-slate-100 p-2 text-slate-500">
                      <IconUser class="h-4 w-4" />
                    </div>
                  </button>

                  <div class="grid grid-cols-2 gap-3">
                    <div class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Published</p>
                      <p class="mt-2 text-sm font-semibold text-slate-900">{{ publishedTime }}</p>
                    </div>
                    <div class="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Reading Time</p>
                      <p class="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <IconClock class="h-4 w-4 text-slate-500" />
                        {{ readingMinutes }} min
                      </p>
                    </div>
                  </div>

                  <div class="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Engagement</p>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <EngagementMetrics
                        :engagement-counts="engagementCounts"
                        :zap-count="zapCount"
                        size="default"
                        text-size="text-sm"
                        :show-all-metrics="true"
                        :show-no-engagement-text="false"
                        :show-tooltips="false"
                      />
                    </div>
                    <div class="mt-4 grid grid-cols-2 gap-3">
                      <div class="rounded-2xl bg-slate-50 px-3 py-2">
                        <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Replies</p>
                        <p class="mt-1 text-lg font-semibold text-slate-900">{{ articleMetrics.replies }}</p>
                      </div>
                      <div class="rounded-2xl bg-slate-50 px-3 py-2">
                        <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Zaps</p>
                        <p class="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-orange-600">
                          <IconBolt class="h-4 w-4" />
                          {{ articleMetrics.zaps }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Engage</p>
                    <div class="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        @click="emit('reply', buildPostPayload())"
                      >
                        <IconMessageCircle class="h-4 w-4" />
                        Reply
                      </button>
                      <button
                        type="button"
                        :disabled="actionState.repostBusy || articleMetrics.myRepost"
                        :class="[
                          'inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                          actionState.repostBusy || articleMetrics.myRepost
                            ? 'border-green-200 bg-green-50 text-green-600'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-green-200 hover:bg-green-50 hover:text-green-600'
                        ]"
                        @click="emit('repost', buildPostPayload())"
                      >
                        <IconRepeat :class="['h-4 w-4', actionState.repostBusy ? 'desk-action-icon-busy' : '', actionState.repostAnimated ? 'desk-action-icon-pop' : '']" />
                        Repost
                      </button>
                      <button
                        type="button"
                        :disabled="actionState.quoteBusy"
                        class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:border-emerald-200 disabled:bg-emerald-50/70 disabled:text-emerald-500"
                        @click="emit('quote', buildPostPayload())"
                      >
                        <IconQuote :class="['h-4 w-4', actionState.quoteBusy ? 'desk-action-icon-busy' : '']" />
                        Quote
                      </button>
                      <button
                        type="button"
                        :disabled="actionState.reactBusy || articleMetrics.myReaction"
                        :class="[
                          'inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                          actionState.reactBusy || articleMetrics.myReaction
                            ? 'border-pink-200 bg-pink-50 text-pink-600'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200 hover:bg-pink-50 hover:text-pink-600'
                        ]"
                        @click="emit('react', buildPostPayload())"
                      >
                        <IconHeart :class="['h-4 w-4', actionState.reactBusy ? 'desk-action-icon-busy' : '', actionState.reactAnimated ? 'desk-action-icon-pop' : '']" />
                        Like
                      </button>
                    </div>

                    <button
                      type="button"
                      class="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-100"
                      @click="emit('zap', buildPostPayload())"
                    >
                      <IconBolt class="h-4 w-4" />
                      Zap This Article
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            <main class="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,_rgba(255,255,255,1),_rgba(248,250,252,0.82)_100%)]">
              <div class="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
                <div class="mx-auto max-w-3xl">
                  <div class="mb-8 rounded-[2rem] border border-slate-200 bg-white/88 p-6 shadow-[0_22px_48px_rgba(15,23,42,0.06)] sm:p-8">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Longform</span>
                      <span class="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">In Desk Reader</span>
                    </div>

                    <h1 class="mt-4 text-3xl font-semibold leading-tight tracking-[-0.02em] text-slate-950 sm:text-5xl">
                      {{ title }}
                    </h1>

                    <p v-if="summary" class="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                      {{ summary }}
                    </p>

                    <div v-if="hashtags.length" class="mt-5 flex flex-wrap gap-2">
                      <span
                        v-for="tag in hashtags"
                        :key="tag"
                        class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        #{{ tag }}
                      </span>
                    </div>
                  </div>

                  <article class="desk-article-reader rounded-[2rem] border border-slate-200 bg-white/92 px-6 py-8 shadow-[0_22px_48px_rgba(15,23,42,0.06)] sm:px-10 sm:py-10" v-html="articleHtml"></article>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.desk-action-icon-busy {
  animation: desk-action-busy 0.9s ease-in-out infinite;
  transform-origin: center;
}

.desk-action-icon-pop {
  animation: desk-action-pop 0.5s cubic-bezier(0.2, 0.9, 0.2, 1);
  transform-origin: center;
}

.desk-article-reader :deep(h1),
.desk-article-reader :deep(h2),
.desk-article-reader :deep(h3) {
  color: rgb(15 23 42);
  font-weight: 650;
  letter-spacing: -0.02em;
}

.desk-article-reader :deep(h1) {
  margin: 3rem 0 1.5rem;
  font-size: 2rem;
}

.desk-article-reader :deep(h2) {
  margin: 2.6rem 0 1.2rem;
  font-size: 1.55rem;
}

.desk-article-reader :deep(h3) {
  margin: 2rem 0 1rem;
  font-size: 1.2rem;
}

.desk-article-reader :deep(p),
.desk-article-reader :deep(li) {
  color: rgb(51 65 85);
  font-size: 1.06rem;
  line-height: 1.9;
}

.desk-article-reader :deep(p) {
  margin: 0 0 1.4rem;
}

.desk-article-reader :deep(a) {
  color: rgb(194 65 12);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.desk-article-reader :deep(ul) {
  margin: 0 0 1.6rem;
  padding-left: 1.2rem;
  list-style: disc;
}

.desk-article-reader :deep(blockquote) {
  margin: 2rem 0;
  border-left: 4px solid rgb(251 191 36);
  background: rgb(255 251 235);
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  color: rgb(71 85 105);
  font-style: italic;
}

.desk-article-reader :deep(pre) {
  overflow-x: auto;
  margin: 1.8rem 0;
  border: 1px solid rgb(226 232 240);
  border-radius: 1rem;
  background: rgb(248 250 252);
  padding: 1rem 1.1rem;
}

.desk-article-reader :deep(code) {
  border-radius: 0.45rem;
  background: rgb(241 245 249);
  padding: 0.12rem 0.38rem;
  font-size: 0.92em;
}

.desk-article-reader :deep(pre code) {
  background: transparent;
  padding: 0;
}

.desk-article-reader :deep(hr) {
  margin: 2.2rem 0;
  border: none;
  border-top: 1px solid rgb(226 232 240);
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
