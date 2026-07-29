/**
 * Cap for the free-text fields mapped on `@db.Text` columns (candidate bio,
 * company description, offer description).
 *
 * Without it the only ceiling was the implicit 100 kB body-parser limit, so a
 * single authenticated request could push ~100 kB straight into the database
 * and into every response that echoes the record back.
 */
export const MAX_FREE_TEXT_LENGTH = 5000;
