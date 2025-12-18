<script setup>
import { ref, inject, computed } from 'vue'
import { IconSearch, IconSettings, IconTrash, IconX } from '@iconify-prerendered/vue-tabler'

const selectedTimeRange = inject('selectedTimeRange')
const searchQuery = inject('searchQuery')
const selectedFilters = inject('selectedFilters')

const timeRanges = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'all', label: 'All' }
]

const noteTypes = [
  { value: 'all', label: 'All Notes' },
  { value: 'original', label: 'Original' },
  { value: 'reply', label: 'Replies' },
  { value: 'repost', label: 'Reposts' }
]

const showAdvancedFilters = ref(false)

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
         selectedFilters.value.minAmount > 0 ||
         selectedFilters.value.maxAmount !== null ||
         selectedFilters.value.noteType !== 'all' ||
         selectedFilters.value.sender.trim() !== '' ||
         selectedTimeRange.value !== 'all'
})

// Clear all filters
const clearAllFilters = () => {
  searchQuery.value = ''
  selectedFilters.value.minAmount = 0
  selectedFilters.value.maxAmount = null
  selectedFilters.value.noteType = 'all'
  selectedFilters.value.sender = ''
  selectedTimeRange.value = 'all'
  showAdvancedFilters.value = false
}
</script>

<template>
  <div class="bg-white/90 backdrop-blur-sm p-4 sm:p-6 rounded-xl border border-orange-100/50 shadow-sm">
    <div class="flex flex-col space-y-4">
      <!-- Search -->
      <div class="w-full">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search zaps, senders, or notes..."
            class="w-full pl-10 pr-4 py-3 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-all bg-white/80 backdrop-blur-sm text-sm sm:text-base touch-target"
          />
          <IconSearch class="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
          <!-- Clear search button -->
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <!-- Time Range + Advanced Filters Toggle -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <!-- Time Range -->
        <div class="flex flex-wrap gap-1 bg-orange-50/80 p-1 rounded-lg backdrop-blur-sm">
          <button
            v-for="range in timeRanges"
            :key="range.value"
            @click="selectedTimeRange = range.value"
            :class="[
              'px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 touch-target',
              selectedTimeRange === range.value
                ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-sm'
                : 'text-orange-700 hover:bg-orange-100/80'
            ]"
          >
            {{ range.label }}
          </button>
        </div>
        
        <!-- Filter Controls -->
        <div class="flex items-center space-x-2">
          <!-- Clear All Filters Button -->
          <button
            v-if="hasActiveFilters"
            @click="clearAllFilters"
            class="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm font-medium"
          >
            <IconTrash class="w-4 h-4" />
            <span>Clear all</span>
          </button>
          
          <!-- Advanced Filters Toggle -->
          <button
            @click="showAdvancedFilters = !showAdvancedFilters"
            class="btn-secondary touch-target"
          >
            <IconSettings class="w-4 h-4" />
            <span class="hidden sm:inline">Filters</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Advanced Filters -->
    <transition name="fade">
      <div v-if="showAdvancedFilters" class="mt-6 pt-6 border-t border-orange-100/50">
        <!-- Clear All Button in Advanced Section -->
        <div v-if="hasActiveFilters" class="mb-4 flex justify-end">
          <button
            @click="clearAllFilters"
            class="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 text-sm"
          >
            <IconTrash class="w-4 h-4" />
            <span>Clear all filters</span>
          </button>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Amount Range -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Amount Range (sats)</label>
            <div class="flex space-x-2">
              <input
                v-model.number="selectedFilters.minAmount"
                type="number"
                placeholder="Min"
                class="flex-1 px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm touch-target"
              />
              <input
                v-model.number="selectedFilters.maxAmount"
                type="number"
                placeholder="Max"
                class="flex-1 px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm touch-target"
              />
            </div>
          </div>
          
          <!-- Note Type -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Note Type</label>
            <select
              v-model="selectedFilters.noteType"
              class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm touch-target"
            >
              <option v-for="type in noteTypes" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>
          
          <!-- Sender -->
          <div class="sm:col-span-2 lg:col-span-1">
            <label class="block text-sm font-medium text-gray-700 mb-2">Sender</label>
            <input
              v-model="selectedFilters.sender"
              type="text"
              placeholder="npub... or name"
              class="w-full px-3 py-2 border border-orange-200/50 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white/80 backdrop-blur-sm text-sm touch-target"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>