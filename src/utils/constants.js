// Shared constants — single source of truth for timeouts, limits, and defaults

// ── Relay connection ──
export const RELAY_CONNECTION_TIMEOUT = 10_000   // 10s per relay connect attempt
export const RELAY_MAX_RETRIES = 3
export const RELAY_RETRY_DELAY = 2_000           // 2s between retries
export const RELAY_HEALTH_CHECK_INTERVAL = 300_000 // 5min between health checks
export const RELAY_HEALTH_CHECK_TIMEOUT = 5_000  // 5s per health check probe
export const RELAY_MAX_BACKOFF = 5 * 60 * 1000   // 5min max backoff

// ── Subscribe helper ──
export const SUBSCRIBE_TIMEOUT = 25_000          // 25s hard timeout
export const SUBSCRIBE_EOSE_GRACE = 3_000        // 3s grace after EOSE
export const DEFERRED_SUB_TIMEOUT = 5_000        // 5s timeout for deferred subs

// ── Profile fetching ──
export const PROFILE_FETCH_TIMEOUT = 15_000      // 15s batch fetch timeout
export const PROFILE_EOSE_GRACE = 1_500          // 1.5s grace for profile batch
export const PROFILE_BATCH_SIZE = 50
export const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h
export const PROFILE_CACHE_MAX = 2_000           // max entries
export const PROFILE_CACHE_EVICT = 200           // evict this many when full

// ── Event cache (relay manager) ──
export const EVENT_CACHE_TTL = 60_000            // 1min
export const EVENT_CACHE_MAX = 500               // max entries
export const EVENT_CACHE_EVICT = 100             // evict this many when full

// ── App loading ──
export const APP_HARD_TIMEOUT = 15_000           // 15s max loading screen
export const RELAY_READY_TIMEOUT = 5_000         // 5s wait for ready() in login/boot

// ── Refresh cycle ──
export const REFRESH_CYCLE_INTERVAL = 120_000    // 2min between cycles
export const REFRESH_WARMUP_DELAY = 30_000       // 30s warmup before first cycle
export const REFRESH_STAGGER_DELAY = 5_000       // 5s between callbacks

// ── Content zaps ──
export const CONTENT_ZAP_CHUNK_SIZE = 50         // max event IDs per filter
export const CONTENT_ZAP_RESUBSCRIBE_DEBOUNCE = 1_000
export const TRACKED_EVENT_IDS_MAX = 500         // max tracked event IDs

// ── Notes ──
export const NOTES_FETCH_TIMEOUT = 15_000        // 15s force-reset loading
export const NOTES_CLEANUP_INTERVAL = 30_000     // 30s duplicate cleanup

// ── Publish ──
export const PUBLISH_TIMEOUT = 10_000            // 10s publish timeout

// ── Outbox model (NIP-65) ──
export const OUTBOX_RELAY_LIST_TTL = 30 * 60 * 1000  // 30min cache for relay lists
export const OUTBOX_MAX_RELAYS_PER_PUBKEY = 5         // max relays to use per user for outbox
export const RELAY_INFO_TTL = 60 * 60 * 1000          // 1h cache for NIP-11 relay info

// ── Default relay list (single source of truth) ──
export const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://cache1.primal.net',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://nostr-01.yakihonne.com'
]

const READ_ONLY_RELAYS = new Set([
  'wss://cache1.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr-01.yakihonne.com'
])

// Relay configs with read/write flags (used by relay manager)
export const DEFAULT_RELAY_CONFIGS = DEFAULT_RELAY_URLS.map(url => ({
  url,
  read: true,
  write: !READ_ONLY_RELAYS.has(url)
}))

// Relay configs with status (used by useNostrAuth UI)
export const DEFAULT_RELAY_CONFIGS_WITH_STATUS = DEFAULT_RELAY_URLS.map(url => ({
  url,
  status: 'disconnected',
  read: true,
  write: !READ_ONLY_RELAYS.has(url)
}))

// ── Subscription concurrency ──
export const MAX_CONCURRENT_SUBS = 20

// ── Chart theme colors ──
// Orange brand palette (Tailwind orange-*)
export const CHART_COLORS = {
  // Primary brand
  primary: '#f97316',        // orange-500
  primaryLight: '#fb923c',   // orange-400
  primaryLighter: '#fdba74', // orange-300
  primaryPale: '#fed7aa',    // orange-200
  primaryFaint: '#fff7ed',   // orange-50

  // Accent / category colors
  green: '#34d399',          // emerald-400
  emerald: '#10b981',        // emerald-500
  blue: '#60a5fa',           // blue-400
  pink: '#f472b6',           // pink-400
  purple: '#a78bfa',         // violet-400

  // Text & axes
  titleText: '#7c2d12',      // orange-900
  axisLabel: '#9a3412',      // orange-800
  tooltipText: '#374151',    // gray-700
  axisLabelGray: '#9ca3af',  // gray-400

  // Lines & backgrounds
  splitLine: '#f3f4f6',      // gray-100
  axisLine: '#fed7aa',       // orange-200 (same as primaryPale)
  emptyBar: '#e5e7eb',       // gray-200
  white: '#ffffff',
}

// Reusable ECharts tooltip style
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.white,
  borderColor: CHART_COLORS.primary,
  borderWidth: 1,
  textStyle: { color: CHART_COLORS.tooltipText, fontSize: 12 },
}

// Reusable area gradient for orange line charts
// ── Storage keys (single source of truth for localStorage keys) ──
export const STORAGE_KEYS = {
  // Auth
  USER: 'nostrUser',
  RELAYS: 'nostrRelays',
  SIGNER_TYPE: 'nostr_signer_type',
  REMOTE_URI: 'nostr_remote_uri',

  // Wallet / NWC
  CONNECTIONS: 'nostr_connections',
  ACTIVE_CONNECTION: 'active_connection_id',
  NWC_URL: 'nwc_url',

  // Notifications
  NOTIFICATION_SETTINGS: 'notification_settings',
  LAST_TX_TIMESTAMP: 'last_transaction_timestamp',
  LAST_BALANCE: 'last_balance',
  PROCESSED_TX: 'processed_transactions',
  NOTIFICATIONS_LIST: 'notifications_list',

  // Content
  CONTENT_ITEMS: 'user_content_items',

  // Campaigns (preserved across logout)
  CAMPAIGNS: 'user_campaigns',
  CAMPAIGN_ZAPS: 'campaign_aggregated_zaps',

  // Follow lists (preserved across logout)
  FOLLOW_LISTS_MY: 'follow_lists_my',
  FOLLOW_LISTS_DISCOVERED: 'follow_lists_discovered',
  FOLLOW_LISTS_PROFILES: 'follow_lists_profiles',

  // UI state
  WELCOME_SEEN: 'zaptracker_welcome_seen',
  BTC_PRICE: 'btcPriceData',
  PWA_DISMISSED: 'pwa_install_dismissed',
}

export function chartAreaGradient(opacity1 = 0.3, opacity2 = 0.02) {
  return {
    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(249, 115, 22, ${opacity1})` },
      { offset: 1, color: `rgba(249, 115, 22, ${opacity2})` },
    ],
  }
}
