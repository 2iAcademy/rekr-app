-- Rekr now serves companies of every size, not only TPE / PME: `ETI` and `GE`
-- come back, after the two values the enum already holds.
--
-- `ADD VALUE` only widens the type, so no existing row needs a cast, and
-- `IF NOT EXISTS` lets a retry run cleanly if one statement already landed.
ALTER TYPE "company_size" ADD VALUE IF NOT EXISTS 'ETI' AFTER 'PME';
ALTER TYPE "company_size" ADD VALUE IF NOT EXISTS 'GE' AFTER 'ETI';
