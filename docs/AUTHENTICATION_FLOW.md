# ZapTracker Authentication Flow Documentation

## Overview
This document describes the complete authentication flow for ZapTracker, based on proven working implementation. The system uses nostr-login for Nostr identity authentication and manages relay connections through a centralized relay manager.

## Authentication Sequence

### 1. Initial Page Load
```
Page Load
  └─> index.html loads
      ├─> nostr-login script loads from CDN (unpkg)
      │   └─> Sets up window.nostr provider (if extension present)
      ├─> Vue app mounts (src/main.js)
      └─> App.vue onMounted executes
```

### 2. Component Initialization Order
```
App.vue onMounted
  ├─> Check nostr-login availability
  │   ├─> Verify script in DOM
  │   ├─> Check window.nostr availability
  │   └─> Log authentication status
  │
  ├─> Initialize relay manager
  │   ├─> nostrRelayManager.initialize()
  │   ├─> Connect to 7 default relays
  │   ├─> Start health check (every 30s)
  │   └─> Emit 'initialized' event
  │
  └─> Check wallet connection status
      ├─> If no wallet: Show connection modal
      └─> If wallet exists: Refresh data

useNostrAuth composable (in multiple components)
  ├─> Load user from localStorage
  ├─> Load relays from localStorage
  ├─> Initialize relay manager (if not already initialized)
  └─> Start user event listener (if authenticated)
```

### 3. Authentication Flow (User Clicks "Connect Nostr")

```
User Action: Click "Connect Nostr" button
  │
  ├─> useNostrAuth.login() called
  │   ├─> Check if already authenticated
  │   │   └─> If yes: Return current user
  │   │
  │   ├─> Check nostr-login availability
  │   │   └─> Verify script is loaded
  │   │
  │   ├─> Set up nlAuth event listener
  │   │   └─> document.addEventListener('nlAuth', handleAuth)
  │   │
  │   └─> Dispatch nlLaunch event
  │       └─> document.dispatchEvent(new Event('nlLaunch'))
  │
  ├─> Nostr-login Modal Appears
  │   ├─> User selects authentication method
  │   │   ├─> Browser extension
  │   │   ├─> nsec.app bunker
  │   │   ├─> Amber (mobile)
  │   │   └─> Local nsec
  │   │
  │   └─> User completes authentication
  │       └─> Nostr-login fires 'nlAuth' event
  │
  └─> handleAuth function executes
      ├─> Retrieve pubkey from window.nostr.getPublicKey()
      │   └─> Log: "Got pubkey from nostr: f6150173..."
      │
      ├─> Check for existing user in localStorage
      │   ├─> If same pubkey: Use stored data
      │   └─> If different/missing: Fetch new profile
      │
      ├─> Fetch user profile (if needed)
      │   ├─> Use centralized profileFetcher
      │   ├─> Query relay manager for kind 0 events
      │   └─> Create user data object with profile
      │
      ├─> Save user to localStorage
      │   └─> Key: 'nostrUser'
      │
      ├─> Start user event listener
      │   ├─> Subscribe to kinds [1, 6, 7] by author
      │   ├─> Subscribe to events mentioning user (#p)
      │   └─> Emit custom 'nostr:event' on document
      │
      ├─> Clean up event listener
      │   └─> document.removeEventListener('nlAuth', handleAuth)
      │
      └─> Resolve promise with userData
          └─> Log: "Authentication completed successfully!"
```

### 4. Post-Authentication Data Loading

```
Authentication Success
  │
  ├─> App.vue receives success event
  │   ├─> Close connection modal
  │   ├─> Trigger data refresh
  │   └─> Initialize content tracking
  │
  ├─> Initialize content zap tracking
  │   ├─> useContentZaps.initializeZapTracking()
  │   └─> Subscribe to zap events (kind 9735)
  │
  ├─> Fetch user notes
  │   ├─> useNostrNotes.fetchUserNotes()
  │   └─> Subscribe to kind 1 events
  │
  └─> Fetch long-form content
      ├─> useNostrLongForm.fetchUserLongFormContent()
      └─> Subscribe to kind 30023 events
```

## Critical Timing Dependencies

