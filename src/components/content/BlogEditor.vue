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
import { useMentions } from '../../composables/content/useMentions.js'
import MentionInput from './MentionInput.vue'
import MentionRenderer from './MentionRenderer.vue'
import * as nip19 from 'nostr-tools/nip19'
import { fetchProfile } from '../../utils/profile/profileFetcher.js'

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
const mentionInputRef = ref(null)
const previewContainer = ref(null)
const editorContainer = ref(null)
const emojiButton = ref(null)
const showEmojiPicker = ref(false)
const showLinkModal = ref(false)
const showImageModal = ref(false)
const showVideoModal = ref(false)
const linkPreview = ref({
  show: false,
  url: '',
  x: 0,
  y: 0
})

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

// Cache for mention profiles
const mentionProfiles = ref(new Map())

// Handle mention added
const handleMentionAdded = (user) => {
  console.log('Mention added to long-form content:', user)
  // Cache the profile for preview rendering
  if (user.pubkey) {
    mentionProfiles.value.set(user.pubkey, user)
  }
}

// Fetch profile for a pubkey
const fetchMentionProfile = async (pubkey) => {
  if (mentionProfiles.value.has(pubkey)) {
    return mentionProfiles.value.get(pubkey)
  }

  try {
    const profile = await fetchProfile(pubkey)
    if (profile) {
      mentionProfiles.value.set(pubkey, profile)
      return profile
    }
  } catch (error) {
    console.error('Error fetching mention profile:', error)
  }

  return null
}

// Handle mention click in preview
const handleMentionClick = ({ pubkey, profile }) => {
  console.log('Mention clicked:', pubkey, profile)
}

