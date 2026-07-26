#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Machine Settings Sets Demo Seed (PP-43q3, PP-tn6t) — LOCAL ONLY
 *
 * Populates the `machine_settings_sets` table for ONE showcase machine, Attack
 * from Mars (AFM), so the Machine Settings tab always has something meaningful
 * to demo in local dev / design review. The six sets are spread across every
 * axis of the PP-tn6t ownership/visibility model so all the badges appear —
 * both kinds (owner/community) × both visibilities (public/private draft), with
 * the Tournament tag present on some and absent on others:
 *
 *   1. "Tournament (competition)" — the Owner's default (owner set, public,
 *      preferred) AND Tournament-tagged, showing the tag is orthogonal to the
 *      default. Created by AFM's owner. Realistic WPC competition adjustments.
 *   2. "Full reference (every section type)" — an owner set, public, not the
 *      default — a kitchen-sink set exercising EVERY section kind (software,
 *      two tables, a dip bank, three notes) so the UI's full range shows.
 *   3. "Weekly league setup" — a Community set (public, Tournament-tagged)
 *      created by a technician, showing the co-edited kind + a non-owner author.
 *   4. "Draft — testing steeper tilt" — a Community Private draft created by a
 *      technician, showing the private-draft badge (visible to its creator and
 *      admins only).
 *   5. "House standard" — a Community set, public, NOT Tournament-tagged (the
 *      contrast to set 3): a plain community badge. Created by a technician.
 *   6. "New ruleset (draft)" — an Owner Private draft (owner-authored, not
 *      public, not the default): an owner set still in the draft state.
 *
 * The data shape mirrors the `SettingsSection` union in
 * src/lib/machines/settings-types.ts. Persisted rows do NOT carry the
 * client-only `_key` field (re-derived on read), so it is omitted here.
 *
 * Realism note: AFM is a WPC-95 DMD game with NO physical DIP switches, so the
 * `dip` section in set 2 is UI-showcase content, not an accurate AFM mechanism.
 * Set 1 is accurate (A.1 numbers verified against the AFM operator manual:
 * A.1 01 Balls Per Game, A.1 02 Tilt Warnings, A.1 03 Maximum Extra Balls,
 * A.1 05 Replay System, A.1 14 Replay Award, A.1 26 Tournament Play).
 *
 * Deterministic: every run wipes AFM's existing sets and re-inserts these six,
 * so re-seeding never duplicates or leaves stale demo rows.
 *
 * Demo data — DO NOT point at prod. Like the other seed scripts (seed-users.mjs)
 * this runs against whatever POSTGRES_URL is set, with no host guard: local dev
 * (db:reset) and the on-demand preview pipeline both target ephemeral branch DBs.
 * Reaching prod requires deliberately exporting a prod POSTGRES_URL and running
 * by hand — which the read-only root checkout and AGENTS.md rules already forbid.
 */

import postgres from "postgres";

// Use the pooled POSTGRES_URL (port :6543, IPv4) like seed-users.mjs — NOT
// POSTGRES_URL_NON_POOLING (:5432), which resolves to IPv6 and is unreachable
// from CI / the preview pipeline runners (AGENTS.md §7). The preview "Seed
// machine settings demo" step crashed with ENETUNREACH against the :5432 host
// before this was switched.
const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL is not defined");
  process.exit(1);
}

/** Wrap a single sentence of plain text in a minimal ProseMirror doc. */
function doc(text) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

/**
 * The AFM settings sets, defined as a function of the looked-up machine id plus
 * the two authors we distribute them across: `ownerId` (AFM's owner — makes the
 * protected "owner" sets) and `techId` (a technician — makes the co-edited
 * "community" sets). `sections` matches the persist-ready `SettingsSection[]`
 * shape (no client `_key`); the display order of `sections` is the array order
 * here. Each set carries its own `isOwnerSet` / `isPublic` / `isPreferred` /
 * `isTournament` / `createdBy` so the demo covers every PP-tn6t badge combo.
 */
