<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import * as nip19 from 'nostr-tools/nip19'
import { 
  IconFileText, 
  IconMail, 
  IconMicrophone, 
  IconVideo, 
  IconPhoto, 
  IconFile,
  IconX,
  IconPlus,
  IconLock,
  IconUser,
  IconBolt,
  IconShare,
  IconExternalLink,
  IconChevronDown,
  IconChevronRight,
  IconChevronLeft,
  IconCheck,
  IconEdit,
  IconEye,
  IconWand,
  IconSparkles,
  IconTarget,
  IconPalette,
  IconSettings,
  IconAlertCircle,
  IconInfoCircle,
  IconBookmark,
  IconCalendar,
  IconGlobe,
  IconHash,
  IconAlignLeft,
  IconDeviceFloppy,
  IconSend
} from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  form: {
    type: Object,
    required: true
  },
  isEditing: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  isAuthenticated: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['submit', 'cancel', 'save-draft'])

// Enhanced content types with better descriptions
const contentTypes = [
  { 
    value: 'article', 
    label: 'Article', 
    icon: IconFileText,
    description: 'In-depth written content, tutorials, or thought pieces',
    examples: 'How-to guides, opinion pieces, technical articles'
  },
  { 
    value: 'newsletter', 
    label: 'Newsletter', 
    icon: IconMail,
    description: 'Regular updates, news, or curated content for subscribers',
    examples: 'Weekly updates, industry news, curated links'
  },
  { 
    value: 'story', 
    label: 'Story', 
    icon: IconBookmark,
    description: 'Creative writing, fiction, or personal narratives',
    examples: 'Short stories, personal experiences, creative fiction'
  },
  { 
    value: 'review', 
    label: 'Review', 
    icon: IconTarget,
    description: 'Product reviews, book reviews, or critical analysis',
    examples: 'Product comparisons, book reviews, service evaluations'
  }
]

const monetizationModels = [
  { 
    value: 'free', 
    label: 'Free Content',
    description: 'Accessible to everyone, great for building audience',
    icon: IconGlobe,
    color: 'green'
  },
  { 
    value: 'one-time', 
    label: 'Premium Content',
    description: 'One-time payment to unlock full content',
    icon: IconLock,
    color: 'orange'
  }
]

// Wizard steps
const wizardSteps = [
  {
    id: 'basics',
    title: 'Content Basics',
    description: 'Define your content type and core information',
    icon: IconEdit,
    fields: ['title', 'type', 'description']
  },
  {
    id: 'content',
    title: 'Write Your Content',
    description: 'Create your blog post content',
    icon: IconEdit,
    fields: ['previewText', 'fullContent']
  },
  {
    id: 'monetization',
    title: 'Monetization',
    description: 'Set pricing and access model',
    icon: IconBolt,
    fields: ['monetizationModel', 'price']
  },
  {
    id: 'metadata',
    title: 'Enhance & Publish',
    description: 'Add tags, images, and final touches',
    icon: IconSparkles,
    fields: ['tags', 'coverImage']
  }
]

// State
const currentStep = ref(0)
const newTag = ref('')
const showClientDropdown = ref(false)
const dropdownRef = ref(null)
const completedSteps = ref(new Set())
const showAdvancedOptions = ref(false)
const wordCount = ref({ preview: 0, full: 0 })
const estimatedReadTime = ref(0)

// Auto-save state
const lastSaved = ref(null)
const hasUnsavedChanges = ref(false)

// Content helpers - moved before watch statements
const updateWordCount = () => {
  const previewWords = props.form.previewText.trim().split(/\s+/).filter(word => word.length > 0).length
  const fullWords = props.form.fullContent.trim().split(/\s+/).filter(word => word.length > 0).length
  
  wordCount.value = {
    preview: previewWords,
    full: fullWords
  }
}

const updateReadingTime = () => {
  const wordsPerMinute = 200 // Average reading speed
  const totalWords = wordCount.value.full
  estimatedReadTime.value = Math.ceil(totalWords / wordsPerMinute)
}

// Watch for form changes to track unsaved changes
watch(() => props.form, () => {
  hasUnsavedChanges.value = true
}, { deep: true })

// Watch for monetization model changes
watch(() => props.form.monetizationModel, (newModel) => {
  if (newModel === 'free') {
    props.form.price = 0
  } else if (props.form.price === 0) {
    props.form.price = 1000 // Default price for premium content
  }
})

// Watch content for word count and reading time
watch(() => props.form.fullContent, (content) => {
  updateWordCount()
  updateReadingTime()
}, { immediate: true })

