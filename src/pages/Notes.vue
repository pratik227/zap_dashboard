<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import EmojiPicker from 'vue3-emoji-picker'
import 'vue3-emoji-picker/css'
import { nip19 } from '../services/nostr/nostrImports.js'
import { formatSatsShort } from '../utils/format.js'

// Define props and emits for Vue 3
const props = defineProps({
  initialTab: {
    type: String,
    default: undefined
  }
})

const emit = defineEmits(['changePage', 'writingModeChange'])
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
  IconCopy,
  IconInfoCircle,
  IconBulb,
  IconRefresh
} from '@iconify-prerendered/vue-tabler'
import { useNostrNotes } from '../composables/content/useNostrNotes.js'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import { useContentZaps } from '../composables/content/useContentZaps.js'
import { useEngagementMetrics } from '../composables/analytics/useEngagementMetrics.js'
import { useBtcPrice } from '../composables/core/useBtcPrice.js'
import { useMentions } from '../composables/content/useMentions.js'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import EngagementMetrics from '../components/analytics/EngagementMetrics.vue'
import NoteSuccessModal from '../components/modals/NoteSuccessModal.vue'
import MentionInput from '../components/content/MentionInput.vue'
import NoteContentRenderer from '../components/content/NoteContentRenderer.vue'
import ThreadsPromo from '../components/shared/ThreadsPromo.vue'
import SkeletonNotes from '../components/shared/SkeletonNotes.vue'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

const {
  notes,
  noteForm,
  currentView,
  selectedNote,
  editingNote,
  isLoading,
  isFetchingNotes,
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
  formatDate,
  fetchUserNotes
} = useNostrNotes()

// Use content zaps composable to track zaps on notes
const {
  startZapTracking,
  getZapsForContent,
  getTotalZapAmount,
  getZapCount,
  contentZaps
} = useContentZaps()

const {
  startEngagementTracking,
  getEngagementCounts,
  cleanup: cleanupEngagement
} = useEngagementMetrics()

// Use BTC price composable
const { satsToUSD, formatUSD } = useBtcPrice()

// Use mentions composable
const { extractPTags, parseMentions } = useMentions()

// Display limit for note list to avoid rendering 100+ DOM nodes at once
const displayLimit = ref(50)
const visibleNotes = computed(() => {
  const list = Array.isArray(notes.value) ? notes.value : []
  return list.slice(0, displayLimit.value)
})

// Refresh state
const isRefreshing = ref(false)
const handleRefresh = async () => {
  isRefreshing.value = true
  try {
    await fetchUserNotes()
  } finally {
    isRefreshing.value = false
  }
}

// UI State
const showViewModal = ref(false)
const showRawDataModal = ref(false)
const noteTextarea = ref(null)
const copySuccess = ref('')
const showZapperModal = ref(false)
const selectedZapper = ref(null)
const showSuccessModal = ref(false)
const lastPublishResult = ref(null)
const showPreview = ref(false)


// Debounced note stats — avoids recomputing on every single zap/engagement event
const noteStats = ref({
  total: 0, thisWeek: 0, totalZapRevenue: 0, totalLikes: 0,
  totalReposts: 0, totalBookmarks: 0, totalZapCount: 0, totalEngagement: 0
})

let _noteStatsTimer = null
function recalcNoteStats() {
  clearTimeout(_noteStatsTimer)
  _noteStatsTimer = setTimeout(() => {
    const list = Array.isArray(notes.value) ? notes.value : []
    let totalZapRevenue = 0, totalLikes = 0, totalReposts = 0, totalBookmarks = 0, totalZapCount = 0

    for (const note of list) {
      totalZapRevenue += getTotalZapAmount(note.id)
      totalZapCount += getZapCount(note.id)
      const ec = getEngagementCounts(note.id) || {}
      totalLikes += ec.likes || 0
      totalReposts += ec.reposts || 0
      totalBookmarks += ec.bookmarks || 0
    }

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    noteStats.value = {
      total: list.length,
      thisWeek: list.filter(n => n.created_at * 1000 > weekAgo).length,
      totalZapRevenue, totalLikes, totalReposts, totalBookmarks, totalZapCount,
      totalEngagement: totalLikes + totalReposts + totalBookmarks + totalZapCount
    }
  }, 2000)
}

