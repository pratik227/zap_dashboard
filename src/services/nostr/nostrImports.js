/**
 * nostrImports.js — Single source of truth for all Nostr protocol imports.
 *
 * Every file in the codebase that needs Nostr primitives should import
 * from HERE, never directly from 'nostr-core'.
 *
 * Re-exports the full nostr-core v0.6.0 API surface.
 */

// ── Event handling ────────────────────────────────────────────────
export {
  finalizeEvent,
  verifyEvent,
  getEventHash,
  serializeEvent,
  validateEvent,
  verifiedSymbol,
} from 'nostr-core'

// ── Crypto / Key management ──────────────────────────────────────
export {
  generateSecretKey,
  getPublicKey,
} from 'nostr-core'

// ── Relay & Pool ─────────────────────────────────────────────────
export {
  Relay,
  RelayPool,
} from 'nostr-core'

// ── Signer ───────────────────────────────────────────────────────
export {
  Nip07Signer,
  getExtension,
  createSecretKeySigner,
  Nip07Error,
  Nip07NotAvailableError,
} from 'nostr-core'

// ── NIP-46: Remote Signer (Nostr Connect / Bunker) ───────────────
export {
  NostrConnect,
  parseConnectionURI,
  Nip46Error,
  Nip46TimeoutError,
  Nip46ConnectionError,
  Nip46RemoteError,
} from 'nostr-core'

// ── NWC (Nostr Wallet Connect) ───────────────────────────────────
export { NWC } from 'nostr-core'

// ── Error types ──────────────────────────────────────────────────
export {
  NWCError,
  NWCWalletError,
  NWCTimeoutError,
  NWCPublishTimeoutError,
  NWCReplyTimeoutError,
  NWCPublishError,
  NWCConnectionError,
  NWCDecryptionError,
  LightningAddressError,
  FiatConversionError,
  Nip05Error,
  ZapError,
  LnurlError,
} from 'nostr-core'

// ── Lightning Address ────────────────────────────────────────────
export {
  fetchInvoice,
  validateLightningAddress,
  parseLightningAddress,
} from 'nostr-core'

// ── Fiat conversion ──────────────────────────────────────────────
export {
  getExchangeRate,
  fiatToSats,
  satsToFiat,
} from 'nostr-core'

// ── LNURL ────────────────────────────────────────────────────────
export { lnurl } from 'nostr-core'
export {
  encodeLnurl,
  decodeLnurl,
  isLnurl,
  fetchPayRequest,
  parseLnurlMetadata,
} from 'nostr-core'

// ── Encoding / Utils ─────────────────────────────────────────────
export {
  normalizeURL,
  bytesToHex,
  hexToBytes,
  randomBytes,
} from 'nostr-core'

// ── Filter matching ──────────────────────────────────────────────
export {
  matchFilter,
  matchFilters,
} from 'nostr-core'

// ── NIP namespace re-exports ─────────────────────────────────────
// Full NIP module access: import { nip57 } from '...'
export {
  nip02,
  nip04,
  nip05,
  nip06,
  nip09,
  nip10,
  nip11,
  nip13,
  nip17,
  nip18,
  nip19,
  nip21,
  nip22,
  nip23,
  nip24,
  nip25,
  nip27,
  nip28,
  nip29,
  nip30,
  nip31,
  nip36,
  nip40,
  nip42,
  nip44,
  nip46,
  nip48,
  nip50,
  nip51,
  nip52,
  nip56,
  nip57,
  nip58,
  nip59,
  nip65,
  nip75,
  nip98,
} from 'nostr-core'

// ── NIP-19: bech32 convenience exports ───────────────────────────
import { nip19 as _nip19 } from 'nostr-core'
export const npubEncode = _nip19.npubEncode
export const nsecEncode = _nip19.nsecEncode
export const noteEncode = _nip19.noteEncode
export const neventEncode = _nip19.neventEncode
export const naddrEncode = _nip19.naddrEncode
export const nprofileEncode = _nip19.nprofileEncode
export const nip19Decode = _nip19.decode

// ── NIP-57: zaps ─────────────────────────────────────────────────
export {
  createZapRequestEventTemplate,
  createZapRequestEvent,
  parseZapReceipt,
  validateZapReceipt,
  fetchZapInvoice,
} from 'nostr-core'

// ── NIP-65: relay lists ──────────────────────────────────────────
export {
  parseRelayList,
  createRelayListEventTemplate,
  createRelayListEvent,
  getReadRelays,
  getWriteRelays,
} from 'nostr-core'

// ── NIP-05: DNS identity ─────────────────────────────────────────
export {
  queryNip05,
  verifyNip05,
  parseNip05Address,
} from 'nostr-core'

// ── NIP-02: contacts ─────────────────────────────────────────────
export {
  createFollowListEventTemplate,
  createFollowListEvent,
  parseFollowList,
  isFollowing,
  getFollowedPubkeys,
} from 'nostr-core'

// ── NIP-58: badges ───────────────────────────────────────────────
export {
  createBadgeDefinitionTemplate,
  createBadgeDefinitionEvent,
  parseBadgeDefinition,
  createBadgeAwardTemplate,
  createBadgeAwardEvent,
  parseBadgeAward,
  createProfileBadgesTemplate,
  createProfileBadgesEvent,
  parseProfileBadges,
} from 'nostr-core'

// ── NIP-23: long-form content ────────────────────────────────────
export {
  createLongFormEventTemplate,
  createLongFormEvent,
  parseLongForm,
} from 'nostr-core'

// ── NIP-25: reactions ────────────────────────────────────────────
export {
  createReactionEventTemplate,
  createReactionEvent,
  parseReaction,
} from 'nostr-core'

