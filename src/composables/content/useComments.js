/**
 * useComments — NIP-22 comment threads on events.
 *
 * Enables comment threads under articles, notes, or any Nostr event
 * using nostr-core's NIP-22 implementation.
 */

import { ref, computed } from 'vue'
import { nip22 } from '../../services/nostr/nostrImports.js'
import { nostrService } from '../../services/nostr/NostrService.js'
import { publishService } from '../../services/nostr/PublishService.js'
import { profileService } from '../../services/nostr/ProfileService.js'

export function useComments() {
  const comments = ref(new Map()) // eventId → [{comment, profile}]
  const isLoading = ref(false)

  /**
   * Fetch comments for a specific event.
   * @param {string} eventId — the event being commented on
   * @param {number} [eventKind] — kind of the target event (for proper threading)
   * @returns {Promise<Array>}
   */
  const fetchComments = async (eventId, eventKind) => {
    isLoading.value = true

    try {
      // Fetch both NIP-22 comments (kind:1111) and traditional replies (kind:1)
      // in a single subscription with multiple filters
      const allComments = await nostrService.query(
        [
          { kinds: [1111], '#e': [eventId], limit: 200 },
          { kinds: [1], '#e': [eventId], limit: 200 }
        ],
        { timeout: 15_000, eoseGrace: 2_000 }
      )
      allComments.sort((a, b) => a.created_at - b.created_at)

      // Batch fetch profiles
      const pubkeys = [...new Set(allComments.map(e => e.pubkey))]
      await profileService.batch(pubkeys)

      // Build enriched comment list
      const enriched = allComments.map(event => ({
        id: event.id,
        content: event.content,
        pubkey: event.pubkey,
        profile: profileService.getCached(event.pubkey),
        createdAt: event.created_at,
        kind: event.kind,
        tags: event.tags,
        rawEvent: event,
      }))

      comments.value.set(eventId, enriched)
      return enriched
    } catch (err) {
      console.error('[useComments] Fetch failed:', err)
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Post a comment on an event.
   * @param {object} params
   * @param {string} params.targetEventId — event being commented on
   * @param {string} params.targetPubkey — author of the target event
   * @param {number} [params.targetKind] — kind of the target event
   * @param {string} params.content — comment text
   * @param {string} [params.parentCommentId] — reply to a specific comment (threading)
   * @returns {Promise<object>} published comment event
   */
  const postComment = async ({ targetEventId, targetPubkey, targetKind, content, parentCommentId }) => {
    if (!content?.trim()) throw new Error('Comment cannot be empty')

    const template = nip22.createCommentEventTemplate(content, {
      rootType: 'event',
      rootId: targetEventId,
      rootKind: targetKind,
      rootPubkey: targetPubkey,
      ...(parentCommentId && {
        parentType: 'event',
        parentId: parentCommentId,
      }),
    })

    const { event: signedEvent } = await publishService.signAndPublish(template)
    return signedEvent
  }

  /**
   * Get comments for a specific event.
   */
  const getComments = (eventId) => {
    return computed(() => comments.value.get(eventId) || [])
  }

  return {
    comments,
    isLoading: computed(() => isLoading.value),
    fetchComments,
    postComment,
    getComments,
  }
}
