-- PP-o355.63: Pinball Map comment notifications (pinballmap spec 7.4, 7.7).
-- On by default on every channel (Tim, 2026-09-25). The column defaults cover
-- existing members and new signups alike: handle_new_user inserts only the
-- columns it names, so these take their DEFAULT there too.
ALTER TABLE "notification_preferences" ADD COLUMN "email_notify_on_pinballmap_comment" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_notify_on_pinballmap_comment" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "discord_notify_on_pinballmap_comment" boolean DEFAULT true NOT NULL;