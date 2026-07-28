/**
 * Upper bound on a submitted password.
 *
 * This is not bcrypt's 72-byte ceiling — `AuthService.preHashPassword` folds
 * the password into a fixed-size digest first, so any length hashes correctly.
 * It only keeps an absurd payload from reaching the hashing path at all, and
 * sits far above any legitimate passphrase or generated secret.
 *
 * Deliberately no composition rule alongside it: NIST SP 800-63B advises
 * against forcing character classes, which drive predictable substitutions and
 * password reuse. Length is the property that matters.
 */
export const MAX_PASSWORD_LENGTH = 512;
