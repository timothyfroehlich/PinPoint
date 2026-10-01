ALTER TABLE "pinballmap_state" ADD COLUMN "sync_report_channel_id" text;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "sync_report_status" text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "sync_report_last_post_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "sync_report_last_status_detail" text;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "sync_report_last_week" date;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD CONSTRAINT "pinballmap_state_sync_report_status_check" CHECK (sync_report_status IN ('not_configured', 'posting', 'cant_post', 'couldnt_check', 'needs_discord'));