<script setup>
import { ref, computed, watch } from 'vue'
import { 
  IconTarget, 
  IconX, 
  IconCalendar, 
  IconPhoto, 
  IconCurrencyBitcoin,
  IconAlertCircle,
  IconCheck,
  IconLoader,
  IconBolt,
  IconFileDescription,
  IconArrowRight,
  IconEye
} from '@iconify-prerendered/vue-tabler'
import { useCampaigns } from '../composables/useCampaigns.js'

const props = defineProps({
  campaign: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close'])

const { publishCampaign, isLoading, error: campaignError } = useCampaigns()

// Form state
const form = ref({
  title: '',
  summary: '',
  goalAmount: 100000, // Default 100k sats (in sats)
  image: '',
  closedAt: ''
})

// UI state
const localError = ref('')
const showPreview = ref(false)
const isPublishing = ref(false)
const publishSuccess = ref(false)
const publishedCampaign = ref(null)
const currentStep = ref(1) // 1: Basic Info, 2: Details, 3: Preview
const imagePreview = ref(null)

// Initialize form with campaign data if editing
watch(() => props.campaign, (campaign) => {
  if (campaign) {
    form.value = {
      title: campaign.title || '',
      summary: campaign.summary || '',
      goalAmount: Math.floor(campaign.goalAmount / 1000) || 100000, // Convert millisats to sats
      image: campaign.image || '',
      closedAt: campaign.closedAt ? new Date(campaign.closedAt * 1000).toISOString().split('T')[0] : ''
    }
    
    // Set image preview if available
    if (campaign.image) {
      imagePreview.value = campaign.image
    }
  }
}, { immediate: true })

// Computed properties
const isFormValid = computed(() => {
  return form.value.title.trim() && 
         form.value.summary.trim() && 
         form.value.goalAmount > 0
})

const isEditing = computed(() => {
  return !!props.campaign
})

const isStep1Valid = computed(() => {
  return form.value.title.trim() && form.value.goalAmount > 0
})

const isStep2Valid = computed(() => {
  return form.value.summary.trim()
})

// Validate form
const validateForm = () => {
  localError.value = ''
  
  if (!form.value.title.trim()) {
    localError.value = 'Title is required'
    return false
  }
  
  if (!form.value.summary.trim()) {
    localError.value = 'Summary is required'
    return false
  }
  
  if (!form.value.goalAmount || form.value.goalAmount <= 0) {
    localError.value = 'Goal amount must be greater than 0'
    return false
  }
  
  if (form.value.image && !isValidImageUrl(form.value.image)) {
    localError.value = 'Please enter a valid image URL'
    return false
  }
  
  return true
}

// Validate image URL
const isValidImageUrl = (url) => {
  if (!url) return true
  
  try {
    const parsed = new URL(url)
    return true
  } catch (e) {
    return false
  }
}

// Show preview
const showCampaignPreview = () => {
  if (!validateForm()) return
  showPreview.value = true
}

// Close preview
const closePreview = () => {
  showPreview.value = false
}

// Next step
const nextStep = () => {
  if (currentStep.value === 1 && !isStep1Valid.value) {
    localError.value = 'Please fill in all required fields'
    return
  }
  
  if (currentStep.value === 2 && !isStep2Valid.value) {
    localError.value = 'Please provide a summary'
    return
  }
  
  if (currentStep.value < 3) {
    currentStep.value++
    localError.value = ''
  } else {
    publishNewCampaign()
  }
}

// Previous step
const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
    localError.value = ''
  }
}

// Update image preview
const updateImagePreview = () => {
  if (form.value.image && isValidImageUrl(form.value.image)) {
    imagePreview.value = form.value.image
  } else {
    imagePreview.value = null
  }
}

