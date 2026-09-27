ALTER TABLE "recruiter_passes_candidate"
ADD COLUMN "fk_offer" INTEGER NOT NULL;

ALTER TABLE "recruiter_passes_candidate"
DROP CONSTRAINT "recruiter_passes_candidate_pkey";

ALTER TABLE "recruiter_passes_candidate"
ADD CONSTRAINT "recruiter_passes_candidate_pkey"
PRIMARY KEY ("fk_user_recruiter", "fk_user_candidate", "fk_offer");

CREATE INDEX "recruiter_passes_candidate_fk_user_candidate_fk_offer_idx"
ON "recruiter_passes_candidate"("fk_user_candidate", "fk_offer");

ALTER TABLE "recruiter_passes_candidate"
ADD CONSTRAINT "recruiter_passes_candidate_fk_offer_fkey"
FOREIGN KEY ("fk_offer") REFERENCES "offer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;