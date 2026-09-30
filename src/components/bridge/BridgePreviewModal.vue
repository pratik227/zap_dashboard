<script setup>
import { ref, computed, toRef } from 'vue'
import { useFocusTrap } from '../../composables/core/useFocusTrap.js'
import { IconX, IconExternalLink, IconPhoto, IconSend } from '@iconify-prerendered/vue-tabler'

const props = defineProps({
  show: { type: Boolean, default: false },
  preview: { type: Object, default: null }, // { item, template, images }
  mirrorMedia: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
  busyMessage: { type: String, default: '' }
})
const emit = defineEmits(['close', 'publish'])

const root = ref(null)
useFocusTrap(toRef(props, 'show'), root)

const kindLabel = computed(() => (props.preview?.template.kind === 30023 ? 'Long-form article (kind 30023)' : 'Short note (kind 1)'))
const displayTags = computed(() =>
  (props.preview?.template.tags || []).filter(t => ['t', 'title', 'summary', 'd', 'published_at', 'r'].includes(t[0]))
)
</script>

<template>
  <div
    v-if="show && preview"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div ref="root" role="dialog" aria-modal="true" aria-labelledby="bridge-preview-title" class="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
      <div class="flex items-start justify-between gap-4 p-5 border-b border-gray-200">
        <div class="min-w-0">
          <p class="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">{{ kindLabel }}</p>
          <h2 id="bridge-preview-title" class="text-lg font-semibold text-gray-900 break-words">{{ preview.item.title }}</h2>
          <a v-if="preview.item.link" :href="preview.item.link" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-orange-600 mt-1 break-all">
            <IconExternalLink class="w-3.5 h-3.5 flex-shrink-0" /> {{ preview.item.link }}
          </a>
        </div>
        <button class="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close preview" @click="emit('close')">
          <IconX class="w-5 h-5" />
        </button>
      </div>

      <div class="overflow-y-auto p-5 space-y-5">
        <div v-if="displayTags.length" class="flex flex-wrap gap-2">
          <span v-for="(tag, i) in displayTags" :key="i" class="text-xs bg-gray-100 text-gray-700 rounded-md px-2 py-1 max-w-full truncate">
            <span class="font-mono text-gray-500">{{ tag[0] }}</span> {{ tag[1] }}
          </span>
        </div>

        <div v-if="preview.images.length" class="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900 flex items-start gap-2">
          <IconPhoto class="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span v-if="mirrorMedia">{{ preview.images.length }} image{{ preview.images.length === 1 ? '' : 's' }} will be copied to your Blossom servers and the links rewritten. Your signer may ask you to approve each upload.</span>
          <span v-else>{{ preview.images.length }} image{{ preview.images.length === 1 ? '' : 's' }} will stay linked to the original site (Blossom mirroring is off for this feed).</span>
        </div>

        <img v-if="preview.item.image" :src="preview.item.image" alt="" class="w-full max-h-64 object-cover rounded-lg border border-gray-200" loading="lazy" referrerpolicy="no-referrer">

        <div>
          <p class="text-xs font-medium text-gray-500 mb-2">Content as it will be published</p>
          <pre class="whitespace-pre-wrap break-words text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono leading-relaxed max-h-[40vh] overflow-y-auto">{{ preview.template.content }}</pre>
        </div>
      </div>

      <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-5 border-t border-gray-200">
        <span v-if="busy" class="text-sm text-gray-600 sm:mr-auto" role="status" aria-live="polite">{{ busyMessage }}</span>
        <button class="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" @click="emit('close')">Cancel</button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60 inline-flex items-center justify-center gap-2"
          :disabled="busy"
          @click="emit('publish')"
        >
          <IconSend class="w-4 h-4" /> Publish to Nostr
        </button>
      </div>
    </div>
  </div>
</template>
