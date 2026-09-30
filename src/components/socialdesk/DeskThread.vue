<script setup>
/**
 * DeskThread — Collapsible threaded replies under a post.
 *
 * Collapsed by default (shows "N replies" link). On expand, fetches replies
 * via useComments, builds a tree from NIP-10 markers, and renders recursively.
 * Max 3 levels deep to prevent UI clutter.
 */
import { ref, computed } from 'vue'
import { IconMessageCircle, IconChevronDown, IconChevronUp, IconLoader } from '@iconify-prerendered/vue-tabler'
import { useComments } from '../../composables/content/useComments.js'
import { nip10 } from '../../services/nostr/nostrImports.js'
import DeskThreadReply from './DeskThreadReply.vue'

const props = defineProps({
  post: { type: Object, required: true },
  replyCount: { type: Number, default: 0 }
})

const emit = defineEmits(['profile-click', 'reply'])

const { fetchComments } = useComments()

const expanded = ref(false)
const replies = ref([])
const isLoading = ref(false)
const hasFetched = ref(false)

// ── Build tree from flat reply list ───────────────────────────
function buildTree(flatReplies, rootId) {
  const byParent = new Map()

  for (const reply of flatReplies) {
    // Determine parent using NIP-10 thread parsing
    let parentId = rootId
    try {
      const thread = nip10.parseThread(reply.rawEvent)
      if (thread?.reply?.id) {
        parentId = thread.reply.id
      } else if (thread?.root?.id && thread.root.id !== rootId) {
        parentId = thread.root.id
      }
    } catch { /* fall back to rootId */ }

    if (!byParent.has(parentId)) byParent.set(parentId, [])
    byParent.get(parentId).push(reply)
  }

  // Recursively build tree, max 3 levels
  function attachChildren(parentId, depth = 0) {
    const children = byParent.get(parentId) || []
    return children
      .sort((a, b) => a.createdAt - b.createdAt) // oldest first in thread
      .map(reply => ({
        ...reply,
        children: depth < 2 ? attachChildren(reply.id, depth + 1) : [],
        depth
      }))
  }

  return attachChildren(rootId)
}

const threadTree = computed(() => {
  if (replies.value.length === 0) return []
  return buildTree(replies.value, props.post.id)
})

// ── Expand / Collapse ─────────────────────────────────────────
async function toggle() {
  if (expanded.value) {
    expanded.value = false
    return
  }

  expanded.value = true

  // Lazy fetch on first expand
  if (!hasFetched.value) {
    isLoading.value = true
    try {
      const result = await fetchComments(props.post.id, 1) // kind:1 note
      replies.value = result || []
    } catch { /* useComments handles errors internally */ }
    isLoading.value = false
    hasFetched.value = true
  }
}

const displayCount = computed(() =>
  hasFetched.value ? replies.value.length : props.replyCount
)
</script>

<template>
  <div class="mt-1.5">
    <!-- Toggle button -->
    <button
      @click.stop="toggle"
      class="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors py-0.5"
    >
      <IconMessageCircle class="w-3 h-3" />
      <span>{{ displayCount }} {{ displayCount === 1 ? 'reply' : 'replies' }}</span>
      <IconChevronUp v-if="expanded" class="w-3 h-3" />
      <IconChevronDown v-else class="w-3 h-3" />
    </button>

    <!-- Thread content (expanded) -->
    <div v-if="expanded" class="mt-2">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center gap-2 py-2 pl-3">
        <IconLoader class="w-3.5 h-3.5 text-gray-400 animate-spin" />
        <span class="text-[11px] text-gray-400">Loading replies...</span>
      </div>

      <!-- Empty after fetch -->
      <div v-else-if="hasFetched && threadTree.length === 0" class="py-2 pl-3">
        <span class="text-[11px] text-gray-400">No replies found</span>
      </div>

      <!-- Reply tree -->
      <div v-else class="space-y-0">
        <DeskThreadReply
          v-for="reply in threadTree"
          :key="reply.id"
          :reply="reply"
          @profile-click="(data) => emit('profile-click', data)"
          @reply="(p) => emit('reply', p)"
        />
      </div>
    </div>
  </div>
</template>
