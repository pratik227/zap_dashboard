<script setup>
import { computed } from 'vue'
import {
  IconList,
  IconUsers,
  IconUserPlus,
  IconEdit,
  IconTrash,
  IconShare,
  IconEye,
  IconCopy,
  IconExternalLink,
  IconCalendar,
  IconUser,
  IconCheck,
  IconLoader,
  IconDots
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  list: {
    type: Object,
    required: true
  },
  isOwner: {
    type: Boolean,
    default: false
  },
  isProcessing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['edit', 'delete', 'share', 'follow-all', 'view', 'follow-selected'])

// Computed properties
const memberCount = computed(() => {
  return props.list.memberCount || props.list.members?.length || 0
})

const createdDate = computed(() => {
  const date = new Date(props.list.created_at * 1000)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

const updatedDate = computed(() => {
  if (!props.list.updated_at) return null
  const date = new Date(props.list.updated_at)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
})

// Generate member avatars preview
const memberAvatars = computed(() => {
  if (!props.list.members) return []
  
  // Show first 3 members with avatars
  return props.list.members.slice(0, 3).map(pubkey => ({
    pubkey,
    avatar: generateFallbackAvatar(pubkey)
  }))
})

// Generate fallback avatar
const generateFallbackAvatar = (pubkey) => {
  const avatars = [
    'https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
  ]
  
  const hash = pubkey.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  
  return avatars[Math.abs(hash) % avatars.length]
}
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
    <!-- List Image or Placeholder -->
    <div class="h-32 bg-gradient-to-br from-orange-100 to-amber-100 relative overflow-hidden">
      <img 
        v-if="list.image"
        :src="list.image" 
        :alt="list.title"
        class="w-full h-full object-cover"
        @error="$event.target.style.display = 'none'"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <IconList class="w-12 h-12 text-orange-600/50" />
      </div>
      
      <!-- Member Count Badge -->
      <div class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full">
        <span class="text-xs font-medium text-gray-700">{{ memberCount }} members</span>
      </div>
    </div>

    <!-- Content -->
    <div class="p-4">
      <!-- Title and Description -->
      <div class="mb-4">
        <h3 class="font-semibold text-gray-900 mb-1 line-clamp-1">{{ list.title }}</h3>
        <p v-if="list.description" class="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {{ list.description }}
        </p>
      </div>


      <!-- Member Avatars Preview -->
<!--      <div v-if="memberAvatars.length > 0" class="flex items-center space-x-2 mb-4">-->
<!--        <div class="flex -space-x-2">-->
<!--          <div-->
<!--            v-for="member in memberAvatars"-->
<!--            :key="member.pubkey"-->
<!--            class="w-6 h-6 rounded-full border-2 border-white overflow-hidden"-->
<!--          >-->
<!--            <img-->
<!--              :src="member.avatar"-->
<!--              :alt="member.pubkey"-->
<!--              class="w-full h-full object-cover"-->
<!--            />-->
<!--          </div>-->
<!--          <div v-if="memberCount > 3" class="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">-->
<!--            <span class="text-xs font-medium text-gray-600">+{{ memberCount - 3 }}</span>-->
<!--          </div>-->
<!--        </div>-->
<!--        <span class="text-xs text-gray-500">{{ memberCount }} member{{ memberCount !== 1 ? 's' : '' }}</span>-->
<!--      </div>-->

      <!-- Metadata -->
      <div class="flex items-center justify-between text-xs text-gray-500 mb-4">
        <div class="flex items-center space-x-1">
          <IconCalendar class="w-3 h-3" />
          <span>{{ createdDate }}</span>
        </div>
        <div v-if="updatedDate" class="flex items-center space-x-1">
          <span>Updated {{ updatedDate }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="isOwner" class="flex items-center space-x-2">
        <button
          @click="emit('edit', list)"
          class="btn-secondary text-sm flex-1"
        >
          <IconEdit class="w-4 h-4" />
          Edit
        </button>
        <!-- <button
          @click="emit('share', list)"
          class="btn-secondary text-sm"
        >
          <IconShare class="w-4 h-4" />
        </button> -->
        <button
          @click="emit('delete', list.id)"
          class="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <IconTrash class="w-4 h-4" />
        </button>
      </div>

      <div v-else class="flex items-center space-x-2">
        <button
          @click="emit('follow-all', list)"
          :disabled="isProcessing"
          class="btn-primary text-sm flex-1"
        >
          <IconLoader v-if="isProcessing" class="w-4 h-4 animate-spin" />
          <IconUserPlus class="w-4 h-4" />
          {{ isProcessing ? 'Following...' : 'Follow All' }}
        </button>
        <button
          @click="emit('view', list)"
          class="btn-secondary text-sm"
        >
          <IconEye class="w-4 h-4" />
        </button>
        <!-- <button
          @click="emit('share', list)"
          class="btn-secondary text-sm"
        >
          <IconShare class="w-4 h-4" />
        </button> -->
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
