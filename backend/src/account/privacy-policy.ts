/**
 * The two figures the privacy policy commits to, held where the code that
 * honours them can read them. The client renders the same text; changing
 * either value here without changing it there is a promise broken in writing.
 *
 * `PRIVACY_POLICY_VERSION` is stored on the account at sign-up. Bump it when
 * the text changes in substance: consent is given to one version of it, and a
 * later rewrite is not covered by a checkbox ticked before it existed.
 */
export const PRIVACY_POLICY_VERSION = '2026-09-23';

/**
 * Two years without a sign-in, the CNIL reference for a recruitment database.
 * Counted on `user.last_active_at`, which every login and session refresh
 * moves forward.
 */
export const INACTIVE_ACCOUNT_RETENTION_MONTHS = 24;
