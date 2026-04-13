ALTER TABLE "issue_comments" ALTER COLUMN "content" DROP NOT NULL;

-- statement-breakpoint

-- Clear redundant ProseMirror content from system events that have been
-- migrated to structured event_data. The read path falls back to content
-- only when event_data IS NULL, so this is safe for migrated rows.
UPDATE "issue_comments"
SET content = NULL
WHERE is_system = true
  AND event_data IS NOT NULL;