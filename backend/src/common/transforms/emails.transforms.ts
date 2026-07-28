/**
 * Typed `unknown` on purpose: `class-transformer` hands the raw request value
 * over before any validation, so it can be a number, an object or null. The
 * previous `string` signature claimed otherwise — which made the `typeof` guard
 * below unreachable on paper, and forced every caller to pass an `any`
 * (`@typescript-eslint/no-unsafe-argument`).
 *
 * Non-string values are returned untouched and left to `@IsEmail()` to reject.
 */
export const normalizeEmail = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.trim().toLowerCase();
  }

  return value;
};
