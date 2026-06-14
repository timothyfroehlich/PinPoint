#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Machine Settings Sets Demo Seed (PP-43q3) — LOCAL ONLY
 *
 * Populates the `machine_settings_sets` table for ONE showcase machine, Attack
 * from Mars (AFM), so the Machine Settings tab always has something meaningful
 * to demo in local dev / design review. AFM gets two sets:
 *
 *   1. "Tournament (competition)" — isPreferred=true — a realistic, accurate
 *      competition setup: a `software` section (WPC standard adjustments) + a
 *      `note` section using the "Post positions" preset title.
 *   2. "Full reference (every section type)" — isPreferred=false — a kitchen-sink
 *      set that exercises EVERY section kind and fills every field, so the UI's
 *      full range is visible at once: `software`, two `table` sections, a `dip`
 *      bank, and three `note` sections (both presets + a custom title).
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
 * Deterministic: every run wipes AFM's existing sets and re-inserts these two,
 * so re-seeding never duplicates or leaves stale demo rows.
 *
 * Demo data — DO NOT point at prod. Like the other seed scripts (seed-users.mjs)
 * this runs against whatever POSTGRES_URL is set, with no host guard: local dev
 * (db:reset) and the on-demand preview pipeline both target ephemeral branch DBs.
 * Reaching prod requires deliberately exporting a prod POSTGRES_URL and running
 * by hand — which the read-only root checkout and AGENTS.md rules already forbid.
 */

import postgres from "postgres";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL or POSTGRES_URL_NON_POOLING is not defined");
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
 * The two AFM settings sets, defined as a function of the looked-up machine id.
 * `sections` matches the persist-ready `SettingsSection[]` shape (no client
 * `_key`); the display order of `sections` is the array order here.
 */
function buildSets(afmId) {
  return [
    // --------------------------------------------------------------------
    // 1. Preferred, realistic — a competition floor setup.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "Tournament (competition)",
      isPreferred: true,
      description: doc(
        "Competition setup for league and tournament play: 3 balls, no extra balls, replays off."
      ),
      sections: [
        {
          id: "afm-tournament-software",
          kind: "software",
          baseline: "3-ball",
          baselineNote: "Coin-door menu → A.1 Standard Adjustments.",
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
    //    shows at once. NOT a real AFM setup; demo content.
    // --------------------------------------------------------------------
    {
      machineId: afmId,
      name: "Full reference (every section type)",
      isPreferred: false,
      description: doc(
        "Reference set exercising every section type and field — software adjustments, two generic tables, a DIP bank, and preset + custom notes. Demo content, not a competition setup."
      ),
      sections: [
        {
          id: "afm-full-software",
          kind: "software",
          baseline: "3-ball",
          baselineNote: "Coin-door menu → A.1 Standard Adjustments.",
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
  ];
}

async function run() {
  const sql = postgres(databaseUrl);

  try {
    const [afm] = await sql`
      SELECT id FROM machines WHERE initials = 'AFM' LIMIT 1
    `;
    if (!afm) {
      console.log(
        "ℹ️  Attack from Mars (AFM) not found in seed; machine-settings demo skipped."
      );
      return;
    }

    // Pick a "created_by"/"updated_by" author: prefer an admin seed user,
    // fall back to any user profile. Both columns are ON DELETE SET NULL, so
    // a null author is acceptable if no users exist yet.
    const userRows = await sql`
      SELECT id, role FROM user_profiles ORDER BY role LIMIT 5
    `;
    const author =
      userRows.find((u) => u.role === "admin")?.id ?? userRows[0]?.id ?? null;

    const sets = buildSets(afm.id);

    // Deterministic: wipe AFM's existing sets, then insert this pair. Clearing
    // first also sidesteps the partial unique index on is_preferred (a stale
    // preferred row would otherwise collide with set 1's insert).
    await sql`DELETE FROM machine_settings_sets WHERE machine_id = ${afm.id}`;

    for (const set of sets) {
      await sql`
        INSERT INTO machine_settings_sets (
          machine_id, name, description, sections, is_preferred,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ${set.machineId},
          ${set.name},
          ${set.description ? sql.json(set.description) : null},
          ${sql.json(set.sections)},
          ${set.isPreferred},
          ${author},
          ${author},
          NOW(),
          NOW()
        )
      `;
    }

    console.log(
      `✅ Machine settings seeded: ${sets.length} sets on Attack from Mars (AFM).`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-machine-settings failed:", err);
  process.exit(1);
});
