// What's Poppin — Security Init
// Safe localStorage wrapper + service worker registration

/**
 * SafeStorage — tamper-resistant localStorage wrapper.
 *
 * Every value is stored alongside an FNV-1a checksum (`key + '_c'`).
 * On read, the checksum is verified — tampered or missing values fall back
 * to a default. All operations are wrapped in try-catch so private browsing,
 * disabled storage, or quota-exceeded errors never crash the game.
 *
 * @example
 *   SafeStorage.set('highScore', 4200);
 *   SafeStorage.getInt('highScore', 0); // → 4200
 *   // Manually editing localStorage('highScore') invalidates the checksum
 *   SafeStorage.getInt('highScore', 0); // → 0 (tampered, returns fallback)
 */
const SafeStorage = {
  /** @private Per-install random salt — generated once, stored in localStorage. */
  _salt: null,

  /**
   * Return the per-install salt, creating one on first call.
   * The salt prevents pre-computed cheat scripts from working across
   * installations. Stored under a non-obvious key to deter casual tampering.
   * @returns {string} 16-char hex salt
   * @private
   */
  _getSalt() {
    if (this._salt) return this._salt;
    try {
      const stored = localStorage.getItem('_wp_sid');
      if (stored && /^[0-9a-f]{16}$/.test(stored)) {
        this._salt = stored;
        return this._salt;
      }
      // Generate cryptographically random salt when available, else Math.random
      let salt;
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const buf = new Uint8Array(8);
        crypto.getRandomValues(buf);
        salt = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
      } else {
        salt = Math.random().toString(16).slice(2, 18).padEnd(16, '0');
      }
      localStorage.setItem('_wp_sid', salt);
      this._salt = salt;
    } catch (_) {
      // Storage unavailable — use a session-only fallback
      this._salt = '0'.repeat(16);
    }
    return this._salt;
  },

  /**
   * Compute keyed FNV-1a hash of key + value + salt.
   *
   * Binds the storage key name into the digest so copying a valid
   * value+checksum pair between keys is detected (cross-key replay).
   * The per-install salt ensures the same value produces different
   * checksums on different devices.
   *
   * @param {string} key — storage key name (bound into hash)
   * @param {string} val — value to hash
   * @returns {string} base-36 encoded hash
   * @private
   */
  _checksum(key, val) {
    const material = this._getSalt() + ':' + key + ':' + val;
    let h = 0x811c9dc5;
    for (let i = 0; i < material.length; i++) {
      h ^= material.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  },

  /**
   * Validate a storage key — alphanumeric + underscores, max 64 chars.
   * Rejects keys that could be used for prototype pollution or storage abuse.
   * @param {string} key
   * @returns {boolean}
   * @private
   */
  _validKey(key) {
    return typeof key === 'string' && key.length > 0 && key.length <= 64 && /^[a-zA-Z0-9_]+$/.test(key);
  },

  /**
   * Read a string value from localStorage with checksum verification.
   * Missing checksums are treated as tampered (deletion bypass prevention).
   * @param {string} key — storage key
   * @param {*} fallback — returned if key is missing, tampered, or storage errors
   * @returns {string|*} stored value or fallback
   */
  get(key, fallback) {
    if (!this._validKey(key)) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const check = localStorage.getItem(key + '_c');
      // Missing checksum = tampered (prevents delete-checksum bypass)
      if (!check || check !== this._checksum(key, raw)) return fallback;
      return raw;
    } catch (_) { return fallback; }
  },

  /**
   * Read an integer from localStorage with validation and checksum.
   * Returns fallback if the stored value is NaN, negative, tampered,
   * or uses scientific/hex notation (only plain decimal digits accepted).
   * @param {string} key — storage key
   * @param {number} fallback — returned on any failure
   * @returns {number} parsed integer (≥ 0) or fallback
   */
  getInt(key, fallback) {
    const raw = this.get(key, null);
    if (raw === null) return fallback;
    // Reject scientific notation, hex, floats — only plain decimal digits
    if (!/^\d{1,10}$/.test(raw)) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  },

  /** Maximum value size in bytes — prevents localStorage abuse. */
  MAX_VALUE_SIZE: 1024,

  /**
   * Write a value to localStorage with an accompanying keyed checksum.
   * Rejects invalid keys and values exceeding 1KB.
   * Fails silently if storage is full, disabled, or in private browsing.
   * @param {string} key — storage key
   * @param {*} value — value to store (coerced to string)
   */
  set(key, value) {
    if (!this._validKey(key)) return;
    try {
      const str = String(value);
      if (str.length > this.MAX_VALUE_SIZE) return;
      localStorage.setItem(key, str);
      localStorage.setItem(key + '_c', this._checksum(key, str));
    } catch (_) { /* storage full or disabled — fail silently */ }
  },
};

window.SafeStorage = SafeStorage;

// Service worker registration
if ('serviceWorker' in navigator) {
  /* bundled inside Passionate Learning: the app owns the service worker */
}
