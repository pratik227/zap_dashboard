<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
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
  IconAlertTriangle
} from '@iconify-prerendered/vue-tabler'
import { useNostrNotes } from '../composables/useNostrNotes.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useContentZaps } from '../composables/useContentZaps.js'
import { useBtcPrice } from '../composables/useBtcPrice.js'

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

// Use BTC price composable
const { satsToUSD, formatUSD } = useBtcPrice()


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
  // Set the content in the textarea
  noteForm.content = note.content
}

const startCreating = () => {
  createNewNote()
  noteForm.content = ''
}

// Open view popup
const openViewPopup = (note) => {
  selectedNote.value = note
  showViewPopup.value = true
}

// Close view popup
const closeViewPopup = () => {
  showViewPopup.value = false
  selectedNote.value = null
}

// Computed properties
const isFormValid = computed(() => {
  return noteForm.content.trim().length > 0
})

// Calculate total zap revenue in USD
const revenueInUSD = computed(() => {
  return formatUSD(satsToUSD(noteStats.value.totalZapRevenue))
})

const noteStats = computed(() => {
  // Calculate total zap revenue across all notes
  const totalZapRevenue = notes.value.reduce((sum, note) => {
    return sum + getTotalZapAmount(note.id)
  }, 0)
  
  return {
    total: notes.value.length,
    thisWeek: notes.value.filter(note => {
      const noteDate = new Date(note.created_at * 1000)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return noteDate > weekAgo
    }).length,
    totalZapRevenue
  }
})

// UI state
const showViewPopup = ref(false)

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

onMounted(() => {
  // Expose debug function globally for console access
  window.debugNotes = debugState
  
  // Start tracking zaps for all notes
  if (isAuthenticated.value && notes.value.length > 0) {
    notes.value.forEach(note => {
      startZapTracking(note.id)
    })
  }
})

// Watch for notes changes to track zaps on new notes
watch(notes, (newNotes) => {
  if (isAuthenticated.value && newNotes.length > 0) {
    newNotes.forEach(note => {
      startZapTracking(note.id)
    })
  }
}, { deep: true })

onUnmounted(() => {
  // Clean up subscriptions when component unmounts
  cleanup()
  // Remove global debug function
  delete window.debugNotes
})
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
       <div>
  <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
    <IconFileText class="w-6 h-6 text-orange-600" />
    <span>My Notes</span>
  </h1>
  <p class="text-gray-600">
    Welcome back, {{ userProfile?.name || 'Creator' }}! Write and publish notes to the Nostr network.
  </p>
</div>


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
<!--          <button-->
<!--            v-if="currentView === 'list'"-->
<!--            @click="cleanupDuplicateNotes"-->
<!--            class="btn-secondary text-sm"-->
<!--            title="Clean up duplicate notes"-->
<!--          >-->
<!--            <IconLoader class="w-4 h-4" />-->
<!--            Cleanup-->
<!--          </button>-->
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
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <!-- Total Zap Revenue Card - Now Highlighted -->
          <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-4 rounded-xl shadow-sm">
            <div class="flex flex-col">
              <p class="text-orange-100 text-sm mb-1">Total Zap Revenue</p>
              <p class="text-3xl font-bold mb-1">{{ noteStats.totalZapRevenue.toLocaleString() }}</p>
              <p class="text-orange-100 text-xs">
                ≈ {{ revenueInUSD }} USD
              </p>
            </div>
            <div class="flex justify-end">
              <IconBolt class="w-8 h-8 text-orange-200" />
            </div>
          </div>
          
          <!-- Total Notes Card - Now Regular -->
          <div class="bg-white p-4 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex flex-col">
              <p class="text-gray-600 text-sm mb-1">Total Notes</p>
              <p class="text-2xl font-bold text-gray-900">{{ noteStats.total }}</p>
            </div>
            <div class="flex justify-end">
              <IconFileText class="w-8 h-8 text-orange-600" />
            </div>
          </div>
          
          <!-- This Week Card - Commented Out -->
          <!-- <div class="bg-white p-4 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex flex-col">
              <p class="text-gray-600 text-sm">This Week</p>
              <p class="text-3xl font-bold text-gray-900">{{ noteStats.thisWeek }}</p>
            </div>
            <div class="flex justify-end">
              <IconCalendar class="w-8 h-8 text-orange-600" />
            </div>
          </div> -->
          
          <!-- On Nostr Card -->
          <div class="bg-white p-4 rounded-xl border border-orange-100/50 shadow-sm">
            <div class="flex flex-col">
              <p class="text-gray-600 text-sm mb-1">On Nostr</p>
              <p class="text-2xl font-bold text-purple-600">{{ noteStats.total }}</p>
            </div>
            <div class="flex justify-end">
              <IconBolt class="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        <!-- Notes List -->
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
            <div
              v-for="note in notes"
              :key="note.id"
              class="p-4 hover:bg-orange-25/50 transition-colors cursor-pointer"
              @click="viewNote(note)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <h4 class="font-semibold text-gray-900 mb-2 truncate">
                    <div v-html="note.title"></div>
                  </h4>
