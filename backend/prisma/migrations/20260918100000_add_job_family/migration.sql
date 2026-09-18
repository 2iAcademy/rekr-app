-- The trade a post belongs to, and the trades a candidate is looking for.
--
-- Deliberately coarse — twenty rows — because its only job is to keep a bakery
-- out of a developer's feed, not to describe a career. A finer referential
-- (ROME) can replace it later without changing how the filter reads: the feed
-- compares identifiers, never words, so « Développeur » and « Dev » resolve to
-- the same row whatever the wording on either side.

-- AlterTable
-- Nullable: the offers written before job families existed have no trade, and
-- guessing one from their title would be worse than leaving it unset. The DTO
-- requires it on every new offer, and `findFeed` treats an offer without a
-- family as ineligible rather than as a wildcard.
ALTER TABLE "offer" ADD COLUMN     "fk_job_family" INTEGER;

-- CreateTable
CREATE TABLE "job_family" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "job_family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_job_family" (
    "fk_user_candidate" INTEGER NOT NULL,
    "fk_job_family" INTEGER NOT NULL,

    CONSTRAINT "candidate_job_family_pkey" PRIMARY KEY ("fk_user_candidate","fk_job_family")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_family_label_key" ON "job_family"("label");

-- CreateIndex
CREATE INDEX "candidate_job_family_fk_job_family_idx" ON "candidate_job_family"("fk_job_family");

-- CreateIndex
CREATE INDEX "offer_fk_job_family_status_idx" ON "offer"("fk_job_family", "status");

-- AddForeignKey
ALTER TABLE "candidate_job_family" ADD CONSTRAINT "candidate_job_family_fk_user_candidate_fkey" FOREIGN KEY ("fk_user_candidate") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_job_family" ADD CONSTRAINT "candidate_job_family_fk_job_family_fkey" FOREIGN KEY ("fk_job_family") REFERENCES "job_family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- `RESTRICT` rather than `CASCADE`: deleting a reference row must never delete
-- the offers that point at it.
ALTER TABLE "offer" ADD CONSTRAINT "offer_fk_job_family_fkey" FOREIGN KEY ("fk_job_family") REFERENCES "job_family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reference data, seeded here for the same reason as `sector`: the onboarding
-- and offer forms select from it, so it has to exist wherever the app runs.
-- `label` is unique, which makes this insert idempotent.
--
-- One or two words each, unlike `sector`. The candidate form shows all twenty
-- at once, so « Hôtellerie, Restauration & Alimentaire » wrapped over three
-- lines and turned a single field into a screenful. The wording is broader
-- than the label suggests — « Restauration » covers the bakery, « Espaces
-- verts » covers farm work — which is the price of a list that can be read at
-- a glance.
--
-- No « Autre » entry, deliberately, unlike `sector`. A sector only describes a
-- company and filters nothing, so its catch-all is harmless; a family decides
-- what enters a feed. A catch-all there would reopen the very bucket this
-- table exists to close — everyone who picked it would see everyone else's
-- unrelated trade. A trade that fits nowhere means this list is missing a row,
-- and that is a migration, not a runtime fallback.
INSERT INTO "job_family" ("label") VALUES
  ('Administratif'),
  ('Artisanat'),
  ('Automobile'),
  ('Banque'),
  ('Bâtiment'),
  ('Commerce'),
  ('Communication'),
  ('Énergie'),
  ('Espaces verts'),
  ('Formation'),
  ('Immobilier'),
  ('Industrie'),
  ('Informatique'),
  ('Juridique'),
  ('Logistique'),
  ('Propreté'),
  ('Restauration'),
  ('Ressources humaines'),
  ('Santé'),
  ('Sécurité')
ON CONFLICT ("label") DO NOTHING;
