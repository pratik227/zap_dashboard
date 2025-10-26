# LocalStorage Management Guide

## Overview
This document describes the localStorage key structure, data persistence strategy, and cleanup policies for ZapTracker.

## Storage Keys Reference

### Authentication & Identity

#### `nostrUser` (Cleared on Logout)
Stores the current authenticated user's complete profile data.

**Structure:**
```javascript
{
  pubkey: string,           // Hex-encoded public key
  npub: string,             // Bech32-encoded npub
  profile: {
    name: string,
    display_name: string,
    about: string,
    picture: string,
    nip05: string,
    lud16: string,          // Lightning address
    lud06: string,          // LNURL
    website: string,
    banner: string
  },
  lastUpdated: string,      // ISO timestamp
  profileEvent: object,     // Original kind 0 event
  needsRefresh: boolean     // Flag for stale data (>7 days)
}
```

**Validation:**
- Must have `pubkey`, `npub`, and `profile` fields
- Data older than 7 days is flagged for refresh but still loaded
- Corrupted data is automatically cleared

**When to Refresh:**
- On login if data is older than 7 days
- When user explicitly triggers profile refresh
- After profile update event is published

---

#### `nostrRelays` (Preserved on Logout)
Stores relay configuration and connection status.

**Structure:**
```javascript
[
  {
    url: string,              // WebSocket URL (wss://...)
    status: string,           // 'connected' | 'connecting' | 'failed' | 'unhealthy'
    read: boolean,            // Can read events from this relay
    write: boolean,           // Can publish events to this relay
    error: string | null,     // Last error message
    lastUpdated: string,      // ISO timestamp
    lastConnected: string     // ISO timestamp of last successful connection
  },
  // ... more relays
]
```

**Why Preserved:**
- User's relay preferences are part of their identity
- Should persist across login sessions
- Reduces setup friction for returning users

**Default Relays:**
```javascript
[
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.snort.social', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://nostr.wine', read: true, write: true },
  { url: 'wss://relay.nostr.band', read: true, write: false },
  { url: 'wss://nostr-01.yakihonne.com', read: true, write: false }
]
```

---

### Wallet Connections

#### `nostr_connections` (Cleared on Logout)
Array of saved NWC (Nostr Wallet Connect) wallet connections.

**Structure:**
```javascript
[
  {
    id: string,                 // Unique identifier
    name: string,               // Display name
    nwcUrl: string,             // nostr+walletconnect://...
    isActive: boolean,          // Currently active connection
    isDefault: boolean,         // User's default wallet
    createdAt: string,          // ISO timestamp
    lastUsed: string | null     // ISO timestamp
  },
  // ... more connections
]
```

**Security Note:**
- NWC URLs contain sensitive connection strings
- Should be cleared on logout for security
- Re-connection required after login

---

#### `active_connection_id` (Cleared on Logout)
Stores the ID of the currently active wallet connection.

**Type:** `string`

**Usage:**
- Used to restore active connection on page refresh
- Cleared on logout for security
- Automatically set when switching wallets

---

#### `nwc_url` (Legacy - Migrated on First Load)
Old storage format for NWC connection.

**Migration:**
```javascript
// Automatically migrated to connections array format
const legacyUrl = localStorage.getItem('nwc_url')
if (legacyUrl) {
  addConnection('Migrated Wallet', legacyUrl)
  localStorage.removeItem('nwc_url')
}
```

---

### User Content & Campaigns

#### `user_campaigns` (Preserved on Logout)
Stores user-created campaigns.

**Why Preserved:**
- Campaign data is published to Nostr relays
- Local copy serves as cache and backup
- Should be available immediately after re-login

**Structure:**
```javascript
{
  [campaignId]: {
    id: string,
    title: string,
    description: string,
    goal: number,
    raised: number,
    createdAt: string,
    eventId: string,        // Nostr event ID
    // ... more campaign data
  }
}
```

---

#### `campaign_aggregated_zaps` (Preserved on Logout)
Cached zap data for campaigns.

**Why Preserved:**
- Expensive to recalculate from scratch
- Historical data that doesn't change
- Improves load time for campaign views

---

#### `user_content_items` (Cleared on Logout)
Content drafts and published items.

**Why Cleared:**
- May contain sensitive unpublished content
- Fresh fetch ensures latest state
- Relatively quick to reload

---

### Follow Lists & Social Graph

#### `follow_lists_my` (Preserved on Logout)
User's created follow packs (NIP-51 lists).

**Why Preserved:**
- User's curated lists are valuable data
- Published to Nostr but cached locally
- Should be immediately available

**Structure:**
```javascript
{
  [listId]: {
    id: string,
    name: string,
    description: string,
    pubkeys: string[],
    eventId: string,
    createdAt: string,
    lastModified: string
  }
}
```

