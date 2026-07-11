import { randomBytes } from 'crypto';

/**
 * Generate a human-typable one-time temporary password. Uses crypto-random bytes
 * mapped onto a base62 alphabet (no ambiguous characters excluded for simplicity)
 * so the result is ~10 chars and safe to read out loud or copy from the dashboard.
 * The plaintext is only ever returned once — callers hash it and never persist it.
 */
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
