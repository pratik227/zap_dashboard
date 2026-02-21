import { ref, computed, watch } from 'vue'
import { useNostrAuth } from '../auth/useNostrAuth.js'
import { nostrRelayManager } from '../../utils/network/nostrRelayManager.js'
import { subscribe } from '../../utils/network/subscribe.js'
import { parseZapReceipt } from '../../utils/zaps/parseZapReceipt.js'
import { fetchProfile, batchFetchProfiles, profileCache } from '../../utils/profile/profileFetcher.js'
import { generateAvatar } from '../../utils/profile/avatarGenerator.js'

// Module-scope state (shared across all component instances)
const userZaps = ref([])
const isLoading = ref(false)
const seenZapIds = new Set()
let liveSubscription = null
let subNonce = 0

// Enrich a parsed zap with profile data, returning the shape App.vue expects
const enrichZap = (parsed, profile) => {
  return {
    id: parsed.id,
    amount: parsed.amount,
    timestamp: parsed.timestamp,
    sender: {
      pubkey: parsed.zapperPubkey,
      name: profile?.name || `user:${parsed.zapperPubkey.substring(0, 8)}`,
      picture: profile?.picture || generateAvatar(parsed.zapperPubkey),
      avatar: profile?.picture || generateAvatar(parsed.zapperPubkey),
      nip05: profile?.nip05 || null,
      about: profile?.about || null
    },
    note: parsed.message || 'Zap',
    noteType: 'original',
    client: 'nostr',
    source: 'nip57',
    eventId: parsed.zappedEventId
  }
}

export function useUserZaps() {
  const { currentUser, isAuthenticated } = useNostrAuth()

  const startTracking = async () => {
    if (!isAuthenticated.value || !currentUser.value?.pubkey) return
    if (isLoading.value) return

    const pubkey = currentUser.value.pubkey
    isLoading.value = true

    try {
      // Phase 1: Historical fetch
      const rawZapEvents = await subscribe(
        [{ kinds: [9735], '#p': [pubkey], limit: 500 }],
        { timeout: 25000, eoseGrace: 3000 }
      )

      // Phase 2: Parse and dedup
      const parsedZaps = []
      for (const zapEvent of rawZapEvents) {
        const parsed = parseZapReceipt(zapEvent)
        if (parsed && !seenZapIds.has(parsed.id)) {
          seenZapIds.add(parsed.id)
          parsedZaps.push(parsed)
        }
      }

      // Phase 3: Batch fetch profiles for all unique zappers
      const uniquePubkeys = [...new Set(parsedZaps.map(z => z.zapperPubkey))]
      await batchFetchProfiles(uniquePubkeys)

      // Phase 4: Enrich zaps with profile data
      const enriched = parsedZaps.map(parsed => {
        const cached = profileCache.get(parsed.zapperPubkey)
        return enrichZap(parsed, cached?.profile || null)
      })

      // Sort newest first
      enriched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      userZaps.value = enriched

      // Phase 5: Open live subscription for new incoming zaps
      if (liveSubscription) {
        liveSubscription.close()
        liveSubscription = null
      }

      const nonce = ++subNonce
      liveSubscription = nostrRelayManager.subscribeToEvents(
        [{ kinds: [9735], '#p': [pubkey], since: Math.floor(Date.now() / 1000) }],
        {
          _nonce: nonce,
          onevent: async (zapEvent) => {
            const parsed = parseZapReceipt(zapEvent)
            if (!parsed || seenZapIds.has(parsed.id)) return
            seenZapIds.add(parsed.id)

            // Fetch profile for the new zapper
            let profile = null
            try {
              profile = await fetchProfile(parsed.zapperPubkey)
            } catch { /* use fallback */ }

            const enriched = enrichZap(parsed, profile)
            // Prepend to list (newest first)
            userZaps.value = [enriched, ...userZaps.value]
          },
          oneose: () => {},
          onclose: () => { liveSubscription = null }
        }
      )
    } catch (err) {
      console.error('[useUserZaps] Failed to start tracking:', err)
    } finally {
      isLoading.value = false
    }
  }

  const stopTracking = () => {
    if (liveSubscription) {
      liveSubscription.close()
      liveSubscription = null
    }
    userZaps.value = []
    seenZapIds.clear()
  }

  // Auto-start when authenticated
  watch(isAuthenticated, (auth) => {
    if (auth) startTracking()
    else stopTracking()
  }, { immediate: true })

  return {
    userZaps: computed(() => userZaps.value),
    isLoading: computed(() => isLoading.value),
    startTracking,
    stopTracking
  }
}
