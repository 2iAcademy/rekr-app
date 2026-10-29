/**
 * Mirrors `backend/src/account/privacy-policy.ts`. The server stores the
 * version at sign-up and applies the retention period; this side prints both.
 * They move together or the text says something the code does not do.
 */
export const PRIVACY_POLICY_VERSION_LABEL = 'Version du 29 octobre 2026';

export const INACTIVE_ACCOUNT_RETENTION_MONTHS = 24;

export const AUDIT_EVENT_RETENTION_MONTHS = 12;