### 1. Nostr-login Script Loading
- **Must load before**: App attempts authentication
- **Load method**: CDN script tag with onload/onerror callbacks
- **Verification**: Check for script element in DOM and window.nostr availability
- **Timeout**: None (waits indefinitely for user to complete auth)

### 2. Relay Manager Initialization
- **Must initialize before**: Any Nostr queries or subscriptions
- **Single initialization**: Uses isInitialized flag to prevent duplicates
- **Connection timing**: Attempts connection to 7 relays with 10s timeout each
- **Retry logic**: Up to 3 retries with 2s delay between attempts

### 3. Authentication State Restoration
- **On page load**: Automatically loads from localStorage
- **Persistence keys**:
  - `nostrUser`: User profile and pubkey
  - `nostrRelays`: Relay configuration
  - `active_connection_id`: Active NWC wallet connection
- **Auto-reconnect**: Attempts to reconnect on page refresh

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Page Load & Script Initialization                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ├──> nostr-login CDN loads
                           │    └──> window.nostr available
                           │
                           ├──> Vue app mounts
                           │    └──> App.vue onMounted
                           │
                           └──> useNostrAuth initializes
                                ├──> Load from localStorage
                                └──> Init relay manager

┌─────────────────────────────────────────────────────────────┐
│ User Authentication Flow                                     │
└─────────────────────────────────────────────────────────────┘
                           │
    User clicks "Connect Nostr"
                           │
                           ├──> login() called
                           │    └──> document.addEventListener('nlAuth')
                           │
                           ├──> document.dispatchEvent('nlLaunch')
                           │    └──> Nostr-login modal opens
                           │
                    [User authenticates]
                           │
                           ├──> Nostr-login fires 'nlAuth' event
                           │    └──> handleAuth() executes
                           │
                           ├──> window.nostr.getPublicKey()
                           │    └──> Retrieve pubkey
                           │
                           ├──> Fetch profile (if needed)
                           │    ├──> Query relays for kind 0
                           │    └──> Parse metadata
                           │
                           ├──> Save to localStorage
                           │    └──> Key: 'nostrUser'
                           │
                           ├──> startUserEventListener()
                           │    └──> Subscribe to user events
                           │
                           └──> Authentication complete!

┌─────────────────────────────────────────────────────────────┐
│ Post-Authentication Data Flow                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ├──> Initialize zap tracking
                           │    └──> Subscribe to kind 9735
                           │
                           ├──> Fetch user notes
                           │    └──> Subscribe to kind 1
                           │
                           ├──> Fetch long-form content
                           │    └──> Subscribe to kind 30023
                           │
                           └──> Refresh wallet data (if connected)
                                └──> Load NWC transactions
```

## Relay Connection Flow

```
Relay Manager Initialization
  │
  ├─> Merge user relays with defaults
  │   └─> 7 default relays configured
  │
  ├─> Connect to each relay (parallel)
  │   ├─> pool.ensureRelay(url)
  │   ├─> 10s timeout per connection
  │   ├─> Retry up to 3 times (2s delay)
  │   └─> Log success/failure
  │
  ├─> Start health check timer (30s interval)
  │   ├─> Test each relay with simple query
  │   ├─> Mark as healthy/unhealthy
  │   └─> Auto-reconnect failed relays
  │
  └─> Emit 'initialized' event
      └─> App can now use relays
