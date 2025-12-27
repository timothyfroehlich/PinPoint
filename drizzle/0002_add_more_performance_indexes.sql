CREATE INDEX "idx_issues_status" ON "issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_machines_owner_id" ON "machines" USING btree ("owner_id");