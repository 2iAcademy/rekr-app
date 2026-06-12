-- AlterTable
ALTER TABLE "user" ALTER COLUMN "email" SET DATA TYPE VARCHAR(255);

-- AddForeignKey
ALTER TABLE "candidate_profile" ADD CONSTRAINT "candidate_profile_fk_user_fkey" FOREIGN KEY ("fk_user") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profile" ADD CONSTRAINT "recruiter_profile_fk_user_fkey" FOREIGN KEY ("fk_user") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profile" ADD CONSTRAINT "recruiter_profile_fk_company_fkey" FOREIGN KEY ("fk_company") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_fk_sector_fkey" FOREIGN KEY ("fk_sector") REFERENCES "sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_fk_user_created_fkey" FOREIGN KEY ("fk_user_created") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer" ADD CONSTRAINT "offer_fk_company_fkey" FOREIGN KEY ("fk_company") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_tag" ADD CONSTRAINT "offer_tag_fk_tag_fkey" FOREIGN KEY ("fk_tag") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_tag" ADD CONSTRAINT "offer_tag_fk_offer_fkey" FOREIGN KEY ("fk_offer") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tag" ADD CONSTRAINT "candidate_tag_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_tag" ADD CONSTRAINT "candidate_tag_fk_tag_fkey" FOREIGN KEY ("fk_tag") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_likes_offer" ADD CONSTRAINT "candidate_likes_offer_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_likes_offer" ADD CONSTRAINT "candidate_likes_offer_fk_offer_fkey" FOREIGN KEY ("fk_offer") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_likes_candidate" ADD CONSTRAINT "recruiter_likes_candidate_fk_user_recruiter_fkey" FOREIGN KEY ("fk_user_recruiter") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_likes_candidate" ADD CONSTRAINT "recruiter_likes_candidate_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
