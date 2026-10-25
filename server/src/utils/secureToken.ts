import crypto from 'crypto';

/** URL-safe random token (default 32 bytes of entropy). */
export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Uniformly random numeric code, e.g. "042917". */
export function numericCode(digits = 6): string {
  return crypto.randomInt(0, 10 ** digits).toString().padStart(digits, '0');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
