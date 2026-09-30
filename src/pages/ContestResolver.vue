<script setup>
import { ref, computed } from 'vue'
import { formatSatsShort } from '../utils/format.js'
import {
  IconTrophy,
  IconSearch,
  IconBolt,
  IconUsers,
  IconMessageCircle,
  IconLoader,
  IconAlertCircle,
  IconX,
  IconCopy,
  IconCheck,
  IconChevronDown,
  IconChevronUp
} from '@iconify-prerendered/vue-tabler'
import { nip19 } from '../services/nostr/nostrImports.js'
import { generateAvatar } from '../utils/profile/avatarGenerator.js'
import { useZapLeaderboard } from '../composables/content/useZapLeaderboard.js'

const {
  isLoading,
  error,
  progress,
  rootEvent,
  leaderboard,
  allZaps,
  replyCount,
  resolveContest,
  reset
} = useZapLeaderboard()

// Input state
const inputValue = ref('')
const inputError = ref('')
const expandedEntry = ref(null)
const copiedPubkey = ref(null)

// Filter: 'all' = post + comments, 'post-only' = only root post zaps
const zapScope = ref('all')

// Filtered leaderboard: re-aggregate from existing leaderboard based on scope
const filteredLeaderboard = computed(() => {
  if (zapScope.value === 'all') return leaderboard.value

  const rootId = rootEvent.value?.id
  if (!rootId) return leaderboard.value

  const entries = []
  for (const entry of leaderboard.value) {
    const filtered = entry.zaps.filter(z => z.eventId === rootId)
    if (filtered.length === 0) continue
    entries.push({
      ...entry,
      zaps: filtered,
      totalSats: filtered.reduce((sum, z) => sum + z.amount, 0),
      zapCount: filtered.length
    })
  }
  return entries.sort((a, b) => b.totalSats - a.totalSats)
})

// Filtered summary stats
const totalSats = computed(() => filteredLeaderboard.value.reduce((sum, e) => sum + e.totalSats, 0))
const totalZapCount = computed(() => filteredLeaderboard.value.reduce((sum, e) => sum + e.zapCount, 0))
const totalParticipants = computed(() => filteredLeaderboard.value.length)

// Parse user input into a hex event ID
const parseEventInput = (input) => {
  const trimmed = input.trim()

  // Direct hex event ID (64 chars)
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed
  }

  // nevent or note bech32 encoded
  if (trimmed.startsWith('nevent1') || trimmed.startsWith('note1')) {
    try {
      const decoded = nip19.decode(trimmed)
      if (decoded.type === 'nevent') return decoded.data.id
      if (decoded.type === 'note') return decoded.data
    } catch {
      throw new Error('Invalid nevent/note encoding')
    }
  }

  // URL containing nevent or note
  const neventMatch = trimmed.match(/(nevent1[a-z0-9]+)/i)
  if (neventMatch) {
    try {
      const decoded = nip19.decode(neventMatch[1])
      if (decoded.type === 'nevent') return decoded.data.id
    } catch { /* fall through */ }
  }

  const noteMatch = trimmed.match(/(note1[a-z0-9]+)/i)
  if (noteMatch) {
    try {
      const decoded = nip19.decode(noteMatch[1])
      if (decoded.type === 'note') return decoded.data
    } catch { /* fall through */ }
  }

  throw new Error('Could not parse event ID. Paste a hex ID, note1..., nevent1..., or a Nostr client URL.')
}

// Handle form submission
const handleResolve = async () => {
  if (isLoading.value) return
  inputError.value = ''

  if (!inputValue.value.trim()) {
    inputError.value = 'Please enter an event ID or URL'
    return
  }

  let eventId
  try {
    eventId = parseEventInput(inputValue.value)
  } catch (err) {
    inputError.value = err.message
    return
  }

  expandedEntry.value = null
  await resolveContest(eventId)
}

// Handle clear / new search
const handleReset = () => {
  inputValue.value = ''
  inputError.value = ''
  expandedEntry.value = null
  zapScope.value = 'all'
  reset()
}

// Toggle expanded row details
const toggleExpanded = (pubkey) => {
  expandedEntry.value = expandedEntry.value === pubkey ? null : pubkey
}

// Copy pubkey to clipboard
const copyPubkey = async (pubkey) => {
  try {
    const npub = nip19.npubEncode(pubkey)
    await navigator.clipboard.writeText(npub)
    copiedPubkey.value = pubkey
    setTimeout(() => { copiedPubkey.value = null }, 2000)
  } catch { /* ignore clipboard errors */ }
}