function buildSets(afmId, ownerId, techId) {
  return [
    // --------------------------------------------------------------------
    // 1. The Owner's default (owner set + public + preferred) AND a
    //    Tournament set — the tag is orthogonal to the default. Realistic
    //    competition floor setup, authored by the owner.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "Tournament (competition)",
      isOwnerSet: true,
      isPublic: true,
      isPreferred: true,
      isTournament: true,
      createdBy: ownerId,
      description: doc(
        "Competition setup for league and tournament play: 3 balls, no extra balls, replays off."
      ),
      sections: [
        {
          id: "afm-tournament-software",
          kind: "software",
          baseline: "3-ball",
          rows: [
            { id: "A.1 01", name: "Balls Per Game", value: "3" },
            { id: "A.1 26", name: "Tournament Play", value: "Yes" },
            { id: "A.1 03", name: "Maximum Extra Balls", value: "0" },
            { id: "A.1 14", name: "Replay Award", value: "Audit (no award)" },
            { id: "A.1 05", name: "Replay System", value: "Fixed" },
            { id: "A.1 02", name: "Tilt Warnings", value: "1" },
          ],
        },
        {
          id: "afm-tournament-post-positions",
          kind: "note",
          title: "Post positions",
          customTitle: false,
          body: doc(
            "Factory post positions: lower-right slingshot post seated in the bottom hole for the tighter competition outlane."
          ),
        },
      ],
    },

    // --------------------------------------------------------------------
    // 2. Everything-filled reference — one of each section kind (with the
    //    repeatable ones doubled) and no blank fields, so the full UI range
    //    shows at once. An owner set, public, but NOT the default. NOT a real
    //    AFM setup; demo content.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "Full reference (every section type)",
      isOwnerSet: true,
      isPublic: true,
      isPreferred: false,
      isTournament: false,
      createdBy: ownerId,
      description: doc(
        "Reference set exercising every section type and field — software adjustments, two generic tables, a DIP bank, and preset + custom notes. Demo content, not a competition setup."
      ),
      sections: [
        {
          id: "afm-full-software",
          kind: "software",
          baseline: "3-ball",
          rows: [
            { id: "A.1 01", name: "Balls Per Game", value: "3" },
            { id: "A.1 02", name: "Tilt Warnings", value: "2" },
            { id: "A.1 03", name: "Maximum Extra Balls", value: "4" },
            { id: "A.1 05", name: "Replay System", value: "Auto" },
            { id: "A.1 14", name: "Replay Award", value: "Extra Ball" },
            { id: "A.1 26", name: "Tournament Play", value: "No" },
            { id: "A.2 09", name: "Ball Saver", value: "On (5 seconds)" },
          ],
        },
        {
          id: "afm-full-table-coils",
          kind: "table",
          title: "Flipper & coil settings",
          rows: [
            {
              id: "FL-11630",
              name: "Flipper coil (main)",
              value: "FL-11630 — 22 / 1100 turns",
            },
            { id: "AE-26-1200", name: "Saucer kicker", value: "AE-26-1200" },
            { id: "SG-23-800", name: "Slingshot", value: "SG-23-800" },
            {
              id: "ALIGN",
              name: "Flipper alignment",
              value: "Tip aligned to the lower guide hole",
            },
          ],
        },
        {
          id: "afm-full-table-fuses",
          kind: "table",
          title: "Fuse values",
          rows: [
            { id: "F101", name: "General illumination", value: "5 A slow-blow" },
            { id: "F102", name: "Flipper power", value: "3 A slow-blow" },
            { id: "F103", name: "Solenoid power", value: "8 A slow-blow" },
            { id: "F104", name: "DMD high voltage", value: "1.6 A slow-blow" },
          ],
        },
        {
          id: "afm-full-dip",
          kind: "dip",
          name: "Diagnostic option switches",
          switches: [
            { switch: "SW1", position: "ON", note: "Free play enabled." },
            {
              switch: "SW2",
              position: "OFF",
              note: "Coin-door pricing follows the standard chart.",
            },
            { switch: "SW3", position: "ON", note: "Attract-mode sound on." },
            {
              switch: "SW4",
              position: "OFF",
              note: "Match feature disabled for tournament play.",
            },
            {
              switch: "SW5",
              position: "ON",
              note: "High-score initial entry allowed.",
            },
          ],
        },
        {
          id: "afm-full-note-posts",
          kind: "note",
          title: "Post positions",
          customTitle: false,
          body: doc(
            "Lower-right slingshot post in the bottom hole for tighter outlanes; left outlane post in the middle position."
          ),
        },
        {
          id: "afm-full-note-rubbers",
          kind: "note",
          title: "Rubbers",
          customTitle: false,
          body: doc(
            "Flipper rubbers: red, 1.5 inch. Ring rubbers: standard black throughout. Replace at the first sign of glazing."
          ),
        },
        {
          id: "afm-full-note-operator",
          kind: "note",
          title: "Operator notes",
          customTitle: true,
          body: doc(
            "Topper LED strip shares the playfield's switched outlet. Coin-box key #1284. Last full shop-out is in the service log."
          ),
        },
      ],
    },

    // --------------------------------------------------------------------
    // 3. A Community set (co-edited by technicians+, the owner, and admins),
    //    public and Tournament-tagged, authored by a technician — the
    //    non-owner, shared-ownership case.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "Weekly league setup",
      isOwnerSet: false,
      isPublic: true,
      isPreferred: false,
      isTournament: true,
      createdBy: techId,
      description: doc(
        "Shared setup the crew keeps current for the Tuesday league night — mirrors the owner's competition floor but with a shorter ball saver for pace."
      ),
      sections: [
        {
          id: "afm-league-software",
          kind: "software",
          baseline: "3-ball",
          rows: [
            { id: "A.1 01", name: "Balls Per Game", value: "3" },
            { id: "A.1 26", name: "Tournament Play", value: "Yes" },
            { id: "A.1 03", name: "Maximum Extra Balls", value: "0" },
            { id: "A.2 09", name: "Ball Saver", value: "On (3 seconds)" },
          ],
        },
        {
          id: "afm-league-note",
          kind: "note",
          title: "Post positions",
          customTitle: false,
          body: doc(
            "Left outlane post in the tight (upper) position for league night; drop it back to the middle for casual play afterward."
          ),
        },
      ],
    },

    // --------------------------------------------------------------------
    // 4. A Community Private draft (visible only to its creator + admins),
    //    authored by a technician — an in-progress experiment not yet shared.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "Draft — testing steeper tilt",
      isOwnerSet: false,
      isPublic: false,
      isPreferred: false,
      isTournament: false,
      createdBy: techId,
      description: doc(
        "Work in progress — trying a tighter tilt before proposing it to the group. Not shared yet."
      ),
      sections: [
        {
          id: "afm-draft-software",
          kind: "software",
          baseline: "3-ball",
          rows: [
            { id: "A.1 02", name: "Tilt Warnings", value: "1" },
            { id: "A.2 01", name: "Tilt Sensitivity", value: "Sensitive" },
          ],
        },
        {
          id: "afm-draft-note",
          kind: "note",
          title: "Work in progress",
          customTitle: true,
          body: doc(
            "Need to confirm the plumb bob doesn't false-trigger on a hard nudge before making this public."
          ),
        },
      ],
    },

    // --------------------------------------------------------------------
    // 5. A Community set that is public but NOT Tournament-tagged — the
    //    everyday "house" setup the crew keeps current. Shows the Community
    //    badge without the Tournament tag (contrast with set 3). Authored by
    //    a technician.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "House standard",
      isOwnerSet: false,
      isPublic: true,
      isPreferred: false,
      isTournament: false,
      createdBy: techId,
      description: doc(
        "Everyday casual setup for open play — a little more forgiving than the competition floor. Kept current by the crew."
      ),
      sections: [
        {
          id: "afm-house-software",
          kind: "software",
          baseline: "3-ball",
          rows: [
            { id: "A.1 01", name: "Balls Per Game", value: "3" },
            { id: "A.1 03", name: "Maximum Extra Balls", value: "2" },
            { id: "A.1 14", name: "Replay Award", value: "Extra Ball" },
            { id: "A.2 09", name: "Ball Saver", value: "On (8 seconds)" },
          ],
        },
      ],
    },

    // --------------------------------------------------------------------
    // 6. An Owner Private draft — the machine owner working on a new ruleset
    //    they haven't shared yet. Shows an owner set that is still a private
    //    draft (owner-authored, not public, not the default).
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "New ruleset (draft)",
      isOwnerSet: true,
      isPublic: false,
      isPreferred: false,
      isTournament: false,
      createdBy: ownerId,
      description: doc(
        "Sketching out a slightly harder house ruleset. Not ready to make this the default yet — still testing it on location."
      ),
      sections: [
        {
          id: "afm-newruleset-software",
          kind: "software",
          baseline: "3-ball",
          rows: [
            { id: "A.1 01", name: "Balls Per Game", value: "3" },
            { id: "A.1 02", name: "Tilt Warnings", value: "2" },
            { id: "A.1 03", name: "Maximum Extra Balls", value: "1" },
          ],
        },
        {
          id: "afm-newruleset-note",
          kind: "note",
          title: "Operator notes",
          customTitle: true,
          body: doc(
            "Trying one extra ball max as a middle ground between the house standard and the competition floor. Gather feedback before publishing."
          ),
        },
      ],
    },
  ];
}

