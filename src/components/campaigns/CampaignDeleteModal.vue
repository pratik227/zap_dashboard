<script setup>
import { IconTrash, IconAlertTriangle, IconX, IconShield } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  }
})

import { ref, onMounted } from 'vue'

const emit = defineEmits(['close', 'confirm'])
const modalRoot = ref(null)
onMounted(() => { modalRoot.value?.focus() })
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4" @click.self="$emit('close')" @keydown.escape="$emit('close')" tabindex="-1" ref="modalRoot">
    <div class="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
      <div class="flex items-center space-x-3 mb-6">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <IconTrash class="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 class="text-xl font-semibold text-gray-900">Delete Campaign</h3>
          <p class="text-gray-600 text-sm">This action cannot be undone.</p>
        </div>
      </div>
      
      <div class="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
        <div class="flex items-start space-x-3">
          <IconAlertTriangle class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-red-800 text-base font-medium mb-2">
              Are you sure you want to delete "<span class="font-semibold">{{ props.campaign.title }}</span>"?
            </p>
            <p class="text-red-700 text-sm">
              This will permanently remove the campaign from the Nostr network. Any zaps already received will remain with you.
            </p>
          </div>
        </div>
      </div>
      
      <!-- Additional Warning -->
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div class="flex items-start space-x-3">
          <IconShield class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-sm text-amber-800">
              While the campaign will be deleted from the network, note that data published to Nostr may still exist on some relays.
            </p>
          </div>
        </div>
      </div>
      
      <div class="flex space-x-3">
        <button 
          @click="$emit('close')" 
          class="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
        >
          <IconX class="w-4 h-4" />
          <span>Cancel</span>
        </button>
        <button 
          @click="$emit('confirm')" 
          class="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <IconTrash class="w-4 h-4" />
          <span>Delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 640px) {
  button {
    min-height: 44px;
  }
}
</style>