// ── NIP-09: deletion ─────────────────────────────────────────────
export {
  createDeletionEventTemplate,
  createDeletionEvent,
} from 'nostr-core'

// ── NIP-18: reposts ──────────────────────────────────────────────
export {
  createRepostEventTemplate,
  createRepostEvent,
  parseRepost,
} from 'nostr-core'

// ── NIP-59: sealed events (gift wrap) ────────────────────────────
export {
  createRumor,
  createSeal,
  createWrap,
} from 'nostr-core'

// ── NIP-17: private DMs ──────────────────────────────────────────
export {
  wrapDirectMessage,
  unwrapDirectMessage,
} from 'nostr-core'

// ── NIP-51: lists ────────────────────────────────────────────────
export {
  createListTemplate as createListEventTemplate,
  createListEvent,
} from 'nostr-core'

// ── NIP-13: proof of work ────────────────────────────────────────
export {
  countLeadingZeroBits,
  getPowDifficulty,
  verifyPow,
  minePow,
} from 'nostr-core'

// ── NIP-75: zap goals ───────────────────────────────────────────
export {
  createZapGoalTemplate,
  createZapGoalEvent,
  parseZapGoal,
  isZapGoalOpen,
  calculateZapGoalProgress,
  buildGoalTag,
} from 'nostr-core'

// ── NIP-98: HTTP auth ────────────────────────────────────────────
export {
  createHttpAuthEventTemplate,
  createHttpAuthEvent,
  getAuthorizationHeader,
  verifyHttpAuthEvent,
} from 'nostr-core'

// ── NIP-42: relay auth ───────────────────────────────────────────
export {
  createAuthEventTemplate,
  createAuthEvent,
  verifyAuthEvent,
} from 'nostr-core'

// ── Blossom: media uploads (NIP-B7) ────────────────────────────
export {
  blossom,
} from 'nostr-core'

// ── BOLT-11: invoice decoding ──────────────────────────────────
// Shim: wraps light-bolt11-decoder to match nostr-core's future bolt11.decode() API.
// TODO: Replace with `export { bolt11, decodeBolt11 } from 'nostr-core'` once nostr-core ships the module.
import { decode as _decodeBolt11 } from 'light-bolt11-decoder'

export const bolt11 = {
  /**
   * Decode a BOLT-11 invoice string.
   * Returns the same shape nostr-core's bolt11.decode() will provide:
   *   { amountMsat, amountSat, paymentHash, expiry, expiresAt, isExpired,
   *     description, payeeNodeKey, timestamp }
   */
  decode(invoice) {
    const sections = _decodeBolt11(invoice).sections
    const get = (name) => sections.find((s) => s.name === name)?.value

    const amountMsat = get('amount') ? Number(get('amount')) : null
    const amountSat = amountMsat != null ? Math.round(amountMsat / 1000) : null
    const timestamp = get('timestamp') ?? null
    const expiry = get('expiry') ?? 3600 // BOLT-11 default
    const expiresAt = timestamp != null ? timestamp + expiry : null
    const isExpired = expiresAt != null ? Date.now() / 1000 > expiresAt : false
    const description = get('description') ?? null
    const paymentHash = get('payment_hash') ?? null
    const payeeNodeKey = get('payee') ?? null

    return {
      amountMsat,
      amountSat,
      paymentHash,
      expiry,
      expiresAt,
      isExpired,
      description,
      payeeNodeKey,
      timestamp,
    }
  },
}

/** Convenience alias matching the expected nostr-core named export */
export const decodeBolt11 = bolt11.decode

// ── Utility functions ────────────────────────────────────────────

/**
 * queryProfile — resolve a NIP-05 address to { pubkey, relays }.
 * Returns null on error (safe wrapper around queryNip05).
 */
import { queryNip05 as _queryNip05, decodeLnurl as _decodeLnurl } from 'nostr-core'
export async function queryProfile(address) {
  try {
    return await _queryNip05(address)
  } catch {
    return null
  }
}

/**
 * isNip05 — check if a string looks like a NIP-05 address (name@domain).
 */
const NIP05_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export function isNip05(value) {
  return NIP05_REGEX.test(value || '')
}

/**
 * makeZapRequest — create a zap request event template.
 * Maps the legacy { profile, event, amount, relays, comment } shape
 * to nostr-core's { recipientPubkey, eventId, amount, relays, content }.
 */
import { createZapRequestEventTemplate as _createZapRequest } from 'nostr-core'
export function makeZapRequest({ profile, event, amount, relays, comment = '' }) {
  const eventId = typeof event === 'string' ? event : event?.id
  return _createZapRequest({
    recipientPubkey: profile,
    eventId: eventId || undefined,
    amount,
    relays,
    content: comment,
  })
}

/**
 * getZapEndpoint — extract the LNURL-pay callback URL from a profile event.
 * Resolves lud16 (Lightning Address) or lud06 (LNURL) to the zap endpoint.
 */
export async function getZapEndpoint(profileEvent) {
  try {
    const content = JSON.parse(profileEvent.content || '{}')
    const lud16 = content.lud16
    const lud06 = content.lud06

    if (lud16) {
      const [name, domain] = lud16.split('@')
      if (name && domain) {
        const url = `https://${domain}/.well-known/lnurlp/${name}`
        const res = await fetch(url)
        if (!res.ok) return null
        const data = await res.json()
        if (data.allowsNostr && data.nostrPubkey) {
          return data.callback
        }
        return null
      }
    }

    if (lud06) {
      const url = _decodeLnurl(lud06)
      const res = await fetch(url)
      if (!res.ok) return null
      const data = await res.json()
      if (data.allowsNostr && data.nostrPubkey) {
        return data.callback
      }
    }

    return null
  } catch {
    return null
  }
}

// ── Kind constants ───────────────────────────────────────────────
export const LongFormArticle = 30023
