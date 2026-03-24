<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  IconList,
  IconPlus,
  IconSearch,
  IconUsers,
  IconUserPlus,
  IconEye,
  IconEdit,
  IconTrash,
  IconShare,
  IconLoader,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconFilter,
  IconGrid,
  IconChevronDown,
  IconArrowRight,
  IconStar,
  IconHeart,
  IconTarget
} from '@iconify-prerendered/vue-tabler'
import { useFollowLists } from '../../composables/audience/useFollowLists.js'
import { useNostrAuth } from '../../composables/auth/useNostrAuth.js'
import FollowListCard from './FollowListCard.vue'
import FollowListModal from './FollowListModal.vue'
import FollowListViewModal from './FollowListViewModal.vue'

const {
  myLists,
  discoveredLists,
  isLoading,
  error,
  syncStatus,
  myListsCount,
  discoveredListsCount,
  fetchMyLists,
  discoverLists,
  createFollowPack,
  updateFollowPack,
  deleteFollowPack,
  followEntirePack,
  followSelectedMembers,
  filterLists
} = useFollowLists()

const { isAuthenticated } = useNostrAuth()

// UI state
const activeTab = ref('discover') // 'my-lists', 'discover'
const searchQuery = ref('')
const showCreateModal = ref(false)
const showViewModal = ref(false)
const showDeleteModal = ref(false)
const selectedList = ref(null)
const viewMode = ref('grid') // 'grid', 'list'
const sortOption = ref('recent') // 'recent', 'alphabetical', 'members'
const processingListId = ref(null) // track which list is being followed
const isDeletingList = ref(false)

// Inline status banner
const statusMessage = ref(null) // { type: 'success'|'error', text: '' }
let statusTimer = null

const showStatus = (type, text, duration = 5000) => {
  clearTimeout(statusTimer)
  statusMessage.value = { type, text }
  statusTimer = setTimeout(() => { statusMessage.value = null }, duration)
}

// Tabs configuration
const tabs = [
  { 
    id: 'my-lists', 
    label: 'My Follow Packs', 
    icon: IconList, 
    count: computed(() => myListsCount.value),
    description: 'Follow packs you\'ve created'
  },
  { 
    id: 'discover', 
    label: 'Discover', 
    icon: IconSearch, 
    count: computed(() => discoveredListsCount.value),
    description: 'Find lists from the community'
  }
]

// Computed properties
const filteredMyLists = computed(() => {
  let lists = filterLists(myLists.value, searchQuery.value)
  return sortLists(lists, sortOption.value)
})

const filteredDiscoveredLists = computed(() => {
  let lists = filterLists(discoveredLists.value, searchQuery.value)
  return sortLists(lists, sortOption.value)
})

const currentLists = computed(() => {
  return activeTab.value === 'my-lists' ? filteredMyLists.value : filteredDiscoveredLists.value
})

const isMyListsTab = computed(() => activeTab.value === 'my-lists')

// Sort lists based on option
const sortLists = (lists, option) => {
  const sorted = [...lists]
  
  switch (option) {
    case 'alphabetical':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'members':
      return sorted.sort((a, b) => b.memberCount - a.memberCount)
    case 'recent':
    default:
      return sorted.sort((a, b) => b.created_at - a.created_at)
  }
}

// Handle tab change
const changeTab = (tabId) => {
  activeTab.value = tabId
  searchQuery.value = ''
  
  // Trigger discovery when switching to discover tab
  if (tabId === 'discover' && discoveredLists.value.length === 0) {
    discoverLists()
  }
}

// Handle list creation
const handleCreateList = () => {
  selectedList.value = null
  showCreateModal.value = true
}

// Handle list editing
const handleEditList = (list) => {
  selectedList.value = list
  showCreateModal.value = true
}

// Handle list viewing
const handleViewList = (list) => {
  selectedList.value = list
  showViewModal.value = true
}

