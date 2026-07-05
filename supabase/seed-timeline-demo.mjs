#!/usr/bin/env node
/**
 * Machine Timeline Demo Seed (PP-0x98) — LOCAL ONLY
 *
 * The backfill script populates `machine_added`, `issue_opened`, and
 * `issue_closed` events from real seed data (those are the kinds we have
 * actual history for). This script populates AFM (Attack from Mars) with ONE
 * of every OTHER kind so the timeline tab is visually exhaustive for demos
 * and design reviews. Also sprinkles in a few user comments with mixed
 * authors.
 *
 * Idempotent: bails if AFM already has an `owner_requirements_updated` row
 * (which the demo is the only source of in seed data).
 *
 * NEVER run on prod. The script refuses to run unless POSTGRES_URL points
 * at a localhost/127.0.0.1 host.
 */

import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "../scripts/lib/pg-client.mjs";
import { assertLocalDatabase } from "../scripts/assert-local-db.mjs";

const databaseUrl = resolveScriptDatabaseUrl();

// Hard refusal on non-local URLs (rule 3 / db safety: never seed prod).
assertLocalDatabase(databaseUrl);

async function run() {
  const sql = createScriptClient(databaseUrl);

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

    // Idempotency sentinel: `owner_requirements_updated` is unique to the demo
    // seed on AFM (the backfill script doesn't emit it). Previously this used
    // `description_updated`, but that event was dropped from the demo as
    // part of the V2 design pass.
    const existing = await sql`
      SELECT count(*)::int AS cnt
      FROM timeline_events
      WHERE machine_id = ${afm.id}
        AND event_data->>'kind' = 'owner_requirements_updated'
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

    // Walk timestamps backwards in 1-hour increments. Each push to `events`
    // calls nextStamp() immediately, so the array order IS the desired
    // chronological order. `skipToDaysAgo(N)` jumps the cursor back to that
    // many days before "now" so subsequent events land in the day-group
    // we want — gives the timeline visible "Today", "Yesterday", and
    // absolute-date headings rather than everything landing in one bucket.
    let stamp = Date.now();
    const nextStamp = () => {
      stamp -= 60 * 60 * 1000;
      return new Date(stamp);
    };
    const skipToDaysAgo = (n) => {
      const anchor = new Date();
      anchor.setHours(20, 0, 0, 0); // 8pm local on the target day
      anchor.setDate(anchor.getDate() - n);
      stamp = anchor.getTime();
    };

    // `people` (optional): timeline_event_people rows to attach after insert,
    // each { role, userId } (demo users are all real accounts). Person display
    // resolves live at render (PP-tv9l) — no names stored in event_data.
    const lifecycle = (eventData, people) => ({
      source: "lifecycle",
      createdAt: nextStamp(),
      tag: "lifecycle",
      eventData,
      ...(people ? { people } : {}),
    });
    const issue = (eventData, people) => ({
      source: "issue",
      createdAt: nextStamp(),
      tag: "issue",
      eventData,
      ...(people ? { people } : {}),
    });
    const comment = (authorId, tag, text) => ({
      source: "comment",
      createdAt: nextStamp(),
      tag,
      authorId,
      doc: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text }] },
        ],
      },
    });

    // Interleaved demo timeline — newest first. Comments are sprinkled
    // between lifecycle/issue events so the rendered timeline has visual
    // variety. Each entry is only pushed if its prerequisite users / issues
    // exist in the seed.
    //
    // skipToDaysAgo() calls between groups span four day-buckets so the
    // rendered timeline shows "Today", "Yesterday", and two absolute-date
    // headings — useful for design review and screenshots.
    const events = [];

    // -- Today --
    if (adminUser) {
      events.push(
        comment(
          adminUser.id,
          "highlight",
          "Featured machine at the Friday tournament — held up great."
        )
      );
    }
    if (techUser) {
      events.push(
        comment(
          techUser.id,
          "inspection",
          "Pre-tournament walk-through. All switches firing, no scorched coils."
        )
      );
    }
    events.push(
      lifecycle({
        kind: "presence_changed",
        from: "on_the_floor",
        to: "off_the_floor",
      })
    );

    // -- Yesterday --
    skipToDaysAgo(1);
    events.push(
      lifecycle({
        kind: "name_changed",
        from: afm.name,
        to: `${afm.name} (renamed)`,
      })
    );
    if (techUser) {
      events.push(
        comment(
          techUser.id,
          "maintenance",
          "Rebuilt the left flipper. Coil tested at 6.2Ω."
        )
      );
    }
    if (issueA) {
      events.push(
        issue({
          kind: "issue_status_changed",
          issueId: issueA.id,
          issueNumber: issueA.number,
          from: "new",
          to: "investigating",
          title: issueA.title,
        })
      );
    }

    // -- Three days ago --
    skipToDaysAgo(3);
    if (memberUser) {
      events.push(
        comment(
          memberUser.id,
          "cleaning",
          "Wax + clean playfield. Replaced two worn rubbers."
        )
      );
    }
    if (issueA && techUser) {
      events.push(
        issue(
          {
            kind: "issue_assigned",
            issueId: issueA.id,
            issueNumber: issueA.number,
            title: issueA.title,
          },
          [{ role: "assignee", userId: techUser.id }]
        )
      );
    }
    if (issueA) {
      events.push(
        issue({
          kind: "issue_unassigned",
          issueId: issueA.id,
          issueNumber: issueA.number,
          title: issueA.title,
        })
      );
    }
    events.push(lifecycle({ kind: "owner_requirements_updated" }));

    // -- A week ago --
    skipToDaysAgo(7);
    if (memberUser) {
      events.push(
        lifecycle({ kind: "owner_set" }, [
          { role: "to_owner", userId: memberUser.id },
        ])
      );
    }
    if (memberUser && adminUser) {
      events.push(
        lifecycle({ kind: "owner_changed" }, [
          { role: "from_owner", userId: memberUser.id },
          { role: "to_owner", userId: adminUser.id },
        ])
      );
    }
    if (issueB) {
      events.push(
        issue({
          kind: "issue_reassigned_out",
          issueId: issueB.id,
          issueNumber: issueB.number,
          toMachineId: other.id,
          title: issueB.title,
        })
      );
    }

    // -- Last month — exercises the Tier-2 (month) rollup banner --
    skipToDaysAgo(35);
    if (techUser) {
      events.push(
        comment(
          techUser.id,
          "maintenance",
          "Quarterly service: shopped out, leveled, new rubbers."
        )
      );
    }
    if (issueA) {
      events.push(
        issue({
          kind: "issue_status_changed",
          issueId: issueA.id,
          issueNumber: issueA.number,
          from: "in_progress",
          to: "need_parts",
          title: issueA.title,
        })
      );
    }

    // -- Two months back — second month-tier bucket --
    skipToDaysAgo(70);
    events.push(
      lifecycle({
        kind: "presence_changed",
        from: "off_the_floor",
        to: "on_the_floor",
      })
    );
    if (adminUser) {
      events.push(
        comment(
          adminUser.id,
          "highlight",
          "Hosted the spring tournament — held up across 40 games."
        )
      );
    }
    if (memberUser) {
      events.push(
        comment(
          memberUser.id,
          "upgrade",
          "Installed Comet GI kit + warm-white inserts. Big visual lift."
        )
      );
    }
    if (techUser) {
      events.push(
        comment(
          techUser.id,
          "adjustment",
          "Bumped tilt sensitivity down two notches; leveled to 6.5° pitch."
        )
      );
    }
    if (techUser) {
      events.push(
        comment(
          techUser.id,
          "parts",
          "Ordered 2× new flipper coils (FL11629). ETA Friday."
        )
      );
    }
    if (memberUser) {
      events.push(
        comment(
          memberUser.id,
          "note",
          "Plunger feels a bit weak today; not broken, just noting it."
        )
      );
    }

    let commentCount = 0;
    let systemCount = 0;
    for (const ev of events) {
      if (ev.source === "comment") {
        await sql`
          INSERT INTO timeline_events (
            machine_id, created_at, source_type, tag, author_id, content
          ) VALUES (
            ${afm.id},
            ${ev.createdAt},
            'comment',
            ${ev.tag},
            ${ev.authorId},
            ${sql.json(ev.doc)}
          )
        `;
        commentCount++;
      } else {
        const inserted = await sql`
          INSERT INTO timeline_events (
            machine_id, created_at, source_type, tag, event_data
          ) VALUES (
            ${afm.id},
            ${ev.createdAt},
            ${ev.source},
            ${ev.tag},
            ${sql.json(ev.eventData)}
          )
          RETURNING id
        `;
        systemCount++;
        const eventId = inserted[0]?.id;
        if (eventId && ev.people) {
          for (const p of ev.people) {
            // Support both {userId} and {invitedId} refs; sending undefined
            // for both would write a both-null row that renders "Former user".
            await sql`
              INSERT INTO timeline_event_people (event_id, role, user_id, invited_id)
              VALUES (${eventId}, ${p.role}, ${p.userId ?? null}, ${p.invitedId ?? null})
            `;
          }
        }
      }
    }

    // The matching reassigned_in lives on the OTHER machine's timeline.
    // Goes in last so its timestamp lands between the AFM events naturally.
    if (issueB) {
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
            title: issueB.title,
          })}
        )
      `;
    }

    console.log(
      `✅ AFM demo seeded: system=${systemCount} comments=${commentCount} (interleaved) (+1 reassigned_in on ${other.name})`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-timeline-demo failed:", err);
  process.exit(1);
});
