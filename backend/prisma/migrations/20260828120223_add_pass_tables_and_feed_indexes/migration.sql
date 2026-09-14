-- CreateTable
CREATE TABLE "candidate_passes_offer" (
    "fk_user_candidate" INTEGER NOT NULL,
    "fk_offer" INTEGER NOT NULL,
    "passed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_passes_offer_pkey" PRIMARY KEY ("fk_user_candidate","fk_offer")
);

-- CreateTable
CREATE TABLE "recruiter_passes_candidate" (
    "fk_user_recruiter" INTEGER NOT NULL,
    "fk_user_candidate" INTEGER NOT NULL,
    "passed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_passes_candidate_pkey" PRIMARY KEY ("fk_user_recruiter","fk_user_candidate")
);

-- CreateIndex
CREATE INDEX "candidate_profile_created_at_fk_user_idx" ON "candidate_profile"("created_at" DESC, "fk_user" DESC);

-- CreateIndex
CREATE INDEX "offer_status_created_at_id_idx" ON "offer"("status", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "candidate_passes_offer" ADD CONSTRAINT "candidate_passes_offer_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_passes_offer" ADD CONSTRAINT "candidate_passes_offer_fk_offer_fkey" FOREIGN KEY ("fk_offer") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_passes_candidate" ADD CONSTRAINT "recruiter_passes_candidate_fk_user_recruiter_fkey" FOREIGN KEY ("fk_user_recruiter") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_passes_candidate" ADD CONSTRAINT "recruiter_passes_candidate_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
