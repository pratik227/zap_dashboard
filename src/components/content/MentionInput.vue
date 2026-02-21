<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMentions } from '../../composables/content/useMentions.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'
import { IconUser, IconLoader, IconShield } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Type @ to mention someone...'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  minHeight: {
    type: String,
    default: '200px'
  },
  maxHeight: {
    type: String,
    default: '600px'
  },
  autoFocus: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'mention-added'])

const {
  isSearching,
  searchResults,
  contactList,
  searchUsers,
  fetchContactList,
  insertMention,
  formatDisplayName
} = useMentions()

// Component state
const textareaRef = ref(null)
const showSuggestions = ref(false)
const selectedIndex = ref(0)
const searchQuery = ref('')
const cursorPosition = ref(0)
const mentionActive = ref(false) // tracks whether we're in a mention context

// Auto-resize functionality
const autoResize = () => {
  const textarea = textareaRef.value
  if (!textarea) return

  textarea.style.height = 'auto'
  const minHeightPx = parseInt(props.minHeight)
  const maxHeightPx = parseInt(props.maxHeight)
  const newHeight = Math.max(minHeightPx, Math.min(textarea.scrollHeight, maxHeightPx))
  textarea.style.height = newHeight + 'px'
}

// Computed
const filteredSuggestions = computed(() => {
  return searchResults.value.slice(0, 8)
})

const hasSuggestions = computed(() => {
  return filteredSuggestions.value.length > 0
})

// Keep dropdown open while mention is active (searching or has results)
const dropdownVisible = computed(() => {
  return showSuggestions.value && (hasSuggestions.value || isSearching.value)
})

// Get avatar for a user — DiceBear fallback
const getAvatar = (user) => {
  return user.picture || generateAvatar(user.pubkey)
}

// Methods
const updateValue = (value) => {
  emit('update:modelValue', value)
  nextTick(() => {
    autoResize()
  })
}

const handleInput = async (event) => {
  const value = event.target.value
  cursorPosition.value = event.target.selectionStart

  updateValue(value)
  await checkForMention(value, cursorPosition.value)
}

const checkForMention = async (content, cursor) => {
  const beforeCursor = content.substring(0, cursor)
  const lastAtIndex = beforeCursor.lastIndexOf('@')

  if (lastAtIndex !== -1) {
    const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : ' '
    const isValidMention = /\s/.test(charBeforeAt) || lastAtIndex === 0

    if (isValidMention) {
      const query = beforeCursor.substring(lastAtIndex + 1)

      if (!query.includes(' ') && query.length >= 0) {
        searchQuery.value = query
        mentionActive.value = true

        if (query.length >= 1) {
          // Show dropdown immediately — isSearching set by useMentions debounce
          showSuggestions.value = true
          await searchUsers(query, { debounce: 300 })
          selectedIndex.value = 0
        } else {
          if (contactList.value.length === 0) {
            await fetchContactList()
          }
          searchResults.value = contactList.value.slice(0, 8)
          showSuggestions.value = true
          selectedIndex.value = 0
        }
        return
      }
    }
  }

  mentionActive.value = false
  showSuggestions.value = false
}

const selectUser = async (user) => {
  if (!textareaRef.value) return

  const { newContent, newCursorPosition } = insertMention(
    props.modelValue,
    cursorPosition.value,
    user
  )

  updateValue(newContent)
  showSuggestions.value = false
  mentionActive.value = false
  searchQuery.value = ''

  emit('mention-added', user)

  await nextTick()
  textareaRef.value.focus()
  textareaRef.value.setSelectionRange(newCursorPosition, newCursorPosition)
  cursorPosition.value = newCursorPosition
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
      mentionActive.value = false
      break

    case 'Tab':
      if (dropdownVisible.value && hasSuggestions.value) {
        event.preventDefault()
        selectUser(filteredSuggestions.value[selectedIndex.value])
      }
      break
  }
}

const handleClick = (event) => {
  cursorPosition.value = event.target.selectionStart
  checkForMention(props.modelValue, cursorPosition.value)
}

