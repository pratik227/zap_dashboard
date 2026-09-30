<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { IconX, IconSend, IconLoader } from '@iconify-prerendered/vue-tabler'
import { nip10 } from '../../services/nostr/nostrImports.js'
import { usePublish } from '../../composables/core/usePublish.js'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

const props = defineProps({
  post: { type: Object, required: true }
})

const emit = defineEmits(['close', 'sent'])

const { currentUser, userProfile } = useNostrAuth()
const { signAndPublish, isPublishing } = usePublish()

const replyText = ref('')
const error = ref('')
const inputRef = ref(null)
const modalRef = ref(null)
const showRef = ref(true) // always true when mounted (v-if controls mount)
useFocusTrap(showRef, modalRef)

const MAX_LENGTH = 500

const charCount = computed(() => replyText.value.length)
const canSend = computed(() => replyText.value.trim().length > 0 && charCount.value <= MAX_LENGTH && !isPublishing.value)

const userAvatar = computed(() =>
  userProfile.value?.picture || generateAvatar(currentUser.value?.pubkey)
)

const replyToName = computed(() => {
  return props.post.profile?.display_name
    || props.post.profile?.name
    || props.post.rawEvent?.pubkey?.slice(0, 8) + '...'
})

async function send() {
  if (!canSend.value) return
  error.value = ''

  const rawEvent = props.post?.rawEvent
  if (!rawEvent?.id || !rawEvent?.pubkey) {
    error.value = 'Cannot reply — post data is incomplete'
    return
  }

  try {
    // Determine thread context using NIP-10
    // If the target post is itself a reply, preserve the original root
    const existingThread = nip10.parseThread(rawEvent)
    const rootId = existingThread?.root?.id || rawEvent.id
    const replyId = rawEvent.id

    const threadTags = nip10.buildThreadTags({
      root: { id: rootId, relay: '' },
      reply: { id: replyId, relay: '' },
      profiles: [rawEvent.pubkey]
    })

    const template = {
      kind: 1,
      content: replyText.value.trim(),
      tags: threadTags
    }

    await signAndPublish(template)
    replyText.value = ''
    emit('sent')
  } catch (err) {
    error.value = getUserFriendlyError(err)
  }
}

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="modalRef"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reply-dialog-title"
      @click.self="emit('close')"
      @keydown.escape="emit('close')"
      tabindex="-1"
    >
      <div class="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 id="reply-dialog-title" class="text-sm font-semibold text-gray-900">
            Reply to {{ replyToName }}
          </h3>
          <button
            @click="emit('close')"
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close reply"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>

        <!-- Quoted post preview -->
        <div class="mx-4 mt-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200/60">
          <p class="text-xs text-gray-500 line-clamp-2">{{ post.content }}</p>
        </div>

        <!-- Composer -->
        <div class="p-4">
          <div class="flex items-start gap-3">
            <img
              :src="userAvatar"
              alt=""
              class="w-8 h-8 rounded-full object-cover border border-gray-200/60 flex-shrink-0"
              @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
            />
            <div class="flex-1 min-w-0">
              <textarea
                ref="inputRef"
                v-model="replyText"
                placeholder="Write your reply..."
                rows="3"
                :maxlength="MAX_LENGTH"
                class="w-full resize-none border-0 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:ring-0 focus:outline-none leading-relaxed"
                @keydown.meta.enter="send"
                @keydown.ctrl.enter="send"
              ></textarea>
            </div>
          </div>

          <!-- Error -->
          <p v-if="error" class="text-xs text-red-600 mt-2">{{ error }}</p>

          <!-- Footer -->
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <span :class="[
              'text-xs tabular-nums',
              charCount > MAX_LENGTH ? 'text-red-500' : charCount > MAX_LENGTH * 0.9 ? 'text-amber-500' : 'text-gray-400'
            ]">
              {{ charCount }}/{{ MAX_LENGTH }}
            </span>
            <button
              @click="send"
              :disabled="!canSend"
              :class="[
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                canSend
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              ]"
            >
              <IconLoader v-if="isPublishing" class="w-4 h-4 animate-spin" />
              <IconSend v-else class="w-4 h-4" />
              {{ isPublishing ? 'Sending...' : 'Reply' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
