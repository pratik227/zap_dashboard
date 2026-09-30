/**
 * useSubscription — Vue lifecycle-aware Nostr subscription composable.
 *
 * Automatically closes the subscription when the component unmounts.
 * Supports reactive filters (re-subscribes when they change).
 *
 * Usage:
 *   const { isActive, error, close, resubscribe } = useSubscription(
 *     [{ kinds: [1], authors: [pubkey] }],
 *     {
 *       onevent: (event) => { ... },
 *       oneose: () => { ... },
 *     },
 *     { enabled: isAuthenticated, immediate: true }
 *   )
 */

import { ref, watch, onUnmounted, isRef, unref, getCurrentInstance } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'

/**
 * @param {Array|import('vue').Ref<Array>} filters — Nostr filter array (or reactive ref)
 * @param {object} callbacks — { onevent, oneose?, onclose? }
 * @param {object} [options]
 * @param {import('vue').Ref<boolean>|boolean} [options.enabled=true] — controls whether sub is active
 * @param {boolean} [options.immediate=true] — subscribe immediately on creation
 * @param {number} [options.maxWait] — max wait for relay connections
 * @returns {{ isActive: Ref<boolean>, error: Ref<string|null>, close: Function, resubscribe: Function }}
 */
export function useSubscription(filters, callbacks = {}, options = {}) {
  const {
    enabled = true,
    immediate = true,
    maxWait,
  } = options

  const isActive = ref(false)
  const error = ref(null)
  let currentSub = null
  let destroyed = false // guards against post-unmount resubscribe

  function doSubscribe() {
    if (destroyed) return
    doClose()

    const resolvedFilters = unref(filters)
    if (!resolvedFilters || resolvedFilters.length === 0) return

    if (!nostrService.isInitialized) {
      nostrService.ready().then(() => {
        // Re-check guards after async wait
        if (!destroyed && unref(enabled)) doSubscribe()
      }).catch(err => {
        if (!destroyed) error.value = err.message
      })
      return
    }

    try {
      error.value = null

      currentSub = nostrService.subscribe(
        resolvedFilters,
        {
          onevent: (event) => {
            if (destroyed) return
            try {
              callbacks.onevent?.(event)
            } catch (err) {
              console.error('useSubscription onevent error:', err)
            }
          },
          oneose: () => {
            if (!destroyed) callbacks.oneose?.()
          },
          onclose: (reason) => {
            isActive.value = false
            if (!destroyed) callbacks.onclose?.(reason)
          },
        },
        { maxWait }
      )

      // Verify we got a valid sub handle
      if (currentSub) {
        isActive.value = true
      }
    } catch (err) {
      error.value = err.message
      isActive.value = false
    }
  }

  function doClose() {
    if (currentSub) {
      try {
        currentSub.close()
      } catch {
        // ignore close errors
      }
      currentSub = null
      isActive.value = false
    }
  }

  function resubscribe() {
    if (!destroyed) doSubscribe()
  }

  // Watch enabled flag
  if (isRef(enabled)) {
    watch(enabled, (newVal) => {
      if (newVal) {
        doSubscribe()
      } else {
        doClose()
      }
    })
  }

  // Watch reactive filters (debounced via { flush: 'post' })
  if (isRef(filters)) {
    watch(filters, () => {
      if (unref(enabled)) {
        doSubscribe()
      }
    }, { deep: true, flush: 'post' })
  }

  // Auto-subscribe if immediate and enabled
  if (immediate && unref(enabled)) {
    doSubscribe()
  }

  // Auto-cleanup on unmount
  const instance = getCurrentInstance()
  if (instance) {
    onUnmounted(() => {
      destroyed = true
      doClose()
    })
  } else {
    // Not in a component setup context — caller is responsible for cleanup
    console.warn('useSubscription: called outside component setup. Call close() manually to avoid leaks.')
  }

  return {
    isActive,
    error,
    close: doClose,
    resubscribe,
  }
}
