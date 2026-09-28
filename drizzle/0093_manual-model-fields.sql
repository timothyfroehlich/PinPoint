ALTER TABLE "machines" ADD COLUMN "type" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "display" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "player_count" integer;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "designers" text[];--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "artists" text[];--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_manual_model_requires_excluded" CHECK (pinballmap_excluded OR (type IS NULL AND display IS NULL AND player_count IS NULL AND designers IS NULL AND artists IS NULL));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_type_check" CHECK (type IS NULL OR type IN ('em', 'ss', 'me'));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_display_check" CHECK (display IS NULL OR display IN ('reels', 'lights', 'alphanumeric', 'cga', 'dmd', 'lcd'));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_player_count_check" CHECK (player_count IS NULL OR player_count > 0);--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_credit_lists_not_empty" CHECK ((designers IS NULL OR cardinality(designers) > 0) AND (artists IS NULL OR cardinality(artists) > 0));