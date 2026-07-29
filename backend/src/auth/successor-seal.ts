import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const INFO = 'rekr-refresh-successor';

/**
 * The key is derived from the predecessor token itself, which is the one thing
 * the database never holds — only its SHA-256 is stored. So a dump yields
 * `token_hash` and this blob, and neither opens the other: reading a successor
 * requires presenting the predecessor in clear, which is exactly the client we
 * are willing to serve. That keeps the promise made in the design ("a database
 * dump yields no usable session") while letting a lost rotation race replay the
 * winner's token instead of forking the family.
 *
 * No salt: the input is 256 bits of cryptographic randomness, not a passphrase,
 * so HKDF has nothing to stretch.
 */
const keyFor = (predecessorToken: string): Buffer =>
  Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(predecessorToken, 'utf8'),
      Buffer.alloc(0),
      Buffer.from(INFO, 'utf8'),
      KEY_BYTES,
    ),
  );

export function seal(successorToken: string, predecessorToken: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFor(predecessorToken), iv);
  const ciphertext = Buffer.concat([
    cipher.update(successorToken, 'utf8'),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    'base64url',
  );
}

/**
 * Null rather than a throw on every failure path — a blob that will not open is
 * a fact about the request, not an exception. The caller treats it exactly like
 * an absent successor: reuse.
 */
export function unseal(blob: string, predecessorToken: string): string | null {
  try {
    const raw = Buffer.from(blob, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) {
      return null;
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFor(predecessorToken),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));

    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
