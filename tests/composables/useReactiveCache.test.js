import { describe, it, expect } from 'vitest'
import { useReactiveCache } from '../../src/composables/core/useReactiveCache.js'
import { shallowRef } from 'vue'
import { cacheHit, isCacheEntry } from '../../src/services/nostr/CacheEntry.js'

describe('useReactiveCache', () => {
  it('creates a reactive Map store', () => {
    const { mapRef, store } = useReactiveCache()
    expect(mapRef.value).toBeInstanceOf(Map)
    expect(mapRef.value.size).toBe(0)
    expect(typeof store.get).toBe('function')
    expect(typeof store.set).toBe('function')
    expect(typeof store.has).toBe('function')
  })

  it('get/set/has work through the store adapter', () => {
    const { store } = useReactiveCache()

    expect(store.has('ns', 'key')).toBe(false)
    expect(store.get('ns', 'key')).toBeUndefined()

    store.set('ns', 'key', cacheHit('value'))

    expect(store.has('ns', 'key')).toBe(true)
    const cached = store.get('ns', 'key')
    expect(isCacheEntry(cached)).toBe(true)
    expect(cached.value).toBe('value')
  })

  it('ignores namespace — the Map IS the namespace', () => {
    const { store } = useReactiveCache()

    store.set('anything', 'k', 'v')
    expect(store.get('different', 'k')).toBe('v')
  })

  it('accepts an existing shallowRef', () => {
    const existing = shallowRef(new Map([['k', 'v']]))
    const { mapRef, store } = useReactiveCache(existing)

    expect(mapRef).toBe(existing)
    expect(store.get('ns', 'k')).toBe('v')
  })

  it('clear empties the Map', () => {
    const { store, clear, mapRef } = useReactiveCache()

    store.set('ns', 'a', 1)
    store.set('ns', 'b', 2)
    expect(mapRef.value.size).toBe(2)

    clear()
    expect(mapRef.value.size).toBe(0)
  })

  it('writes update the shallowRef for Vue reactivity', () => {
    const { mapRef, store } = useReactiveCache()

    // shallowRef: the Map instance stays the same, but triggerRef is called
    const mapBefore = mapRef.value
    store.set('ns', 'key', 'val')
    // The Map instance is the same (shallow mutation)
    expect(mapRef.value).toBe(mapBefore)
    // But the value is stored
    expect(mapRef.value.get('key')).toBe('val')
  })
})
