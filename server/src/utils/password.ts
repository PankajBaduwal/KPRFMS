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
