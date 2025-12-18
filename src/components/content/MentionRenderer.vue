<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMentions } from '../../composables/content/useMentions.js'
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

// Cache for user profiles
const userProfiles = ref(new Map())

// Parse content into segments (text and mentions)
const contentSegments = computed(() => {
  const segments = []
  const mentions = parseMentions(props.content)
  
  if (mentions.length === 0) {
    return [{ type: 'text', content: props.content }]
  }
  
  let lastIndex = 0
  
  mentions.forEach((mention, index) => {
    // Add text before mention
    if (mention.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: props.content.substring(lastIndex, mention.startIndex)
      })
    }
    
    // Add mention
    segments.push({
      type: 'mention',
      pubkey: mention.pubkey,
      raw: mention.raw,
      index: index
    })
    
    lastIndex = mention.endIndex
  })
  
  // Add remaining text
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

// Handle mention click
const handleMentionClick = (pubkey) => {
  emit('mention-click', { pubkey, profile: userProfiles.value.get(pubkey) })
  
  if (props.showProfileOnClick) {
    // Open profile in new tab (using primal.net as default)
    const npub = nip19.npubEncode(pubkey)
    window.open(`https://primal.net/p/${npub}`, '_blank')
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
</script>

<template>
  <span class="mention-renderer">
    <template v-for="(segment, index) in contentSegments" :key="index">
      <!-- Regular text -->
      <span v-if="segment.type === 'text'">{{ segment.content }}</span>
      
      <!-- Mention -->
      <span
        v-else-if="segment.type === 'mention'"
        :class="mentionClass"
        :title="`View profile: ${getMentionDisplay(segment.pubkey)}`"
        @click.stop="handleMentionClick(segment.pubkey)"
      >
        {{ getMentionDisplay(segment.pubkey) }}
      </span>
    </template>
  </span>
</template>

<style scoped>
.mention-renderer {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
