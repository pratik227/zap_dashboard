# ZapTracker Authentication - Quick Reference

## Developer Quick Start

### Check Authentication Status
```javascript
import { useNostrAuth } from '@/composables/useNostrAuth'

const { isAuthenticated, currentUser } = useNostrAuth()

// Check if user is logged in
if (isAuthenticated.value) {
  console.log('User:', currentUser.value.npub)
}
```

### Trigger Login
```javascript
const { login, isLoading, authError } = useNostrAuth()

try {
  await login()
  console.log('Login successful!')
} catch (error) {
  console.error('Login failed:', authError.value)
}
```

### Query Nostr Events
```javascript
import { nostrRelayManager } from '@/utils/nostrRelayManager'

// Subscribe to events
const sub = nostrRelayManager.subscribeToEvents([
  {
    kinds: [1], // Notes
    authors: [pubkey],
    limit: 20
  }
], {
  onevent: (event) => {
    console.log('Received event:', event)
  }
})

// Get single event
const event = await nostrRelayManager.getEvent({
  kinds: [0],
  authors: [pubkey]
})
```

### Publish to Nostr
```javascript
import { nostrRelayManager } from '@/utils/nostrRelayManager'
import { finalizeEvent } from 'nostr-tools/pure'

// Create and sign event (requires window.nostr)
const event = await window.nostr.signEvent({
  kind: 1,
  content: 'Hello Nostr!',
  tags: [],
  created_at: Math.floor(Date.now() / 1000)
})

// Publish to relays
const result = await nostrRelayManager.publishEvent(event)
console.log(`Published to ${result.successful} relays`)
```

## Common Patterns

### Fetch User Profile
```javascript
import { fetchProfile } from '@/utils/profileFetcher'

const profile = await fetchProfile(pubkey)
console.log('Name:', profile.name)
console.log('Picture:', profile.picture)
```

### Check Wallet Connection
```javascript
import { useNostrConnections } from '@/composables/useNostrConnections'

const { isWalletConnected, activeConnection } = useNostrConnections()

if (isWalletConnected.value) {
  console.log('Wallet:', activeConnection.value.name)
}
```

### Load Zap Data
```javascript
import { useNostrConnections } from '@/composables/useNostrConnections'

const { loadZapData } = useNostrConnections()

const zaps = await loadZapData()
console.log('Received', zaps.length, 'zaps')
```

## Console Commands

### Authentication
```javascript
// Check if logged in
!!localStorage.getItem('nostrUser')

// Get current user
JSON.parse(localStorage.getItem('nostrUser'))

// Force logout
localStorage.removeItem('nostrUser')
window.location.reload()
```

### Relay Management
```javascript
// Check relay status
nostrRelayManager.getConnectionStats()

// Get connected relays
nostrRelayManager.getConnectedRelays()

// Force health check
nostrRelayManager.performHealthCheck()

// Add relay
nostrRelayManager.addRelay('wss://relay.example.com')

// Remove relay
nostrRelayManager.removeRelay('wss://relay.example.com')
```

### Profile Cache
```javascript
// Check cache size
profileStore.value.size

// Clear cache
profileStore.value.clear()

// Get specific profile
profileStore.value.get(pubkey)
```

### Storage Management
```javascript
// List all keys
Object.keys(localStorage)

// Check storage size
let total = 0
Object.keys(localStorage).forEach(key => {
  total += localStorage.getItem(key).length
})
console.log('Total size:', Math.round(total / 1024), 'KB')

// Export data
const backup = {}
Object.keys(localStorage).forEach(key => {
  backup[key] = localStorage.getItem(key)
})
copy(JSON.stringify(backup))
```

## Debugging

### Enable Debug Logs
```javascript
localStorage.setItem('debug', 'nostr:*')
// Reload page
```

### Check nostr-login
```javascript
// Verify script loaded
!!document.querySelector('script[src*="nostr-login"]')

// Check window.nostr
!!window.nostr

// Test nostr provider
await window.nostr.getPublicKey()
```

### Monitor Performance
```javascript
// Profile loading time
console.time('profiles')
await fetchProfilesInBatches(pubkeys)
console.timeEnd('profiles')

// Relay connection time
console.time('relays')
await nostrRelayManager.initialize()
console.timeEnd('relays')
```

