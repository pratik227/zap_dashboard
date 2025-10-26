# ZapTracker Documentation

Welcome to the ZapTracker technical documentation. This folder contains comprehensive guides for understanding and working with the authentication system.

## Documentation Structure

### 📚 Core Documentation

#### [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md)
Complete guide to the Nostr authentication flow in ZapTracker.

**What's Inside:**
- Authentication sequence diagrams
- Component initialization order
- Event flow with timing dependencies
- Relay connection management
- Storage keys reference
- Error handling strategies
- Performance considerations
- Security best practices
- Debugging tips

**Read this if you want to:**
- Understand how authentication works
- Debug authentication issues
- Optimize authentication performance
- Implement new auth features

---

#### [LOCALSTORAGE_MANAGEMENT.md](./LOCALSTORAGE_MANAGEMENT.md)
Complete reference for localStorage usage and data persistence.

**What's Inside:**
- All storage keys catalog
- Data persistence strategies
- Cleanup policies for logout
- Data lifecycle management
- Migration strategies
- Security considerations
- Performance optimization
- Debugging tools

**Read this if you want to:**
- Understand what data is stored
- Implement new storage features
- Debug storage issues
- Optimize storage usage
- Plan data migrations

---

#### [AUTHENTICATION_IMPROVEMENTS.md](./AUTHENTICATION_IMPROVEMENTS.md)
Summary of recent authentication system improvements.

**What's Inside:**
- All changes made to auth system
- Enhanced state persistence
- Improved error handling
- Optimized profile loading
- Better event listener management
- Performance improvements
- Testing results
- Migration guide

**Read this if you want to:**
- Understand recent changes
- See what was improved
- Learn about new features
- Review testing results
- Plan future improvements

---

#### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
Quick reference guide for common tasks and patterns.

**What's Inside:**
- Code snippets for common tasks
- Console commands for debugging
- Error handling patterns
- Performance tips
- Testing checklists
- Troubleshooting guide

**Read this if you want to:**
- Quick code examples
- Debug console commands
- Common patterns to copy
- Fast troubleshooting
- Testing checklists

---

## Quick Start

### For New Developers
1. Start with [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md) to understand the system
2. Review [LOCALSTORAGE_MANAGEMENT.md](./LOCALSTORAGE_MANAGEMENT.md) for data handling
3. Keep [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) handy for code examples

### For Debugging Issues
1. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for common issues
2. Use console commands from the quick reference
3. Review [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md) for detailed flow
4. Check [LOCALSTORAGE_MANAGEMENT.md](./LOCALSTORAGE_MANAGEMENT.md) for storage issues