async function run() {
  const sql = postgres(databaseUrl);

  try {
    const [afm] = await sql`
      SELECT id, owner_id FROM machines WHERE initials = 'AFM' LIMIT 1
    `;
    if (!afm) {
      console.log(
        "ℹ️  Attack from Mars (AFM) not found in seed; machine-settings demo skipped."
      );
      return;
    }

    // Distribute authorship across two roles so the demo's owner vs community
    // sets have plausible creators. `owner_id` on AFM authors the protected
    // owner sets; a technician authors the co-edited community sets. Both
    // `created_by`/`updated_by` are ON DELETE SET NULL, so a null author is
    // acceptable if the expected user isn't present.
    const userRows = await sql`
      SELECT id, role FROM user_profiles ORDER BY role LIMIT 20
    `;
    const ownerId =
      afm.owner_id ??
      userRows.find((u) => u.role === "member")?.id ??
      userRows.find((u) => u.role === "admin")?.id ??
      userRows[0]?.id ??
      null;
    // A technician for community sets; fall back to any non-owner, then owner.
    const techId =
      userRows.find((u) => u.role === "technician")?.id ??
      userRows.find((u) => u.id !== ownerId)?.id ??
      ownerId;
    // Owner/admin author for the machine-level reference metadata below.
    const author =
      userRows.find((u) => u.role === "admin")?.id ?? ownerId ?? null;

    // Machine-level "How to change settings" (shared by every set; rendered at
    // the top of the Settings tab). AFM is a Bally/Williams WPC game, so this is
    // the verbatim "Bally / Williams WPC" preset (the `wpc` entry in
    // src/lib/machines/settings-instructions-presets.ts) — keep this in sync
    // with that preset so the demo shows what applying the preset produces.
    // Shape matches plainTextToDoc(): the single `\n` becomes a hardBreak; the
    // `\n\n` becomes a paragraph boundary.
    const accessInstructions = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Open the coin door and enter the menu with the service button.",
            },
            { type: "hardBreak" },
            {
              type: "text",
              text: "Adjustments are under A. Adjustments; the difficulty presets (Extra Easy → Extra Hard) and factory-default restore are under U. Utilities.",
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Use the Utilities preset / Factory Adjustments option to restore defaults.",
            },
          ],
        },
      ],
    };
    // Machine-level "Before you change anything" (PP-8a5r): the owner's honor-
    // system requests, rendered FIRST. Kept short and deliberately NEUTRAL — it
    // states a preference (ask first, document changes) without endorsing or
    // forbidding a reset stance, matching the field's request-not-rule framing.
    const ownerRequests = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "I've spent a while dialing this game in. If you need to change something for a tournament, that's fine — please just jot down what you changed (or ping me) so it can be put back afterward. Happy to walk anyone through it.",
            },
          ],
        },
      ],
    };
    await sql`
      UPDATE machines
      SET settings_instructions = ${sql.json(accessInstructions)},
          settings_requests = ${sql.json(ownerRequests)}
      WHERE id = ${afm.id}
    `;

    const sets = buildSets(afm.id, ownerId, techId);

    // Deterministic: wipe AFM's existing sets, then insert this pair. Clearing
    // first also sidesteps the partial unique index on is_preferred (a stale
    // preferred row would otherwise collide with set 1's insert).
    await sql`DELETE FROM machine_settings_sets WHERE machine_id = ${afm.id}`;

    for (const set of sets) {
      await sql`
        INSERT INTO machine_settings_sets (
          machine_id, name, description, sections,
          is_owner_set, is_public, is_preferred, is_tournament,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ${set.machineId},
          ${set.name},
          ${set.description ? sql.json(set.description) : null},
          ${sql.json(set.sections)},
          ${set.isOwnerSet},
          ${set.isPublic},
          ${set.isPreferred},
          ${set.isTournament},
          ${set.createdBy ?? author},
          ${set.createdBy ?? author},
          NOW(),
          NOW()
        )
      `;
    }

    console.log(
      `✅ Machine settings seeded: ${sets.length} sets (owner default+tournament, owner public, owner draft, community public+tournament, community public, community draft) + owner requests + access instructions on Attack from Mars (AFM).`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-machine-settings failed:", err);
  process.exit(1);
});
