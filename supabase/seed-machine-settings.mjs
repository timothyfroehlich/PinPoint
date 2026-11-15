#!/usr/bin/env node
/**
 * Machine Settings Sets Demo Seed (PP-43q3, PP-tn6t) — local and preview
 *
 * Populates settings sets for Attack from Mars (AFM), so the Machine Settings
 * tab always has something meaningful to demo in local dev / design review,
 * covering every badge in docs/feature-specs/machine-settings.md — personal and
 * community sets, the House and Tournament tags, and both preferred sets:
 *
 *   1. "Tournament (competition)" — community, tagged House AND Tournament, the
 *      preferred House set. Created by AFM's owner. Realistic WPC adjustments.
 *   2. "Full reference (every section type)" — the owner's personal set, House —
 *      a kitchen-sink set exercising EVERY section kind (software, two tables, a
 *      dip bank, three notes) so the UI's full range shows.
 *   3. "Weekly league setup" — community, Tournament, the preferred Tournament
 *      set, created by a technician.
 *   4. "Draft — testing steeper tilt" — a technician's personal set, House.
 *   5. "House standard" — community, House, not preferred.
 *   6. "New ruleset (draft)" — the owner's personal set, House.
 *
 * Every other seeded machine gets sets that together cover each case a
 * settings sheet prints (SHEET_SETS below, docs/feature-specs/settings-sheets.md):
 * different installs, DIP and table differences, one set preferred for both, a
 * missing preferred House or Tournament set, no sets at all (The Addams
 * Family), a machine on loan (Spider-Man), and a custom "Bat City 2025" tag
 * that finds one set on most machines and two on another (CUSTOM_SETTINGS_TAGS).
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
 * Deterministic: every run wipes each seeded machine's sets and re-inserts them,
 * so re-seeding never duplicates or leaves stale demo rows.
 *
 * Demo data for local and ephemeral preview databases. Never run it against
 * PinPoint production: the guard checks the target before any connection or
 * write, including when the preview controller invokes this script.
 */

import {
  createScriptClient,
  resolveScriptDatabaseUrl,
} from "../scripts/lib/pg-client.mjs";

import { assertNotPinPointProduction } from "../scripts/lib/db-target.mjs";

// Use the pooled POSTGRES_URL (port :6543, IPv4) like seed-users.mjs — NOT
// POSTGRES_URL_NON_POOLING (:5432), which resolves to IPv6 and is unreachable
// from CI / the preview pipeline runners (AGENTS.md §7). The preview "Seed
// machine settings demo" step crashed with ENETUNREACH against the :5432 host
// before this was switched.
const databaseUrl = resolveScriptDatabaseUrl();

// Before the client is constructed and before any network call: never prod.
assertNotPinPointProduction(databaseUrl, "POSTGRES_URL");

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
 * here. Each set carries its own kind, preferred flags, built-in tags, and
 * `createdBy`.
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
      isCommunity: true,
      isPreferredHouse: true,
      isPreferredTournament: false,
      tags: ["house", "tournament"],
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
      isCommunity: false,
      isPreferredHouse: false,
      isPreferredTournament: false,
      tags: ["house"],
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
            {
              id: "F101",
              name: "General illumination",
              value: "5 A slow-blow",
            },
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
      isCommunity: true,
      isPreferredHouse: false,
      isPreferredTournament: true,
      tags: ["tournament", "bat-city-2025"],
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
      isCommunity: false,
      isPreferredHouse: false,
      isPreferredTournament: false,
      tags: ["house"],
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
      isCommunity: true,
      isPreferredHouse: false,
      isPreferredTournament: false,
      tags: ["house", "kids-night"],
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
      isCommunity: false,
      isPreferredHouse: false,
      isPreferredTournament: false,
      tags: ["house"],
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

// ---------------------------------------------------------------------------
// Settings sheet coverage (PP-k3km, docs/feature-specs/settings-sheets.md).
// Every other seeded machine gets sets chosen so a sheet of the whole floor
// shows each case the spec covers. Keyed by machine initials.
// ---------------------------------------------------------------------------