watch(() => props.form.previewText, () => {
  updateWordCount()
}, { immediate: true })

// Computed properties
const isFormValid = computed(() => {
  return props.form.title.trim() &&
         props.form.description.trim() &&
         props.form.previewText.trim() &&
         props.form.fullContent.trim() &&
         (props.form.monetizationModel === 'free' || props.form.price > 0)
})

const currentStepData = computed(() => wizardSteps[currentStep.value])

const isStepValid = computed(() => {
  const step = wizardSteps[currentStep.value]
  return step.fields.every(field => {
    if (field === 'price') {
      return props.form.monetizationModel === 'free' || props.form.price > 0
    }
    if (field === 'tags' || field === 'coverImage') {
      return true // These are optional
    }
    return props.form[field] && props.form[field].toString().trim()
  })
})

const canProceed = computed(() => {
  return isStepValid.value && props.isAuthenticated
})

const progressPercentage = computed(() => {
  return ((currentStep.value + 1) / wizardSteps.length) * 100
})

// Step navigation
const nextStep = () => {
  if (canProceed.value && currentStep.value < wizardSteps.length - 1) {
    completedSteps.value.add(currentStep.value)
    currentStep.value++
    scrollToTop()
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
    scrollToTop()
  }
}

const goToStep = (stepIndex) => {
  if (stepIndex >= 0 && stepIndex < wizardSteps.length) {
    currentStep.value = stepIndex
    scrollToTop()
  }
}

