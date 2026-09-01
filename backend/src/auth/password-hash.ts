import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

const SALT_ROUNDS = 12;

/**
 * bcrypt only hashes the first 72 bytes of its input and drops the rest
 * without raising: two passwords sharing a 72-byte prefix would open the same
 * account, and a long passphrase would be silently cut down. Folding the
 * password into a fixed-size digest first removes the ceiling entirely instead
 * of making the user carry it.
 *
 * The digest is base64-encoded, never passed as raw bytes: bcrypt treats a NUL
 * byte as end-of-string, so a binary digest containing one would truncate the
 * effective secret to whatever precedes it.
 */
export function preHashPassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('base64');
}

/**
 * The single entry point for turning a submitted password into a stored hash.
 * Signup and password reset must agree byte for byte on the pipeline — a reset
 * that skipped the pre-hash would write a credential login could never verify.
 */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(preHashPassword(password), SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(preHashPassword(password), passwordHash);
}
