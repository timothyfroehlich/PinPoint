-- Clean up stale system events from persistent preview/branch DBs that were
-- seeded before the structured eventData migration. These rows violate the
-- constraint below; deleting them is safe because they predate the read-path
-- changes and any remaining content-based rows are no longer rendered.
DELETE FROM "issue_comments" WHERE is_system = true AND event_data IS NULL;

-- statement-breakpoint

ALTER TABLE "issue_comments" ADD CONSTRAINT "chk_system_event_data" CHECK (NOT "issue_comments"."is_system" OR "issue_comments"."event_data" IS NOT NULL);