/**
 * The two figures the privacy policy commits to, held where the code that
 * honours them can read them. The client renders the same text; changing
 * either value here without changing it there is a promise broken in writing.
 *
 * `PRIVACY_POLICY_VERSION` is stored on the account at sign-up. Bump it when
 * the text changes in substance: consent is given to one version of it, and a
 * later rewrite is not covered by a checkbox ticked before it existed.
 */
export const PRIVACY_POLICY_VERSION = '2026-10-29';

/**
 * Two years without a sign-in, the CNIL reference for a recruitment database.
 * Counted on `user.last_active_at`, which every login and session refresh
 * moves forward.
 */
export const INACTIVE_ACCOUNT_RETENTION_MONTHS = 24;

/**
 * One year for the security journal (logins, password resets, deletions,
 * offer status changes), the upper bound the CNIL recommends for access logs.
 * Kept past the deletion of the account it concerns: proving who deleted an
 * account is one of the things the journal is for.
 */
export const AUDIT_EVENT_RETENTION_MONTHS = 12;
