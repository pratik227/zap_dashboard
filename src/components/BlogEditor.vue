<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import {
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
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
  IconPlus,
  IconColumns,
  IconMaximize,
  IconEdit,
  IconArrowLeft,
  IconSettings,
  IconAt,
  IconUser
} from '@iconify-prerendered/vue-tabler'
import { useMentions } from '../composables/useMentions.js'
import MentionInput from './MentionInput.vue'
import MentionRenderer from './MentionRenderer.vue'

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

// Use mentions composable
const { parseMentions, extractPTags } = useMentions()

// Editor state
const viewMode = ref('both') // 'edit', 'preview', 'both'
const focusMode = ref(false)
const showToolbar = ref(true)
const showMetadata = ref(true)
const useMentionInput = ref(true) // Toggle for mention support

// Refs for editor functionality
const contentTextarea = ref(null)
const previewContainer = ref(null)
const editorContainer = ref(null)
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

// Mention count
const mentionCount = computed(() => {
  return parseMentions(props.form.content || '').length
})

// Handle mention added
const handleMentionAdded = (user) => {
  console.log('Mention added to long-form content:', user)
}

// Handle mention click in preview
const handleMentionClick = ({ pubkey, profile }) => {
  console.log('Mention clicked:', pubkey, profile)
}

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

// View mode controls
const setViewMode = (mode) => {
  viewMode.value = mode
  
  // Auto-focus editor when switching to edit mode
  if (mode === 'edit' || mode === 'both') {
    nextTick(() => {
      if (contentTextarea.value) {
        contentTextarea.value.focus()
      }
    })
  }
}

const toggleFocusMode = () => {
  focusMode.value = !focusMode.value
  showToolbar.value = !focusMode.value
  
  if (focusMode.value) {
    viewMode.value = 'edit'
  }
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

// Enhanced formatting functions with proper toggle behavior
const toggleInlineFormat = (marker, placeholder) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = props.form.content.substring(start, end)
  
  if (!selectedText) {
    // No selection - insert placeholder with markers
    insertAtCursor(marker, marker, placeholder)
    return
  }
  
  // Check if selected text is already formatted
  const beforeSelection = props.form.content.substring(Math.max(0, start - marker.length), start)
  const afterSelection = props.form.content.substring(end, end + marker.length)
  
  const isAlreadyFormatted = beforeSelection === marker && afterSelection === marker
  
  if (isAlreadyFormatted) {
    // Remove formatting (toggle off)
    const newStart = start - marker.length
    const newEnd = end + marker.length
    const newContent = props.form.content.substring(0, newStart) + 
                      selectedText + 
                      props.form.content.substring(newEnd)
    
    props.form.content = newContent
    
    nextTick(() => {
      textarea.focus()
      textarea.setSelectionRange(newStart, newStart + selectedText.length)
    })
  } else {
    // Add formatting (toggle on)
    const newContent = props.form.content.substring(0, start) + 
                      marker + selectedText + marker + 
                      props.form.content.substring(end)
    
    props.form.content = newContent
    
    nextTick(() => {
      textarea.focus()
      textarea.setSelectionRange(start + marker.length, start + marker.length + selectedText.length)
    })
  }
}

const toggleBlockFormat = (prefix, placeholder) => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  if (start === end) {
    // No selection - insert at new line
    insertAtNewLine(`${prefix} ${placeholder}`)
    return
  }
  
  // Get selected text and split into lines
  const selectedText = props.form.content.substring(start, end)
  const lines = selectedText.split('\n')
  
  // Check if all lines are already formatted
  const allFormatted = lines.every(line => line.trim().startsWith(prefix + ' '))
  
  let newLines
  if (allFormatted) {
    // Remove formatting from all lines (toggle off)
    newLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed.startsWith(prefix + ' ')) {
        const withoutPrefix = trimmed.substring(prefix.length + 1)
        // Preserve original indentation
        const leadingSpaces = line.match(/^(\s*)/)[1]
        return leadingSpaces + withoutPrefix
      }
      return line
    })
  } else {
    // Add formatting to all lines (toggle on)
    newLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith(prefix + ' ')) {
        // Preserve original indentation
        const leadingSpaces = line.match(/^(\s*)/)[1]
        return leadingSpaces + prefix + ' ' + trimmed
      }
      return line
    })
  }
  
  const newSelectedText = newLines.join('\n')
  const newContent = props.form.content.substring(0, start) + 
                    newSelectedText + 
                    props.form.content.substring(end)
  
  props.form.content = newContent
  
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start, start + newSelectedText.length)
  })
}