```

## Storage Keys Reference

### Authentication
- `nostrUser`: Complete user object (pubkey, npub, profile, lastUpdated)
- `nostrRelays`: Array of relay configurations with status

### Wallet Connection
- `nostr_connections`: Array of NWC wallet connections
- `active_connection_id`: ID of currently active wallet
- `nwc_url`: Legacy key (migrated to connections array)

### Preserved Across Logout
- `nostrRelays`: Relay configurations persist
- `user_campaigns`: Campaign data (in Nostr relays)
- `follow_lists_my`: User's follow packs
- `follow_lists_discovered`: Discovered follow packs

### Cleared on Logout
- `nostrUser`: Authentication data
- `nostr_connections`: Wallet connections
- `notification_settings`: Notification preferences
- `user_content_items`: Content data

## Error Handling

### Connection Failures
- **Timeout**: 10s per relay connection attempt
- **Retry**: Up to 3 attempts with exponential backoff
- **Fallback**: Continue with successfully connected relays
- **User feedback**: Display connection errors with retry option

### Authentication Failures
- **Timeout**: 5 minutes for user to complete authentication
- **Cancel**: User closes modal without completing auth
- **Extension missing**: Fallback to nostr-login modal methods
- **Profile fetch failure**: Use minimal user data with fallback avatar

### Data Loading Failures
- **Network errors**: Retry with exponential backoff
- **Relay failures**: Mark relay as unhealthy and reconnect
- **Partial data**: Display what's available, retry failed queries
- **Progress tracking**: Show loading progress for large datasets

## Best Practices

### For Developers
1. **Always check relay manager initialization** before making Nostr queries
2. **Use centralized profileFetcher** for consistent profile fetching
3. **Subscribe through relay manager** to benefit from connection pooling
4. **Handle authentication state changes** with watchers, not polling
5. **Clean up event listeners** to prevent memory leaks
6. **Provide user feedback** during long-running operations
7. **Test with network throttling** to ensure proper timeout handling

### For Users
1. **Be patient during authentication** - the modal may take a moment to load
2. **Check popup blockers** if the login modal doesn't appear
3. **Use browser extension** for fastest authentication experience
4. **Allow time for large datasets** - initial load may take longer
5. **Refresh page if stuck** - auto-reconnect will restore your session

## Debugging Tips

### Enable Debug Logging
All authentication flow steps are logged with emoji prefixes:
- 🚀 = Initialization
- 🔍 = Checking/verifying
- ✅ = Success
- ❌ = Error
- 🔌 = Connection activity
- 💓 = Health check
- 📊 = Statistics/summary

### Console Checks
```javascript
// Check if nostr-login is loaded
!!document.querySelector('script[src*="nostr-login"]')

// Check if window.nostr is available
!!window.nostr

// Check authentication status
!!localStorage.getItem('nostrUser')

// Check relay manager
nostrRelayManager.getConnectionStats()

// Force relay health check
nostrRelayManager.performHealthCheck()
```

### Common Issues

**Issue**: Login modal doesn't appear
- Check: Popup blocker enabled
- Check: Nostr-login script loaded successfully
- Solution: Refresh page or disable popup blocker

**Issue**: Stuck on "Connecting to relays"
- Check: Network connectivity
- Check: Firewall blocking WebSocket connections
- Solution: Wait for timeout, retry with working relays

**Issue**: Profile not loading
- Check: Relays connected successfully
- Check: Pubkey is valid
- Solution: Refresh user profile or reconnect

**Issue**: Authentication timeout
- Cause: User took too long or closed modal
- Solution: Click "Connect Nostr" again to restart

## Performance Considerations

### Profile Fetching Optimization
- **Batch fetching**: Load 10 profiles at a time
- **Caching**: Store fetched profiles in memory
- **Deduplication**: Avoid re-fetching same profile
- **Progress tracking**: Show loading progress for UX

### Relay Connection Pooling
- **Single pool instance**: All components share one pool
- **Connection reuse**: Don't reconnect for each query
- **Health monitoring**: Proactively reconnect failed relays
- **Backoff strategy**: Rate-limit retry attempts

### Data Loading Strategy
- **Progressive loading**: Show data as it arrives
- **Pagination**: Load notes/content in chunks
- **Lazy loading**: Defer non-critical data
- **Offline support**: Cache data in localStorage

## Security Considerations

### Private Key Handling
- **Never stored**: Private keys never touch localStorage
- **Extension only**: Signing delegated to browser extension or bunker
- **Event signing**: Always use window.nostr.signEvent()
- **Verification**: Verify event signatures before accepting

### Connection Security
- **WSS only**: All relay connections use secure WebSocket
- **NWC URLs**: Stored encrypted in localStorage (by NWC client)
- **CORS**: Proper handling for cross-origin requests
- **XSS protection**: Sanitize all user-generated content

---

**Last Updated**: 2025-10-26
**Version**: 1.0
**Maintainers**: ZapTracker Team
