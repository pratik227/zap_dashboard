/**
 * useReporting — NIP-56 event/user reporting.
 *
 * Allows users to report spam, abuse, or inappropriate content
 * using nostr-core's NIP-56 implementation.
 */

import { ref } from 'vue'
import { nip56 } from '../../services/nostr/nostrImports.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { getUserFriendlyError } from '../../services/nostr/errors.js'

/** Report reason types per NIP-56 */
export const ReportType = {
  NUDITY: 'nudity',
  MALWARE: 'malware',
  PROFANITY: 'profanity',
  ILLEGAL: 'illegal',
  SPAM: 'spam',
  IMPERSONATION: 'impersonation',
  OTHER: 'other',
}

export function useReporting() {
  const isReporting = ref(false)
  const reportError = ref('')

  /**
   * Report a user or event.
   * @param {object} params
   * @param {string} params.pubkey — pubkey of the user being reported
   * @param {string} [params.eventId] — specific event ID (if reporting an event)
   * @param {string} params.reason — report type (from ReportType)
   * @param {string} [params.content] — optional explanation
   * @returns {Promise<object>} published report event
   */
  const report = async ({ pubkey, eventId, reason, content = '' }) => {
    if (!pubkey) throw new Error('Pubkey is required for reporting')
    if (!reason) throw new Error('Report reason is required')

    isReporting.value = true
    reportError.value = ''

    try {
      const targets = []
      if (eventId) {
        targets.push({ type: 'event', eventId, authorPubkey: pubkey, reportType: reason })
      } else {
        targets.push({ type: 'pubkey', pubkey, reportType: reason })
      }
      const template = nip56.createReportEventTemplate(targets, content)

      const { event: signedEvent } = await publishService.signAndPublish(template)
      return signedEvent
    } catch (err) {
      console.error('[useReporting] Report failed:', err)
      reportError.value = getUserFriendlyError(err)
      throw err
    } finally {
      isReporting.value = false
    }
  }

  return {
    isReporting,
    reportError,
    report,
    ReportType,
  }
}
