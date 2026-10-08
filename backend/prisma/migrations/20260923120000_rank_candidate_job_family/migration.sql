-- Which of the trades a candidate named is the one that matters most.
--
-- The composite key held a set, and the array the API accepted was stored in
-- no particular order, so « the first trade » did not exist in the database.
-- The rank makes it exist: 0 is the primary, the others follow.
--
-- Every row already written reads 0. No intention can be recovered from them —
-- the onboarding screen sorted the selection by the reference list, not by
-- preference — so none of them is elected: `primaryJobFamilyOf` reads several
-- trades sharing rank 0 as « none preferred », and the feed ranks those
-- accounts exactly as before until the candidate chooses from their profile.

-- AlterTable
ALTER TABLE "candidate_job_family" ADD COLUMN     "rank" SMALLINT NOT NULL DEFAULT 0;
