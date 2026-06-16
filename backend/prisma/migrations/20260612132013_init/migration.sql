-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "user_type" AS ENUM ('candidate', 'recruiter', 'admin');

-- CreateEnum
CREATE TYPE "company_size" AS ENUM ('TPE', 'PME', 'ETI', 'GE');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('draft', 'open', 'paused', 'filled', 'closed');

-- CreateEnum
CREATE TYPE "tag_category" AS ENUM ('skill', 'tech', 'contract', 'theme', 'other');

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "user_type" "user_type" NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
