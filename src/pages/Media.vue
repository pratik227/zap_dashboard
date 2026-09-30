<script setup>
import { inject } from 'vue'
import { useNostrAuth } from '../composables/auth/useNostrAuth.js'
import MediaLibrary from '../components/media/MediaLibrary.vue'
import { IconPhoto } from '@iconify-prerendered/vue-tabler'

const currentPage = inject('currentPage')
const { isAuthenticated } = useNostrAuth()
</script>

<template>
  <div class="media-page">
    <MediaLibrary v-if="isAuthenticated" />
    <div v-else class="text-center py-16 px-4">
      <IconPhoto class="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Sign in to manage your media</h3>
      <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">Connect your Nostr extension to upload and manage files on Blossom servers.</p>
    </div>
  </div>
</template>