## Error Handling

### Common Error Codes
```javascript
// Authentication timeout
'Authentication timed out. Please try again.'

// Extension missing
'Failed to get public key. Please check your Nostr extension.'

// Network timeout
'Connection timed out. Please check your internet connection.'

// Relay failure
'Relay connection failed. Some features may be limited.'

// Corrupted data
'Invalid user data in storage, clearing...'
```

### Recovery Actions
```javascript
// Clear corrupted auth data
localStorage.removeItem('nostrUser')

// Reset to default relays
localStorage.removeItem('nostrRelays')

// Full reset (preserves campaigns)
const preserve = ['user_campaigns', 'follow_lists_my']
Object.keys(localStorage).forEach(key => {
  if (!preserve.includes(key)) {
    localStorage.removeItem(key)
  }
})
```

## Best Practices

### ✅ Do
- Always check `isAuthenticated` before Nostr operations
- Use relay manager for all Nostr queries
- Implement loading states for async operations
- Handle errors gracefully with user feedback
- Clean up subscriptions on unmount
- Use centralized profile fetcher
- Batch profile fetches for better performance

### ❌ Don't
- Don't call `login()` if already authenticated
- Don't create multiple relay manager instances
- Don't store private keys in localStorage
- Don't query relays directly without manager
- Don't forget to close subscriptions
- Don't fetch profiles one by one
- Don't ignore error messages

## Performance Tips

### Profile Loading
```javascript
// Bad: One at a time
for (const pubkey of pubkeys) {
  await fetchProfile(pubkey)
}

// Good: Batched
await fetchProfilesInBatches(pubkeys, 10)
```

### Event Subscriptions
```javascript
// Bad: Multiple subscriptions
pubkeys.forEach(pubkey => {
  nostrRelayManager.subscribeToEvents([{ authors: [pubkey] }])
})

// Good: Single subscription
nostrRelayManager.subscribeToEvents([{
  authors: pubkeys
}])
```

### Relay Queries
```javascript
// Use getEvent for single event
const event = await nostrRelayManager.getEvent(filter)

// Use subscribeToEvents for multiple/streaming
const sub = nostrRelayManager.subscribeToEvents(filters, callbacks)
```

## Testing

### Manual Test Checklist
- [ ] Fresh login with extension
- [ ] Login with bunker
- [ ] Return user auto-login
- [ ] Logout and re-login
- [ ] Profile loading with large dataset
- [ ] Relay connection failures
- [ ] Network disconnection
- [ ] Page refresh while authenticated
- [ ] Multiple tabs open
- [ ] Browser console clear of errors

### Automated Tests
```javascript
// Example test structure
describe('Authentication', () => {
  it('should login successfully', async () => {
    const { login } = useNostrAuth()
    await login()
    expect(isAuthenticated.value).toBe(true)
  })

  it('should restore session', () => {
    localStorage.setItem('nostrUser', JSON.stringify(mockUser))
    const { isAuthenticated } = useNostrAuth()
    expect(isAuthenticated.value).toBe(true)
  })
})
```

## Troubleshooting Guide

### Login modal not appearing?
1. Check popup blocker
2. Verify nostr-login script loaded
3. Check browser console for errors
4. Refresh page and try again

### Relays not connecting?
1. Check network connectivity
2. Verify firewall allows WebSocket
3. Try default relays
4. Check relay health status

### Profile not loading?
1. Verify relays are connected
2. Check profile exists on relays
3. Clear profile cache
4. Try fetching directly

### Memory usage growing?
1. Check for unclosed subscriptions
2. Verify event listener cleanup
3. Clear profile cache periodically
4. Review active subscriptions

## Quick Links

- **Authentication Flow**: [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md)
- **Storage Management**: [LOCALSTORAGE_MANAGEMENT.md](./LOCALSTORAGE_MANAGEMENT.md)
- **Recent Improvements**: [AUTHENTICATION_IMPROVEMENTS.md](./AUTHENTICATION_IMPROVEMENTS.md)

---

**Last Updated**: 2025-10-26
**Version**: 1.0
