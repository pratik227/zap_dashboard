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
  IconHeart,
  IconRepeat,
  IconBookmark,
  IconX,
  IconCheck,
  IconCopy
} from '@iconify-prerendered/vue-tabler'
import { useNostrNotes } from '../composables/useNostrNotes.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useContentZaps } from '../composables/useContentZaps.js'
import { useEngagementMetrics } from '../composables/useEngagementMetrics.js'
import { useBtcPrice } from '../composables/useBtcPrice.js'
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
  getZapCount
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
const showRawDataModal = ref(false)
const noteTextarea = ref(null)
const copySuccess = ref('')

// Enhanced computed properties
const noteStats = computed(() => {
  const list = Array.isArray(notes.value) ? notes.value : []
  
  const totalZapRevenue = list.reduce((sum, note) => {
    return sum + getTotalZapAmount(note.id)
  }, 0)
  
  const totalLikes = list.reduce((sum, note) => {
    const { likes = 0 } = getEngagementCounts(note.id) || {}
    return sum + likes
  }, 0)
  
  const totalReposts = list.reduce((sum, note) => {
    const { reposts = 0 } = getEngagementCounts(note.id) || {}
    return sum + reposts
  }, 0)
  
  const totalBookmarks = list.reduce((sum, note) => {
    const { bookmarks = 0 } = getEngagementCounts(note.id) || {}
    return sum + bookmarks
  }, 0)
  
  const totalZapCount = list.reduce((sum, note) => {
    return sum + getZapCount(note.id)
  }, 0)
  
  const totalEngagement = totalLikes + totalReposts + totalBookmarks
  
  return {
    total: list.length,
    thisWeek: list.filter(note => {
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
  
  const words = (note.content || '').trim().split(/\s+/)
  
  return {
    ...note,
    zapData,
    engagementData,
    totalZaps,
    zapCount,
    formattedDate: formatDate(note.created_at),
    timeAgo: getTimeAgo(note.created_at),
    wordCount: note.content ? words.length : 0,
    readTime: note.content ? Math.ceil(words.length / 200) : 0
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
  const label = note.content ? note.content.slice(0, 40) + (note.content.length > 40 ? '…' : '') : note.id
  if (confirm(`Delete this note: "${label}"?`)) {
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
  if (!event?.target) return
  // Handle any future dropdown logic here
}

// Get URL for different Nostr clients
const getNostrClientUrl = (client, noteId) => {
  if (!noteId) return '#'
  
  try {
    switch (client) {
      case 'primal':
        return `https://primal.net/e/${noteId}`
      case 'yakihonne':
        return `https://yakihonne.com/e/${nip19.neventEncode({ id: noteId })}`
      case 'highlighter':
        return `https://highlighter.com/a/${nip19.noteEncode(noteId)}`
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
const formatZapTime = (timestampSec) => {
  const date = new Date(timestampSec * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
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


// Track which notes we've already started tracking to prevent duplicates
const tracked = new Set()

function ensureTrackingFor(noteId) {
  if (tracked.has(noteId)) return
  startZapTracking(noteId)
  startEngagementTracking(noteId)
  tracked.add(noteId)
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  
  // Expose debug function globally for console access
  window.debugNotes = debugState
  
  if (isAuthenticated.value) {
    const list = Array.isArray(notes.value) ? notes.value : []
    list.forEach(note => ensureTrackingFor(note.id))
  }
})

// Watch for notes changes to track zaps and engagement on new notes
watch(notes, (newNotes) => {
  if (isAuthenticated.value) {
    const list = Array.isArray(newNotes) ? newNotes : []
    list.forEach(note => ensureTrackingFor(note.id))
  }
})

// Watch for authentication changes
watch(isAuthenticated, (authed) => {
  if (authed) {
    const list = Array.isArray(notes.value) ? notes.value : []
    list.forEach(note => ensureTrackingFor(note.id))
  }
})

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

        <!-- Notes List -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <IconFileText class="w-5 h-5 text-orange-600" />
              <span>Your Notes</span>
            </h3>
          </div>
          
          <div class="divide-y divide-orange-100/50">
            <div v-if="isLoading && notes.length === 0" class="p-8 text-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p class="text-gray-600">Loading your notes...</p>
            </div>
            
            <div v-else-if="notes.length === 0" class="p-8 text-center">
              <IconFileText class="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
              <p class="text-gray-600 mb-4">Create your first note to get started</p>
              <button @click="startCreating" class="btn-primary">
                <IconPlus class="w-4 h-4" />
                Create First Note
              </button>
            </div>
            
            <div
              v-for="note in notes"
              :key="note.id"
              class="p-4 hover:bg-orange-25/50 transition-colors cursor-pointer"
              @click="openDetailedView(note)"
            >
              <div class="flex items-start space-x-3">
                <!-- User Avatar -->
                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                  <img 
                    :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                    :alt="userProfile?.name || 'You'"
                    class="w-full h-full object-cover"
                  />
                </div>
                
                <!-- Note Content -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-2 mb-1">
                    <span class="font-medium text-gray-900">{{ userProfile?.name || 'You' }}</span>
                    <span class="text-gray-500 text-sm">•</span>
                    <span class="text-gray-500 text-sm">{{ getTimeAgo(note.created_at) }}</span>
                  </div>
                  
                  <p class="text-gray-800 mb-3 leading-relaxed">{{ note.content }}</p>
                  
                  <!-- Engagement and Zap Metrics -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                      <EngagementMetrics 
                        :engagement-counts="getEngagementCounts(note.id)"
                        :zap-count="getZapCount(note.id)"
                        size="default"
                        text-size="text-xs"
                        :show-all-metrics="false"
                        :show-no-engagement-text="false"
                        :show-tooltips="true"
                      />
                      
                      <!-- Zap Amount -->
                      <div v-if="getTotalZapAmount(note.id) > 0" class="flex items-center space-x-1 text-orange-600">
                        <IconBolt class="w-4 h-4" />
                        <span class="text-sm font-medium">{{ formatZapAmount(getTotalZapAmount(note.id)) }} sats</span>
                      </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex items-center space-x-2">
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit View -->
      <div v-else-if="currentView === 'create' || currentView === 'edit'">
        <!-- Modern X-style Compose Interface -->
        <div class="bg-white/95 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-lg overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-100">
            <div class="flex items-center space-x-3">
              <button
                @click="setView('list')"
                class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
              <span class="text-lg font-semibold text-gray-900">
                {{ editingNote ? 'Edit note' : 'Draft' }}
              </span>
            </div>
            
            <button
              @click="handleSubmit"
              :disabled="!isFormValid || isLoading"
              class="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-full font-semibold transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
            >
              <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
              <IconSend v-else class="w-4 h-4" />
              <span>{{ editingNote ? 'Update' : 'Post' }}</span>
            </button>
          </div>
          
          <!-- Compose Area -->
          <div class="p-4">
            <div class="flex space-x-3">
              <!-- User Avatar -->
              <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                <img 
                  :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                  :alt="userProfile?.name || 'You'"
                  class="w-full h-full object-cover"
                />
              </div>
              
              <!-- Text Area -->
              <div class="flex-1">
                <textarea
                  ref="noteTextarea"
                  v-model="noteForm.content"
                  placeholder="What's happening?"
                  rows="3"
                  class="w-full px-0 py-3 text-lg placeholder-gray-500 border-0 resize-none focus:outline-none bg-transparent"
                  style="min-height: 120px; max-height: 400px;"
                ></textarea>
                
                <!-- Character Counter -->
                <div v-if="noteForm.content.length > 1800" class="flex justify-end mt-2">
                  <div class="flex items-center space-x-2">
                    <div class="relative w-6 h-6">
                      <svg class="w-6 h-6 transform -rotate-90" viewBox="0 0 24 24">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="2"
                          fill="none"
                          class="text-gray-200"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="2"
                          fill="none"
                          :class="noteForm.content.length > 2000 ? 'text-red-500' : 'text-orange-500'"
                          :stroke-dasharray="`${(noteForm.content.length / 2000) * 62.83} 62.83`"
                        />
                      </svg>
                    </div>
                    <span :class="[
                      'text-sm font-medium',
                      noteForm.content.length > 2000 ? 'text-red-500' : 'text-gray-500'
                    ]">
                      {{ 2000 - noteForm.content.length }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Bottom Section -->
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <!-- Visibility Indicator -->
              <div class="flex items-center space-x-2 text-sm text-gray-500">
                <IconUsers class="w-4 h-4" />
                <span>Everyone can reply</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Note Detail Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showViewModal && enhancedSelectedNote" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Note Details</h3>
              <button
                @click="closeDetailedView"
                class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <!-- Modal Content -->
            <div class="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              <!-- Note Content -->
              <div class="mb-6">
                <div class="flex items-start space-x-3 mb-4">
                  <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                    <img 
                      :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                      :alt="userProfile?.name || 'You'"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center space-x-2 mb-2">
                      <span class="font-semibold text-gray-900">{{ userProfile?.name || 'You' }}</span>
                      <span class="text-gray-500 text-sm">{{ enhancedSelectedNote.formattedDate }}</span>
                    </div>
                    <p class="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">{{ enhancedSelectedNote.content }}</p>
                  </div>
                </div>
              </div>
              
              <!-- Stats Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div class="bg-orange-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-orange-600">{{ enhancedSelectedNote.wordCount }}</div>
                  <div class="text-xs text-orange-700">Words</div>
                </div>
                <div class="bg-blue-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-blue-600">{{ enhancedSelectedNote.readTime }}</div>
                  <div class="text-xs text-blue-700">Min read</div>
                </div>
                <div class="bg-green-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-green-600">{{ enhancedSelectedNote.totalZaps }}</div>
                  <div class="text-xs text-green-700">Sats earned</div>
                </div>
                <div class="bg-purple-50 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-purple-600">{{ enhancedSelectedNote.engagementData?.totalEngagement || 0 }}</div>
                  <div class="text-xs text-purple-700">Engagement</div>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                <div class="flex items-center space-x-3">
                  <button
                    @click="startEditing(enhancedSelectedNote); closeDetailedView()"
                    class="btn-secondary"
                  >
                    <IconEdit class="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    @click="showRawData"
                    class="btn-secondary"
                  >
                    <IconEye class="w-4 h-4" />
                    View Technical Data
                  </button>
                </div>
                
                <button
                  @click="handleDelete(enhancedSelectedNote); closeDetailedView()"
                  class="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <IconTrash class="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Raw Data Modal -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showRawDataModal && selectedNote" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
          <div class="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl">
            <!-- Header -->
            <div class="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Technical Data</h3>
              <div class="flex items-center space-x-2">
                <button
                  @click="copyToClipboard(formatRawEvent(selectedNote), 'json')"
                  class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Copy JSON"
                >
                  <IconCheck v-if="copySuccess === 'json'" class="w-4 h-4 text-green-600" />
                  <IconCopy v-else class="w-4 h-4" />
                </button>
                <button
                  @click="showRawDataModal = false"
                  class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <!-- JSON Content -->
            <div class="overflow-y-auto max-h-[calc(95vh-80px)] bg-gray-900 text-green-400">
              <pre class="p-3 sm:p-4 text-xs sm:text-sm font-mono leading-relaxed break-words whitespace-pre-wrap">{{ formatRawEvent(selectedNote) }}</pre>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>