// Recalc stats when notes list changes or zaps arrive
watch(() => notes.value.length, recalcNoteStats, { immediate: true })
watch(contentZaps, recalcNoteStats)

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
  noteSubmitAttempted.value = true
  if (!noteForm.content.trim()) return
  
  try {
    // Extract p tags from mentions in content (NIP-10)
    const pTags = extractPTags(noteForm.content)

    let result
    if (editingNote.value) {
      result = await updateNote(editingNote.value.id, noteForm.content, noteForm.tags, pTags)
    } else {
      result = await publishNote(noteForm.content, noteForm.tags, pTags)
    }
    
    // Store the publish result and note content for the success modal
    lastPublishResult.value = result
    
    // Show success modal for new notes (not edits)
    if (!editingNote.value) {
      showSuccessModal.value = true
    }
    
    // Reset form and go back to list
    noteForm.content = ''
    showPreview.value = false
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

// Inline status for login errors
const inlineStatus = ref(null)
let _statusTimer = null
const showStatus = (message, type = 'error') => {
  clearTimeout(_statusTimer)
  inlineStatus.value = { message, type }
  _statusTimer = setTimeout(() => { inlineStatus.value = null }, 4000)
}

// Handle Nostr login
const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
    if (error.message.includes('No Nostr extension')) {
      showStatus('No Nostr extension found. Please install a NIP-07 browser extension (Alby, nos2x, or Flamingo) and refresh this page.')
    } else {
      showStatus('Login failed: ' + error.message)
    }
  }
}

// Set up editor content when editing
const startEditing = (note) => {
  editNote(note)
  noteForm.content = note.content
  showPreview.value = false
}

const startCreating = () => {
  createNewNote()
  noteForm.content = ''
  showPreview.value = false
  noteSubmitAttempted.value = false
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

// Close success modal
const closeSuccessModal = () => {
  showSuccessModal.value = false
  lastPublishResult.value = null
}

// Form validation
const isFormValid = computed(() => {
  return noteForm.content.trim().length > 0
})

// Track submit attempts for validation feedback
const noteSubmitAttempted = ref(false)

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
  
  // Listen for show note details events from other components
  document.addEventListener('show-note-details', handleShowNoteDetails)
})

// Handle show note details event from other components
const handleShowNoteDetails = (event) => {
  const { eventId } = event.detail
  if (!eventId) return
  
  // Find the note by eventId
  const note = notes.value.find(n => n.id === eventId)
  if (note) {
    // Open the detailed view for this note
    openDetailedView(note)
  } else {
    console.warn('Note not found for eventId:', eventId)
  }
}

// Watch for notes changes to track zaps and engagement on new notes
watch(notes, (newNotes) => {
  if (isAuthenticated.value) {
    const list = Array.isArray(newNotes) ? newNotes : []
    list.forEach(note => ensureTrackingFor(note.id))
  }
}
)

// Watch for authentication changes
watch(isAuthenticated, (authed) => {
  if (authed) {
    const list = Array.isArray(notes.value) ? notes.value : []
    list.forEach(note => ensureTrackingFor(note.id))
  }
})