// Updated formatting functions with toggle behavior
const makeBoldToggle = () => toggleInlineFormat('**', 'bold text')
const makeItalicToggle = () => toggleInlineFormat('*', 'italic text')
const makeStrikethroughToggle = () => toggleInlineFormat('~~', 'strikethrough text')
const makeInlineCodeToggle = () => toggleInlineFormat('`', 'code')

const insertHeaderToggle = (level) => {
  const prefix = '#'.repeat(level)
  toggleBlockFormat(prefix, `Heading ${level}`)
}

const insertBulletListToggle = () => toggleBlockFormat('-', 'List item')
const insertNumberedListToggle = () => {
  const textarea = contentTextarea.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  if (start === end) {
    // No selection - insert at new line
    insertAtNewLine('1. List item')
    return
  }
  
  // Get selected text and split into lines
  const selectedText = props.form.content.substring(start, end)
  const lines = selectedText.split('\n')
  
  // Check if all lines are already formatted as numbered list
  const allFormatted = lines.every(line => /^\s*\d+\.\s/.test(line.trim()))
  
  let newLines
  if (allFormatted) {
    // Remove numbering from all lines (toggle off)
    newLines = lines.map(line => {
      const leadingSpaces = line.match(/^(\s*)/)[1]
      const withoutNumber = line.replace(/^\s*\d+\.\s/, '')
      return leadingSpaces + withoutNumber
    })
  } else {
    // Add numbering to all lines (toggle on)
    let counter = 1
    newLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed && !/^\d+\.\s/.test(trimmed)) {
        const leadingSpaces = line.match(/^(\s*)/)[1]
        return leadingSpaces + `${counter++}. ` + trimmed
      }
      return line
    })
  }
  
  const newSelectedText = newLines.join('\n')
  const newContent = props.form.content.substring(0, start) + 
                    newSelectedText + 
                    props.form.content.substring(end)
  
  props.form.content = newContent
  
  nextTick(() => {
    textarea.focus()
    textarea.setSelectionRange(start, start + newSelectedText.length)
  })
}

const insertQuoteToggle = () => toggleBlockFormat('>', 'Quote text')

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
        makeBoldToggle()
        break
      case 'i':
        event.preventDefault()
        makeItalicToggle()
        break
      case 'Enter':
        if (event.shiftKey) {
          event.preventDefault()
          emit('save-draft')
        }
        break
    }
  }
  
  // Toggle focus mode with F11
  if (event.key === 'F11') {
    event.preventDefault()
    toggleFocusMode()
  }
  
  // Toggle preview with Ctrl/Cmd + P
  if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
    event.preventDefault()
    setViewMode(viewMode.value === 'both' ? 'edit' : 'both')
  }
}

