#!/usr/bin/env node
/* eslint-disable no-undef */
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
 *     `openedByName` resolved from reportedBy → user_profiles.name, OR
 *     invitedReportedBy → invited_users.name, OR `reporter_name` for
 *     public reports, falling back to "Anonymous" (email privacy: rule 10).
 *   - `issue_closed`   per issue with `issues.closed_at IS NOT NULL`,
 *     dated `closed_at`. `closedByName` is unknown — schema doesn't track it.
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

import postgres from "postgres";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL or POSTGRES_URL_NON_POOLING is not defined");
  process.exit(1);
}

async function backfill() {
  const sql = postgres(databaseUrl);
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
          'openedByName', COALESCE(
            up.name,
            iu.first_name || ' ' || iu.last_name,
            i.reporter_name,
            'Anonymous'
          ),
          'title', i.title
        )
      FROM issues i
      JOIN machines m ON m.initials = i.machine_initials
      LEFT JOIN user_profiles up ON up.id = i.reported_by
      LEFT JOIN invited_users iu ON iu.id = i.invited_reported_by
      WHERE NOT EXISTS (
          SELECT 1 FROM timeline_events te
          WHERE te.machine_id = m.id
            AND te.event_data->>'kind' = 'issue_opened'
            AND te.event_data->>'issueId' = i.id::text
        )
      RETURNING id
    `;
    counts.issueOpened = issuesOpened.length;

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
          'closedByName', 'Unknown'
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
