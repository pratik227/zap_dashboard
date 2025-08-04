<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { 
  IconFileText, 
  IconMail, 
  IconMicrophone, 
  IconVideo, 
  IconPhoto, 
  IconFile,
  IconEdit, 
  IconShare, 
  IconTrash,
  IconEye,
  IconCopy,
  IconDots,
  IconBolt,
  IconUsers,
  IconMenu
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  items: {
    type: Array,
    required: true
  }
})

// Track which dropdown is currently open
const openDropdownId = ref(null)

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (openDropdownId.value && !event.target.closest('.dropdown-container')) {
    openDropdownId.value = null
  }
}

// Add/remove event listener
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const emit = defineEmits(['edit', 'delete', 'preview', 'duplicate', 'share', 'publish-nostr'])

const getTypeIcon = (type) => {
  const icons = {
    article: IconFileText,
    newsletter: IconMail,
    podcast: IconMicrophone,
    video: IconVideo,
    image: IconPhoto,
    document: IconFile
  }
  return icons[type] || IconFileText
}

const getStatusColor = (status) => {
  const colors = {
    published: 'text-green-600 bg-green-100',
    draft: 'text-yellow-600 bg-yellow-100',
    archived: 'text-gray-600 bg-gray-100'
  }
  return colors[status] || 'text-gray-600 bg-gray-100'
}

const getMonetizationColor = (model) => {
  const colors = {
    'one-time': 'text-orange-600 bg-orange-100',
    'subscription': 'text-purple-600 bg-purple-100',
    'free': 'text-gray-600 bg-gray-100'
  }
  return colors[model] || 'text-gray-600 bg-gray-100'
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
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

// 🔥 FIX: Use totalRevenue which combines both zaps and traditional revenue
const getTotalRevenue = (item) => {
  console.log('Getting total revenue for item:', item.id, 'zapAmount:', item.zapAmount, 'traditionalRevenue:', item.traditionalRevenue)
  return item.totalRevenue || 0
}

// 🔥 FIX: Check if we should show revenue breakdown (both zaps AND traditional revenue exist)
const shouldShowBreakdown = (item) => {
  const zapAmount = item.zapAmount || 0
  const traditionalRevenue = item.traditionalRevenue || 0
  console.log('Checking breakdown for item:', item.id, 'zapAmount:', zapAmount, 'traditionalRevenue:', traditionalRevenue)
  
  // Show breakdown only if BOTH zaps and traditional revenue exist and are > 0
  return zapAmount > 0 && traditionalRevenue > 0
}

// Generate tooltip text for zaps
const getZapTooltip = (item) => {
  const zapAmount = item.zapAmount || 0
  const zapCount = item.zapCount || 0
  
  if (zapCount === 0) return 'No Lightning zaps received yet'
  if (zapCount === 1) return `${zapAmount.toLocaleString()} sats from 1 Lightning zap`
  return `${zapAmount.toLocaleString()} sats from ${zapCount} Lightning zaps`
}

// Generate tooltip text for traditional sales
const getSalesTooltip = (item) => {
  const revenue = item.traditionalRevenue || 0
  const unlocks = item.unlocks || 0
  
  if (unlocks === 0) return 'No direct sales or subscriptions yet'
  if (item.monetizationModel === 'subscription') {
    return `${revenue.toLocaleString()} sats from ${unlocks} subscription${unlocks !== 1 ? 's' : ''}`
  }
  return `${revenue.toLocaleString()} sats from ${unlocks} direct purchase${unlocks !== 1 ? 's' : ''}`
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="item in items"
      :key="item.id"
      class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div class="p-4 sm:p-6">
        <!-- Header -->
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-start space-x-3 flex-1 min-w-0">
            <!-- Type Icon -->
            <div :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              getStatusColor(item.status)
            ]">
              <component :is="getTypeIcon(item.type)" class="w-4 h-4" />
            </div>

            <!-- Content Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2 mb-1">
                <h3 class="font-semibold text-gray-900 truncate">{{ item.title }}</h3>
                <span :class="[
                  'px-2 py-1 rounded-full text-xs font-medium capitalize',
                  getStatusColor(item.status)
                ]">
                  {{ item.status }}
                </span>
                <span :class="[
                  'px-2 py-1 rounded-full text-xs font-medium',
                  getMonetizationColor(item.monetizationModel)
                ]">
                  {{ item.monetizationModel === 'one-time' ? 'One-time' :
                     item.monetizationModel === 'subscription' ? 'Subscription' : 'Free' }}
                </span>
                <span v-if="item.nostrEventId" class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  On Nostr
                </span>
                
                <!-- 🔥 ZAP INDICATOR - Show if content has received zaps -->
                <div v-if="item.nostrEventId && (item.zapCount > 0 || item.zapAmount > 0)" 
                     class="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-orange-100 to-amber-100 rounded-full">
                  <IconBolt class="w-3 h-3 text-orange-600" />
                  <span class="text-xs font-bold text-orange-700">
                    {{ formatZapAmount(item.zapAmount || 0) }}
                  </span>
                  <span class="text-xs text-orange-600">sats</span>
                  <span v-if="item.zapCount > 1" class="text-xs text-orange-500">
                    ({{ item.zapCount }})
                  </span>
                </div>
              </div>
              <p class="text-sm text-gray-600 line-clamp-2 mb-2">{{ item.description }}</p>
              <div class="flex items-center space-x-4 text-xs text-gray-500">
                <span>Updated {{ formatDate(item.updatedAt) }}</span>
                <span>By {{ item.creatorName || 'You' }}</span>
                <span v-if="item.nostrEventId && item.zapCount === 0" class="text-orange-500">
                  ⚡ Ready for zaps
                </span>
              </div>
            </div>
          </div>

          <!-- Actions - Desktop -->
          <div class="hidden sm:flex items-center space-x-2 flex-shrink-0">
            <button
              @click="$emit('edit', item)"
              class="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title="Edit"
            >
              <IconEdit class="w-4 h-4" />
            </button>
            <button
              @click="$emit('preview', item)"
              class="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Preview"
            >
              <IconEye class="w-4 h-4" />
            </button>
            <button
              v-if="item.status === 'draft'"
              @click="$emit('publish-nostr', item)"
              class="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Publish to Nostr"
            >
              <IconShare class="w-4 h-4" />
            </button>