---

#### `follow_lists_discovered` (Preserved on Logout)
Follow packs discovered from other users.

**Why Preserved:**
- Improves discovery experience
- Reduces relay queries on reload
- Not sensitive data

---

#### `follow_lists_profiles` (Preserved on Logout)
Cached profile data for follow pack members.

**Why Preserved:**
- Expensive to refetch all profiles
- Improves UI responsiveness
- Profiles don't change frequently

**Cache Strategy:**
- Profiles older than 7 days flagged for refresh
- Lazy refresh: fetch on next view
- Background refresh for active lists

---

### Notifications & Settings

#### `notification_settings` (Cleared on Logout)
User's notification preferences.

**Why Cleared:**
- User-specific preferences
- Reset to defaults on new login
- Relatively simple to reconfigure

**Structure:**
```javascript
{
  enabled: boolean,
  sound: boolean,
  desktop: boolean,
  types: {
    zap_received: boolean,
    payment_success: boolean,
    payment_error: boolean,
    mention: boolean,
    reply: boolean
  }
}
```

---

#### `notifications_list` (Cleared on Logout)
Array of notification objects.

**Why Cleared:**
- Real-time data that should be fresh
- Can be regenerated from events
- Not critical for app function

---

#### `last_transaction_timestamp` (Cleared on Logout)
Timestamp of most recent transaction.

**Type:** `number` (Unix timestamp)

**Usage:**
- Determines if new notifications should fire
- Reset on logout ensures clean slate

---

#### `last_balance` (Cleared on Logout)
Last known wallet balance.

**Type:** `number` (sats)

**Usage:**
- Detect balance changes for notifications
- Not sensitive but should be fresh

---

#### `processed_transactions` (Cleared on Logout)
Set of processed transaction IDs to prevent duplicates.

**Type:** `Array<string>`

**Usage:**
- Deduplication for incoming transactions
- Should be regenerated fresh on login

---

## Data Lifecycle

### On App Load
```javascript
1. Load preserved data (relays, campaigns, follow lists)
2. Initialize with default values if missing
3. Validate data structure and repair if corrupted
4. Set up auto-save watchers
```

### On Login
```javascript
1. Load user from localStorage
2. Validate user data structure
3. Check if data is stale (>7 days)
4. If stale, fetch fresh profile in background
5. Start event listeners for real-time updates
```

### On Logout
```javascript
// PRESERVED across sessions
const preservedKeys = [
  'nostrRelays',
  'user_campaigns',
  'campaign_aggregated_zaps',
  'follow_lists_my',
  'follow_lists_discovered',
  'follow_lists_profiles'
]

// CLEARED for security/freshness
const clearedKeys = [
  'nostrUser',
  'nostr_connections',
  'active_connection_id',
  'nwc_url',
  'notification_settings',
  'last_transaction_timestamp',
  'last_balance',
  'processed_transactions',
  'notifications_list',
  'user_content_items'
]

// Execute cleanup
clearedKeys.forEach(key => localStorage.removeItem(key))
```

### On Page Refresh
```javascript
1. Restore authenticated user if exists
2. Restore active wallet connection if exists
3. Reconnect to relays
4. Resume event subscriptions
5. Restore UI state (current page, filters, etc.)
```

---

## Storage Limits & Optimization

### Browser Limits
- **Typical limit:** 5-10 MB per origin
- **ZapTracker target:** <2 MB for normal use
- **Large dataset warning:** >5 MB

### Optimization Strategies

#### 1. Profile Caching
```javascript
// Don't store full event data
{
  pubkey: string,
  name: string,
  picture: string,
  // ... only essential fields
  // NO: full event, signatures, etc.
}
```

#### 2. Event Deduplication
```javascript
// Store event IDs only, not full events
processedEventIds: string[]  // Instead of event objects
```

#### 3. Periodic Cleanup
```javascript
// Remove stale data older than 30 days
function cleanupStaleData() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

  // Clean profile cache
  Object.keys(profileCache).forEach(key => {
    if (profileCache[key].lastFetched < thirtyDaysAgo) {
      delete profileCache[key]
    }
  })

  // Save cleaned cache
  saveToLocalStorage('follow_lists_profiles', profileCache)
}
```

#### 4. Compression for Large Datasets
```javascript
// For very large follow lists or campaigns
function compressData(data) {
  const json = JSON.stringify(data)
  // Use LZ-string or similar for compression
  return compress(json)
}
```

---

## Data Migration Strategy

