<script setup>
import { inject, ref, onMounted, watch, computed } from 'vue'
import { getNWCClient, getBalance, getWalletInfo } from '../utils/nwcClient.js'
import { 
  IconDashboard, 
  IconBolt, 
  IconChartBar, 
  IconMessageCircle, 
  IconFileText, 
  IconGift, 
  IconShoppingCart, 
  IconWallet, 
  IconCreditCard,
  IconSettings,
  IconEdit
} from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const combinedZapData = inject('combinedZapData')
const emit = defineEmits(['change-page'])

// Real-time wallet data
const walletBalance = ref(0)
const walletInfo = ref(null)
const isLoading = ref(false)

// Fetch real wallet data
async function fetchWalletData() {
  const client = getNWCClient()
  if (!client) return

  isLoading.value = true
  try {
    const [balance, info] = await Promise.all([
      getBalance(),
      getWalletInfo()
    ])
    
    if (balance) {
      walletBalance.value = Math.floor(balance.balance / 1000) // Convert msats to sats
    }
    
    if (info) {
      walletInfo.value = info
    }
  } catch (error) {
    console.error('Failed to fetch wallet data:', error)
  } finally {
    isLoading.value = false
  }
}

// Watch for zapData changes to refresh wallet data
watch(() => combinedZapData.value.length, (newLength) => {
  if (newLength > 0) {
    fetchWalletData()
  }
}, { immediate: true })

onMounted(() => {
  fetchWalletData()
})

// Make totalZaps and totalSats reactive computed properties
const totalZaps = computed(() => {
  // Only count zaps with eventId (NIP-57 zaps)
  return combinedZapData.value.filter(zap => zap.eventId).length
})
const totalSats = computed(() => {
  // Only sum amounts from zaps with eventId (NIP-57 zaps)
  return combinedZapData.value
    .filter(zap => zap.eventId)
    .reduce((sum, zap) => sum + zap.amount, 0)
})

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'zap-feed', label: 'Zap Feed', icon: IconBolt },
  { id: 'analytics', label: 'Analytics', icon: IconChartBar },
  { id: 'wallet', label: 'Wallet', icon: IconWallet },
  // { id: 'notes', label: 'Notes', icon: IconEdit },
  { id: 'chat-zaps', label: 'Chat + Zaps', icon: IconMessageCircle },
  { id: 'content', label: 'Content', icon: IconFileText },
  // { id: 'donations', label: 'Donations', icon: IconGift },
  // { id: 'mini-pos', label: 'Mini PoS', icon: IconShoppingCart },
  // { id: 'finances', label: 'Finances', icon: IconCreditCard },
  { id: 'settings', label: 'Settings', icon: IconSettings }
]

const handlePageChange = (pageId) => {
  emit('change-page', pageId)
}
</script>

<template>
  <div class="w-full h-full bg-white/80 backdrop-blur-sm border-r border-orange-100/50 flex flex-col">
    <!-- Logo -->
    <div class="p-4 sm:p-6 border-b border-orange-100/50">
      <div class="flex items-center space-x-3">
        <div class="w-12 h-12 flex items-center justify-center">
          <img 
            src="/new_logo3.png"
            alt="NWC Logo" 
            class="w-13 h-13 object-contain"
          />
        </div>
        <div>
          <h1 class="text-lg font-bold text-gray-800">ZapTracker</h1>
          <p class="text-xs text-gray-600">Lightning Insights</p>
        </div>
      </div>
    </div>
    
    <!-- Navigation -->
    <nav class="flex-1 p-3 sm:p-4 overflow-y-auto">
      <ul class="space-y-1">
        <li v-for="item in menuItems" :key="item.id">
          <button
            @click="handlePageChange(item.id)"
            :class="[
              'w-full flex items-center space-x-3 px-2 py-2 rounded-lg text-left transition-all duration-200 touch-target group',
              currentPage === item.id
                ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700'
            ]"
          >
            <component 
              :is="item.icon" 
              :class="[
                'w-5 h-5 transition-all duration-200 flex-shrink-0',
                currentPage === item.id 
                  ? 'text-white' 
                  : 'text-gray-500 group-hover:text-orange-600'
              ]" 
            />
            <span class="font-medium">{{ item.label }}</span>
          </button>
        </li>
      </ul>
    </nav>
    
    <!-- Stats Summary -->
    <div class="p-3 sm:p-4 border-t border-orange-100/50">
      <div class="bg-gradient-to-r from-orange-400 to-amber-400 text-white p-3 sm:p-4 rounded-lg shadow-sm">
        <div class="text-sm font-medium mb-1">Total Zaps</div>
        <div class="text-xl sm:text-2xl font-bold">{{ totalZaps.toLocaleString() }}</div>
        <div class="text-sm opacity-90">{{ totalSats.toLocaleString() }} sats</div>
        
        <!-- Wallet Balance -->
        <div v-if="walletBalance > 0" class="mt-3 pt-3 border-t border-white/20">
          <div class="text-sm font-medium mb-1">Wallet Balance</div>
          <div class="text-lg font-bold">{{ walletBalance.toLocaleString() }} sats</div>
          <div v-if="walletInfo" class="text-xs opacity-75 truncate">{{ walletInfo.alias }}</div>
        </div>
        
        <!-- Loading indicator -->
        <div v-else-if="isLoading" class="mt-3 pt-3 border-t border-white/20">
          <div class="flex items-center space-x-2">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span class="text-xs">Loading balance...</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Bolt Logo Footer -->
<!--    <div class="p-3 sm:p-4 border-t border-orange-100/50">-->
<!--      <a -->
<!--        href="https://bolt.new" -->
<!--        target="_blank" -->
<!--        rel="noopener noreferrer"-->
<!--        class="flex items-center justify-center space-x-2 text-gray-500 hover:text-orange-600 transition-colors duration-200 group"-->
<!--      >-->
<!--        <img -->
<!--          src="/bolt-logo/black_circle_360x360.png" -->
<!--          alt="Bolt Logo" -->
<!--          class="w-4 h-4 sm:w-5 sm:h-5 object-contain group-hover:scale-110 transition-transform duration-200"-->
<!--        />-->
<!--        <span class="text-xs sm:text-sm font-medium">Bolt Inside</span>-->
<!--      </a>-->
<!--    </div>-->
  </div>
</template>
