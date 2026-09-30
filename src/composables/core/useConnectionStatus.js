/**
 * useConnectionStatus — reactive relay connection health for UI.
 *
 * Provides reactive state that components can bind to for showing
 * connection indicators, offline banners, and relay health summaries.
 * Listens to NostrService events and updates reactive refs.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { nostrService } from '../../services/nostr/NostrService.js'

// Module-scoped reactive state (shared across all component instances)
const connectedCount = ref(0)
const totalCount = ref(0)
const status = ref('connecting') // 'online' | 'degraded' | 'offline' | 'connecting'
const lastEvent = ref(null) // { type, url, timestamp }
let _listener = null
let _pollTimer = null

function _syncFromService() {
  const health = nostrService.getConnectionHealth()
  connectedCount.value = health.connected
  totalCount.value = health.total

  if (!nostrService.isInitialized) {
    status.value = 'connecting'
  } else if (health.connected === 0) {
    status.value = 'offline'
  } else if (health.healthyPercentage < 50) {
    status.value = 'degraded'
  } else {
    status.value = 'online'
  }
}

function _startListening() {
  if (_listener) return

  _listener = nostrService.addEventListener((event) => {
    if ([
      'relayConnected', 'relayDisconnected', 'relayHealthy',
      'relayUnhealthy', 'relayFailed', 'initialized',
      'relaysUpdated', 'noRelaysAvailable'
    ].includes(event.type)) {
      lastEvent.value = { type: event.type, url: event.data?.url, timestamp: event.timestamp }
      _syncFromService()
    }
  })

  // Poll every 30s as fallback (in case events are missed)
  _pollTimer = setInterval(_syncFromService, 30_000)
  _syncFromService()
}

function _stopListening() {
  if (_listener) {
    _listener()
    _listener = null
  }
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}

export function useConnectionStatus() {
  onMounted(() => {
    _startListening()
  })

  return {
    /** Number of connected relays */
    connectedCount: computed(() => connectedCount.value),

    /** Total configured relays */
    totalCount: computed(() => totalCount.value),

    /** Overall status: 'online' | 'degraded' | 'offline' | 'connecting' */
    status: computed(() => status.value),

    /** Whether we have any relay connections */
    isOnline: computed(() => status.value === 'online' || status.value === 'degraded'),

    /** Whether all relays are down */
    isOffline: computed(() => status.value === 'offline'),

    /** Whether still initializing */
    isConnecting: computed(() => status.value === 'connecting'),

    /** Fraction string like "3/8" for display */
    connectionLabel: computed(() => `${connectedCount.value}/${totalCount.value}`),

    /** Last relay event for debugging/display */
    lastEvent: computed(() => lastEvent.value),

    /** Force a sync from the service */
    refresh: _syncFromService,
  }
}
