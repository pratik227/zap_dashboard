<template>
  <div class="content-renderer">
    <div v-if="parsedContent.segments.length === 0" class="text-gray-500 italic">
      No content to display
    </div>
    
    <div v-else class="space-y-3">
      <template v-for="(segment, index) in parsedContent.segments" :key="index">
        <span v-if="segment.type === 'text'" class="whitespace-pre-wrap">{{ segment.content }}</span>
        
        <NostrReference
          v-else-if="segment.type === 'nostr'" 
          :data="segment.data"
          :client="preferredClient"
          class="inline-block"
        />
        
        <MediaEmbed
          v-else-if="segment.type === 'media'" 
          :url="segment.data.url"
          :media-type="segment.data.type"
          class="block my-3"
        />
      </template>
      
      <div v-if="showDebugInfo && (parsedContent.nostrUris.length > 0 || hasMedia)" class="mt-4 p-3 bg-gray-50 rounded-lg border text-xs text-gray-600">
        <div class="font-medium mb-2">Content Analysis:</div>
        <div v-if="parsedContent.nostrUris.length > 0" class="mb-1">
          <span class="font-medium">Nostr References:</span> {{ parsedContent.nostrUris.length }}
          <span class="ml-2 text-gray-500">
            ({{ parsedContent.nostrUris.map(uri => uri.displayType).join(', ') }})
          </span>
        </div>
        <div v-if="hasMedia">
          <span class="font-medium">Media:</span>
          <span v-if="parsedContent.media.images.length > 0" class="ml-1">
            {{ parsedContent.media.images.length }} image(s)
          </span>
          <span v-if="parsedContent.media.videos.length > 0" class="ml-1">
            {{ parsedContent.media.videos.length }} video(s)
          </span>
          <span v-if="parsedContent.media.audio.length > 0" class="ml-1">
            {{ parsedContent.media.audio.length }} audio file(s)
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useNostrContent } from '../composables/useNostrContent.js'
import NostrReference from './NostrReference.vue'
import MediaEmbed from './MediaEmbed.vue'

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  preferredClient: {
    type: String,
    default: 'primal',
    validator: (value) => ['primal', 'yakihonne', 'highlighter'].includes(value)
  },
  showDebugInfo: {
    type: Boolean,
    default: false
  }
})

const { parseContent } = useNostrContent()

const parsedContent = computed(() => {
  return parseContent(props.content)
})

const hasMedia = computed(() => {
  const media = parsedContent.value.media
  return media.images.length > 0 || media.videos.length > 0 || media.audio.length > 0
})

defineExpose({
  parsedContent,
  hasMedia
})
</script>

<style scoped>
.content-renderer {
  line-height: 1.6;
}

.content-renderer > div > * {
  vertical-align: top;
}

.content-renderer .whitespace-pre-wrap {
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
