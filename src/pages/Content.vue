<script setup>
import { computed, onMounted, ref, onUnmounted } from 'vue'
import * as nip19 from 'nostr-tools/nip19'
import {
  IconFileText,
  IconPlus,
  IconEye,
  IconChartBar,
  IconArrowLeft,
  IconUser,
  IconLock,
  IconBolt,
  IconShare,
  IconLoader,
  IconCheck,
  IconAlertCircle,
  IconExternalLink,
  IconChevronDown,
  IconHash
} from '@iconify-prerendered/vue-tabler'
import { useContent } from '../composables/useContent.js'
import { useContentZaps } from '../composables/useContentZaps.js'
import { useNostrAuth } from '../composables/useNostrAuth.js'
import { useNostrLongForm } from '../composables/useNostrLongForm.js'
import { generateFallbackAvatar } from '../composables/useContentZaps.js'
import ContentStats from '../components/ContentStats.vue'
import ContentList from '../components/ContentList.vue'
import ContentForm from '../components/ContentForm.vue'
import ContentPerformance from '../components/ContentPerformance.vue'

const { isAuthenticated, currentUser, userProfile, login } = useNostrAuth()

// UI state for dropdown
const showClientDropdown = ref(false)
const dropdownRef = ref(null)

// Use the long-form content composable
const { fetchUserLongFormContent } = useNostrLongForm()

const {
  // State
  contentItems,
  contentForm,
  currentView,
  editingContent,
  selectedContent,
  isLoading,
  error,
  publishingStatus,
  publishingProgress,

  // Computed
  contentStats,
  publishedItems,
  draftItems,

  // Actions
  createContent,
  updateContent,
  deleteContent,
  publishContent,
  unpublishContent,
  duplicateContent,
  publishToNostr,

  // View management
  setView,
  editContent,
  previewContent,

  // Zap functions
  getZapsForContent,
  getTotalZapAmount,
  getZapCount
} = useContent()

// Ensure contentForm has all required properties
if (!contentForm.description) {
  contentForm.description = ''
}

const { getAllContentZaps } = useContentZaps()


const handleCreateContent = async () => {
  try {
    await createContent({ ...contentForm })
  } catch (error) {
    console.error('Failed to create content:', error)
  }
}

const handleUpdateContent = async () => {
  if (!editingContent.value) return

  try {
    await updateContent(editingContent.value.id, { ...contentForm })
    setView('list')
  } catch (error) {
    console.error('Failed to update content:', error)
  }
}

const handleSaveDraft = async () => {
  const contentData = {
    ...contentForm,
    status: 'draft'
  }

  if (editingContent.value) {
    await updateContent(editingContent.value.id, contentData)
    setView('list')
  } else {
    await createContent(contentData)
  }
}

const handleDeleteContent = async (content) => {
  if (confirm(`Are you sure you want to delete "${content.title}"?`)) {
    try {
      await deleteContent(content.id)
    } catch (error) {
      console.error('Failed to delete content:', error)
    }
  }
}

const handleDuplicateContent = async (content) => {
  try {
    await duplicateContent(content.id)
  } catch (error) {
    console.error('Failed to duplicate content:', error)
  }
}

const handleShareContent = (content) => {
  // Create share URL for content unlock
  const shareUrl = content.nostrEventId
    ? `${window.location.origin}?page=content-unlock&eventId=${content.nostrEventId}`
    : `${window.location.origin}?page=content&id=${content.id}`

  navigator.clipboard.writeText(shareUrl).then(() => {
    alert('Share link copied to clipboard!')
  })
}

const handlePublishToNostr = async (content) => {
  try {
    const result = await publishToNostr(content.id)

    // Show success message with details
    let message = `Content published successfully!\n\nEvent ID: ${result.event.id}\nPublished to ${result.successfulRelays} relay${result.successfulRelays !== 1 ? 's' : ''}`

    if (result.failedRelays > 0) {
      message += `\n\nNote: ${result.failedRelays} relay${result.failedRelays !== 1 ? 's' : ''} failed to publish`
    }

    alert(message)
  } catch (error) {
    console.error('Failed to publish to Nostr:', error)
    alert('Failed to publish to Nostr: ' + error.message)
  }
}

