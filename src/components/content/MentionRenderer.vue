<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useMentions } from '../../composables/content/useMentions.js'
import { useAudience } from '../../composables/audience/useAudience.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import ProfileHoverCard from '../profile/ProfileHoverCard.vue'
import * as nip19 from 'nostr-tools/nip19'

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  showProfileOnClick: {
    type: Boolean,
    default: true
  },
  mentionClass: {
    type: String,
    default: 'text-orange-600 hover:text-orange-700 font-medium cursor-pointer hover:underline'
  }
})

const emit = defineEmits(['mention-click'])

const {
  parseMentions,
  fetchUserProfile,
  formatDisplayName
} = useMentions()

const { isFollowing, followUser, unfollowUser } = useAudience()

// Cache for user profiles
const userProfiles = ref(new Map())

// Hover card state
const hoveredPubkey = ref(null)
const hoverAnchorEl = ref(null)
let hoverShowTimer = null
let hoverHideTimer = null

// Parse content into segments (text and mentions)
const contentSegments = computed(() => {
  const segments = []
  const mentions = parseMentions(props.content)

  if (mentions.length === 0) {
    return [{ type: 'text', content: props.content }]
  }

  let lastIndex = 0

  mentions.forEach((mention, index) => {
    if (mention.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: props.content.substring(lastIndex, mention.startIndex)
      })
    }

    segments.push({
      type: 'mention',
      pubkey: mention.pubkey,
      raw: mention.raw,
      index: index
    })

    lastIndex = mention.endIndex
  })

  if (lastIndex < props.content.length) {
    segments.push({
      type: 'text',
      content: props.content.substring(lastIndex)
    })
  }

  return segments
})

// Get display name for a mention
const getMentionDisplay = (pubkey) => {
  const profile = userProfiles.value.get(pubkey)
  if (profile) {
    return '@' + formatDisplayName(profile)
  }
  return '@' + pubkey.substring(0, 8) + '...'
}

// Get mini avatar for inline mention display
const getMentionAvatar = (pubkey) => {
  const profile = userProfiles.value.get(pubkey)
  return profile?.picture || generateAvatar(pubkey)
}

// Handle mention click
const handleMentionClick = (pubkey) => {
  emit('mention-click', { pubkey, profile: userProfiles.value.get(pubkey) })

  if (props.showProfileOnClick) {
    const npub = nip19.npubEncode(pubkey)
    window.open(`https://primal.net/p/${npub}`, '_blank')
  }
}

// Hover card handlers
const handleMentionMouseEnter = (pubkey, event) => {
  clearTimeout(hoverHideTimer)
  hoverShowTimer = setTimeout(() => {
    hoveredPubkey.value = pubkey
    hoverAnchorEl.value = event.target
  }, 300) // 300ms delay to prevent accidental triggers
}

const handleMentionMouseLeave = () => {
  clearTimeout(hoverShowTimer)
  hoverHideTimer = setTimeout(() => {
    hoveredPubkey.value = null
    hoverAnchorEl.value = null
  }, 200) // 200ms grace period to move mouse into card
}

const handleHoverCardClose = (shouldClose) => {
  if (shouldClose) {
    // Mouse left the card — start hide timer
    hoverHideTimer = setTimeout(() => {
      hoveredPubkey.value = null
      hoverAnchorEl.value = null
    }, 200)
  } else {
    // Mouse entered the card — cancel hide timer
    clearTimeout(hoverHideTimer)
  }
}

// Follow/unfollow from hover card
const handleFollow = async (pubkey) => {
  try {
    await followUser(pubkey)
  } catch (err) {
    console.warn('Follow failed:', err)
  }
}

const handleUnfollow = async (pubkey) => {
  try {
    await unfollowUser(pubkey)
  } catch (err) {
    console.warn('Unfollow failed:', err)
  }
}

// Fetch profiles for all mentions
const loadMentionProfiles = async () => {
  const mentions = parseMentions(props.content)

  for (const mention of mentions) {
    if (!userProfiles.value.has(mention.pubkey)) {
      try {
        const profile = await fetchUserProfile(mention.pubkey)
        userProfiles.value.set(mention.pubkey, profile)
      } catch (err) {
        console.warn('Failed to load profile for mention:', mention.pubkey.substring(0, 8))
      }
    }
  }
}

onMounted(() => {
  loadMentionProfiles()
})

onUnmounted(() => {
  clearTimeout(hoverShowTimer)
  clearTimeout(hoverHideTimer)
})
</script>

<template>
  <span class="mention-renderer">
    <template v-for="(segment, index) in contentSegments" :key="index">
      <!-- Regular text -->
      <span v-if="segment.type === 'text'">{{ segment.content }}</span>

      <!-- Mention with inline mini-avatar -->
      <span
        v-else-if="segment.type === 'mention'"
        :class="mentionClass"
        class="inline-flex items-center gap-0.5 align-baseline"
        :title="`View profile: ${getMentionDisplay(segment.pubkey)}`"
        @click.stop="handleMentionClick(segment.pubkey)"
        @mouseenter="handleMentionMouseEnter(segment.pubkey, $event)"
        @mouseleave="handleMentionMouseLeave"
      >
        <img
          :src="getMentionAvatar(segment.pubkey)"
          class="w-4 h-4 rounded-full inline-block align-text-bottom"
          @error="$event.target.src = generateAvatar(segment.pubkey)"
        />
        {{ getMentionDisplay(segment.pubkey) }}
      </span>
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
  </span>
</template>

<style scoped>
.mention-renderer {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
