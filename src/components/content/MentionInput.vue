<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useMentions } from '../../composables/content/useMentions.js'
import { IconUser, IconCheck, IconLoader } from '@iconify-prerendered/vue-tabler'

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

// Auto-resize functionality
const autoResize = () => {
  const textarea = textareaRef.value
  if (!textarea) return
  
  // Reset height to auto to get the correct scrollHeight
  textarea.style.height = 'auto'
  
  // Calculate new height based on content
  const minHeightPx = parseInt(props.minHeight)
  const maxHeightPx = parseInt(props.maxHeight)
  const newHeight = Math.max(minHeightPx, Math.min(textarea.scrollHeight, maxHeightPx))
  
  // Set the new height
  textarea.style.height = newHeight + 'px'
}

// Computed
const filteredSuggestions = computed(() => {
  return searchResults.value.slice(0, 8) // Limit to 8 suggestions
})

const hasSuggestions = computed(() => {
  return filteredSuggestions.value.length > 0
})

// Methods
const updateValue = (value) => {
  emit('update:modelValue', value)
  // Auto-resize after value update
  nextTick(() => {
    autoResize()
  })
}

const handleInput = async (event) => {
  const value = event.target.value
  cursorPosition.value = event.target.selectionStart
  
  updateValue(value)
  
  // Check if user is typing a mention
  await checkForMention(value, cursorPosition.value)
}

const checkForMention = async (content, cursor) => {
  // Find @ symbol before cursor
  const beforeCursor = content.substring(0, cursor)
  const lastAtIndex = beforeCursor.lastIndexOf('@')
  
  // Check if @ is found and is either at start or preceded by whitespace
  if (lastAtIndex !== -1) {
    const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : ' '
    const isValidMention = /\s/.test(charBeforeAt) || lastAtIndex === 0
    
    if (isValidMention) {
      // Extract query after @
      const query = beforeCursor.substring(lastAtIndex + 1)
      
      // Check if query doesn't contain spaces (mentions can't have spaces)
      if (!query.includes(' ') && query.length >= 0) {
        searchQuery.value = query
        
        if (query.length >= 1) {
          // Search for users
          await searchUsers(query, { debounce: 300 })
          showSuggestions.value = true
          selectedIndex.value = 0
        } else {
          // Show contact list when just @ is typed
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
  
  // Hide suggestions if no valid mention context
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
  searchQuery.value = ''
  
  // Emit mention-added event
  emit('mention-added', user)
  
  // Focus and set cursor position
  await nextTick()
  textareaRef.value.focus()
  textareaRef.value.setSelectionRange(newCursorPosition, newCursorPosition)
  cursorPosition.value = newCursorPosition
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
  }
}

// Lifecycle
onMounted(async () => {
  document.addEventListener('click', handleClickOutside)

  // Pre-fetch contact list for faster suggestions
  await fetchContactList()

  if (props.autoFocus && textareaRef.value) {
    textareaRef.value.focus()
  }

  // Initial auto-resize
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
    // Auto-resize when external value changes
    nextTick(() => {
      autoResize()
    })
  }
})

// Watch for prop changes that might affect sizing
watch([() => props.minHeight, () => props.maxHeight], () => {
  nextTick(() => {
    autoResize()
  })
})

const getSuggestionsPosition = () => {
  if (!textareaRef.value) return {}

  const textarea = textareaRef.value
  const rect = textarea.getBoundingClientRect()

  // Try to position near cursor
  const cursorPosition = textarea.selectionStart
  const textBeforeCursor = textarea.value.substring(0, cursorPosition)
  const lines = textBeforeCursor.split('\n')
  const currentLineIndex = lines.length - 1

  // Estimate position based on line height
  const lineHeight = 28 // approximate line height
  const estimatedTop = rect.top + (currentLineIndex * lineHeight) + lineHeight

  // Check if dropdown would go off bottom of screen
  const dropdownHeight = 320 // max-h-80 = 320px
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
        v-if="showSuggestions && (hasSuggestions || isSearching)"
        class="mention-suggestions-dropdown fixed bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-[10000]"
        :style="getSuggestionsPosition()"
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
        <div v-else class="max-h-80 overflow-y-auto">
          <div
            v-for="(user, index) in filteredSuggestions"
            :key="user.pubkey"
            class="mention-suggestion flex items-center space-x-3 p-3 cursor-pointer transition-colors"
            :class="{
              'mention-suggestion-selected bg-orange-50': index === selectedIndex,
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
                <p class="font-medium text-gray-900 truncate">
                  {{ formatDisplayName(user) }}
                </p>
                
                <!-- Badges -->
                <span v-if="user.isContact" class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Contact
                </span>
                <span v-if="user.isDirectMatch" class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Exact
                </span>
              </div>
              
              <p v-if="user.nip05" class="text-sm text-gray-500 truncate">
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
    </Teleport>
  </div>
</template>

<style scoped>
.mention-input-container {
  position: relative;
}

.mention-suggestions-dropdown {
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
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
