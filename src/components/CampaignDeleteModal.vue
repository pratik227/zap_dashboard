<script setup>
import { IconTrash, IconAlertTriangle, IconX } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  campaign: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
      <div class="flex items-center space-x-3 mb-4">
        <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
          <IconTrash class="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">Delete Campaign</h3>
          <p class="text-gray-600 text-sm">This action cannot be undone.</p>
        </div>
      </div>
      
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div class="flex items-start space-x-3">
          <IconAlertTriangle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p class="text-red-800 text-sm">
              Are you sure you want to delete "<strong>{{ campaign.title }}</strong>"?
            </p>
            <p class="text-red-700 text-xs mt-1">
              This will remove the campaign from the Nostr network. Any zaps already received will remain with you.
            </p>
          </div>
        </div>
      </div>
      
      <div class="flex space-x-3">
        <button 
          @click="$emit('close')" 
          class="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button 
          @click="$emit('confirm')" 
          class="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors flex-1 flex items-center justify-center"
        >
          <IconTrash class="w-4 h-4 mr-2" />
          Delete
        </button>
      </div>
    </div>
  </div>
</template>