// Enhanced markdown parser with media support
const parseMarkdown = (content) => {
  if (!content) return ''

  // Store code blocks and inline code to protect them from processing
  const codeBlocks = []
  const inlineCodes = []

  let html = content

  // Extract and protect code blocks
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length
    codeBlocks.push(code)
    return `__CODE_BLOCK_${index}__`
  })

  // Extract and protect inline code
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const index = inlineCodes.length
    inlineCodes.push(code)
    return `__INLINE_CODE_${index}__`
  })

  // Now escape HTML (after extracting code)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Process images (before links to avoid conflicts)
  // Format: ![alt text](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const cleanUrl = url.trim()
    return `<div class="my-6"><img src="${cleanUrl}" alt="${alt || 'Image'}" class="rounded-lg shadow-md max-w-full h-auto" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center\'><svg class=\'w-12 h-12 mx-auto mb-2 text-gray-400\' fill=\'none\' stroke=\'currentColor\' viewBox=\'0 0 24 24\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\'></path></svg><p class=\'text-gray-500 text-sm\'>Image failed to load</p><p class=\'text-gray-400 text-xs mt-1 break-all\'>${cleanUrl}</p></div>'" /></div>`
  })

  // Process video embeds for YouTube, Vimeo, and direct video URLs
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const cleanUrl = url.trim()

    // YouTube embed
    const youtubeMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      return `<div class="my-6 aspect-video rounded-lg overflow-hidden shadow-lg"><iframe src="https://www.youtube.com/embed/${videoId}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
    }

    // Vimeo embed
    const vimeoMatch = cleanUrl.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) {
      const videoId = vimeoMatch[1]
      return `<div class="my-6 aspect-video rounded-lg overflow-hidden shadow-lg"><iframe src="https://player.vimeo.com/video/${videoId}" class="w-full h-full" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`
    }

    // Direct video files
    if (/\.(mp4|webm|ogg)$/i.test(cleanUrl)) {
      return `<div class="my-6"><video controls class="w-full rounded-lg shadow-lg"><source src="${cleanUrl}" type="video/${cleanUrl.split('.').pop()}">Your browser does not support the video tag.</video></div>`
    }

    // Regular link with enhanced styling
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors font-medium">${text}<svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`
  })

  // Headers (process in reverse order to avoid conflicts)
  html = html.replace(/^#### (.*$)/gm, '<h4 class="text-lg font-bold text-gray-900 mt-6 mb-3 leading-tight">$1</h4>')
  html = html.replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4 leading-tight">$1</h3>')
  html = html.replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-6 leading-tight">$1</h2>')
  html = html.replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-8 leading-tight">$1</h1>')

  // Bold, italic, and strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del class="text-gray-500 line-through">$1</del>')
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
  html = html.replace(/__(.*?)__/g, '<strong class="font-bold text-gray-900">$1</strong>')
  html = html.replace(/_(.*?)_/g, '<em class="italic text-gray-700">$1</em>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-orange-400 pl-4 py-2 my-4 bg-orange-50/50 italic text-gray-700">$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-t-2 border-gray-200 my-8">')
  html = html.replace(/^\*\*\*$/gm, '<hr class="border-t-2 border-gray-200 my-8">')

  // Lists (unordered)
  html = html.replace(/^[\s]*[-*+] (.+)$/gm, (match, item) => {
    return `<li class="ml-6 mb-2 text-gray-700 relative before:content-['•'] before:absolute before:-ml-4 before:text-orange-500 before:font-bold">${item}</li>`
  })

  // Lists (ordered)
  let listCounter = 0
  html = html.replace(/^[\s]*(\d+)\. (.+)$/gm, (match, num, item) => {
    return `<li class="ml-6 mb-2 text-gray-700" style="list-style-type: decimal;">${item}</li>`
  })

  // Restore code blocks with syntax highlighting
  html = html.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
    const code = codeBlocks[index]
    // Detect language (optional)
    const lines = code.split('\n')
    let language = ''
    let codeContent = code

    if (lines[0] && /^[a-z]+$/i.test(lines[0].trim())) {
      language = lines[0].trim()
      codeContent = lines.slice(1).join('\n')
    }

    return `<div class="my-6"><pre class="bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 rounded-lg p-4 overflow-x-auto shadow-lg"><code class="text-sm font-mono leading-relaxed">${codeContent}</code></pre>${language ? `<div class="text-xs text-gray-500 mt-1 text-right">${language}</div>` : ''}</div>`
  })

  // Restore inline code
  html = html.replace(/__INLINE_CODE_(\d+)__/g, (match, index) => {
    return `<code class="bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded text-sm font-mono">${inlineCodes[index]}</code>`
  })

  // Process paragraphs (split by double newlines)
  const blocks = html.split(/\n\n+/)
  html = blocks.map(block => {
    // Skip if already a block element
    if (/^<(h[1-6]|div|pre|blockquote|ul|ol|hr|li)/.test(block.trim())) {
      return block
    }
    // Single line breaks within paragraphs
    const content = block.replace(/\n/g, '<br>')
    return `<p class="mb-4 text-gray-700 leading-relaxed">${content}</p>`
  }).join('\n')

  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/((?:<li class="ml-6 mb-2 text-gray-700[^>]*>.*?<\/li>\s*)+)/gs, (match) => {
    if (match.includes('list-style-type: decimal')) {
      return `<ol class="list-decimal mb-4 space-y-1">${match}</ol>`
    }
    return `<ul class="mb-4 space-y-1">${match}</ul>`
  })

  return html
}

