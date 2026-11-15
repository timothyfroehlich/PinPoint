-- PP-61u5: issue titles are one line.
--
-- Every write path now collapses each run of whitespace or control characters
-- to a single space and trims the ends (normalizeIssueTitle in
-- src/lib/issues/title.ts). This applies the same rule to the titles already
-- stored with newlines: 13 in production, all from the legacy import before
-- 2026-01-28.
--
-- Data only, and deliberately narrow:
--  - touches only rows whose title holds a control character, so it is
--    idempotent (a collapsed title holds none) and leaves every other row alone;
--  - never shortens a title — an over-limit legacy title stays over the limit
--    and saves again only once edited down (spec issue-detail §4.4);
--  - leaves updated_at alone and writes no timeline event: issues has no
--    trigger, and this is cleanup, not an edit anyone made;
--  - skips a title that would collapse to nothing rather than store an empty
--    one (production has none).
UPDATE "issues"
SET "title" = btrim(regexp_replace("title", '[[:space:][:cntrl:]]+', ' ', 'g'))
WHERE "title" ~ '[[:cntrl:]]'
  AND btrim(regexp_replace("title", '[[:space:][:cntrl:]]+', ' ', 'g')) <> '';
