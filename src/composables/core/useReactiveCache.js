/**
 * useReactiveCache — Vue adapter that bridges shallowRef(Map) to the
 * { get, set, has } store interface expected by fetchWithCache / batchFetchWithCache.
 *
 * Automatically calls triggerRef on writes so computed properties
 * that read the Map re-evaluate.
 */
import { shallowRef, triggerRef } from 'vue'

/**
 * @param {import('vue').ShallowRef<Map>} [existingRef] — reuse an existing shallowRef(Map)
 * @returns {{ mapRef: ShallowRef<Map>, store: { get, set, has }, clear: () => void }}
 */
export function useReactiveCache(existingRef) {
  const mapRef = existingRef || shallowRef(new Map())

  const store = {
    // namespace is ignored — the Map IS the namespace
    get(_ns, key) {
      return mapRef.value.get(key)
    },

    set(_ns, key, value, _ttl) {
      mapRef.value.set(key, value)
      triggerRef(mapRef)
    },

    has(_ns, key) {
      return mapRef.value.has(key)
    }
  }

  function clear() {
    mapRef.value.clear()
    triggerRef(mapRef)
  }

  return { mapRef, store, clear }
}
