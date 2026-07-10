DROP INDEX "idx_issues_priority";--> statement-breakpoint
DROP INDEX "idx_notif_prefs_global_watch_email";--> statement-breakpoint
CREATE INDEX "idx_issue_images_comment_id" ON "issue_images" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_issue_images_deleted_by" ON "issue_images" USING btree ("deleted_by");