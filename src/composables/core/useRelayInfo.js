/**
 * useRelayInfo — NIP-11 relay information for UI display.
 *
 * Fetches and caches relay metadata (name, description, supported NIPs,
 * limits, policies) using nostr-core's NIP-11 implementation.
 */

import { ref, computed } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'

export function useRelayInfo() {
  const relayInfo = ref(new Map()) // url → RelayInfo
  const isLoading = ref(false)

  /**
   * Fetch NIP-11 info for a single relay.
   * @param {string} relayUrl — wss:// relay URL
   * @returns {Promise<object|null>}
   */
  const fetchInfo = async (relayUrl) => {
    const info = await nostrService.fetchRelayInfo(relayUrl)
    if (info) {
      relayInfo.value.set(relayUrl, info)
      // Trigger reactivity
      relayInfo.value = new Map(relayInfo.value)
    }
    return info
  }

  /**
   * Fetch NIP-11 info for all connected relays.
   */
  const fetchAllInfo = async () => {
    isLoading.value = true
    try {
      const results = await nostrService.fetchAllRelayInfo()
      for (const [url, info] of results) {
        relayInfo.value.set(url, info)
      }
      // Trigger reactivity
      relayInfo.value = new Map(relayInfo.value)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if a relay supports a specific NIP.
   */
  const supportsNip = (relayUrl, nipNumber) => {
    const info = relayInfo.value.get(relayUrl)
    if (!info?.supported_nips) return false
    return info.supported_nips.includes(nipNumber)
  }

  /**
   * Get relay limitations (max message length, max subscriptions, etc.)
   */
  const getLimitations = (relayUrl) => {
    return relayInfo.value.get(relayUrl)?.limitation || null
  }

  /**
   * Get relay software info.
   */
  const getSoftware = (relayUrl) => {
    const info = relayInfo.value.get(relayUrl)
    if (!info) return null
    return {
      software: info.software || 'Unknown',
      version: info.version || 'Unknown',
    }
  }

  /**
   * Get list of all supported NIPs for a relay.
   */
  const getSupportedNips = (relayUrl) => {
    return relayInfo.value.get(relayUrl)?.supported_nips || []
  }

  return {
    relayInfo: computed(() => relayInfo.value),
    isLoading: computed(() => isLoading.value),
    fetchInfo,
    fetchAllInfo,
    supportsNip,
    getLimitations,
    getSoftware,
    getSupportedNips,
  }
}