// Auto-resize textarea
const autoResizeTextarea = () => {
  const textarea = contentTextarea.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = Math.max(textarea.scrollHeight, 400) + 'px'
  }
}

// Watch content changes for auto-resize
watch(() => props.form.content, () => {
  nextTick(() => {
    autoResizeTextarea()
  })
})

// Close modals when clicking outside
const handleClickOutside = (event) => {
  if (showEmojiPicker.value && !event.target.closest('.emoji-picker-container')) {
    showEmojiPicker.value = false
  }
}

// Keyboard shortcuts
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  
  // Auto-resize on mount
  nextTick(() => {
    autoResizeTextarea()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})

// Refs for both mode container
const bothContainer = ref(null)
</script>

<template>
  <div class="h-screen bg-gray-50 flex flex-col overflow-hidden">
    <!-- Minimal Header -->
    <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <!-- Left: Back and Title -->
      <div class="flex items-center space-x-4">
        <button
          @click="emit('cancel')"
          class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
          title="Back to content list"
        >
          <IconArrowLeft class="w-5 h-5" />
        </button>
        
        <div class="hidden sm:block">
          <h1 class="text-lg font-semibold text-gray-900">
            {{ isEditing ? 'Edit Content' : 'Create New Content' }}
          </h1>
        </div>
      </div>

      <!-- Center: View Mode Controls -->
      <div class="flex items-center bg-gray-100 rounded-lg p-1">
        <button
          @click="setViewMode('edit')"
          :class="[
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-1',
            viewMode === 'edit' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600 hover:text-gray-800'
          ]"
        >
          <IconEdit class="w-4 h-4" />
          <span class="hidden sm:inline">Edit</span>
        </button>
        
        <button
          @click="setViewMode('both')"
          :class="[
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 items-center space-x-1 hidden lg:flex',
            viewMode === 'both' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600 hover:text-gray-800'
          ]"
        >
          <IconColumns class="w-4 h-4" />
          <span>Both</span>
        </button>
        
        <button
          @click="setViewMode('preview')"
          :class="[
            'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center space-x-1',
            viewMode === 'preview' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600 hover:text-gray-800'
          ]"
        >
          <IconEye class="w-4 h-4" />
          <span class="hidden sm:inline">Preview</span>
        </button>
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center space-x-2">
        <!-- Focus Mode Toggle -->
        <button
          @click="toggleFocusMode"
          :class="[
            'p-2 rounded-lg transition-all duration-200 hidden lg:block',
            focusMode ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          ]"
          title="Focus mode (F11)"
        >
          <IconMaximize class="w-4 h-4" />
        </button>
        
        <!-- Metadata Toggle -->
       <button
          @click="showMetadata = !showMetadata"
          :class="[
            'p-2 rounded-lg transition-all duration-200',
            showMetadata ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          ]"
          title="Show metadata"
        >
          <IconSettings class="w-4 h-4" />
        </button>
        
        <!-- Save Draft -->
        <button
          @click="emit('save-draft')"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-200 text-sm inline-flex items-center"
        >
          <IconDeviceFloppy class="w-4 h-4 mr-1" />
          <span class="hidden sm:inline">Draft</span>
        </button>
        
        <!-- Publish -->
        <button
          @click="emit('submit')"
          :disabled="!isFormValid || isLoading"
          class="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center"
        >
          <IconLoader v-if="isLoading" class="w-4 h-4 mr-1 animate-spin" />
          <IconBolt v-else class="w-4 h-4 mr-1" />
          <span class="hidden sm:inline">{{ isLoading ? 'Publishing...' : 'Publish' }}</span>
        </button>
      </div>
    </div>

    <!-- Metadata Panel (Collapsible) -->
    <transition name="slide-down">
      <div v-if="showMetadata" class="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              v-model="props.form.title"
              type="text"
              placeholder="Enter title..."
              class="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              v-model="props.form.description"
              type="text"
              placeholder="Brief description..."
              class="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <!-- Cover Image URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
            <input
              v-model="props.form.coverImage"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="w-full px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:bg-white transition-all duration-200 text-sm"
            />
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div class="flex space-x-2">
              <input
                v-model="newTag"
                type="text"
                placeholder="Add tag..."
                class="flex-1 px-3 py-2 border-0 bg-gray-50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:bg-white transition-all duration-200 text-sm"
                @keyup.enter="addTag"
              />
              <button
                @click="addTag"
                class="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm"
              >
                <IconPlus class="w-4 h-4" />
              </button>
            </div>
            
            <!-- Tags Display -->
            <div v-if="props.form.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
              <span
                v-for="(tag, index) in props.form.tags"
                :key="index"
                class="inline-flex items-center space-x-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs"
              >
                <IconHash class="w-3 h-3" />
                <span>{{ tag }}</span>
                <button
                  @click="removeTag(index)"
                  class="text-orange-600 hover:text-orange-800 transition-colors"
                >
                  <IconX class="w-3 h-3" />
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toolbar (Collapsible) -->
    <transition name="slide-down">
      <div v-if="showToolbar && !focusMode" class="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
        <div class="flex items-center justify-between">
          <!-- Formatting Tools -->
          <div class="flex items-center space-x-1">
            <!-- Text Formatting -->
            <div class="flex items-center space-x-0.5">
              <button @click="makeBoldToggle" class="toolbar-btn" title="Bold (Ctrl+B) - Toggle">
                <IconBold class="w-4 h-4" />
              </button>
              <button @click="makeItalicToggle" class="toolbar-btn" title="Italic (Ctrl+I) - Toggle">
                <IconItalic class="w-4 h-4" />
              </button>
              <button @click="makeStrikethroughToggle" class="toolbar-btn" title="Strikethrough - Toggle">
                <IconStrikethrough class="w-4 h-4" />
              </button>
              <button @click="makeInlineCodeToggle" class="toolbar-btn" title="Inline Code - Toggle">
                <IconCode class="w-4 h-4" />
              </button>
            </div>

            <div class="h-6 w-px bg-gray-300 mx-2"></div>

            <!-- Headers -->
            <div class="flex items-center space-x-0.5">
              <button @click="insertHeaderToggle(1)" class="toolbar-btn" title="Heading 1 - Toggle">
                <IconH1 class="w-4 h-4" />
              </button>
              <button @click="insertHeaderToggle(2)" class="toolbar-btn" title="Heading 2 - Toggle">
                <IconH2 class="w-4 h-4" />
              </button>
              <button @click="insertHeaderToggle(3)" class="toolbar-btn" title="Heading 3 - Toggle">
                <IconH3 class="w-4 h-4" />
              </button>
            </div>

            <div class="h-6 w-px bg-gray-300 mx-2"></div>

            <!-- Lists and Elements -->
            <div class="flex items-center space-x-0.5">
              <button @click="insertBulletListToggle" class="toolbar-btn" title="Bullet List - Toggle">
                <IconList class="w-4 h-4" />
              </button>
              <button @click="insertNumberedListToggle" class="toolbar-btn" title="Numbered List - Toggle">
                <IconListNumbers class="w-4 h-4" />
              </button>
              <button @click="insertQuoteToggle" class="toolbar-btn" title="Quote - Toggle">
                <IconQuote class="w-4 h-4" />
              </button>
              <button @click="openLinkModal" class="toolbar-btn" title="Insert Link">
                <IconLink class="w-4 h-4" />
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
          </div>

          <!-- Right Side Tools -->
          <div class="flex items-center space-x-1">
            <button @click="insertLightningBolt" class="toolbar-btn" title="Lightning Bolt">
              <IconBolt class="w-4 h-4 text-yellow-500" />
            </button>
            
            <!-- Emoji Picker -->
            <div class="relative emoji-picker-container">
              <button
                ref="emojiButton"
                @click="showEmojiPicker = !showEmojiPicker"
                class="toolbar-btn"
                title="Insert Emoji"
              >
                <span class="text-lg leading-none">😊</span>
              </button>

              <!-- Emoji Picker positioned relative to button -->
              <div v-if="showEmojiPicker" 
                   class="absolute top-full right-0 mt-2 z-[9999] shadow-xl rounded-lg bg-white border border-gray-200">
                <EmojiPicker @select="handleEmojiSelect" :native="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Main Editor Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Shared Scroll Container for Both Mode -->
      <div v-if="viewMode === 'both'" class="hidden lg:flex flex-1 overflow-y-auto" ref="bothContainer">
        <!-- Editor Panel -->
        <div class="flex-1 min-w-0 bg-white">
          <div class="p-6 lg:p-8 min-h-full">
            <!-- Editor with Mention Support -->
            <div v-if="useMentionInput" class="min-h-full">
              <MentionInput
                v-model="props.form.content"
                placeholder="Start writing your story... Type @ to mention someone.

