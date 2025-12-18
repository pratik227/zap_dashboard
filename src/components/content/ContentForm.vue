<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import {
  IconDeviceFloppy,
  IconEye,
  IconX,
  IconLoader,
  IconAlertCircle,
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconCode,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconLink,
  IconPhoto,
  IconVideo,
  IconQuote,
  IconMinus,
  IconBolt,
  IconHash,
  IconCheck,
  IconPlus
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'save-draft', 'cancel'])

// Refs for editor functionality
const contentTextarea = ref(null)
const emojiButton = ref(null)
const showEmojiPicker = ref(false)
const showLinkModal = ref(false)
const showImageModal = ref(false)
const showVideoModal = ref(false)

// Modal form data
const linkForm = ref({ url: '', text: '' })
const imageForm = ref({ url: '', alt: '' })
const videoForm = ref({ url: '', title: '' })

// Form validation
const isFormValid = computed(() => {
  return props.form.title?.trim() && props.form.content?.trim()
})

const emojiPickerStyle = computed(() => {
  if (!emojiButton.value) return { display: 'none' }
  
  const rect = emojiButton.value.getBoundingClientRect()
  return {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
  }
})

// Add tag functionality
const newTag = ref('')
const addTag = () => {
  if (newTag.value.trim() && !props.form.tags.includes(newTag.value.trim())) {
    props.form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  props.form.tags.splice(index, 1)
}

// Toolbar functionality
const insertAtCursor = (before, after = '', placeholder = '') => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = props.form.content.substring(start, end)
  
  let insertText
  if (selectedText) {
    insertText = before + selectedText + after
  } else {
    insertText = before + placeholder + after
  }
  
  const newContent = props.form.content.substring(0, start) + insertText + props.form.content.substring(end)
  props.form.content = newContent
  
  // Set cursor position
  nextTick(() => {
    const newCursorPos = selectedText ? start + insertText.length : start + before.length + placeholder.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

const insertAtNewLine = (text) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const beforeCursor = props.form.content.substring(0, start)
  const afterCursor = props.form.content.substring(start)
  
  // Add newlines if needed
  const needsNewlineBefore = beforeCursor && !beforeCursor.endsWith('\n')
  const needsNewlineAfter = afterCursor && !afterCursor.startsWith('\n')
  
  const insertText = (needsNewlineBefore ? '\n' : '') + text + (needsNewlineAfter ? '\n' : '')
  
  props.form.content = beforeCursor + insertText + afterCursor
  
  nextTick(() => {
    const newCursorPos = start + insertText.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// Formatting functions
const makeBold = () => insertAtCursor('**', '**', 'bold text')
const makeItalic = () => insertAtCursor('*', '*', 'italic text')
const makeStrikethrough = () => insertAtCursor('~~', '~~', 'strikethrough text')
const makeInlineCode = () => insertAtCursor('`', '`', 'code')

const insertHeader = (level) => {
  const hashes = '#'.repeat(level)
  insertAtNewLine(`${hashes} Heading ${level}`)
}

const insertBulletList = () => insertAtNewLine('- List item')
const insertNumberedList = () => insertAtNewLine('1. List item')
const insertQuote = () => insertAtNewLine('> Quote text')
const insertCodeBlock = () => insertAtNewLine('```\ncode block\n```')
const insertHorizontalRule = () => insertAtNewLine('---')
const insertLightningBolt = () => insertAtCursor('⚡', '', '')

// Modal handlers
const openLinkModal = () => {
  linkForm.value = { url: '', text: '' }
  showLinkModal.value = true
}

const insertLink = () => {
  if (linkForm.value.url.trim()) {
    const linkText = linkForm.value.text.trim() || linkForm.value.url
    insertAtCursor(`[${linkText}](${linkForm.value.url})`)
    showLinkModal.value = false
  }
}

const openImageModal = () => {
  imageForm.value = { url: '', alt: '' }
  showImageModal.value = true
}

const insertImage = () => {
  if (imageForm.value.url.trim()) {
    const altText = imageForm.value.alt.trim() || 'Image'
    insertAtNewLine(`![${altText}](${imageForm.value.url})`)
    showImageModal.value = false
  }
}

const openVideoModal = () => {
  videoForm.value = { url: '', title: '' }
  showVideoModal.value = true
}

const insertVideo = () => {
  if (videoForm.value.url.trim()) {
    const title = videoForm.value.title.trim() || 'Video'
    insertAtNewLine(`[${title}](${videoForm.value.url})`)
    showVideoModal.value = false
  }
}

// Emoji picker
const handleEmojiSelect = (emoji) => {
  const textarea = contentTextarea.value
  
  if (textarea) {
    const cursorPos = textarea.selectionStart
    const textBefore = props.form.content.substring(0, cursorPos)
    const textAfter = props.form.content.substring(textarea.selectionEnd)
    
    // Update content with emoji
    props.form.content = textBefore + emoji.i + textAfter
    
    // Reset emoji picker state
    showEmojiPicker.value = false
    
    // Focus back on textarea and set cursor position after the emoji
    nextTick(() => {
      textarea.focus()
      const newCursorPos = cursorPos + emoji.i.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  }
}

// Keyboard shortcuts
const handleKeydown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'b':
        event.preventDefault()
        makeBold()
        break
      case 'i':
        event.preventDefault()
        makeItalic()
        break
    }
  }
}

// Close modals when clicking outside
const handleClickOutside = (event) => {
  if (showEmojiPicker.value && !event.target.closest('.emoji-picker-container')) {
    showEmojiPicker.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Content Creation Form -->
    <div class="bg-white/95 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-lg overflow-hidden">
      <!-- Header -->
      <div class="p-6 border-b border-orange-100/50 bg-gradient-to-r from-purple-50 to-pink-50">
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          {{ isEditing ? 'Edit Content' : 'Create New Content' }}
        </h2>
        <p class="text-gray-600 text-sm">
          {{ isEditing ? 'Update your content and republish to Nostr' : 'Write and publish long-form content to the Nostr network' }}
        </p>
      </div>

      <!-- Form Content -->
      <div class="p-6 space-y-6">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="Enter your content title..."
            class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base transition-all duration-200"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            v-model="form.description"
            placeholder="Brief description or summary..."
            rows="2"
            class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base transition-all duration-200 resize-none"
          ></textarea>
        </div>

        <!-- Cover Image -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Cover Image URL (Optional)</label>
          <input
            v-model="form.coverImage"
            type="url"
            placeholder="https://example.com/image.jpg"
            class="w-full px-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base transition-all duration-200"
          />
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div class="space-y-3">
            <!-- Add Tag Input -->
            <div class="flex space-x-2">
              <input
                v-model="newTag"
                type="text"
                placeholder="Add a tag..."
                class="flex-1 px-4 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm"
                @keyup.enter="addTag"
              />
              <button
                @click="addTag"
                type="button"
                class="btn-secondary"
              >
                <IconPlus class="w-4 h-4" />
                Add
              </button>
            </div>
            
            <!-- Tags Display -->
            <div v-if="form.tags.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="(tag, index) in form.tags"
                :key="index"
                class="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 px-3 py-2 rounded-full text-sm font-medium shadow-sm"
              >
                <IconHash class="w-3 h-3" />
                <span>{{ tag }}</span>
                <button
                  @click="removeTag(index)"
                  type="button"
                  class="text-orange-600 hover:text-orange-800 transition-colors"
                >
                  <IconX class="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>
        </div>

        <!-- Enhanced Content Editor with Markdown Toolbar -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Content</label>
          
          <!-- Markdown Toolbar -->
          <div class="border border-orange-200/50 rounded-t-lg bg-gray-50/80 backdrop-blur-sm p-2 flex flex-wrap items-center gap-1">
            <!-- Text Formatting Group -->
            <div class="flex items-center space-x-1">
              <button
                @click="makeBold"
                type="button"
                class="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 group"
                title="Bold (Ctrl+B)"
              >
                <IconBold class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="makeItalic"
                type="button"
                class="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 group"
                title="Italic (Ctrl+I)"
              >
                <IconItalic class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="makeStrikethrough"
                type="button"
                class="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 group"
                title="Strikethrough"
              >
                <IconStrikethrough class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="makeInlineCode"
                type="button"
                class="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200 group"
                title="Inline Code"
              >
                <IconCode class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <!-- Separator -->
            <div class="h-6 w-px bg-gray-300 mx-1"></div>

            <!-- Headers Group -->
            <div class="flex items-center space-x-1">
              <button
                @click="insertHeader(1)"
                type="button"
                class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 group"
                title="Heading 1"
              >
                <IconH1 class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="insertHeader(2)"
                type="button"
                class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 group"
                title="Heading 2"
              >
                <IconH2 class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="insertHeader(3)"
                type="button"
                class="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 group"
                title="Heading 3"
              >
                <IconH3 class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <!-- Separator -->
            <div class="h-6 w-px bg-gray-300 mx-1"></div>

            <!-- Lists Group -->
            <div class="flex items-center space-x-1">
              <button
                @click="insertBulletList"
                type="button"
                class="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 group"
                title="Bullet List"
              >
                <IconList class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="insertNumberedList"
                type="button"
                class="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all duration-200 group"
                title="Numbered List"
              >
                <IconListNumbers class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <!-- Separator -->
            <div class="h-6 w-px bg-gray-300 mx-1"></div>

            <!-- Media & Links Group -->
            <div class="flex items-center space-x-1">
              <button
                @click="openLinkModal"
                type="button"
                class="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200 group"
                title="Insert Link"
              >
                <IconLink class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="openImageModal"
                type="button"
                class="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200 group"
                title="Insert Image"
              >
                <IconPhoto class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="openVideoModal"
                type="button"
                class="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200 group"
                title="Insert Video"
              >
                <IconVideo class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <!-- Separator -->
            <div class="h-6 w-px bg-gray-300 mx-1"></div>

            <!-- Special Elements Group -->
            <div class="flex items-center space-x-1">
              <button
                @click="insertQuote"
                type="button"
                class="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 group"
                title="Quote"
              >
                <IconQuote class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="insertCodeBlock"
                type="button"
                class="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 group"
                title="Code Block"
              >
                <IconCode class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
              <button
                @click="insertHorizontalRule"
                type="button"
                class="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-200 group"
                title="Horizontal Rule"
              >
                <IconMinus class="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
            </div>

            <!-- Separator -->
            <div class="h-6 w-px bg-gray-300 mx-1"></div>

            <!-- Emoji & Special -->
            <div class="flex items-center space-x-1">
              <div class="relative emoji-picker-container">
                <button
                  ref="emojiButton"
                  @click="showEmojiPicker = !showEmojiPicker"
                  type="button"
                  class="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-100/50 rounded transition-colors flex items-center space-x-1"
                  title="Insert Emoji"
                >
                  <span class="text-xl leading-none">😊</span>
                  <span class="text-sm">Emoji</span>
                </button>

                <Teleport to="body">
                  <div v-if="showEmojiPicker" 
                       class="fixed z-[9999] shadow-xl rounded-lg bg-white"
                       :style="emojiPickerStyle"
                       style="z-index: 9999;">
                    <EmojiPicker @select="handleEmojiSelect" :native="true" />
                  </div>
                </Teleport>
              </div>

              <button
                @click="insertLightningBolt"
                type="button"
                class="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-all duration-200 group"
                title="Lightning Bolt"
              >
                <IconBolt class="w-4 h-4 text-yellow-500 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>

          <!-- Content Textarea -->
          <textarea
            ref="contentTextarea"
            v-model="form.content"
            @keydown="handleKeydown"
            placeholder="Write your content here using Markdown formatting...

Examples:
# Heading 1
## Heading 2
**Bold text**
*Italic text*
[Link text](https://example.com)
)
![Image alt](https://example.com/image.jpg)
)

Use the toolbar above for easy formatting!"
            rows="20"
            class="w-full px-4 py-4 border-x border-b border-orange-200/50 rounded-b-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-base transition-all duration-200 resize-none font-mono leading-relaxed"
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-orange-100/50">
          <button
            @click="emit('cancel')"
            type="button"
            class="btn-secondary w-full sm:w-auto"
          >
            Cancel
          </button>
          
          <button
            @click="emit('save-draft')"
            type="button"
            class="btn-secondary w-full sm:w-auto"
          >
            <IconDeviceFloppy class="w-4 h-4" />
            Save Draft
          </button>
          
          <button
            @click="emit('submit')"
            :disabled="!isFormValid || isLoading"
            type="button"
            class="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
            <IconEye v-else class="w-4 h-4" />
            {{ isLoading ? 'Publishing...' : (isEditing ? 'Update Content' : 'Publish Content') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Link Modal -->
    <div v-if="showLinkModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showLinkModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconLink class="w-5 h-5 text-purple-600" />
              <span>Insert Link</span>
            </h3>
            <button
              @click="showLinkModal = false"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">URL</label>
              <input
                v-model="linkForm.url"
                type="url"
                placeholder="https://example.com"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                @keyup.enter="insertLink"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Link Text</label>
              <input
                v-model="linkForm.text"
                type="text"
                placeholder="Link description"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                @keyup.enter="insertLink"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button
                @click="showLinkModal = false"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="insertLink"
                :disabled="!linkForm.url.trim()"
                class="btn-primary disabled:opacity-50"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Modal -->
    <div v-if="showImageModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showImageModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconPhoto class="w-5 h-5 text-purple-600" />
              <span>Insert Image</span>
            </h3>
            <button
              @click="showImageModal = false"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
              <input
                v-model="imageForm.url"
                type="url"
                placeholder="https://example.com/image.jpg"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                @keyup.enter="insertImage"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Alt Text</label>
              <input
                v-model="imageForm.alt"
                type="text"
                placeholder="Describe the image"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                @keyup.enter="insertImage"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button
                @click="showImageModal = false"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="insertImage"
                :disabled="!imageForm.url.trim()"
                class="btn-primary disabled:opacity-50"
              >
                Insert Image
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Video Modal -->
    <div v-if="showVideoModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showVideoModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-purple-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconVideo class="w-5 h-5 text-purple-600" />
              <span>Insert Video</span>
            </h3>
            <button
              @click="showVideoModal = false"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <IconX class="w-5 h-5" />
            </button>
          </div>
          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Video URL</label>
              <input
                v-model="videoForm.url"
                type="url"
                placeholder="https://example.com/video.mp4"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                @keyup.enter="insertVideo"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Video Title</label>
              <input
                v-model="videoForm.title"
                type="text"
                placeholder="Video description"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                @keyup.enter="insertVideo"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button
                @click="showVideoModal = false"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="insertVideo"
                :disabled="!videoForm.url.trim()"
                class="btn-primary disabled:opacity-50"
              >
                Insert Video
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure proper spacing and alignment */
.emoji-picker-container {
  position: relative;
}

/* Toolbar responsive behavior */
@media (max-width: 640px) {
  .flex-wrap {
    flex-wrap: wrap;
  }
  
  .gap-1 {
    gap: 0.25rem;
  }
}

/* Enhanced button hover effects */
button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* Textarea focus enhancement */
textarea:focus {
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.1);
}

/* Smooth transitions for all interactive elements */
* {
  transition-property: color, background-color, border-color, transform, box-shadow;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Emoji picker styling */
:deep(.v3-emoji-picker) {
  --ep-color-bg: #ffffff;
  --ep-color-sbg: #f5f5f5;
  --ep-color-border: #e0e0e0;
  --ep-color-selected: #fb923c;
  --ep-color-hover: #fff7ed;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--ep-color-border);
  border-radius: 0.75rem;
  max-height: 350px;
}

/* Responsive font sizing */
@media (max-width: 640px) {
  .text-base {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>
