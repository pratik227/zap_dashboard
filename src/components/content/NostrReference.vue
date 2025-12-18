<template>
  <div class="nostr-reference inline-block">
    <div v-if="data.type === 'profile'" class="inline-flex items-center space-x-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg px-3 py-2 transition-colors cursor-pointer" @click="openInClient">
      <div class="w-6 h-6 rounded-full overflow-hidden border border-purple-300">
        <img 
          :src="profileData?.picture || generateAvatar(data.pubkey)" 
          :alt="profileData?.name || formatPubkey(data.pubkey)"
          class="w-full h-full object-cover"
          @error="$event.target.src = generateAvatar(data.pubkey)"
        />
      </div>
      <div class="flex flex-col">
        <span class="text-sm font-medium text-purple-800">
          {{ profileData?.name || formatPubkey(data.pubkey) }}
        </span>
        <span class="text-xs text-purple-600">@{{ formatPubkey(data.pubkey) }}</span>
      </div>
      <IconUser class="w-4 h-4 text-purple-600" />
    </div>

    <div v-else-if="data.type === 'note' || data.type === 'event'" class="inline-flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 transition-colors cursor-pointer" @click="openInClient">
      <IconFileText class="w-4 h-4 text-blue-600" />
      <div class="flex flex-col">
        <span class="text-sm font-medium text-blue-800">
          {{ data.displayType }}
        </span>
        <span class="text-xs text-blue-600">
          {{ formatEventId(data.eventId) }}
        </span>
      </div>
      <IconExternalLink class="w-3 h-3 text-blue-500" />
    </div>

    <div v-else-if="data.type === 'address'" class="inline-flex items-center space-x-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-3 py-2 transition-colors cursor-pointer" @click="openInClient">
      <IconHash class="w-4 h-4 text-green-600" />
      <div class="flex flex-col">
        <span class="text-sm font-medium text-green-800">
          {{ data.displayType }} (Kind {{ data.kind }})
        </span>
        <span class="text-xs text-green-600">
          {{ formatPubkey(data.pubkey) }}
        </span>
      </div>
      <IconExternalLink class="w-3 h-3 text-green-500" />
    </div>

    <div v-else class="inline-flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition-colors cursor-pointer" @click="openInClient">
      <IconLink class="w-4 h-4 text-gray-600" />
      <span class="text-sm text-gray-800">{{ data.identifier }}</span>
      <IconExternalLink class="w-3 h-3 text-gray-500" />
    </div>

    <div v-if="showTooltip" class="absolute z-10 bg-black text-white text-xs rounded px-2 py-1 mt-1 whitespace-nowrap">
      Click to open in Nostr client
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { 
  IconUser, 
  IconFileText, 
  IconHash, 
  IconLink, 
  IconExternalLink 
} from '@iconify-prerendered/vue-tabler'
import { useNostrContent } from '../../composables/content/useNostrContent.js'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  client: {
    type: String,
    default: 'primal'
  }
})

const { getClientUrl, formatPubkey, generateAvatar } = useNostrContent()

const profileData = ref(null)
const showTooltip = ref(false)

const formatEventId = (eventId) => {
  if (!eventId) return 'Unknown'
  return eventId.substring(0, 8) + '...' + eventId.substring(eventId.length - 8)
}

const openInClient = () => {
  const url = getClientUrl(props.client, props.data)
  if (url !== '#') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

// TODO: In a real implementation, you would fetch profile data from relays
onMounted(async () => {
  if (props.data.type === 'profile') {
    profileData.value = {
      name: null,
      picture: null
    }
  }
})
</script>

<style scoped>
.nostr-reference {
  position: relative;
}

.nostr-reference:hover .tooltip {
  display: block;
}
</style>
