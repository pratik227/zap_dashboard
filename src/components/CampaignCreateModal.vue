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
  IconEye,
  IconArrowLeft,
  IconLink,
  IconChevronDown,
  IconInfoCircle
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
  descriptionLong: '',
  goalAmount: 100000, // Default 100k sats (in sats)
  image: '',
  optionalLink: '',
  closedAt: ''
})

// UI state
const localError = ref('')
const showPreview = ref(false)
const isPublishing = ref(false)
const publishSuccess = ref(false)
const publishedCampaign = ref(null)
const currentStep = ref(1) // 1: Basics, 2: Details, 3: Preview
const imagePreview = ref(null)
const showAdvancedOptions = ref(false)

// Predefined goal amounts for quick selection
const quickGoals = [
  { value: 21000, label: '21K sats', description: 'Small goal' },
  { value: 100000, label: '100K sats', description: 'Medium goal' },
  { value: 500000, label: '500K sats', description: 'Large goal' },
  { value: 1000000, label: '1M sats', description: 'Big goal' }
]

// Initialize form with campaign data if editing
watch(() => props.campaign, (campaign) => {
  if (campaign) {
    form.value = {
      title: campaign.title || '',
      summary: campaign.summary || '',
      descriptionLong: campaign.descriptionLong || '',
      goalAmount: Math.floor(campaign.goalAmount / 1000) || 100000, // Convert millisats to sats
      image: campaign.image || '',
      optionalLink: campaign.optionalLink || '',
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

const progressPercentage = computed(() => {
  return (currentStep.value / 3) * 100
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
  
  if (form.value.optionalLink && !isValidLinkUrl(form.value.optionalLink)) {
    localError.value = 'Please enter a valid URL for optional link'
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

// Validate optional link URL
const isValidLinkUrl = (url) => {
  if (!url) return true
  
  try {
    const parsed = new URL(url)
    return true
  } catch (e) {
    return false
  }
}

// Quick goal selection
const selectQuickGoal = (amount) => {
  form.value.goalAmount = amount
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
  if (isPublishing.value) return // Prevent double submission
  
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
      descriptionLong: form.value.descriptionLong.trim(),
      goalAmount: goalAmountMsats, // in millisats
      image: form.value.image.trim(),
      optionalLink: form.value.optionalLink.trim(),
      closedAt: closedAtTimestamp
    }
    
    // Publish campaign
    const campaign = await publishCampaign(campaignData)
    
    console.log('Campaign published successfully:', campaign)
    
    // Show success state
    publishSuccess.value = true
    publishedCampaign.value = campaign
    
    // Close modal after 2 seconds
    setTimeout(() => {
      emit('close')
    }, 3000) // Increased to 3 seconds to ensure state updates complete
    
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
  
  // Create a new Date object for the end of the selected day (23:59:59.999)
  // We need to be explicit about timezone handling to avoid issues
  const year = date.getFullYear()
  const month = date.getMonth()
  const day = date.getDate()
  
  // Create a new date set to the end of the day (23:59:59.999)
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999)
  
  // Convert to Unix timestamp (seconds)
  const timestamp = Math.floor(endOfDay.getTime() / 1000)
  
  console.log(`Date string: ${dateString}`)
  console.log(`Parsed date: ${date.toLocaleString()}`)
  console.log(`End of day: ${endOfDay.toLocaleString()}`)
  console.log(`End of day timestamp: ${timestamp} (${new Date(timestamp * 1000).toLocaleString()})`)
  
  return timestamp
}
</script>

<template>
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
    <!-- Mobile-first modal design -->
    <div class="bg-white w-full sm:max-w-lg sm:rounded-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl">
      <!-- Sticky Header with Progress -->
      <div class="sticky top-0 bg-white z-10 border-b border-gray-100">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 sm:p-6">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center text-white shadow-sm">
              <IconTarget class="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 class="text-lg sm:text-xl font-bold text-gray-900">
                {{ isEditing ? 'Edit Campaign' : 'New Campaign' }}
              </h3>
              <p class="text-xs sm:text-sm text-gray-500">
                Step {{ currentStep }} of 3
              </p>
            </div>
          </div>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <IconX class="w-5 h-5" />
          </button>
        </div>
        
        <!-- Progress Bar -->
        <div class="px-4 sm:px-6 pb-4">
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div 
              class="bg-gradient-to-r from-orange-400 to-amber-400 h-2 rounded-full transition-all duration-500 ease-out"
              :style="{ width: `${progressPercentage}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Content Area -->
      <div class="overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-160px)]">
        <!-- Step 1: The Basics -->
        <div v-if="currentStep === 1" class="p-4 sm:p-6">
          <div class="text-center mb-6">
            <h4 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">What's your goal?</h4>
            <p class="text-gray-600 text-sm sm:text-base">Give your campaign a clear title and set your funding target</p>
          </div>
          
          <div class="space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-semibold text-gray-900 mb-3">Campaign Title</label>
              <input
                v-model="form.title"
                type="text"
                placeholder="e.g., Help me attend Bitcoin Conference 2024"
                class="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-0 transition-colors placeholder-gray-400"
                maxlength="80"
              />
              <div class="flex justify-between mt-2">
                <p class="text-xs text-gray-500">Make it clear and compelling</p>
                <p class="text-xs text-gray-400">{{ form.title.length }}/80</p>
              </div>
            </div>
            
            <!-- Quick Goal Selection -->
            <div>
              <label class="block text-sm font-semibold text-gray-900 mb-3">Funding Goal</label>
              
              <!-- Quick Selection Grid -->
              <div class="grid grid-cols-2 gap-3 mb-4">
                <button
                  v-for="goal in quickGoals"
                  :key="goal.value"
                  @click="selectQuickGoal(goal.value)"
                  :class="[
                    'p-3 rounded-lg border-2 text-center transition-all duration-200',
                    form.goalAmount === goal.value
                      ? 'border-orange-400 bg-orange-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  ]"
                >
                  <div class="font-bold text-gray-900 text-sm">{{ goal.label }}</div>
                  <div class="text-xs text-gray-500">{{ goal.description }}</div>
                </button>
              </div>
              
              <!-- Custom Amount -->
              <div class="relative">
                <input
                  v-model.number="form.goalAmount"
                  type="number"
                  min="1"
                  placeholder="Custom amount"
                  class="w-full px-4 py-4 pr-16 text-base border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-0 transition-colors"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                  <span class="text-sm font-medium text-gray-500">sats</span>
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">
                💡 Tip: Start with a realistic goal you can achieve
              </p>
            </div>
          </div>
        </div>
        
        <!-- Step 2: Tell Your Story -->
        <div v-if="currentStep === 2" class="p-4 sm:p-6 pb-8">
          <div class="text-center mb-6">
            <h4 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Tell your story</h4>
            <p class="text-gray-600 text-sm sm:text-base">Help people understand why they should support you</p>
          </div>
          
          <div class="space-y-6">
            <!-- Summary -->
            <div>
              <label class="block text-sm font-semibold text-gray-900 mb-3">
                Summary
                <span class="text-red-500 ml-1">*</span>
              </label>
              <textarea
                v-model="form.summary"
                rows="4"
                placeholder="Briefly explain what you're raising funds for and why it matters..."
                class="w-full px-4 py-4 text-base border-2 border-gray-200 rounded-xl focus:border-orange-400 focus:ring-0 transition-colors resize-none placeholder-gray-400"
                maxlength="280"
              ></textarea>
              <div class="flex justify-between mt-2">
                <p class="text-xs text-gray-500">Keep it concise and engaging</p>
                <p class="text-xs text-gray-400">{{ form.summary.length }}/280</p>
              </div>
            </div>
            
            <!-- Advanced Options Toggle -->
            <div class="border-t border-gray-100 pt-6">
              <button
                @click="showAdvancedOptions = !showAdvancedOptions"
                class="flex items-center justify-between w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div class="flex items-center space-x-2">
                  <IconInfoCircle class="w-4 h-4 text-gray-500" />
                  <span class="text-sm font-medium text-gray-700">Advanced Options</span>
                </div>
                <IconChevronDown :class="[
                  'w-4 h-4 text-gray-500 transition-transform duration-200',
                  showAdvancedOptions ? 'rotate-180' : ''
                ]" />
              </button>
              
              <!-- Advanced Options Content -->
              <transition name="slide-down">
                <div v-if="showAdvancedOptions" class="mt-4 space-y-4 pb-4">
                  <!-- Detailed Description -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Detailed Description
                      <span class="text-gray-400 text-xs ml-1">(optional)</span>
                    </label>
                    <textarea
                      v-model="form.descriptionLong"
                      rows="4"
                      placeholder="Provide more details about your campaign, timeline, how funds will be used..."
                      class="w-full px-3 py-3 text-sm border border-gray-300 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-colors resize-none placeholder-gray-400"
                    ></textarea>
                  </div>
                  
                  <!-- Cover Image -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Cover Image
                      <span class="text-gray-400 text-xs ml-1">(optional)</span>
                    </label>
                    <input
                      v-model="form.image"
                      type="url"
                      placeholder="https://example.com/image.jpg"
                      class="w-full px-3 py-3 text-sm border border-gray-300 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-colors"
                      @input="updateImagePreview"
                      @blur="updateImagePreview"
                    />
                    
                    <!-- Image Preview -->
                    <div v-if="imagePreview" class="mt-2 rounded-lg overflow-hidden border border-gray-200 h-24">
                      <img 
                        :src="imagePreview" 
                        alt="Preview" 
                        class="w-full h-full object-cover"
                        @error="imagePreview = null"
                      />
                    </div>
                  </div>
                  
                  <!-- Optional Links -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      External Link
                      <span class="text-gray-400 text-xs ml-1">(optional)</span>
                    </label>
                    <input
                      v-model="form.optionalLink"
                      type="url"
                      placeholder="https://yourwebsite.com"
                      class="w-full px-3 py-3 text-sm border border-gray-300 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-colors"
                    />
                    <p class="text-xs text-gray-500 mt-1">Link to your website, social media, or project details</p>
                  </div>
                  
                  <!-- End Date -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Campaign End Date
                      <span class="text-gray-400 text-xs ml-1">(optional)</span>
                    </label>
                    <input
                      v-model="form.closedAt"
                      type="date"
                      class="w-full px-3 py-3 text-sm border border-gray-300 rounded-lg focus:border-orange-400 focus:ring-1 focus:ring-orange-200 transition-colors"
                    />
                    <p class="text-xs text-gray-500 mt-1">Leave empty for no deadline</p>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
        
        <!-- Step 3: Preview & Publish -->
        <div v-if="currentStep === 3" class="p-4 sm:p-6">
          <div class="text-center mb-6">
            <h4 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Ready to launch?</h4>
            <p class="text-gray-600 text-sm sm:text-base">Review your campaign before publishing</p>
          </div>
          
          <!-- Campaign Preview Card -->
          <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-1 mb-6">
            <div class="bg-white rounded-xl overflow-hidden shadow-sm">
              <!-- Image Preview -->
              <div v-if="form.image" class="h-40 w-full overflow-hidden">
                <img 
                  :src="form.image" 
                  :alt="form.title"
                  class="w-full h-full object-cover"
                  @error="$event.target.style.display = 'none'"
                />
              </div>
              
              <!-- Content Preview -->
              <div class="p-4">
                <h3 class="text-lg font-bold text-gray-900 mb-2">{{ form.title }}</h3>
                <p class="text-gray-600 text-sm mb-4">{{ form.summary }}</p>
                
                <!-- Goal Display -->
                <div class="flex items-center justify-between p-3 bg-orange-50 rounded-lg mb-4">
                  <div class="flex items-center space-x-2">
                    <IconBolt class="w-5 h-5 text-orange-600" />
                    <span class="font-semibold text-gray-900">Goal</span>
                  </div>
                  <span class="text-lg font-bold text-orange-600">{{ form.goalAmount.toLocaleString() }} sats</span>
                </div>
                
                <!-- Optional Details -->
                <div v-if="form.optionalLink || form.closedAt" class="space-y-2 text-sm">
                  <div v-if="form.optionalLink" class="flex items-center space-x-2 text-blue-600">
                    <IconLink class="w-4 h-4" />
                    <span class="truncate">{{ form.optionalLink }}</span>
                  </div>
                  <div v-if="form.closedAt" class="flex items-center space-x-2 text-gray-600">
                    <IconCalendar class="w-4 h-4" />
                    <span>Ends {{ formatDate(form.closedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Publishing Info -->
          <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div class="flex items-start space-x-3">
              <IconBolt class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-semibold text-blue-900 mb-1">Ready to publish</h4>
                <p class="text-sm text-blue-800">
                  Your campaign will be published to Nostr and you can start sharing it immediately.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Success State -->
        <div v-if="publishSuccess" class="p-4 sm:p-6 text-center">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconCheck class="w-8 h-8 text-green-600" />
          </div>
          <h4 class="text-xl font-bold text-green-700 mb-2">Campaign Published! 🎉</h4>
          <p class="text-gray-600 mb-4">Your campaign is now live and ready to share with supporters.</p>
          <p class="text-sm text-gray-500">This window will close automatically...</p>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="localError || campaignError" class="px-4 sm:px-6 pb-4">
        <div class="bg-red-50 border border-red-200 rounded-xl p-4">
          <div class="flex items-center space-x-2">
            <IconAlertCircle class="w-5 h-5 text-red-600" />
            <span class="text-sm text-red-600">{{ localError || campaignError }}</span>
          </div>
        </div>
      </div>

      <!-- Sticky Footer Actions -->
      <div v-if="!publishSuccess" class="sticky bottom-0 bg-white border-t border-gray-100 p-4 sm:p-6">
        <div class="flex items-center justify-between space-x-3">
          <!-- Back Button -->
          <button
            v-if="currentStep > 1"
            @click="prevStep"
            :disabled="isPublishing"
            class="flex items-center space-x-2 px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            <IconArrowLeft class="w-4 h-4" />
            <span class="font-medium">Back</span>
          </button>
          <button
            v-else
            @click="$emit('close')"
            class="flex items-center space-x-2 px-4 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <IconX class="w-4 h-4" />
            <span class="font-medium">Cancel</span>
          </button>
          
          <!-- Next/Publish Button -->
          <button
            v-if="currentStep < 3"
            @click="nextStep"
            :disabled="(currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid)"
            class="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>{{ currentStep === 1 ? 'Continue' : 'Review' }}</span>
            <IconArrowRight class="w-4 h-4" />
          </button>
          <button
            v-else
            @click="publishNewCampaign"
            :disabled="isPublishing || !isFormValid"
            class="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <IconLoader v-if="isPublishing" class="w-5 h-5 animate-spin" />
            <IconBolt v-else class="w-5 h-5" />
            <span>{{ isPublishing ? 'Publishing...' : 'Publish Campaign' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Slide down animation for advanced options */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

/* Remove default input styling on mobile */
input, textarea {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

/* Ensure proper touch targets on mobile */
@media (max-width: 640px) {
  button, input, textarea {
    min-height: 44px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Smooth transitions */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Focus states for accessibility */
input:focus, textarea:focus, button:focus {
  outline: none;
}

/* Button hover effects */
button:not(:disabled):hover {
  transform: translateY(-1px);
}

button:not(:disabled):active {
  transform: translateY(0);
}
</style>