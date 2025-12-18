<script setup>
import { ref, computed, inject } from 'vue'
import { 
  IconPlus, 
  IconEdit, 
  IconTrash, 
  IconCheck, 
  IconX, 
  IconBolt, 
  IconStar, 
  IconStarFilled,
  IconSearch,
  IconWifi,
  IconWifiOff,
  IconAlertTriangle,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconChevronDown,
  IconChevronRight,
  IconRefresh
} from '@iconify-prerendered/vue-tabler'
import { useNostrConnections } from '../../composables/core/useNostrConnections.js'

const {
  connections,
  activeConnection,
  isLoadingConnection,
  connectionError,
  addConnection,
  editConnection,
  deleteConnection,
  setActiveConnection,
  setDefaultConnection,
  clearActiveConnection,
  validateNwcUrl
} = useNostrConnections()

// Simplified form state
const showAddForm = ref(false)
const showEditForm = ref(false)
const showDeleteConfirm = ref(false)
const editingConnection = ref(null)
const deletingConnection = ref(null)

const newConnectionName = ref('')
const newConnectionUrl = ref('')
const newConnectionColor = ref('orange')
const editConnectionName = ref('')
const editConnectionUrl = ref('')
const editConnectionColor = ref('orange')

const formError = ref('')
const searchQuery = ref('')
const showAdvanced = ref(false)

// Customization options - Apple-style colors
const availableColors = [
  { name: 'Orange', value: 'orange', color: '#FFB84D', bg: 'bg-orange-100', text: 'text-orange-600' },
  { name: 'Blue', value: 'blue', color: '#64B5F6', bg: 'bg-blue-100', text: 'text-blue-600' },
  { name: 'Green', value: 'green', color: '#81C784', bg: 'bg-green-100', text: 'text-green-600' },
  { name: 'Purple', value: 'purple', color: '#BA68C8', bg: 'bg-purple-100', text: 'text-purple-600' },
  { name: 'Pink', value: 'pink', color: '#F48FB1', bg: 'bg-pink-100', text: 'text-pink-600' },
  { name: 'Yellow', value: 'yellow', color: '#FFD54F', bg: 'bg-yellow-100', text: 'text-yellow-600' }
]

// Filter connections based on search
const filteredConnections = computed(() => {
  if (!searchQuery.value) return connections.value
  
  const query = searchQuery.value.toLowerCase()
  return connections.value.filter(conn => 
    conn.name.toLowerCase().includes(query) ||
    conn.nwcUrl.toLowerCase().includes(query)
  )
})

// Simplified form handlers
const openAddForm = () => {
  showAddForm.value = true
  newConnectionName.value = ''
  newConnectionUrl.value = ''
  newConnectionColor.value = 'orange'
  formError.value = ''
}

const closeAddForm = () => {
  showAddForm.value = false
  newConnectionName.value = ''
  newConnectionUrl.value = ''
  newConnectionColor.value = 'orange'
  formError.value = ''
}

const openEditForm = (connection) => {
  editingConnection.value = connection
  editConnectionName.value = connection.name
  editConnectionUrl.value = connection.nwcUrl
  editConnectionColor.value = connection.color || 'orange'
  showEditForm.value = true
  formError.value = ''
}

const closeEditForm = () => {
  showEditForm.value = false
  editingConnection.value = null
  editConnectionName.value = ''
  editConnectionUrl.value = ''
  editConnectionColor.value = 'orange'
  formError.value = ''
}

const openDeleteConfirm = (connection) => {
  deletingConnection.value = connection
  showDeleteConfirm.value = true
}

const closeDeleteConfirm = () => {
  showDeleteConfirm.value = false
  deletingConnection.value = null
}

// Simplified actions
const handleAddConnection = async () => {
  formError.value = ''

  try {
    const connection = addConnection(newConnectionName.value, newConnectionUrl.value)
    connection.color = newConnectionColor.value
    closeAddForm()

    if (connections.value.length === 1) {
      await setActiveConnection(connection.id)
    }
  } catch (error) {
    formError.value = error.message
  }
}

