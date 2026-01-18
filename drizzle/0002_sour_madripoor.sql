DROP INDEX "idx_issue_comments_issue_id";--> statement-breakpoint
CREATE INDEX "idx_issue_comments_issue_id_created_at" ON "issue_comments" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_machines_name" ON "machines" USING btree ("name");