# Your Amazing Title

Write your content here using Markdown. The preview will update in real-time.

**Bold text** and *italic text* are supported.

- Create lists
- Add links
- Include images
- Mention users with @

> Use quotes for emphasis

```
Code blocks work too
```

Focus on your content - everything else fades away."
                min-height="calc(100vh - 350px)"
                max-height="none"
                class="w-full text-gray-800 leading-relaxed text-base lg:text-lg"
                style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7;"
                @mention-added="handleMentionAdded"
              />
            </div>

            <!-- Fallback: Regular Textarea -->
            <textarea
              v-else
              ref="contentTextarea"
              v-model="props.form.content"
              placeholder="Start writing your story..."
              class="w-full border-0 resize-none focus:outline-none text-gray-800 leading-relaxed text-base lg:text-lg bg-transparent"
              style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7; min-height: calc(100vh - 350px);"
              @input="autoResizeTextarea"
            ></textarea>
          </div>
        </div>

        <!-- Divider -->
        <div class="w-px bg-gray-200 flex-shrink-0"></div>

        <!-- Preview Panel -->
        <div class="flex-1 min-w-0 bg-white">
          <div class="p-6 lg:p-8 min-h-full">
            <!-- Preview Header -->
            <div class="mb-8 pb-6 border-b border-gray-200">
              <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                {{ props.form.title || 'Untitled Content' }}
              </h1>
              <p v-if="props.form.description" class="text-xl text-gray-600 leading-relaxed">
                {{ props.form.description }}
              </p>

              <!-- Tags Preview -->
              <div v-if="props.form.tags.length > 0" class="flex flex-wrap gap-2 mt-4">
                <span
                  v-for="tag in props.form.tags"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                </span>
              </div>
            </div>

            <!-- Preview Content -->
            <div class="prose prose-lg max-w-none">
              <div v-if="props.form.content" v-html="parseMarkdown(props.form.content)"></div>
              <div v-else class="text-gray-400 italic text-center py-12">
                Start writing to see your content preview...
              </div>
            </div>

            <!-- Mention Count -->
            <div v-if="mentionCount > 0" class="mt-6 pt-4 border-t border-gray-200">
              <div class="flex items-center space-x-2 text-sm text-gray-600">
                <IconAt class="w-4 h-4 text-orange-500" />
                <span class="font-medium text-orange-600">{{ mentionCount }} mention{{ mentionCount !== 1 ? 's' : '' }}</span>
                <span class="text-gray-400">•</span>
                <span class="text-gray-500">Users will be notified</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Only Mode -->
      <div v-else-if="viewMode === 'edit'" class="flex-1 min-w-0 bg-white overflow-y-auto">
        <div class="p-6 lg:p-8">
          <!-- Editor with Mention Support -->
          <div v-if="useMentionInput">
            <MentionInput
              v-model="props.form.content"
              placeholder="Start writing your story... Type @ to mention someone.

