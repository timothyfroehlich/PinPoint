ALTER TABLE "notification_preferences" ALTER COLUMN "email_notify_on_status_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_status_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_notify_on_new_comment" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_new_comment" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_new_issue" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_notify_on_machine_ownership_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_machine_ownership_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "suppress_own_actions" boolean DEFAULT false NOT NULL;