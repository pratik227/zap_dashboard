/**
 * SignerService — unified signer abstraction powered by nostr-core.
 *
 * Supports three signer backends:
 *   1. NIP-07 browser extension (Alby, nos2x, etc.) via Nip07Signer
 *   2. NIP-46 remote signer (nsec.app, Amber, etc.) via NostrConnect
 *   3. Local secret key (nsec / seed phrase) via createSecretKeySigner
 *
 * All code that needs to sign events, get pubkeys, or encrypt/decrypt
 * should go through this service. Never touch window.nostr directly.
 */

import {
  Nip07Signer,
  getExtension,
  createSecretKeySigner,
  NostrConnect,
  parseConnectionURI,
  nip06,
  nip19,
  hexToBytes,
  Nip07Error,
  Nip07NotAvailableError,
} from './nostrImports.js'

/** @enum {string} Signer type identifiers */
export const SignerType = {
  EXTENSION: 'extension',
  REMOTE: 'remote',
  LOCAL: 'local',
}

class SignerService {
  constructor() {
    /** @type {import('nostr-core').Signer|null} */
    this._signer = null
    /** @type {string|null} */
    this._signerType = null
    /** @type {NostrConnect|null} — kept for disconnect lifecycle */
    this._nostrConnect = null
  }

  // ── State ───────────────────────────────────────────────────────

  /** Current active signer (implements nostr-core Signer interface) */
  get signer() { return this._signer }

  /** Active signer type: 'extension' | 'remote' | 'local' | null */
  get signerType() { return this._signerType }

  /** Whether a signer is currently active */
  get isConnected() { return this._signer !== null }

  // ── NIP-07: Browser Extension ───────────────────────────────────

  /**
   * Check if a NIP-07 browser extension is available.
   */
  isExtensionAvailable() {
    try {
      return !!getExtension()
    } catch {
      return false
    }
  }

  /**
   * Connect using the browser's NIP-07 extension (Alby, nos2x, etc.).
   * @returns {Promise<string>} hex pubkey
   */
  async connectExtension() {
    await this.disconnect()

    const ext = getExtension()
    if (!ext) {
      throw new Nip07NotAvailableError(
        'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 browser extension.'
      )
    }

    const signer = new Nip07Signer()
    // Verify extension responds
    const pubkey = await signer.getPublicKey()

    this._signer = signer
    this._signerType = SignerType.EXTENSION
    return pubkey
  }

  // ── NIP-46: Remote Signer (Nostr Connect / Bunker) ──────────────

  /**
   * Connect to a remote signer via bunker:// URI or nostrconnect:// URI.
   * @param {string} uri — bunker://... or nostrconnect://...
   * @param {object} [opts] — { timeout?: number }
   * @returns {Promise<string>} hex pubkey
   */
  async connectRemote(uri, { timeout = 60_000 } = {}) {
    await this.disconnect()

    const nc = new NostrConnect(uri)
    nc.timeout = timeout

    await nc.connect()

    this._nostrConnect = nc
    this._signer = nc
    this._signerType = SignerType.REMOTE

    return await nc.getPublicKey()
  }

  // ── Local Secret Key ────────────────────────────────────────────

  /**
   * Connect with a local secret key (nsec bech32 or hex).
   * @param {string} keyInput — nsec1... or 64-char hex
   * @returns {Promise<string>} hex pubkey
   */
  async connectWithSecret(keyInput) {
    await this.disconnect()

    let secretKey
    if (keyInput.startsWith('nsec1')) {
      const decoded = nip19.decode(keyInput)
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec format')
      }
      secretKey = decoded.data
    } else {
      // Assume hex
      secretKey = hexToBytes(keyInput)
    }

    const signer = createSecretKeySigner(secretKey)
    const pubkey = await signer.getPublicKey()

