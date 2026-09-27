-- The legacy shape stored no offer, so a row cannot be mapped safely once a
-- recruiter can like the same candidate for several offers. These historical
-- likes are intentionally discarded before the offer scope becomes required.
DELETE FROM "recruiter_likes_candidate";

ALTER TABLE "recruiter_likes_candidate"
ADD COLUMN "fk_offer" INTEGER NOT NULL;

ALTER TABLE "recruiter_likes_candidate"
DROP CONSTRAINT "recruiter_likes_candidate_pkey";

ALTER TABLE "recruiter_likes_candidate"
ADD CONSTRAINT "recruiter_likes_candidate_pkey"
PRIMARY KEY ("fk_user_recruiter", "fk_user_candidate", "fk_offer");

CREATE INDEX "recruiter_likes_candidate_fk_user_candidate_fk_offer_idx"
ON "recruiter_likes_candidate"("fk_user_candidate", "fk_offer");

ALTER TABLE "recruiter_likes_candidate"
ADD CONSTRAINT "recruiter_likes_candidate_fk_offer_fkey"
FOREIGN KEY ("fk_offer") REFERENCES "offer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