const scrollToSelected = () => {
  nextTick(() => {
    const selectedElement = document.querySelector('.mention-suggestion-selected')
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  })
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.mention-input-container')) {
    showSuggestions.value = false
    mentionActive.value = false
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  await fetchContactList()

  if (props.autoFocus && textareaRef.value) {
    textareaRef.value.focus()
  }

  nextTick(() => {
    autoResize()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
  if (textareaRef.value && textareaRef.value.value !== newValue) {
    textareaRef.value.value = newValue
    nextTick(() => {
      autoResize()
    })
  }
})

watch([() => props.minHeight, () => props.maxHeight], () => {
  nextTick(() => {
    autoResize()
  })
})

const getSuggestionsPosition = () => {
  if (!textareaRef.value) return {}

  const textarea = textareaRef.value
  const rect = textarea.getBoundingClientRect()

  const cp = textarea.selectionStart
  const textBeforeCursor = textarea.value.substring(0, cp)
  const lines = textBeforeCursor.split('\n')
  const currentLineIndex = lines.length - 1

  const lineHeight = 28
  const estimatedTop = rect.top + (currentLineIndex * lineHeight) + lineHeight

  const dropdownHeight = 320
  const spaceBelow = window.innerHeight - estimatedTop
  const shouldPositionAbove = spaceBelow < dropdownHeight && estimatedTop > dropdownHeight

  const top = shouldPositionAbove
    ? `${estimatedTop - dropdownHeight - 8}px`
    : `${estimatedTop + 8}px`

  return {
    top,
    left: `${rect.left + 8}px`,
    width: `${Math.min(rect.width - 16, 400)}px`
  }
}
</script>

<template>
  <div class="mention-input-container relative">
    <!-- Textarea -->
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full border-0 resize-none focus:ring-0 focus:outline-none text-gray-800 placeholder-gray-400 bg-transparent overflow-y-auto leading-relaxed text-base lg:text-lg"
      :style="{
        minHeight: minHeight,
        maxHeight: maxHeight,
        height: 'auto',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        lineHeight: '1.7'
      }"
      @input="handleInput"
      @keydown="handleKeyDown"
      @click="handleClick"
    ></textarea>

    <!-- Suggestions Dropdown -->
    <Teleport to="body">
      <div
        v-if="dropdownVisible"
        class="mention-suggestions-dropdown fixed bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-[10000]"
        :style="getSuggestionsPosition()"
      >
        <!-- Suggestions List -->
        <div v-if="hasSuggestions" class="max-h-80 overflow-y-auto">
          <!-- Inline searching indicator -->
          <div v-if="isSearching" class="px-3 py-1.5 bg-orange-50/60 border-b border-orange-100 flex items-center space-x-2">
            <IconLoader class="w-3.5 h-3.5 animate-spin text-orange-500" />
            <span class="text-xs text-orange-600">Searching "{{ searchQuery }}"...</span>
          </div>

          <div
            v-for="(user, index) in filteredSuggestions"
            :key="user.pubkey"
            class="mention-suggestion flex items-center space-x-3 px-3 py-2.5 cursor-pointer transition-colors"
            :class="{
              'mention-suggestion-selected bg-orange-50/80 border-l-2 border-l-orange-400': index === selectedIndex,
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
              <div class="flex items-center space-x-1.5">
                <p class="font-medium text-sm text-gray-900 truncate">
                  {{ formatDisplayName(user) }}
                </p>

                <!-- NIP-05 verified indicator -->
                <IconShield
                  v-if="user.nip05 || user.isNip05Match"
                  class="w-3.5 h-3.5 text-blue-500 flex-shrink-0"
                  title="NIP-05 verified"
                />

                <!-- Contact pill -->
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
          </div>
        </div>

        <!-- Loading (no results yet) -->
        <div v-else-if="isSearching" class="px-4 py-3 flex items-center space-x-3">
          <IconLoader class="w-4 h-4 animate-spin text-orange-500 flex-shrink-0" />
          <span class="text-sm text-gray-500">Searching for "{{ searchQuery }}"...</span>
        </div>

        <!-- No Results -->
        <div v-else-if="!hasSuggestions && searchQuery.length > 0" class="px-4 py-3">
          <p class="text-sm text-gray-500">No users found for "{{ searchQuery }}"</p>
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
    </Teleport>
  </div>
</template>

<style scoped>
.mention-input-container {
  position: relative;
}

.mention-suggestions-dropdown {
  animation: mentionSlideDown 0.12s ease-out;
}

@keyframes mentionSlideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mention-suggestion {
  transition: background-color 0.1s ease;
}

kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
