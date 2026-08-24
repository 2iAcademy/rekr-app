/**
 * Upper bounds for the numeric columns the API writes.
 *
 * `@Min(0)` alone leaves every one of these fields open at the top over a
 * column that is not. Unbounded, a salary of 3e9 passes validation, crosses
 * the service, opens a transaction, and is refused by Postgres as P2020. The
 * Prisma filter turns that into a 400, which is the right status and the wrong
 * place: the answer names no field, so the client is told "a value is out of
 * range" and left to guess which one.
 *
 * Bounding at the DTO keeps the rejection diagnosable and stops the request
 * before it reaches the database. P2020 stays mapped as a safety net for any
 * numeric path that has no explicit bound yet, not as the primary guard.
 */

// Postgres `int4`, the storage behind every `Int` column in the schema.
export const MAX_INT4 = 2_147_483_647;