# Your Amazing Title

Write your content here using Markdown. The preview will update in real-time.

**Bold text** and *italic text* are supported.

- Create lists
- Add links
- Include images
- Mention users with @

> Use quotes for emphasis

```
Code blocks work too
```

Focus on your content - everything else fades away."
              min-height="calc(100vh - 350px)"
              max-height="none"
              class="w-full text-gray-800 leading-relaxed text-base lg:text-lg"
              style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7;"
              @mention-added="handleMentionAdded"
            />
          </div>

          <!-- Fallback: Regular Textarea -->
          <textarea
            v-else
            ref="contentTextarea"
            v-model="props.form.content"
            placeholder="Start writing your story..."
            class="w-full border-0 resize-none focus:outline-none text-gray-800 leading-relaxed text-base lg:text-lg bg-transparent"
            style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7; min-height: calc(100vh - 350px);"
            @input="autoResizeTextarea"
          ></textarea>
        </div>
      </div>

      <!-- Preview Only Mode -->
      <div v-else-if="viewMode === 'preview'" class="flex-1 min-w-0 bg-white overflow-y-auto">
        <div class="p-6 lg:p-8">
          <!-- Preview Header -->
          <div class="mb-8 pb-6 border-b border-gray-200">
            <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">
              {{ props.form.title || 'Untitled Content' }}
            </h1>
            <p v-if="props.form.description" class="text-xl text-gray-600 leading-relaxed">
              {{ props.form.description }}
            </p>

            <!-- Tags Preview -->
            <div v-if="props.form.tags.length > 0" class="flex flex-wrap gap-2 mt-4">
              <span
                v-for="tag in props.form.tags"
                :key="tag"
                class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
              >
                <IconHash class="w-3 h-3" />
                <span>{{ tag }}</span>
              </span>
            </div>
          </div>

          <!-- Preview Content -->
          <div class="prose prose-lg max-w-none">
            <div v-if="props.form.content" v-html="parseMarkdown(props.form.content)"></div>
            <div v-else class="text-gray-400 italic text-center py-12">
              Start writing to see your content preview...
            </div>
          </div>

          <!-- Mention Count -->
          <div v-if="mentionCount > 0" class="mt-6 pt-4 border-t border-gray-200">
            <div class="flex items-center space-x-2 text-sm text-gray-600">
              <IconAt class="w-4 h-4 text-orange-500" />
              <span class="font-medium text-orange-600">{{ mentionCount }} mention{{ mentionCount !== 1 ? 's' : '' }}</span>
              <span class="text-gray-400">•</span>
              <span class="text-gray-500">Users will be notified</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile View Mode Switcher -->
    <div class="lg:hidden bg-white border-t border-gray-200 p-3 flex justify-center">
      <div class="flex items-center bg-gray-100 rounded-lg p-1">
        <button
          @click="setViewMode('edit')"
          :class="[
            'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
            viewMode === 'edit' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'
          ]"
        >
          Edit
        </button>
        <button
          @click="setViewMode('preview')"
          :class="[
            'px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
            viewMode === 'preview' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-600'
          ]"
        >
          Preview
        </button>
      </div>
    </div>

    <!-- Link Modal -->
    <div v-if="showLinkModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showLinkModal = false"></div>
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Insert Link</h3>
            <button @click="showLinkModal = false" class="text-gray-400 hover:text-gray-600">
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
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                @keyup.enter="insertLink"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Link Text</label>
              <input
                v-model="linkForm.text"
                type="text"
                placeholder="Link description"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                @keyup.enter="insertLink"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button @click="showLinkModal = false" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                @click="insertLink"
                :disabled="!linkForm.url.trim()"
                class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
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
          <div class="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Insert Image</h3>
            <button @click="showImageModal = false" class="text-gray-400 hover:text-gray-600">
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
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                @keyup.enter="insertImage"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Alt Text</label>
              <input
                v-model="imageForm.alt"
                type="text"
                placeholder="Describe the image"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                @keyup.enter="insertImage"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button @click="showImageModal = false" class="px-4 py-2 text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                @click="insertImage"
                :disabled="!imageForm.url.trim()"
                class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
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
          <div class="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900">Insert Video</h3>
            <button @click="showVideoModal = false" class="text-gray-400 hover:text-gray-600">
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
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                @keyup.enter="insertVideo"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Video Title</label>
              <input
                v-model="videoForm.title"
                type="text"
                placeholder="Video description"
                class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                @keyup.enter="insertVideo"
              />
            </div>
            <div class="flex justify-end space-x-3">
              <button
                @click="showVideoModal = false"
                class="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                @click="insertVideo"
                :disabled="!videoForm.url.trim()"
                class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
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
/* Toolbar button styles */
.toolbar-btn {
  @apply p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all duration-200;
}

