-- CreateTable
CREATE TABLE "match" (
    "id" SERIAL NOT NULL,
    "fk_user_candidate" INTEGER NOT NULL,
    "fk_offer" INTEGER NOT NULL,
    "fk_user_recruiter" INTEGER,
    "matched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "match_fk_user_candidate_fk_offer_key" ON "match"("fk_user_candidate", "fk_offer");

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_fk_offer_fkey" FOREIGN KEY ("fk_offer") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match" ADD CONSTRAINT "match_fk_user_recruiter_fkey" FOREIGN KEY ("fk_user_recruiter") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
