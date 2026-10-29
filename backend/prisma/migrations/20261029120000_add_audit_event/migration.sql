-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('login_succeeded', 'login_failed', 'session_reuse_detected', 'password_reset_requested', 'password_reset_completed', 'account_deleted', 'account_deletion_refused', 'account_purged', 'offer_status_changed');

-- CreateTable
CREATE TABLE "audit_event" (
    "id" SERIAL NOT NULL,
    "action" "audit_action" NOT NULL,
    "actor_id" INTEGER,
    "target_type" VARCHAR(20),
    "target_id" INTEGER,
    "ip" VARCHAR(45),
    "detail" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_actor_id_occurred_at_idx" ON "audit_event"("actor_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_target_type_target_id_occurred_at_idx" ON "audit_event"("target_type", "target_id", "occurred_at");