.toolbar-btn:hover {
  transform: translateY(-1px);
}

/* Slide down animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
  overflow: hidden;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 200px;
}

/* Custom scrollbar for editor and preview */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f9fafb;
  border-left: 1px solid #e5e7eb;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.4);
  border-radius: 4px;
  border: 2px solid #f9fafb;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.6);
}

/* Focus mode styles */
.focus-mode {
  background: #fafafa;
}

/* Typography for editor */
textarea {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  letter-spacing: 0.01em;
}

/* Responsive typography */
@media (max-width: 1024px) {
  textarea {
    font-size: 16px; /* Prevent zoom on iOS */
    line-height: 1.6;
  }
}

/* Enhanced preview prose styling */
:deep(.prose) {
  max-width: none;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: #374151;
}

:deep(.prose h1) {
  font-size: 2.25rem;
  line-height: 1.2;
  margin-top: 0;
  font-weight: 800;
  letter-spacing: -0.025em;
}

:deep(.prose h2) {
  font-size: 1.875rem;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.02em;
}

:deep(.prose h3) {
  font-size: 1.5rem;
  line-height: 1.4;
  font-weight: 700;
  letter-spacing: -0.015em;
}

:deep(.prose h4) {
  font-size: 1.25rem;
  line-height: 1.5;
  font-weight: 600;
}

