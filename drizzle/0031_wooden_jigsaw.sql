ALTER TABLE "notification_preferences" ADD COLUMN "discord_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_assigned" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_status_change" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_new_comment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_mentioned" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_new_issue" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_machine_ownership_change" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_watch_new_issues_global" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_dm_blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "discord_user_id" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_discord_user_id_unique" UNIQUE("discord_user_id");