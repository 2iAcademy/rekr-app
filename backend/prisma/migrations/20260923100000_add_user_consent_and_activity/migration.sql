-- AlterTable
ALTER TABLE "user" ADD COLUMN     "last_active_at" TIMESTAMPTZ(6),
ADD COLUMN     "terms_accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "terms_version" VARCHAR(20);

-- Existing accounts start their retention clock at their last known change
-- rather than at NULL, which the purge would otherwise have to guess about.
UPDATE "user" SET "last_active_at" = "updated_at";
