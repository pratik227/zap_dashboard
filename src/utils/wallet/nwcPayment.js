import { NWC, makeZapRequest, getZapEndpoint } from '../../services/nostr/nostrImports.js'
import { nostrService } from '../../services/nostr/NostrService.js'

export class NWCPaymentHandler {
  constructor() {
    this.nwcClient = null
  }

  async initialize(nwcUrl) {
    try {
      this.nwcClient = new NWC(nwcUrl)
      await this.nwcClient.connect()
      return true
    } catch (error) {
      console.error('Failed to initialize NWC client:', error)
      throw error
    }
  }

  async getZapEndpoint(publisherPubkey) {
    try {
      const metadata = await nostrService.queryOne({
        kinds: [0],
        authors: [publisherPubkey],
        limit: 1
      })

      if (!metadata) {
        throw new Error('Publisher profile not found')
      }

      const zapEndpoint = await getZapEndpoint(metadata)
      if (!zapEndpoint) {
        throw new Error('Publisher does not have a Zap endpoint configured')
      }

      return zapEndpoint
    } catch (error) {
      console.error('Failed to get Zap endpoint:', error)
      throw error
    }
  }

  createZapRequest(articleEvent, amountSats, comment = '') {
    const zapRequest = makeZapRequest({
      profile: articleEvent.pubkey,
      event: articleEvent,
      amount: amountSats * 1000,
      relays: nostrService.getReadRelays().map(r => r.url).slice(0, 5),
      comment,
    })
    return zapRequest
  }

  async requestInvoice(zapEndpoint, zapRequest) {
    const response = await fetch(zapEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zap_request: JSON.stringify(zapRequest) }),
    })

    if (!response.ok) {
      throw new Error(`Zap endpoint returned ${response.status}`)
    }

    const data = await response.json()
    if (!data.pr) {
      throw new Error('No payment request in response')
    }

    return { invoice: data.pr, amount: data.amount, description: data.description }
  }

  async payInvoice(invoice) {
    if (!this.nwcClient) {
      throw new Error('NWC client not initialized')
    }

    const result = await this.nwcClient.payInvoice(invoice)
    return { success: true, preimage: result.preimage }
  }

  async unlockContent(articleEvent, nwcUrl, amountSats, comment = '') {
    try {
      await this.initialize(nwcUrl)
      const zapEndpoint = await this.getZapEndpoint(articleEvent.pubkey)
      const zapRequest = this.createZapRequest(articleEvent, amountSats, comment)
      const invoiceData = await this.requestInvoice(zapEndpoint, zapRequest)
      const paymentResult = await this.payInvoice(invoiceData.invoice)

      return {
        success: true,
        invoice: invoiceData.invoice,
        amount: invoiceData.amount,
        preimage: paymentResult.preimage,
      }
    } catch (error) {
      console.error('Content unlock failed:', error)
      throw error
    } finally {
      this.close()
    }
  }

  close() {
    if (this.nwcClient) {
      this.nwcClient.close()
      this.nwcClient = null
    }
  }
}

export const nwcPaymentHandler = new NWCPaymentHandler()