const scrollToTop = () => {
  nextTick(() => {
    const element = document.querySelector('.content-form-container')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

// Tag management
const addTag = () => {
  if (newTag.value.trim() && !props.form.tags.includes(newTag.value.trim())) {
    props.form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  props.form.tags.splice(index, 1)
}

const addSuggestedTag = (tag) => {
  if (!props.form.tags.includes(tag)) {
    props.form.tags.push(tag)
  }
}

// Suggested tags based on content type
const suggestedTags = computed(() => {
  const tagMap = {
    article: ['tutorial', 'guide', 'howto', 'tips', 'education'],
    newsletter: ['news', 'updates', 'weekly', 'digest', 'curated'],
    story: ['fiction', 'creative', 'narrative', 'personal', 'experience'],
    review: ['review', 'analysis', 'comparison', 'recommendation', 'critique']
  }
  
  return tagMap[props.form.type] || []
})

// Auto-save functionality
const autoSave = async () => {
  if (hasUnsavedChanges.value && props.isAuthenticated) {
    try {
      emit('save-draft')
      lastSaved.value = new Date()
      hasUnsavedChanges.value = false
    } catch (error) {
      console.error('Auto-save failed:', error)
    }
  }
}

// Auto-save every 30 seconds
let autoSaveInterval = null
if (props.isAuthenticated) {
  autoSaveInterval = setInterval(autoSave, 30000)
}

// Cleanup
const cleanup = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
  }
}

// Event handlers
const handleSubmit = () => {
  if (isFormValid.value && props.isAuthenticated) {
    emit('submit')
    cleanup()
  }
}

const handleSaveDraft = () => {
  if (props.isAuthenticated) {
    emit('save-draft')
    lastSaved.value = new Date()
    hasUnsavedChanges.value = false
  }
}

const handleCancel = () => {
  cleanup()
  emit('cancel')
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    showClientDropdown.value = false
  }
}

// Content templates
const contentTemplates = {
  article: {
    title: 'How to Master [Your Topic]',
    description: 'A comprehensive guide to understanding and implementing [your topic] effectively.',
    previewText: 'In this article, we\'ll explore the fundamentals of [your topic] and provide practical steps you can take to improve your skills. Whether you\'re a beginner or looking to refine your approach, this guide has something for everyone.',
    fullContent: '# Introduction\n\nWelcome to this comprehensive guide on [your topic]. In today\'s fast-paced world, understanding [your topic] has become increasingly important.\n\n## What You\'ll Learn\n\n- Key concepts and fundamentals\n- Practical implementation strategies\n- Common pitfalls to avoid\n- Advanced techniques for experts\n\n## Getting Started\n\n[Write your detailed content here...]\n\n## Conclusion\n\nBy following the strategies outlined in this article, you\'ll be well on your way to mastering [your topic]. Remember, practice makes perfect, and consistency is key to long-term success.'
  },
  newsletter: {
    title: 'Weekly Update - [Date]',
    description: 'Your weekly dose of insights, updates, and curated content.',
    previewText: 'This week\'s newsletter covers the latest developments in [your field], upcoming events, and hand-picked resources to help you stay ahead of the curve.',
    fullContent: '# This Week\'s Highlights\n\n## 🔥 Trending Topics\n\n- [Topic 1]: Brief description\n- [Topic 2]: Brief description\n- [Topic 3]: Brief description\n\n## 📚 Recommended Reading\n\n- [Article 1]: Why it matters\n- [Article 2]: Key takeaways\n\n## 🎯 Action Items\n\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n\n## 💭 Final Thoughts\n\n[Your personal insights and commentary]\n\n---\n\nThanks for reading! See you next week.'
  },
  story: {
    title: 'The [Story Title]',
    description: 'A captivating story about [brief description].',
    previewText: 'It was a day like any other when [protagonist] discovered something that would change everything. This is the story of [brief hook that makes readers want to continue].',
    fullContent: '# Chapter 1\n\nThe morning sun cast long shadows across [setting description]. [Protagonist name] had no idea that this ordinary Tuesday would become the most extraordinary day of their life.\n\n[Continue your story here...]\n\n## What Happens Next?\n\n[Build suspense and character development]\n\n## The Turning Point\n\n[Describe the crucial moment]\n\n## Resolution\n\n[Conclude your story with a satisfying ending]'
  },
  review: {
    title: '[Product/Service] Review: Is It Worth It?',
    description: 'An honest, detailed review of [product/service] based on real-world testing.',
    previewText: 'After using [product/service] for [time period], here\'s my honest assessment of its strengths, weaknesses, and whether it\'s worth your investment.',
    fullContent: '# Overview\n\n[Product/service] promises to [main value proposition]. But does it deliver? Here\'s my comprehensive review.\n\n## What I Tested\n\n- Feature 1\n- Feature 2\n- Feature 3\n\n## The Good\n\n✅ [Positive aspect 1]\n✅ [Positive aspect 2]\n✅ [Positive aspect 3]\n\n## The Not-So-Good\n\n❌ [Negative aspect 1]\n❌ [Negative aspect 2]\n\n## Final Verdict\n\n**Rating: [X]/10**\n\n[Your final recommendation and who this is best suited for]'
  }
}

const applyTemplate = (templateKey) => {
  const template = contentTemplates[templateKey]
  if (template) {
    Object.assign(props.form, template)
    updateWordCount()
    updateReadingTime()
  }
}

// Initialize word count
updateWordCount()
updateReadingTime()
</script>

<template>
  <div class="content-form-container space-y-6">
    <!-- Wizard Header -->
    <div class="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl p-6 shadow-lg">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold mb-2 flex items-center space-x-2">
            <IconWand class="w-6 h-6" />
            <span>{{ isEditing ? 'Edit Your Content' : 'Create Amazing Content' }}</span>
          </h1>
          <p class="text-purple-100">
            {{ isEditing ? 'Update your published content' : 'Follow our guided process to create engaging, professional content' }}
          </p>
        </div>
        
        <!-- Progress Indicator -->
        <div class="bg-white/20 backdrop-blur-sm rounded-lg p-4 min-w-[200px]">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">Progress</span>
            <span class="text-sm">{{ currentStep + 1 }}/{{ wizardSteps.length }}</span>
          </div>
          <div class="w-full bg-white/20 rounded-full h-2">
            <div 
              class="bg-white h-2 rounded-full transition-all duration-500 ease-out"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Authentication Required Message -->
    <div v-if="!isAuthenticated" class="bg-amber-50 border border-amber-200 rounded-xl p-6">
      <div class="flex items-center space-x-3">
        <IconUser class="w-8 h-8 text-amber-600" />
        <div>
          <h3 class="font-semibold text-amber-800 text-lg">Authentication Required</h3>
          <p class="text-amber-700 mt-1">
            Please connect your Nostr identity to create and manage content. Your content will be published as NIP-23 long-form content events.
          </p>
        </div>
      </div>
    </div>

    <!-- Main Wizard Container -->
    <div v-else class="bg-white/95 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-lg overflow-hidden">
      <!-- Step Navigation -->
      <div class="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50">
        <div class="px-6 py-4">
          <nav class="flex items-center justify-between">
            <!-- Step Indicators -->
            <div class="flex items-center space-x-1 sm:space-x-4">
              <div
                v-for="(step, index) in wizardSteps"
                :key="step.id"
                class="flex items-center"
              >
                <!-- Step Circle -->
                <div
                  @click="goToStep(index)"
                  :class="[
                    'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-all duration-300',
                    index === currentStep 
                      ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-lg scale-110' 
                      : completedSteps.has(index)
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  ]"
                >
                  <IconCheck v-if="completedSteps.has(index)" class="w-4 h-4 sm:w-5 sm:h-5" />
                  <component v-else :is="step.icon" class="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                
                <!-- Step Connector -->
                <div 
                  v-if="index < wizardSteps.length - 1"
                  :class="[
                    'hidden sm:block w-8 lg:w-16 h-0.5 mx-2 transition-all duration-300',
                    completedSteps.has(index) ? 'bg-green-300' : 'bg-gray-200'
                  ]"
                ></div>
              </div>
            </div>
            
            <!-- Auto-save Status -->
            <div v-if="lastSaved" class="hidden sm:flex items-center space-x-2 text-xs text-gray-500">
              <IconSave class="w-3 h-3" />
              <span>Saved {{ new Date(lastSaved).toLocaleTimeString() }}</span>
            </div>
          </nav>
          
          <!-- Current Step Info -->
          <div class="mt-4">
            <h2 class="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <component :is="currentStepData.icon" class="w-5 h-5 text-orange-600" />
              <span>{{ currentStepData.title }}</span>
            </h2>
            <p class="text-gray-600 text-sm mt-1">{{ currentStepData.description }}</p>
          </div>
        </div>
      </div>

      <!-- Step Content -->
      <div class="p-6">
        <!-- Step 1: Content Basics -->
        <div v-if="currentStep === 0" class="space-y-6">
          <!-- Content Type Selection -->
          <div>
            <label class="block text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <IconPalette class="w-5 h-5 text-purple-600" />
              <span>What type of content are you creating?</span>
            </label>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="type in contentTypes"
                :key="type.value"
                @click="form.type = type.value"
                :class="[
                  'p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-md',
                  form.type === type.value 
                    ? 'border-orange-400 bg-orange-50 shadow-lg transform scale-105' 
                    : 'border-gray-200 hover:border-orange-200 hover:bg-orange-25'
                ]"
              >
                <div class="flex items-start space-x-3">
                  <div :class="[
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    form.type === type.value ? 'bg-orange-100' : 'bg-gray-100'
                  ]">
                    <component :is="type.icon" :class="[
                      'w-5 h-5',
                      form.type === type.value ? 'text-orange-600' : 'text-gray-500'
                    ]" />
                  </div>
                  <div class="flex-1">
                    <h3 :class="[
                      'font-semibold mb-1',
                      form.type === type.value ? 'text-orange-900' : 'text-gray-900'
                    ]">
                      {{ type.label }}
                    </h3>
                    <p :class="[
                      'text-sm mb-2',
                      form.type === type.value ? 'text-orange-700' : 'text-gray-600'
                    ]">
                      {{ type.description }}
                    </p>
                    <p :class="[
                      'text-xs',
                      form.type === type.value ? 'text-orange-600' : 'text-gray-500'
                    ]">
                      Examples: {{ type.examples }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Content Template -->
          <div v-if="form.type" class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h4 class="font-semibold text-blue-900 flex items-center space-x-2">
                <IconSparkles class="w-4 h-4" />
                <span>Quick Start Template</span>
              </h4>
              <button
                @click="applyTemplate(form.type)"
                class="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Use Template
              </button>
            </div>
            <p class="text-blue-800 text-sm">
              Get started quickly with a pre-filled template for {{ contentTypes.find(t => t.value === form.type)?.label.toLowerCase() }} content.
            </p>
          </div>

          <!-- Title -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconEdit class="w-4 h-4 text-orange-600" />
              <span>Content Title</span>
              <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Enter a compelling title that grabs attention..."
              class="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white shadow-sm"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': !form.title.trim() }"
            />
            <div class="flex justify-between items-center mt-2">
              <p class="text-xs text-gray-500">
                Great titles are specific, benefit-focused, and create curiosity
              </p>
              <span class="text-xs text-gray-400">{{ form.title.length }}/100</span>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconAlignLeft class="w-4 h-4 text-orange-600" />
              <span>Brief Description</span>
              <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              placeholder="Summarize your content in 1-2 sentences. This helps readers understand what they'll learn..."
              class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white shadow-sm resize-none"
              :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': !form.description.trim() }"
            ></textarea>
            <div class="flex justify-between items-center mt-2">
              <p class="text-xs text-gray-500">
                This appears in search results and social media previews
              </p>
              <span class="text-xs text-gray-400">{{ form.description.length }}/200</span>
            </div>
          </div>
        </div>

        <!-- Step 2: Content Writing -->
        <div v-if="currentStep === 1" class="space-y-6">
          <!-- Writing Tips -->
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <h4 class="font-semibold text-blue-900 mb-3 flex items-center space-x-2">
              <IconInfoCircle class="w-4 h-4" />
              <span>Writing Tips for {{ contentTypes.find(t => t.value === form.type)?.label }}</span>
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-blue-800">
              <div v-if="form.type === 'article'">
                <ul class="space-y-1">
                  <li>• Start with a compelling hook</li>
                  <li>• Use clear headings and subheadings</li>
                  <li>• Include actionable takeaways</li>
                  <li>• End with a strong conclusion</li>
                </ul>
              </div>
              <div v-else-if="form.type === 'newsletter'">
                <ul class="space-y-1">
                  <li>• Keep sections scannable</li>
                  <li>• Use bullet points and lists</li>
                  <li>• Include relevant links</li>
                  <li>• Add a personal touch</li>
                </ul>
              </div>
              <div v-else-if="form.type === 'story'">
                <ul class="space-y-1">
                  <li>• Create relatable characters</li>
                  <li>• Build tension and conflict</li>
                  <li>• Show, don't tell</li>
                  <li>• End with resolution</li>
                </ul>
              </div>
              <div v-else-if="form.type === 'review'">
                <ul class="space-y-1">
                  <li>• Be honest and balanced</li>
                  <li>• Include pros and cons</li>
                  <li>• Provide specific examples</li>
                  <li>• Give clear recommendations</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Preview Text -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconEye class="w-4 h-4 text-orange-600" />
              <span>Preview Text (Hook)</span>
              <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <textarea
                v-model="form.previewText"
                rows="4"
                placeholder="Write a compelling preview that makes readers want to unlock your full content. This is your hook - make it irresistible!"
                class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white shadow-sm resize-none"
                :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': !form.previewText.trim() }"
              ></textarea>
              <div class="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-2 py-1 rounded">
                {{ wordCount.preview }} words
              </div>
            </div>
            <div class="flex justify-between items-center mt-2">
              <p class="text-xs text-gray-500">
                This preview is always visible - make it compelling enough to convert readers
              </p>
              <div class="flex items-center space-x-2 text-xs text-gray-400">
                <span>{{ form.previewText.length }}/500</span>
              </div>
            </div>
          </div>

          <!-- Full Content -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconEdit class="w-4 h-4 text-orange-600" />
              <span>Full Content</span>
              <span class="text-red-500">*</span>
            </label>
            
            <!-- Content Stats -->
            <div class="flex items-center space-x-4 mb-3 text-xs text-gray-500">
              <span class="flex items-center space-x-1">
                <IconEdit class="w-3 h-3" />
                <span>{{ wordCount.full }} words</span>
              </span>
              <span class="flex items-center space-x-1">
                <IconClock class="w-3 h-3" />
                <span>~{{ estimatedReadTime }} min read</span>
              </span>
            </div>
            
            <div class="relative">
              <textarea
                v-model="form.fullContent"
                rows="12"
                placeholder="Write your full content here. Use Markdown formatting for headers, lists, and emphasis.

# Main Heading
## Subheading
- Bullet points
- More points

**Bold text** and *italic text* are supported.

Remember: Great content provides value, tells a story, and keeps readers engaged!"
                class="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white shadow-sm resize-none font-mono text-sm leading-relaxed"
                :class="{ 'border-red-300 focus:ring-red-500 focus:border-red-500': !form.fullContent.trim() }"
              ></textarea>
            </div>
            
            <!-- Markdown Help -->
            <div class="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
              <details class="text-sm">
                <summary class="font-medium text-gray-700 cursor-pointer flex items-center space-x-2">
                  <IconInfoCircle class="w-4 h-4" />
                  <span>Markdown Formatting Guide</span>
                </summary>
                <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
                  <div>
                    <h5 class="font-medium text-gray-800 mb-2">Headers</h5>
                    <code class="block bg-white p-2 rounded border">
                      # Main Title<br>
                      ## Section<br>
                      ### Subsection
                    </code>
                  </div>
                  <div>
                    <h5 class="font-medium text-gray-800 mb-2">Emphasis</h5>
                    <code class="block bg-white p-2 rounded border">
                      **Bold text**<br>
                      *Italic text*<br>
                      `Code text`
                    </code>
                  </div>
                  <div>
                    <h5 class="font-medium text-gray-800 mb-2">Lists</h5>
                    <code class="block bg-white p-2 rounded border">
                      - Bullet point<br>
                      1. Numbered item<br>
                      - [ ] Checkbox
                    </code>
                  </div>
                  <div>
                    <h5 class="font-medium text-gray-800 mb-2">Links</h5>
                    <code class="block bg-white p-2 rounded border">
                      [Link text](URL)<br>
                      ![Image](image-url)
                    </code>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>

        <!-- Step 3: Monetization -->
        <div v-if="currentStep === 2" class="space-y-6">
          <!-- Monetization Model Selection -->
          <div>
            <label class="block text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <IconBolt class="w-5 h-5 text-orange-600" />
              <span>How do you want to monetize this content?</span>
            </label>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                v-for="model in monetizationModels"
                :key="model.value"
                @click="form.monetizationModel = model.value"
                :class="[
                  'p-6 border-2 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-md',
                  form.monetizationModel === model.value 
                    ? `border-${model.color}-400 bg-${model.color}-50 shadow-lg transform scale-105` 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-25'
                ]"
              >
                <div class="text-center">
                  <div :class="[
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                    form.monetizationModel === model.value 
                      ? `bg-${model.color}-100` 
                      : 'bg-gray-100'
                  ]">
                    <component :is="model.icon" :class="[
                      'w-8 h-8',
                      form.monetizationModel === model.value 
                        ? `text-${model.color}-600` 
                        : 'text-gray-500'
                    ]" />
                  </div>
                  <h3 :class="[
                    'font-semibold text-lg mb-2',
                    form.monetizationModel === model.value 
                      ? `text-${model.color}-900` 
                      : 'text-gray-900'
                  ]">
                    {{ model.label }}
                  </h3>
                  <p :class="[
                    'text-sm',
                    form.monetizationModel === model.value 
                      ? `text-${model.color}-700` 
                      : 'text-gray-600'
                  ]">
                    {{ model.description }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Price Setting for Premium Content -->
          <div v-if="form.monetizationModel === 'one-time'" class="bg-orange-50 border border-orange-200 rounded-xl p-6">
            <h4 class="font-semibold text-orange-900 mb-4 flex items-center space-x-2">
              <IconTarget class="w-5 h-5" />
              <span>Set Your Price</span>
            </h4>
            
            <!-- Price Input -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-orange-800 mb-2">Price in Satoshis</label>
              <div class="relative">
                <input
                  v-model.number="form.price"
                  type="number"
                  min="1"
                  step="100"
                  placeholder="1000"
                  class="w-full px-4 py-3 pr-16 border-2 border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white text-lg font-semibold"
                />
                <div class="absolute inset-y-0 right-0 flex items-center pr-4">
                  <span class="text-orange-600 font-medium">sats</span>
                </div>
              </div>
            </div>
            
            <!-- Price Suggestions -->
            <div class="mb-4">
              <p class="text-sm font-medium text-orange-800 mb-2">Suggested Pricing</p>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="price in [500, 1000, 2500, 5000]"
                  :key="price"
                  @click="form.price = price"
                  :class="[
                    'px-3 py-2 text-sm rounded-lg border transition-colors',
                    form.price === price 
                      ? 'bg-orange-200 border-orange-300 text-orange-800' 
                      : 'bg-white border-orange-200 text-orange-700 hover:bg-orange-100'
                  ]"
                >
                  {{ price.toLocaleString() }} sats
                </button>
              </div>
            </div>
            
            <!-- Pricing Guidelines -->
            <div class="bg-white border border-orange-200 rounded-lg p-4">
              <h5 class="font-medium text-orange-900 mb-2">💡 Pricing Guidelines</h5>
              <div class="text-sm text-orange-800 space-y-1">
                <p>• <strong>500-1000 sats:</strong> Short articles, quick tips</p>
                <p>• <strong>1000-2500 sats:</strong> Medium articles, tutorials</p>
                <p>• <strong>2500-5000 sats:</strong> Comprehensive guides, research</p>
                <p>• <strong>5000+ sats:</strong> Premium content, exclusive insights</p>
              </div>
            </div>
          </div>

          <!-- Free Content Benefits -->
          <div v-if="form.monetizationModel === 'free'" class="bg-green-50 border border-green-200 rounded-xl p-6">
            <div class="text-center">
              <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IconGlobe class="w-8 h-8 text-green-600" />
              </div>
              <h4 class="font-semibold text-green-900 mb-2">Free Content Benefits</h4>
              <div class="text-sm text-green-800 space-y-2">
                <p>✅ Wider audience reach and discovery</p>
                <p>✅ Build trust and establish expertise</p>
                <p>✅ Grow your follower base</p>
                <p>✅ Still eligible for Lightning tips (zaps)</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 4: Metadata & Enhancement -->
        <div v-if="currentStep === 3" class="space-y-6">
          <!-- Tags Section -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconHash class="w-4 h-4 text-orange-600" />
              <span>Tags & Topics</span>
            </label>
            
            <!-- Current Tags -->
            <div v-if="form.tags.length > 0" class="flex flex-wrap gap-2 mb-3">
              <span
                v-for="(tag, index) in form.tags"
                :key="index"
                class="inline-flex items-center space-x-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 px-3 py-2 rounded-full text-sm font-medium shadow-sm"
              >
                <IconHash class="w-3 h-3" />
                <span>{{ tag }}</span>
                <button
                  @click="removeTag(index)"
                  class="hover:text-orange-900 transition-colors"
                >
                  <IconX class="w-3 h-3" />
                </button>
              </span>
            </div>
            
            <!-- Add New Tag -->
            <div class="flex space-x-2 mb-4">
              <input
                v-model="newTag"
                type="text"
                placeholder="Add a tag (e.g., bitcoin, tutorial, guide)..."
                @keyup.enter="addTag"
                class="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
              />
              <button
                @click="addTag"
                :disabled="!newTag.trim()"
                class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <IconPlus class="w-4 h-4" />
                Add
              </button>
            </div>
            
            <!-- Suggested Tags -->
            <div v-if="suggestedTags.length > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 class="font-medium text-blue-900 mb-2 flex items-center space-x-2">
                <IconSparkles class="w-4 h-4" />
                <span>Suggested Tags for {{ contentTypes.find(t => t.value === form.type)?.label }}</span>
              </h5>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tag in suggestedTags"
                  :key="tag"
                  @click="addSuggestedTag(tag)"
                  :disabled="form.tags.includes(tag)"
                  class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + {{ tag }}
                </button>
              </div>
            </div>
          </div>

          <!-- Cover Image -->
          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-3 flex items-center space-x-2">
              <IconPhoto class="w-4 h-4 text-orange-600" />
              <span>Cover Image (Optional)</span>
            </label>
            <input
              v-model="form.coverImage"
              type="url"
              placeholder="https://example.com/your-cover-image.jpg"
              class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white"
            />
            <p class="text-xs text-gray-500 mt-2">
              A compelling cover image increases engagement. Recommended size: 1200x630px
            </p>
            
            <!-- Image Preview -->
            <div v-if="form.coverImage" class="mt-3">
              <img
                :src="form.coverImage"
                :alt="form.title"
                class="w-full h-48 object-cover rounded-lg border border-gray-200 shadow-sm"
                @error="$event.target.style.display = 'none'"
              />
            </div>
          </div>

          <!-- Advanced Options -->
          <div>
            <button
              @click="showAdvancedOptions = !showAdvancedOptions"
              class="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <component :is="showAdvancedOptions ? IconChevronDown : IconChevronRight" class="w-4 h-4" />
              <span>Advanced Options</span>
            </button>
            
            <div v-if="showAdvancedOptions" class="mt-4 space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <!-- Published Date -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Published Date (Optional)</label>
                <input
                  v-model="form.publishedAt"
                  type="datetime-local"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 bg-white text-sm"
                />
                <p class="text-xs text-gray-500 mt-1">
                  Leave empty to use current date/time
                </p>
              </div>
            </div>
          </div>

          <!-- NIP-23 Compliance Info -->
          <div class="bg-purple-50 border border-purple-200 rounded-xl p-4">
            <div class="flex items-start space-x-3">
              <IconInfoCircle class="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 class="font-semibold text-purple-900 mb-2">NIP-23 Long-form Content</h4>
                <p class="text-sm text-purple-800 leading-relaxed">
                  Your content will be published as a NIP-23 long-form content event (kind:30023) to the Nostr network. 
                  This ensures decentralized storage, censorship resistance, and enables Lightning-based monetization through zaps.
                </p>
                <div class="mt-3 text-xs text-purple-700">
                  <p><strong>Event Structure:</strong> Title, summary, content, tags, and metadata</p>
                  <p><strong>Format:</strong> Markdown-compatible for maximum client compatibility</p>
                  <p><strong>Addressable:</strong> Uses identifier tag for editability</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Footer -->
      <div class="border-t border-gray-200 bg-gradient-to-r from-gray-50 to-orange-50 px-6 py-4">
        <div class="flex items-center justify-between">
          <!-- Left: Previous Button -->
          <div>
            <button
              v-if="currentStep > 0"
              @click="prevStep"
              class="btn-secondary"
            >
              <IconChevronLeft class="w-4 h-4" />
              Previous
            </button>
          </div>
          
          <!-- Center: Step Indicator (Mobile) -->
          <div class="sm:hidden text-sm text-gray-600">
            Step {{ currentStep + 1 }} of {{ wizardSteps.length }}
          </div>
          
          <!-- Right: Next/Submit Buttons -->
          <div class="flex items-center space-x-3">
            <!-- Auto-save Indicator -->
            <div v-if="hasUnsavedChanges" class="hidden sm:flex items-center space-x-2 text-xs text-amber-600">
              <div class="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span>Unsaved changes</span>
            </div>
            
            <!-- Save Draft -->
            <button
              @click="handleSaveDraft"
              :disabled="isLoading"
              class="btn-secondary"
            >
              <IconDeviceFloppy class="w-4 h-4" />
              <span class="hidden sm:inline">Save Draft</span>
            </button>
            
            <!-- Next/Publish Button -->
            <button
              v-if="currentStep < wizardSteps.length - 1"
              @click="nextStep"
              :disabled="!canProceed"
              class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <IconChevronRight class="w-4 h-4" />
            </button>
            
            <button
              v-else
              @click="handleSubmit"
              :disabled="!isFormValid || isLoading"
              class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
              <IconSend v-else class="w-4 h-4" />
              {{ isLoading ? 'Publishing...' : (form.monetizationModel === 'free' ? 'Publish Free Content' : 'Publish Premium Content') }}
            </button>
          </div>
        </div>
        
        <!-- Step Validation Messages -->
        <div v-if="!isStepValid && currentStep < wizardSteps.length - 1" class="mt-3 flex items-center space-x-2 text-sm text-amber-600">
          <IconAlertCircle class="w-4 h-4" />
          <span>Please complete all required fields to continue</span>
        </div>
      </div>
    </div>

    <!-- Content Preview (Floating Panel) -->
    <div v-if="form.title || form.previewText" class="fixed bottom-6 right-6 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-40 hidden lg:block">
      <div class="p-4 border-b border-gray-200">
        <h4 class="font-semibold text-gray-900 flex items-center space-x-2">
          <IconEye class="w-4 h-4 text-orange-600" />
          <span>Live Preview</span>
        </h4>
      </div>
      <div class="p-4 max-h-64 overflow-y-auto">
        <div class="space-y-3">
          <h3 class="font-bold text-gray-900 text-lg leading-tight">
            {{ form.title || 'Your Title Here' }}
          </h3>
          <p class="text-gray-600 text-sm">
            {{ form.description || 'Your description will appear here' }}
          </p>
          <div v-if="form.tags.length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="tag in form.tags.slice(0, 3)"
              :key="tag"
              class="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs"
            >
              #{{ tag }}
            </span>
            <span v-if="form.tags.length > 3" class="text-xs text-gray-500">
              +{{ form.tags.length - 3 }} more
            </span>
          </div>
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>{{ wordCount.full }} words</span>
            <span>~{{ estimatedReadTime }} min read</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for preview panel */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(251, 146, 60, 0.3);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(251, 146, 60, 0.5);
}

/* Smooth transitions for step changes */
.step-transition-enter-active,
.step-transition-leave-active {
  transition: all 0.3s ease-out;
}

.step-transition-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.step-transition-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Enhanced focus states */
input:focus,
textarea:focus,
select:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(251, 146, 60, 0.15);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .fixed.bottom-6.right-6 {
    display: none; /* Hide preview panel on mobile */
  }
}

/* Animation for progress bar */
@keyframes progress-fill {
  from { width: 0%; }
  to { width: var(--progress-width); }
}

.progress-bar {
  animation: progress-fill 0.5s ease-out;
}

/* Hover effects for interactive elements */
.cursor-pointer:hover {
  transform: translateY(-1px);
}

/* Loading state improvements */
.btn-primary:disabled {
  cursor: not-allowed;
  transform: none;
}

.btn-primary:disabled:hover {
  transform: none;
}

/* Enhanced card hover effects */
.content-type-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

/* Smooth color transitions */
* {
  transition-property: color, background-color, border-color, transform, box-shadow;
  transition-duration: 200ms;
  transition-timing-function: ease-out;
}
</style>