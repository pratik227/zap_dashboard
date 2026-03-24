/**
 * Step 6 — Error Handling Verification
 *
 * Verifies that:
 * 1. Composables use getUserFriendlyError() in catch blocks (not console.error alone)
 * 2. Relay disconnect produces a user-friendly offline status
 * 3. Signing rejection produces a user-friendly message
 * 4. NWC timeout produces a user-friendly message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  getUserFriendlyError,
  RelayError,
  AuthError,
  SignerError,
  SubscriptionError,
  OutboxError,
  StorageError,
} from '../../src/services/nostr/errors.js'

// ────────────────────────────────────────────────────────────────
// 1. Every composable with an error ref uses getUserFriendlyError()
// ────────────────────────────────────────────────────────────────

describe('Step 6.1 — All composables set error via getUserFriendlyError', () => {
  /**
   * For each composable that exposes an `error` ref, we read the source and
   * verify every `catch` block that sets `error.value` does so through
   * `getUserFriendlyError()`, not a raw string or err.message.
   */
  const composablesDir = path.resolve(__dirname, '../../src/composables')

  const composablesToCheck = [
    { file: 'content/useNostrNotes.js', name: 'useNostrNotes' },
    { file: 'content/useContent.js', name: 'useContent' },
    { file: 'campaigns/useCampaigns.js', name: 'useCampaigns' },
    { file: 'content/useNostrCalendar.js', name: 'useNostrCalendar' },
    { file: 'audience/useAudience.js', name: 'useAudience' },
    { file: 'audience/useFollowLists.js', name: 'useFollowLists' },
    { file: 'social/useBadges.js', name: 'useBadges' },
    { file: 'content/useNostrLongForm.js', name: 'useNostrLongForm' },
    { file: 'content/useZapLeaderboard.js', name: 'useZapLeaderboard' },
  ]

  // Composables that use a local variant (getUserFriendlyChatError) are acceptable
  const composablesWithLocalErrorMapper = [
    { file: 'social/useNostrChat.js', name: 'useNostrChat', mapper: 'getUserFriendlyChatError' },
  ]

  composablesToCheck.forEach(({ file, name }) => {
    it(`${name} — every catch that sets error.value uses getUserFriendlyError()`, () => {
      const source = fs.readFileSync(path.join(composablesDir, file), 'utf-8')

      // Must import getUserFriendlyError
      expect(source).toContain('getUserFriendlyError')

      // Find all lines that set error.value = … (excluding reset lines like error.value = '' or null)
      const errorAssignments = (source.match(/error\.value\s*=\s*.+/g) || [])
        .filter(a => !/error\.value\s*=\s*['"`]['"`]/.test(a))   // skip error.value = ''
        .filter(a => !/error\.value\s*=\s*null/.test(a))          // skip error.value = null
      expect(errorAssignments.length).toBeGreaterThan(0)

      for (const assignment of errorAssignments) {
        // Each error-setting assignment must use getUserFriendlyError (not err.message or a raw string)
        expect(
          assignment,
          `In ${name}: "${assignment}" should use getUserFriendlyError()`
        ).toMatch(/getUserFriendlyError/)
      }
    })
  })

  composablesWithLocalErrorMapper.forEach(({ file, name, mapper }) => {
    it(`${name} — uses local error mapper ${mapper}() in catch blocks`, () => {
      const source = fs.readFileSync(path.join(composablesDir, file), 'utf-8')

      // Must define or import the mapper
      expect(source).toContain(mapper)

      // Find all lines that set error.value = … (excluding resets)
      const errorAssignments = (source.match(/error\.value\s*=\s*.+/g) || [])
        .filter(a => !/error\.value\s*=\s*['"`]['"`]/.test(a))
        .filter(a => !/error\.value\s*=\s*null/.test(a))
      expect(errorAssignments.length).toBeGreaterThan(0)

      for (const assignment of errorAssignments) {
        expect(
          assignment,
          `In ${name}: "${assignment}" should use ${mapper}()`
        ).toMatch(new RegExp(mapper))
      }
    })
  })

  // Negative check: composables that have catch blocks but NO error ref should
  // not silently swallow (they should at least console.warn/error).
  const composablesWithoutErrorRef = [
    { file: 'content/useContentZaps.js', name: 'useContentZaps' },
    { file: 'analytics/useEngagementMetrics.js', name: 'useEngagementMetrics' },
    { file: 'content/useMentions.js', name: 'useMentions' },
  ]

  composablesWithoutErrorRef.forEach(({ file, name }) => {
    it(`${name} — catch blocks log errors (console.error or console.warn)`, () => {
      const source = fs.readFileSync(path.join(composablesDir, file), 'utf-8')

      // Extract catch block bodies (simple heuristic: lines after "catch")
      const catchBlocks = source.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/gs) || []

      for (const block of catchBlocks) {
        // Each catch block should have some form of logging
        const hasLogging = /console\.(error|warn|log)/.test(block)
          || /return\s/.test(block) // or a controlled return
          || /throw\s/.test(block) // or re-throw
          || /\/\*.*\*\//.test(block) // or an explicit block comment (e.g., silently continue)
          || /\/\/\s*.+/.test(block) // or an explicit line comment explaining the silence
        expect(
          hasLogging,
          `In ${name}: catch block should log or re-throw: ${block.substring(0, 100)}...`
        ).toBe(true)
      }
    })
  })
})

// ────────────────────────────────────────────────────────────────
// 2. Relay disconnect → user sees friendly message
// ────────────────────────────────────────────────────────────────

describe('Step 6.2 — Relay disconnect produces friendly message', () => {
  it('RelayError with NO_RELAYS code has a user-friendly message', () => {
    const err = new RelayError('No relays available', null, 'NO_RELAYS')
    expect(err.userMessage).toBe('No relays connected. Check your internet connection.')
    expect(getUserFriendlyError(err)).toBe('No relays connected. Check your internet connection.')
  })

  it('RelayError with ALL_FAILED code has a user-friendly message', () => {
    const err = new RelayError('All relays failed', null, 'ALL_FAILED')
    expect(getUserFriendlyError(err)).toBe('All relays failed. Please try again.')
  })

  it('RelayError with TIMEOUT code has a user-friendly message', () => {
    const err = new RelayError('timed out', null, 'TIMEOUT')
    expect(getUserFriendlyError(err)).toBe('Relay connection timed out.')
  })

  it('RelayError with CONNECTION_FAILED includes relay URL', () => {
    const err = new RelayError('connection failed', 'wss://relay.example.com', 'CONNECTION_FAILED')
    expect(getUserFriendlyError(err)).toContain('wss://relay.example.com')
  })

  it('useConnectionStatus sets offline when no relays connected', async () => {
    // Mock NostrService before importing the composable
    vi.doMock('../../src/services/nostr/NostrService.js', () => ({
      nostrService: {
        isInitialized: true,
        getConnectionHealth: () => ({
          connected: 0,
          total: 5,
          healthyPercentage: 0,
        }),
        addEventListener: vi.fn(() => () => {}),
      },
    }))

    // Reset modules so the composable picks up the mock
    vi.resetModules()
    const { useConnectionStatus } = await import('../../src/composables/core/useConnectionStatus.js')

    // useConnectionStatus uses onMounted — call refresh directly
    const result = useConnectionStatus()
    result.refresh()

    expect(result.status.value).toBe('offline')
    expect(result.isOffline.value).toBe(true)

    vi.doUnmock('../../src/services/nostr/NostrService.js')
  })
})

// ────────────────────────────────────────────────────────────────
// 3. Signing rejection → user sees friendly message
// ────────────────────────────────────────────────────────────────

describe('Step 6.3 — Signing rejection produces friendly message', () => {
  it('AuthError with SIGN_REJECTED returns a user-friendly message', () => {
    const err = new AuthError('User rejected signing request', 'SIGN_REJECTED')
    const msg = getUserFriendlyError(err)
    expect(msg).toBe('Signing was rejected. Please approve in your signer.')
  })

  it('SignerError with SIGN_REJECTED returns a user-friendly message', () => {
    const err = new SignerError('Extension denied signing', 'SIGN_REJECTED')
    const msg = getUserFriendlyError(err)
    expect(msg).toBe('Signing was rejected by your extension.')
  })

  it('AuthError with NO_EXTENSION returns a user-friendly message', () => {
    const err = new AuthError('No extension found', 'NO_EXTENSION')
    expect(getUserFriendlyError(err)).toBe(
      'No Nostr extension found. Install Alby, nos2x, or Flamingo.'
    )
  })

  it('AuthError with SESSION_EXPIRED returns a user-friendly message', () => {
    const err = new AuthError('Session expired', 'SESSION_EXPIRED')
    expect(getUserFriendlyError(err)).toBe('Your session has expired. Please log in again.')
  })

  it('AuthError with REMOTE_TIMEOUT returns a user-friendly message', () => {
    const err = new AuthError('Timeout', 'REMOTE_TIMEOUT')
    expect(getUserFriendlyError(err)).toBe(
      'Remote signer did not respond. Check your signer app.'
    )
  })
})

// ────────────────────────────────────────────────────────────────
// 4. NWC timeout → user sees friendly message
// ────────────────────────────────────────────────────────────────

describe('Step 6.4 — NWC timeout produces friendly message', () => {
  it('NWCTimeoutError returns a user-friendly message', () => {
    const err = new Error('NWC timed out')
    err.name = 'NWCTimeoutError'
    const msg = getUserFriendlyError(err)
    expect(msg).toBe('Could not reach your wallet. Check your internet connection.')
  })

  it('NWCPublishTimeoutError returns a user-friendly message', () => {
    const err = new Error('Publish timed out')
    err.name = 'NWCPublishTimeoutError'
    expect(getUserFriendlyError(err)).toBe(
      'Could not reach your wallet. Check your internet connection.'
    )
  })

  it('NWCReplyTimeoutError returns a user-friendly message', () => {
    const err = new Error('No reply in time')
    err.name = 'NWCReplyTimeoutError'
    expect(getUserFriendlyError(err)).toBe(
      'Your wallet did not respond in time. It may be offline.'
    )
  })

  it('NWCConnectionError returns a user-friendly message', () => {
    const err = new Error('Connection failed')
    err.name = 'NWCConnectionError'
    expect(getUserFriendlyError(err)).toBe(
      'Failed to connect to wallet relay. Check your connection string.'
    )
  })

  it('NWCDecryptionError returns a user-friendly message', () => {
    const err = new Error('Decryption failed')
    err.name = 'NWCDecryptionError'
    expect(getUserFriendlyError(err)).toBe(
      'Failed to decrypt wallet response. Your connection string may be invalid.'
    )
  })

  it('NWCWalletError with INSUFFICIENT_BALANCE returns friendly message', () => {
    const err = new Error('Not enough sats')
    err.name = 'NWCWalletError'
    err.code = 'INSUFFICIENT_BALANCE'
    expect(getUserFriendlyError(err)).toBe(
      'Insufficient balance. Please top up your wallet.'
    )
  })

  it('NWCWalletError with PAYMENT_FAILED returns friendly message', () => {
    const err = new Error('Payment failed')
    err.name = 'NWCWalletError'
    err.code = 'PAYMENT_FAILED'
    expect(getUserFriendlyError(err)).toBe(
      'Payment failed. The invoice may have expired.'
    )
  })
})

// ────────────────────────────────────────────────────────────────
// Additional: other typed errors also produce friendly messages
// ────────────────────────────────────────────────────────────────

describe('Step 6 — Other typed errors produce friendly messages', () => {
  it('SubscriptionError always returns a user-friendly message', () => {
    const err = new SubscriptionError('query failed', { kinds: [1] })
    expect(getUserFriendlyError(err)).toBe(
      'Failed to load data from relays. Please try refreshing.'
    )
  })

  it('OutboxError with NO_RELAY_LIST returns friendly message', () => {
    const err = new OutboxError('no relay list', 'NO_RELAY_LIST')
    expect(getUserFriendlyError(err)).toBe(
      'Could not find relay list for this user.'
    )
  })

  it('StorageError with QUOTA_EXCEEDED returns friendly message', () => {
    const err = new StorageError('quota', 'someKey', 'QUOTA_EXCEEDED')
    expect(getUserFriendlyError(err)).toBe('Storage is full. Please clear some data.')
  })

  it('getUserFriendlyError handles null/undefined gracefully', () => {
    expect(getUserFriendlyError(null)).toBe('An unexpected error occurred.')
    expect(getUserFriendlyError(undefined)).toBe('An unexpected error occurred.')
  })

  it('getUserFriendlyError handles generic Error with no known pattern', () => {
    const err = new Error('something weird happened')
    expect(getUserFriendlyError(err)).toBe('something weird happened')
  })

  it('getUserFriendlyError handles generic network errors', () => {
    const err = new Error('network error occurred')
    expect(getUserFriendlyError(err)).toBe('Network error. Check your internet connection.')
  })

  it('getUserFriendlyError handles timeout patterns in generic errors', () => {
    const err = new Error('request timeout')
    expect(getUserFriendlyError(err)).toBe('Request timed out. Please try again.')
  })
})
