-- CreateTable
CREATE TABLE "candidate_profile" (
    "id" SERIAL NOT NULL,
    "fk_user" INTEGER NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "picture" VARCHAR(255),
    "bio" TEXT,
    "ville" VARCHAR(100),
    "code_postal" VARCHAR(10),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidate_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_profile" (
    "id" SERIAL NOT NULL,
    "fk_user" INTEGER NOT NULL,
    "fk_company" INTEGER NOT NULL,
    "prenom" VARCHAR(100) NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "avatar" VARCHAR(255),
    "job_title" VARCHAR(150),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recruiter_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" SERIAL NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "logo" VARCHAR(255),
    "taille" "company_size",
    "fk_sector" INTEGER,
    "description" TEXT,
    "site_url" VARCHAR(255),
    "ville" VARCHAR(100),
    "code_postal" VARCHAR(10),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(100) NOT NULL,

    CONSTRAINT "sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer" (
    "id" SERIAL NOT NULL,
    "fk_company" INTEGER NOT NULL,
    "fk_user_created" INTEGER,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "ville" VARCHAR(100),
    "code_postal" VARCHAR(10),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "statut" "offer_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "category" "tag_category" NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_tag" (
    "fk_offer" INTEGER NOT NULL,
    "fk_tag" INTEGER NOT NULL,

    CONSTRAINT "offer_tag_pkey" PRIMARY KEY ("fk_offer","fk_tag")
);

-- CreateTable
CREATE TABLE "candidate_tag" (
    "fk_user_candidate" INTEGER NOT NULL,
    "fk_tag" INTEGER NOT NULL,

    CONSTRAINT "candidate_tag_pkey" PRIMARY KEY ("fk_user_candidate","fk_tag")
);

-- CreateTable
CREATE TABLE "candidate_likes_offer" (
    "fk_user_candidate" INTEGER NOT NULL,
    "fk_offer" INTEGER NOT NULL,
    "liked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_likes_offer_pkey" PRIMARY KEY ("fk_user_candidate","fk_offer")
);

-- CreateTable
CREATE TABLE "recruiter_likes_candidate" (
    "fk_user_recruiter" INTEGER NOT NULL,
    "fk_user_candidate" INTEGER NOT NULL,
    "liked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruiter_likes_candidate_pkey" PRIMARY KEY ("fk_user_recruiter","fk_user_candidate")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_profile_fk_user_key" ON "candidate_profile"("fk_user");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_profile_fk_user_key" ON "recruiter_profile"("fk_user");

-- CreateIndex
CREATE UNIQUE INDEX "sector_label_key" ON "sector"("label");

-- CreateIndex
CREATE UNIQUE INDEX "tag_label_key" ON "tag"("label");
