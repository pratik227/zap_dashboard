import { describe, it, expect } from 'vitest'

import {
  DEFAULT_RELAY_URLS,
  DEFAULT_RELAY_CONFIGS,
  DEFAULT_RELAY_CONFIGS_WITH_STATUS,
  STORAGE_KEYS,
  CHART_COLORS,
  CHART_TOOLTIP_STYLE,
  chartAreaGradient,
  // Numeric constants
  RELAY_CONNECTION_TIMEOUT,
  RELAY_MAX_RETRIES,
  SUBSCRIBE_TIMEOUT,
  PROFILE_FETCH_TIMEOUT,
  PROFILE_BATCH_SIZE,
  PROFILE_CACHE_TTL,
  APP_HARD_TIMEOUT,
  PUBLISH_TIMEOUT,
  MAX_CONCURRENT_SUBS,
} from '../../src/utils/constants.js'

// ── DEFAULT_RELAY_URLS ───────────────────────────────────────────

describe('DEFAULT_RELAY_URLS', () => {
  it('is an array', () => {
    expect(Array.isArray(DEFAULT_RELAY_URLS)).toBe(true)
  })

  it('contains at least one relay', () => {
    expect(DEFAULT_RELAY_URLS.length).toBeGreaterThan(0)
  })

  it('every URL starts with wss://', () => {
    DEFAULT_RELAY_URLS.forEach((url) => {
      expect(url).toMatch(/^wss:\/\//)
    })
  })

  it('contains no duplicate URLs', () => {
    const unique = new Set(DEFAULT_RELAY_URLS)
    expect(unique.size).toBe(DEFAULT_RELAY_URLS.length)
  })

  it('includes well-known relays', () => {
    expect(DEFAULT_RELAY_URLS).toContain('wss://relay.damus.io')
    expect(DEFAULT_RELAY_URLS).toContain('wss://nos.lol')
  })
})

// ── STORAGE_KEYS ─────────────────────────────────────────────────

describe('STORAGE_KEYS', () => {
  it('is a plain object', () => {
    expect(typeof STORAGE_KEYS).toBe('object')
    expect(STORAGE_KEYS).not.toBeNull()
  })

  it('has all expected auth keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('USER')
    expect(STORAGE_KEYS).toHaveProperty('RELAYS')
    expect(STORAGE_KEYS).toHaveProperty('SIGNER_TYPE')
    expect(STORAGE_KEYS).toHaveProperty('REMOTE_URI')
  })

  it('has all expected wallet keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('CONNECTIONS')
    expect(STORAGE_KEYS).toHaveProperty('ACTIVE_CONNECTION')
    expect(STORAGE_KEYS).toHaveProperty('NWC_URL')
  })

  it('has all expected notification keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('NOTIFICATION_SETTINGS')
    expect(STORAGE_KEYS).toHaveProperty('LAST_TX_TIMESTAMP')
    expect(STORAGE_KEYS).toHaveProperty('LAST_BALANCE')
    expect(STORAGE_KEYS).toHaveProperty('PROCESSED_TX')
    expect(STORAGE_KEYS).toHaveProperty('NOTIFICATIONS_LIST')
  })

  it('has content and campaign keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('CONTENT_ITEMS')
    expect(STORAGE_KEYS).toHaveProperty('CAMPAIGNS')
    expect(STORAGE_KEYS).toHaveProperty('CAMPAIGN_ZAPS')
  })

  it('has follow list keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('FOLLOW_LISTS_MY')
    expect(STORAGE_KEYS).toHaveProperty('FOLLOW_LISTS_DISCOVERED')
    expect(STORAGE_KEYS).toHaveProperty('FOLLOW_LISTS_PROFILES')
  })

  it('has UI state keys', () => {
    expect(STORAGE_KEYS).toHaveProperty('WELCOME_SEEN')
    expect(STORAGE_KEYS).toHaveProperty('BTC_PRICE')
    expect(STORAGE_KEYS).toHaveProperty('PWA_DISMISSED')
  })

  it('all values are non-empty strings', () => {
    Object.values(STORAGE_KEYS).forEach((value) => {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    })
  })

  it('all values are unique', () => {
    const values = Object.values(STORAGE_KEYS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

// ── DEFAULT_RELAY_CONFIGS ────────────────────────────────────────

describe('DEFAULT_RELAY_CONFIGS', () => {
  it('is an array with the same length as DEFAULT_RELAY_URLS', () => {
    expect(Array.isArray(DEFAULT_RELAY_CONFIGS)).toBe(true)
    expect(DEFAULT_RELAY_CONFIGS.length).toBe(DEFAULT_RELAY_URLS.length)
  })

  it('each config has url, read, and write properties', () => {
    DEFAULT_RELAY_CONFIGS.forEach((config) => {
      expect(config).toHaveProperty('url')
      expect(config).toHaveProperty('read')
      expect(config).toHaveProperty('write')
      expect(typeof config.url).toBe('string')
      expect(typeof config.read).toBe('boolean')
      expect(typeof config.write).toBe('boolean')
    })
  })

  it('all configs have read: true', () => {
    DEFAULT_RELAY_CONFIGS.forEach((config) => {
      expect(config.read).toBe(true)
    })
  })

  it('known read-only relays have write: false', () => {
    const readOnlyUrls = [
      'wss://cache1.primal.net',
      'wss://relay.nostr.band',
      'wss://nostr-01.yakihonne.com',
    ]
    readOnlyUrls.forEach((url) => {
      const config = DEFAULT_RELAY_CONFIGS.find((c) => c.url === url)
      if (config) {
        expect(config.write).toBe(false)
      }
    })
  })

  it('non-read-only relays have write: true', () => {
    const config = DEFAULT_RELAY_CONFIGS.find((c) => c.url === 'wss://relay.damus.io')
    expect(config).toBeDefined()
    expect(config.write).toBe(true)
  })
})

// ── DEFAULT_RELAY_CONFIGS_WITH_STATUS ────────────────────────────

describe('DEFAULT_RELAY_CONFIGS_WITH_STATUS', () => {
  it('has same length as DEFAULT_RELAY_URLS', () => {
    expect(DEFAULT_RELAY_CONFIGS_WITH_STATUS.length).toBe(DEFAULT_RELAY_URLS.length)
  })

  it('each config has a status field defaulting to "disconnected"', () => {
    DEFAULT_RELAY_CONFIGS_WITH_STATUS.forEach((config) => {
      expect(config.status).toBe('disconnected')
    })
  })

  it('each config has url, read, write, and status properties', () => {
    DEFAULT_RELAY_CONFIGS_WITH_STATUS.forEach((config) => {
      expect(config).toHaveProperty('url')
      expect(config).toHaveProperty('read')
      expect(config).toHaveProperty('write')
      expect(config).toHaveProperty('status')
    })
  })
})

// ── Numeric constants ────────────────────────────────────────────

describe('Numeric constants', () => {
  it('RELAY_CONNECTION_TIMEOUT is a positive number', () => {
    expect(RELAY_CONNECTION_TIMEOUT).toBeGreaterThan(0)
    expect(typeof RELAY_CONNECTION_TIMEOUT).toBe('number')
  })

  it('RELAY_MAX_RETRIES is a positive integer', () => {
    expect(RELAY_MAX_RETRIES).toBeGreaterThan(0)
    expect(Number.isInteger(RELAY_MAX_RETRIES)).toBe(true)
  })

  it('SUBSCRIBE_TIMEOUT is reasonable (5s-60s)', () => {
    expect(SUBSCRIBE_TIMEOUT).toBeGreaterThanOrEqual(5000)
    expect(SUBSCRIBE_TIMEOUT).toBeLessThanOrEqual(60000)
  })

  it('PROFILE_FETCH_TIMEOUT is a positive number', () => {
    expect(PROFILE_FETCH_TIMEOUT).toBeGreaterThan(0)
  })

  it('PROFILE_BATCH_SIZE is a reasonable batch size', () => {
    expect(PROFILE_BATCH_SIZE).toBeGreaterThanOrEqual(1)
    expect(PROFILE_BATCH_SIZE).toBeLessThanOrEqual(500)
  })

  it('PROFILE_CACHE_TTL is at least 1 hour', () => {
    expect(PROFILE_CACHE_TTL).toBeGreaterThanOrEqual(3600000)
  })

  it('APP_HARD_TIMEOUT is a positive number', () => {
    expect(APP_HARD_TIMEOUT).toBeGreaterThan(0)
  })

  it('PUBLISH_TIMEOUT is a positive number', () => {
    expect(PUBLISH_TIMEOUT).toBeGreaterThan(0)
  })

  it('MAX_CONCURRENT_SUBS is a reasonable limit', () => {
    expect(MAX_CONCURRENT_SUBS).toBeGreaterThanOrEqual(1)
    expect(MAX_CONCURRENT_SUBS).toBeLessThanOrEqual(100)
  })
})

// ── CHART_COLORS ─────────────────────────────────────────────────

describe('CHART_COLORS', () => {
  it('is an object with color values', () => {
    expect(typeof CHART_COLORS).toBe('object')
    expect(CHART_COLORS).not.toBeNull()
  })

  it('all values are valid hex color strings', () => {
    Object.values(CHART_COLORS).forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })

  it('has primary brand color', () => {
    expect(CHART_COLORS).toHaveProperty('primary')
    expect(CHART_COLORS.primary).toBe('#f97316')
  })
})

// ── CHART_TOOLTIP_STYLE ──────────────────────────────────────────

describe('CHART_TOOLTIP_STYLE', () => {
  it('has required tooltip properties', () => {
    expect(CHART_TOOLTIP_STYLE).toHaveProperty('backgroundColor')
    expect(CHART_TOOLTIP_STYLE).toHaveProperty('borderColor')
    expect(CHART_TOOLTIP_STYLE).toHaveProperty('borderWidth')
    expect(CHART_TOOLTIP_STYLE).toHaveProperty('textStyle')
  })

  it('uses primary color for border', () => {
    expect(CHART_TOOLTIP_STYLE.borderColor).toBe(CHART_COLORS.primary)
  })
})

// ── chartAreaGradient ────────────────────────────────────────────

describe('chartAreaGradient', () => {
  it('returns a linear gradient object', () => {
    const gradient = chartAreaGradient()
    expect(gradient.type).toBe('linear')
    expect(gradient).toHaveProperty('x')
    expect(gradient).toHaveProperty('y')
    expect(gradient).toHaveProperty('x2')
    expect(gradient).toHaveProperty('y2')
  })

  it('has two color stops', () => {
    const gradient = chartAreaGradient()
    expect(gradient.colorStops).toHaveLength(2)
    expect(gradient.colorStops[0].offset).toBe(0)
    expect(gradient.colorStops[1].offset).toBe(1)
  })

  it('uses default opacities when no arguments provided', () => {
    const gradient = chartAreaGradient()
    expect(gradient.colorStops[0].color).toContain('0.3')
    expect(gradient.colorStops[1].color).toContain('0.02')
  })

  it('accepts custom opacities', () => {
    const gradient = chartAreaGradient(0.5, 0.1)
    expect(gradient.colorStops[0].color).toContain('0.5')
    expect(gradient.colorStops[1].color).toContain('0.1')
  })
})
