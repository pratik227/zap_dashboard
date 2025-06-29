<script setup>
import { ref, inject, computed, onMounted, onUnmounted } from 'vue'
import { IconSearch, IconUpload, IconBolt, IconMenu2, IconUser, IconSettings, IconLogout, IconChevronDown } from '@iconify-prerendered/vue-tabler'
import NotificationDropdown from './NotificationDropdown.vue'

const zapData = inject('zapData')
const emit = defineEmits(['show-connection', 'toggle-mobile-menu'])

const showProfileDropdown = ref(false)
const profileDropdownRef = ref(null)

const userProfile = ref({
  name: 'Creator',
  email: 'creator@example.com',
  pubkey: 'npub1...',
  avatar: 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
})

// Watch for connection status based on zapData
const hasConnection = computed(() => {
  return localStorage.getItem('nwc_url') !== null
})

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (profileDropdownRef.value && !profileDropdownRef.value.contains(event.target)) {
    showProfileDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const toggleProfileDropdown = () => {
  showProfileDropdown.value = !showProfileDropdown.value
}

const handleProfileAction = (action) => {
  showProfileDropdown.value = false
  
  switch (action) {
    case 'profile':
      console.log('Navigate to profile')
      break
    case 'settings':
      console.log('Navigate to settings')
      break
    case 'account':
      console.log('Navigate to account')
      break
    case 'signout':
      console.log('Sign out user')
      break
  }
}
</script>

<template>
  <div class="px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
    <div class="flex items-center justify-between">
      <!-- Mobile Menu Button + Page Title -->
      <div class="flex items-center space-x-3">
        <!-- Mobile Menu Toggle -->
        <button 
          @click="emit('toggle-mobile-menu')"
          class="lg:hidden p-2 text-gray-600 hover:text-orange-600 transition-colors touch-target hover:bg-orange-50 rounded-lg"
        >
          <IconMenu2 class="w-6 h-6" />
        </button>
        
        <!-- Page Title -->
        <div>
          <h2 class="text-lg sm:text-xl font-semibold text-gray-800">Dashboard</h2>
          <p class="text-xs sm:text-sm text-gray-600 hidden sm:block">Welcome back, track your lightning earnings</p>
        </div>
      </div>
      
      <!-- Right Side Actions -->
      <div class="flex items-center space-x-2 sm:space-x-4">
        <!-- Search - Hidden on mobile, shown on tablet+ -->
        <div class="relative hidden md:block">
          <input
            type="text"
            placeholder="Search zaps..."
            class="w-48 lg:w-64 pl-10 pr-4 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm transition-all text-sm hover:shadow-sm"
          />
          <IconSearch class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>
        
        <!-- Action Buttons -->
        <div class="flex items-center space-x-2">
          <!-- Connection Button -->
          <button 
            @click="emit('show-connection')"
            :class="[
              'btn-secondary text-sm transition-all duration-200',
              hasConnection ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : ''
            ]"
          >
            <IconBolt :class="['w-4 h-4', hasConnection ? 'text-green-600' : '']" />
            <span class="hidden sm:inline">{{ hasConnection ? 'Connected' : 'Connect' }}</span>
          </button>
          
          <!-- Notifications -->
          <NotificationDropdown />
        </div>
        
        <!-- Enhanced Profile Dropdown -->
        <div class="relative" ref="profileDropdownRef">
          <!-- Profile Trigger Button -->
          <button 
            @click="toggleProfileDropdown"
            class="flex items-center space-x-2 sm:space-x-3 p-1 sm:p-2 rounded-lg hover:bg-orange-50 transition-all duration-200 group touch-target"
          >
            <div class="relative">
              <img 
                :src="userProfile.avatar" 
                alt="Profile"
                class="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-orange-200 group-hover:border-orange-300 transition-all duration-200"
              />
              <!-- Online indicator -->
              <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
            </div>
            
            <!-- Profile Info - Hidden on mobile -->
            <div class="hidden sm:block text-left">
              <div class="flex items-center space-x-1">
                <span class="text-sm font-medium text-gray-800 group-hover:text-orange-600 transition-colors duration-200">{{ userProfile.name }}</span>
                <IconChevronDown :class="[
                  'w-3 h-3 text-gray-400 group-hover:text-orange-500 transition-all duration-200',
                  showProfileDropdown ? 'rotate-180' : ''
                ]" />
              </div>
              <div class="text-xs text-gray-500 truncate max-w-[100px]">{{ userProfile.email }}</div>
            </div>
          </button>
          
          <!-- Dropdown Menu -->
          <transition name="dropdown">
            <div 
              v-if="showProfileDropdown"
              class="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
            >
              <!-- Profile Header -->
              <div class="px-4 py-3 border-b border-gray-100">
                <div class="flex items-center space-x-3">
                  <img 
                    :src="userProfile.avatar" 
                    alt="Profile"
                    class="w-10 h-10 rounded-full border-2 border-orange-200"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 truncate">{{ userProfile.name }}</div>
                    <div class="text-sm text-gray-500 truncate">{{ userProfile.email }}</div>
                  </div>
                </div>
              </div>
              
              <!-- Account Section -->
              <div class="py-1">
                <div class="px-4 py-2">
                  <div class="text-xs font-medium text-gray-500 uppercase tracking-wider">My Account</div>
                </div>
                
                <button 
                  @click="handleProfileAction('profile')"
                  class="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-200"
                >
                  <IconUser class="w-4 h-4" />
                  <span>Profile</span>
                </button>
                
                <button 
                  @click="handleProfileAction('settings')"
                  class="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors duration-200"
                >
                  <IconSettings class="w-4 h-4" />
                  <span>Settings</span>
                </button>
              </div>
              
              <!-- Divider -->
              <div class="border-t border-gray-100 my-1"></div>
              
              <!-- Sign Out -->
              <button 
                @click="handleProfileAction('signout')"
                class="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <IconLogout class="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease-out;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>