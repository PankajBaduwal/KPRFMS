import crypto from 'crypto';
import { env } from '../config/env.js';
import { PRODUCT_NAME } from '../config/brand.js';

/**
 * Time-based one-time passwords (RFC 6238: 30 s steps, 6 digits, HMAC-SHA1) — the codes shown
 * by Google Authenticator, Microsoft Authenticator, Authy, etc.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return binary.toString().padStart(DIGITS, '0');
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Checks a code against the current step ±1 (clock drift). Returns the matched step, or null.
 * Steps at or before `lastUsedStep` are refused so a code cannot be replayed.
 */
export function verifyTotp(secret: string, code: string, lastUsedStep?: number, now = Date.now()): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(now);
  for (const candidate of [step - 1, step, step + 1]) {
    if (lastUsedStep !== undefined && candidate <= lastUsedStep) continue;
    const expected = totpCode(secret, candidate);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return candidate;
  }
  return null;
}

export function otpauthUrl(secret: string, accountName: string, issuer = PRODUCT_NAME): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// --- Secret encryption at rest (AES-256-GCM) ---------------------------------------------
// New secrets use TWO_FACTOR_KEY ("v2." prefix), so rotating JWT_SECRET no longer breaks
// two-factor sign-in. Secrets stored before that key existed were encrypted with a key derived
// from JWT_SECRET; they still decrypt and are re-encrypted with the new key on the next sign-in.

const V2_PREFIX = 'v2.';

function legacyKey(): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', env.JWT_SECRET, 'kpriet-fms', 'totp-secret-v1', 32));
}

function currentKey(): Buffer | null {
  if (!env.TWO_FACTOR_KEY) return null;
  return Buffer.from(crypto.hkdfSync('sha256', env.TWO_FACTOR_KEY, 'kpriet-fms', 'totp-secret-v2', 32));
}

function seal(plain: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

function open(sealed: string, key: Buffer): string {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptSecret(plain: string): string {
  const key = currentKey();
  return key ? V2_PREFIX + seal(plain, key) : seal(plain, legacyKey());
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith(V2_PREFIX)) {
    const key = currentKey();
    if (!key) throw new Error('TWO_FACTOR_KEY is not set, so this two-factor secret cannot be read');
    return open(stored.slice(V2_PREFIX.length), key);
  }
  return open(stored, legacyKey());
}

/** True when a stored secret should be re-encrypted with TWO_FACTOR_KEY. */
export function needsReencryption(stored: string): boolean {
  return Boolean(env.TWO_FACTOR_KEY) && !stored.startsWith(V2_PREFIX);
}

/** One-time recovery codes like "7KQ2-M9XD" for when the authenticator phone is lost. */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
