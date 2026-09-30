<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useNostrContent } from '../../composables/content/useNostrContent.js'
import { useMentions } from '../../composables/content/useMentions.js'
import { useAudience } from '../../composables/audience/useAudience.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import MediaEmbed from './MediaEmbed.vue'
import NostrReference from './NostrReference.vue'
import ProfileHoverCard from '../profile/ProfileHoverCard.vue'
import { nip19 } from '../../services/nostr/nostrImports.js'

const props = defineProps({
  content: { type: String, required: true },
  preferredClient: { type: String, default: 'primal' },
  showProfileOnClick: { type: Boolean, default: true },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['mention-click'])

const { parseContent } = useNostrContent()
const { fetchUserProfile, formatDisplayName } = useMentions()
const { isFollowing, followUser, unfollowUser } = useAudience()

// Profile cache for inline mentions
const profileCache = ref(new Map())

// Hover card state
const hoveredPubkey = ref(null)
const hoverAnchorEl = ref(null)
let hoverShowTimer = null
let hoverHideTimer = null

// Parse content into segments: text, nostr (profile/note/event/address), media
const parsedContent = computed(() => parseContent(props.content))

// Separate inline segments (text + profile mentions) from block segments (media, note/event refs)
const renderSegments = computed(() => {
  const segments = parsedContent.value.segments
  const result = []
  let currentInlineGroup = []

  const flushInline = () => {
    if (currentInlineGroup.length > 0) {
      result.push({ type: 'inline-group', segments: currentInlineGroup })
      currentInlineGroup = []
    }
  }

  for (const seg of segments) {
    if (seg.type === 'media') {
      flushInline()
      result.push(seg)
    } else if (seg.type === 'nostr' && seg.data && seg.data.type !== 'profile') {
      // note, event, address — render as block-level reference
      flushInline()
      result.push(seg)
    } else {
      // text or profile mention — inline
      currentInlineGroup.push(seg)
    }
  }
  flushInline()
  return result
})

// Collect all profile pubkeys from nostr segments for batch fetching
const profilePubkeys = computed(() => {
  const pubkeys = new Set()
  for (const seg of parsedContent.value.segments) {
    if (seg.type === 'nostr' && seg.data?.type === 'profile' && seg.data.pubkey) {
      pubkeys.add(seg.data.pubkey)
    }
  }
  return [...pubkeys]
})

// Fetch profiles for mentioned users
const loadProfiles = async () => {
  for (const pubkey of profilePubkeys.value) {
    if (!profileCache.value.has(pubkey)) {
      try {
        const profile = await fetchUserProfile(pubkey)
        profileCache.value.set(pubkey, profile)
      } catch {
        // Profile unavailable — will show truncated pubkey
      }
    }
  }
}

watch(() => props.content, loadProfiles)
onMounted(loadProfiles)

// Display helpers
const getMentionDisplay = (pubkey) => {
  const profile = profileCache.value.get(pubkey)
  if (profile) return '@' + formatDisplayName(profile)
  return '@' + pubkey.substring(0, 8) + '...'
}

const getMentionAvatar = (pubkey) => {
  const profile = profileCache.value.get(pubkey)
  return profile?.picture || generateAvatar(pubkey)
}

// Mention interaction
const handleMentionClick = (pubkey) => {
  emit('mention-click', { pubkey, profile: profileCache.value.get(pubkey) })
  if (props.showProfileOnClick) {
    const npub = nip19.npubEncode(pubkey)
    window.open(`https://primal.net/p/${npub}`, '_blank')
  }
}

// Hover card
const handleMentionMouseEnter = (pubkey, event) => {
  clearTimeout(hoverHideTimer)
  hoverShowTimer = setTimeout(() => {
    hoveredPubkey.value = pubkey
    hoverAnchorEl.value = event.target
  }, 300)
}

const handleMentionMouseLeave = () => {
  clearTimeout(hoverShowTimer)
  hoverHideTimer = setTimeout(() => {
    hoveredPubkey.value = null
    hoverAnchorEl.value = null
  }, 200)
}

const handleHoverCardClose = (shouldClose) => {
  if (shouldClose) {
    hoverHideTimer = setTimeout(() => {
      hoveredPubkey.value = null
      hoverAnchorEl.value = null
    }, 200)
  } else {
    clearTimeout(hoverHideTimer)
  }
}

const handleFollow = async (pubkey) => {
  try { await followUser(pubkey) } catch (err) { console.warn('Follow failed:', err) }
}

const handleUnfollow = async (pubkey) => {
  try { await unfollowUser(pubkey) } catch (err) { console.warn('Unfollow failed:', err) }
}

onUnmounted(() => {
  clearTimeout(hoverShowTimer)
  clearTimeout(hoverHideTimer)
})
</script>

<template>
  <div class="note-content-renderer">
    <template v-for="(block, bi) in renderSegments" :key="bi">
      <!-- Inline group: text + profile mentions -->
      <span v-if="block.type === 'inline-group'" class="whitespace-pre-wrap break-words">
        <template v-for="(seg, si) in block.segments" :key="si">
          <span v-if="seg.type === 'text'">{{ seg.content }}</span>

          <!-- Profile mention: inline avatar + @name -->
          <span
            v-else-if="seg.type === 'nostr' && seg.data?.type === 'profile'"
            class="inline-flex items-center gap-0.5 align-baseline text-orange-600 hover:text-orange-700 font-medium cursor-pointer hover:underline"
            :title="`View profile: ${getMentionDisplay(seg.data.pubkey)}`"
            @click.stop="handleMentionClick(seg.data.pubkey)"
            @mouseenter="handleMentionMouseEnter(seg.data.pubkey, $event)"
            @mouseleave="handleMentionMouseLeave"
          >
            <img
              :src="getMentionAvatar(seg.data.pubkey)"
              class="w-4 h-4 rounded-full inline-block align-text-bottom"
              @error="$event.target.src = generateAvatar(seg.data.pubkey)"
            />
            {{ getMentionDisplay(seg.data.pubkey) }}
          </span>

          <!-- Plain URL: clickable link -->
          <a
            v-else-if="seg.type === 'url'"
            :href="seg.data.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-blue-600 hover:text-blue-700 hover:underline break-all"
          >{{ seg.data.url }}</a>
        </template>
      </span>

      <!-- Media: images, videos, audio (hidden in compact/list mode) -->
      <MediaEmbed
        v-else-if="block.type === 'media' && !compact"
        :url="block.data.url"
        :media-type="block.data.type"
        class="block my-3"
      />

      <!-- Nostr reference: note, event, address (hidden in compact/list mode) -->
      <NostrReference
        v-else-if="block.type === 'nostr' && !compact"
        :data="block.data"
        :client="preferredClient"
        class="inline-block my-1"
      />
    </template>

    <!-- Profile hover card -->
    <ProfileHoverCard
      v-if="hoveredPubkey"
      :pubkey="hoveredPubkey"
      :anchor-el="hoverAnchorEl"
      :is-following="isFollowing(hoveredPubkey)"
      @follow="handleFollow"
      @unfollow="handleUnfollow"
      @close="handleHoverCardClose"
    />
  </div>
</template>

<style scoped>
.note-content-renderer {
  line-height: 1.6;
  word-wrap: break-word;
}
</style>