onUnmounted(() => {
  clearTimeout(_statusTimer)
  clearTimeout(_noteStatsTimer)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('show-note-details', handleShowNoteDetails)
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

// Toggle preview mode
const togglePreview = () => {
  showPreview.value = !showPreview.value
}

// Handle mention added
const handleMentionAdded = (user) => {
  // no-op — event binding placeholder
}

// Handle mention click in preview
const handleMentionClick = ({ pubkey, profile }) => {
  // Could open a profile modal here
}
</script>

<template>
  <div class="space-y-6">
    <!-- Inline Status Banner -->
    <transition name="slide-down">
      <div v-if="inlineStatus" role="status" aria-live="polite" :class="[
        'mb-4 px-4 py-3 rounded-lg text-sm font-medium',
        inlineStatus.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
        inlineStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
        'bg-blue-50 text-blue-800 border border-blue-200'
      ]">
        {{ inlineStatus.message }}
      </div>
    </transition>

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
              @click="handleRefresh"
              :disabled="isRefreshing"
              class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-orange-600 bg-gray-100 hover:bg-orange-50 rounded-lg border border-gray-200 hover:border-orange-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh notes"
              aria-label="Refresh notes"
            >
              <IconRefresh :class="['w-4 h-4', isRefreshing ? 'animate-spin' : '']" />
              <span class="hidden sm:inline">Refresh</span>
            </button>
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
        <!-- Skeleton Loading State -->
        <SkeletonNotes v-if="isFetchingNotes && notes.length === 0" />

        <template v-else>
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
                  <IconHeart class="w-3 h-3 text-red-500" />
                  <span class="text-red-600 font-medium">{{ noteStats.totalLikes }}</span>
                </span>
                <span class="flex items-center gap-1">
                  <IconRepeat class="w-3 h-3 text-green-500" />
                  <span class="text-green-600 font-medium">{{ noteStats.totalReposts }}</span>
                </span>
                <span class="flex items-center gap-1">
                  <IconBolt class="w-3 h-3 text-orange-500" />
                  <span class="text-orange-600 font-medium">{{ noteStats.totalZapCount }}</span>
                </span>
                <span class="flex items-center gap-1">
                  <IconBookmark class="w-3 h-3 text-blue-500" />
                  <span class="text-blue-600 font-medium">{{ noteStats.totalBookmarks }}</span>
                </span>
              </div>
            </div>
            <div class="flex justify-end">
              <IconUsers class="w-8 h-8 text-gray-600" />
            </div>
          </div>
        </div>

        <!-- Notes List -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
          <!-- Empty State -->
          <div v-if="notes.length === 0" class="max-w-3xl mx-auto py-8 px-4">
            <div class="text-center mb-8">
              <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-teal-500 rounded-3xl shadow-lg mb-6">
                <IconFileText class="w-10 h-10 text-white" />
              </div>
              <h3 class="text-2xl font-bold text-gray-900 mb-3">Start Sharing Your Thoughts</h3>
              <p class="text-lg text-gray-600">
                You haven't created any notes yet. Notes are the heart of Nostr - quick posts that connect you with your audience!
              </p>
            </div>

            <!-- Why Notes Matter -->
            <div class="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
              <div class="flex items-start space-x-4">
                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <IconInfoCircle class="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 class="text-lg font-semibold text-gray-900 mb-2">Why Create Notes?</h4>
                  <p class="text-gray-700 leading-relaxed">
                    Notes are short-form posts (like tweets) that let you share updates, insights, and thoughts with the Nostr community.
                    They're perfect for quick engagement and can earn you zaps when people appreciate your content!
                  </p>
                </div>
              </div>
            </div>

            <!-- How to Get Started -->
            <div class="space-y-4 mb-8">
              <h4 class="text-xl font-bold text-gray-900 text-center mb-6">What to Post in Your First Notes</h4>

              <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-green-300 transition-all">
                <div class="flex items-start space-x-4">
                  <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-green-600">
                    1
                  </div>
                  <div class="flex-1">
                    <h5 class="font-semibold text-gray-900 mb-2">Introduce Yourself</h5>
                    <p class="text-gray-600 text-sm mb-2">
                      Share who you are, what you're interested in, and why you joined Nostr. Use #introductions hashtag to help people discover you.
                    </p>
                    <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 italic border-l-4 border-green-400">
                      Example: "Hey Nostr! I'm [name], passionate about [topic]. Excited to connect with this community. #introductions"
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-green-300 transition-all">
                <div class="flex items-start space-x-4">
                  <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-green-600">
                    2
                  </div>
                  <div class="flex-1">
                    <h5 class="font-semibold text-gray-900 mb-2">Share Valuable Insights</h5>
                    <p class="text-gray-600 text-sm mb-2">
                      Post tips, lessons learned, or interesting observations from your experience. Educational content often gets zapped!
                    </p>
                    <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 italic border-l-4 border-green-400">
                      Example: "Today I learned [interesting fact]. Here's why it matters..."
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-green-300 transition-all">
                <div class="flex items-start space-x-4">
                  <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-green-600">
                    3
                  </div>
                  <div class="flex-1">
                    <h5 class="font-semibold text-gray-900 mb-2">Ask Questions & Start Discussions</h5>
                    <p class="text-gray-600 text-sm mb-2">
                      Engage the community with thoughtful questions. People love sharing their opinions and expertise!
                    </p>
                    <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 italic border-l-4 border-green-400">
                      Example: "What's your favorite thing about Nostr? I'm curious to hear different perspectives."
                    </div>
                  </div>
                </div>
              </div>

              <div class="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-green-300 transition-all">
                <div class="flex items-start space-x-4">
                  <div class="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-green-600">
                    4
                  </div>
                  <div class="flex-1">
                    <h5 class="font-semibold text-gray-900 mb-2">Share Updates & Progress</h5>
                    <p class="text-gray-600 text-sm mb-2">
                      Document your journey, projects, or daily wins. People enjoy following along and supporting creators they connect with.
                    </p>
                    <div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 italic border-l-4 border-green-400">
                      Example: "Made great progress on [project] today. Here's what I accomplished..."
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Create Button -->
            <div class="bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl p-8 text-white text-center shadow-xl mb-8">
              <h4 class="text-2xl font-bold mb-3">Ready to Create Your First Note?</h4>
              <p class="text-green-50 mb-6">
                Click below to start writing and share your voice with the Nostr community
              </p>
              <button @click="startCreating" class="bg-white text-green-600 px-8 py-4 rounded-xl font-semibold hover:shadow-2xl transform hover:scale-105 transition-all duration-200 inline-flex items-center space-x-2">
                <IconPlus class="w-5 h-5" />
                <span>Create Your First Note</span>
              </button>
            </div>

            <!-- Pro Tips -->
            <div class="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-2xl p-6">
              <h5 class="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <IconBulb class="w-5 h-5 text-amber-500" />
                <span>Pro Tips for Great Notes</span>
              </h5>
              <ul class="space-y-2 text-sm text-gray-700">
                <li class="flex items-start space-x-2">
                  <span class="text-green-600 font-bold mt-0.5">•</span>
                  <span>Keep it concise - aim for 1-3 short paragraphs for best engagement</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="text-green-600 font-bold mt-0.5">•</span>
                  <span>Use relevant hashtags to help people discover your content</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="text-green-600 font-bold mt-0.5">•</span>
                  <span>Be authentic - genuine posts resonate more than promotional ones</span>
                </li>
                <li class="flex items-start space-x-2">
                  <span class="text-green-600 font-bold mt-0.5">•</span>
                  <span>Post consistently but don't spam - quality matters more than quantity</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Notes List -->
          <div v-else class="divide-y divide-orange-100/50">
            <div
              v-for="note in visibleNotes"
              :key="note.id"
              class="p-4 sm:p-6 hover:bg-orange-25/50 transition-colors cursor-pointer"
              @click="openDetailedView(note)"
            >
              <div class="flex items-start space-x-4">
                <!-- User Avatar -->
                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                  <img
                    :src="userProfile?.picture || generateAvatar(currentUser?.pubkey)"
                    :alt="userProfile?.name || 'You'"
                    class="w-full h-full object-cover"
                    @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                  />
                </div>

                <!-- Note Content -->
                <div class="flex-1 min-w-0">
                  <!-- Header -->
                  <div class="flex items-center space-x-2 mb-2">
                    <span class="font-medium text-gray-900">{{ userProfile?.name || 'You' }}</span>
                    <span class="text-sm text-gray-500">{{ getTimeAgo(note.created_at) }}</span>
                    <span class="text-xs text-gray-400">•</span>
                    <span class="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">On Nostr</span>
                  </div>
                  
                  <!-- Note Preview -->
                  <div class="mb-3">
                    <NoteContentRenderer
                      :content="note.content"
                      :show-profile-on-click="true"
                      :compact="true"
                      class="text-gray-800 leading-relaxed line-clamp-3"
                    />
                  </div>
                  
                  <!-- Hashtags -->
                  <div v-if="note.hashtags && note.hashtags.length > 0" class="mb-3">
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="tag in note.hashtags.slice(0, 3)"
                        :key="tag"
                        class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs"
                      >
                        <IconHash class="w-3 h-3" />
                        <span>{{ tag }}</span>
                      </span>
                      <span v-if="note.hashtags.length > 3" class="text-xs text-gray-500">
                        +{{ note.hashtags.length - 3 }} more
                      </span>
                    </div>
                  </div>
                  
                  <!-- Engagement and Zap Metrics -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 text-sm">
                      <!-- Engagement Metrics -->
                      <EngagementMetrics
                        :key="`note-engagement-${note.id}`"
                        :engagement-counts="getEngagementCounts(note.id)"
                        :zap-count="getZapCount(note.id)"
                        size="default"
                        text-size="text-sm"
                        :show-all-metrics="true"
                        :show-no-engagement-text="false"
                        :show-tooltips="true"
                      />
                    </div>
                    
                    <!-- Zap Revenue -->
                    <div v-if="getTotalZapAmount(note.id) > 0" class="flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 px-3 py-1 rounded-full">
                      <IconBolt class="w-4 h-4 text-orange-600" />
                      <span class="font-bold text-orange-700 text-sm">{{ formatSatsShort(getTotalZapAmount(note.id)) }} sats</span>
                    </div>
                  </div>
                  
                  <!-- Action Buttons -->
                  <div class="flex items-center space-x-2 mt-3">
                    <button
                      @click.stop="startEditing(note)"
                      class="text-gray-500 hover:text-orange-600 p-2 rounded-lg hover:bg-orange-50 transition-colors"
                      title="Edit note"
                    >
                      <IconEdit class="w-4 h-4" />
                    </button>
                    <button
                      @click.stop="handleDelete(note)"
                      class="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete note"
                    >
                      <IconTrash class="w-4 h-4" />
                    </button>
                    <button
                      @click.stop="copyToClipboard(getNostrClientUrl('primal', note.id), 'noteUrl')"
                      class="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                      title="Copy Nostr URL"
                    >
                      <IconCheck v-if="copySuccess === 'noteUrl'" class="w-4 h-4 text-green-600" />
                      <IconCopy v-else class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <!-- Show more button -->
            <div v-if="notes.length > displayLimit" class="p-4 text-center">
              <button
                @click="displayLimit += 50"
                class="text-sm text-orange-600 hover:text-orange-700 font-medium px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Show more ({{ notes.length - displayLimit }} remaining)
              </button>
            </div>
          </div>
        </div>
        </template>
      </div>

      <!-- Create/Edit View -->
      <div v-else-if="currentView === 'create' || currentView === 'edit'" class="space-y-6">
        <!-- X-style Compose Interface -->
        <div class="bg-white/95 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg overflow-hidden">
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
                {{ currentView === 'edit' ? 'Edit' : 'Draft' }}
              </span>
            </div>
            
            <button
              @click="handleSubmit"
              :disabled="!isFormValid || isLoading"
              class="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white px-6 py-2 rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed"
            >
              <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin inline mr-2" />
              {{ isLoading ? 'Publishing...' : (currentView === 'edit' ? 'Update' : 'Post') }}
            </button>
          </div>
          
          <!-- Compose Area -->
          <div class="p-4">
            <div class="flex space-x-3">
              <!-- User Avatar -->
              <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200 flex-shrink-0">
                <img
                  :src="userProfile?.picture || generateAvatar(currentUser?.pubkey)"
                  :alt="userProfile?.name || 'You'"
                  class="w-full h-full object-cover"
                  @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                />
              </div>

              <!-- Text Input Area -->
              <div class="flex-1">
                <!-- Edit Mode -->
                <div v-if="!showPreview">
                  <MentionInput
                    v-model="noteForm.content"
                    placeholder="What's happening? Type @ to mention someone..."
                    min-height="120px"
                    max-height="400px"
                    :auto-focus="true"
                    @mention-added="handleMentionAdded"
                  />
                </div>

                <!-- Preview Mode -->
                <div v-else class="min-h-[120px] max-h-[400px] overflow-y-auto">
                  <NoteContentRenderer
                    :content="noteForm.content"
                    :show-profile-on-click="true"
                    @mention-click="handleMentionClick"
                    class="text-xl text-gray-800 leading-relaxed"
                  />
                </div>

                <!-- Validation Feedback -->
                <p v-if="!noteForm.content.trim() && noteSubmitAttempted" class="text-xs text-red-500 mt-2">Your note is empty. Write something before posting.</p>

                <!-- Character Counter -->
                <div v-if="noteForm.content.length > 1800" class="flex justify-end mt-2">
                  <div class="relative w-8 h-8">
                    <svg class="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                      <circle
                        cx="16"
                        cy="16"
                        r="14"
                        stroke="currentColor"
                        :stroke-width="noteForm.content.length > 2000 ? '3' : '2'"
                        fill="transparent"
                        :class="noteForm.content.length > 2000 ? 'text-red-400' : 'text-orange-400'"
                        :stroke-dasharray="`${(noteForm.content.length / 2000) * 87.96} 87.96`"
                      />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <span :class="[
                        'text-xs font-medium',
                        noteForm.content.length > 2000 ? 'text-red-600' : 'text-orange-600'
                      ]">
                        {{ 2000 - noteForm.content.length }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Bottom Bar -->
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <div class="flex items-center space-x-3">
                <!-- Preview Toggle -->
                <button
                  v-if="noteForm.content.length > 0"
                  @click="togglePreview"
                  class="text-sm text-gray-600 hover:text-orange-600 px-3 py-1 rounded-lg hover:bg-orange-50 transition-colors flex items-center space-x-1"
                >
                  <IconEye class="w-4 h-4" />
                  <span>{{ showPreview ? 'Edit' : 'Preview' }}</span>
                </button>

                <div class="text-sm text-gray-500 flex items-center space-x-1">
                  <IconUsers class="w-4 h-4" />
                  <span>Everyone can reply</span>
                </div>
              </div>
              
              <!-- Character count and mention count -->
              <div class="flex items-center space-x-3">
                <div v-if="parseMentions(noteForm.content).length > 0" class="text-sm text-orange-600 flex items-center space-x-1">
                  <IconUser class="w-4 h-4" />
                  <span>{{ parseMentions(noteForm.content).length }} mention{{ parseMentions(noteForm.content).length !== 1 ? 's' : '' }}</span>
                </div>
                <div v-if="noteForm.content.length > 0" class="text-sm text-gray-500">
                  {{ noteForm.content.length }}/2000
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Threads Promo Banner -->
        <div class="mt-4">
          <ThreadsPromo variant="notes" />
        </div>
      </div>

      <!-- View Note Modal -->
      <Teleport to="#modal-root">
        <transition name="modal-transition">
          <div v-if="showViewModal && enhancedSelectedNote" class="fixed inset-0 bg-black/60 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
            <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
              <!-- Modal Header -->
              <div class="flex items-center justify-between p-6 border-b border-gray-200">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-200">
                    <img
                      :src="userProfile?.picture || generateAvatar(currentUser?.pubkey)"
                      :alt="userProfile?.name || 'You'"
                      class="w-full h-full object-cover"
                      @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                    />
                  </div>
                  <div>
                    <div class="flex items-center space-x-2">
                      <h3 class="font-semibold text-gray-900">{{ userProfile?.name || 'Your Note' }}</h3>
                    </div>
                    <p class="text-sm text-gray-500">{{ enhancedSelectedNote.formattedDate }}</p>
                  </div>
                </div>
                <button
                  @click="closeDetailedView"
                  class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>

              <!-- Modal Content -->
              <div class="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
                <!-- Note Content -->
                <div class="mb-6">
                  <div class="prose prose-lg max-w-none">
                    <NoteContentRenderer
                      :content="enhancedSelectedNote.content"
                      :show-profile-on-click="true"
                      @mention-click="handleMentionClick"
                      class="text-gray-800 leading-relaxed"
                    />
                  </div>
                </div>

                <!-- Note Metadata -->
                <div class="bg-gray-50 rounded-xl p-4 mb-6">
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <div class="text-lg font-bold text-gray-900">{{ enhancedSelectedNote.wordCount }}</div>
                      <div class="text-xs text-gray-600">Words</div>
                    </div>
                    <div>
                      <div class="text-lg font-bold text-gray-900">{{ enhancedSelectedNote.readTime }}m</div>
                      <div class="text-xs text-gray-600">Read time</div>
                    </div>
                    <div>
                      <div class="text-lg font-bold text-orange-600">{{ enhancedSelectedNote.totalZaps }}</div>
                      <div class="text-xs text-gray-600">Sats earned</div>
                    </div>
                    <div>
                      <div class="text-lg font-bold text-purple-600">{{ enhancedSelectedNote.zapCount }}</div>
                      <div class="text-xs text-gray-600">Zaps</div>
                    </div>
                  </div>
                </div>

                <!-- Engagement Metrics -->
                <div class="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                  <h4 class="font-semibold text-gray-900 mb-3">Engagement</h4>
                  <div class="flex items-center space-x-6">
                    <EngagementMetrics 
                      :engagement-counts="enhancedSelectedNote.engagementData"
                      :zap-count="enhancedSelectedNote.zapCount"
                      size="large"
                      text-size="text-base"
                      :show-all-metrics="true"
                      :show-no-engagement-text="true"
                      :show-tooltips="true"
                    />
                  </div>
                </div>

                <!-- Zaps Section -->
                <div v-if="enhancedSelectedNote.zapData.length > 0" class="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                  <h4 class="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <IconBolt class="w-5 h-5 text-orange-600" />
                    <span>Lightning Zaps ({{ enhancedSelectedNote.zapCount }})</span>
                  </h4>
                  
                  <div class="space-y-3 max-h-48 overflow-y-auto">
                    <div
                      v-for="zap in enhancedSelectedNote.zapData.slice(0, 10)"
                      :key="zap.id"
                      class="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
                      @click="showZapperDetails(zap)"
                    >
                      <img
                        :src="zap.sender?.picture || zap.sender?.avatar"
                        :alt="zap.sender?.name || 'Zapper'"
                        class="w-8 h-8 rounded-full object-cover border border-orange-200"
                        @error="$event.target.src = generateAvatar(currentUser?.pubkey)"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-gray-900 text-sm">
                          {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                        </div>
                        <div class="text-xs text-gray-500">{{ formatZapTime(new Date(zap.timestamp).getTime() / 1000) }}</div>
                      </div>
                      <div class="text-sm font-bold text-orange-600">
                        {{ formatSatsShort(zap.amount) }} sats
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Technical Details -->
                <div class="bg-gray-50 rounded-xl p-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="font-semibold text-gray-900">Technical Details</h4>
                    <button
                      @click="showRawData"
                      class="text-sm text-gray-600 hover:text-gray-800 underline"
                    >
                      View Raw Event
                    </button>
                  </div>
                  
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-600">Event ID:</span>
                      <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs">
                        {{ enhancedSelectedNote.id.substring(0, 16) }}...
                      </code>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Published:</span>
                      <span class="text-gray-800">{{ enhancedSelectedNote.formattedDate }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-600">Kind:</span>
                      <span class="text-gray-800">1 (Text Note)</span>
                    </div>
                  </div>
                  
                  <!-- External Links -->
                  <div class="mt-4 pt-4 border-t border-gray-200">
                    <p class="text-sm font-medium text-gray-700 mb-2">View on:</p>
                    <div class="flex space-x-2">
                      <a
                        :href="getNostrClientUrl('primal', enhancedSelectedNote.id)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 transition-colors"
                      >
                        🌐 Primal
                      </a>
                      <a
                        :href="getNostrClientUrl('yakihonne', enhancedSelectedNote.id)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 transition-colors"
                      >
                        🍜 Yakihonne
                      </a>
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
            <div class="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
              <div class="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">Raw Nostr Event</h3>
                <button
                  @click="showRawDataModal = false"
                  class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <IconX class="w-5 h-5" />
                </button>
              </div>
              <div class="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <pre class="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto"><code>{{ formatRawEvent(enhancedSelectedNote) }}</code></pre>
              </div>
            </div>
          </div>
        </transition>
      </Teleport>

    </div> <!-- closes <div v-else> -->
  </div>   <!-- closes <div class="space-y-6"> -->

  <!-- Note Success Modal -->
  <NoteSuccessModal
    :show="showSuccessModal"
    :content="noteForm.content"
    content-type="note"
    :publish-result="lastPublishResult"
    @close="closeSuccessModal"
  />

</template>