// Watch for content changes and pre-fetch mention profiles
watch(() => props.form.content, async (newContent) => {
  if (!newContent) return

  // Extract all nostr mentions
  const mentionMatches = newContent.match(/nostr:(npub1[a-z0-9]{58,}|nprofile1[a-z0-9]+)/gi)
  if (!mentionMatches) return

  // Fetch profiles for all mentions
  for (const match of mentionMatches) {
    try {
      const identifier = match.replace(/^nostr:/i, '')
      let pubkey

      if (identifier.startsWith('npub1')) {
        const decoded = nip19.decode(identifier)
        pubkey = decoded.data
      } else if (identifier.startsWith('nprofile1')) {
        const decoded = nip19.decode(identifier)
        pubkey = decoded.data.pubkey
      }

      if (pubkey && !mentionProfiles.value.has(pubkey)) {
        await fetchMentionProfile(pubkey)
      }
    } catch (error) {
      console.error('Error pre-fetching mention profile:', error)
    }
  }
}, { immediate: true })

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
      const textarea = getActiveTextarea()
      if (textarea) {
        textarea.focus()
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

// Get the active textarea (either from MentionInput or regular textarea)
const getActiveTextarea = () => {
  if (useMentionInput.value && mentionInputRef.value) {
    // Access the textarea inside MentionInput via $el
    return mentionInputRef.value.$el?.querySelector('textarea')
  }
  return contentTextarea.value
}

// Toolbar functionality
const insertAtCursor = (before, after = '', placeholder = '') => {
  const textarea = getActiveTextarea()
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
  const textarea = getActiveTextarea()
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
  const textarea = getActiveTextarea()
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
  const textarea = getActiveTextarea()
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
  const textarea = getActiveTextarea()
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
  const textarea = getActiveTextarea()

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

// Link preview handlers
const handleLinkHover = (event) => {
  const target = event.target
  if (target.classList.contains('link-with-preview')) {
    const url = target.getAttribute('data-url')
    const rect = target.getBoundingClientRect()
    linkPreview.value = {
      show: true,
      url: url,
      x: rect.left,
      y: rect.bottom + 8
    }
  }
}

const handleLinkLeave = () => {
  linkPreview.value.show = false
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

// Helper function to detect video platform
const getVideoEmbedUrl = (url) => {
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return null
}

// Helper function to check if URL is an image
const isImageUrl = (url) => {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
}

// Helper function to check if URL is a video
const isVideoUrl = (url) => {
  return /\.(mp4|webm|ogg|mov)$/i.test(url) || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')
}

// Parse markdown content to HTML for preview
const parseMarkdown = (content) => {
  if (!content) return ''

  let html = content

  // Store media elements to restore after escaping
  const mediaElements = []
  let mediaIndex = 0

  // Process standalone image URLs (not in markdown syntax) - must be on its own line
  html = html.replace(/^(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg))$/gim, (match, url) => {
    const placeholder = `__MEDIA__${mediaIndex}__`
    mediaElements[mediaIndex] = `<div class="my-6 rounded-lg overflow-hidden shadow-md"><img src="${url}" alt="Image" class="w-full h-auto" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'p-4 bg-gray-100 text-gray-500 text-center\\'>Image failed to load</div>'"/></div>`
    mediaIndex++
    return placeholder
  })

  // Process standalone YouTube/Vimeo URLs (not in markdown syntax) - must be on its own line
  html = html.replace(/^(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)[\w-]+(?:[^\s]*))$/gim, (match, url) => {
    const embedUrl = getVideoEmbedUrl(url)
    if (embedUrl) {
      const placeholder = `__MEDIA__${mediaIndex}__`
      mediaElements[mediaIndex] = `<div class="my-6 aspect-video rounded-lg overflow-hidden shadow-md"><iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
      mediaIndex++
      return placeholder
    }
    return match
  })

  // Process standalone regular URLs (not images/videos, not in markdown syntax) - must be on its own line
  html = html.replace(/^(https?:\/\/[^\s]+)$/gim, (match, url) => {
    // Skip if already processed as image or video
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return match
    if (getVideoEmbedUrl(url)) return match

    // Create clickable link
    return `__AUTOLINK__${url}__ENDAUTOLINK__`
  })

  // Process nostr mentions BEFORE escaping HTML - convert to display format (NIP-21)
  html = html.replace(/nostr:(npub1[a-z0-9]{58,}|nprofile1[a-z0-9]+)/gi, (match, identifier) => {
    return `__MENTION__${identifier}__ENDMENTION__`
  })

  // Process images BEFORE escaping HTML - ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    const placeholder = `__MEDIA__${mediaIndex}__`
    mediaElements[mediaIndex] = `<div class="my-6 rounded-lg overflow-hidden shadow-md"><img src="${url}" alt="${alt}" class="w-full h-auto" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'p-4 bg-gray-100 text-gray-500 text-center\\'>Image failed to load</div>'"/></div>`
    mediaIndex++
    return placeholder
  })

  // Process video embeds and links BEFORE escaping HTML
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const embedUrl = getVideoEmbedUrl(url)

    if (embedUrl) {
      // YouTube/Vimeo embed
      const placeholder = `__MEDIA__${mediaIndex}__`
      mediaElements[mediaIndex] = `<div class="my-6 aspect-video rounded-lg overflow-hidden shadow-md"><iframe src="${embedUrl}" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
      mediaIndex++
      return placeholder
    } else if (isVideoUrl(url)) {
      // Direct video file
      const placeholder = `__MEDIA__${mediaIndex}__`
      mediaElements[mediaIndex] = `<div class="my-6 rounded-lg overflow-hidden shadow-md"><video controls class="w-full h-auto" preload="metadata"><source src="${url}" type="video/mp4"><p class="p-4 bg-gray-100 text-gray-500 text-center">Your browser doesn't support video playback.</p></video></div>`
      mediaIndex++
      return placeholder
    } else {
      // Regular link (escaped later)
      return `__LINK__${text}__URL__${url}__ENDLINK__`
    }
  })

  // Process blockquotes BEFORE escaping HTML - lyric quote style
  html = html.replace(/^> (.+)$/gm, '__QUOTE__$1__ENDQUOTE__')

  // Now escape HTML for text content
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Restore media elements
  mediaElements.forEach((element, index) => {
    html = html.replace(`__MEDIA__${index}__`, element)
  })

  // Restore processed mentions with profile lookup
  html = html.replace(/__MENTION__([^_]+)__ENDMENTION__/g, (match, identifier) => {
    try {
      // identifier could be npub1... or nprofile1...
      let pubkey
      if (identifier.startsWith('npub1')) {
        const decoded = nip19.decode(identifier)
        pubkey = decoded.data
      } else if (identifier.startsWith('nprofile1')) {
        const decoded = nip19.decode(identifier)
        pubkey = decoded.data.pubkey
      }

      // Try to get cached profile
      const profile = pubkey ? mentionProfiles.value.get(pubkey) : null
      const displayName = profile?.name || profile?.display_name || profile?.displayName || `@${identifier.substring(0, 12)}...`

      // Fetch profile in background if not cached
      if (pubkey && !profile) {
        fetchMentionProfile(pubkey)
      }

      return `<span class="inline-flex items-center bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-sm font-medium cursor-pointer hover:bg-orange-200 transition-colors" onclick="window.open('https://primal.net/p/${identifier}', '_blank')" title="${identifier}">@${displayName}</span>`
    } catch (error) {
      console.error('Error processing mention:', error)
      const displayText = identifier.substring(0, 12) + '...'
      return `<span class="inline-flex items-center bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-sm font-medium cursor-pointer hover:bg-orange-200 transition-colors" onclick="window.open('https://primal.net/p/${identifier}', '_blank')">@${displayText}</span>`
    }
  })

  // Restore processed links with hover preview
  html = html.replace(/__LINK__([^_]+)__URL__([^_]+)__ENDLINK__/g, (match, text, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-with-preview text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors font-medium" data-url="${url}">${text}</a>`
  })

  // Restore auto-detected standalone links
  html = html.replace(/__AUTOLINK__([^_]+)__ENDAUTOLINK__/g, (match, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors font-medium break-all">${url}</a>`
  })

  // Process blockquotes - enhanced lyric-style design
  html = html.replace(/(__QUOTE__.*?__ENDQUOTE__)+/g, (match) => {
    const content = match.replace(/__QUOTE__|__ENDQUOTE__/g, '').trim()
    return `<blockquote class="relative border-l-4 border-orange-500 pl-8 pr-8 py-6 my-10 bg-gradient-to-r from-orange-50 via-orange-25 to-transparent rounded-r-2xl shadow-md hover:shadow-lg transition-shadow before:content-['\\201C'] before:absolute before:left-2 before:top-2 before:text-6xl before:text-orange-400 before:font-serif before:leading-none before:opacity-60"><div class="relative text-gray-900 text-xl leading-loose font-medium italic tracking-wide">${content}</div></blockquote>`
  })

  // Parse markdown syntax
  html = html
    // Headers (with anchor-friendly IDs)
    .replace(/^### (.*$)/gm, (match, text) => `<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4 leading-tight">${text}</h3>`)
    .replace(/^## (.*$)/gm, (match, text) => `<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-6 leading-tight">${text}</h2>`)
    .replace(/^# (.*$)/gm, (match, text) => `<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-8 leading-tight">${text}</h1>`)

    // Strikethrough
    .replace(/~~(.*?)~~/g, '<span class="line-through text-gray-600">$1</span>')

    // Bold and italic (process *** before ** and *)
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')

    // Code blocks (triple backticks with language support)
    .replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre class="bg-gray-900 text-gray-100 rounded-lg p-4 my-6 overflow-x-auto"><code class="text-sm font-mono">$2</code></pre>')

    // Inline code - technical style with copy affordance
    .replace(/`([^`]+)`/g, '<code class="bg-gray-900 text-green-400 px-2.5 py-1 rounded-md text-sm font-mono border border-gray-700 shadow-sm inline-block select-all hover:bg-gray-800 transition-colors cursor-text">$1</code>')

  // Lists - process line by line
  const lines = html.split('\n')
  const processed = []
  let inUl = false
  let inOl = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ulMatch = line.match(/^[\s]*[-*+] (.+)$/)
    const olMatch = line.match(/^[\s]*(\d+)\. (.+)$/)

    if (ulMatch) {
      if (!inUl) {
        processed.push('<ul class="list-disc list-inside mb-6 space-y-2 ml-4">')
        inUl = true
      }
      processed.push(`<li class="text-gray-700 leading-relaxed">${ulMatch[1]}</li>`)
    } else if (olMatch) {
      if (!inOl) {
        processed.push('<ol class="list-decimal list-inside mb-6 space-y-2 ml-4">')
        inOl = true
      }
      processed.push(`<li class="text-gray-700 leading-relaxed">${olMatch[2]}</li>`)
    } else {
      if (inUl) {
        processed.push('</ul>')
        inUl = false
      }
      if (inOl) {
        processed.push('</ol>')
        inOl = false
      }
      processed.push(line)
    }
  }

  if (inUl) processed.push('</ul>')
  if (inOl) processed.push('</ol>')

  html = processed.join('\n')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-t-2 border-gray-300 my-8">')

  // Paragraphs - split by double newlines
  const paragraphs = html.split('\n\n')
  html = paragraphs.map(p => {
    // Skip if already wrapped in HTML tag
    if (p.trim().startsWith('<')) return p
    // Skip empty paragraphs
    if (!p.trim()) return ''
    // Wrap in paragraph
    return `<p class="mb-6 text-gray-700 leading-relaxed text-lg">${p.replace(/\n/g, '<br>')}</p>`
  }).join('\n\n')

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

  // Add link preview listeners
  nextTick(() => {
    if (previewContainer.value) {
      previewContainer.value.addEventListener('mouseover', handleLinkHover)
      previewContainer.value.addEventListener('mouseout', handleLinkLeave)
    }
  })
  
  // Auto-resize on mount
  nextTick(() => {
    autoResizeTextarea()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)

  // Remove link preview listeners
  if (previewContainer.value) {
    previewContainer.value.removeEventListener('mouseover', handleLinkHover)
    previewContainer.value.removeEventListener('mouseout', handleLinkLeave)
  }
})

// Computed classes for responsive layout
const editorClasses = computed(() => {
  const base = 'flex-1 min-w-0'
  
  if (viewMode.value === 'edit') return `${base} w-full`
  if (viewMode.value === 'preview') return 'hidden'
  return `${base} lg:w-1/2` // both mode
})

const previewClasses = computed(() => {
  const base = 'flex-1 min-w-0'
  
  if (viewMode.value === 'preview') return `${base} w-full`
  if (viewMode.value === 'edit') return 'hidden'
  return `${base} lg:w-1/2 hidden lg:block` // both mode
})

// Sync scroll between editor and preview
const syncScroll = (source) => {
  if (viewMode.value !== 'both') return
  
  const sourceElement = source === 'editor' ? contentTextarea.value : previewContainer.value
  const targetElement = source === 'editor' ? previewContainer.value : contentTextarea.value
  
  if (sourceElement && targetElement) {
    const scrollPercentage = sourceElement.scrollTop / (sourceElement.scrollHeight - sourceElement.clientHeight)
    targetElement.scrollTop = scrollPercentage * (targetElement.scrollHeight - targetElement.clientHeight)
  }
}
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
      <!-- Editor Panel -->
      <div :class="editorClasses">
        <div class="h-full bg-white overflow-y-auto p-6 lg:p-8">
          <!-- Editor with Mention Support -->
          <div v-if="useMentionInput" class="min-h-full">
            <MentionInput
              ref="mentionInputRef"
              v-model="props.form.content"
              placeholder="Start writing your story... Type @ to mention someone."
              min-height="400px"
              max-height="2000px"
              @mention-added="handleMentionAdded"
            />
          </div>

          <!-- Fallback: Regular Textarea -->
          <textarea
            v-else
            ref="contentTextarea"
            v-model="props.form.content"
            placeholder="Start writing your story..."
            class="w-full min-h-[400px] border-0 resize-none focus:outline-none text-gray-800 leading-relaxed text-base lg:text-lg bg-transparent"
            style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.7;"
            @scroll="syncScroll('editor')"
            @input="autoResizeTextarea"
          ></textarea>
        </div>
      </div>

      <!-- Divider -->
      <div v-if="viewMode === 'both'" class="w-px bg-gray-200 hidden lg:block"></div>

      <!-- Preview Panel -->
      <div :class="previewClasses">
        <div class="h-full bg-gradient-to-b from-white to-gray-50 overflow-y-auto" ref="previewContainer" @scroll="syncScroll('preview')">
          <div class="p-6 lg:p-10 max-w-4xl mx-auto">
            <!-- Cover Image Preview -->
            <div v-if="props.form.coverImage" class="mb-8 -mx-6 lg:-mx-10 rounded-none lg:rounded-xl overflow-hidden shadow-lg">
              <img
                :src="props.form.coverImage"
                alt="Cover image"
                class="w-full h-64 lg:h-96 object-cover"
                @error="(e) => e.target.parentElement.style.display = 'none'"
              />
            </div>

            <!-- Preview Header -->
            <div class="mb-10 pb-8 border-b-2 border-gray-200">
              <h1 class="text-3xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">
                {{ props.form.title || 'Untitled Content' }}
              </h1>
              <p v-if="props.form.description" class="text-xl lg:text-2xl text-gray-600 leading-relaxed font-light">
                {{ props.form.description }}
              </p>

              <!-- Tags Preview -->
              <div v-if="props.form.tags.length > 0" class="flex flex-wrap gap-2 mt-6">
                <span
                  v-for="tag in props.form.tags"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-3 py-1.5 rounded-full text-sm font-medium transition-transform hover:scale-105"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                </span>
              </div>
            </div>

            <!-- Preview Content -->
            <article class="prose prose-lg max-w-none" ref="previewContainer">
              <div v-if="props.form.content" class="content-preview">
                <!-- Render markdown content with mentions handled inline -->
                <div class="markdown-content" v-html="parseMarkdown(props.form.content)"></div>
              </div>
              <div v-else class="text-gray-400 text-center py-20">
                <IconEdit class="w-16 h-16 mx-auto mb-6 opacity-30" />
                <p class="text-xl font-medium mb-2">Start writing your story</p>
                <p class="text-base">Your preview will appear here as you type</p>
                <div class="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-500">
                  <span class="flex items-center space-x-2">
                    <IconBold class="w-4 h-4" />
                    <span>Rich formatting</span>
                  </span>
                  <span class="flex items-center space-x-2">
                    <IconAt class="w-4 h-4" />
                    <span>Mentions</span>
                  </span>
                  <span class="flex items-center space-x-2">
                    <IconPhoto class="w-4 h-4" />
                    <span>Images & Videos</span>
                  </span>
                </div>
              </div>
            </article>

            <!-- Mention Count -->
            <div v-if="mentionCount > 0" class="mt-10 pt-6 border-t-2 border-gray-200">
              <div class="flex items-center space-x-3 text-sm">
                <div class="flex items-center space-x-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full">
                  <IconAt class="w-4 h-4" />
                  <span class="font-semibold">{{ mentionCount }} mention{{ mentionCount !== 1 ? 's' : '' }}</span>
                </div>
                <span class="text-gray-500">Users will be notified when published</span>
              </div>
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

    <!-- Link Preview Tooltip -->
    <Teleport to="body">
      <div
        v-if="linkPreview.show"
        class="link-preview-tooltip fixed z-[10000] bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-xl max-w-md truncate"
        :style="{
          left: linkPreview.x + 'px',
          top: linkPreview.y + 'px'
        }"
      >
        <div class="flex items-center space-x-2">
          <IconLink class="w-4 h-4 flex-shrink-0" />
          <span class="truncate">{{ linkPreview.url }}</span>
        </div>
      </div>
    </Teleport>
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

/* Custom scrollbar for preview */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
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

/* Preview prose styling */
:deep(.prose) {
  max-width: none;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.7;
  color: #374151;
}

/* Content preview enhancements */
:deep(.content-preview) {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Markdown content styling */
:deep(.markdown-content h1) {
  font-size: 2.25rem;
  line-height: 1.2;
  margin-top: 0;
  font-weight: 800;
  color: #111827;
}

:deep(.markdown-content h2) {
  font-size: 1.875rem;
  line-height: 1.3;
  margin-top: 2.5rem;
  margin-bottom: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

:deep(.markdown-content h3) {
  font-size: 1.5rem;
  line-height: 1.4;
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-weight: 600;
  color: #374151;
}

:deep(.markdown-content p) {
  margin-bottom: 1.5rem;
  line-height: 1.8;
  font-size: 1.125rem;
  color: #4b5563;
}

:deep(.markdown-content a) {
  color: #f97316;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  font-weight: 500;
}

:deep(.markdown-content a:hover) {
  border-bottom-color: #f97316;
  color: #ea580c;
}

:deep(.markdown-content code) {
  background-color: #fef3c7;
  color: #92400e;
  padding: 0.2rem 0.4rem;
  border-radius: 0.375rem;
  font-size: 0.9em;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

:deep(.markdown-content pre) {
  background-color: #1f2937;
  border-radius: 0.75rem;
  padding: 1.5rem;
  overflow-x: auto;
  margin: 2rem 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

:deep(.markdown-content pre code) {
  background: none;
  color: #e5e7eb;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1.6;
}

:deep(.markdown-content blockquote) {
  border-left: 4px solid #f97316;
  margin: 2rem 0;
  background: linear-gradient(to right, rgba(249, 115, 22, 0.05), transparent);
  padding: 1.25rem 1.5rem;
  border-radius: 0 0.5rem 0.5rem 0;
  font-style: italic;
  color: #6b7280;
  font-size: 1.0625rem;
}

:deep(.markdown-content ul),
:deep(.markdown-content ol) {
  margin: 1.5rem 0;
  padding-left: 1.5rem;
}

:deep(.markdown-content li) {
  margin-bottom: 0.75rem;
  line-height: 1.7;
  color: #4b5563;
}

:deep(.markdown-content li::marker) {
  color: #f97316;
  font-weight: 600;
}

/* Image styling */
:deep(.markdown-content img) {
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

:deep(.markdown-content img:hover) {
  transform: scale(1.02);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

/* Video/iframe styling */
:deep(.markdown-content iframe),
:deep(.markdown-content video) {
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Horizontal rule */
:deep(.markdown-content hr) {
  margin: 3rem 0;
  border: none;
  border-top: 2px solid #e5e7eb;
}

/* Strikethrough */
:deep(.markdown-content .line-through) {
  text-decoration-thickness: 2px;
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

/* Full height editor for long-form content */
/* MentionInput styling for blog editor */
:deep(.mention-input-container) {
  width: 100%;
}

:deep(.mention-input-container textarea) {
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  line-height: 1.7;
  font-size: 1.125rem;
}

@media (max-width: 1024px) {
  :deep(.mention-input-container textarea) {
    font-size: 1rem;
  }
}

/* Link preview tooltip */
.link-preview-tooltip {
  pointer-events: none;
  animation: tooltipFadeIn 0.15s ease-out;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<style>
/* Global styles for mention dropdown (unscoped since it's teleported to body) */
.mention-suggestions-dropdown {
  z-index: 99999 !important;
}
</style>