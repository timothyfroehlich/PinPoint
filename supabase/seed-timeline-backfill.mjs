#!/usr/bin/env node
/**
 * Machine Timeline Backfill (PP-0x98)
 *
 * Synthesizes historical `timeline_events` rows from existing data so the
 * Timeline tab isn't empty for machines/issues that existed before V1 shipped.
 *
 * What it backfills:
 *   - `machine_added`  per machine, dated `machines.created_at`. No actor
 *     (the schema doesn't track machine creators).
 *   - `issue_opened`   per non-deleted issue, dated `issues.created_at`.
 *     Reporter recorded as a `timeline_event_people` reference (real or
 *     invited) resolved live (PP-tv9l); a freeform public reporter keeps a
 *     `guestReporterName`; anonymous carries neither. No name in event_data.
 *   - `issue_closed`   per issue with `issues.closed_at IS NOT NULL`,
 *     dated `closed_at`. No closer recorded — schema doesn't track it.
 *
 * What it does NOT backfill (no source-of-truth in the DB):
 *   - owner/name/presence/description/notes changes (current state only)
 *   - issue_status_changed, issue_assigned/unassigned (no audit history)
 *   - issue_reassigned_out/in (no machine history per issue)
 *
 * Idempotent: each insert is guarded by `NOT EXISTS` on the matching
 *   (machine_id, kind, optional issue_id) tuple. Safe to run repeatedly —
 *   re-runs after partial failure pick up where they left off.
 *
 * Usage (local):
 *   pnpm run db:_seed-timeline-backfill
 *
 * Usage (prod): once after `db:migrate` lands the timeline_events migration,
 *   `node --env-file=<prod-env> supabase/seed-timeline-backfill.mjs`.
 *   Re-runs are no-ops.
 */

import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "../scripts/lib/pg-client.mjs";

const databaseUrl = resolveScriptDatabaseUrl();

// Production safety guard: refuse to run against non-local hosts unless the
// caller has explicitly opted in. This mirrors seed-timeline-demo's guard.
// For the intentional production one-shot run:
//   ALLOW_NONLOCAL_BACKFILL=1 node --env-file=<prod-env> supabase/seed-timeline-backfill.mjs
{
  const url = new URL(databaseUrl);
  const isLocal =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocal && !process.env.ALLOW_NONLOCAL_BACKFILL) {
    console.error(
      `❌ seed-timeline-backfill refuses non-local DB (${url.hostname}) without ALLOW_NONLOCAL_BACKFILL=1`
    );
    process.exit(1);
  }
}

async function backfill() {
  const sql = createScriptClient(databaseUrl);
  const counts = {
    machineAdded: 0,
    issueOpened: 0,
    issueClosed: 0,
  };

  try {
    const machinesAdded = await sql`
      INSERT INTO timeline_events (
        machine_id, created_at, source_type, tag, event_data
      )
      SELECT
        m.id,
        m.created_at,
        'lifecycle',
        'lifecycle',
        jsonb_build_object('kind', 'machine_added')
      FROM machines m
      WHERE NOT EXISTS (
        SELECT 1 FROM timeline_events te
        WHERE te.machine_id = m.id
          AND te.event_data->>'kind' = 'machine_added'
      )
      RETURNING id
    `;
    counts.machineAdded = machinesAdded.length;

    // issue_opened: no snapshotted name (PP-tv9l). The reporter is recorded as
    // a person-reference below; a freeform guest (no account id) keeps their
    // typed name as `guestReporterName`. Anonymous opens carry neither.
    const issuesOpened = await sql`
      INSERT INTO timeline_events (
        machine_id, created_at, source_type, tag, author_id, event_data
      )
      SELECT
        m.id,
        i.created_at,
        'issue',
        'issue',
        i.reported_by,
        jsonb_build_object(
          'kind', 'issue_opened',
          'issueId', i.id::text,
          'issueNumber', i.issue_number,
          'title', i.title,
          'severity', i.severity,
          'frequency', i.frequency
        )
        || CASE
             WHEN i.reported_by IS NULL
              AND i.invited_reported_by IS NULL
              AND i.reporter_name IS NOT NULL
             THEN jsonb_build_object('guestReporterName', i.reporter_name)
             ELSE '{}'::jsonb
           END
      FROM issues i
      JOIN machines m ON m.initials = i.machine_initials
      WHERE NOT EXISTS (
          SELECT 1 FROM timeline_events te
          WHERE te.machine_id = m.id
            AND te.event_data->>'kind' = 'issue_opened'
            AND te.event_data->>'issueId' = i.id::text
        )
      RETURNING id
    `;
    counts.issueOpened = issuesOpened.length;

    // Reporter person-references for the issue_opened events just (or
    // previously) backfilled — one per issue that has a real or invited
    // reporter. Resolved to current names live at render. Idempotent.
    await sql`
      INSERT INTO timeline_event_people (event_id, role, user_id, invited_id)
      SELECT te.id, 'reporter', i.reported_by, i.invited_reported_by
      FROM timeline_events te
      JOIN issues i ON i.id = (te.event_data->>'issueId')::uuid
      WHERE te.event_data->>'kind' = 'issue_opened'
        AND (i.reported_by IS NOT NULL OR i.invited_reported_by IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM timeline_event_people tep
          WHERE tep.event_id = te.id AND tep.role = 'reporter'
        )
    `;

    // issue_closed: the closer is unknown (no audit history), so no actor and
    // no person-reference — renders "Issue #N closed" with no "by".
    const issuesClosed = await sql`
      INSERT INTO timeline_events (
        machine_id, created_at, source_type, tag, event_data
      )
      SELECT
        m.id,
        i.closed_at,
        'issue',
        'issue',
        jsonb_build_object(
          'kind', 'issue_closed',
          'issueId', i.id::text,
          'issueNumber', i.issue_number,
          'title', i.title,
          'closedAsStatus', i.status
        )
      FROM issues i
      JOIN machines m ON m.initials = i.machine_initials
      WHERE i.closed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM timeline_events te
          WHERE te.machine_id = m.id
            AND te.event_data->>'kind' = 'issue_closed'
            AND te.event_data->>'issueId' = i.id::text
        )
      RETURNING id
    `;
    counts.issueClosed = issuesClosed.length;
  } finally {
    await sql.end();
  }

  return counts;
}

backfill()
  .then((counts) => {
    console.log(
      `✅ backfill: machine_added=${counts.machineAdded} issue_opened=${counts.issueOpened} issue_closed=${counts.issueClosed}`
    );
  })
  .catch((err) => {
    console.error("❌ backfill failed:", err);
    process.exit(1);
  });
