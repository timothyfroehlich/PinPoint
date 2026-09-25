ALTER TABLE "pinballmap_comments" ADD COLUMN "entry_missing_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ADD COLUMN "previous_listing_reason" text;--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ADD COLUMN "previous_listing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ADD CONSTRAINT "pinballmap_comments_previous_listing_reason_check" CHECK (previous_listing_reason IN ('removed', 'replaced', 'location_changed'));--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ADD CONSTRAINT "pinballmap_comments_previous_listing_pair" CHECK ((previous_listing_reason IS NULL) = (previous_listing_at IS NULL));