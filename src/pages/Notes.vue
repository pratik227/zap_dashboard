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
                <EngagementMetrics 
                  :key="`stats-${noteStats.totalEngagement}-${noteStats.totalZapCount}`"
                  :engagement-counts="{
                    likes: noteStats.totalLikes,
                    reposts: noteStats.totalReposts,
                    bookmarks: noteStats.totalBookmarks,
                    totalEngagement: noteStats.totalEngagement
                  }"
                  :zap-count="noteStats.totalZapCount"
                  size="medium"
                  text-size="text-sm"
                  :show-all-metrics="false"
                  :show-no-engagement-text="true"
                  :show-tooltips="false"
                />
              </div>
            </div>
            <div class="flex justify-end">
              <IconUsers class="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        <!-- Enhanced Notes List -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <h3 class="text-lg font-semibold text-gray-900">Your Notes</h3>
          </div>

          <div v-if="isLoading && notes.length === 0" class="p-6">
            <div class="flex items-center justify-center space-x-2">
              <IconLoader class="w-5 h-5 animate-spin text-orange-600" />
              <span class="text-gray-600">Loading your notes...</span>
            </div>
          </div>

          <div v-else-if="notes.length === 0" class="p-6 text-center">
            <IconFileText class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <h4 class="text-lg font-medium text-gray-900 mb-2">No notes yet</h4>
            <p class="text-gray-600 mb-4">Start writing your first note to share your thoughts on Nostr.</p>
            <button @click="startCreating" class="btn-primary">
              <IconPlus class="w-4 h-4" />
              Create First Note
            </button>
          </div>

          <div v-else class="divide-y divide-orange-100/50">
            <!-- Enhanced Note Cards -->
            <div
              v-for="note in notes"
              :key="note.id"
              class="p-6 hover:bg-orange-25/80 transition-all duration-200 cursor-pointer group"
              @click="openDetailedView(note)"
            >
              <!-- Note Header -->
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3">
                  <!-- Author Avatar -->
                  <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                    <img 
                      :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                      :alt="userProfile?.name || 'You'"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  
                  <!-- Author Info -->
                  <div>
                    <div class="flex items-center space-x-2">
                      <h4 class="font-semibold text-gray-900">{{ userProfile?.name || 'You' }}</h4>
                      <span v-if="userProfile?.nip05" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Verified
                      </span>
                    </div>
                    <div class="flex items-center space-x-2 text-sm text-gray-500">
                      <span>{{ getTimeAgo(note.created_at) }}</span>
                      <span>•</span>
                      <span>{{ Math.ceil(note.content.split(/\s+/).length / 200) }} min read</span>
                    </div>
                  </div>
                </div>
                
                <!-- Note Actions -->
                <div class="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click.stop="startEditing(note)"
                    class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Edit note"
                  >
                    <IconEdit class="w-4 h-4" />
                  </button>
                  <button
                    @click.stop="handleDelete(note)"
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete note"
                  >
                    <IconTrash class="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <!-- Note Content Preview -->
              <div class="mb-4">
                <h3 class="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{{ note.title }}</h3>
                <p class="text-gray-700 line-clamp-3 leading-relaxed">{{ note.preview }}</p>
              </div>
              
              <!-- Hashtags -->
              <div v-if="note.hashtags && note.hashtags.length > 0" class="mb-4">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in note.hashtags.slice(0, 3)"
                    :key="tag"
                    class="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs hover:bg-orange-200 transition-colors"
                  >
                    <IconHash class="w-3 h-3" />
                    <span>{{ tag }}</span>
                  </span>
                  <span v-if="note.hashtags.length > 3" class="text-xs text-gray-500 px-2 py-1">
                    +{{ note.hashtags.length - 3 }} more
                  </span>
                </div>
              </div>
              
              <!-- Enhanced Engagement Bar -->
              <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                <!-- Left: Engagement Metrics -->
                <div class="flex items-center space-x-6">
                  <EngagementMetrics 
                    :key="`engagement-${note.id}-${getEngagementCounts(note.id).totalEngagement}-${getZapCount(note.id)}`"
                    :engagement-counts="getEngagementCounts(note.id)"
                    :zap-count="getZapCount(note.id)"
                    size="default"
                    text-size="text-sm"
                    :show-all-metrics="true"
                    :show-no-engagement-text="false"
                    :show-tooltips="true"
                  />
                </div>
                
                <!-- Right: Zap Revenue -->
                <div v-if="getTotalZapAmount(note.id) > 0" class="flex items-center space-x-2">
                  <div class="bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-3 py-1 rounded-full flex items-center space-x-1">
                    <IconBolt class="w-4 h-4 text-orange-600" />
                    <span class="font-semibold">{{ formatZapAmount(getTotalZapAmount(note.id)) }} sats</span>
                    <span class="text-orange-500">({{ getZapCount(note.id) }})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit Note View -->
      <div v-else-if="currentView === 'create' || currentView === 'edit'">
        <!-- X-style Compose Interface -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden max-w-2xl mx-auto">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button
              @click="setView('list')"
              class="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors p-2 -ml-2 rounded-full hover:bg-gray-100"
            >
              <IconArrowLeft class="w-5 h-5" />
              <span class="font-medium">{{ currentView === 'edit' ? 'Edit' : 'Draft' }}</span>
            </button>
            
            <button
              @click="currentView === 'edit' ? handleUpdateNote() : handlePublishNote()"
              :disabled="!noteForm.content.trim() || isLoading"
              class="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200 disabled:cursor-not-allowed min-w-[80px] flex items-center justify-center"
            >
              <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
              <span v-else>{{ currentView === 'edit' ? 'Update' : 'Post' }}</span>
            </button>
          </div>

          <!-- Compose Area -->
          <div class="p-4">
            <!-- User Avatar Row -->
            <div class="flex space-x-3">
              <!-- User Avatar -->
              <div class="flex-shrink-0">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                  <img 
                    :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                    :alt="userProfile?.name || 'You'"
                    class="w-full h-full object-cover"
                  />
                </div>
              </div>
              
              <!-- Compose Column -->
              <div class="flex-1 min-w-0">
                <!-- Main Textarea -->
                <div class="mb-4">
                  <textarea
                    ref="composeTextarea"
                    v-model="noteForm.content"
                    placeholder="What's happening?"
                    class="w-full text-xl placeholder-gray-500 border-none resize-none focus:outline-none bg-transparent leading-relaxed min-h-[120px] max-h-[400px] overflow-y-auto"
                    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
                    @input="autoResize"
                    @paste="handlePaste"
                  ></textarea>
                </div>

                <!-- Tags Section (Collapsible) -->
                <div v-if="showTagsSection || noteForm.tags.length > 0" class="mb-4">
                  <!-- Existing Tags -->
                  <div v-if="noteForm.tags.length > 0" class="flex flex-wrap gap-2 mb-3">
                    <span
                      v-for="(tag, index) in noteForm.tags"
                      :key="index"
                      class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium group hover:bg-orange-200 transition-colors"
                    >
                      <IconHash class="w-3 h-3" />
                      <span>{{ tag }}</span>
                      <button
                        @click="removeTag(index)"
                        class="text-orange-500 hover:text-orange-700 transition-colors ml-1"
                      >
                        <IconX class="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                  
                  <!-- Add Tag Input -->
                  <div class="flex space-x-2">
                    <input
                      v-model="newTag"
                      type="text"
                      placeholder="Add topic..."
                      class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                      @keyup.enter="addTag"
                      @keyup.escape="showTagsSection = false"
                    />
                    <button
                      @click="addTag"
                      class="px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <!-- Bottom Toolbar -->
                <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                  <!-- Left: Tools -->
                  <div class="flex items-center space-x-1">
                    <!-- Add Tags Button -->
                    <button
                      @click="toggleTagsSection"
                      :class="[
                        'p-2 rounded-full transition-all duration-200 hover:bg-orange-50',
                        showTagsSection || noteForm.tags.length > 0 ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-orange-500'
                      ]"
                      title="Add topics"
                    >
                      <IconHash class="w-5 h-5" />
                    </button>
                    
                    <!-- Character Count (when approaching limit) -->
                    <div v-if="noteForm.content.length > 1800" class="flex items-center space-x-2 ml-4">
                      <div class="relative w-6 h-6">
                        <!-- Progress Circle -->
                        <svg class="w-6 h-6 transform -rotate-90" viewBox="0 0 24 24">
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="2"
                            fill="none"
                            :class="noteForm.content.length > 2000 ? 'text-red-200' : 'text-gray-200'"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="2"
                            fill="none"
                            :class="noteForm.content.length > 2000 ? 'text-red-500' : 'text-orange-500'"
                            :stroke-dasharray="`${2 * Math.PI * 10}`"
                            :stroke-dashoffset="`${2 * Math.PI * 10 * (1 - Math.min(noteForm.content.length / 2000, 1))}`"
                            class="transition-all duration-300"
                          />
                        </svg>
                        <!-- Character count in center -->
                        <div class="absolute inset-0 flex items-center justify-center">
                          <span :class="[
                            'text-xs font-medium',
                            noteForm.content.length > 2000 ? 'text-red-600' : 'text-gray-600'
                          ]">
                            {{ 2000 - noteForm.content.length }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Right: Visibility & Post Button -->
                  <div class="flex items-center space-x-3">
                    <!-- Visibility Indicator -->
                    <div class="flex items-center space-x-1 text-sm text-gray-500">
                      <IconGlobe class="w-4 h-4" />
                      <span class="hidden sm:inline">Everyone can reply</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Enhanced Detailed View Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showViewModal && enhancedSelectedNote" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl">
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-amber-50">
              <div class="flex items-center space-x-3">
                <!-- Author Avatar -->
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                  <img 
                    :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                    :alt="userProfile?.name || 'You'"
                    class="w-full h-full object-cover"
                  />
                </div>
                
                <!-- Author Info -->
                <div>
                  <div class="flex items-center space-x-2">
                    <h3 class="font-semibold text-gray-900">{{ userProfile?.name || 'You' }}</h3>
                    <span v-if="userProfile?.nip05" class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      Verified
                    </span>
                  </div>
                  <div class="flex items-center space-x-2 text-sm text-gray-500">
                    <span>{{ enhancedSelectedNote.timeAgo }}</span>
                    <span>•</span>
                    <span>{{ enhancedSelectedNote.readTime }} min read</span>
                  </div>
                </div>
              </div>
              
              <!-- Header Actions -->
              <div class="flex items-center space-x-2">
                <!-- Open in Client Dropdown -->
                <div class="relative" ref="dropdownRef">
                  <button
                    @click="showClientDropdown = !showClientDropdown"
                    class="btn-secondary text-sm flex items-center gap-1"
                  >
                    <IconExternalLink class="w-4 h-4" />
                    <span class="hidden sm:inline">Open</span>
                    <IconChevronDown :class="['w-3 h-3 transition-transform', showClientDropdown ? 'rotate-180' : '']" />
                  </button>
                  
                  <!-- Client Dropdown -->
                  <div 
                    v-if="showClientDropdown"
                    class="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                  >
                    <a :href="getNostrClientUrl('primal', enhancedSelectedNote.id)" target="_blank" rel="noopener noreferrer" 
                       class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2">
                      <span class="w-4 h-4 flex items-center justify-center text-orange-600">🌐</span>
                      <span>Primal.net</span>
                    </a>
                    <a :href="getNostrClientUrl('yakihonne', enhancedSelectedNote.id)" target="_blank" rel="noopener noreferrer"
                       class="block px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2">
                      <span class="w-4 h-4 flex items-center justify-center text-purple-600">🍜</span>
                      <span>Yakihonne</span>
                    </a>
                  </div>
                </div>
                
                <!-- Technical Data Button -->
                <button
                  @click="showRawData"
                  class="btn-secondary text-sm"
                  title="View technical data"
                >
                  <IconCode class="w-4 h-4" />
                  <span class="hidden sm:inline">Data</span>
                </button>
                
                <!-- Edit Button -->
                <button
                  @click="startEditing(enhancedSelectedNote); closeDetailedView()"
                  class="btn-secondary text-sm"
                >
                  <IconEdit class="w-4 h-4" />
                  <span class="hidden sm:inline">Edit</span>
                </button>
                
                <!-- Close Button -->
                <button
                  @click="closeDetailedView"
                  class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Modal Content -->
            <div class="overflow-y-auto max-h-[calc(95vh-120px)]">
              <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
                <!-- Main Content Column -->
                <div class="lg:col-span-2 space-y-6">
                  <!-- Note Content -->
                  <article class="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
                    <!-- Hashtags -->
                    <div v-if="enhancedSelectedNote.hashtags && enhancedSelectedNote.hashtags.length > 0" class="mb-6">
                      <div class="flex flex-wrap gap-2">
                        <span
                          v-for="tag in enhancedSelectedNote.hashtags"
                          :key="tag"
                          class="inline-flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-3 py-2 rounded-full text-sm font-medium hover:from-orange-200 hover:to-amber-200 transition-all duration-200 cursor-pointer"
                        >
                          <IconHash class="w-3 h-3" />
                          <span>{{ tag }}</span>
                        </span>
                      </div>
                    </div>
                    
                    <!-- Note Title -->
                    <h1 class="text-3xl font-bold text-gray-900 mb-6 leading-tight">
                      {{ enhancedSelectedNote.title }}
                    </h1>
                    
                    <!-- Note Content -->
                    <div class="prose prose-lg max-w-none">
                      <div class="text-gray-800 leading-relaxed whitespace-pre-wrap text-lg">
                        {{ enhancedSelectedNote.content }}
                      </div>
                    </div>
                  </article>
                  
                  <!-- Enhanced Engagement Section -->
                  <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <IconHeart class="w-5 h-5 text-red-500" />
                      <span>Community Engagement</span>
                    </h3>
                    
                    <!-- Engagement Metrics Bar -->
                    <div class="grid grid-cols-4 gap-4 mb-6">
                      <div class="text-center p-4 bg-red-50 rounded-lg">
                        <div class="text-2xl font-bold text-red-600">{{ enhancedSelectedNote.engagementData.likes }}</div>
                        <div class="text-sm text-red-700">Likes</div>
                      </div>
                      <div class="text-center p-4 bg-green-50 rounded-lg">
                        <div class="text-2xl font-bold text-green-600">{{ enhancedSelectedNote.engagementData.reposts }}</div>
                        <div class="text-sm text-green-700">Reposts</div>
                      </div>
                      <div class="text-center p-4 bg-blue-50 rounded-lg">
                        <div class="text-2xl font-bold text-blue-600">{{ enhancedSelectedNote.engagementData.bookmarks }}</div>
                        <div class="text-sm text-blue-700">Bookmarks</div>
                      </div>
                      <div class="text-center p-4 bg-orange-50 rounded-lg">
                        <div class="text-2xl font-bold text-orange-600">{{ enhancedSelectedNote.zapCount }}</div>
                        <div class="text-sm text-orange-700">Zaps</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Sidebar Column -->
                <div class="space-y-6">
                  <!-- Zap Revenue Card -->
                  <div v-if="enhancedSelectedNote.totalZaps > 0" class="bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-xl p-6 shadow-lg">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="text-lg font-semibold flex items-center space-x-2">
                        <IconBolt class="w-5 h-5" />
                        <span>Lightning Revenue</span>
                      </h3>
                    </div>
                    <div class="text-center">
                      <div class="text-3xl font-bold mb-2">{{ formatZapAmount(enhancedSelectedNote.totalZaps) }}</div>
                      <div class="text-orange-100 text-sm">sats earned</div>
                      <div class="text-orange-200 text-xs mt-1">
                        ≈ {{ formatUSD(satsToUSD(enhancedSelectedNote.totalZaps)) }} USD
                      </div>
                    </div>
                  </div>

                  <!-- Enhanced Zappers List -->
                  <div v-if="enhancedSelectedNote.zapData.length > 0" class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                        <IconBolt class="w-5 h-5 text-orange-600" />
                        <span>Supporters</span>
                      </h3>
                      <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {{ enhancedSelectedNote.zapCount }} zaps
                      </span>
                    </div>

                    <!-- Zappers Grid -->
                    <div class="space-y-3 max-h-80 overflow-y-auto">
                      <div
                        v-for="zap in enhancedSelectedNote.zapData"
                        :key="zap.id"
                        class="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg border border-orange-100 hover:bg-orange-100/50 transition-colors cursor-pointer"
                        @click="showZapperDetails(zap)"
                      >
                        <div class="flex items-center space-x-3">
                          <!-- Zapper Avatar -->
                          <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-200">
                            <img 
                              :src="zap.sender?.avatar || zap.sender?.picture || generateFallbackAvatar(zap.zapperPubkey)" 
                              :alt="zap.sender?.name || 'User'"
                              class="w-full h-full object-cover"
                            />
                          </div>
                          
                          <!-- Zapper Info -->
                          <div>
                            <div class="font-medium text-gray-900 text-sm">
                              {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                            </div>
                            <div class="text-xs text-gray-500">{{ formatZapTime(zap.timestamp) }}</div>
                            <div v-if="zap.message" class="text-xs text-gray-700 italic mt-1 line-clamp-1">
                              "{{ zap.message }}"
                            </div>
                          </div>
                        </div>
                        
                        <!-- Zap Amount -->
                        <div class="text-right">
                          <div class="font-bold text-orange-600 text-sm">{{ formatZapAmount(zap.amount) }}</div>
                          <div class="text-xs text-gray-500">sats</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Note Stats Card -->
                  <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Note Statistics</h3>
                    <div class="space-y-3">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Published</span>
                        <span class="text-sm font-medium text-gray-900">{{ enhancedSelectedNote.formattedDate }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Word Count</span>
                        <span class="text-sm font-medium text-gray-900">{{ enhancedSelectedNote.wordCount }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Read Time</span>
                        <span class="text-sm font-medium text-gray-900">{{ enhancedSelectedNote.readTime }} min</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Event ID</span>
                        <button 
                          @click="copyToClipboard(enhancedSelectedNote.id, 'eventId')"
                          class="text-sm font-mono text-gray-600 hover:text-orange-600 transition-colors flex items-center space-x-1"
                        >
                          <span>{{ enhancedSelectedNote.id.substring(0, 8) }}...</span>
                          <IconCheck v-if="copySuccess === 'eventId'" class="w-3 h-3 text-green-600" />
                          <IconCopy v-else class="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Raw Data Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showRawDataModal && enhancedSelectedNote" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-100">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <IconCode class="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">Technical Data</h3>
                  <p class="text-sm text-gray-600">Raw Nostr event data</p>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  @click="copyToClipboard(JSON.stringify(enhancedSelectedNote, null, 2), 'rawData')"
                  class="btn-secondary text-sm"
                >
                  <IconCheck v-if="copySuccess === 'rawData'" class="w-4 h-4 text-green-600" />
                  <IconCopy v-else class="w-4 h-4" />
                  Copy JSON
                </button>
                <button
                  @click="showRawDataModal = false"
                  class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <!-- Raw Data Content -->
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <pre class="bg-gray-50 rounded-lg p-4 text-sm font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(enhancedSelectedNote, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Zapper Details Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showZapperModal && selectedZapper" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <!-- Header -->
            <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-6">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30">
                    <img 
                      :src="selectedZapper.sender?.avatar || selectedZapper.sender?.picture || generateFallbackAvatar(selectedZapper.zapperPubkey)" 
                      :alt="selectedZapper.sender?.name || 'User'"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold">{{ selectedZapper.sender?.name || formatZapperPubkey(selectedZapper.zapperPubkey) }}</h3>
                    <p class="text-orange-100 text-sm">Lightning Supporter</p>
                  </div>
                </div>
                <button
                  @click="showZapperModal = false"
                  class="p-2 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <!-- Zapper Details -->
            <div class="p-6">
              <!-- Zap Amount -->
              <div class="text-center mb-6">
                <div class="text-4xl font-bold text-orange-600 mb-2">
                  {{ formatZapAmount(selectedZapper.amount) }} sats
                </div>
                <div class="text-gray-500 text-sm">
                  ≈ {{ formatUSD(satsToUSD(selectedZapper.amount)) }} USD
                </div>
              </div>
              
              <!-- Zap Message -->
              <div v-if="selectedZapper.message" class="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 class="font-medium text-gray-900 mb-2">Message</h4>
                <p class="text-gray-700 italic">"{{ selectedZapper.message }}"</p>
              </div>
              
              <!-- Zapper Info -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Zapped</span>
                  <span class="text-sm font-medium text-gray-900">{{ formatZapTime(selectedZapper.timestamp) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Pubkey</span>
                  <button 
                    @click="copyToClipboard(selectedZapper.zapperPubkey, 'zapperPubkey')"
                    class="text-sm font-mono text-gray-600 hover:text-orange-600 transition-colors flex items-center space-x-1"
                  >
                    <span>{{ formatZapperPubkey(selectedZapper.zapperPubkey) }}</span>
                    <IconCheck v-if="copySuccess === 'zapperPubkey'" class="w-3 h-3 text-green-600" />
                    <IconCopy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Media URL Input Modal -->
    <div v-if="showMediaUrlInput || showVideoUrlInput" class="fixed inset-0 z-50 overflow-y-auto">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="showMediaUrlInput = false; showVideoUrlInput = false"></div>
      
      <!-- Modal -->
      <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-orange-50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <component :is="showMediaUrlInput ? IconPhoto : IconVideo" class="w-5 h-5 text-orange-600" />
              <span>{{ showMediaUrlInput ? 'Add Image URL' : 'Add Video URL' }}</span>
            </h3>
            <button
              @click="showMediaUrlInput = false; showVideoUrlInput = false"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <IconX class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-4">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                {{ showMediaUrlInput ? 'Image URL (.jpg, .jpeg, .png, .gif, .webp)' : 'Video URL' }}
              </label>
              <input
                v-model="mediaUrl"
                type="url"
                :placeholder="showMediaUrlInput ? 'https://example.com/image.jpg' : 'https://example.com/video.mp4'"
                class="w-full px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                @keyup.enter="insertMediaUrl(showMediaUrlInput ? 'image' : 'video')"
              />
            </div>
            
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p class="text-sm text-blue-800">
                {{ showMediaUrlInput 
                  ? 'Enter the URL of an image (must end with .jpg, .jpeg, .png, .gif, or .webp)' 
                  : 'Enter the URL of a video you want to include in your note' }}
              </p>
            </div>
            
            <div class="flex justify-end space-x-3">
              <button
                @click="showMediaUrlInput = false; showVideoUrlInput = false"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="insertMediaUrl(showMediaUrlInput ? 'image' : 'video')"
                :disabled="!mediaUrl.trim()"
                class="btn-primary disabled:opacity-50"
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box !important;
  -webkit-line-clamp: 1 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.line-clamp-2 {
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

.line-clamp-3 {
  display: -webkit-box !important;
  -webkit-line-clamp: 3 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}

/* Scrollable areas */
.max-h-80 {
  max-height: 20rem;
}

.overflow-y-auto {
  overflow-y: auto;
}

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

/* Enhanced textarea styles */
textarea {
  resize: none;
  font-family: inherit;
  line-height: 1.6;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}

/* Prose styling for content */
.prose {
  font-size: 1.125rem;
  line-height: 1.7;
  max-width: none;
}

.prose p {
  margin-bottom: 1.5rem;
}

/* Modal transitions */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-transition-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-transition-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}

/* Enhanced hover effects */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .text-3xl {
    font-size: 1.875rem;
  }
  
  .text-lg {
    font-size: 1.125rem;
  }
  
  .p-6 {
    padding: 1rem;
  }
  
  .space-x-6 > * + * {
    margin-left: 1rem;
  }
}

/* Focus states for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #f97316;
  outline-offset: 2px;
}

/* Smooth transitions for interactive elements */
button, input, textarea {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enhanced button hover effects */
button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* Code block styling */
pre {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  line-height: 1.5;
}

/* Gradient text effects */
.gradient-text {
  background: linear-gradient(135deg, #f97316, #fbbf24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Enhanced card shadows */
.shadow-2xl {
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

/* Responsive grid adjustments */
@media (max-width: 1024px) {
  .lg\:col-span-2 {
    grid-column: span 1;
  }
  
  .lg\:col-span-3 {
    grid-column: span 1;
  }
}

/* Enhanced focus ring */
.focus-within\:ring-2:focus-within {
  ring-width: 2px;
  ring-color: rgb(251 146 60 / 0.5);
}

/* Improved text rendering */
.leading-relaxed {
  line-height: 1.625;
}

.leading-tight {
  line-height: 1.25;
}

/* Custom emoji picker positioning */
.emoji-picker-container {
  position: relative;
}

/* Backdrop blur effects */
.backdrop-blur-lg {
  backdrop-filter: blur(16px);
}

.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* Enhanced border styles */
.border-orange-100\/50 {
  border-color: rgb(254 215 170 / 0.5);
}

/* Improved spacing for mobile */
@media (max-width: 640px) {
  .space-y-6 > * + * {
    margin-top: 1.5rem;
  }
  
  .gap-4 {
    gap: 1rem;
  }
}
</style>