const handleNostrLogin = async () => {
  try {
    await login()
  } catch (error) {
    console.error('Login failed:', error)
  }
}

// Parse markdown content to HTML
const parseMarkdown = (content) => {
  if (!content) return ''
  
  let html = content
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Parse markdown syntax
  html = html
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-6">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-12 mb-8">$1</h1>')
    
    // Bold and italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold"><em class="italic">$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700">$1</em>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-orange-600 hover:text-orange-700 underline underline-offset-2 transition-colors">$1</a>')
    
    // Code blocks (triple backticks)
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 border border-gray-200 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm font-mono text-gray-800">$1</code></pre>')
    
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono">$1</code>')
    
    // Unordered lists
    .replace(/^[\s]*[-*+] (.+)$/gm, '<li class="ml-4 mb-2 text-gray-700">$1</li>')
    
    // Ordered lists
    .replace(/^[\s]*\d+\. (.+)$/gm, '<li class="ml-4 mb-2 text-gray-700">$1</li>')
    
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-orange-400 pl-4 py-2 my-4 bg-orange-50/50 italic text-gray-700">$1</blockquote>')
    
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="border-t border-gray-300 my-8">')
    
    // Line breaks (convert double newlines to paragraphs)
    .replace(/\n\n/g, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
    
    // Single line breaks
    .replace(/\n/g, '<br>')
  
  // Wrap in paragraph tags if not already wrapped
  if (!html.includes('<p>') && !html.includes('<h1>') && !html.includes('<h2>') && !html.includes('<h3>')) {
    html = `<p class="mb-4 text-gray-700 leading-relaxed">${html}</p>`
  } else if (html.includes('</p><p>')) {
    html = `<p class="mb-4 text-gray-700 leading-relaxed">${html}</p>`
  }
  
  // Wrap lists in proper ul/ol tags
  html = html.replace(/(<li class="ml-4 mb-2 text-gray-700">.*?<\/li>)/gs, (match) => {
    return `<ul class="list-disc list-inside mb-4 space-y-2">${match}</ul>`
  })
  
  return html
}

const activeTab = computed(() => {
  if (currentView.value === 'list') return 'my-content'
  if (currentView.value === 'create' || currentView.value === 'edit') return 'create-new'
  return 'my-content'
})

const setActiveTab = (tab) => {
  if (tab === 'my-content') {
    setView('list')
  } else if (tab === 'create-new') {
    setView('create')
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

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

// Toggle client dropdown
const toggleClientDropdown = () => {
  showClientDropdown.value = !showClientDropdown.value
}

// Get URL for different Nostr clients for long-form content
const getNostrClientUrl = (client, content) => {
  if (!content || !content.nostrEventId) return '#'

  try {
    switch (client) {
      case 'yakihonne':
        // For long-form content (kind 30023), use naddrEncode if we have the necessary data
        if (content.creatorPubkey && content.id && content.nostrEventId) {
          // Create naddr format for long-form content
          return `https://yakihonne.com/article/${nip19.naddrEncode({
            pubkey: content.creatorPubkey,
            kind: 30023,
            identifier: content.id
          })}`
        }
        // Fallback to nevent format
        return `https://yakihonne.com/${nip19.neventEncode({ id: content.nostrEventId })}`
      case 'primal':
        if (content.creatorPubkey && content.id && content.nostrEventId) {
          // Create naddr format for long-form content
          return `https://primal.net/a/${nip19.naddrEncode({
            pubkey: content.creatorPubkey,
            kind: 30023,
            identifier: content.id
          })}`
        }
        return `https://primal.net/e/${content.nostrEventId}`
      default:
        return `https://primal.net/e/${content.nostrEventId}`
    }
  } catch (error) {
    console.error('Failed to generate client URL:', error)
    return '#'
  }
}

// Add/remove event listener for dropdown
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
              Connect your Nostr identity to create, manage, and publish premium content.
              Your content will be stored locally and can be published to the Nostr network.
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
<!--          <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">-->
<!--            <IconFileText class="w-6 h-6 text-orange-600" />-->
<!--            <span>Content Studio</span>-->
<!--          </h1>-->
<!--          <p class="text-gray-600">-->
<!--            Welcome back, {{ userProfile?.name || 'Creator' }}! Create and publish long-form content to the Nostr network.-->
<!--          </p>-->
        </div>

        <div class="flex items-center space-x-3 mb-4">
          <button
            v-if="currentView !== 'list' && !selectedContent"
            @click="setView('list')"
            class="btn-secondary"
          >
            <IconArrowLeft class="w-4 h-4" />
            Back
          </button>
          <button
            v-if="currentView === 'list'"
            @click="setView('performance')"
            class="btn-secondary"
          >
            <IconChartBar class="w-4 h-4" />
            Analytics
          </button>
          <button
            v-if="currentView === 'list'"
            @click="setView('create')"
            class="btn-primary"
          >
            <IconPlus class="w-4 h-4" />
            Create Content
          </button>
        </div>
      </div>

      <!-- Publishing Status -->
      <div v-if="publishingStatus" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="flex items-center space-x-3">
          <IconLoader v-if="isLoading" class="w-5 h-5 text-blue-600 animate-spin" />
          <IconCheck v-else-if="publishingStatus.includes('Successfully')" class="w-5 h-5 text-green-600" />
          <IconAlertCircle v-else-if="publishingStatus.includes('failed')" class="w-5 h-5 text-red-600" />
          <IconShare v-else class="w-5 h-5 text-blue-600" />

          <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">{{ publishingStatus }}</p>
            <div v-if="publishingProgress > 0 && publishingProgress < 100" class="mt-2">
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  :style="{ width: publishingProgress + '%' }"
                ></div>
              </div>
              <p class="text-xs text-gray-600 mt-1">{{ publishingProgress }}% complete</p>
            </div>
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

      <!-- Main Content -->
      <div v-if="currentView === 'list'">
        <!-- Stats Overview -->
        <ContentStats :stats="contentStats" />

        <!-- Content Tabs -->
        <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden mt-6">
          <!-- Tab Navigation -->
          <div class="border-b border-orange-100/50">
            <nav class="flex space-x-8 px-6" aria-label="Content tabs">
              <button
                @click="setActiveTab('my-content')"
                :class="[
                  'flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200',
                  activeTab === 'my-content'
                    ? 'border-orange-400 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                <IconFileText class="w-4 h-4" />
                <span>My Content ({{ contentItems.length }})</span>
              </button>
            </nav>
          </div>

          <!-- Content List -->
          <div class="p-6">
            <ContentList
              :items="contentItems"
              @edit="editContent"
              @delete="handleDeleteContent"
              @preview="previewContent"
              @duplicate="handleDuplicateContent"
              @share="handleShareContent"
              @publish-nostr="handlePublishToNostr"
            />
          </div>
        </div>
      </div>

      <!-- Create/Edit Content Form -->
      <div v-else-if="currentView === 'create' || currentView === 'edit'">
        <ContentForm
          :form="contentForm"
          :is-editing="currentView === 'edit'"
          :is-loading="isLoading"
          :is-authenticated="isAuthenticated"
          @submit="currentView === 'edit' ? handleUpdateContent() : handleCreateContent()"
          @save-draft="handleSaveDraft"
          @cancel="setView('list')"
        />
      </div>

      <!-- Content Preview -->
      <div v-else-if="currentView === 'preview' && selectedContent">
        <!-- Compact Header -->
        <div class="mb-6">
          <div class="">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <h2 class="text-lg font-semibold text-gray-900">Content Preview</h2>
              </div>
              <div class="flex items-center space-x-2">
                <!-- Open in Client Dropdown -->
<!--                <div v-if="selectedContent.nostrEventId" class="relative" ref="dropdownRef">-->
<!--                  <button-->
<!--                    @click="toggleClientDropdown"-->
<!--                    class="btn-secondary text-xs"-->
<!--                  >-->
<!--                    <IconExternalLink class="w-3 h-3" />-->
<!--                    <span class="hidden sm:inline">Open</span>-->
<!--                    <IconChevronDown :class="['w-3 h-3 transition-transform', showClientDropdown ? 'rotate-180' : '']" />-->
<!--                  </button>-->

<!--                  &lt;!&ndash; Client Dropdown &ndash;&gt;-->
<!--                  <div-->
<!--                    v-if="showClientDropdown"-->
<!--                    class="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"-->
<!--                  >-->
<!--                    <a :href="getNostrClientUrl('primal', selectedContent)" target="_blank" rel="noopener noreferrer"-->
<!--                       class="block px-3 py-1.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-1.5">-->
<!--                      <span class="text-orange-600">🌐</span>-->
<!--                      <span>Primal</span>-->
<!--                    </a>-->
<!--                    <a :href="getNostrClientUrl('yakihonne', selectedContent)" target="_blank" rel="noopener noreferrer"-->
<!--                       class="block px-3 py-1.5 text-xs text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-1.5">-->
<!--                      <span class="text-purple-600">🍜</span>-->
<!--                      <span>Yakihonne</span>-->
<!--                    </a>-->
<!--                  </div>-->
<!--                </div>-->

                <button
                  v-if="selectedContent.status === 'draft'"
                  @click="handlePublishToNostr(selectedContent)"
                  :disabled="isLoading"
                  class="btn-primary text-xs disabled:opacity-50"
                >
                  <IconLoader v-if="isLoading" class="w-3 h-3 animate-spin" />
                  <IconShare v-else class="w-3 h-3" />
                  <span class="hidden sm:inline">{{ isLoading ? 'Publishing...' : 'Publish' }}</span>
                </button>


                <button @click="setView('list')" class="btn-secondary">
                  <IconArrowLeft class="w-4 h-4" />
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Single Unified Blog Container -->
          <div class="lg:col-span-2">
            <article class="bg-white/95 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-lg overflow-hidden">
              <!-- Article Header -->
              <header class="px-8 pt-8 pb-6 border-b border-gray-100">
                <!-- Status Badges Row -->
                <div class="flex flex-wrap items-center gap-2 mb-6">
                  <span :class="[
                    'px-3 py-1.5 rounded-full text-sm font-medium',
                    selectedContent.status === 'published' ? 'bg-green-100 text-green-700' :
                    selectedContent.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  ]">
                    {{ selectedContent.status.charAt(0).toUpperCase() + selectedContent.status.slice(1) }}
                  </span>

                  <span class="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {{ selectedContent.type.charAt(0).toUpperCase() + selectedContent.type.slice(1) }}
                  </span>

                  <span class="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Free
                  </span>

                  <span v-if="selectedContent.nostrEventId" class="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    On Nostr
                  </span>
                  
                  <!-- Zap Badge -->
                  <span v-if="selectedContent.nostrEventId && getTotalZapAmount(selectedContent.nostrEventId) > 0" 
                        class="px-3 py-1.5 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 rounded-full text-sm font-medium flex items-center space-x-1">
                    <IconBolt class="w-4 h-4" />
                    <span>{{ formatZapAmount(getTotalZapAmount(selectedContent.nostrEventId)) }} sats</span>
                    <span class="text-orange-500">({{ getZapCount(selectedContent.nostrEventId) }})</span>
                  </span>
                </div>
                
                <!-- Article Title -->
                <h1 class="text-4xl font-bold text-gray-900 leading-tight mb-4">
                  {{ selectedContent.title }}
                </h1>
                
                <!-- Hashtags (moved after title) -->
                <div v-if="selectedContent.tags && selectedContent.tags.length > 0" class="mb-6">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in selectedContent.tags"
                      :key="tag"
                      class="inline-flex items-center space-x-1 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-3 py-2 rounded-full text-sm font-medium hover:from-orange-200 hover:to-amber-200 transition-all duration-200 cursor-pointer"
                    >
                      <IconHash class="w-3 h-3" />
                      <span>{{ tag }}</span>
                    </span>
                  </div>
                </div>
                
                <!-- Article Summary -->
                <div v-if="selectedContent.description" class="mb-6">
                  <p class="text-xl text-gray-600 leading-relaxed italic border-l-4 border-orange-400 pl-4 bg-orange-50/50 py-3 rounded-r-lg">
                    {{ selectedContent.description }}
                  </p>
                </div>
                
                <!-- Author & Meta Information -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-4">
                    <!-- Author Avatar -->
                    <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-200">
                      <img 
                        :src="userProfile?.picture || 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'" 
                        :alt="userProfile?.name || 'Author'"
                        class="w-full h-full object-cover"
                      />
                    </div>
                    
                    <!-- Author Info -->
                    <div>
                      <div class="flex items-center space-x-2">
                        <h3 class="font-semibold text-gray-900">{{ userProfile?.name || 'Anonymous Creator' }}</h3>
                        <span v-if="userProfile?.nip05" class="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          <IconCheck class="w-3 h-3 mr-1" />
                          Verified
                        </span>
                      </div>
                      <div class="flex items-center space-x-3 text-sm text-gray-500">
                        <span>{{ new Date(selectedContent.publishedAt || selectedContent.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) }}</span>
                        <span>•</span>
                        <span>{{ Math.ceil((selectedContent.fullContent || '').split(' ').length / 200) }} min read</span>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Action Buttons -->
                  <div class="flex items-center space-x-2">
                    <!-- Open in Client Dropdown -->
                    <div v-if="selectedContent.nostrEventId" class="relative" ref="dropdownRef">
                      <button
                        @click="toggleClientDropdown"
                        class="btn-secondary text-sm"
                      >
                        <IconExternalLink class="w-4 h-4" />
                        <span class="hidden sm:inline">Open in Client</span>
                        <IconChevronDown :class="['w-3 h-3 transition-transform', showClientDropdown ? 'rotate-180' : '']" />
                      </button>

                      <!-- Client Dropdown -->
                      <div
                        v-if="showClientDropdown"
                        class="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                      >
                        <a :href="getNostrClientUrl('primal', selectedContent)" target="_blank" rel="noopener noreferrer"
                           class="block px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2">
                          <span class="text-orange-600">🌐</span>
                          <span>Primal</span>
                        </a>
                        <a :href="getNostrClientUrl('yakihonne', selectedContent)" target="_blank" rel="noopener noreferrer"
                           class="block px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2">
                          <span class="text-purple-600">🍜</span>
                          <span>Yakihonne</span>
                        </a>
                      </div>
                    </div>

<!--                    <button-->
<!--                      v-if="selectedContent.status === 'draft'"-->
<!--                      @click="handlePublishToNostr(selectedContent)"-->
<!--                      :disabled="isLoading"-->
<!--                      class="btn-primary disabled:opacity-50"-->
<!--                    >-->
<!--                      <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />-->
<!--                      <IconShare v-else class="w-4 h-4" />-->
<!--                      <span class="hidden sm:inline">{{ isLoading ? 'Publishing...' : 'Publish' }}</span>-->
<!--                    </button>-->
                  </div>
                </div>
              </header>
              
              <!-- Cover Image -->
              <div v-if="selectedContent.coverImage" class="px-8 pt-6">
                <div class="rounded-xl overflow-hidden shadow-md">
                  <img
                    :src="selectedContent.coverImage"
                    :alt="selectedContent.title"
                    class="w-full h-64 sm:h-80 object-cover"
                  />
                </div>
              </div>
              
              <!-- Article Content -->
              <main class="px-8 py-8">
                <div class="prose prose-lg max-w-none text-gray-800 leading-relaxed" v-html="parseMarkdown(selectedContent.fullContent || selectedContent.content || 'No content available')">
                </div>
              </main>
            </article>
          </div>

          <!-- Right Column: Stats and Zaps -->
          <div class="space-y-6">
            <!-- Quick Stats Card -->
            <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">Performance</h3>
              <div class="space-y-3">
<!--                  <div class="flex items-center justify-between">-->
<!--                    <span class="text-sm text-gray-600">Views</span>-->
<!--                    <span class="font-medium text-gray-900">{{ selectedContent.views || 0 }}</span>-->
<!--                  </div>-->
<!--                <div class="flex items-center justify-between">-->
<!--                  <span class="text-sm text-gray-600">Unlocks</span>-->
<!--                  <span class="font-medium text-gray-900">{{ selectedContent.unlocks || 0 }}</span>-->
<!--                </div>-->
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-600">Revenue</span>
                  <span class="font-medium text-orange-600">{{ (selectedContent.revenue || 0).toLocaleString() }} sats</span>
                </div>
              </div>
            </div>

            <!-- Zaps Card -->
            <div v-if="selectedContent.nostrEventId" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                  <IconBolt class="w-4 h-4 text-orange-600" />
                  <span>Lightning Zaps</span>
                </h3>
                <div class="text-right">
                  <div class="text-lg font-bold text-orange-600">{{ formatZapAmount(getTotalZapAmount(selectedContent.nostrEventId)) }}</div>
                  <div class="text-xs text-gray-500">{{ getZapCount(selectedContent.nostrEventId) }} zaps</div>
                </div>
              </div>

              <!-- Compact Zap List -->
              <div class="space-y-2 max-h-48 overflow-y-auto">
                <div v-if="getZapsForContent(selectedContent.nostrEventId).length === 0" class="text-center py-6">
                  <IconBolt class="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p class="text-sm text-gray-500">No zaps yet</p>
                </div>

                <div
                  v-for="zap in getZapsForContent(selectedContent.nostrEventId).slice(0, 5)"
                  :key="zap.id"
                  class="flex items-center space-x-2 p-2 bg-orange-50 rounded-lg"
                >
                  <img
                    :src="zap.sender?.avatar || zap.sender?.picture"
                    :alt="zap.sender?.name || 'User'"
                    class="w-6 h-6 rounded-full object-cover"
                    @error="$event.target.src = generateFallbackAvatar(zap.zapperPubkey)"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium text-gray-900 truncate">
                      {{ zap.sender?.name || formatZapperPubkey(zap.zapperPubkey) }}
                    </div>
                    <div class="text-xs text-gray-500">{{ formatZapTime(zap.timestamp) }}</div>
                  </div>
                  <div class="text-xs font-bold text-orange-600">
                    {{ formatZapAmount(zap.amount) }}
                  </div>
                </div>

                <div v-if="getZapsForContent(selectedContent.nostrEventId).length > 5" class="text-center pt-2">
                  <span class="text-xs text-gray-500">
                    +{{ getZapsForContent(selectedContent.nostrEventId).length - 5 }} more zaps
                  </span>
                </div>
              </div>
            </div>

            <!-- Technical Details Card -->
            <div v-if="selectedContent.nostrEventId" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-4">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">Technical Details</h3>
              <div class="space-y-2 text-xs">
                <div class="flex items-center justify-between">
                  <span class="text-gray-600">Event ID</span>
                  <code class="text-gray-800 bg-gray-100 px-2 py-1 rounded">
                    {{ selectedContent.nostrEventId.substring(0, 8) }}...
                  </code>
                </div>
                <div v-if="selectedContent.publishedToRelays" class="flex items-center justify-between">
                  <span class="text-gray-600">Relays</span>
                  <span class="text-gray-800">{{ selectedContent.publishedToRelays }}</span>
                </div>
                <div v-if="selectedContent.publishedAt" class="flex items-center justify-between">
                  <span class="text-gray-600">Published</span>
                  <span class="text-gray-800">{{ new Date(selectedContent.publishedAt).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance View -->
      <div v-else-if="currentView === 'performance'">
        <ContentPerformance :content-items="contentItems" />
      </div>
    </div>
  </div>
</template>
