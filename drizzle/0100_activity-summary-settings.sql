ALTER TABLE "discord_integration_config" ADD COLUMN "summary_channel_id" text;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_interval_hours" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_start_hour" integer DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_events" text[] DEFAULT '{"issues_opened","issues_closed","machine_status","availability","new_machines","pinball_map_sync"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_status" text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_status_detail" text;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_last_post_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD COLUMN "summary_pinball_map_review_keys" text[];--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD CONSTRAINT "discord_integration_config_summary_interval_check" CHECK (summary_interval_hours IS NULL OR summary_interval_hours IN (1, 2, 4, 6, 12, 24));--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD CONSTRAINT "discord_integration_config_summary_start_hour_check" CHECK (summary_start_hour BETWEEN 0 AND 23);--> statement-breakpoint
ALTER TABLE "discord_integration_config" ADD CONSTRAINT "discord_integration_config_summary_status_check" CHECK (summary_status IN ('not_configured', 'posting', 'cant_post', 'couldnt_check', 'needs_discord'));