<!--            <button-->
<!--              @click="$emit('share', item)"-->
<!--              class="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"-->
<!--              title="Share"-->
<!--            >-->
<!--              <IconCopy class="w-4 h-4" />-->
<!--            </button>-->
            <button
              @click="$emit('delete', item)"
              class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <IconTrash class="w-4 h-4" />
            </button>
          </div>
          
          <!-- Mobile Actions -->
          <div class="flex items-center space-x-2 flex-shrink-0 sm:hidden">
            <!-- Preview button always visible -->
            <button
              @click="$emit('preview', item)"
              class="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Preview"
            >
              <IconEye class="w-3.5 h-3.5" />
            </button>
            
            <!-- Three-dot menu for other actions -->
            <div class="relative dropdown-container">
              <button
                @click="openDropdownId = openDropdownId === item.id ? null : item.id"
                class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Edit (Creates new post, deletes original)"
              >
                <IconDots class="w-3.5 h-3.5" />
              </button>
              
              <!-- Dropdown Menu -->
              <div 
                v-if="openDropdownId === item.id"
                class="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10"
              >
                <button
                  @click="$emit('edit', item); openDropdownId = null"
                  class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center space-x-2"
                >
                  <IconEdit class="w-3.5 h-3.5" />
                  <span>Edit (New Post)</span>
                </button>
                
                <button
                  v-if="item.status === 'draft'"
                  @click="$emit('publish-nostr', item); openDropdownId = null"
                  class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center space-x-2"
                >
                  <IconShare class="w-3.5 h-3.5" />
                  <span>Publish</span>
                </button>
                
                <button
                  @click="$emit('share', item); openDropdownId = null"
                  class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center space-x-2"
                >
                  <IconCopy class="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
                
                <button
                  @click="$emit('delete', item); openDropdownId = null"
                  class="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 flex items-center space-x-2"
                >
                  <IconTrash class="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-orange-100/50">
          <div class="text-center">
            <p class="text-sm font-medium text-orange-600">Price</p>
            <p class="text-lg font-bold text-gray-900">
              Free
            </p>
          </div>
          <!--
          <div class="text-center">
            <p class="text-sm font-medium text-gray-600">
              {{ item.monetizationModel === 'subscription' ? 'Subscribers' : 'Unlocks' }}
            </p>
            <p class="text-lg font-bold text-gray-900">
              {{ item.monetizationModel === 'subscription' ? item.subscribers : item.unlocks }}
            </p>
          </div>
          -->
          <div class="text-center">
            <p class="text-sm font-medium text-green-600">Revenue</p>
            <p class="text-lg font-bold text-gray-900">
              {{ getTotalRevenue(item).toLocaleString() }} sats
            </p>
            <!-- 🔥 REVENUE BREAKDOWN WITH TOOLTIPS - Show breakdown only if BOTH zaps AND traditional revenue exist -->
            <div v-if="shouldShowBreakdown(item)" class="text-xs text-gray-500 mt-1 space-y-1">
              <div class="flex items-center justify-center space-x-1">
                <!-- Zap Amount with Tooltip -->
                <div 
                  class="flex items-center space-x-1 cursor-help relative group"
                  :title="getZapTooltip(item)"
                >
                  <IconBolt class="w-3 h-3 text-orange-500" />
                  <span>{{ (item.zapAmount || 0).toLocaleString() }}</span>
                  
                  <!-- Zap Tooltip -->
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    <div class="font-medium">⚡ Lightning Zaps</div>
                    <div>{{ getZapTooltip(item) }}</div>
                    <div class="text-gray-300 mt-1">Instant, decentralized payments</div>
                    <!-- Tooltip arrow -->
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
                
                <span class="text-gray-400">+</span>
                
                <!-- Traditional Sales with Tooltip -->
                <div 
                  class="flex items-center space-x-1 cursor-help relative group"
                  :title="getSalesTooltip(item)"
                >
                  <span>💰{{ (item.traditionalRevenue || 0).toLocaleString() }}</span>
                  
                  <!-- Sales Tooltip -->
                  <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    <div class="font-medium">💰 Direct Sales</div>
                    <div>{{ getSalesTooltip(item) }}</div>
                    <div class="text-gray-300 mt-1">Traditional purchases & subscriptions</div>
                    <!-- Tooltip arrow -->
                    <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div class="text-xs text-gray-400">zaps + sales</div>
            </div>
          </div>
          <!--
          <div class="text-center">
            <p class="text-sm font-medium text-blue-600">Views</p>
            <p class="text-lg font-bold text-gray-900">{{ item.views }}</p>
          </div>
          -->
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-if="items.length === 0" class="text-center py-12">
      <IconFileText class="w-16 h-16 mx-auto text-gray-300 mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
      <p class="text-gray-600">Create your first piece of premium content to start earning.</p>
    </div>
  </div>
</template>

<style scoped>
/* Ensure dropdowns appear above other elements */
.z-10 {
  z-index: 10;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Enhanced tooltip styling */
.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Ensure tooltips appear above other elements */
.z-10 {
  z-index: 10;
}

/* Smooth tooltip transitions */
.transition-opacity {
  transition-property: opacity;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.duration-200 {
  transition-duration: 200ms;
}

/* Tooltip positioning */
.whitespace-nowrap {
  white-space: nowrap;
}

.pointer-events-none {
  pointer-events: none;
}

/* Cursor styling for interactive elements */
.cursor-help {
  cursor: help;
}
</style>
