<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMentions } from '../../composables/content/useMentions.js'
import { IconUser, IconCheck, IconLoader, IconPlus, IconX } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  placeholder: {
    type: String,
    default: 'Search users by name or npub...'
  },
  roleLabel: {
    type: String,
    default: 'Role (optional)'
  },
  showRole: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['user-selected'])

const {
  isSearching,
  searchResults,
  contactList,
  searchUsers,
  fetchContactList,
  formatDisplayName
} = useMentions()

// Component state
const inputRef = ref(null)
const showSuggestions = ref(false)
const selectedIndex = ref(0)
const searchQuery = ref('')
const roleInput = ref('')

// Computed
const filteredSuggestions = computed(() => {
  return searchResults.value.slice(0, 8) // Limit to 8 suggestions
})

const hasSuggestions = computed(() => {
  return filteredSuggestions.value.length > 0
})

// Methods
const handleInput = async (event) => {
  const value = event.target.value
  searchQuery.value = value
  
  if (value.length >= 1) {
    // Search for users
    await searchUsers(value, { debounce: 300 })
    showSuggestions.value = true
    selectedIndex.value = 0
  } else if (value.length === 0) {
    // Show contact list when input is empty
    if (contactList.value.length === 0) {
      await fetchContactList()
    }
    searchResults.value = contactList.value.slice(0, 8)
    showSuggestions.value = true
    selectedIndex.value = 0
  } else {
    showSuggestions.value = false
  }
}

const selectUser = (user) => {
  emit('user-selected', {
    pubkey: user.pubkey,
    name: formatDisplayName(user),
    picture: user.picture,
    nip05: user.nip05,
    role: roleInput.value.trim()
  })
  
  // Reset
  searchQuery.value = ''
  roleInput.value = ''
  showSuggestions.value = false
  
  // Focus back on input
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

const handleKeyDown = (event) => {
  if (!showSuggestions.value || !hasSuggestions.value) return
  
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = (selectedIndex.value + 1) % filteredSuggestions.value.length
      scrollToSelected()
      break
      
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value === 0 
        ? filteredSuggestions.value.length - 1 
        : selectedIndex.value - 1
      scrollToSelected()
      break
      
    case 'Enter':
      if (showSuggestions.value && hasSuggestions.value) {
        event.preventDefault()
        selectUser(filteredSuggestions.value[selectedIndex.value])
      }
      break
      
    case 'Escape':
      event.preventDefault()
      showSuggestions.value = false
      break
      
    case 'Tab':
      if (showSuggestions.value && hasSuggestions.value) {
        event.preventDefault()
        selectUser(filteredSuggestions.value[selectedIndex.value])
      }
      break
  }
}

const handleFocus = async () => {
  if (searchQuery.value.length === 0) {
    // Show contact list on focus
    if (contactList.value.length === 0) {
      await fetchContactList()
    }
    searchResults.value = contactList.value.slice(0, 8)
    showSuggestions.value = true
  }
}

const scrollToSelected = () => {
  nextTick(() => {
    const selectedElement = document.querySelector('.user-suggestion-selected')
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.user-search-container')) {
    showSuggestions.value = false
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  // Pre-fetch contact list for faster suggestions
  await fetchContactList()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="user-search-container relative">
    <div class="flex gap-2">
      <!-- Search Input -->
      <div class="flex-1 relative">
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          :placeholder="placeholder"
          class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
          @input="handleInput"
          @keydown="handleKeyDown"
          @focus="handleFocus"
        />
        
        <!-- Clear button -->
        <button
          v-if="searchQuery"
          @click="searchQuery = ''; showSuggestions = false"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <IconX class="w-4 h-4" />
        </button>
      </div>
      
      <!-- Role Input (optional) -->
      <input
        v-if="showRole"
        v-model="roleInput"
        type="text"
        :placeholder="roleLabel"
        class="w-32 px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm"
      />
    </div>
    
    <!-- Suggestions Dropdown -->
    <div
      v-if="showSuggestions && (hasSuggestions || isSearching)"
      class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
    >
      <!-- Loading State -->
      <div v-if="isSearching && !hasSuggestions" class="p-4 text-center">
        <IconLoader class="w-5 h-5 animate-spin text-orange-500 mx-auto mb-2" />
        <p class="text-sm text-gray-600">Searching users...</p>
      </div>
      
      <!-- No Results -->
      <div v-else-if="!hasSuggestions && searchQuery.length > 0" class="p-4 text-center">
        <IconUser class="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p class="text-sm text-gray-600">No users found</p>
        <p class="text-xs text-gray-400 mt-1">Try searching by name, npub, or nip-05</p>
      </div>
      
      <!-- Suggestions List -->
      <div v-else class="max-h-64 overflow-y-auto">
        <div
          v-for="(user, index) in filteredSuggestions"
          :key="user.pubkey"
          class="user-suggestion flex items-center space-x-3 p-3 cursor-pointer transition-colors"
          :class="{
            'user-suggestion-selected bg-orange-50': index === selectedIndex,
            'hover:bg-gray-50': index !== selectedIndex
          }"
          @click="selectUser(user)"
          @mouseenter="selectedIndex = index"
        >
          <!-- Avatar -->
          <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            <img
              v-if="user.picture"
              :src="user.picture"
              :alt="formatDisplayName(user)"
              class="w-full h-full object-cover"
              @error="(e) => e.target.style.display = 'none'"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <IconUser class="w-6 h-6 text-gray-400" />
            </div>
          </div>
          
          <!-- User Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2">
              <p class="font-medium text-gray-900 truncate text-sm">
                {{ formatDisplayName(user) }}
              </p>
              
              <!-- Badges -->
              <span v-if="user.isContact" class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Contact
              </span>
            </div>
            
            <p v-if="user.nip05" class="text-xs text-gray-500 truncate">
              {{ user.nip05 }}
            </p>
            <p v-else class="text-xs text-gray-400 truncate font-mono">
              {{ user.pubkey.substring(0, 16) }}...
            </p>
          </div>
          
          <!-- Selected Indicator -->
          <IconCheck
            v-if="index === selectedIndex"
            class="w-5 h-5 text-orange-500 flex-shrink-0"
          />
        </div>
      </div>
      
      <!-- Footer Hint -->
      <div class="border-t border-gray-100 px-3 py-2 bg-gray-50">
        <p class="text-xs text-gray-500">
          <kbd class="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs">↑↓</kbd> navigate
          <kbd class="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs ml-2">Enter</kbd> select
          <kbd class="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-xs ml-2">Esc</kbd> close
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-search-container {
  position: relative;
}

.user-suggestion {
  transition: background-color 0.1s ease;
}

kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
