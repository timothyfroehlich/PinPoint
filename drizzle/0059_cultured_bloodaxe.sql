ALTER TABLE "machine_settings_sets" ADD COLUMN "is_owner_set" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD COLUMN "is_tournament" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill (PP-tn6t): preserve today's "everyone sees everything" — existing
-- sets become public/community; the existing preferred set becomes the
-- owner's default (owner-scoped, still public).
UPDATE "machine_settings_sets" SET "is_public" = true;--> statement-breakpoint
UPDATE "machine_settings_sets" SET "is_owner_set" = true WHERE "is_preferred" = true;