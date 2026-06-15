ALTER TABLE "issue_comments" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "idempotency_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_issue_comments_idempotency_key" ON "issue_comments" USING btree ("idempotency_key") WHERE "issue_comments"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_timeline_events_idempotency_key" ON "timeline_events" USING btree ("idempotency_key") WHERE "timeline_events"."idempotency_key" IS NOT NULL;