import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { getGlobalStats } = vi.hoisted(() => ({ getGlobalStats: vi.fn() }))
vi.mock('../../src/utils/network/nostrNetworkService.js', () => ({ nostrNetworkService: { getGlobalStats } }))

import LightningStats from '../../src/components/zaps/LightningStats.vue'

describe('LightningStats', () => {
  beforeEach(() => getGlobalStats.mockReset())

  it('renders network, probe and NIP data', async () => {
    getGlobalStats.mockResolvedValue({
      network: {
        onlineRelays: 1234, monitors: 12, medianRttOpen: 700, openAccess: 1100, paymentRequired: 40,
        fastestRelays: [{ url: 'wss://fast.example', rttOpen: 30, rttRead: 5, software: 'strfry', nips: [1] }]
      },
      probes: { summary: { reachable: 8, notesLastMinute: 95, medianConnectMs: 900 } },
      nipSupport: [{ nip: 1, percentage: 98, count: 980, total: 1000, description: 'Basic protocol' }],
      nipSampleSize: 1000,
      searchSupportCount: 110
    })
    const w = mount(LightningStats)
    await flushPromises()
    const text = w.text()
    expect(text).toContain('1,234')
    expect(text).toContain('by 12 monitors')
    expect(text).toContain('700 ms')
    expect(text).toContain('95')
    expect(text).toContain('NIP-1')
    expect(text).toContain('Basic protocol')
    expect(text).toContain('fast.example')
    expect(text).toContain('110')
  })

  it('shows unavailable states instead of made-up numbers', async () => {
    getGlobalStats.mockResolvedValue({ network: null, probes: { summary: { reachable: 0, notesLastMinute: null } }, nipSupport: [], nipSampleSize: 0, searchSupportCount: null })
    const w = mount(LightningStats)
    await flushPromises()
    const text = w.text()
    expect(text).toContain('Monitor data unavailable')
    expect(text).toContain('Live probe unavailable')
    expect(text).toContain('Couldn’t reach the Nostr network')
    expect(text).not.toMatch(/\d+ ms/)
  })
})
