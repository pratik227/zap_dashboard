<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import * as nip19 from 'nostr-tools/nip19'
import {
  IconFileText, 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconArrowLeft, 
  IconSend,
  IconLoader,
  IconAlertCircle,
  IconUser,
  IconBolt,
  IconHash,
  IconCalendar,
  IconEye,
  IconUsers,
  IconAlertTriangle,
  IconPhoto,
  IconVideo, 
  IconX,
  IconExternalLink,
  IconChevronDown,
  IconCopy,
  IconCheck,
  IconCode,
  IconShare,
  IconHeart,
  IconRepeat,
  IconBookmark,
  IconDots,
  IconChevronUp,
  IconMessageCircle
} from '@iconify-prerendered/vue-tabler'
import { useNostrNotes } from '../composables/useNostrNotes.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useContentZaps } from '../composables/useContentZaps.js'
import { useEngagementMetrics } from '../composables/useEngagementMetrics.js'
import { useBtcPrice } from '../composables/useBtcPrice.js'
import { generateFallbackAvatar } from '../composables/useContentZaps.js'
import EngagementMetrics from '../components/EngagementMetrics.vue'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

const {
  notes,
  noteForm,
  currentView,
  selectedNote,
  editingNote,
  isLoading,
  error,
  publishNote,
  updateNote,
  deleteNote,
  cleanup,
  debugState,
  removeNoteFromLocalState,
  cleanupDuplicateNotes,
  setView,
  viewNote,
  editNote,
  createNewNote,
  formatDate
} = useNostrNotes()

// Use content zaps composable to track zaps on notes
const { 
  startZapTracking, 
  getZapsForContent, 
  getTotalZapAmount,
  getZapCount,
  getAllContentZaps
} = useContentZaps()

const {
  startEngagementTracking,
  getEngagementCounts,
  cleanup: cleanupEngagement
} = useEngagementMetrics()

// Use BTC price composable
const { satsToUSD, formatUSD } = useBtcPrice()

// UI State
const showViewModal = ref(false)
const showMediaUrlInput = ref(false)
const showVideoUrlInput = ref(false)
const showEmojiPicker = ref(false)
const showClientDropdown = ref(false)
const showRawDataModal = ref(false)
const showZapperModal = ref(false)
const mediaUrl = ref('')
const noteTextarea = ref(null)
const dropdownRef = ref(null)
const copySuccess = ref('')
const selectedZapper = ref(null)

// Enhanced computed properties
const noteStats = computed(() => {
  const totalZapRevenue = notes.value.reduce((sum, note) => {
    return sum + getTotalZapAmount(note.id)
  }, 0)
  
  const totalLikes = notes.value.reduce((sum, note) => {
    return sum + getEngagementCounts(note.id).likes
  }, 0)
  
  const totalReposts = notes.value.reduce((sum, note) => {
    return sum + getEngagementCounts(note.id).reposts
  }, 0)
  
  const totalBookmarks = notes.value.reduce((sum, note) => {
    return sum + getEngagementCounts(note.id).bookmarks
  }, 0)
  
  const totalZapCount = notes.value.reduce((sum, note) => {
    return sum + getZapCount(note.id)
  }, 0)
  
  const totalEngagement = totalLikes + totalReposts + totalBookmarks
  
  return {
    total: notes.value.length,
    thisWeek: notes.value.filter(note => {
      const noteDate = new Date(note.created_at * 1000)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return noteDate > weekAgo
    }).length,
    totalZapRevenue,
    totalLikes,
    totalReposts,
    totalBookmarks,
    totalZapCount,
    totalEngagement
  }
})

// Calculate total zap revenue in USD
const revenueInUSD = computed(() => {
  return formatUSD(satsToUSD(noteStats.value.totalZapRevenue))
})

// Enhanced note display data
const enhancedSelectedNote = computed(() => {
  if (!selectedNote.value) return null
  
  const note = selectedNote.value
  const zapData = getZapsForContent(note.id)
  const engagementData = getEngagementCounts(note.id)
  const totalZaps = getTotalZapAmount(note.id)
  const zapCount = getZapCount(note.id)
  
  return {
    ...note,
    zapData,
    engagementData,
    totalZaps,
    zapCount,
    formattedDate: formatDate(note.created_at),
    timeAgo: getTimeAgo(note.created_at),
    wordCount: note.content.split(/\s+/).length,
    readTime: Math.ceil(note.content.split(/\s+/).length / 200)
  }
})