// Format timestamp relative
const formatTime = (timestamp) => {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

// Percentage of total for a leaderboard entry
const getPercentage = (entryTotalSats) => {
  if (!totalSats.value) return 0
  return ((entryTotalSats / totalSats.value) * 100).toFixed(1)
}

// Medal for top 3
const getMedal = (index) => {
  if (index === 0) return { emoji: '1st', bg: 'bg-yellow-400', text: 'text-yellow-900' }
  if (index === 1) return { emoji: '2nd', bg: 'bg-gray-300', text: 'text-gray-700' }
  if (index === 2) return { emoji: '3rd', bg: 'bg-amber-600', text: 'text-amber-50' }
  return null
}

// Whether results are loaded
const hasResults = computed(() => leaderboard.value.length > 0)
const hasFilteredResults = computed(() => filteredLeaderboard.value.length > 0)
const hasAttempted = computed(() => rootEvent.value !== null || error.value !== '')
</script>

<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 mb-2 flex items-center space-x-2">
        <IconTrophy class="w-6 h-6 text-orange-600" />
        <span>Contest</span>
      </h1>
      <p class="text-gray-600">Resolve a zap contest. Find out who zapped the most on any post including its comments.</p>
    </div>

    <!-- Input Card -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <label class="block text-sm font-medium text-gray-700 mb-2">Event ID or URL</label>
      <div class="flex gap-3">
        <div class="flex-1 relative">
          <input
            v-model="inputValue"
            type="text"
            placeholder="Paste nevent1..., note1..., hex ID, or Nostr client URL"
            class="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-colors"
            :disabled="isLoading"
            @keydown.enter="handleResolve"
          />
          <button
            v-if="inputValue && !isLoading"
            @click="inputValue = ''; inputError = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <IconX class="w-4 h-4" />
          </button>
        </div>
        <button
          @click="handleResolve"
          :disabled="isLoading || !inputValue.trim()"
          class="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
        >
          <IconLoader v-if="isLoading" class="w-4 h-4 animate-spin" />
          <IconSearch v-else class="w-4 h-4" />
          <span class="hidden sm:inline">{{ isLoading ? 'Resolving...' : 'Resolve' }}</span>
        </button>
      </div>

      <!-- Input validation error -->
      <p v-if="inputError" class="mt-2 text-sm text-red-600 flex items-center gap-1">
        <IconAlertCircle class="w-4 h-4 flex-shrink-0" />
        {{ inputError }}
      </p>

      <!-- Progress indicator -->
      <div v-if="isLoading && progress" class="mt-3 flex items-center gap-2 text-sm text-orange-600">
        <div class="w-4 h-4 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
        {{ progress }}
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error && !isLoading" class="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
      <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <IconAlertCircle class="w-6 h-6 text-red-600" />
      </div>
      <p class="text-red-800 font-medium mb-1">Resolution failed</p>
      <p class="text-red-600 text-sm">{{ error }}</p>
      <button
        @click="handleReset"
        class="mt-4 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
      >
        Try again
      </button>
    </div>

    <!-- Results -->
    <template v-if="hasResults && !isLoading">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
              <IconBolt class="w-4 h-4 text-white" />
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{{ formatSatsShort(totalSats) }}</div>
          <div class="text-xs text-gray-500">Total sats</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
              <IconBolt class="w-4 h-4 text-white" />
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{{ totalZapCount }}</div>
          <div class="text-xs text-gray-500">Total zaps</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
              <IconUsers class="w-4 h-4 text-white" />
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{{ totalParticipants }}</div>
          <div class="text-xs text-gray-500">Participants</div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg flex items-center justify-center">
              <IconMessageCircle class="w-4 h-4 text-white" />
            </div>
          </div>
          <div class="text-2xl font-bold text-gray-900">{{ replyCount }}</div>
          <div class="text-xs text-gray-500">Comments</div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 class="text-base font-semibold text-gray-900 flex items-center gap-2">
            <IconTrophy class="w-5 h-5 text-orange-500" />
            Leaderboard
          </h2>
          <div class="flex items-center gap-2">
            <!-- Scope filter -->
            <div class="flex items-center bg-gray-100 rounded-xl p-1">
              <button
                @click="zapScope = 'all'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  zapScope === 'all'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                Post + Comments
              </button>
              <button
                @click="zapScope = 'post-only'"
                :class="[
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  zapScope === 'post-only'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                ]"
              >
                Post only
              </button>
            </div>
            <button
              @click="handleReset"
              class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              New search
            </button>
          </div>
        </div>

        <div v-if="!hasFilteredResults" class="px-6 py-12 text-center">
          <p class="text-sm text-gray-500">No zaps match this filter.</p>
        </div>

        <div v-else class="divide-y divide-gray-100">
          <div
            v-for="(entry, index) in filteredLeaderboard"
            :key="entry.pubkey"
          >
            <!-- Main Row -->
            <button
              @click="toggleExpanded(entry.pubkey)"
              class="w-full flex items-center gap-3 px-6 py-4 hover:bg-orange-50/30 transition-colors text-left"
            >
              <!-- Rank -->
              <div class="w-8 flex-shrink-0 text-center">
                <span
                  v-if="getMedal(index)"
                  :class="[
                    'inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
                    getMedal(index).bg, getMedal(index).text
                  ]"
                >
                  {{ getMedal(index).emoji }}
                </span>
                <span v-else class="text-sm font-medium text-gray-400">{{ index + 1 }}</span>
              </div>

              <!-- Avatar -->
              <img
                :src="entry.picture"
                :alt="entry.name"
                class="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                @error="$event.target.src = generateAvatar(entry.pubkey)"
              />

              <!-- Name & NIP-05 -->
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-gray-900 text-sm truncate">{{ entry.name }}</div>
                <div v-if="entry.nip05" class="text-xs text-gray-500 truncate">{{ entry.nip05 }}</div>
                <div v-else class="text-xs text-gray-400 truncate">{{ entry.pubkey.substring(0, 16) }}...</div>
              </div>

              <!-- Zap count -->
              <div class="text-xs text-gray-500 flex-shrink-0 hidden sm:block">
                {{ entry.zapCount }} {{ entry.zapCount === 1 ? 'zap' : 'zaps' }}
              </div>

              <!-- Amount -->
              <div class="text-right flex-shrink-0">
                <div class="font-bold text-orange-600">{{ formatSatsShort(entry.totalSats) }}</div>
                <div class="text-xs text-gray-400">{{ getPercentage(entry.totalSats) }}%</div>
              </div>

              <!-- Expand icon -->
              <component
                :is="expandedEntry === entry.pubkey ? IconChevronUp : IconChevronDown"
                class="w-4 h-4 text-gray-400 flex-shrink-0"
              />
            </button>

            <!-- Expanded Detail -->
            <div
              v-if="expandedEntry === entry.pubkey"
              class="bg-gray-50 px-6 py-4 border-t border-gray-100"
            >
              <!-- Copy npub -->
              <div class="flex items-center gap-2 mb-3">
                <button
                  @click.stop="copyPubkey(entry.pubkey)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:text-orange-600 transition-colors"
                >
                  <IconCheck v-if="copiedPubkey === entry.pubkey" class="w-3.5 h-3.5 text-green-500" />
                  <IconCopy v-else class="w-3.5 h-3.5" />
                  {{ copiedPubkey === entry.pubkey ? 'Copied!' : 'Copy npub' }}
                </button>
                <span class="text-xs text-gray-400">{{ entry.zapCount }} zaps totaling {{ entry.totalSats.toLocaleString() }} sats</span>
              </div>

              <!-- Individual zaps -->
              <div class="space-y-2 max-h-48 overflow-y-auto">
                <div
                  v-for="zap in entry.zaps"
                  :key="zap.id"
                  class="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100 text-sm"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <IconBolt class="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    <span class="text-gray-700 font-medium">{{ formatSatsShort(zap.amount) }} sats</span>
                    <span v-if="zap.message" class="text-gray-400 truncate text-xs max-w-[200px]">{{ zap.message }}</span>
                  </div>
                  <span class="text-xs text-gray-400 flex-shrink-0 ml-2">{{ formatTime(zap.timestamp) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty state: no results after attempt -->
    <div v-if="hasAttempted && !hasResults && !isLoading && !error" class="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
      <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <IconBolt class="w-8 h-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">No zaps found</h3>
      <p class="text-sm text-gray-500">This event and its comments have no zap receipts yet.</p>
    </div>
  </div>
</template>
