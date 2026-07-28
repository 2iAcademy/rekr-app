import { randomBytes } from 'node:crypto';
import { seal, unseal } from './successor-seal';

const aToken = () => randomBytes(32).toString('base64url');

describe('successor seal', () => {
  it('round-trips the successor for whoever presents the predecessor', () => {
    const predecessor = aToken();
    const successor = aToken();

    expect(unseal(seal(successor, predecessor), predecessor)).toBe(successor);
  });

  /**
   * The whole point: the key never lives in the database. A dump yields the
   * predecessor's SHA-256 and this blob, and neither opens the other.
   */
  it('is opaque to anyone holding the blob but not the predecessor', () => {
    const successor = aToken();

    expect(unseal(seal(successor, aToken()), aToken())).toBeNull();
  });

  it('does not leak the successor into the blob', () => {
    const successor = aToken();

    expect(seal(successor, aToken())).not.toContain(successor);
  });

  /** GCM authenticates: a flipped byte fails to open rather than decrypting
   * to garbage that the caller would then look up as a token. */
  it('refuses a tampered blob', () => {
    const predecessor = aToken();
    const blob = seal(aToken(), predecessor);
    const tampered = `${blob.slice(0, -2)}${blob.endsWith('A') ? 'B' : 'A'}=`;

    expect(unseal(tampered, predecessor)).toBeNull();
  });

  it('returns null on a malformed blob instead of throwing', () => {
    expect(unseal('', aToken())).toBeNull();
    expect(unseal('not-base64url!!', aToken())).toBeNull();
    expect(unseal('AAAA', aToken())).toBeNull();
  });

  it('never produces the same blob twice for the same input', () => {
    const predecessor = aToken();
    const successor = aToken();

    expect(seal(successor, predecessor)).not.toBe(seal(successor, predecessor));
  });

  it('fits the column width', () => {
    expect(seal(aToken(), aToken()).length).toBeLessThanOrEqual(128);
  });
});
