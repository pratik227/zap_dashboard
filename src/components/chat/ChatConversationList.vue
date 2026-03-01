<script setup>
import { computed } from 'vue'
import { IconSearch, IconX } from '@iconify-prerendered/vue-tabler'
import ChatConversationItem from './ChatConversationItem.vue'
import ChatEmptyState from './ChatEmptyState.vue'

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  activeConversationId: { type: String, default: null },
  searchQuery: { type: String, default: '' }
})

const emit = defineEmits(['select', 'new-connection', 'update:searchQuery'])

const filteredConversations = computed(() => {
  if (!props.searchQuery) return props.conversations
  const query = props.searchQuery.toLowerCase()
  return props.conversations.filter(conv =>
    conv.profile?.name?.toLowerCase().includes(query) ||
    conv.pubkey.toLowerCase().includes(query)
  )
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <!-- Search -->
    <div class="px-3 py-2.5 flex-shrink-0">
      <div class="relative">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          :value="searchQuery"
          @input="emit('update:searchQuery', $event.target.value)"
          type="text"
          placeholder="Search conversations..."
          class="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm focus:ring-2 focus:ring-orange-300/50 focus:border-orange-300 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
        />
        <!-- Clear search -->
        <button
          v-if="searchQuery"
          @click="emit('update:searchQuery', '')"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/50 transition-colors"
        >
          <IconX class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto overscroll-contain">
      <ChatEmptyState
        v-if="filteredConversations.length === 0 && !searchQuery"
        type="no-conversations"
        @add-connection="emit('new-connection')"
      />
      <!-- No search results -->
      <div v-else-if="filteredConversations.length === 0 && searchQuery" class="p-6 text-center">
        <p class="text-sm text-gray-400">No conversations match "{{ searchQuery }}"</p>
      </div>
      <ChatConversationItem
        v-for="conv in filteredConversations"
        :key="conv.pubkey"
        :conversation="conv"
        :is-active="conv.pubkey === activeConversationId"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>
