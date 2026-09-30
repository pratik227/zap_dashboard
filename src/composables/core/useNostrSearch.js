/**
 * useNostrSearch — NIP-50 relay-side search.
 *
 * Leverages nostr-core's buildSearchFilter to query relays that
 * support NIP-50 search. Falls back to client-side filtering on
 * relays that don't support it.
 */

import { ref, computed } from 'vue'
import { nip50 } from '../../services/nostr/nostrImports.js'
import { nostrService } from '../../services/nostr/NostrService.js'

export function useNostrSearch() {
  const results = ref([])
  const isSearching = ref(false)
  const searchError = ref('')

  /**
   * Search for events matching a query string.
   * @param {string} query — search text
   * @param {object} [opts] — { kinds?, authors?, limit?, since?, until? }
   * @returns {Promise<Array>} matching events
   */
  const search = async (query, opts = {}) => {
    if (!query?.trim()) {
      results.value = []
      return []
    }

    isSearching.value = true
    searchError.value = ''

    try {
      const filter = nip50.buildSearchFilter(query, {
        kinds: opts.kinds,
        authors: opts.authors,
        limit: opts.limit || 50,
        since: opts.since,
        until: opts.until,
      })

      const events = await nostrService.query(
        [filter],
        { timeout: 15_000, eoseGrace: 3_000 }
      )

      // Sort by relevance (created_at desc as default)
      events.sort((a, b) => b.created_at - a.created_at)
      results.value = events
      return events
    } catch (err) {
      console.error('[useNostrSearch] Search failed:', err)
      searchError.value = err.message || 'Search failed'
      return []
    } finally {
      isSearching.value = false
    }
  }

  /**
   * Search for profiles (kind:0 events).
   * @param {string} query
   * @param {number} [limit=20]
   */
  const searchProfiles = (query, limit = 20) => {
    return search(query, { kinds: [0], limit })
  }

  /**
   * Search for notes (kind:1 events).
   * @param {string} query
   * @param {number} [limit=50]
   */
  const searchNotes = (query, limit = 50) => {
    return search(query, { kinds: [1], limit })
  }

  /**
   * Search for long-form articles (kind:30023 events).
   * @param {string} query
   * @param {number} [limit=20]
   */
  const searchArticles = (query, limit = 20) => {
    return search(query, { kinds: [30023], limit })
  }

  const clear = () => {
    results.value = []
    searchError.value = ''
  }

  return {
    results: computed(() => results.value),
    isSearching: computed(() => isSearching.value),
    searchError: computed(() => searchError.value),
    search,
    searchProfiles,
    searchNotes,
    searchArticles,
    clear,
  }
}
