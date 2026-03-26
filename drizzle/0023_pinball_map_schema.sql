-- Pinball Map Integration: Schema Changes
-- Adds PBM tracking columns to machines table and creates config table

-- 1. Add Pinball Map columns to machines table
ALTER TABLE "machines" ADD COLUMN "pbm_machine_id" integer;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "pbm_machine_name" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "pbm_location_machine_xref_id" integer;--> statement-breakpoint

-- 2. Create pinball_map_config table (single-row config)
CREATE TABLE IF NOT EXISTS "pinball_map_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"location_id" integer NOT NULL,
	"user_email" text NOT NULL,
	"user_token" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "single_row_check" CHECK (id = 1)
);
