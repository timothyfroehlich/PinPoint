ALTER TABLE "pinballmap_state" ADD COLUMN "region_alert_region" text DEFAULT 'austin' NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "region_alert_channel_id" text;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "region_alert_status" text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "region_alert_last_post_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "region_alert_last_status_detail" text;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD CONSTRAINT "pinballmap_state_region_alert_status_check" CHECK (region_alert_status IN ('not_configured', 'posting', 'cant_post', 'couldnt_check', 'needs_discord'));