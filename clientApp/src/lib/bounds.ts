/**
 * Mirrors the backend caps so the form refuses what the API would reject:
 * `MAX_SKILLS` / `MAX_BENEFITS` (both 50) and `MAX_TAG_LABEL_LENGTH` from
 * `backend/src/common/tags/tag-bounds.ts`, `MAX_FREE_TEXT_LENGTH` from
 * `backend/src/common/validation/text-bounds.ts`.
 */
export const MAX_TAGS = 50;
export const MAX_TAG_LABEL_LENGTH = 100;
export const MAX_FREE_TEXT_LENGTH = 5000;

/**
 * Salaries are `@Max(MAX_INT4)` server-side (2_147_483_647). Capping the input
 * at 9 digits keeps every reachable value under that ceiling, so a typo cannot
 * turn into a 400 after the company has already been created.
 */
export const MAX_SALARY_DIGITS = 9;
