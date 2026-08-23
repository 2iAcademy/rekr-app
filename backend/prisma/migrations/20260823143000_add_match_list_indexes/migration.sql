-- Candidate lists are filtered by candidate then ordered by newest match.
CREATE INDEX "match_fk_user_candidate_matched_at_idx"
ON "match"("fk_user_candidate", "matched_at");

-- Recruiter lists traverse company offers before ordering matched rows.
CREATE INDEX "offer_fk_company_idx" ON "offer"("fk_company");
CREATE INDEX "match_fk_offer_matched_at_idx"
ON "match"("fk_offer", "matched_at");