:deep(.prose p) {
  margin-bottom: 1.5rem;
  line-height: 1.7;
}

:deep(.prose a) {
  color: #f97316;
  text-decoration: none;
  transition: all 0.2s ease;
}

:deep(.prose a:hover) {
  color: #ea580c;
}

:deep(.prose img) {
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin: 1.5rem 0;
  max-width: 100%;
  height: auto;
}

:deep(.prose video) {
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin: 1.5rem 0;
  max-width: 100%;
}

:deep(.prose iframe) {
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin: 1.5rem 0;
}

:deep(.prose code) {
  background-color: #fff7ed;
  color: #ea580c;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.875em;
  border: 1px solid #fed7aa;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Fira Mono', monospace;
}

:deep(.prose pre) {
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  color: #f3f4f6;
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  margin: 1.5rem 0;
}

:deep(.prose pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  border: none;
  font-size: 0.875em;
  line-height: 1.7;
}

:deep(.prose blockquote) {
  border-left: 4px solid #f97316;
  padding-left: 1rem;
  margin: 1.5rem 0;
  background-color: rgba(249, 115, 22, 0.05);
  padding: 1rem;
  border-radius: 0.5rem;
  font-style: italic;
}

:deep(.prose ul) {
  padding-left: 0;
  margin-bottom: 1.5rem;
  list-style: none;
}

:deep(.prose ol) {
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
  list-style-type: decimal;
}

:deep(.prose li) {
  margin-bottom: 0.5rem;
  padding-left: 0.5rem;
}

:deep(.prose hr) {
  border-top: 2px solid #e5e7eb;
  margin: 2rem 0;
}

:deep(.prose del) {
  text-decoration: line-through;
  color: #9ca3af;
}

:deep(.prose strong) {
  font-weight: 700;
  color: #111827;
}

:deep(.prose em) {
  font-style: italic;
  color: #4b5563;
}

/* Aspect ratio container for videos */
:deep(.prose .aspect-video) {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  overflow: hidden;
}

:deep(.prose .aspect-video iframe) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
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
  position: relative;
  z-index: 9999;
}

/* Mobile optimizations */
@media (max-width: 1024px) {
  .toolbar-btn {
    @apply p-3; /* Larger touch targets */
  }
  
  textarea {
    padding: 1rem;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Smooth transitions */
* {
  transition-property: color, background-color, border-color, transform, box-shadow;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}
</style>