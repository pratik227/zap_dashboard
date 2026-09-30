import { onMounted, onUnmounted, watch, nextTick } from 'vue'

/**
 * Stack-aware focus trap for modals.
 *
 * Multiple overlays can coexist (e.g. profile modal over zap popover).
 * Only the topmost active trap handles Tab key. When it deactivates,
 * the previous trap resumes. Focus is restored to the element that
 * was focused before each trap activated.
 *
 * Usage: useFocusTrap(showRef, containerRef)
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Global stack of active traps (topmost = last)
const trapStack = []

// Single global keydown handler — delegates to topmost trap
function globalKeyHandler(e) {
  if (e.key !== 'Tab' || trapStack.length === 0) return
  const top = trapStack[trapStack.length - 1]
  top._handleTab(e)
}

// Install/uninstall global handler based on stack state
let globalHandlerInstalled = false
function ensureGlobalHandler() {
  if (trapStack.length > 0 && !globalHandlerInstalled) {
    document.addEventListener('keydown', globalKeyHandler, true)
    globalHandlerInstalled = true
  } else if (trapStack.length === 0 && globalHandlerInstalled) {
    document.removeEventListener('keydown', globalKeyHandler, true)
    globalHandlerInstalled = false
  }
}

export function useFocusTrap(showRef, containerRef) {
  let previouslyFocused = null

  const trap = {
    _handleTab(e) {
      if (!containerRef.value) return
      const elements = Array.from(containerRef.value.querySelectorAll(FOCUSABLE)).filter(
        el => !el.closest('[hidden]') && el.offsetParent !== null
      )
      if (elements.length === 0) return

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first || !containerRef.value.contains(document.activeElement)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last || !containerRef.value.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  function activate() {
    previouslyFocused = document.activeElement
    trapStack.push(trap)
    ensureGlobalHandler()

    nextTick(() => {
      if (!containerRef.value) return
      const elements = Array.from(containerRef.value.querySelectorAll(FOCUSABLE)).filter(
        el => !el.closest('[hidden]') && el.offsetParent !== null
      )
      if (elements.length > 0) {
        elements[0].focus()
      } else if (containerRef.value) {
        containerRef.value.focus()
      }
    })
  }

  function deactivate() {
    const idx = trapStack.indexOf(trap)
    if (idx !== -1) trapStack.splice(idx, 1)
    ensureGlobalHandler()

    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      nextTick(() => {
        try { previouslyFocused.focus() } catch { /* element may be gone */ }
      })
    }
    previouslyFocused = null
  }

  watch(showRef, (visible) => {
    if (visible) activate()
    else deactivate()
  })

  onMounted(() => {
    if (showRef.value) activate()
  })

  onUnmounted(() => {
    deactivate()
  })
}
