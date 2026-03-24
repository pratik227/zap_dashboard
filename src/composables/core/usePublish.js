/**
 * usePublish — reactive publish state for UI components.
 *
 * Wraps PublishService with Vue reactivity for showing publish status,
 * error messages, and retry buttons in the UI.
 */

import { ref, computed } from 'vue'
import { publishService, PublishError } from '../../services/nostr/PublishService.js'

export function usePublish() {
  const isPublishing = ref(false)
  const publishError = ref(null) // { message, userMessage, code, eventId }
  const lastPublishResult = ref(null)
  const retryAttempt = ref(0)

  /**
   * Sign and publish an event template with reactive state tracking.
   * @param {object} template — { kind, content, tags, created_at? }
   * @param {object} [opts] — { retries?, showRetryProgress? }
   * @returns {Promise<{ event, result }>}
   */
  const signAndPublish = async (template, opts = {}) => {
    isPublishing.value = true
    publishError.value = null
    retryAttempt.value = 0
    lastPublishResult.value = null

    try {
      const res = await publishService.signAndPublish(template, {
        retries: opts.retries,
        onRetry: ({ attempt }) => {
          retryAttempt.value = attempt
        },
      })

      lastPublishResult.value = res.result
      return res
    } catch (err) {
      const isPublishErr = err instanceof PublishError
      publishError.value = {
        message: err.message,
        userMessage: isPublishErr ? err.userMessage : err.message,
        code: isPublishErr ? err.code : 'UNKNOWN',
        eventId: isPublishErr ? err.meta?.eventId : null,
      }
      throw err
    } finally {
      isPublishing.value = false
      retryAttempt.value = 0
    }
  }

  /**
   * Retry the last failed publish.
   */
  const retryLast = async () => {
    if (!publishError.value?.eventId) return
    isPublishing.value = true
    publishError.value = null

    try {
      const res = await publishService.retry(publishError.value.eventId)
      lastPublishResult.value = res.result
      return res
    } catch (err) {
      const isPublishErr = err instanceof PublishError
      publishError.value = {
        message: err.message,
        userMessage: isPublishErr ? err.userMessage : err.message,
        code: isPublishErr ? err.code : 'UNKNOWN',
        eventId: isPublishErr ? err.meta?.eventId : null,
      }
      throw err
    } finally {
      isPublishing.value = false
    }
  }

  /**
   * Clear the error state (dismiss error toast).
   */
  const dismissError = () => {
    publishError.value = null
  }

  return {
    isPublishing: computed(() => isPublishing.value),
    publishError: computed(() => publishError.value),
    lastPublishResult: computed(() => lastPublishResult.value),
    retryAttempt: computed(() => retryAttempt.value),
    canRetry: computed(() => !!publishError.value?.eventId),
    signAndPublish,
    retryLast,
    dismissError,
  }
}
