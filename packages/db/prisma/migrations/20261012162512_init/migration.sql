-- CreateEnum
CREATE TYPE "LineKind" AS ENUM ('product', 'brand', 'topic');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('queued', 'running', 'needs_you', 'ready_for_review', 'approved', 'rejected', 'failed', 'paused_budget');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('prepare', 'ideas', 'committee', 'script', 'direction', 'produce', 'review', 'social');

-- CreateEnum
CREATE TYPE "StageRunStatus" AS ENUM ('running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('chosen', 'banked', 'used', 'discarded');

-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('approve', 'reject');

-- CreateEnum
CREATE TYPE "RejectMode" AS ENUM ('redo', 'learn');

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "roles" JSONB NOT NULL,
    "prices" JSONB NOT NULL,
    "global_monthly_cap_usd" DOUBLE PRECISION NOT NULL,
    "default_hour" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "warning" TEXT,
    "warning_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LineKind" NOT NULL,
    "material" JSONB NOT NULL,
    "per_day" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "brand" JSONB NOT NULL,
    "voice_provider" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "music_track" TEXT,
    "monthly_cap_usd" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "paused_reason" TEXT,
    "warning" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learned_rules" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "source_video_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learned_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "old_price_cents" INTEGER,
    "currency" TEXT NOT NULL,
    "category" TEXT,
    "link" TEXT,
    "images" TEXT[],
    "model_3d" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "product_id" UUID,
    "status" "VideoStatus" NOT NULL DEFAULT 'queued',
    "stage" "Stage" NOT NULL DEFAULT 'prepare',
    "round" INTEGER NOT NULL DEFAULT 0,
    "review_rounds" INTEGER NOT NULL DEFAULT 0,
    "instructions" JSONB NOT NULL DEFAULT '[]',
    "briefing" JSONB,
    "script" JSONB,
    "plan" JSONB,
    "review" JSONB,
    "social" JSONB,
    "video_file" TEXT,
    "frame_files" TEXT[],
    "duration_seconds" DOUBLE PRECISION,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "failure_kind" TEXT,
    "problems" TEXT[],
    "publication" JSONB,
    "tick_job_id" TEXT,
    "ready_at" TIMESTAMPTZ(3),
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_runs" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "stage" "Stage" NOT NULL,
    "round" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "StageRunStatus" NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "stage_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "video_id" UUID,
    "product_id" UUID,
    "style" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "structure" TEXT[],
    "cta" TEXT NOT NULL,
    "scores" JSONB,
    "total" INTEGER,
    "status" "IdeaStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_entries" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "video_id" UUID,
    "stage" "Stage",
    "role" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "voice_characters" INTEGER NOT NULL DEFAULT 0,
    "usd" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "kind" "DecisionKind" NOT NULL,
    "reason" TEXT,
    "mode" "RejectMode",
    "target_stage" "Stage",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learned_rules_line_id_idx" ON "learned_rules"("line_id");

-- CreateIndex
CREATE INDEX "videos_line_id_created_at_idx" ON "videos"("line_id", "created_at");

-- CreateIndex
CREATE INDEX "videos_product_id_idx" ON "videos"("product_id");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_tick_job_id_idx" ON "videos"("tick_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_runs_video_id_stage_round_attempt_key" ON "stage_runs"("video_id", "stage", "round", "attempt");

-- CreateIndex
CREATE INDEX "ideas_line_id_status_idx" ON "ideas"("line_id", "status");

-- CreateIndex
CREATE INDEX "ideas_video_id_idx" ON "ideas"("video_id");

-- CreateIndex
CREATE INDEX "cost_entries_line_id_created_at_idx" ON "cost_entries"("line_id", "created_at");

-- CreateIndex
CREATE INDEX "cost_entries_created_at_idx" ON "cost_entries"("created_at");

-- CreateIndex
CREATE INDEX "cost_entries_video_id_idx" ON "cost_entries"("video_id");

-- CreateIndex
CREATE INDEX "decisions_video_id_idx" ON "decisions"("video_id");

-- AddForeignKey
ALTER TABLE "learned_rules" ADD CONSTRAINT "learned_rules_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learned_rules" ADD CONSTRAINT "learned_rules_source_video_id_fkey" FOREIGN KEY ("source_video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_runs" ADD CONSTRAINT "stage_runs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
