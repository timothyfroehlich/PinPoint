CREATE INDEX "idx_issues_created_at" ON "issues" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_issues_unconfirmed_reported_by" ON "issues" USING btree ("unconfirmed_reported_by");--> statement-breakpoint
CREATE INDEX "idx_machines_unconfirmed_owner_id" ON "machines" USING btree ("unconfirmed_owner_id");