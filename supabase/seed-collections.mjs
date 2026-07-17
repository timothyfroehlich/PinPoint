#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Collections Demo Seed — LOCAL ONLY
 *
 * Creates one admin-owned demo collection ("APC Tournament Bank") so the
 * /c/collection view and its owner edit modal always have real content to show
 * in local dev / design review without hand-creating a collection. Owner is
 * admin@test.com.
 *
 * Ordering: runs after seed-users (needs the admin user_profiles row) and after
 * seed.sql (needs machines). Deterministic — wipes any prior admin collection
 * of the same name (cascade clears its machine list) before re-inserting, so
 * re-seeding never duplicates.
 *
 * Demo data — DO NOT point at prod. Same no-host-guard model as the other seed
 * scripts (see seed-machine-settings.mjs): it targets whatever POSTGRES_URL is
 * set, which for db:reset / the preview pipeline is an ephemeral local/branch DB.
 */

import postgres from "postgres";

// Pooled POSTGRES_URL (:6543, IPv4) like the other seed scripts — NOT the
// :5432 non-pooling URL, which is IPv6 and unreachable from CI runners.
const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error("❌ POSTGRES_URL is not defined");
  process.exit(1);
}

const COLLECTION_NAME = "APC Tournament Bank";
// Fixed demo view-token (local only) so the shared-link flow is reachable in
// dev without clicking through the Share dialog: /c/<this>. Real tokens are
// random base64url (`generateViewToken`); this is a fixed value shaped like one
// so the seeded link looks and behaves like production, just deterministically.
const DEMO_VIEW_TOKEN = "kQ7p2Rf9xVnT4mLbYcWdZ3hJ8sA6uD1e";
// A themed tournament lineup. Any name not present in the seed is skipped, so
// this stays resilient to seed data changes.
const MACHINE_NAMES = [
  "Godzilla",
  "Spider-Man",
  "Medieval Madness",
  "Attack from Mars",
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

    // Deterministic: remove any prior copy (cascade clears collection_machines).
    await sql`
      DELETE FROM collections
      WHERE owner_id = ${admin.id} AND name = ${COLLECTION_NAME}
    `;

    const [collection] = await sql`
      INSERT INTO collections (name, owner_id, view_token)
      VALUES (${COLLECTION_NAME}, ${admin.id}, ${DEMO_VIEW_TOKEN})
      RETURNING id
    `;

    const machineRows = await sql`
      SELECT id FROM machines WHERE name IN ${sql(MACHINE_NAMES)}
    `;

    for (const machine of machineRows) {
      await sql`
        INSERT INTO collection_machines (collection_id, machine_id, added_by)
        VALUES (${collection.id}, ${machine.id}, ${admin.id})
      `;
    }

    console.log(
      `✅ Collections seeded: "${COLLECTION_NAME}" (admin) with ${String(machineRows.length)} machine(s). Shared view: /c/${DEMO_VIEW_TOKEN}`
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("❌ seed-collections failed:", err);
  process.exit(1);
});