// Publish campaign
const publishNewCampaign = async () => {
  if (!validateForm()) return
  
  isPublishing.value = true
  localError.value = ''
  
  try {
    // Convert sats to millisats for storage
    const goalAmountMsats = form.value.goalAmount * 1000
    
    // Convert date to timestamp
    const closedAtTimestamp = getEndOfDayTimestamp(form.value.closedAt)
    
    // Create campaign data
    const campaignData = {
      title: form.value.title.trim(),
      summary: form.value.summary.trim(),
      goalAmount: goalAmountMsats, // in millisats
      image: form.value.image.trim(),
      closedAt: closedAtTimestamp
    }
    
    // Publish campaign
    const campaign = await publishCampaign(campaignData)
    
    // Show success state
    publishSuccess.value = true
    publishedCampaign.value = campaign
    
    // Close modal after 2 seconds
    setTimeout(() => {
      emit('close')
    }, 2000)
    
  } catch (err) {
    localError.value = err.message
    console.error('Failed to publish campaign:', err)
  } finally {
    isPublishing.value = false
  }
}

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'No deadline'
  
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

// Set the end of day for the closed date (23:59:59.999)
const getEndOfDayTimestamp = (dateString) => {
  if (!dateString) return null
  
  const date = new Date(dateString)
  // Set to end of day (23:59:59.999) in local timezone
  date.setHours(23, 59, 59, 999)
  
  return Math.floor(date.getTime() / 1000)
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center text-white shadow-sm">
              <IconTarget class="w-5 h-5" />
            </div>
            <h3 class="text-xl font-semibold text-gray-900">
              {{ isEditing ? 'Edit Campaign' : 'Create New Campaign' }}
            </h3>
          </div>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 p-2 rounded-lg transition-colors hover:bg-gray-100"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
        
        <!-- Progress Steps -->
        <div class="flex items-center justify-between mt-6 px-6">
          <div 
            v-for="step in 3" 
            :key="step"
            class="flex items-center"
          >
            <div 
              :class="[
                'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                currentStep >= step 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-200 text-gray-600'
              ]"
            >
              {{ step }}
            </div>
            <div 
              v-if="step < 3"
              :class="[
                'h-1 w-16 sm:w-24 mx-2',
                currentStep > step ? 'bg-orange-500' : 'bg-gray-200'
              ]"
            ></div>
          </div>
        </div>
        
        <!-- Step Labels -->
        <div class="flex items-center justify-between mt-2 px-4 text-xs text-gray-600">
          <span :class="{ 'text-orange-600 font-medium': currentStep === 1 }">Basic Info</span>
          <span :class="{ 'text-orange-600 font-medium': currentStep === 2 }">Details</span>
          <span :class="{ 'text-orange-600 font-medium': currentStep === 3 }">Preview</span>
        </div>
      </div>

      <!-- Step 1: Basic Info -->
      <div v-if="currentStep === 1" class="p-6">
        <div class="space-y-5">
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Campaign Title <span class="text-red-500">*</span></label>
            <input
              v-model="form.title"
              type="text"
              placeholder="e.g., Support my trip to Nostrasia!"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200"
            />
            <p class="text-xs text-gray-500 mt-1">
              Choose a clear, compelling title that describes your campaign
            </p>
          </div>
          
          <!-- Goal Amount -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Funding Goal (sats) <span class="text-red-500">*</span></label>
            <div class="relative">
              <input
                v-model.number="form.goalAmount"
                type="number"
                min="1"
                placeholder="100000"
                class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <IconBolt class="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Set a realistic goal amount in satoshis (1 BTC = 100,000,000 sats)
            </p>
          </div>
          
          <!-- End Date -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">End Date (optional)</label>
            <div class="relative">
              <input
                v-model="form.closedAt"
                type="date"
                class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <IconCalendar class="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Set a deadline for your campaign (leave empty for no deadline)
            </p>
          </div>
        </div>
      </div>
      
      <!-- Step 2: Details -->
      <div v-if="currentStep === 2" class="p-6">
        <div class="space-y-5">
          <!-- Summary -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Campaign Summary <span class="text-red-500">*</span></label>
            <textarea
              v-model="form.summary"
              rows="4"
              placeholder="Describe your campaign and why people should support it..."
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200 resize-none"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">
              Provide a clear, compelling description of your campaign (max 500 characters)
            </p>
          </div>
          
          <!-- Image URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Cover Image URL (optional)</label>
            <div class="relative">
              <input
                v-model="form.image"
                type="url"
                placeholder="https://example.com/image.jpg"
                class="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base transition-all duration-200"
                @input="updateImagePreview"
                @blur="updateImagePreview"
              />
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <IconPhoto class="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              Add an image URL to make your campaign more engaging
            </p>
            
            <!-- Image Preview -->
            <div v-if="imagePreview" class="mt-3 rounded-lg overflow-hidden border border-gray-200 h-40">
              <img 
                :src="imagePreview" 
                alt="Preview" 
                class="w-full h-full object-cover"
                @error="imagePreview = null"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Step 3: Preview -->
      <div v-if="currentStep === 3" class="p-6">
        <h4 class="text-lg font-semibold text-gray-900 mb-4">Campaign Preview</h4>
        
        <!-- Campaign Preview -->
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <!-- Image Preview -->
          <div v-if="form.image" class="h-48 w-full overflow-hidden">
            <img 
              :src="form.image" 
              :alt="form.title"
              class="w-full h-full object-cover"
              @error="$event.target.style.display = 'none'"
            />
          </div>
          
          <!-- Content Preview -->
          <div class="p-5">
            <!-- Title and Summary -->
            <h3 class="text-xl font-semibold text-gray-900 mb-3">{{ form.title }}</h3>
            <p class="text-gray-600 mb-4">{{ form.summary }}</p>
            
            <!-- Goal Amount -->
            <div class="flex items-center space-x-2 mb-4">
              <div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <IconBolt class="w-4 h-4 text-orange-600" />
              </div>
              <span class="font-medium text-gray-900">{{ form.goalAmount.toLocaleString() }} sats</span>
            </div>
            
            <!-- Deadline -->
            <div v-if="form.closedAt" class="flex items-center space-x-2">
              <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <IconCalendar class="w-4 h-4 text-blue-600" />
              </div>
              <span class="text-gray-600">Ends on {{ formatDate(form.closedAt) }}</span>
            </div>
          </div>
        </div>
        
        <!-- Publishing Info -->
        <div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <IconBolt class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-medium text-blue-900 mb-1">Ready to Publish</h4>
              <p class="text-sm text-blue-800">
                Your campaign will be published to the Nostr network and visible to anyone with the link.
                You can share it with your supporters to start collecting sats.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="localError || campaignError" class="px-6 pb-4">
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 animate-pulse">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-red-600">{{ localError || campaignError }}</span>
          </div>
        </div>
      </div>
      
      <!-- Success Message -->
      <div v-if="publishSuccess" class="px-6 pb-4">
        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <IconCheck class="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 class="font-medium text-green-900">Campaign Published!</h4>
              <p class="text-sm text-green-800">
                Your campaign has been successfully published to the Nostr network.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="p-6 border-t border-gray-200 flex justify-between">
        <!-- Back/Cancel Button -->
        <button
          v-if="currentStep > 1"
          @click="prevStep"
          class="btn-secondary"
        >
          Back
        </button>
        <button
          v-else
          @click="$emit('close')"
          class="btn-secondary"
        >
          Cancel
        </button>
        
        <!-- Next/Publish Button -->
        <button
          v-if="currentStep < 3"
          @click="nextStep"
          :disabled="(currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid)"
          class="btn-primary"
        >
          <span>Next</span>
          <IconArrowRight class="w-4 h-4" />
        </button>
        <button
          v-else
          @click="publishNewCampaign"
          :disabled="isPublishing || !isFormValid"
          class="btn-primary"
        >
          <IconLoader v-if="isPublishing" class="w-4 h-4 animate-spin" />
          <IconBolt v-else class="w-4 h-4" />
          {{ isPublishing ? 'Publishing...' : 'Publish Campaign' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Button Styles */
.btn-primary {
  @apply bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-secondary {
  @apply bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-4 py-3 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md;
}

/* Form focus effects */
input:focus, textarea:focus {
  @apply outline-none ring-2 ring-orange-300 border-orange-400;
}

/* Smooth animations */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .btn-primary, .btn-secondary {
    @apply px-3 py-2 text-sm;
  }
}
</style>