// Handle list deletion
const handleDeleteList = (list) => {
  selectedList.value = list
  showDeleteModal.value = true
}

// Confirm list deletion
const confirmDeleteList = async () => {
  if (!selectedList.value) return

  isDeletingList.value = true
  try {
    await deleteFollowPack(selectedList.value.id)
    showDeleteModal.value = false
    selectedList.value = null
  } catch (error) {
    console.error('Failed to delete list:', error)
  } finally {
    isDeletingList.value = false
  }
}

// Handle list save (create or update)
const handleSaveList = async (listId, listData) => {
  try {
    if (listId) {
      await updateFollowPack(listId, listData)
    } else {
      await createFollowPack(listData)
    }
    showCreateModal.value = false
    selectedList.value = null
  } catch (error) {
    console.error('Failed to save list:', error)
    throw error
  }
}

// Handle follow entire list
const handleFollowEntireList = async (list) => {
  processingListId.value = list.id
  try {
    const result = await followEntirePack(list)

    if (result.success) {
      if (result.alreadyFollowingAll) {
        showStatus('success', result.message)
      } else {
        showStatus('success', `${result.message} — now following ${result.totalFollows.toLocaleString()} people`)
      }
    }
  } catch (err) {
    console.error('Failed to follow list:', err)
    showStatus('error', `Failed to follow pack: ${err.message}`)
  } finally {
    processingListId.value = null
  }
}

// Handle follow selected members from modal
const handleFollowSelectedMembers = async (list, selectedPubkeys) => {
  processingListId.value = list.id
  try {
    const result = await followSelectedMembers(list, selectedPubkeys)

    if (result.success) {
      if (result.alreadyFollowingAll) {
        showStatus('success', result.message)
      } else {
        showStatus('success', `${result.message} — now following ${result.totalFollows.toLocaleString()} people`)
      }
    }
  } catch (err) {
    console.error('Failed to follow selected members:', err)
    showStatus('error', `Failed to follow selected members: ${err.message}`)
  } finally {
    processingListId.value = null
  }
}

// Handle search
const handleSearch = (query) => {
  searchQuery.value = query
  
  // Trigger new discovery search for discover tab
  if (activeTab.value === 'discover') {
    discoverLists(query)
  }
}

