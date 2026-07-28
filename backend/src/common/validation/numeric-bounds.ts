/**
 * Upper bounds for the numeric columns the API writes.
 *
 * `@Min(0)` alone leaves every one of these fields open at the top over a
 * column that is not. Unbounded, a salary of 3e9 or a latitude of 12345678901
 * passes validation, crosses the service, opens a transaction, and is refused
 * by Postgres as P2020. The Prisma filter turns that into a 400, which is the
 * right status and the wrong place: the answer names no field, so the client
 * is told "a value is out of range" and left to guess which one.
 *
 * Bounding at the DTO keeps the rejection diagnosable and stops the request
 * before it reaches the database. P2020 stays mapped as a safety net for any
 * numeric path that has no explicit bound yet, not as the primary guard.
 */

// Postgres `int4`, the storage behind every `Int` column in the schema.
export const MAX_INT4 = 2_147_483_647;

// `Decimal(10, 7)` could hold up to 999.9999999, but the coordinates are
// geographic: anything outside these ranges is not a value the column is too
// small for, it is a point that does not exist.
export const MIN_LATITUDE = -90;
export const MAX_LATITUDE = 90;
export const MIN_LONGITUDE = -180;
export const MAX_LONGITUDE = 180;
