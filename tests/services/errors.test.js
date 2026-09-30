import { describe, it, expect } from 'vitest'
import {
  RelayError,
  AuthError,
  SignerError,
  SubscriptionError,
  OutboxError,
  StorageError,
  getUserFriendlyError,
} from '../../src/services/nostr/errors.js'

// ── RelayError ─────────────────────────────────────────────────

describe('RelayError', () => {
  it('has correct name and defaults', () => {
    const err = new RelayError('something broke')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('RelayError')
    expect(err.code).toBe('RELAY_ERROR')
    expect(err.relay).toBeNull()
    expect(err.message).toBe('something broke')
  })

  it('stores relay and custom code', () => {
    const err = new RelayError('fail', 'wss://relay.example', 'CONNECTION_FAILED')
    expect(err.relay).toBe('wss://relay.example')
    expect(err.code).toBe('CONNECTION_FAILED')
  })

  it('returns correct userMessage for NO_RELAYS', () => {
    const err = new RelayError('x', null, 'NO_RELAYS')
    expect(err.userMessage).toBe('No relays connected. Check your internet connection.')
  })

  it('returns correct userMessage for ALL_FAILED', () => {
    const err = new RelayError('x', null, 'ALL_FAILED')
    expect(err.userMessage).toBe('All relays failed. Please try again.')
  })

  it('returns correct userMessage for CONNECTION_FAILED with relay', () => {
    const err = new RelayError('x', 'wss://r.io', 'CONNECTION_FAILED')
    expect(err.userMessage).toBe('Could not connect to relay wss://r.io.')
  })

  it('returns correct userMessage for CONNECTION_FAILED without relay', () => {
    const err = new RelayError('x', null, 'CONNECTION_FAILED')
    expect(err.userMessage).toBe('Could not connect to relay.')
  })

  it('returns correct userMessage for TIMEOUT', () => {
    const err = new RelayError('x', null, 'TIMEOUT')
    expect(err.userMessage).toBe('Relay connection timed out.')
  })

  it('falls back to message for unknown code', () => {
    const err = new RelayError('custom msg', null, 'UNKNOWN_CODE')
    expect(err.userMessage).toBe('custom msg')
  })
})

// ── AuthError ──────────────────────────────────────────────────

describe('AuthError', () => {
  it('has correct name and defaults', () => {
    const err = new AuthError('auth problem')
    expect(err.name).toBe('AuthError')
    expect(err.code).toBe('AUTH_ERROR')
  })

  it.each([
    ['NO_EXTENSION', 'No Nostr extension found. Install Jump by Buho (from the ZapTracker founders), Alby, nos2x, or Flamingo.'],
    ['NO_SIGNER', 'No signer connected. Please log in first.'],
    ['SIGN_REJECTED', 'Signing was rejected. Please approve in your signer.'],
    ['REMOTE_TIMEOUT', 'Remote signer did not respond. Check your signer app.'],
    ['REMOTE_REJECTED', 'Connection was rejected by the remote signer.'],
    ['SESSION_EXPIRED', 'Your session has expired. Please log in again.'],
  ])('returns correct userMessage for %s', (code, expected) => {
    const err = new AuthError('x', code)
    expect(err.userMessage).toBe(expected)
  })

  it('falls back to message for unknown code', () => {
    const err = new AuthError('fallback msg', 'WEIRD_CODE')
    expect(err.userMessage).toBe('fallback msg')
  })
})

// ── SignerError ─────────────────────────────────────────────────

describe('SignerError', () => {
  it('has correct name and defaults', () => {
    const err = new SignerError('signer issue')
    expect(err.name).toBe('SignerError')
    expect(err.code).toBe('SIGNER_ERROR')
  })

  it('returns correct userMessage for NO_EXTENSION', () => {
    const err = new SignerError('x', 'NO_EXTENSION')
    expect(err.userMessage).toBe('No Nostr extension found. Install Jump by Buho (from the ZapTracker founders), Alby, nos2x, or Flamingo.')
  })

  it('returns correct userMessage for SIGN_REJECTED', () => {
    const err = new SignerError('x', 'SIGN_REJECTED')
    expect(err.userMessage).toBe('Signing was rejected by your extension.')
  })

  it('falls back to message for unknown code', () => {
    const err = new SignerError('raw msg')
    expect(err.userMessage).toBe('raw msg')
  })
})

// ── SubscriptionError ──────────────────────────────────────────

