<script setup>
import { ref, onMounted, watch } from 'vue'
import { IconSettings, IconBolt, IconBell, IconShield, IconUser, IconRefresh, IconTrash } from '@iconify-prerendered/vue-tabler'
import SettingsConnections from '../components/settings/SettingsConnections.vue'
import NotificationSettings from '../components/settings/NotificationSettings.vue'
import NostrSettings from '../components/settings/NostrSettings.vue'
import AccountReset from '../components/settings/AccountReset.vue'

// Define props to receive the initial tab from parent
const props = defineProps({
  initialTab: {
    type: String,
    default: 'nostr'
  }
})

const emit = defineEmits(['change-page'])

const activeTab = ref('nostr')

const tabs = [
  { id: 'nostr', label: 'Nostr', icon: IconUser },
  { id: 'wallet', label: 'Wallet', icon: IconBolt },
  { id: 'alerts', label: 'Notifications', icon: IconBell },
  { id: 'reset', label: 'Reset', icon: IconRefresh }
  // { id: 'privacy', label: 'Privacy', icon: IconShield }
]

// Set initial tab on mount
onMounted(() => {
  if (props.initialTab) {
    activeTab.value = props.initialTab
  }
})

// Watch for changes to initialTab prop and update activeTab
watch(() => props.initialTab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
<!--    <div>-->
<!--      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">-->
<!--        <IconSettings class="w-6 h-6 text-orange-600" />-->
<!--        <span>Settings</span>-->
<!--      </h1>-->
<!--      <p class="text-gray-600">Manage your zap dashboard preferences and integrations</p>-->
<!--    </div>-->
    
    <!-- Elegant Settings Container -->
    <div class="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
      <!-- Modern Tab Navigation -->
      <div class="border-b border-gray-100 bg-gray-50/50">
        <nav class="flex space-x-2 px-6 py-4 overflow-x-auto scrollbar-hide" aria-label="Settings tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex items-center gap-2.5 px-5 py-3 font-semibold text-sm whitespace-nowrap transition-all duration-300 rounded-2xl flex-shrink-0',
              activeTab === tab.id
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white'
            ]"
          >
            <component :is="tab.icon" class="w-5 h-5" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-6 sm:p-8">
        <!-- Nostr Settings -->
        <div v-if="activeTab === 'nostr'">
          <NostrSettings @change-page="emit('change-page', $event)" />
        </div>
        
        <!-- Wallet Settings -->
        <div v-if="activeTab === 'wallet'">
          <SettingsConnections @change-page="emit('change-page', $event)" />
        </div>
        
        <!-- Notification Settings -->
        <div v-if="activeTab === 'alerts'">
          <NotificationSettings />
        </div>
        
        <!-- Reset Settings -->
        <div v-if="activeTab === 'reset'">
          <AccountReset />
        </div>
        
        <!-- Privacy Settings -->
        <div v-if="activeTab === 'privacy'" class="space-y-6">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Privacy & Security</h3>
            <p class="text-gray-600 text-sm mb-4">Control your privacy settings and data sharing preferences</p>
            
            <div class="bg-gray-50 rounded-lg p-8 text-center">
              <IconShield class="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h4 class="text-lg font-medium text-gray-900 mb-2">Privacy Controls</h4>
              <p class="text-gray-600 mb-4">Manage data privacy, security settings, and sharing preferences.</p>
              <button class="btn-primary">
                <IconShield class="w-4 h-4" />
                Privacy Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for mobile swipe navigation */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Smooth scroll behavior for tabs */
nav {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
</style>