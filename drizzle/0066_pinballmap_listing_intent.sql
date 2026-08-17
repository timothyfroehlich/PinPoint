-- PP-o355.21: listing intent becomes an operator-owned tri-state.
--
-- `pinballmap_listed` conflated two facts — whether the operator WANTS this
-- cabinet on the location's lineup, and whether Pinball Map actually shows it.
-- Only the first is ours to store; the second is read from the stored location
-- snapshot. Splitting them is what lets the control say "you want this on the
-- lineup and it is not there" instead of a boolean that had to be one or the
-- other (spec §1, §4).
--
-- Statements 1–5 are drizzle-kit's output for the schema.ts change; the backfill
-- at the end is hand-written and must run AFTER the column exists. The old
-- columns are dropped in the next migration, not this one, so the backfill still
-- has its source to read.
ALTER TABLE "machines" ADD COLUMN "pinballmap_intent" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "refresh_tokens" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "refresh_tokens_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_pinballmap_intent_check" CHECK (pinballmap_intent IN ('on', 'off', 'no_sync'));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_pinballmap_intent_requires_link" CHECK (NOT (pinballmap_intent = 'on' AND pinballmap_machine_id IS NULL));--> statement-breakpoint
-- A listed cabinet is one somebody deliberately put on the lineup, so 'on' is
-- the honest reading of the old flag. Everything else defaults to 'off' — never
-- 'no_sync', which is a choice nobody has had the chance to make yet.
--
-- This cannot violate the requires-link check added above:
-- `machines_pinballmap_listed_requires_link` already forbade a listed row
-- without `pinballmap_machine_id`, and it is still in force here.
UPDATE "machines" SET "pinballmap_intent" = 'on' WHERE "pinballmap_listed";