describe('SubscriptionError', () => {
  it('has correct name and defaults', () => {
    const err = new SubscriptionError('sub failed')
    expect(err.name).toBe('SubscriptionError')
    expect(err.code).toBe('SUBSCRIPTION_ERROR')
    expect(err.filter).toBeNull()
  })

  it('stores filter', () => {
    const filter = { kinds: [1], limit: 10 }
    const err = new SubscriptionError('x', filter)
    expect(err.filter).toEqual(filter)
  })

  it('always returns the same userMessage regardless of code', () => {
    const err = new SubscriptionError('x', null, 'CUSTOM')
    expect(err.userMessage).toBe('Failed to load data from relays. Please try refreshing.')
  })
})

// ── OutboxError ────────────────────────────────────────────────

describe('OutboxError', () => {
  it('has correct name and defaults', () => {
    const err = new OutboxError('outbox issue')
    expect(err.name).toBe('OutboxError')
    expect(err.code).toBe('OUTBOX_ERROR')
  })

  it('returns correct userMessage for NO_RELAY_LIST', () => {
    const err = new OutboxError('x', 'NO_RELAY_LIST')
    expect(err.userMessage).toBe('Could not find relay list for this user.')
  })

  it('returns correct userMessage for FETCH_FAILED', () => {
    const err = new OutboxError('x', 'FETCH_FAILED')
    expect(err.userMessage).toContain('Failed to fetch data')
  })

  it('falls back to message for unknown code', () => {
    const err = new OutboxError('my msg', 'OTHER')
    expect(err.userMessage).toBe('my msg')
  })
})

// ── StorageError ───────────────────────────────────────────────

describe('StorageError', () => {
  it('has correct name and defaults', () => {
    const err = new StorageError('storage problem')
    expect(err.name).toBe('StorageError')
    expect(err.code).toBe('STORAGE_ERROR')
    expect(err.key).toBeNull()
  })

  it('stores key', () => {
    const err = new StorageError('x', 'some_key', 'QUOTA_EXCEEDED')
    expect(err.key).toBe('some_key')
  })

  it('returns correct userMessage for QUOTA_EXCEEDED', () => {
    const err = new StorageError('x', null, 'QUOTA_EXCEEDED')
    expect(err.userMessage).toBe('Storage is full. Please clear some data.')
  })

  it('returns correct userMessage for PARSE_ERROR', () => {
    const err = new StorageError('x', 'bad_key', 'PARSE_ERROR')
    expect(err.userMessage).toBe('Saved data is corrupted. It has been reset.')
  })

  it('returns generic message for unknown code', () => {
    const err = new StorageError('x')
    expect(err.userMessage).toBe('Failed to save data locally.')
  })
})

// ── getUserFriendlyError() ─────────────────────────────────────

