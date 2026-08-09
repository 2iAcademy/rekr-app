/**
 * The backend DTOs mark optional fields `@IsOptional()`, which skips validation
 * on `undefined` only — an empty string is still validated, and `siteUrl: ''`
 * would fail `@IsUrl`. So unset fields have to be absent from the body, not
 * present-and-empty.
 */
export const withoutEmptyFields = <T extends object>(source: T): T =>
  Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined)) as T;

export const optionalText = (value: string): string | undefined => value.trim() || undefined;

export const optionalList = <T>(values: T[]): T[] | undefined =>
  values.length > 0 ? values : undefined;

export const optionalInteger = (value: string): number | undefined => {
  const parsed = Number.parseInt(value, 10);

  return Number.isNaN(parsed) ? undefined : parsed;
};

export const optionalEnum = <T extends string>(value: T | ''): T | undefined => value || undefined;
