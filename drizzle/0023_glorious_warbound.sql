ALTER TABLE "issue_comments" ADD COLUMN "event_data" jsonb;

-- statement-breakpoint

-- Data migration: Convert existing plain-text system events to structured event_data.
-- Text is stored in ProseMirror format at: content->'content'->0->'content'->0->>'text'

-- 1. Assigned to <name>
UPDATE "issue_comments"
SET event_data = jsonb_build_object(
  'type', 'assigned',
  'assigneeName', substring(content->'content'->0->'content'->0->>'text' FROM '^Assigned to (.+)$')
)
WHERE is_system = true
  AND event_data IS NULL
  AND content->'content'->0->'content'->0->>'text' ~ '^Assigned to .+$';

-- statement-breakpoint

-- 2. Unassigned
UPDATE "issue_comments"
SET event_data = '{"type":"unassigned"}'::jsonb
WHERE is_system = true
  AND event_data IS NULL
  AND content->'content'->0->'content'->0->>'text' = 'Unassigned';

-- statement-breakpoint

-- 3. Status changed from <label> to <label>
-- Uses LIKE patterns against known labels instead of regex splitting,
-- because POSIX "leftmost-longest" semantics make (.+) to (.+) ambiguous
-- for multi-word labels like "No Repro to In Progress".
WITH sys_events AS (
  SELECT id, content->'content'->0->'content'->0->>'text' AS txt
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Status changed from .+ to .+$'
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'status_changed',
  'from', CASE
    WHEN e.txt LIKE 'Status changed from New to %' THEN 'new'
    WHEN e.txt LIKE 'Status changed from Confirmed to %' THEN 'confirmed'
    WHEN e.txt LIKE 'Status changed from In Progress to %' THEN 'in_progress'
    WHEN e.txt LIKE 'Status changed from Need Parts to %' THEN 'need_parts'
    WHEN e.txt LIKE 'Status changed from Need Help to %' THEN 'need_help'
    WHEN e.txt LIKE 'Status changed from Pending Owner to %' THEN 'wait_owner'
    WHEN e.txt LIKE 'Status changed from Fixed to %' THEN 'fixed'
    WHEN e.txt LIKE 'Status changed from As Intended to %' THEN 'wai'
    WHEN e.txt LIKE 'Status changed from Won''t Fix to %' THEN 'wont_fix'
    WHEN e.txt LIKE 'Status changed from No Repro to %' THEN 'no_repro'
    WHEN e.txt LIKE 'Status changed from Duplicate to %' THEN 'duplicate'
    ELSE 'unknown'
  END,
  'to', CASE
    WHEN e.txt LIKE '% to New' THEN 'new'
    WHEN e.txt LIKE '% to Confirmed' THEN 'confirmed'
    WHEN e.txt LIKE '% to In Progress' THEN 'in_progress'
    WHEN e.txt LIKE '% to Need Parts' THEN 'need_parts'
    WHEN e.txt LIKE '% to Need Help' THEN 'need_help'
    WHEN e.txt LIKE '% to Pending Owner' THEN 'wait_owner'
    WHEN e.txt LIKE '% to Fixed' THEN 'fixed'
    WHEN e.txt LIKE '% to As Intended' THEN 'wai'
    WHEN e.txt LIKE '% to Won''t Fix' THEN 'wont_fix'
    WHEN e.txt LIKE '% to No Repro' THEN 'no_repro'
    WHEN e.txt LIKE '% to Duplicate' THEN 'duplicate'
    ELSE 'unknown'
  END
)
FROM sys_events e
WHERE ic.id = e.id;

-- statement-breakpoint

-- 4. Severity changed from <label> to <label>
-- Labels are single words so regex splitting is unambiguous.
WITH parsed AS (
  SELECT
    id,
    substring(content->'content'->0->'content'->0->>'text' FROM '^Severity changed from (\S+) to \S+$') AS from_label,
    substring(content->'content'->0->'content'->0->>'text' FROM ' to (\S+)$') AS to_label
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Severity changed from \S+ to \S+$'
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'severity_changed',
  'from', CASE p.from_label
    WHEN 'Cosmetic' THEN 'cosmetic'
    WHEN 'Minor' THEN 'minor'
    WHEN 'Major' THEN 'major'
    WHEN 'Unplayable' THEN 'unplayable'
    ELSE lower(p.from_label)
  END,
  'to', CASE p.to_label
    WHEN 'Cosmetic' THEN 'cosmetic'
    WHEN 'Minor' THEN 'minor'
    WHEN 'Major' THEN 'major'
    WHEN 'Unplayable' THEN 'unplayable'
    ELSE lower(p.to_label)
  END
)
FROM parsed p
WHERE ic.id = p.id;

-- statement-breakpoint

-- 5. Priority changed from <label> to <label>
WITH parsed AS (
  SELECT
    id,
    substring(content->'content'->0->'content'->0->>'text' FROM '^Priority changed from (\S+) to \S+$') AS from_label,
    substring(content->'content'->0->'content'->0->>'text' FROM ' to (\S+)$') AS to_label
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Priority changed from \S+ to \S+$'
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'priority_changed',
  'from', CASE p.from_label
    WHEN 'Low' THEN 'low'
    WHEN 'Medium' THEN 'medium'
    WHEN 'High' THEN 'high'
    ELSE lower(p.from_label)
  END,
  'to', CASE p.to_label
    WHEN 'Low' THEN 'low'
    WHEN 'Medium' THEN 'medium'
    WHEN 'High' THEN 'high'
    ELSE lower(p.to_label)
  END
)
FROM parsed p
WHERE ic.id = p.id;

-- statement-breakpoint

-- 6. Frequency changed from <label> to <label>
WITH parsed AS (
  SELECT
    id,
    substring(content->'content'->0->'content'->0->>'text' FROM '^Frequency changed from (\S+) to \S+$') AS from_label,
    substring(content->'content'->0->'content'->0->>'text' FROM ' to (\S+)$') AS to_label
  FROM "issue_comments"
  WHERE is_system = true
    AND event_data IS NULL
    AND content->'content'->0->'content'->0->>'text' ~ '^Frequency changed from \S+ to \S+$'
)
UPDATE "issue_comments" ic
SET event_data = jsonb_build_object(
  'type', 'frequency_changed',
  'from', CASE p.from_label
    WHEN 'Intermittent' THEN 'intermittent'
    WHEN 'Frequent' THEN 'frequent'
    WHEN 'Constant' THEN 'constant'
    ELSE lower(p.from_label)
  END,
  'to', CASE p.to_label
    WHEN 'Intermittent' THEN 'intermittent'
    WHEN 'Frequent' THEN 'frequent'
    WHEN 'Constant' THEN 'constant'
    ELSE lower(p.to_label)
  END
)
FROM parsed p
WHERE ic.id = p.id;