### For Implementing Features
1. Review [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md) for best practices
2. Check [LOCALSTORAGE_MANAGEMENT.md](./LOCALSTORAGE_MANAGEMENT.md) for storage patterns
3. Follow patterns from [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
4. Review [AUTHENTICATION_IMPROVEMENTS.md](./AUTHENTICATION_IMPROVEMENTS.md) for recent changes

---

## Key Concepts

### Authentication Flow
```
User Login → nostr-login Modal → Get Pubkey → Fetch Profile → Start Listeners
```

### Relay Management
```
Initialize → Connect to Relays → Health Check → Auto-Reconnect
```

### Profile Loading
```
Check Cache → Batch Fetch Uncached → Progress Updates → Cache Results
```

### Data Persistence
```
Save to localStorage → Validate on Load → Clean Corrupted → Migrate Old Formats
```

---

## Common Tasks

### Check Authentication Status
```javascript
const { isAuthenticated, currentUser } = useNostrAuth()
console.log('Logged in:', isAuthenticated.value)
```

### Query Nostr Events
```javascript
const sub = nostrRelayManager.subscribeToEvents(filters, callbacks)
```

### Fetch User Profile
```javascript
const profile = await fetchProfile(pubkey)
```

### Publish Event
```javascript
const result = await nostrRelayManager.publishEvent(event)
```

---

## Debugging Tools

### Console Commands
```javascript
// Authentication status
!!localStorage.getItem('nostrUser')

// Relay status
nostrRelayManager.getConnectionStats()

// Profile cache
profileStore.value.size

// Storage size
Object.keys(localStorage).reduce((total, key) =>
  total + localStorage.getItem(key).length, 0
) / 1024 + ' KB'
```

### Enable Debug Mode
```javascript
localStorage.setItem('debug', 'nostr:*')
// Reload page for verbose logging
```

---

## Performance Metrics

### Target Metrics
- Authentication success rate: **>95%**
- Profile load time (100 profiles): **<3s**
- Relay connection rate: **>90%**
- Error rate: **<5%**
- Memory usage: **Stable over time**

### Current Optimizations
- ✅ Profile caching (up to 100% faster)
- ✅ Batch profile fetching
- ✅ Adaptive rate limiting
- ✅ Memory leak prevention
- ✅ Auto-recovery from failures

---

## Security Best Practices

### ✅ Do
- Validate all localStorage data on load
- Clean up event listeners on unmount
- Use centralized profile fetcher
- Implement proper error handling
- Clear sensitive data on logout

### ❌ Don't
- Store private keys in localStorage
- Query relays without manager
- Forget to close subscriptions
- Ignore data validation
- Trust localStorage blindly

---

## Testing Guidelines

### Manual Testing
- [ ] Fresh login with extension
- [ ] Login with bunker
- [ ] Return user auto-login
- [ ] Logout and re-login
- [ ] Profile loading performance
- [ ] Relay connection resilience
- [ ] Network disconnection recovery

### Automated Testing
```javascript
// Unit tests for composables
describe('useNostrAuth', () => {
  it('should login successfully')
  it('should restore session')
  it('should handle errors')
})

// Integration tests for flows
describe('Authentication Flow', () => {
  it('should complete full login')
  it('should reconnect on refresh')
})
```

---

## Maintenance Tasks

### Regular Checks
- Monitor error rates
- Check bundle size
- Review relay health
- Validate storage usage
- Test migration paths

### Periodic Updates
- Update relay list
- Refresh documentation
- Review security practices
- Optimize bundle size
- Update dependencies

---

## Contributing

### Before Making Changes
1. Read relevant documentation
2. Understand existing patterns
3. Review recent improvements
4. Test thoroughly
5. Update documentation

### After Making Changes
1. Run build: `npm run build`
2. Test all affected flows
3. Update documentation
4. Add console logging
5. Test error scenarios

---

## Support

### Getting Help
1. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) first
2. Review [AUTHENTICATION_FLOW.md](./AUTHENTICATION_FLOW.md)
3. Use debug console commands
4. Check browser console for errors
5. Review [LOCALSTORAGE_MANAGEMENT.md](./LOCALSTORAGE_MANAGEMENT.md)

### Common Issues
See the troubleshooting section in [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

### Reporting Bugs
Include:
- Error message from console
- Steps to reproduce
- Browser and version
- localStorage state (sanitized)
- Network conditions

---

## Future Improvements

### Planned
- [ ] IndexedDB for large datasets
- [ ] Service worker caching
- [ ] Profile compression
- [ ] Code splitting optimization
- [ ] Telemetry integration

### Under Consideration
- [ ] Multi-account support
- [ ] Offline mode
- [ ] Advanced relay selection
- [ ] Profile CDN caching
- [ ] Automated testing suite

---

## Version History

### v1.0 (2025-10-26)
- ✅ Complete authentication flow documentation
- ✅ LocalStorage management guide
- ✅ Authentication improvements summary
- ✅ Quick reference guide
- ✅ Enhanced error handling
- ✅ Optimized profile loading
- ✅ Memory leak prevention
- ✅ Auto-recovery mechanisms

---

## Feedback

We're constantly improving this documentation. If you find:
- Missing information
- Unclear explanations
- Broken examples
- Outdated content

Please let us know or submit a pull request!

---

**Last Updated**: 2025-10-26
**Documentation Version**: 1.0
**Application Version**: 0.0.0
**Maintainers**: ZapTracker Team
