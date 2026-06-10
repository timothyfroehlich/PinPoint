CREATE INDEX "idx_timeline_event_people_user_id" ON "timeline_event_people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_events_author_id" ON "timeline_events" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_events_deleted_by" ON "timeline_events" USING btree ("deleted_by");