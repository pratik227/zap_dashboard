<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMentions } from '../../composables/content/useMentions.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { IconUser, IconCheck, IconLoader, IconX, IconShield, IconSearch } from '@iconify-prerendered/vue-tabler'

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
const containerRef = ref(null)
const showSuggestions = ref(false)
const selectedIndex = ref(0)
const searchQuery = ref('')
const roleInput = ref('')

// Computed
const filteredSuggestions = computed(() => {
  return searchResults.value.slice(0, 8)
})

const hasSuggestions = computed(() => {
  return filteredSuggestions.value.length > 0
})

const dropdownVisible = computed(() => {
  return showSuggestions.value && (hasSuggestions.value || isSearching.value || searchQuery.value.length > 0)
})

// Avatar with DiceBear fallback
const getAvatar = (user) => {
  return user.picture || generateAvatar(user.pubkey)
}

// Methods
const handleInput = async (event) => {
  const value = event.target.value
  searchQuery.value = value

  if (value.length >= 2) {
    await searchUsers(value, { debounce: 400 })
    showSuggestions.value = true
    selectedIndex.value = 0
  } else if (value.length === 0) {
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
    picture: user.picture || generateAvatar(user.pubkey),
    nip05: user.nip05,
    role: roleInput.value.trim()
  })

  searchQuery.value = ''
  roleInput.value = ''
  showSuggestions.value = false

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

const handleKeyDown = (event) => {
  if (!dropdownVisible.value || !hasSuggestions.value) return

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
      if (dropdownVisible.value && hasSuggestions.value) {
        event.preventDefault()
        selectUser(filteredSuggestions.value[selectedIndex.value])
      }
      break

    case 'Escape':
      event.preventDefault()
      showSuggestions.value = false
      break

    case 'Tab':
      if (dropdownVisible.value && hasSuggestions.value) {
        event.preventDefault()
        selectUser(filteredSuggestions.value[selectedIndex.value])
      }
      break
  }
}

const handleFocus = async () => {
  if (searchQuery.value.length === 0) {
    if (contactList.value.length === 0) {
      await fetchContactList()
    }
    searchResults.value = contactList.value.slice(0, 8)
    showSuggestions.value = true
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  showSuggestions.value = false
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus()
    }
  })
}

const scrollToSelected = () => {
  nextTick(() => {
    const el = containerRef.value?.querySelector('.user-suggestion-selected')
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

const handleClickOutside = (event) => {
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    showSuggestions.value = false
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await fetchContactList()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="user-search-container relative">
    <!-- Input row -->
    <div class="flex gap-2">
      <!-- Search Input -->
      <div class="flex-1 relative">
        <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          :placeholder="placeholder"
          class="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-sm transition-all placeholder-gray-400"
          @input="handleInput"
          @keydown="handleKeyDown"
          @focus="handleFocus"
        />
        <!-- Clear / Loading indicator -->
        <button
          v-if="searchQuery && !isSearching"
          @click="clearSearch"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 flex items-center justify-center transition-colors"
        >
          <IconX class="w-3 h-3" />
        </button>
        <IconLoader
          v-else-if="isSearching"
          class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-orange-500"
        />
      </div>

      <!-- Role Input (optional) -->
      <input
        v-if="showRole"
        v-model="roleInput"
        type="text"
        :placeholder="roleLabel"
        class="w-28 sm:w-32 px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-sm transition-all placeholder-gray-400"
      />
    </div>

    <!-- Suggestions Dropdown -->
    <div
      v-if="dropdownVisible"
      class="user-suggestions-dropdown absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
    >
      <!-- Inline search indicator (shown while searching with existing results) -->
      <div v-if="isSearching && hasSuggestions" class="px-3 py-1.5 bg-orange-50/60 border-b border-orange-100 flex items-center gap-2">
        <IconLoader class="w-3 h-3 animate-spin text-orange-500" />
        <span class="text-xs text-orange-600">Searching "{{ searchQuery }}"...</span>
      </div>

      <!-- Suggestions List -->
      <div v-if="hasSuggestions" class="max-h-64 overflow-y-auto">
        <div
          v-for="(user, index) in filteredSuggestions"
          :key="user.pubkey"
          class="user-suggestion flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors"
          :class="{
            'user-suggestion-selected bg-orange-50/80 border-l-2 border-l-orange-400': index === selectedIndex,
            'hover:bg-gray-50 border-l-2 border-l-transparent': index !== selectedIndex
          }"
          @click="selectUser(user)"
          @mouseenter="selectedIndex = index"
        >
          <!-- Avatar with DiceBear fallback -->
          <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-gray-200">
            <img
              :src="getAvatar(user)"
              :alt="formatDisplayName(user)"
              class="w-full h-full object-cover"
              @error="(e) => e.target.src = generateAvatar(user.pubkey)"
            />
          </div>

          <!-- User Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="font-medium text-sm text-gray-900 truncate">
                {{ formatDisplayName(user) }}
              </p>

              <!-- NIP-05 verified -->
              <IconShield
                v-if="user.nip05 || user.isNip05Match"
                class="w-3.5 h-3.5 text-blue-500 flex-shrink-0"
                title="NIP-05 verified"
              />

              <!-- Contact badge -->
              <span v-if="user.isContact" class="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full leading-none font-medium">
                Contact
              </span>
            </div>

            <p v-if="user.nip05" class="text-xs text-gray-400 truncate">
              {{ user.nip05 }}
            </p>
            <p v-else class="text-xs text-gray-400 truncate font-mono">
              {{ user.pubkey.substring(0, 16) }}...
            </p>
          </div>

          <!-- Selected indicator -->
          <IconCheck
            v-if="index === selectedIndex"
            class="w-4 h-4 text-orange-500 flex-shrink-0"
          />
        </div>
      </div>

      <!-- Skeleton Loading (no results yet while searching) -->
      <div v-else-if="isSearching" class="p-2">
        <div v-for="i in 3" :key="i" class="flex items-center gap-3 px-3 py-2.5 animate-pulse">
          <div class="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0"></div>
          <div class="flex-1">
            <div class="h-3.5 bg-gray-200 rounded w-3/4 mb-1.5"></div>
            <div class="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        </div>
      </div>

      <!-- No Results -->
      <div v-else-if="!hasSuggestions && searchQuery.length > 0" class="px-4 py-4 text-center">
        <p class="text-sm text-gray-500">No users found for "{{ searchQuery }}"</p>
        <p class="text-xs text-gray-400 mt-1">Try a different name or paste an npub</p>
      </div>

      <!-- Footer Hint -->
      <div class="border-t border-gray-100 px-3 py-1.5 bg-gray-50/80">
        <p class="text-[10px] text-gray-400">
          <kbd class="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px]">↑↓</kbd> navigate
          <kbd class="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px] ml-1.5">Enter</kbd> select
          <kbd class="px-1 py-0.5 bg-white border border-gray-200 rounded text-[10px] ml-1.5">Esc</kbd> close
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-search-container {
  position: relative;
}

.user-suggestions-dropdown {
  animation: userSearchSlideDown 0.12s ease-out;
}

@keyframes userSearchSlideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-suggestion {
  transition: background-color 0.1s ease;
}

kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
