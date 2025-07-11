<script setup>
import { ref } from 'vue'
import { IconRefresh, IconShield, IconArrowLeft } from '@iconify-prerendered/vue-tabler'
import AccountReset from '../components/AccountReset.vue'

const emit = defineEmits(['change-page'])

const resetComplete = ref(false)
const resetResult = ref(null)

const handleResetComplete = (result) => {
  resetComplete.value = true
  resetResult.value = result
  
  // If reset was successful, we might want to redirect after a delay
  if (result.success) {
    setTimeout(() => {
      emit('change-page', 'dashboard')
    }, 5000) // 5 second delay
  }
}

const goBack = () => {
  emit('change-page', 'settings')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
          <IconRefresh class="w-6 h-6 text-orange-600" />
          <span>Account Reset</span>
        </h1>
        <p class="text-gray-600">Reset all account data and start fresh</p>
      </div>
      
      <button
        @click="goBack"
        class="btn-secondary"
      >
        <IconArrowLeft class="w-4 h-4" />
        Back to Settings
      </button>
    </div>
    
    <!-- Reset Component -->
    <AccountReset @reset-complete="handleResetComplete" />
    
    <!-- Post-Reset Message -->
    <div v-if="resetComplete && resetResult?.success" class="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <IconRefresh class="w-8 h-8 text-green-600" />
      </div>
      <h3 class="text-xl font-semibold text-green-900 mb-2">Reset Complete</h3>
      <p class="text-green-800 mb-4">
        Your account data has been successfully reset. You will be redirected to the dashboard in a few seconds.
      </p>
      <button
        @click="emit('change-page', 'dashboard')"
        class="btn-primary"
      >
        Go to Dashboard Now
      </button>
    </div>
  </div>
</template>