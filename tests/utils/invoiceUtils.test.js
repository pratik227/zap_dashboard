import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so the mock fn is available when vi.mock factory runs (hoisted)
const { mockDecode } = vi.hoisted(() => ({ mockDecode: vi.fn() }))
vi.mock('../../src/services/nostr/nostrImports.js', () => ({
  bolt11: { decode: mockDecode },
}))

import {
  parseInvoiceBasic,
  formatInvoiceAmount,
  validateInvoice,
  truncateInvoice,
  getPaymentHashFromInvoice,
  extractAmountFromBolt11,
} from '../../src/utils/wallet/invoiceUtils.js'

// ── parseInvoiceBasic ────────────────────────────────────────────

describe('parseInvoiceBasic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for falsy input', () => {
    expect(parseInvoiceBasic(null)).toBeNull()
    expect(parseInvoiceBasic(undefined)).toBeNull()
    expect(parseInvoiceBasic('')).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(parseInvoiceBasic(123)).toBeNull()
    expect(parseInvoiceBasic({})).toBeNull()
  })

  it('parses a valid mainnet invoice', () => {
    mockDecode.mockReturnValue({
      amountSat: 100,
      timestamp: 1700000000,
      description: 'test payment',
      isExpired: false,
    })

    const result = parseInvoiceBasic('lnbc1u1pjkdrtspp5abc123')
    expect(result).toEqual({
      network: 'mainnet',
      amount: 100,
      amountUnit: 'sats',
      timestamp: new Date(1700000000 * 1000),
      raw: 'lnbc1u1pjkdrtspp5abc123',
      isValid: true,
      description: 'test payment',
      isExpired: false,
    })
  })

  it('detects testnet network from lntb prefix', () => {
    mockDecode.mockReturnValue({
      amountSat: 50,
      timestamp: null,
      description: null,
      isExpired: false,
    })

    const result = parseInvoiceBasic('lntb1u1pjkdrtspp5abc123')
    expect(result.network).toBe('testnet')
  })

  it('detects regtest network from lnbcrt prefix', () => {
    mockDecode.mockReturnValue({
      amountSat: 10,
      timestamp: null,
      description: null,
      isExpired: false,
    })

    const result = parseInvoiceBasic('lnbcrt1u1pjkdrtspp5abc123')
    expect(result.network).toBe('regtest')
  })

  it('returns null timestamp when decoded timestamp is null', () => {
    mockDecode.mockReturnValue({
      amountSat: 100,
      timestamp: null,
      description: null,
      isExpired: false,
    })

    const result = parseInvoiceBasic('lnbc1u1test')
    expect(result.timestamp).toBeNull()
  })

  it('returns null when bolt11.decode throws', () => {
    mockDecode.mockImplementation(() => {
      throw new Error('Invalid invoice')
    })

    const result = parseInvoiceBasic('lnbc_broken_invoice')
    expect(result).toBeNull()
  })

  it('preserves the raw invoice string', () => {
    const invoice = 'lnbc500n1pjSOMEINVOICE'
    mockDecode.mockReturnValue({
      amountSat: 50,
      timestamp: 1700000000,
      description: null,
      isExpired: true,
    })

    const result = parseInvoiceBasic(invoice)
    expect(result.raw).toBe(invoice)
    expect(result.isExpired).toBe(true)
  })
})

// ── formatInvoiceAmount ──────────────────────────────────────────

describe('formatInvoiceAmount', () => {
  it('returns "0 sats" for zero', () => {
    expect(formatInvoiceAmount(0)).toBe('0 sats')
  })

  it('returns "0 sats" for falsy values', () => {
    expect(formatInvoiceAmount(null)).toBe('0 sats')
    expect(formatInvoiceAmount(undefined)).toBe('0 sats')
  })

  it('formats small amounts as plain sats', () => {
    expect(formatInvoiceAmount(1)).toBe('1 sats')
    expect(formatInvoiceAmount(999)).toBe('999 sats')
  })

  it('formats thousands as k sats', () => {
    expect(formatInvoiceAmount(1000)).toBe('1.0k sats')
    expect(formatInvoiceAmount(2500)).toBe('2.5k sats')
    expect(formatInvoiceAmount(99999)).toBe('100.0k sats')
  })

  it('formats 1 BTC and above', () => {
    expect(formatInvoiceAmount(100000000)).toBe('1.00 BTC')
    expect(formatInvoiceAmount(250000000)).toBe('2.50 BTC')
  })

  it('formats amounts just below 1 BTC as k sats', () => {
    expect(formatInvoiceAmount(99999999)).toBe('100000.0k sats')
  })
})

// ── validateInvoice ──────────────────────────────────────────────