const BAT_CITY_TAG = { slug: "bat-city-2025", name: "Bat City 2025" };
/**
 * Custom settings tags (machine-settings §3): Bat City 2025 sits on several
 * machines — on a default Tournament set, on one machine's only tagged set,
 * and on two sets of one machine with no default between them; Kids night is
 * on one set; Texas Pinball Fest carries no sets, so the Settings tags page
 * shows an empty tag.
 */
const CUSTOM_SETTINGS_TAGS = [
  BAT_CITY_TAG,
  { slug: "kids-night", name: "Kids night" },
  { slug: "texas-pinball-fest", name: "Texas Pinball Fest" },
];

function software(baseline, rows) {
  return {
    id: "sec-software",
    kind: "software",
    baseline,
    rows: rows.map(([id, name, value]) => ({ id, name, value })),
  };
}

function table(title, rows) {
  return {
    id: `sec-table-${title.toLowerCase().replaceAll(" ", "-")}`,
    kind: "table",
    title,
    rows: rows.map(([id, name, value]) => ({ id, name, value })),
  };
}

function dipBank(name, switches) {
  return {
    id: `sec-dip-${name.toLowerCase().replaceAll(" ", "-")}`,
    kind: "dip",
    name,
    switches: switches.map(([sw, position, note]) => ({
      switch: sw,
      position,
      note,
    })),
  };
}

function note(title, text) {
  return {
    id: `sec-note-${title.toLowerCase().replaceAll(" ", "-")}`,
    kind: "note",
    title,
    customTitle: !["Post positions", "Rubbers"].includes(title),
    body: doc(text),
  };
}

/** A community set; `preferred` names the slots it fills. */
function sheetSet(name, tags, sections, preferred = []) {
  return {
    name,
    isCommunity: true,
    isPreferredHouse: preferred.includes("house"),
    isPreferredTournament: preferred.includes("tournament"),
    tags,
    description: null,
    sections,
  };
}

const WPC_HOUSE = [
  ["A.1 01", "Balls Per Game", "3"],
  ["A.1 02", "Tilt Warnings", "2"],
  ["A.1 03", "Maximum Extra Balls", "3"],
  ["A.1 05", "Replay System", "Auto"],
  ["A.1 14", "Replay Award", "Extra Ball"],
  ["A.1 26", "Tournament Play", "No"],
  ["A.2 09", "Ball Saver", "On (8 seconds)"],
  ["A.2 12", "Match Percentage", "7%"],
];

const WPC_TOURNAMENT = [
  ["A.1 01", "Balls Per Game", "3"],
  ["A.1 02", "Tilt Warnings", "1"],
  ["A.1 03", "Maximum Extra Balls", "0"],
  ["A.1 05", "Replay System", "Fixed"],
  ["A.1 14", "Replay Award", "Audit (no award)"],
  ["A.1 26", "Tournament Play", "Yes"],
  ["A.2 09", "Ball Saver", "Off"],
  ["A.2 12", "Match Percentage", "Off"],
];

const SPIKE_HOUSE = [
  ["S-08", "Ball Save Time", "8 s"],
  ["S-11", "Max Extra Balls", "5"],
  ["S-14", "Game Pricing", "Free Play"],
  ["S-19", "Match Percentage", "7%"],
  ["S-31", "Tilt Warnings", "3"],
];

