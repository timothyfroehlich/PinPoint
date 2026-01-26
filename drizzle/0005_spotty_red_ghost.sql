ALTER TABLE "machine_watchers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "email_notify_on_machine_ownership_change" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "in_app_notify_on_machine_ownership_change" boolean DEFAULT true NOT NULL;