### Version Tracking
```javascript
// Track schema version for migrations
localStorage.setItem('schema_version', '2.0')

// Migration logic
const version = localStorage.getItem('schema_version')
if (version === '1.0') {
  migrateFromV1ToV2()
  localStorage.setItem('schema_version', '2.0')
}
```

### Example Migration
```javascript
function migrateFromV1ToV2() {
  // Migrate old nwc_url to connections array
  const oldUrl = localStorage.getItem('nwc_url')
  if (oldUrl) {
    const connections = [{
      id: generateId(),
      name: 'Migrated Wallet',
      nwcUrl: oldUrl,
      isDefault: true,
      createdAt: new Date().toISOString()
    }]
    localStorage.setItem('nostr_connections', JSON.stringify(connections))
    localStorage.removeItem('nwc_url')
  }

  // Migrate old relay format
  const oldRelays = localStorage.getItem('userRelays')
  if (oldRelays) {
    const parsed = JSON.parse(oldRelays)
    const newFormat = parsed.map(relay => ({
      url: relay.url || relay,
      status: 'disconnected',
      read: true,
      write: true
    }))
    localStorage.setItem('nostrRelays', JSON.stringify(newFormat))
    localStorage.removeItem('userRelays')
  }
}
```

---

## Security Considerations

### Sensitive Data
1. **Never store private keys** - Use browser extensions or bunkers
2. **NWC URLs** - Cleared on logout, contains connection secrets
3. **Profile data** - Generally public but validate on load
4. **Transaction data** - Cleared on logout for privacy

### XSS Protection
```javascript
// Always sanitize data read from localStorage
function sanitizeHtml(html) {
  const div = document.createElement('div')
  div.textContent = html
  return div.innerHTML
}

// Use when rendering user content
const sanitizedContent = sanitizeHtml(profile.about)
```

### Data Validation
```javascript
function validateUserData(data) {
  if (!data || typeof data !== 'object') return false
  if (!data.pubkey || typeof data.pubkey !== 'string') return false
  if (!data.npub || !data.npub.startsWith('npub1')) return false
  if (!data.profile || typeof data.profile !== 'object') return false
  return true
}

// Use on load
const stored = localStorage.getItem('nostrUser')
if (stored) {
  const parsed = JSON.parse(stored)
  if (validateUserData(parsed)) {
    currentUser.value = parsed
  } else {
    localStorage.removeItem('nostrUser')
  }
}
```

---

## Debugging Tools

### Inspect Storage
```javascript
// In browser console
Object.keys(localStorage).forEach(key => {
  const value = localStorage.getItem(key)
  console.log(key, ':', value.length, 'chars')
})
```

### Clear Specific Keys
```javascript
// Clear auth data only
localStorage.removeItem('nostrUser')
localStorage.removeItem('nostr_connections')

// Clear all ZapTracker data
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('nostr') || key.includes('user_') || key.includes('campaign')) {
    localStorage.removeItem(key)
  }
})
```

### Export Data
```javascript
function exportLocalStorageData() {
  const data = {}
  Object.keys(localStorage).forEach(key => {
    try {
      data[key] = JSON.parse(localStorage.getItem(key))
    } catch {
      data[key] = localStorage.getItem(key)
    }
  })
  return JSON.stringify(data, null, 2)
}

// Copy to clipboard
copy(exportLocalStorageData())
```

---

## Best Practices

### For Developers

1. **Always validate on load** - Don't trust localStorage data
2. **Use typed keys** - Define constants for all storage keys
3. **Implement migrations** - Support schema changes gracefully
4. **Monitor storage size** - Warn users if approaching limits
5. **Clean up on unmount** - Don't leave orphaned data
6. **Use watchers sparingly** - Too many watchers slow down saves
7. **Batch updates** - Use `nextTick()` to batch multiple saves

### For Users

1. **Don't share localStorage** - Contains authentication tokens
2. **Regular cleanup** - Use account reset if experiencing issues
3. **Backup campaigns** - Export important campaign data
4. **Clear browser data carefully** - Will log you out

---

## Performance Tips

### Lazy Loading
```javascript
// Don't load everything on startup
onMounted(() => {
  // Load only what's needed for current page
  if (currentPage === 'campaigns') {
    loadCampaigns()
  }
})
```

### Debounced Saves
```javascript
// Don't save on every keystroke
const debouncedSave = debounce(() => {
  localStorage.setItem(key, JSON.stringify(data))
}, 500)

watch(data, debouncedSave, { deep: true })
```

### Indexed Access
```javascript
// Use Maps for frequent lookups
const profileMap = new Map(JSON.parse(localStorage.getItem('profiles')))

// Faster than array.find()
const profile = profileMap.get(pubkey)
```

---

**Last Updated**: 2025-10-26
**Version**: 2.0
**Maintainers**: ZapTracker Team
