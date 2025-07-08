<script setup>
import { ref, computed, watch } from 'vue'
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
  IconShare
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

const contentTypes = [
  { value: 'article', label: 'Article', icon: IconFileText },
  { value: 'newsletter', label: 'Newsletter', icon: IconMail },
  { value: 'podcast', label: 'Podcast', icon: IconMicrophone },
  { value: 'video', label: 'Video', icon: IconVideo },
  { value: 'image', label: 'Image', icon: IconPhoto },
  { value: 'document', label: 'Document', icon: IconFile }
]

const monetizationModels = [
  // { value: 'one-time', label: 'One-time Purchase' },
  // { value: 'subscription', label: 'Subscription' },
  { value: 'free', label: 'Free' }
]

const newTag = ref('')

// Watch for monetization model changes to automatically set price to 0 for free content
watch(() => props.form.monetizationModel, (newModel) => {
  if (newModel === 'free') {
    props.form.price = 0
  } else if (props.form.price === 0) {
    // Set default price when switching from free to paid
    props.form.price = 1000
  }
})

const isFormValid = computed(() => {
  return props.form.title.trim() &&
         props.form.description.trim() &&
         props.form.previewText.trim() &&
         props.form.fullContent.trim() &&
         (props.form.monetizationModel === 'free' || props.form.price > 0)
})

const addTag = () => {
  if (newTag.value.trim() && !props.form.tags.includes(newTag.value.trim())) {
    props.form.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

const removeTag = (index) => {
  props.form.tags.splice(index, 1)
}

const handleSubmit = () => {
  if (isFormValid.value && props.isAuthenticated) {
    emit('submit')
  }
}

const handleSaveDraft = () => {
  if (props.isAuthenticated) {
    emit('save-draft')
  }
}
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm rounded-xl border border-orange-100/50 shadow-sm">
    <div class="p-6 border-b border-orange-100/50">
      <h2 class="text-xl font-semibold text-gray-900">
        {{ isEditing ? 'Edit Content' : 'Create New Content' }}
      </h2>
      <p class="text-gray-600 text-sm mt-1">
        Publish premium content that users can unlock with Lightning payments
      </p>
    </div>

    <!-- Authentication Required Message -->
    <div v-if="!isAuthenticated" class="p-6">
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div class="flex items-center space-x-3">
          <IconUser class="w-5 h-5 text-amber-600" />
          <div>
            <h3 class="font-medium text-amber-800">Authentication Required</h3>
            <p class="text-sm text-amber-700 mt-1">
              Please connect your Nostr identity to create and manage content.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Form Content -->
    <div v-else class="p-6 space-y-6">
      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Title</label>
        <input
          v-model="form.title"
          type="text"
          placeholder="Enter content title..."
          :disabled="!isAuthenticated"
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <!-- Type and Monetization -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
          <select
            v-model="form.type"
            :disabled="!isAuthenticated"
            class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option v-for="type in contentTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Monetization Model</label>
          <select
            v-model="form.monetizationModel"
            :disabled="!isAuthenticated"
            class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option v-for="model in monetizationModels" :key="model.value" :value="model.value">
              {{ model.label }}
            </option>
          </select>
        </div>
      </div>

      <!-- Price -->
      <div v-if="form.monetizationModel !== 'free'">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Price (sats)
          <span v-if="form.monetizationModel === 'subscription'" class="text-gray-500">per month</span>
        </label>
        <div class="relative">
          <input
            v-model.number="form.price"
            type="number"
            min="1"
            placeholder="5000"
            :disabled="!isAuthenticated"
            class="w-full px-3 py-3 pr-12 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            <IconLock class="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      <!-- Free Content Notice -->
      <div v-if="form.monetizationModel === 'free'" class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center space-x-3">
          <IconBolt class="w-5 h-5 text-green-600" />
          <div>
            <h3 class="font-medium text-green-800">Free Content</h3>
            <p class="text-sm text-green-700 mt-1">
              This content will be freely accessible to all users without payment.
            </p>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          v-model="form.description"
          rows="3"
          placeholder="Brief description of your content..."
          :disabled="!isAuthenticated"
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
        ></textarea>
      </div>

      <!-- Preview Text -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Preview Text</label>
        <textarea
          v-model="form.previewText"
          rows="4"
          placeholder="Write a compelling preview that will encourage users to unlock your content..."
          :disabled="!isAuthenticated"
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">
          {{ form.monetizationModel === 'free' ? 'This is what users see as a preview' : 'This is what users see before purchasing' }}
        </p>
      </div>

      <!-- Full Content -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Full Content</label>
        <textarea
          v-model="form.fullContent"
          rows="8"
          placeholder="Write your premium content here..."
          :disabled="!isAuthenticated"
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">
          {{ form.monetizationModel === 'free' ? 'This is the full content that will be freely accessible' : 'This content is unlocked after payment' }}
        </p>
      </div>

      <!-- Tags -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Tags</label>
        <div class="flex flex-wrap gap-2 mb-3">
          <span
            v-for="(tag, index) in form.tags"
            :key="index"
            class="inline-flex items-center space-x-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm"
          >
            <span>{{ tag }}</span>
            <button
              @click="removeTag(index)"
              :disabled="!isAuthenticated"
              class="hover:text-orange-900 disabled:opacity-50"
            >
              <IconX class="w-3 h-3" />
            </button>
          </span>
        </div>
        <div class="flex space-x-2">
          <input
            v-model="newTag"
            type="text"
            placeholder="Add tag..."
            :disabled="!isAuthenticated"
            @keyup.enter="addTag"
            class="flex-1 px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          />
          <button
            @click="addTag"
            :disabled="!isAuthenticated"
            class="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconPlus class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Cover Image -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Cover Image URL (optional)</label>
        <input
          v-model="form.coverImage"
          type="url"
          placeholder="https://example.com/image.jpg"
          :disabled="!isAuthenticated"
          class="w-full px-3 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 text-base disabled:bg-gray-50 disabled:text-gray-500"
        />
      </div>

      <!-- Nostr Publishing Info -->
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div class="flex items-start space-x-3">
          <IconShare class="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 class="font-medium text-purple-900 mb-1">Nostr Publishing</h4>
            <p class="text-sm text-purple-800">
              Your content will be stored locally and can be published to the Nostr network as a long-form content event (NIP-23).
              This allows for decentralized content distribution and monetization.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="p-6 border-t border-orange-100/50 flex flex-col sm:flex-row gap-3 sm:justify-end">
      <button
        @click="$emit('cancel')"
        class="btn-secondary"
      >
        Cancel
      </button>
      <button
        @click="handleSaveDraft"
        :disabled="isLoading || !isAuthenticated"
        class="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Draft
      </button>
      <button
        @click="handleSubmit"
        :disabled="!isFormValid || isLoading || !isAuthenticated"
        class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IconLock v-if="form.monetizationModel !== 'free'" class="w-4 h-4" />
        <IconBolt v-else class="w-4 h-4" />
        {{ isLoading ? 'Publishing...' : (form.monetizationModel === 'free' ? 'Create Free Content' : 'Create Gated Content') }}
      </button>
    </div>
  </div>
</template>
