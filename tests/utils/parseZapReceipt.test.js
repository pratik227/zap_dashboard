import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock fns are available when vi.mock factory runs (hoisted)
const { mockCoreParseZapReceipt, mockCoreValidateZapReceipt, mockGetPaymentHash } = vi.hoisted(() => ({
  mockCoreParseZapReceipt: vi.fn(),
  mockCoreValidateZapReceipt: vi.fn(),
  mockGetPaymentHash: vi.fn(),
}))

vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  parseZapReceipt: mockCoreParseZapReceipt,
  validateZapReceipt: mockCoreValidateZapReceipt,
  bolt11: { decode: vi.fn() },
}))

vi.mock('../../src/utils/wallet/invoiceUtils.js', () => ({
  getPaymentHashFromInvoice: mockGetPaymentHash,
}))

import { parseZapReceipt, validateZapReceipt } from '../../src/utils/zaps/parseZapReceipt.js'

// ── Helper: build a minimal kind:9735 event ──────────────────────

function makeZapEvent(overrides = {}) {
  return {
    id: 'event123',
    kind: 9735,
    pubkey: 'relay_pubkey_hex',
    created_at: 1700000000,
    tags: [],
    content: '',
    sig: 'sig_hex',
    ...overrides,
  }
}

// ── parseZapReceipt ──────────────────────────────────────────────

describe('parseZapReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when coreParseZapReceipt returns null', () => {
    mockCoreParseZapReceipt.mockReturnValue(null)
    const event = makeZapEvent()
    expect(parseZapReceipt(event)).toBeNull()
  })

  it('parses a valid zap receipt with amount conversion from msats to sats', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender_abc',
      recipientPubkey: 'recipient_def',
      eventId: 'zapped_event_id',
      amount: 21000000, // 21000 sats in msats
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent()
    const result = parseZapReceipt(event)

    expect(result).not.toBeNull()
    expect(result.amount).toBe(21000)
    expect(result.zapperPubkey).toBe('sender_abc')
    expect(result.zappedEventId).toBe('zapped_event_id')
    expect(result.id).toBe('event123')
  })

  it('uses payment hash as id when bolt11 is present and hash is extractable', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender_abc',
      eventId: null,
      amount: 1000000,
      bolt11: 'lnbc1u1test_invoice',
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue('payment_hash_xyz')

    const event = makeZapEvent()
    const result = parseZapReceipt(event)

    expect(result.id).toBe('payment_hash_xyz')
    expect(mockGetPaymentHash).toHaveBeenCalledWith('lnbc1u1test_invoice')
  })

  it('falls back to event id when payment hash is not available', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender_abc',
      eventId: null,
      amount: 500000,
      bolt11: 'lnbc1u1some_invoice',
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({ id: 'fallback_event_id' })
    const result = parseZapReceipt(event)

    expect(result.id).toBe('fallback_event_id')
  })

  it('extracts goal tag from event tags', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 100000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({
      tags: [['goal', 'goal_event_id_abc']],
    })
    const result = parseZapReceipt(event)

    expect(result.goalTag).toBe('goal_event_id_abc')
  })

  it('extracts goal tag from zap request description when not in event tags', () => {
    const zapRequest = {
      content: 'Great work!',
      tags: [['goal', 'goal_from_request']],
    }

    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 100000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({
      tags: [['description', JSON.stringify(zapRequest)]],
    })
    const result = parseZapReceipt(event)

    expect(result.goalTag).toBe('goal_from_request')
    expect(result.message).toBe('Great work!')
  })

  it('prefers goal tag from event tags over zap request description', () => {
    const zapRequest = {
      content: '',
      tags: [['goal', 'goal_from_request']],
    }

    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 100000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({
      tags: [
        ['goal', 'goal_from_event'],
        ['description', JSON.stringify(zapRequest)],
      ],
    })
    const result = parseZapReceipt(event)

    expect(result.goalTag).toBe('goal_from_event')
  })

  it('extracts message from zap request description content', () => {
    const zapRequest = { content: 'Thanks for the awesome content!' }

    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 50000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({
      tags: [['description', JSON.stringify(zapRequest)]],
    })
    const result = parseZapReceipt(event)

    expect(result.message).toBe('Thanks for the awesome content!')
  })

  it('handles malformed description JSON gracefully', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 50000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({
      tags: [['description', 'not-valid-json{{{']],
    })
    const result = parseZapReceipt(event)

    expect(result).not.toBeNull()
    expect(result.message).toBe('')
    expect(result.goalTag).toBeNull()
  })

  it('converts created_at to ISO timestamp', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 100000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({ created_at: 1700000000 })
    const result = parseZapReceipt(event)

    expect(result.timestamp).toBe(new Date(1700000000 * 1000).toISOString())
  })

  it('includes raw event reference', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 100000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent()
    const result = parseZapReceipt(event)

    expect(result.rawZapEvent).toBe(event)
  })

  it('falls back to event pubkey when senderPubkey is missing', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: null,
      eventId: null,
      amount: 100000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({ pubkey: 'relay_pubkey_fallback' })
    const result = parseZapReceipt(event)

    expect(result.zapperPubkey).toBe('relay_pubkey_fallback')
  })

  it('returns 0 amount when parsed amount is not a number', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: null,
      amount: 'not_a_number',
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent()
    const result = parseZapReceipt(event)

    expect(result.amount).toBe(0)
  })

  it('returns null when coreParseZapReceipt throws', () => {
    mockCoreParseZapReceipt.mockImplementation(() => {
      throw new Error('Parse error')
    })

    const event = makeZapEvent()
    expect(parseZapReceipt(event)).toBeNull()
  })

  it('handles zap receipt with no tags gracefully', () => {
    mockCoreParseZapReceipt.mockReturnValue({
      senderPubkey: 'sender',
      eventId: 'eid',
      amount: 10000,
      bolt11: null,
      description: null,
      preimage: null,
    })
    mockGetPaymentHash.mockReturnValue(null)

    const event = makeZapEvent({ tags: [] })
    const result = parseZapReceipt(event)

    expect(result.goalTag).toBeNull()
    expect(result.message).toBe('')
  })
})

// ── validateZapReceipt ───────────────────────────────────────────

describe('validateZapReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to coreValidateZapReceipt', () => {
    mockCoreValidateZapReceipt.mockReturnValue(true)
    const event = makeZapEvent()
    expect(validateZapReceipt(event)).toBe(true)
    expect(mockCoreValidateZapReceipt).toHaveBeenCalledWith(event, undefined)
  })

  it('passes optional request event to core validator', () => {
    mockCoreValidateZapReceipt.mockReturnValue(true)
    const receipt = makeZapEvent()
    const request = { id: 'req', kind: 9734 }
    validateZapReceipt(receipt, request)
    expect(mockCoreValidateZapReceipt).toHaveBeenCalledWith(receipt, request)
  })

  it('returns false when core validator returns false', () => {
    mockCoreValidateZapReceipt.mockReturnValue(false)
    expect(validateZapReceipt(makeZapEvent())).toBe(false)
  })

  it('returns false when core validator throws', () => {
    mockCoreValidateZapReceipt.mockImplementation(() => {
      throw new Error('Validation error')
    })
    expect(validateZapReceipt(makeZapEvent())).toBe(false)
  })
})
