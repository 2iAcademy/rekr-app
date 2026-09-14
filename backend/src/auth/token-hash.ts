import { createHash } from 'node:crypto';

/**
 * SHA-256 rather than bcrypt, which is the opposite of what the password column
 * does — deliberately. bcrypt salts each entry, which rules out any indexed
 * lookup, and these rows must be found *from* the presented token. Its cost
 * also exists to slow a dictionary attack against a low-entropy secret; these
 * are 256 bits of cryptographic randomness, so there is no dictionary to walk.
 * What matters is preserved: a database dump yields nothing usable.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