    this._signer = signer
    this._signerType = SignerType.LOCAL
    return pubkey
  }

  /**
   * Connect with a BIP-39 seed phrase (NIP-06).
   * @param {string} mnemonic — 12 or 24 word seed phrase
   * @param {number} [accountIndex=0] — derivation account index
   * @param {string} [passphrase] — optional BIP-39 passphrase
   * @returns {Promise<string>} hex pubkey
   */
  async connectWithSeed(mnemonic, accountIndex = 0, passphrase) {
    await this.disconnect()

    if (!nip06.validateMnemonic(mnemonic)) {
      throw new Error('Invalid seed phrase. Please check your words and try again.')
    }

    const { secretKey } = nip06.mnemonicToKey(mnemonic, accountIndex, passphrase)
    const signer = createSecretKeySigner(secretKey)
    const pubkey = await signer.getPublicKey()

    this._signer = signer
    this._signerType = SignerType.LOCAL
    return pubkey
  }

  // ── Auto-detect Connect ─────────────────────────────────────────

  /**
   * Auto-detect connection method from input.
   * - bunker:// or nostrconnect:// → NIP-46 remote
   * - nsec1... → local secret key
   * - 64-char hex → local secret key
   * - no input → NIP-07 extension
   * @param {string} [input] — optional connection string
   * @returns {Promise<string>} hex pubkey
   */
  async connect(input) {
    if (!input) {
      return this.connectExtension()
    }

    if (input.startsWith('bunker://') || input.startsWith('nostrconnect://')) {
      return this.connectRemote(input)
    }

    if (input.startsWith('nsec1') || /^[a-f0-9]{64}$/i.test(input)) {
      return this.connectWithSecret(input)
    }

    // Try as seed phrase (space-separated words)
    if (input.includes(' ') && input.split(/\s+/).length >= 12) {
      return this.connectWithSeed(input)
    }

    throw new Error('Unrecognized input. Provide a NIP-07 extension, bunker:// URI, nsec, hex key, or seed phrase.')
  }

  // ── Disconnect ──────────────────────────────────────────────────

  /**
   * Disconnect the current signer and clean up resources.
   */
  async disconnect() {
    if (this._nostrConnect) {
      try {
        await this._nostrConnect.disconnect()
      } catch {
        // best-effort
      }
      try {
        this._nostrConnect.close()
      } catch {
        // best-effort
      }
      this._nostrConnect = null
    }

    this._signer = null
    this._signerType = null
  }

  // ── Signer Interface (delegated) ────────────────────────────────

  /**
   * Get the user's public key from the active signer.
   * @returns {Promise<string>} hex pubkey
   */
  async getPublicKey() {
    this._requireSigner()
    return this._signer.getPublicKey()
  }

  /**
   * Sign an event template.
   * @param {object} eventTemplate — { kind, content, tags, created_at }
   * @returns {Promise<object>} signed event with id and sig
   */
  async signEvent(eventTemplate) {
    this._requireSigner()
    return this._signer.signEvent(eventTemplate)
  }

  /**
   * Encrypt content for a recipient.
   * Prefers NIP-44 (modern), falls back to NIP-04 (legacy).
   * @param {string} pubkey — recipient hex pubkey
   * @param {string} plaintext
   * @param {'nip44'|'nip04'} [preferredNip='nip44']
   * @returns {Promise<{ciphertext: string, nip: 'nip44'|'nip04'}>}
   */
  async encrypt(pubkey, plaintext, preferredNip = 'nip44') {
    this._requireSigner()

    const order = preferredNip === 'nip44'
      ? ['nip44', 'nip04']
      : ['nip04', 'nip44']

    for (const nip of order) {
      if (this._signer[nip]?.encrypt) {
        try {
          const ciphertext = await this._signer[nip].encrypt(pubkey, plaintext)
          return { ciphertext, nip }
        } catch (err) {
          // Try next method
          continue
        }
      }
    }

    throw new Error('Signer does not support encryption (neither NIP-44 nor NIP-04).')
  }

  /**
   * Decrypt content from a sender.
   * @param {string} pubkey — sender hex pubkey
   * @param {string} ciphertext
   * @param {'nip44'|'nip04'} [nip] — which NIP to use (auto-detect if omitted)
   * @returns {Promise<string>} plaintext
   */
  async decrypt(pubkey, ciphertext, nip) {
    this._requireSigner()

    // If specific NIP requested, use it
    if (nip && this._signer[nip]?.decrypt) {
      return this._signer[nip].decrypt(pubkey, ciphertext)
    }

    // Auto-detect NIP-04 format: contains ?iv=
    if (typeof ciphertext === 'string' && ciphertext.includes('?iv=')) {
      if (this._signer.nip04?.decrypt) {
        return this._signer.nip04.decrypt(pubkey, ciphertext)
      }
    }

    // Try NIP-44 first (modern), then NIP-04 (legacy)
    if (this._signer.nip44?.decrypt) {
      try {
        return await this._signer.nip44.decrypt(pubkey, ciphertext)
      } catch {
        // fall through to NIP-04
      }
    }

    if (this._signer.nip04?.decrypt) {
      return this._signer.nip04.decrypt(pubkey, ciphertext)
    }

    throw new Error('Signer does not support decryption.')
  }

  /**
   * Get relays from the signer (if supported).
   * @returns {Promise<object>} relay map { url: { read, write } }
   */
  async getRelays() {
    if (!this._signer?.getRelays) return {}
    try {
      return await this._signer.getRelays()
    } catch {
      return {}
    }
  }

  // ── NIP-06 Seed Utilities (static) ──────────────────────────────

  /**
   * Generate a new BIP-39 seed phrase.
   * @param {12|24} [wordCount=12]
   * @returns {string} mnemonic
   */
  static generateMnemonic(wordCount = 12) {
    return nip06.generateMnemonic(wordCount)
  }

  /**
   * Validate a BIP-39 seed phrase.
   * @param {string} mnemonic
   * @returns {boolean}
   */
  static validateMnemonic(mnemonic) {
    return nip06.validateMnemonic(mnemonic)
  }

  /**
   * Parse a NIP-46 connection URI (bunker:// or nostrconnect://).
   * @param {string} uri
   * @returns {object} parsed connection options + app metadata
   */
  static parseConnectionURI(uri) {
    return parseConnectionURI(uri)
  }

  // ── Internal ────────────────────────────────────────────────────

  _requireSigner() {
    if (!this._signer) {
      throw new Error('No signer connected. Call connect(), connectExtension(), connectRemote(), or connectWithSecret() first.')
    }
  }
}

// Singleton
export const signerService = new SignerService()
