<script setup>
import { inject } from 'vue'
import { IconAlertTriangle, IconArrowLeft, IconSearch } from '@iconify-prerendered/vue-tabler'

// Get changePage function from parent
const changePage = inject('changePage')

// Go back to campaigns list
const goBack = () => {
  changePage('campaigns')
}
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[60vh] p-4">
    <div class="text-center max-w-md">
      <div class="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <IconAlertTriangle class="w-10 h-10 text-orange-600" />
      </div>
      
      <h1 class="text-2xl font-bold text-gray-900 mb-4">Campaign Not Found</h1>
      
      <p class="text-gray-600 mb-8">
        The campaign you're looking for doesn't exist or has been deleted.
        It may have been removed by the creator or the event ID might be incorrect.
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          @click="goBack"
          class="btn-primary"
        >
          <IconArrowLeft class="w-4 h-4" />
          Back to Campaigns
        </button>
      </div>
    </div>
  </div>
</template>