import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Cryptographically random temporary password that satisfies the complexity policy
 * (upper, lower, digit, special; 16 chars).
 */
export function generateTemporaryPassword(): string {
  const body = crypto.randomBytes(6).toString('hex'); // 12 lowercase hex chars
  return `Kp${body}@${crypto.randomInt(0, 10)}`;
}

/**
 * One-time password for an emailed invitation: 14 characters from an alphabet without look-alikes
 * (no 0/O, 1/l/I), always with upper case, lower case, a digit and one of the allowed symbols,
 * so it is easy to type from an email and passes the password policy (about 80 bits).
 */
export function generateOneTimePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@$!%*?&';
  const all = upper + lower + digits;
  const pick = (set: string) => set[crypto.randomInt(0, set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < 14) chars.push(pick(all));
  // Fisher-Yates shuffle so the guaranteed characters are not always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
