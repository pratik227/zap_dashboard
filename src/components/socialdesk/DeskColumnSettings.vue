<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { IconCheck } from '@iconify-prerendered/vue-tabler'
import { COLUMN_TYPES, LONGFORM_FILTER_MODES, createLongformFilter, parseLongformFilter } from '../../composables/social/useDeskColumns.js'
import UserSearchInput from '../audience/UserSearchInput.vue'

const props = defineProps({
  column: { type: Object, required: true }
})

const emit = defineEmits(['close', 'update'])

const label = ref(props.column.label)
const filter = ref(props.column.filter)
const filterError = ref('')
const popoverRef = ref(null)
const labelInputRef = ref(null)
const longformMode = ref(LONGFORM_FILTER_MODES.TAG)
const selectedUser = ref(null)

const needsFilter = [COLUMN_TYPES.HASHTAG, COLUMN_TYPES.USER, COLUMN_TYPES.LONGFORM].includes(props.column.type)

function syncFromColumn(col) {
  label.value = col.label
  filter.value = col.filter
  filterError.value = ''
  selectedUser.value = null

  if (col.type === COLUMN_TYPES.LONGFORM) {
    const parsed = parseLongformFilter(col.filter)
    longformMode.value = parsed.mode
    filter.value = parsed.value
  } else {
    longformMode.value = LONGFORM_FILTER_MODES.TAG
  }
}

// Sync if column changes externally
watch(() => props.column, (col) => {
  syncFromColumn(col)
}, { deep: true })

function validate() {
  filterError.value = ''
  if (needsFilter) {
    const trimmed = filter.value.trim().replace(/^#/, '')
    if (!trimmed) {
      if (props.column.type === COLUMN_TYPES.HASHTAG) {
        filterError.value = 'Hashtag cannot be empty'
      } else if (props.column.type === COLUMN_TYPES.USER) {
        filterError.value = 'Select a user'
      } else {
        filterError.value = longformMode.value === LONGFORM_FILTER_MODES.TAG
          ? 'Longform hashtag cannot be empty'
          : 'Select a user'
      }
      return false
    }
  }
  return true
}

function save() {
  if (!validate()) return

  const updates = {}
  const trimmedLabel = label.value.trim()
  const trimmedFilter = filter.value.trim().replace(/^#/, '')
  const normalizedFilter = props.column.type === COLUMN_TYPES.LONGFORM
    ? createLongformFilter(longformMode.value, trimmedFilter)
    : trimmedFilter

  if (trimmedLabel && trimmedLabel !== props.column.label) {
    updates.label = trimmedLabel
  }
  if (needsFilter && normalizedFilter !== props.column.filter) {
    updates.filter = normalizedFilter
    // Auto-update label if it was still the default hashtag label
    if (props.column.type === COLUMN_TYPES.HASHTAG && props.column.label === `#${props.column.filter}`) {
      updates.label = `#${trimmedFilter}`
    }
    if (props.column.type === COLUMN_TYPES.LONGFORM) {
      const parsed = parseLongformFilter(props.column.filter)
      if (parsed.mode === LONGFORM_FILTER_MODES.TAG && props.column.label === `Longform #${props.column.filter.replace(/^tag:/, '')}`) {
        updates.label = `Longform #${trimmedFilter}`
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    emit('update', updates)
  }
  emit('close')
}

// Click-outside: use pointerdown on capture phase for deterministic dismissal.
// This avoids timing issues with setTimeout and works with touch, nested content, and portals.
function onPointerDownOutside(e) {
  if (popoverRef.value && !popoverRef.value.contains(e.target)) {
    emit('close')
  }
}

onMounted(() => {
  // Use capture + requestAnimationFrame to avoid closing on the same click that opened
  requestAnimationFrame(() => {
    document.addEventListener('pointerdown', onPointerDownOutside, true)
  })
  // Focus the label input on open
  nextTick(() => labelInputRef.value?.focus())
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
})

function handleUserSelected(user) {
  filter.value = user.pubkey
  selectedUser.value = user
  filterError.value = ''
  if (!label.value || label.value === props.column.label) {
    if (props.column.type === COLUMN_TYPES.USER) {
      label.value = user.name || user.nip05 || props.column.label
    } else if (props.column.type === COLUMN_TYPES.LONGFORM && longformMode.value === LONGFORM_FILTER_MODES.USER) {
      label.value = `Longform ${user.name || user.nip05 || 'User'}`
    }
  }
}

function setLongformMode(mode) {
  longformMode.value = mode
  filter.value = ''
  selectedUser.value = null
  filterError.value = ''
}

syncFromColumn(props.column)
</script>

<template>
  <div
    ref="popoverRef"
    class="absolute top-full right-0 mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200/60 z-20 overflow-hidden"
    role="dialog"
    aria-label="Column settings"
    @keydown.escape="emit('close')"
  >
    <div class="p-3 space-y-3">
      <!-- Label -->
      <div class="space-y-1">
        <label class="text-xs font-medium text-gray-500">Label</label>
        <input
          ref="labelInputRef"
          v-model="label"
          type="text"
          class="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
          @keyup.enter="save"
        />
      </div>

      <!-- Filter -->
      <div v-if="needsFilter" class="space-y-1">
        <label class="text-xs font-medium text-gray-500">
          {{
            props.column.type === COLUMN_TYPES.HASHTAG
              ? 'Hashtag'
              : props.column.type === COLUMN_TYPES.USER
                ? 'User'
                : 'Longform filter'
          }}
        </label>

        <div v-if="props.column.type === COLUMN_TYPES.LONGFORM" class="flex gap-2">
          <button
            @click="setLongformMode(LONGFORM_FILTER_MODES.TAG)"
            :class="[
              'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              longformMode === LONGFORM_FILTER_MODES.TAG ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-100 text-gray-600'
            ]"
          >
            By tag
          </button>
          <button
            @click="setLongformMode(LONGFORM_FILTER_MODES.USER)"
            :class="[
              'flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
              longformMode === LONGFORM_FILTER_MODES.USER ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-100 text-gray-600'
            ]"
          >
            By user
          </button>
        </div>

        <div v-if="props.column.type === COLUMN_TYPES.HASHTAG || (props.column.type === COLUMN_TYPES.LONGFORM && longformMode === LONGFORM_FILTER_MODES.TAG)" class="relative">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">#</span>
          <input
            v-model="filter"
            type="text"
            :class="[
              'w-full py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors',
              'pl-6 pr-2.5',
              filterError ? 'border-red-300' : 'border-gray-200'
            ]"
            @keyup.enter="save"
          />
        </div>

        <div v-else class="space-y-2">
          <UserSearchInput
            :placeholder="props.column.type === COLUMN_TYPES.USER ? 'Search by name, npub, or NIP-05...' : 'Search author by name, npub, or NIP-05...'"
            :show-role="false"
            @user-selected="handleUserSelected"
          />
          <p v-if="filter" class="text-[11px] text-gray-500 truncate">
            Selected: {{ selectedUser?.name || selectedUser?.nip05 || filter }}
          </p>
        </div>

        <p v-if="filterError" class="text-xs text-red-600">{{ filterError }}</p>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 pt-1">
        <button
          @click="emit('close')"
          class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          @click="save"
          class="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
        >
          <IconCheck class="w-3.5 h-3.5" />
          Save
        </button>
      </div>
    </div>
  </div>
</template>
