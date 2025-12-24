CREATE INDEX "idx_issue_comments_issue_id" ON "issue_comments" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "idx_issues_reported_by" ON "issues" USING btree ("reported_by");--> statement-breakpoint
CREATE INDEX "idx_issues_assigned_to" ON "issues" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_machines_owner_id" ON "machines" USING btree ("owner_id");