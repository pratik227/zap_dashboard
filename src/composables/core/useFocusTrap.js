import { onMounted, onUnmounted, watch, nextTick } from 'vue'

/**
 * Lightweight focus trap for modals.
 * Usage: useFocusTrap(showRef, containerRef)
 *   - showRef: a ref<boolean> that controls modal visibility
 *   - containerRef: a template ref pointing to the modal root element
 */
export function useFocusTrap(showRef, containerRef) {
  let previouslyFocused = null

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

  function getFocusable() {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll(FOCUSABLE)).filter(
      el => !el.closest('[hidden]') && el.offsetParent !== null
    )
  }

  function handleKeydown(e) {
    if (e.key !== 'Tab') return
    const elements = getFocusable()
    if (elements.length === 0) return

    const first = elements[0]
    const last = elements[elements.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function activate() {
    previouslyFocused = document.activeElement
    nextTick(() => {
      const elements = getFocusable()
      if (elements.length > 0) {
        elements[0].focus()
      } else if (containerRef.value) {
        containerRef.value.focus()
      }
    })
    document.addEventListener('keydown', handleKeydown)
  }

  function deactivate() {
    document.removeEventListener('keydown', handleKeydown)
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      nextTick(() => previouslyFocused.focus())
    }
    previouslyFocused = null
  }

  watch(showRef, (visible) => {
    if (visible) {
      activate()
    } else {
      deactivate()
    }
  })

  onMounted(() => {
    if (showRef.value) activate()
  })

  onUnmounted(() => {
    deactivate()
  })
}