// Handle form submission
const handleSubmit = async () => {
  if (!noteForm.content.trim()) return
  
  try {
    if (editingNote.value) {
      await updateNote(editingNote.value.id, noteForm.content, noteForm.tags)
    } else {
      await publishNote(noteForm.content, noteForm.tags)
    }
    
    // Reset form and go back to list
    noteForm.content = ''
    setView('list')
  } catch (err) {
    console.error('Failed to save note:', err)
  }
}

// Handle note deletion
const handleDelete = async (note) => {
  if (confirm(`Are you sure you want to delete "${note.title}"?`)) {
    try {
      await deleteNote(note.id)
      if (currentView.value === 'view' && selectedNote.value?.id === note.id) {
        setView('list')
      }
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }
}

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Set up editor content when editing
const startEditing = (note) => {
  editNote(note)
  noteForm.content = note.content
}

const startCreating = () => {
  createNewNote()
  noteForm.content = ''
}

// Open detailed view
const openDetailedView = (note) => {
  selectedNote.value = note
  showViewModal.value = true
}

// Close detailed view
const closeDetailedView = () => {
  showViewModal.value = false
  selectedNote.value = null
  showRawDataModal.value = false
  showZapperModal.value = false
  selectedZapper.value = null
}

// Form validation
const isFormValid = computed(() => {
  return noteForm.content.trim().length > 0
})

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

// Get URL for different Nostr clients
const getNostrClientUrl = (client, noteId) => {
  if (!noteId) return '#'
  
  try {
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${noteId}`
      case 'yakihonne':
        return `https://yakihonne.com/${nip19.neventEncode({ id: noteId })}`
      case 'highlighter':
        return `https://highlighter.com/a/note1${nip19.noteEncode(noteId)}`
      default:
        return `https://primal.net/e/${noteId}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

// Format zap amount for display
const formatZapAmount = (amount) => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toString()
}

// Format zapper pubkey for display
const formatZapperPubkey = (pubkey) => {
  if (!pubkey) return 'Anonymous'
  return pubkey.substring(0, 8) + '...' + pubkey.substring(pubkey.length - 8)
}

// Format zap timestamp
const formatZapTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

// Get time ago for notes
const getTimeAgo = (timestamp) => {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return date.toLocaleDateString()
}

// Copy to clipboard
const copyToClipboard = async (text, type = 'text') => {
  try {
    await navigator.clipboard.writeText(text)
    copySuccess.value = type
    setTimeout(() => {
      copySuccess.value = ''
    }, 2000)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

// Show raw data modal
const showRawData = () => {
  showRawDataModal.value = true
}

// Show zapper details
const showZapperDetails = (zapper) => {
  selectedZapper.value = zapper
  showZapperModal.value = true
}

// Insert media URL at cursor position
const insertMediaUrl = (type) => {
  let url = mediaUrl.value.trim();
  if (!url) {
    showMediaUrlInput.value = false
    showVideoUrlInput.value = false
    return
  }
  
  // Validate image URL if it's an image
  if (type === 'image' && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    alert('Please enter a valid image URL (ending with .jpg, .jpeg, .png, .gif, or .webp)');
    return;
  }
  
  const textarea = noteTextarea.value
  
  if (textarea) {
    const cursorPos = textarea.selectionStart
    const textBefore = noteForm.content.substring(0, cursorPos)
    const textAfter = noteForm.content.substring(textarea.selectionEnd)
    
    // Just insert the raw URL with line breaks
    const mediaText = `\n${url}\n`
    
    // Update content
    noteForm.content = textBefore + mediaText + textAfter
    
    // Reset and close
    mediaUrl.value = ''
    showMediaUrlInput.value = false
    showVideoUrlInput.value = false
    
    // Focus back on textarea
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = cursorPos + mediaText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
  }
}

// Handle emoji selection
const handleEmojiSelect = (emoji) => {
  const textarea = noteTextarea.value
  
  if (textarea) {
    const cursorPos = textarea.selectionStart
    const textBefore = noteForm.content.substring(0, cursorPos)
    const textAfter = noteForm.content.substring(textarea.selectionEnd)
    
    // Update content with emoji
    noteForm.content = textBefore + emoji.i + textAfter
    
    // Reset emoji picker state
    showEmojiPicker.value = false
    
    // Focus back on textarea and set cursor position after the emoji
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = cursorPos + emoji.i.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // Expose debug function globally for console access
  window.debugNotes = debugState
  
  // Start tracking zaps and engagement for all notes
  if (isAuthenticated.value) {
    if (notes.value.length > 0) {
      notes.value.forEach(note => {
        startZapTracking(note.id)
        startEngagementTracking(note.id)
      })
    }
    
    setTimeout(() => {
      if (notes.value.length > 0) {
        notes.value.forEach(note => {
          startZapTracking(note.id)
          startEngagementTracking(note.id)
        })
      }
    }, 1000)
  }
})

// Watch for notes changes to track zaps and engagement on new notes
watch(notes, (newNotes) => {
  if (isAuthenticated.value && newNotes.length > 0) {
    newNotes.forEach(note => {
      startZapTracking(note.id)
      startEngagementTracking(note.id)
    })
  }
}, { deep: true })

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  cleanup()
  cleanupEngagement()
  delete window.debugNotes
})

// Format raw event as clean JSON
const formatRawEvent = (note) => {
  if (!note) return ''
  
  // Create a clean event object with proper ordering
  const cleanEvent = {
    id: note.id,
    pubkey: note.pubkey,
    created_at: note.created_at,
    kind: note.kind,
    tags: note.tags || [],
    content: note.content,
    sig: note.sig
  }
  
  // Return formatted JSON with proper indentation
  return JSON.stringify(cleanEvent, null, 2)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Authentication Required Banner -->
    <div v-if="!isAuthenticated" class="bg-gradient-to-r from-purple-400 to-pink-400 text-white p-6 rounded-xl shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-start space-x-4">
          <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <IconUser class="w-6 h-6" />
          </div>
          <div>
            <h2 class="text-xl font-bold mb-2">Nostr Login Required</h2>
            <p class="text-purple-100 text-sm">
              Connect your Nostr identity to create and manage your notes on the decentralized network.
              Your notes will be stored on Nostr relays, not on our servers.
            </p>
          </div>
        </div>
        <button
          @click="handleNostrLogin"
          class="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 whitespace-nowrap"
        >
          <IconBolt class="w-4 h-4" />
          <span>Connect with Nostr</span>
        </button>
      </div>
    </div>

    <!-- Authenticated Content -->
    <div v-else>
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center space-x-3 mb-4">
          <button
            v-if="currentView !== 'list'"
            @click="setView('list')"
            class="btn-secondary"
          >
            <IconArrowLeft class="w-4 h-4" />
            Back to Notes
          </button>
          <div v-if="currentView === 'list'" class="flex space-x-2">
            <button
              @click="setView('create')"
              class="btn-primary"
            >
              <IconPlus class="w-4 h-4" />
              New Note
            </button>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center space-x-2">
          <IconAlertCircle class="w-5 h-5 text-red-600" />
          <p class="text-red-600">{{ error }}</p>
        </div>
      </div>

      <!-- Notes List View -->
      <div v-if="currentView === 'list'">
        <!-- Enhanced Stats Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Total Zap Revenue Card -->
          <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6 rounded-xl shadow-lg">
            <div class="flex flex-col">
              <p class="text-orange-100 text-sm mb-1">Total Revenue</p>
              <p class="text-3xl font-bold mb-1">{{ noteStats.totalZapRevenue.toLocaleString() }} sats</p>
              <p class="text-orange-100 text-xs">≈ {{ revenueInUSD }} USD</p>
            </div>
            <div class="flex justify-end">
              <IconBolt class="w-8 h-8 text-orange-200" />
            </div>
          </div>
          
          <!-- Total Notes Card -->
          <div class="bg-white p-6 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex flex-col">
              <p class="text-gray-600 text-sm mb-1">Total Notes</p>
              <p class="text-3xl font-bold text-gray-900">{{ noteStats.total }}</p>
            </div>
            <div class="flex justify-end">
              <IconFileText class="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <!-- On Nostr Card -->
          <div class="bg-white p-6 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex flex-col">
              <p class="text-gray-600 text-sm mb-1">On Nostr</p>
              <p class="text-3xl font-bold text-purple-600">{{ noteStats.total }}</p>
            </div>
            <div class="flex justify-end">
              <IconBolt class="w-8 h-8 text-purple-600" />
            </div>
          </div>
          
          <!-- Total Engagement Card -->
          <div class="bg-white p-6 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex flex-col">
              <p class="text-gray-600 text-sm mb-1">Engagement</p>
              <p class="text-3xl font-bold text-gray-900">{{ noteStats.totalEngagement.toLocaleString() }}</p>
              <div class="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span class="flex items-center gap-1">
                  <IconHeart class="w-3 h-3" />
                  {{ noteStats.totalLikes }}
                </span>
                <span class="flex items-center gap-1">
                  <IconRepeat class="w-3 h-3" />
                  {{ noteStats.totalReposts }}
                </span>
                <span class="flex items-center gap-1">
                  <IconBookmark class="w-3 h-3" />
                  {{ noteStats.totalBookmarks }}
                </span>
              </div>
            </div>
            <div class="flex justify-end">
              <IconUsers class="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>