describe('validateInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns invalid for falsy input', () => {
    expect(validateInvoice(null)).toEqual({ isValid: false, error: 'Invalid invoice format' })
    expect(validateInvoice('')).toEqual({ isValid: false, error: 'Invalid invoice format' })
    expect(validateInvoice(undefined)).toEqual({ isValid: false, error: 'Invalid invoice format' })
  })

  it('returns invalid for non-string input', () => {
    expect(validateInvoice(42)).toEqual({ isValid: false, error: 'Invalid invoice format' })
  })

  it('returns invalid when invoice does not start with "ln"', () => {
    expect(validateInvoice('bc1qtest')).toEqual({
      isValid: false,
      error: 'Invoice must start with "ln"',
    })
  })

  it('returns valid when bolt11.decode succeeds', () => {
    mockDecode.mockReturnValue({})
    expect(validateInvoice('lnbc1u1test')).toEqual({ isValid: true })
  })

  it('returns invalid with error message when bolt11.decode throws', () => {
    mockDecode.mockImplementation(() => {
      throw new Error('Checksum mismatch')
    })

    const result = validateInvoice('lnbc1u1broken')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Checksum mismatch')
  })

  it('returns generic error when exception has no message', () => {
    mockDecode.mockImplementation(() => {
      throw new Error()
    })

    const result = validateInvoice('lnbc1u1broken')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Failed to decode invoice')
  })
})

// ── truncateInvoice ──────────────────────────────────────────────

describe('truncateInvoice', () => {
  it('returns empty string for falsy input', () => {
    expect(truncateInvoice(null)).toBe('')
    expect(truncateInvoice(undefined)).toBe('')
    expect(truncateInvoice('')).toBe('')
  })

  it('returns full invoice when shorter than maxLength', () => {
    expect(truncateInvoice('lnbc1short', 50)).toBe('lnbc1short')
  })

  it('returns full invoice when equal to maxLength', () => {
    const inv = 'a'.repeat(50)
    expect(truncateInvoice(inv, 50)).toBe(inv)
  })

  it('truncates long invoices with ellipsis', () => {
    const inv = 'lnbc' + 'x'.repeat(100)
    const result = truncateInvoice(inv, 30)
    expect(result).toContain('...')
    expect(result.length).toBeLessThan(inv.length)
  })

  it('uses default maxLength of 50', () => {
    const inv = 'a'.repeat(60)
    const result = truncateInvoice(inv)
    expect(result).toContain('...')
    expect(result.length).toBeLessThan(60)
  })

  it('preserves start and end of the invoice', () => {
    const inv = 'lnbc1u1pjkdrtspp5' + 'x'.repeat(80) + 'endpart'
    const result = truncateInvoice(inv, 40)
    expect(result.startsWith('lnbc')).toBe(true)
    expect(result.endsWith('endpart')).toBe(true)
  })
})

// ── getPaymentHashFromInvoice ────────────────────────────────────

describe('getPaymentHashFromInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null for falsy input', () => {
    expect(getPaymentHashFromInvoice(null)).toBeNull()
    expect(getPaymentHashFromInvoice(undefined)).toBeNull()
    expect(getPaymentHashFromInvoice('')).toBeNull()
  })

  it('returns null for non-string input', () => {
    expect(getPaymentHashFromInvoice(123)).toBeNull()
  })

  it('returns payment hash from decoded invoice', () => {
    mockDecode.mockReturnValue({ paymentHash: 'abc123def456' })
    expect(getPaymentHashFromInvoice('lnbc1u1test')).toBe('abc123def456')
  })

  it('returns null when decoded invoice has no payment hash', () => {
    mockDecode.mockReturnValue({ paymentHash: null })
    expect(getPaymentHashFromInvoice('lnbc1u1test')).toBeNull()
  })

  it('returns null when paymentHash is undefined', () => {
    mockDecode.mockReturnValue({})
    expect(getPaymentHashFromInvoice('lnbc1u1test')).toBeNull()
  })

  it('returns null when bolt11.decode throws', () => {
    mockDecode.mockImplementation(() => {
      throw new Error('decode failed')
    })
    expect(getPaymentHashFromInvoice('lnbc1u1broken')).toBeNull()
  })
})

// ── extractAmountFromBolt11 ──────────────────────────────────────

describe('extractAmountFromBolt11', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns amountSat from decoded invoice', () => {
    mockDecode.mockReturnValue({ amountSat: 2100 })
    expect(extractAmountFromBolt11('lnbc1u1test')).toBe(2100)
  })

  it('returns 0 when amountSat is null', () => {
    mockDecode.mockReturnValue({ amountSat: null })
    expect(extractAmountFromBolt11('lnbc1u1test')).toBe(0)
  })

  it('returns 0 when amountSat is undefined', () => {
    mockDecode.mockReturnValue({})
    expect(extractAmountFromBolt11('lnbc1u1test')).toBe(0)
  })

  it('returns 0 when bolt11.decode throws', () => {
    mockDecode.mockImplementation(() => {
      throw new Error('bad invoice')
    })
    expect(extractAmountFromBolt11('garbage')).toBe(0)
  })

  it('returns 0 for amountSat of 0', () => {
    mockDecode.mockReturnValue({ amountSat: 0 })
    expect(extractAmountFromBolt11('lnbc1test')).toBe(0)
  })
})
