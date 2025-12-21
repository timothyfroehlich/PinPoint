CREATE INDEX "idx_issue_comments_issue_id" ON "issue_comments" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_issues_assigned_to" ON "issues" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_issues_status" ON "issues" USING btree ("status");