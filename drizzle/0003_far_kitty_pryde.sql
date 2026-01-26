CREATE INDEX IF NOT EXISTS "idx_issues_severity" ON "issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_issues_priority" ON "issues" USING btree ("priority");
