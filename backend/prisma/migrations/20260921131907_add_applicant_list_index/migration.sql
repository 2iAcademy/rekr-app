-- The applicants list filters this pivot by the offer, and the likes a company
-- received reach it through that same column; neither is served by the primary
-- key, whose leading column is the candidate. Both reads also carry the
-- ordering columns, so listing them here keeps the scan index-only.
CREATE INDEX "candidate_likes_offer_fk_offer_liked_at_fk_user_candidate_idx"
ON "candidate_likes_offer"("fk_offer", "liked_at", "fk_user_candidate");
