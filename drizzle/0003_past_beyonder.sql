DROP INDEX "idx_issue_watchers_issue_id";--> statement-breakpoint
CREATE INDEX "idx_issue_watchers_user_id" ON "issue_watchers" USING btree ("user_id");