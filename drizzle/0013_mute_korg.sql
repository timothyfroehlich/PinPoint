ALTER TABLE "notification_preferences" ALTER COLUMN "email_notify_on_status_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_status_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_notify_on_new_comment" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_new_comment" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_new_issue" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "email_notify_on_machine_ownership_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ALTER COLUMN "in_app_notify_on_machine_ownership_change" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD COLUMN "suppress_own_actions" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Backfill invited-user accounts still on legacy all-on defaults.
-- Intentionally does NOT modify regular guest/full user accounts.
UPDATE "notification_preferences" AS "np"
SET
  "suppress_own_actions" = false,
  "email_notify_on_status_change" = false,
  "in_app_notify_on_status_change" = false,
  "email_notify_on_new_comment" = false,
  "in_app_notify_on_new_comment" = false,
  "in_app_notify_on_new_issue" = false,
  "email_notify_on_machine_ownership_change" = false,
  "in_app_notify_on_machine_ownership_change" = false
FROM "user_profiles" AS "up"
WHERE "up"."id" = "np"."user_id"
  AND "up"."role" IN ('member', 'admin')
  AND "np"."email_enabled" = true
  AND "np"."in_app_enabled" = true
  AND "np"."email_notify_on_assigned" = true
  AND "np"."in_app_notify_on_assigned" = true
  AND "np"."email_notify_on_status_change" = true
  AND "np"."in_app_notify_on_status_change" = true
  AND "np"."email_notify_on_new_comment" = true
  AND "np"."in_app_notify_on_new_comment" = true
  AND "np"."email_notify_on_new_issue" = true
  AND "np"."in_app_notify_on_new_issue" = true
  AND "np"."email_watch_new_issues_global" = false
  AND "np"."in_app_watch_new_issues_global" = false
  AND "np"."email_notify_on_machine_ownership_change" = true
  AND "np"."in_app_notify_on_machine_ownership_change" = true;
