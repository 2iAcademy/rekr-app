-- Rekr targets small and mid-sized service companies: `ETI` and `GE` are dropped
-- rather than kept "just in case".
--
-- The explicit transaction matters: without it Prisma commits each statement, so
-- a failure would leave `company_size_new` behind and every retry would die on
-- "type already exists".
BEGIN;

-- The cast below cannot narrow a value it does not know, so it would abort the
-- transaction with "invalid input value for enum", a message naming neither the
-- table nor the offending row — and leave the migration recorded as failed,
-- which makes every later `migrate deploy` exit on P3009. Fail loudly instead,
-- while the fix is still a backfill.
DO $$
DECLARE
  offending bigint;
BEGIN
  SELECT count(*) INTO offending FROM "company" WHERE "size"::text IN ('ETI', 'GE');

  IF offending > 0 THEN
    RAISE EXCEPTION
      'Cannot narrow company_size to TPE/PME: % company row(s) still use ETI or GE. Backfill them first.',
      offending;
  END IF;
END $$;

CREATE TYPE "company_size_new" AS ENUM ('TPE', 'PME');

ALTER TABLE "company"
  ALTER COLUMN "size" TYPE "company_size_new"
  USING ("size"::text::"company_size_new");

ALTER TYPE "company_size" RENAME TO "company_size_old";
ALTER TYPE "company_size_new" RENAME TO "company_size";
DROP TYPE "company_size_old";

COMMIT;
