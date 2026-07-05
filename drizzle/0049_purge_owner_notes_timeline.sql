-- Migration: purge_owner_notes_timeline
--
-- Purpose: PP-blue.1 follow-up to #1585 (PP-blue), which removed the
-- `owner_notes_updated` case from `formatMachineEvent` (and the
-- `machines.owner_notes` column) but did not purge existing
-- `owner_notes_updated` rows from `timeline_events`. Any machine with
-- historical owner-notes activity now hits an unhandled switch case in the
-- formatter and renders a blank/broken timeline entry. Surfaced by Weekly
-- Security Review #1603 (rec #2). Display artifact, not a security issue.
--
-- The event kind discriminator lives in the `event_data` JSONB column (see
-- `~/lib/timeline/machine-event-types.ts`), not a dedicated enum column, so
-- this is a one-time data fix keyed on `event_data->>'kind'`. Any
-- `timeline_event_people` rows referencing a deleted event are removed via
-- the existing `ON DELETE CASCADE` on `timeline_event_people.event_id`.
--
-- This migration contains no Drizzle schema changes — only raw SQL.
-- The snapshot for this entry is identical to 0047 (schema unchanged).

--> statement-breakpoint

DELETE FROM timeline_events WHERE event_data->>'kind' = 'owner_notes_updated';
