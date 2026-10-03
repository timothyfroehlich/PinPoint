-- Issue Activity's "assigned" events stored the assignee's name as text
-- (`{"type":"assigned","assigneeName":"…"}`), so a rename never reached them
-- and a deleted account's name stayed behind. Events now carry the account id
-- and Activity resolves the current name when the page loads (PP-0fg0.1).
--
-- Only events that have no `assigneeId` key yet are touched, so the migration
-- is safe to rerun and never re-matches an event an earlier run settled.
-- `content` is not touched.

-- 1. A name that belongs to exactly one account becomes that account's id,
--    and the name snapshot is dropped. A name shared by two accounts is
--    ambiguous and is left to step 2.
WITH unique_names AS (
  SELECT name, (array_agg(id))[1] AS id
  FROM "user_profiles"
  GROUP BY name
  HAVING count(*) = 1
)
UPDATE "issue_comments" c
SET event_data = jsonb_build_object('type', 'assigned', 'assigneeId', u.id)
FROM unique_names u
WHERE c.event_data->>'type' = 'assigned'
  AND c.event_data->'assigneeId' IS NULL
  AND c.event_data->>'assigneeName' = u.name;
--> statement-breakpoint
-- 2. Every remaining assigned event (its name matched no account, or more
--    than one) gets an explicit null id and keeps its stored name, which
--    Activity shows as the fallback.
UPDATE "issue_comments"
SET event_data = event_data || '{"assigneeId": null}'::jsonb
WHERE event_data->>'type' = 'assigned'
  AND event_data->'assigneeId' IS NULL;
