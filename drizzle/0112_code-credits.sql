ALTER TABLE "machines" DROP CONSTRAINT "machines_manual_model_requires_excluded";--> statement-breakpoint
ALTER TABLE "machines" DROP CONSTRAINT "machines_credit_lists_not_empty";--> statement-breakpoint
ALTER TABLE "machine_apron_cards" ADD COLUMN "code_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "programmers" text[];--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_manual_model_requires_excluded" CHECK (pinballmap_excluded OR (type IS NULL AND display IS NULL AND player_count IS NULL AND designers IS NULL AND artists IS NULL AND programmers IS NULL));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_credit_lists_not_empty" CHECK ((designers IS NULL OR cardinality(designers) > 0) AND (artists IS NULL OR cardinality(artists) > 0) AND (programmers IS NULL OR cardinality(programmers) > 0));