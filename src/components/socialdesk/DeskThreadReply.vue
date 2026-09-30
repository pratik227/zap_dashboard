<script setup>
/**
 * DeskThreadReply — Single reply in a thread, rendered recursively.
 *
 * Compact layout: small avatar, author name, time, content.
 * Uses NoteContentRenderer for rich content. Indented by depth via
 * left padding. Reply button emits upward for DeskReplyComposer.
 */
import { computed } from 'vue'
import { IconMessageCircle } from '@iconify-prerendered/vue-tabler'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import NoteContentRenderer from '../content/NoteContentRenderer.vue'

const props = defineProps({
  reply: { type: Object, required: true }
})

const emit = defineEmits(['profile-click', 'reply'])

const authorName = computed(() =>
  props.reply.profile?.name || props.reply.profile?.display_name || props.reply.pubkey?.slice(0, 8) + '...'
)

const authorAvatar = computed(() =>
  props.reply.profile?.picture || generateAvatar(props.reply.pubkey)
)

function timeAgo(timestamp) {
  const diff = Math.floor(Date.now() / 1000) - timestamp
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`
  return new Date(timestamp * 1000).toLocaleDateString()
}

function handleReply() {
  emit('reply', {
    ...props.reply,
    rawEvent: props.reply.rawEvent
  })
}
</script>

<template>
  <div
    class="relative"
    :style="{ paddingLeft: `${reply.depth * 16 + 4}px` }"
  >
    <!-- Thread line connecting nested replies -->
    <div
      v-if="reply.depth > 0"
      class="absolute top-0 bottom-0 border-l border-gray-200/50"
      :style="{ left: `${reply.depth * 16 - 2}px` }"
    ></div>

    <div class="flex items-start gap-2 py-2">
      <!-- Avatar (small) -->
      <button
        @click.stop="emit('profile-click', { pubkey: reply.pubkey, profile: reply.profile })"
        class="flex-shrink-0"
      >
        <img
          :src="authorAvatar"
          :alt="authorName"
          class="w-6 h-6 rounded-full object-cover border border-gray-200/60"
          @error="$event.target.src = generateAvatar(reply.pubkey)"
        />
      </button>

      <!-- Body -->
      <div class="flex-1 min-w-0">
        <!-- Author + time -->
        <div class="flex items-baseline gap-1.5 mb-0.5">
          <button
            @click.stop="emit('profile-click', { pubkey: reply.pubkey, profile: reply.profile })"
            class="text-[12px] font-semibold text-gray-900 truncate hover:underline"
          >
            {{ authorName }}
          </button>
          <span class="text-[10px] text-gray-400 flex-shrink-0">{{ timeAgo(reply.createdAt) }}</span>
        </div>

        <!-- Content -->
        <div class="text-[12px] text-gray-700 leading-relaxed reply-content">
          <NoteContentRenderer
            :content="reply.content"
            :compact="true"
            :show-profile-on-click="false"
            @mention-click="(data) => emit('profile-click', data)"
          />
        </div>

        <!-- Reply action -->
        <button
          @click.stop="handleReply"
          class="flex items-center gap-0.5 mt-0.5 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
        >
          <IconMessageCircle class="w-3 h-3" />
          Reply
        </button>
      </div>
    </div>

    <!-- Nested children -->
    <DeskThreadReply
      v-for="child in reply.children"
      :key="child.id"
      :reply="child"
      @profile-click="(data) => emit('profile-click', data)"
      @reply="(p) => emit('reply', p)"
    />
  </div>
</template>

<style scoped>
.reply-content :deep(.note-content-renderer) {
  font-size: inherit;
  line-height: inherit;
}
</style>