const handleEditConnection = () => {
  formError.value = ''

  try {
    editConnection(editingConnection.value.id, editConnectionName.value, editConnectionUrl.value)
    editingConnection.value.color = editConnectionColor.value
    closeEditForm()
  } catch (error) {
    formError.value = error.message
  }
}

const handleDeleteConnection = () => {
  try {
    deleteConnection(deletingConnection.value.id)
    closeDeleteConfirm()
  } catch (error) {
    console.error('Failed to delete connection:', error)
  }
}

const handleActivateConnection = async (connection) => {
  try {
    await setActiveConnection(connection.id)
  } catch (error) {
    console.error('Failed to activate connection:', error)
  }
}

const handleSetDefault = (connection) => {
  try {
    setDefaultConnection(connection.id)
  } catch (error) {
    console.error('Failed to set default connection:', error)
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const truncateUrl = (url, maxLength = 30) => {
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength) + '...'
}

const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

const getColorClasses = (colorValue) => {
  const color = availableColors.find(c => c.value === colorValue) || availableColors[0]
  return { bg: color.bg, text: color.text }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-1">
      <div>
        <h2 class="text-base font-semibold text-gray-900">Wallet Connections</h2>
        <p class="text-gray-500 text-xs mt-0.5">{{ connections.length }} connection{{ connections.length !== 1 ? 's' : '' }}</p>
      </div>

      <button
        v-if="filteredConnections.length > 0"
        @click="openAddForm"
        class="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
      >
        <IconPlus class="w-4 h-4" />
        <span class="hidden sm:inline">Add</span>
      </button>
    </div>

    <!-- Simplified Search (only show if more than 3 connections) -->
    <div v-if="connections.length > 3" class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search connections..."
        class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm"
      />
      <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
    </div>

    <!-- Connection Cards -->
    <div class="space-y-2.5">
      <div
        v-for="connection in filteredConnections"
        :key="connection.id"
        class="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md hover:border-gray-200 transition-all group"
      >
        <!-- Connection Row -->
        <div class="flex items-center justify-between gap-3">
          <!-- Left -->
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div :class="[
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
              connection.isActive ? getColorClasses(connection.color || 'orange').bg : 'bg-gray-100'
            ]">
              <IconBolt :class="['w-5 h-5', connection.isActive ? getColorClasses(connection.color || 'orange').text : 'text-gray-400']" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-0.5">
                <h3 class="font-medium text-gray-900 truncate text-sm">{{ connection.name }}</h3>
                <IconStarFilled v-if="connection.isDefault" class="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              </div>
              <div class="flex items-center gap-1.5">
                <div :class="[
                  'w-1.5 h-1.5 rounded-full',
                  connection.isActive ? 'bg-green-500' : 'bg-gray-300'
                ]"></div>
                <span class="text-xs text-gray-500">{{ connection.isActive ? 'Connected' : 'Disconnected' }}</span>
              </div>
            </div>
          </div>
          
          <!-- Right: Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Secondary Actions - Always visible on desktop -->
            <div class="hidden sm:flex items-center gap-0.5">
              <button
                @click="copyToClipboard(connection.nwcUrl)"
                class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy URL"
              >
                <IconCopy class="w-4 h-4" />
              </button>

              <button
                @click="openEditForm(connection)"
                class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit"
              >
                <IconEdit class="w-4 h-4" />
              </button>

              <button
                @click="openDeleteConfirm(connection)"
                class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete"
              >
                <IconTrash class="w-4 h-4" />
              </button>
            </div>

            <!-- Divider -->
            <div class="hidden sm:block w-px h-6 bg-gray-200"></div>

            <!-- Primary Action -->
            <button
              v-if="!connection.isActive"
              @click="handleActivateConnection(connection)"
              :disabled="isLoadingConnection"
              class="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <IconWifi class="w-4 h-4" />
              Connect
            </button>

            <button
              v-else
              @click="clearActiveConnection"
              class="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm font-medium transition-colors"
            >
              <IconWifiOff class="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </div>

        <!-- Mobile Actions -->
        <div class="sm:hidden mt-3 pt-3 border-t border-gray-100 space-y-2">
          <!-- Primary Action -->
          <button
            v-if="!connection.isActive"
            @click="handleActivateConnection(connection)"
            :disabled="isLoadingConnection"
            class="w-full py-2.5 bg-orange-500 text-white hover:bg-orange-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <IconWifi class="w-4 h-4" />
            Connect Wallet
          </button>

          <button
            v-else
            @click="clearActiveConnection"
            class="w-full py-2.5 bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <IconWifiOff class="w-4 h-4" />
            Disconnect
          </button>

          <!-- Secondary Actions -->
          <div class="flex items-center gap-1.5">
            <button
              @click="copyToClipboard(connection.nwcUrl)"
              class="flex-1 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <IconCopy class="w-3.5 h-3.5" />
              Copy
            </button>

            <button
              @click="openEditForm(connection)"
              class="flex-1 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <IconEdit class="w-3.5 h-3.5" />
              Edit
            </button>

            <button
              @click="openDeleteConfirm(connection)"
              class="flex-1 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <IconTrash class="w-3.5 h-3.5" />
              Delete
            </button>
          </div>
        </div>
        
      </div>
      
      <!-- Empty State -->
      <div v-if="filteredConnections.length === 0" class="max-w-md mx-auto">
        <div class="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-orange-100">
            <IconBolt class="w-8 h-8 text-orange-600" />
          </div>

          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ searchQuery ? 'No matches' : 'No connections' }}
          </h3>
          <p class="text-gray-500 text-sm mb-6">
            {{ searchQuery ? 'Try different search terms.' : 'Connect your Lightning wallet to enable payments.' }}
          </p>

          <button
            v-if="!searchQuery"
            @click="openAddForm"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-orange-500/20 transition-all"
          >
            <IconPlus class="w-4 h-4" />
            Add Connection
          </button>
        </div>
      </div>
    </div>

    <!-- Simplified Connection Error -->
    <div v-if="connectionError" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start space-x-2">
        <IconAlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <span class="text-red-800 font-medium">Connection Error</span>
          <p class="text-red-700 text-sm mt-1">{{ connectionError }}</p>
        </div>
      </div>
    </div>

    <!-- Add Connection Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showAddForm" class="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div class="bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-lg font-semibold text-gray-900">Add Connection</h3>
              <button
                @click="closeAddForm"
                class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <!-- Simplified Form Fields -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  v-model="newConnectionName"
                  type="text"
                  placeholder="My Lightning Wallet"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection String</label>
                <input
                  v-model="newConnectionUrl"
                  type="password"
                  placeholder="nostr+walletconnect://..."
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Get this from your wallet's NWC settings
                </p>
              </div>

              <!-- Color Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Color</label>
                <div class="flex items-center gap-3">
                  <button
                    v-for="color in availableColors"
                    :key="color.value"
                    @click="newConnectionColor = color.value"
                    type="button"
                    :style="{ backgroundColor: color.color }"
                    :class="[
                      'w-8 h-8 rounded-full transition-all duration-200',
                      newConnectionColor === color.value
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    ]"
                    :title="color.name"
                  ></button>
                </div>
              </div>
              
              <!-- Error Message -->
              <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-600">{{ formError }}</p>
              </div>
              
              <!-- Actions -->
              <div class="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                <button
                  @click="closeAddForm"
                  class="w-full sm:flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleAddConnection"
                  class="w-full sm:flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  Add Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Edit Connection Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showEditForm" class="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div class="bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-lg font-semibold text-gray-900">Edit Connection</h3>
              <button
                @click="closeEditForm"
                class="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <IconX class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  v-model="editConnectionName"
                  type="text"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Connection String</label>
                <input
                  v-model="editConnectionUrl"
                  type="password"
                  class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
                />
              </div>

              <!-- Color Selection -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-3">Color</label>
                <div class="flex items-center gap-3">
                  <button
                    v-for="color in availableColors"
                    :key="color.value"
                    @click="editConnectionColor = color.value"
                    type="button"
                    :style="{ backgroundColor: color.color }"
                    :class="[
                      'w-8 h-8 rounded-full transition-all duration-200',
                      editConnectionColor === color.value
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    ]"
                    :title="color.name"
                  ></button>
                </div>
              </div>
              
              <div v-if="formError" class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-600">{{ formError }}</p>
              </div>
              
              <div class="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                <button
                  @click="closeEditForm"
                  class="w-full sm:flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="handleEditConnection"
                  class="w-full sm:flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Delete Confirmation Modal - Teleported to modal-root -->
    <Teleport to="#modal-root">
      <transition name="modal-transition">
        <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div class="bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl">
            <div class="flex items-start gap-3 mb-5">
              <div class="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <IconTrash class="w-5 h-5 text-red-600" />
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 mb-1">Delete Connection</h3>
                <p class="text-gray-500 text-sm">This action cannot be undone.</p>
              </div>
            </div>
            
            <div class="bg-gray-50 rounded-lg p-3 mb-6">
              <p class="text-sm text-gray-700">
                Delete "<strong>{{ deletingConnection?.name }}</strong>"?
              </p>
            </div>
            
            <div class="flex flex-col-reverse sm:flex-row gap-3">
              <button
                @click="closeDeleteConfirm"
                class="w-full sm:flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleDeleteConnection"
                class="w-full sm:flex-1 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete Connection
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Empty State Styles */
.wallet-connections-empty-state {
  @apply py-8;
}

