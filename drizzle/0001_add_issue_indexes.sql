CREATE INDEX "idx_issues_machine_initials" ON "issues" USING btree ("machine_initials");--> statement-breakpoint
CREATE INDEX "idx_issues_assigned_to" ON "issues" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_issues_status" ON "issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_issues_created_at" ON "issues" USING btree ("created_at");