/*
  Warnings:

  - You are about to drop the column `code_postal` on the `candidate_profile` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `candidate_profile` table. All the data in the column will be lost.
  - You are about to drop the column `prenom` on the `candidate_profile` table. All the data in the column will be lost.
  - You are about to drop the column `ville` on the `candidate_profile` table. All the data in the column will be lost.
  - You are about to drop the column `code_postal` on the `company` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `company` table. All the data in the column will be lost.
  - You are about to drop the column `taille` on the `company` table. All the data in the column will be lost.
  - You are about to drop the column `ville` on the `company` table. All the data in the column will be lost.
  - You are about to drop the column `code_postal` on the `offer` table. All the data in the column will be lost.
  - You are about to drop the column `statut` on the `offer` table. All the data in the column will be lost.
  - You are about to drop the column `titre` on the `offer` table. All the data in the column will be lost.
  - You are about to drop the column `ville` on the `offer` table. All the data in the column will be lost.
  - You are about to drop the column `nom` on the `recruiter_profile` table. All the data in the column will be lost.
  - You are about to drop the column `prenom` on the `recruiter_profile` table. All the data in the column will be lost.
  - Added the required column `first_name` to the `candidate_profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `candidate_profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `recruiter_profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `recruiter_profile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "contract_type" AS ENUM ('CDI', 'CDD', 'ALTERNANCE', 'STAGE', 'FREELANCE', 'INTERIM');

-- CreateEnum
CREATE TYPE "experience_level" AS ENUM ('JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT');

-- CreateEnum
CREATE TYPE "remote_policy" AS ENUM ('ON_SITE', 'HYBRID', 'FULL_REMOTE');

-- CreateEnum
CREATE TYPE "availability" AS ENUM ('IMMEDIATE', 'WITHIN_DELAY', 'SPECIFIC_DATE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tag_category" ADD VALUE 'language';
ALTER TYPE "tag_category" ADD VALUE 'benefit';

-- AlterTable
ALTER TABLE "candidate_profile" DROP COLUMN "code_postal",
DROP COLUMN "nom",
DROP COLUMN "prenom",
DROP COLUMN "ville",
ADD COLUMN     "availability" "availability",
ADD COLUMN     "availability_date" TIMESTAMPTZ(6),
ADD COLUMN     "availability_delay_months" INTEGER,
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "contract_types" "contract_type"[],
ADD COLUMN     "cv_url" VARCHAR(255),
ADD COLUMN     "desired_job_title" VARCHAR(255),
ADD COLUMN     "experience_level" "experience_level",
ADD COLUMN     "first_name" VARCHAR(100) NOT NULL,
ADD COLUMN     "last_name" VARCHAR(100) NOT NULL,
ADD COLUMN     "linkedin_url" VARCHAR(255),
ADD COLUMN     "mobility_nationwide" BOOLEAN,
ADD COLUMN     "mobility_radius_km" INTEGER,
ADD COLUMN     "postal_code" VARCHAR(10),
ADD COLUMN     "remote_policy" "remote_policy",
ADD COLUMN     "salary_max" INTEGER,
ADD COLUMN     "salary_min" INTEGER;

-- AlterTable
ALTER TABLE "company" DROP COLUMN "code_postal",
DROP COLUMN "nom",
DROP COLUMN "taille",
DROP COLUMN "ville",
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "cover_image" VARCHAR(255),
ADD COLUMN     "name" VARCHAR(255) NOT NULL,
ADD COLUMN     "postal_code" VARCHAR(10),
ADD COLUMN     "size" "company_size";

-- AlterTable
ALTER TABLE "offer" DROP COLUMN "code_postal",
DROP COLUMN "statut",
DROP COLUMN "titre",
DROP COLUMN "ville",
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "contract_type" "contract_type",
ADD COLUMN     "min_experience_level" "experience_level",
ADD COLUMN     "postal_code" VARCHAR(10),
ADD COLUMN     "remote_policy" "remote_policy",
ADD COLUMN     "salary_max" INTEGER,
ADD COLUMN     "salary_min" INTEGER,
ADD COLUMN     "status" "offer_status" NOT NULL DEFAULT 'draft',
ADD COLUMN     "title" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "recruiter_profile" DROP COLUMN "nom",
DROP COLUMN "prenom",
ADD COLUMN     "first_name" VARCHAR(100) NOT NULL,
ADD COLUMN     "last_name" VARCHAR(100) NOT NULL;

-- CreateTable
CREATE TABLE "company_tag" (
    "fk_company" INTEGER NOT NULL,
    "fk_tag" INTEGER NOT NULL,

    CONSTRAINT "company_tag_pkey" PRIMARY KEY ("fk_company","fk_tag")
);

-- AddForeignKey
ALTER TABLE "company_tag" ADD CONSTRAINT "company_tag_fk_company_fkey" FOREIGN KEY ("fk_company") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_tag" ADD CONSTRAINT "company_tag_fk_tag_fkey" FOREIGN KEY ("fk_tag") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
