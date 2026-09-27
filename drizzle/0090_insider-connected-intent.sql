ALTER TABLE "machines" ADD COLUMN "pinballmap_ic_intent" text;--> statement-breakpoint
ALTER TABLE "pinballmap_catalog" ADD COLUMN "ic_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_pinballmap_ic_intent_check" CHECK (pinballmap_ic_intent IS NULL OR pinballmap_ic_intent IN ('on', 'off'));