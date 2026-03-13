/**
 * Web Crypto helpers for Echo.
 *
 * Provides AES-GCM encryption/decryption using keys derived via PBKDF2
 * from the user's password + email (used as salt). Keys are held in memory
 * only — never serialised to disk or localStorage.
 *
 * Uses browser-native Web Crypto API exclusively — no npm dependencies.
 */

const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 recommendation for PBKDF2-HMAC-SHA256
const KEY_LENGTH_BITS = 256;
const AES_ALGORITHM = "AES-GCM";
const IV_BYTES = 12; // 96-bit IV — standard for AES-GCM

/** In-memory key store — never written to disk */
let _encryptionKey: CryptoKey | null = null;

/**
 * Derive an AES-GCM CryptoKey from a password using PBKDF2.
 * The user's email is used as the salt so that the derived key is
 * unique per-account even if two users choose the same password.
 */
async function deriveKey(password: string, email: string): Promise<CryptoKey> {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(email.toLowerCase()),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: AES_ALGORITHM, length: KEY_LENGTH_BITS },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Initialise the in-memory encryption key.
 * Call this once after a successful login or registration.
 *
 * @param password - The user's plaintext password (used only for key derivation)
 * @param email    - The user's email address (used as PBKDF2 salt)
 */
export async function initializeKey(
  password: string,
  email: string
): Promise<void> {
  _encryptionKey = await deriveKey(password, email);
}

/**
 * Clear the in-memory key.
 * Call this on logout so that encrypted data in localStorage
 * cannot be decrypted until the user logs in again.
 */
export function clearKey(): void {
  _encryptionKey = null;
}

/**
 * Return the current in-memory key, or null if not initialised.
 * Callers should treat a null return as "user not authenticated".
 */
export function getKey(): CryptoKey | null {
  return _encryptionKey;
}

/**
 * Encrypt a plaintext string with AES-GCM.
 *
 * Returns a Base64-encoded string of the form `<iv>:<ciphertext>`,
 * where both components are Base64-encoded individually. This format
 * is safe for storage in localStorage values.
 *
 * @throws if no key has been initialised
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (_encryptionKey === null) {
    throw new Error("Encryption key not initialised — call initializeKey first");
  }

  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: AES_ALGORITHM, iv },
    _encryptionKey,
    enc.encode(plaintext)
  );

  const ivB64 = bufferToBase64(iv);
  const cipherB64 = bufferToBase64(new Uint8Array(cipherBuffer));
  return `${ivB64}:${cipherB64}`;
}

/**
 * Decrypt an AES-GCM ciphertext produced by {@link encrypt}.
 *
 * @param payload - The `<iv>:<ciphertext>` Base64 string
 * @returns The original plaintext string
 * @throws if the key is not initialised, the payload is malformed,
 *         or decryption fails (e.g. wrong key or tampered data)
 */
export async function decrypt(payload: string): Promise<string> {
  if (_encryptionKey === null) {
    throw new Error("Encryption key not initialised — call initializeKey first");
  }

  const parts = payload.split(":");
  if (parts.length !== 2) {
    throw new Error("Malformed encrypted payload — expected <iv>:<ciphertext>");
  }

  const [ivB64, cipherB64] = parts;
  const iv = base64ToBuffer(ivB64);
  const cipherBuffer = base64ToBuffer(cipherB64);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv },
    _encryptionKey,
    cipherBuffer
  );

  return new TextDecoder().decode(plainBuffer);
}

/* ── Internal helpers ── */

function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