describe('getUserFriendlyError()', () => {
  it('returns fallback for null/undefined', () => {
    expect(getUserFriendlyError(null)).toBe('An unexpected error occurred.')
    expect(getUserFriendlyError(undefined)).toBe('An unexpected error occurred.')
  })

  it('uses userMessage from typed errors', () => {
    const err = new RelayError('x', null, 'TIMEOUT')
    expect(getUserFriendlyError(err)).toBe('Relay connection timed out.')
  })

  it('uses userMessage from AuthError', () => {
    const err = new AuthError('x', 'NO_EXTENSION')
    expect(getUserFriendlyError(err)).toBe('No Nostr extension found. Install Jump by Buho (from the ZapTracker founders), Alby, nos2x, or Flamingo.')
  })

  it('uses userMessage from StorageError', () => {
    const err = new StorageError('x', null, 'QUOTA_EXCEEDED')
    expect(getUserFriendlyError(err)).toBe('Storage is full. Please clear some data.')
  })

  // NWC errors
  describe('NWC errors', () => {
    function makeNWCError(name, code, message) {
      const err = new Error(message || 'nwc error')
      err.name = name
      if (code) err.code = code
      return err
    }

    it.each([
      ['INSUFFICIENT_BALANCE', 'Insufficient balance. Please top up your wallet.'],
      ['QUOTA_EXCEEDED', 'Spending quota exceeded. Check your wallet limits.'],
      ['PAYMENT_FAILED', 'Payment failed. The invoice may have expired.'],
      ['RATE_LIMITED', 'Too many requests. Please wait a moment.'],
      ['UNAUTHORIZED', 'Wallet authorization failed. Please reconnect.'],
    ])('handles NWCWalletError with code %s', (code, expected) => {
      const err = makeNWCError('NWCWalletError', code)
      expect(getUserFriendlyError(err)).toBe(expected)
    })

    it('falls back to message for unknown NWCWalletError code', () => {
      const err = makeNWCError('NWCWalletError', 'UNKNOWN', 'custom wallet msg')
      expect(getUserFriendlyError(err)).toBe('custom wallet msg')
    })

    it('falls back to generic message for NWCWalletError with no message', () => {
      const err = new Error()
      err.name = 'NWCWalletError'
      err.code = 'UNKNOWN'
      err.message = ''
      expect(getUserFriendlyError(err)).toBe('Wallet operation failed.')
    })

    it('handles NWCTimeoutError', () => {
      const err = makeNWCError('NWCTimeoutError')
      expect(getUserFriendlyError(err)).toBe('Could not reach your wallet. Check your internet connection.')
    })

    it('handles NWCPublishTimeoutError', () => {
      const err = makeNWCError('NWCPublishTimeoutError')
      expect(getUserFriendlyError(err)).toBe('Could not reach your wallet. Check your internet connection.')
    })

    it('handles NWCReplyTimeoutError', () => {
      const err = makeNWCError('NWCReplyTimeoutError')
      expect(getUserFriendlyError(err)).toBe('Your wallet did not respond in time. It may be offline.')
    })

    it('handles NWCConnectionError', () => {
      const err = makeNWCError('NWCConnectionError')
      expect(getUserFriendlyError(err)).toBe('Failed to connect to wallet relay. Check your connection string.')
    })

    it('handles NWCDecryptionError', () => {
      const err = makeNWCError('NWCDecryptionError')
      expect(getUserFriendlyError(err)).toBe('Failed to decrypt wallet response. Your connection string may be invalid.')
    })
  })

  // NIP-46 errors
  describe('NIP-46 errors', () => {
    it('handles Nip46TimeoutError', () => {
      const err = new Error('timeout')
      err.name = 'Nip46TimeoutError'
      expect(getUserFriendlyError(err)).toBe('Remote signer timed out. Check your signer app.')
    })

    it('handles Nip46ConnectionError', () => {
      const err = new Error('conn')
      err.name = 'Nip46ConnectionError'
      expect(getUserFriendlyError(err)).toBe('Could not connect to remote signer.')
    })

    it('handles Nip46RemoteError', () => {
      const err = new Error('remote')
      err.name = 'Nip46RemoteError'
      expect(getUserFriendlyError(err)).toBe('Remote signer returned an error.')
    })
  })

  // Generic message pattern matching
  describe('generic error patterns', () => {
    it('detects "no signer" in message', () => {
      expect(getUserFriendlyError(new Error('no signer found'))).toBe('Please log in first.')
    })

    it('detects "not connected" in message', () => {
      expect(getUserFriendlyError(new Error('user not connected'))).toBe('Please log in first.')
    })

    it('detects "timeout" in message', () => {
      expect(getUserFriendlyError(new Error('request timeout'))).toBe('Request timed out. Please try again.')
    })

    it('detects "rate limit" in message', () => {
      expect(getUserFriendlyError(new Error('rate limit exceeded'))).toBe('Rate limited. Please wait a moment.')
    })

    it('detects "rate_limited" in message', () => {
      expect(getUserFriendlyError(new Error('error: rate_limited'))).toBe('Rate limited. Please wait a moment.')
    })

    it('detects "no relays" in message', () => {
      expect(getUserFriendlyError(new Error('no relays available'))).toBe('No relays connected. Check your connection.')
    })

    it('detects "no write" in message', () => {
      expect(getUserFriendlyError(new Error('no write relays'))).toBe('No relays connected. Check your connection.')
    })

    it('detects "no read" in message', () => {
      expect(getUserFriendlyError(new Error('no read relays'))).toBe('No relays connected. Check your connection.')
    })

    it('detects "network" in message', () => {
      expect(getUserFriendlyError(new Error('network error'))).toBe('Network error. Check your internet connection.')
    })

    it('detects "fetch" in message', () => {
      expect(getUserFriendlyError(new Error('fetch failed'))).toBe('Network error. Check your internet connection.')
    })

    it('falls back to error.message for unrecognized errors', () => {
      expect(getUserFriendlyError(new Error('something unusual'))).toBe('something unusual')
    })

    it('returns fallback when error has no message', () => {
      const err = new Error()
      err.message = ''
      expect(getUserFriendlyError(err)).toBe('An unexpected error occurred.')
    })
  })
})
