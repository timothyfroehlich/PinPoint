DROP INDEX IF EXISTS "idx_issues_priority";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_notif_prefs_global_watch_email";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_images_comment_id" ON "issue_images" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issue_images_deleted_by" ON "issue_images" USING btree ("deleted_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_machine_settings_sets_created_by" ON "machine_settings_sets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_machine_settings_sets_updated_by" ON "machine_settings_sets" USING btree ("updated_by");