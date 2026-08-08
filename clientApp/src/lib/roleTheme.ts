/**
 * Values accepted by the `data-role` attribute that switches the role palette.
 *
 * They mirror the `UserType` enum so the theme can be driven straight from the
 * authenticated user, with no translation step — an earlier French/English
 * mismatch silently fell back to the candidate palette on every recruiter
 * screen. Any change here must be mirrored by the `[data-role=…]` scopes in
 * `index.css`; nothing checks that automatically (Vitest loads no CSS).
 */
export const ROLE_THEMES = ['candidate', 'recruiter'] as const;

export type RoleTheme = (typeof ROLE_THEMES)[number];
