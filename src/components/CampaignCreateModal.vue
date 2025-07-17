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
  IconBolt
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

// Publish campaign
const publishNewCampaign = async () => {
  if (!validateForm()) return
  
  isPublishing.value = true
  localError.value = ''
  
  try {
    // Convert sats to millisats for storage
    const goalAmountMsats = form.value.goalAmount * 1000
    
    // Convert date to timestamp
    let closedAtTimestamp = null
    if (form.value.closedAt) {
      closedAtTimestamp = Math.floor(new Date(form.value.closedAt).getTime() / 1000)
    }
    
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
</script>

<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center z-[9999] p-4">
    <div class="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <IconTarget class="w-5 h-5 text-orange-600" />
            <span>{{ isEditing ? 'Edit Campaign' : 'Create New Campaign' }}</span>
          </h3>
          <button
            @click="$emit('close')"
            class="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Preview Mode -->
      <div v-if="showPreview" class="p-6">
        <h4 class="text-lg font-semibold text-gray-900 mb-4">Campaign Preview</h4>
        
        <!-- Campaign Preview -->
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <!-- Image Preview -->
          <div v-if="form.image" class="mb-4 rounded-lg overflow-hidden h-40">
            <img 
              :src="form.image" 
              :alt="form.title"
              class="w-full h-full object-cover"
              @error="$event.target.style.display = 'none'"
            />
          </div>
          
          <!-- Title and Summary -->
          <h3 class="text-xl font-semibold text-gray-900 mb-2">{{ form.title }}</h3>
          <p class="text-gray-600 mb-4">{{ form.summary }}</p>
          
          <!-- Goal Amount -->
          <div class="flex items-center space-x-2 mb-4">
            <IconCurrencyBitcoin class="w-5 h-5 text-orange-600" />
            <span class="font-medium text-gray-900">{{ form.goalAmount.toLocaleString() }} sats</span>
          </div>
          
          <!-- Deadline -->
          <div v-if="form.closedAt" class="flex items-center space-x-2">
            <IconCalendar class="w-5 h-5 text-orange-600" />
            <span class="text-gray-600">Ends on {{ formatDate(form.closedAt) }}</span>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-3">
          <button
            @click="closePreview"
            class="btn-secondary"
          >
            Back to Edit
          </button>
          <button
            @click="publishNewCampaign"
            :disabled="isPublishing"
            class="btn-primary"
          >
            <IconLoader v-if="isPublishing" class="w-4 h-4 animate-spin" />
            <IconBolt v-else class="w-4 h-4" />
            {{ isPublishing ? 'Publishing...' : 'Publish Campaign' }}
          </button>
        </div>
        
        <!-- Success Message -->
        <div v-if="publishSuccess" class="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div class="flex items-center space-x-2">
            <IconCheck class="w-5 h-5 text-green-600" />
            <span class="text-green-800">Campaign published successfully!</span>
          </div>
        </div>
      </div>

      <!-- Form Mode -->
      <div v-else class="p-6 space-y-4">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Campaign Title</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="e.g., Support my trip to Nostrasia!"
            class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
          />
        </div>
        
        <!-- Summary -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Summary</label>
          <textarea
            v-model="form.summary"
            rows="3"
            placeholder="Briefly describe your campaign..."
            class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
          ></textarea>
        </div>
        
        <!-- Goal Amount -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Goal Amount (sats)</label>
          <div class="relative">
            <input
              v-model.number="form.goalAmount"
              type="number"
              min="1"
              placeholder="100000"
              class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <IconBolt class="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
        
        <!-- Image URL -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Image URL (optional)</label>
          <div class="relative">
            <input
              v-model="form.image"
              type="url"
              placeholder="https://example.com/image.jpg"
              class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <IconPhoto class="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Enter a URL for an image to display with your campaign
          </p>
        </div>
        
        <!-- End Date -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">End Date (optional)</label>
          <div class="relative">
            <input
              v-model="form.closedAt"
              type="date"
              class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base"
            />
            <div class="absolute inset-y-0 right-0 flex items-center pr-3">
              <IconCalendar class="w-4 h-4 text-gray-400" />
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Set a deadline for your campaign (leave empty for no deadline)
          </p>
        </div>
        
        <!-- Error Message -->
        <div v-if="localError || campaignError" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-red-600">{{ localError || campaignError }}</span>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-3 pt-4">
          <button
            @click="$emit('close')"
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            @click="showCampaignPreview"
            :disabled="!isFormValid"
            class="btn-primary"
          >
            Preview
          </button>
        </div>
      </div>
    </div>
  </div>
</template>