// Initialize on mount
onMounted(() => {
  if (isAuthenticated.value) {
    fetchMyLists()
    discoverLists()
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 flex items-center space-x-2">
          <IconList class="w-6 h-6 text-orange-600" />
          <span>Follow Packs</span>
        </h2>
        <p class="text-gray-600 text-sm mt-1">
          Create and discover curated packs of people to follow
        </p>
      </div>
      
      <div class="flex items-center space-x-3">
        <button
          v-if="isMyListsTab"
          @click="handleCreateList"
          class="btn-primary"
        >
          <IconPlus class="w-4 h-4" />
          Create Pack
        </button>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm overflow-hidden">
      <nav class="flex" aria-label="Follow lists tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="changeTab(tab.id)"
          :class="[
            'flex-1 flex items-center justify-center space-x-2 py-4 px-6 font-medium text-sm transition-all duration-200 border-b-2',
            activeTab === tab.id
              ? 'border-orange-400 text-orange-600 bg-orange-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          ]"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          <span>{{ tab.label }}</span>
          <span v-if="tab.count?.value > 0" class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
            {{ tab.count.value }}
          </span>
        </button>
      </nav>
    </div>

    <!-- Search and Controls -->
    <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <!-- Search -->
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="isMyListsTab ? 'Search your follow packs...' : 'Search discovered follow packs...'"
            class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            @input="handleSearch(searchQuery)"
          />
          <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''; handleSearch('')" 
            class="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
        
        <!-- View Toggle -->
        <div class="flex items-center bg-gray-100 rounded-lg p-1">
          <button 
            @click="viewMode = 'grid'" 
            :class="[
              'px-3 py-2 rounded-md transition-all duration-200 flex items-center space-x-1',
              viewMode === 'grid' 
                ? 'bg-white shadow-sm text-orange-600' 
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            <IconGrid class="w-4 h-4" />
            <span class="text-sm">Grid</span>
          </button>
          <button 
            @click="viewMode = 'list'" 
            :class="[
              'px-3 py-2 rounded-md transition-all duration-200 flex items-center space-x-1',
              viewMode === 'list' 
                ? 'bg-white shadow-sm text-orange-600' 
                : 'text-gray-600 hover:text-gray-800'
            ]"
          >
            <IconList class="w-4 h-4" />
            <span class="text-sm">List</span>
          </button>
        </div>
        
        <!-- Sort Dropdown -->
        <div class="relative">
          <select 
            v-model="sortOption"
            class="appearance-none pl-3 pr-8 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm bg-white"
          >
            <option value="recent">Newest First</option>
            <option value="alphabetical">A-Z</option>
            <option value="members">Most Members</option>
          </select>
          <IconChevronDown class="absolute right-3 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>

    <!-- Status Banner -->
    <transition name="status-banner">
      <div
        v-if="statusMessage"
        :class="[
          'rounded-lg px-4 py-3 flex items-center gap-3',
          statusMessage.type === 'success'
            ? 'bg-green-50 border border-green-300 text-green-800'
            : 'bg-red-50 border border-red-300 text-red-800'
        ]"
      >
        <IconCheck v-if="statusMessage.type === 'success'" class="w-5 h-5 flex-shrink-0" />
        <IconAlertCircle v-else class="w-5 h-5 flex-shrink-0" />
        <span class="text-sm font-medium flex-1">{{ statusMessage.text }}</span>
        <button
          @click="statusMessage = null"
          class="p-1 rounded hover:bg-black/5 flex-shrink-0"
        >
          <IconX class="w-4 h-4" />
        </button>
      </div>
    </transition>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-center space-x-2">
        <IconAlertCircle class="w-5 h-5 text-red-600" />
        <span class="text-red-800">{{ error }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && currentLists.length === 0" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-8 text-center">
      <div class="inline-block p-3 bg-orange-100 rounded-full mb-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">
        {{ isMyListsTab ? 'Loading your lists...' : 'Discovering lists...' }}
      </h3>
      <p class="text-gray-600">Please wait while we fetch data from the Nostr network</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="currentLists.length === 0" class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm p-8 text-center">
      <div class="inline-block p-4 bg-orange-100 rounded-full mb-4">
        <IconList class="w-12 h-12 text-orange-500" />
      </div>
      
      <h3 class="text-xl font-semibold text-gray-900 mb-3">
        {{ searchQuery ? 'No matching lists found' : 
           isMyListsTab ? 'No follow packs created yet' : 'No follow packs discovered yet' }}
      </h3>
      
      <p class="text-gray-600 mb-6 max-w-md mx-auto">
        {{ searchQuery ? 'Try adjusting your search terms or browse all available lists.' :
           isMyListsTab ? 'Create your first follow pack to organize your network into themed collections.' :
           'Discover curated follow packs created by the Nostr community.' }}
      </p>
      
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <button 
          v-if="searchQuery" 
          @click="searchQuery = ''; handleSearch('')" 
          class="btn-secondary"
        >
          <IconX class="w-4 h-4" />
          Clear Search
        </button>
        
        <button 
          v-if="isMyListsTab" 
          @click="handleCreateList" 
          class="btn-primary"
        >
          <IconPlus class="w-4 h-4" />
          Create First Pack
        </button>
        
        <button 
          v-else 
          @click="discoverLists()" 
          class="btn-primary"
        >
          <IconSearch class="w-4 h-4" />
          Discover Packs
        </button>
      </div>
    </div>

    <!-- Lists Grid/List View -->
    <div v-else>
      <!-- Grid View -->
      <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FollowListCard
          v-for="list in currentLists"
          :key="list.id"
          :list="list"
          :is-owner="isMyListsTab"
          :is-processing="processingListId === list.id"
          @view="handleViewList"
          @edit="handleEditList"
          @delete="handleDeleteList"
          @follow-all="handleFollowEntireList"
          @share="() => {}"
        />
      </div>

      <!-- List View -->
      <div v-else class="space-y-3">
        <div
          v-for="list in currentLists"
          :key="list.id"
          class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all duration-200 p-4"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4 flex-1 min-w-0">
              <!-- List Image or Icon -->
              <div class="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0">
                <img
                  v-if="list.image"
                  :src="list.image"
                  :alt="list.title"
                  class="w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'"
                />
                <IconList v-else class="w-6 h-6 text-orange-600" />
              </div>

              <!-- List Info -->
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 truncate">{{ list.title }}</h3>
                <p v-if="list.description" class="text-sm text-gray-600 truncate">{{ list.description }}</p>
                <div class="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                  <span class="flex items-center space-x-1">
                    <IconUsers class="w-3 h-3" />
                    <span>{{ list.memberCount }} members</span>
                  </span>
                  <span>{{ new Date(list.created_at * 1000).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center space-x-2 flex-shrink-0">
              <button
                @click="handleViewList(list)"
                class="btn-secondary text-sm"
              >
                <IconEye class="w-4 h-4" />
                <span class="hidden sm:inline">View</span>
              </button>
              
              <button
                v-if="isMyListsTab"
                @click="handleEditList(list)"
                class="btn-secondary text-sm"
              >
                <IconEdit class="w-4 h-4" />
                <span class="hidden sm:inline">Edit</span>
              </button>
              
              <button
                v-else
                @click="handleFollowEntireList(list)"
                :disabled="processingListId === list.id"
                class="btn-primary text-sm"
              >
                <IconLoader v-if="processingListId === list.id" class="w-4 h-4 animate-spin" />
                <IconUserPlus v-else class="w-4 h-4" />
                <span class="hidden sm:inline">{{ processingListId === list.id ? 'Following...' : 'Follow All' }}</span>
              </button>
              
              <button
                v-if="isMyListsTab"
                @click="handleDeleteList(list)"
                class="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <IconTrash class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create/Edit List Modal -->
  <FollowListModal
    :show="showCreateModal"
    :list="selectedList"
    @close="showCreateModal = false; selectedList = null"
    @save="handleSaveList"
  />

  <!-- View List Modal -->
  <FollowListViewModal
    :show="showViewModal"
    :list="selectedList"
    :is-processing="processingListId !== null"
    @close="showViewModal = false; selectedList = null"
    @follow-all="handleFollowEntireList"
    @follow-selected="handleFollowSelectedMembers"
  />

  <!-- Delete Confirmation Modal -->
  <Teleport to="#modal-root">
    <transition name="modal-transition">
      <div v-if="showDeleteModal" class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
        <div class="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
          <div class="flex items-center space-x-3 mb-4">
            <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <IconTrash class="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900">Delete List</h3>
              <p class="text-gray-600 text-sm">This action cannot be undone.</p>
            </div>
          </div>
          
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p class="text-red-800 text-sm">
              Are you sure you want to delete "<strong>{{ selectedList?.title }}</strong>"?
              This will remove the list from the Nostr network.
            </p>
          </div>
          
          <div class="flex space-x-3">
            <button
              @click="showDeleteModal = false; selectedList = null"
              :disabled="isDeletingList"
              class="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              @click="confirmDeleteList"
              :disabled="isDeletingList"
              class="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <IconLoader v-if="isDeletingList" class="w-4 h-4 animate-spin" />
              {{ isDeletingList ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Status banner */
.status-banner-enter-active {
  transition: all 0.25s ease-out;
}
.status-banner-leave-active {
  transition: all 0.2s ease-in;
}
.status-banner-enter-from,
.status-banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Modal transitions */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s ease-out;
}

.modal-transition-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-transition-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(20px);
}
</style>
