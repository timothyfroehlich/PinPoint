#!/usr/bin/env node
/**
 * Hand-Applied Tags Demo Seed — LOCAL ONLY
 *
 * Creates hand-applied tag types, tags, and memberships (spec
 * collections-and-tags §11) so the tag browse, tag type pages, tag pages, and
 * a machine's Tags card have real content in local dev and design review: an
 * open type, two exclusive types, tags with no type, and tags with no
 * machines.
 *
 * Ordering: runs after seed-users (needs machines and the admin profile).
 * Deterministic — deletes its own tag types and tags by slug (cascades clear
 * their memberships) before re-inserting, so re-seeding never duplicates.
 * Machines missing from the seed are skipped.
 *
 * Demo data, and local-only: `assertLocalDatabase` refuses any non-loopback
 * POSTGRES_URL before a client is constructed.
 */

import postgres from "postgres";

import { assertLocalDatabase } from "../scripts/assert-local-db.mjs";

// Pooled POSTGRES_URL like the other seed scripts.
const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL is not defined");
  process.exit(1);
}

assertLocalDatabase(databaseUrl);

/** Tag types, by slug. Tags list machine initials from seed-users. */
const TAG_TYPES = [
  {
    slug: "features",
    name: "Features",
    exclusive: false,
    tags: [
      { slug: "color-dmd", name: "Color DMD", machines: ["GDZ", "SM"] },
      {
        slug: "shaker-motor",
        name: "Shaker motor",
        machines: ["GDZ", "AFM", "TAF", "MM"],
      },
      { slug: "topper", name: "Topper", machines: ["MM", "AFM", "GDZ2"] },
    ],
  },
  {
    slug: "location",
    name: "Location",
    exclusive: true,
    tags: [
      {
        slug: "arcade-wall",
        name: "Arcade wall",
        machines: ["HD", "SC", "HB"],
      },
      { slug: "back-room", name: "Back room", machines: ["BK", "EBD"] },
      {
        slug: "front-room",
        name: "Front room",
        machines: ["TAF", "AFM", "MM", "GDZ", "SM"],
      },
      { slug: "storage", name: "Storage", machines: [] },
    ],
  },
  {
    slug: "tournament",
    name: "Tournament",
    exclusive: true,
    tags: [
      { slug: "casual-only", name: "Casual only", machines: ["HD", "SC"] },
      {
        slug: "tournament-ready",
        name: "Tournament-ready",
        machines: ["AFM", "MM", "TAF", "GDZ"],
      },
    ],
  },
];

/** Tags with no tag type. */
const UNTYPED_TAGS = [
  { slug: "kid-friendly", name: "Kid-friendly", machines: ["HB", "SM"] },
  { slug: "new-arrival", name: "New arrival", machines: ["GDZ3"] },
  { slug: "needs-rubbers", name: "Needs rubbers", machines: [] },
];

async function run() {
  const sql = postgres(databaseUrl);
  try {
    const [admin] = await sql`
      SELECT id FROM user_profiles WHERE email = 'admin@test.com' LIMIT 1
    `;
    if (!admin) {
      console.error("❌ admin@test.com not found — run seed-users first");
      process.exitCode = 1;
      return;
    }

    const machineRows = await sql`SELECT id, initials FROM machines`;
    const machineIds = new Map(
      machineRows.map((row) => [row.initials, row.id])
    );

    const allTagSlugs = [
      ...TAG_TYPES.flatMap((type) => type.tags.map((tag) => tag.slug)),
      ...UNTYPED_TAGS.map((tag) => tag.slug),
    ];

    await sql.begin(async (tx) => {
      // Deterministic: remove prior copies (cascades clear machine_tags).
      await tx`DELETE FROM tags WHERE slug IN ${tx(allTagSlugs)}`;
      await tx`
        DELETE FROM tag_types WHERE slug IN ${tx(TAG_TYPES.map((type) => type.slug))}
      `;

      async function insertTag(tag, type) {
        const [row] = await tx`
          INSERT INTO tags (tag_type_id, type_exclusive, slug, name)
          VALUES (${type?.id ?? null}, ${type?.exclusive ?? false}, ${tag.slug}, ${tag.name})
          RETURNING id
        `;
        for (const initials of tag.machines) {
          const machineId = machineIds.get(initials);
          if (!machineId) continue;
          await tx`
            INSERT INTO machine_tags (machine_id, tag_id, tag_type_id, type_exclusive, added_by)
            VALUES (${machineId}, ${row.id}, ${type?.id ?? null}, ${type?.exclusive ?? false}, ${admin.id})
          `;
        }
      }

      for (const type of TAG_TYPES) {
        const [row] = await tx`
          INSERT INTO tag_types (slug, name, exclusive)
          VALUES (${type.slug}, ${type.name}, ${type.exclusive})
          RETURNING id
        `;
        for (const tag of type.tags) {
          await insertTag(tag, { id: row.id, exclusive: type.exclusive });
        }
      }
      for (const tag of UNTYPED_TAGS) {
        await insertTag(tag, null);
      }
    });

    console.log(
      `✅ Tags seeded: ${String(TAG_TYPES.length)} tag types, ${String(allTagSlugs.length)} hand-applied tags.`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-tags failed:", err);
  process.exit(1);
});