const SHEET_SETS = {
  // Same install, software and note differences, plus a matching note.
  MM: [
    sheetSet(
      "House",
      ["house"],
      [
        software("Medium", WPC_HOUSE),
        note("Rubbers", "White, factory sizes"),
        note("Post positions", "Factory"),
      ],
      ["house"]
    ),
    sheetSet(
      "Tournament",
      ["tournament", BAT_CITY_TAG.slug],
      [
        software("Medium", [
          ...WPC_TOURNAMENT,
          ["A.2 13", "Castle Difficulty", "Hard"],
        ]),
        note("Rubbers", "White, factory sizes"),
        note("Post positions", "Left outlane post in the tight position"),
      ],
      ["tournament"]
    ),
  ],
  // Different installs: every row of the applied set prints.
  GDZ: [
    sheetSet(
      "House",
      ["house"],
      [software("Factory Install", SPIKE_HOUSE)],
      ["house"]
    ),
    sheetSet(
      "Competition",
      ["tournament", BAT_CITY_TAG.slug],
      [
        software("Competition Install", [
          ["S-08", "Ball Save Time", "3 s"],
          ["S-14", "Game Pricing", "Free Play"],
          ["S-31", "Tilt Warnings", "1"],
        ]),
      ],
      ["tournament"]
    ),
  ],
  // A preferred Tournament set and no preferred House: record the originals.
  GDZ2: [
    sheetSet(
      "League",
      ["tournament"],
      [
        software("Factory Install", [
          ["S-08", "Ball Save Time", "0 s"],
          ["S-11", "Max Extra Balls", "0"],
          ["S-19", "Match Percentage", "Off"],
        ]),
      ],
      ["tournament"]
    ),
  ],
  // A preferred House set and no preferred Tournament: blank rows only.
  GDZ3: [
    sheetSet(
      "House",
      ["house"],
      [software("Factory Install", SPIKE_HOUSE)],
      ["house"]
    ),
  ],
  // Table differences on an electromechanical game (no software install).
  HD: [
    sheetSet(
      "House",
      ["house"],
      [
        table("Adjustment plugs", [
          ["Plug J3", "Balls per game", "5-ball"],
          ["Plug J5", "Award", "Replay"],
          ["Plug J1", "Tilt bob", "Medium"],
        ]),
      ],
      ["house"]
    ),
    sheetSet(
      "Tournament",
      ["tournament"],
      [
        table("Adjustment plugs", [
          ["Plug J3", "Balls per game", "3-ball"],
          ["Plug J5", "Award", "Novelty"],
          ["Plug J1", "Tilt bob", "Medium"],
        ]),
      ],
      ["tournament"]
    ),
    // Two non-preferred sets carrying Bat City 2025: the print run asks which.
    sheetSet(
      "Bat City qualifying",
      [BAT_CITY_TAG.slug],
      [table("Adjustment plugs", [["Plug J3", "Balls per game", "3-ball"]])]
    ),
    sheetSet(
      "Bat City finals",
      [BAT_CITY_TAG.slug],
      [table("Adjustment plugs", [["Plug J3", "Balls per game", "1-ball"]])]
    ),
  ],
  // DIP switch differences on an early solid-state game.
  BK: [
    sheetSet(
      "House",
      ["house"],
      [
        dipBank("Bank 1", [
          ["SW 1", "ON", "Coin chute 1 credits"],
          ["SW 13", "OFF", "Balls per game (ON = 3)"],
          ["SW 23", "ON", "Extra ball award"],
          ["SW 25", "OFF", "Match feature"],
        ]),
      ],
      ["house"]
    ),
    sheetSet(
      "Tournament",
      ["tournament"],
      [
        dipBank("Bank 1", [
          ["SW 1", "ON", "Coin chute 1 credits"],
          ["SW 13", "ON", "Balls per game (ON = 3)"],
          ["SW 23", "OFF", "Extra ball award"],
          ["SW 25", "OFF", "Match feature"],
        ]),
      ],
      ["tournament"]
    ),
  ],
  // One set preferred for both House and Tournament (the same set), and one
  // non-preferred set carrying Bat City 2025 that a tag default finds.
  HB: [
    sheetSet(
      "House and tournament",
      ["house", "tournament"],
      [software("Factory", [["Adj 05", "Balls per game", "3"]])],
      ["house", "tournament"]
    ),
    sheetSet(
      "Bat City 2025",
      [BAT_CITY_TAG.slug],
      [
        software("Factory", [
          ["Adj 05", "Balls per game", "3"],
          ["Adj 09", "Extra ball", "Off"],
        ]),
      ]
    ),
  ],
  // On loan, so it can't be added; it is in the APC Tournament Bank collection.
  SM: [
    sheetSet(
      "House",
      ["house"],
      [software("Factory Install", SPIKE_HOUSE)],
      ["house"]
    ),
    sheetSet(
      "Tournament",
      ["tournament"],
      [
        software("Factory Install", [
          ["S-08", "Ball Save Time", "0 s"],
          ["S-11", "Max Extra Balls", "0"],
          ["S-14", "Game Pricing", "Free Play"],
          ["S-19", "Match Percentage", "Off"],
          ["S-31", "Tilt Warnings", "1"],
        ]),
        note("Operator notes", "Turn the topper off for streamed games."),
      ],
      ["tournament"]
    ),
  ],
};

