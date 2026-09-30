/**
 * useDeskColumns — Column state management for SocialDesk.
 *
 * Manages the ordered list of desk columns, their configuration,
 * and persistence to StorageService. Singleton pattern — all callers
 * share the same reactive state.
 */

import { ref, computed } from 'vue'
import { storageService, STORAGE_KEYS } from '../../services/StorageService.js'

// ── Constants ───────────────────────────────────────────────────
const MAX_COLUMNS = 6

/** Column types and their display labels */
export const COLUMN_TYPES = {
  HASHTAG: 'hashtag',
  USER: 'user',
  FOLLOWING: 'following',
  MENTIONS: 'mentions',
  GLOBAL: 'global',
  LONGFORM: 'longform'
}

const COLUMN_TYPE_LABELS = {
  [COLUMN_TYPES.HASHTAG]: 'Hashtag',
  [COLUMN_TYPES.USER]: 'User',
  [COLUMN_TYPES.FOLLOWING]: 'Following',
  [COLUMN_TYPES.MENTIONS]: 'Mentions',
  [COLUMN_TYPES.GLOBAL]: 'Global',
  [COLUMN_TYPES.LONGFORM]: 'Longform'
}

export const LONGFORM_FILTER_MODES = {
  TAG: 'tag',
  USER: 'user'
}

export function createLongformFilter(mode, value) {
  return `${mode}:${value || ''}`
}

export function parseLongformFilter(filter) {
  if (typeof filter !== 'string') {
    return { mode: LONGFORM_FILTER_MODES.TAG, value: '' }
  }

  const [rawMode, ...rest] = filter.split(':')
  const mode = rawMode === LONGFORM_FILTER_MODES.USER
    ? LONGFORM_FILTER_MODES.USER
    : LONGFORM_FILTER_MODES.TAG

  return {
    mode,
    value: rest.join(':')
  }
}

function getDefaultLabel(type, filter, label = '') {
  if (label) return label

  if (type === COLUMN_TYPES.HASHTAG && typeof filter === 'string' && filter) {
    return `#${filter}`
  }

  if (type === COLUMN_TYPES.LONGFORM) {
    const { mode, value } = parseLongformFilter(filter)
    if (mode === LONGFORM_FILTER_MODES.TAG && value) {
      return `Longform #${value}`
    }
    if (mode === LONGFORM_FILTER_MODES.USER) {
      return 'Longform User'
    }
  }

  return COLUMN_TYPE_LABELS[type] || 'Feed'
}

// ── Global state (singleton) ────────────────────────────────────
const columns = ref([])
let isHydrated = false

// ── Helpers ─────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function persist() {
  const serializable = columns.value.map(col => ({
    id: col.id,
    type: col.type,
    filter: col.filter,
    label: col.label
  }))
  storageService.set(STORAGE_KEYS.DESK_COLUMNS, serializable)
}

const VALID_TYPES = new Set(Object.values(COLUMN_TYPES))

function hydrate() {
  if (isHydrated) return
  isHydrated = true

  const saved = storageService.get(STORAGE_KEYS.DESK_COLUMNS)
  if (Array.isArray(saved) && saved.length > 0) {
    columns.value = saved
      .filter(col => col && VALID_TYPES.has(col.type))
      .slice(0, MAX_COLUMNS)
      .map(col => ({
        id: col.id || generateId(),
        type: col.type,
        filter: col.filter || '',
        label: getDefaultLabel(col.type, col.filter || '', col.label || '')
      }))
  }
}

// ── Public API ──────────────────────────────────────────────────

export function useDeskColumns() {
  hydrate()

  const columnCount = computed(() => columns.value.length)
  const canAddColumn = computed(() => columns.value.length < MAX_COLUMNS)
  const hasColumns = computed(() => columns.value.length > 0)

  /**
   * Add a new column.
   * @param {string} type — one of COLUMN_TYPES
   * @param {string} filter — hashtag string, pubkey, or encoded longform filter
   * @param {string} [label] — custom display label
   * @returns {string} the new column's id
   */
  function addColumn(type, filter = '', label = '') {
    if (!canAddColumn.value) return null

    const col = {
      id: generateId(),
      type,
      filter,
      label: getDefaultLabel(type, filter, label)
    }

    columns.value.push(col)
    persist()
    return col.id
  }

  /**
   * Remove a column by id.
   */
  function removeColumn(id) {
    const idx = columns.value.findIndex(c => c.id === id)
    if (idx === -1) return
    columns.value.splice(idx, 1)
    persist()
  }

  /**
   * Update a column's configuration.
   */
  function updateColumn(id, updates) {
    const col = columns.value.find(c => c.id === id)
    if (!col) return

    // Validate: filter-required column types cannot have empty filter
    const newType = updates.type !== undefined ? updates.type : col.type
    const newFilter = updates.filter !== undefined ? updates.filter : col.filter
    const requiresFilter = newType === COLUMN_TYPES.HASHTAG || newType === COLUMN_TYPES.USER || newType === COLUMN_TYPES.LONGFORM
    if (requiresFilter && !String(newFilter).trim()) return // reject invalid update

    if (updates.type !== undefined && VALID_TYPES.has(updates.type)) col.type = updates.type
    if (updates.filter !== undefined) col.filter = updates.filter
    if (updates.label !== undefined && updates.label.trim()) col.label = updates.label
    persist()
  }

  /**
   * Move a column from one index to another.
   */
  function moveColumn(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= columns.value.length) return
    if (toIndex < 0 || toIndex >= columns.value.length) return
    const [moved] = columns.value.splice(fromIndex, 1)
    columns.value.splice(toIndex, 0, moved)
    persist()
  }

  /**
   * Reset to empty (used on logout).
   */
  function clearColumns() {
    columns.value = []
    persist()
  }

  return {
    columns,
    columnCount,
    canAddColumn,
    hasColumns,
    maxColumns: MAX_COLUMNS,
    addColumn,
    removeColumn,
    updateColumn,
    moveColumn,
    clearColumns
  }
}