<!--                  <p class="text-sm text-gray-600 mb-3 line-clamp-2">-->
<!--                    <div v-html="note.preview"></div>-->
<!--                  </p>-->
                  
                  <div class="flex items-center space-x-4 text-xs text-gray-500">
                    <span class="flex items-center space-x-1">
                      <IconCalendar class="w-3 h-3" />
                      <span>{{ formatDate(note.created_at) }}</span>
                    </span>
                    <span v-if="getZapCount(note.id) > 0" class="flex items-center space-x-1 text-orange-600 whitespace-nowrap">
                      <IconBolt class="w-3 h-3" />
                      <span>{{ formatZapAmount(getTotalZapAmount(note.id)) }} sats ({{ getZapCount(note.id) }})</span>
                    </span>
                    <span v-if="note.hashtags && note.hashtags.length > 0" class="flex items-center space-x-1">
                      <IconHash class="w-3 h-3" />
                      <span>{{ note.hashtags.slice(0, 2).join(', ') }}</span>
                      <span v-if="note.hashtags.length > 2">+{{ note.hashtags.length - 2 }}</span>
                    </span>
                  </div>
                </div>
                
                <div class="flex items-center space-x-2 ml-4">
<!--                  <button-->
<!--                    @click.stop="openViewPopup(note)"-->
<!--                    class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"-->
<!--                    title="View note"-->
<!--                  >-->
<!--                    <IconEye class="w-4 h-4" />-->
<!--                  </button>-->
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

      <!-- Create/Edit Note View -->
      <div v-else-if="currentView === 'create' || currentView === 'edit'">
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <h2 class="text-xl font-semibold text-gray-900">
              {{ currentView === 'edit' ? 'Edit Note' : 'Create New Note' }}
            </h2>
            <p class="text-gray-600 text-sm mt-1">
              Write down your thoughts. It will be published to the Nostr network.
            </p>
          </div>

          <!-- Edit Note Info Alert - Only show when editing -->
          <div v-if="currentView === 'edit'" class="px-6 pt-4">
            <div class="p-3 bg-amber-50 rounded-lg mb-4 border border-amber-200">
              <div class="flex items-start space-x-3">
                <IconAlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-medium text-amber-900 mb-1">How Nostr Edits Work</h4>
                  <p class="text-sm text-amber-800">
                    Nostr doesn't support direct editing of events. When you "edit" a note, we'll publish a new note and mark the original for deletion. This creates a new event ID and resets engagement metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="p-6">
            <!-- Plain Text Note Info -->
            <div class="p-3 bg-blue-50 rounded-lg mb-4 border border-blue-200">
              <div class="flex items-start space-x-3">
                <IconAlertTriangle class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 class="font-medium text-blue-900 mb-1">Plain Text Notes</h4>
                  <p class="text-sm text-blue-800">
                    Nostr notes (kind:1) only support plain text. Formatting like bold, italic, or headings is not supported.
                    Use hashtags with # to make your notes discoverable.
                  </p>
                </div>
              </div>
            </div>

            <!-- Plain Text Editor -->
            <div class="border border-orange-200/50 rounded-lg overflow-hidden">
              <textarea
                v-model="noteForm.content"
                placeholder="Write your note here... Use #hashtags to make your note discoverable."
                class="w-full min-h-[300px] p-4 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                rows="12"
              ></textarea>
            </div>

            <!-- Hashtag Help -->
            <div class="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <h4 class="font-medium text-orange-900 mb-2">Hashtag Tips</h4>
              <div class="text-sm text-orange-800 space-y-1">
                <p>Use <code>#hashtags</code> to categorize your notes and make them discoverable</p>
                <p>Example: <code>Just had a great coffee! #coffee #morning</code></p>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end space-x-3 mt-6">
              <button
                @click="setView('list')"
                class="btn-secondary"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="!isFormValid || isLoading"
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
                <IconSend v-else class="w-4 h-4" />
                {{ isLoading ? 'Publishing...' : (currentView === 'edit' ? 'Update Note' : 'Publish Note') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- View Note -->
      <div v-else-if="currentView === 'view' && selectedNote">
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
          <div class="p-6 border-b border-orange-100/50">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">
                  <div v-html="selectedNote.title"></div>
                </h2>
                <div class="flex items-center space-x-4 text-sm text-gray-600">
                  <span class="flex items-center space-x-1">
                    <IconCalendar class="w-4 h-4" />
                    <span>{{ formatDate(selectedNote.created_at) }}</span>
                  </span>
                  <span class="flex items-center space-x-1">
                    <IconUser class="w-4 h-4" />
                    <span>{{ userProfile?.name || 'You' }}</span>
                  </span>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                <button
                  @click="startEditing(selectedNote)"
                  class="btn-secondary"
                >
                  <IconEdit class="w-4 h-4" />
                  Edit
                </button>
                <button
                  @click="handleDelete(selectedNote)"
                  class="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <IconTrash class="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>

          <div class="p-6">
            <!-- Hashtags -->
            <div v-if="selectedNote.hashtags && selectedNote.hashtags.length > 0" class="mb-6">
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in selectedNote.hashtags"
                  :key="tag"
                  class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
                >
                  <IconHash class="w-3 h-3" />
                  <span>{{ tag }}</span>
                </span>
                <span v-if="getZapCount(selectedNote.id) > 0" class="flex items-center space-x-1">
                  <IconBolt class="w-4 h-4 text-orange-600" />
                  <span class="text-orange-600 whitespace-nowrap">{{ formatZapAmount(getTotalZapAmount(selectedNote.id)) }} sats ({{ getZapCount(selectedNote.id) }})</span>
                </span>
              </div>
            </div>

            <!-- Note Content -->
            <div class="border border-gray-200 rounded-lg p-4 min-h-[200px] bg-white">
              <p class="whitespace-pre-wrap text-gray-800">{{ selectedNote?.content }}</p>
            </div>

            <!-- Nostr Event Details -->
            <div class="mt-8 pt-6 border-t border-gray-200">
              <h4 class="text-sm font-medium text-gray-700 mb-3">Nostr Event Details</h4>
              <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Event ID:</span>
                  <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs">
                    {{ selectedNote.id.substring(0, 16) }}...
                  </code>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Kind:</span>
                  <span class="text-gray-800">1 (Text Note)</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Published:</span>
                  <span class="text-gray-800">{{ new Date(selectedNote.created_at * 1000).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- View Note Popup -->
  <div v-if="showViewPopup && selectedNote" class="fixed inset-0 z-50 overflow-y-auto">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black bg-opacity-50 transition-opacity" @click="closeViewPopup"></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
      <div class="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 class="text-xl font-semibold text-gray-900 mb-2">
              <div v-html="selectedNote.title"></div>
            </h2>
            <div class="flex items-center space-x-4 text-sm text-gray-600">
              <span class="flex items-center space-x-1">
                <IconCalendar class="w-4 h-4" />
                <span>{{ formatDate(selectedNote.created_at) }}</span>
              </span>
              <span class="flex items-center space-x-1">
                <IconUser class="w-4 h-4" />
                <span>{{ userProfile?.name || 'You' }}</span>
              </span>
            </div>
          </div>
          
          <div class="flex items-center space-x-2">
            <button
              @click="startEditing(selectedNote); closeViewPopup()"
              class="btn-secondary"
            >
              <IconEdit class="w-4 h-4" />
              Edit
            </button>
            <button
              @click="handleDelete(selectedNote); closeViewPopup()"
              class="btn-secondary text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <IconTrash class="w-4 h-4" />
              Delete
            </button>
            <button
              @click="closeViewPopup"
              class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <!-- Hashtags -->
          <div v-if="selectedNote.hashtags && selectedNote.hashtags.length > 0" class="mb-6">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in selectedNote.hashtags"
                :key="tag"
                class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
              >
                <IconHash class="w-3 h-3" />
                <span>{{ tag }}</span>
              </span>
            </div>
          </div>

          <!-- Note Content -->
          <div class="border border-gray-200 rounded-lg p-4 min-h-[200px] bg-white">
            <p class="whitespace-pre-wrap text-gray-800">{{ selectedNote?.content }}</p>
          </div>

          <!-- Zap Information -->
          <div v-if="selectedNote && getZapCount(selectedNote.id) > 0" class="mt-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <IconBolt class="w-5 h-5 text-orange-600" />
                <span>Zaps Received</span>
              </h3>
              <div class="flex items-center space-x-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-orange-600">{{ getZapCount(selectedNote.id) }}</div>
                  <div class="text-xs text-gray-600">Total Zaps</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-orange-600">{{ formatZapAmount(getTotalZapAmount(selectedNote.id)) }} ({{ getZapCount(selectedNote.id) }})</div>
                  <div class="text-xs text-gray-600">Total Sats</div>
                </div>
              </div>
            </div>

            <!-- Zap List -->
            <div class="space-y-3 max-h-60 overflow-y-auto">
              <div
                v-for="zap in getZapsForContent(selectedNote.id)"
                :key="zap.id"
                class="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 rounded-full overflow-hidden">
                    <img 
                      :src="zap.sender?.avatar || zap.sender?.picture" 
                      :alt="zap.sender?.name || 'User'"
                      class="w-full h-full object-cover"
                      @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                    />
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">{{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}</div>
                    <div class="text-sm text-gray-600">{{ formatZapTime(zap.timestamp) }}</div>
                    <div v-if="zap.message" class="text-sm text-gray-700 italic">"{{ zap.message }}"</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-orange-600">{{ formatZapAmount(zap.amount) }} sats</div>
                </div>
              </div>
            </div>
          </div>
          <!-- Zap Information -->
          <div v-if="selectedNote && getZapCount(selectedNote.id) > 0" class="mt-6 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <IconBolt class="w-5 h-5 text-orange-600" />
                <span>Zaps Received</span>
              </h3>
              <div class="flex items-center space-x-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-orange-600">{{ getZapCount(selectedNote.id) }}</div>
                  <div class="text-xs text-gray-600">Total Zaps</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-orange-600">{{ formatZapAmount(getTotalZapAmount(selectedNote.id)) }}</div>
                  <div class="text-xs text-gray-600">Total Sats</div>
                </div>
              </div>
            </div>

            <!-- Zap List -->
            <div class="space-y-3 max-h-60 overflow-y-auto">
              <div
                v-for="zap in getZapsForContent(selectedNote.id)"
                :key="zap.id"
                class="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-8 h-8 rounded-full overflow-hidden">
                    <img 
                      :src="zap.sender?.avatar || zap.sender?.picture" 
                      :alt="zap.sender?.name || 'User'"
                      class="w-full h-full object-cover"
                      @error="$event.target.src = 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'"
                    />
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">{{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}</div>
                    <div class="text-sm text-gray-600">{{ formatZapTime(zap.timestamp) }}</div>
                    <div v-if="zap.message" class="text-sm text-gray-700 italic">"{{ zap.message }}"</div>
                  </div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-orange-600">{{ formatZapAmount(zap.amount) }} sats</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Nostr Event Details -->
          <!-- <div class="mt-8 pt-6 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-700 mb-3">Nostr Event Details</h4>
            <div class="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Event ID:</span>
                <code class="text-gray-800 bg-gray-200 px-2 py-1 rounded text-xs">
                  {{ selectedNote.id.substring(0, 16) }}...
                </code>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Kind:</span>
                <span class="text-gray-800">1 (Text Note)</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-gray-600">Published:</span>
                <span class="text-gray-800">{{ new Date(selectedNote.created_at * 1000).toLocaleString() }}</span>
              </div>
            </div>
          </div> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Scrollable areas */
.max-h-60 {
  max-height: 15rem;
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

/* Plain text editor styles */
textarea {
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}

.whitespace-pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>