async function run() {
  const sql = createScriptClient(databaseUrl);

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

    // Built-in House and Tournament tags. Migration 0106 inserts them, but the
    // fast reset truncates tables without re-running migrations, so make sure.
    // The custom tags demo settings tag pages and printing sheets by tag.
    await sql`
      INSERT INTO settings_tags (slug, name, is_builtin)
      VALUES ('house', 'House', true), ('tournament', 'Tournament', true)
      ON CONFLICT (slug) DO NOTHING
    `;
    for (const tag of CUSTOM_SETTINGS_TAGS) {
      await sql`
        INSERT INTO settings_tags (slug, name, is_builtin)
        VALUES (${tag.slug}, ${tag.name}, false)
        ON CONFLICT (slug) DO NOTHING
      `;
    }
    const tagRows = await sql`
      SELECT id, slug FROM settings_tags
      WHERE slug IN ${sql(["house", "tournament", ...CUSTOM_SETTINGS_TAGS.map((t) => t.slug)])}
    `;
    const tagIdBySlug = new Map(tagRows.map((t) => [t.slug, t.id]));

    async function insertSet(set) {
      const [row] = await sql`
        INSERT INTO machine_settings_sets (
          machine_id, name, description, sections,
          is_community, is_preferred, is_preferred_tournament,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          ${set.machineId},
          ${set.name},
          ${set.description ? sql.json(set.description) : null},
          ${sql.json(set.sections)},
          ${set.isCommunity},
          ${set.isPreferredHouse},
          ${set.isPreferredTournament},
          ${set.createdBy ?? author},
          ${set.createdBy ?? author},
          NOW(),
          NOW()
        )
        RETURNING id
      `;
      for (const slug of set.tags) {
        await sql`
          INSERT INTO machine_settings_set_tags (set_id, tag_id, added_by)
          VALUES (${row.id}, ${tagIdBySlug.get(slug)}, ${set.createdBy ?? author})
        `;
      }
    }

    // Deterministic: wipe each demo machine's sets (tags cascade), then insert.
    // Clearing first also sidesteps the preferred partial unique indexes.
    await sql`DELETE FROM machine_settings_sets WHERE machine_id = ${afm.id}`;
    for (const set of sets) await insertSet(set);

    const sheetMachines = await sql`
      SELECT id, initials FROM machines
      WHERE initials IN ${sql(Object.keys(SHEET_SETS))}
    `;
    for (const machine of sheetMachines) {
      await sql`DELETE FROM machine_settings_sets WHERE machine_id = ${machine.id}`;
      for (const set of SHEET_SETS[machine.initials]) {
        await insertSet({ ...set, machineId: machine.id, createdBy: techId });
      }
    }

    console.log(
      `✅ Machine settings seeded: ${sets.length} sets on Attack from Mars (AFM) + owner requests + access instructions; settings sheet sets on ${String(sheetMachines.length)} more machine(s).`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-machine-settings failed:", err);
  process.exit(1);
});
