#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Machine Timeline Demo Seed (PP-0x98) — LOCAL ONLY
 *
 * The backfill script populates `machine_added`, `issue_opened`, and
 * `issue_closed` events from real seed data (those are the kinds we have
 * actual history for). This script populates AFM (Addams Family) with ONE
 * of every OTHER kind so the timeline tab is visually exhaustive for demos
 * and design reviews. Also sprinkles in a few user comments with mixed
 * authors.
 *
 * Idempotent: bails if AFM already has a `description_updated` row (which
 * the demo is the only source of in seed data).
 *
 * NEVER run on prod. The script refuses to run unless POSTGRES_URL points
 * at a localhost/127.0.0.1 host.
 */

import postgres from "postgres";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL or POSTGRES_URL_NON_POOLING is not defined");
  process.exit(1);
}

// Hard refusal on non-local URLs (rule 3 / db safety: never seed prod).
{
  const url = new URL(databaseUrl);
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    console.error(
      `❌ seed-timeline-demo refuses to run against non-local DB (${url.hostname})`
    );
    process.exit(1);
  }
}

async function run() {
  const sql = postgres(databaseUrl);

  try {
    const machineRows = await sql`
      SELECT id, name, owner_id AS "ownerId"
      FROM machines
      WHERE initials = 'AFM'
      LIMIT 1
    `;
    const afm = machineRows[0];
    if (!afm) {
      console.log("ℹ️  AFM machine not found in seed; demo seed skipped.");
      return;
    }

    const existing = await sql`
      SELECT count(*)::int AS cnt
      FROM timeline_events
      WHERE machine_id = ${afm.id}
        AND event_data->>'kind' = 'description_updated'
    `;
    if ((existing[0]?.cnt ?? 0) > 0) {
      console.log("ℹ️  AFM demo already seeded; skipping.");
      return;
    }

    const otherRows = await sql`
      SELECT id, name FROM machines WHERE id != ${afm.id} LIMIT 1
    `;
    const other = otherRows[0];
    if (!other) {
      console.log("ℹ️  No alternate machine for reassign demo; skipping.");
      return;
    }

    const userRows = await sql`
      SELECT id, name, role FROM user_profiles ORDER BY role LIMIT 5
    `;
    const memberUser = userRows.find((u) => u.role === "member");
    const adminUser = userRows.find((u) => u.role === "admin");
    const techUser = userRows.find((u) => u.role === "technician");

    const issueRows = await sql`
      SELECT id, issue_number AS "number", title
      FROM issues
      WHERE machine_initials = 'AFM'
      ORDER BY issue_number
      LIMIT 2
    `;
    const issueA = issueRows[0];
    const issueB = issueRows[1];

    // Walk timestamps backwards from now in 1-hour increments so events
    // sort cleanly newest-first.
    let stamp = Date.now();
    const nextStamp = () => {
      stamp -= 60 * 60 * 1000;
      return new Date(stamp);
    };

    const lifecycleRows = [
      {
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: {
          kind: "presence_changed",
          from: "on_the_floor",
          to: "off_the_floor",
        },
      },
      {
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: {
          kind: "name_changed",
          from: afm.name,
          to: `${afm.name} (renamed)`,
        },
      },
      {
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: { kind: "description_updated" },
      },
      {
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: { kind: "tournament_notes_updated" },
      },
      {
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: { kind: "owner_requirements_updated" },
      },
      {
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: { kind: "owner_notes_updated" },
      },
    ];

    if (memberUser) {
      lifecycleRows.push({
        createdAt: nextStamp(),
        tag: "lifecycle",
        sourceType: "lifecycle",
        eventData: {
          kind: "owner_set",
          toOwnerId: memberUser.id,
          toOwnerName: memberUser.name ?? "Member",
        },
      });
      if (adminUser) {
        lifecycleRows.push({
          createdAt: nextStamp(),
          tag: "lifecycle",
          sourceType: "lifecycle",
          eventData: {
            kind: "owner_changed",
            fromOwnerId: memberUser.id,
            fromOwnerName: memberUser.name ?? "Member",
            toOwnerId: adminUser.id,
            toOwnerName: adminUser.name ?? "Admin",
          },
        });
      }
    }

    if (issueA) {
      lifecycleRows.push({
        createdAt: nextStamp(),
        tag: "issue",
        sourceType: "issue",
        eventData: {
          kind: "issue_status_changed",
          issueId: issueA.id,
          issueNumber: issueA.number,
          from: "new",
          to: "investigating",
        },
      });
      if (techUser) {
        lifecycleRows.push({
          createdAt: nextStamp(),
          tag: "issue",
          sourceType: "issue",
          eventData: {
            kind: "issue_assigned",
            issueId: issueA.id,
            issueNumber: issueA.number,
            assigneeName: techUser.name ?? "Technician",
          },
        });
      }
      lifecycleRows.push({
        createdAt: nextStamp(),
        tag: "issue",
        sourceType: "issue",
        eventData: {
          kind: "issue_unassigned",
          issueId: issueA.id,
          issueNumber: issueA.number,
        },
      });
    }
    if (issueB) {
      lifecycleRows.push({
        createdAt: nextStamp(),
        tag: "issue",
        sourceType: "issue",
        eventData: {
          kind: "issue_reassigned_out",
          issueId: issueB.id,
          issueNumber: issueB.number,
          toMachineId: other.id,
          toMachineName: other.name,
        },
      });
      // The matching reassigned_in lives on the OTHER machine's timeline.
      await sql`
        INSERT INTO timeline_events (
          machine_id, created_at, source_type, tag, event_data
        ) VALUES (
          ${other.id},
          ${nextStamp()},
          'issue',
          'issue',
          ${sql.json({
            kind: "issue_reassigned_in",
            issueId: issueB.id,
            issueNumber: issueB.number,
            fromMachineId: afm.id,
            fromMachineName: afm.name,
          })}
        )
      `;
    }

    for (const row of lifecycleRows) {
      await sql`
        INSERT INTO timeline_events (
          machine_id, created_at, source_type, tag, event_data
        ) VALUES (
          ${afm.id},
          ${row.createdAt},
          ${row.sourceType},
          ${row.tag},
          ${sql.json(row.eventData)}
        )
      `;
    }

    const commentRows = [];
    if (techUser) {
      commentRows.push({
        createdAt: nextStamp(),
        authorId: techUser.id,
        tag: "maintenance",
        text: "Rebuilt the left flipper. Coil tested at 6.2Ω.",
      });
    }
    if (memberUser) {
      commentRows.push({
        createdAt: nextStamp(),
        authorId: memberUser.id,
        tag: "cleaning",
        text: "Wax + clean playfield. Replaced two worn rubbers.",
      });
    }
    if (adminUser) {
      commentRows.push({
        createdAt: nextStamp(),
        authorId: adminUser.id,
        tag: "event",
        text: "Featured machine at the Friday tournament — held up great.",
      });
    }

    for (const c of commentRows) {
      const doc = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: c.text }] },
        ],
      };
      await sql`
        INSERT INTO timeline_events (
          machine_id, created_at, source_type, tag, author_id, content
        ) VALUES (
          ${afm.id},
          ${c.createdAt},
          'comment',
          ${c.tag},
          ${c.authorId},
          ${sql.json(doc)}
        )
      `;
    }

    console.log(
      `✅ AFM demo seeded: lifecycle/issue=${lifecycleRows.length} comments=${commentRows.length} (+1 reassigned_in on ${other.name})`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-timeline-demo failed:", err);
  process.exit(1);
});