.wallet-connections-empty-hero {
  @apply bg-white rounded-2xl p-8 text-center;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.wallet-connections-empty-icon-wrapper {
  @apply relative inline-flex items-center justify-center mb-6;
}

.wallet-connections-empty-icon {
  @apply w-16 h-16 text-orange-600;
  position: relative;
  z-index: 2;
}

.wallet-connections-empty-icon-pulse {
  @apply absolute inset-0 rounded-full bg-orange-100;
  animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-ring {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0;
  }
}

/* Modal Transitions */
.modal-transition-enter-active,
.modal-transition-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-transition-enter-from,
.modal-transition-leave-to {
  opacity: 0;
}

.modal-transition-enter-from .bg-white,
.modal-transition-leave-to .bg-white {
  transform: translateY(100%);
}

@media (min-width: 640px) {
  .modal-transition-enter-from .bg-white,
  .modal-transition-leave-to .bg-white {
    transform: scale(0.95) translateY(-20px);
  }
}

.wallet-connections-empty-title {
  @apply text-xl font-semibold text-gray-900 mb-3;
  letter-spacing: -0.01em;
}

.wallet-connections-empty-description {
  @apply text-gray-600 mb-6 max-w-md mx-auto;
  line-height: 1.6;
}

.wallet-connections-empty-button {
  @apply inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium transition-all duration-200;
  box-shadow: 0 2px 8px rgba(251, 146, 60, 0.3);
}

.wallet-connections-empty-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.4);
}

.wallet-connections-empty-button:active {
  transform: translateY(0);
}

/* Mobile Optimizations */
@media (max-width: 640px) {
  .wallet-connections-empty-hero {
    @apply p-6;
  }

  .wallet-connections-empty-title {
    @apply text-lg;
  }

  .wallet-connections-empty-description {
    @apply text-sm;
  }

  .wallet-connections-empty-icon {
    @apply w-12 h-12;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .wallet-connections-empty-icon-pulse,
  .wallet-connections-empty-button {
    animation: none !important;
    transition: none !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .wallet-connections-empty-hero {
    border-width: 2px;
  }
}
</style>