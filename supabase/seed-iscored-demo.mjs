#!/usr/bin/env node
/** Link local AFM to the opt-in screenshot fixture, without resetting the DB. */

import postgres from "postgres";
import { assertLocalDatabase } from "../scripts/assert-local-db.mjs";

if (process.env.ISCORED_DEMO_AFMSCORES !== "1") {
  console.log("ℹ️  AFM iScored demo disabled; skipping.");
  process.exit(0);
}

const databaseUrl = process.env.POSTGRES_URL;
if (!databaseUrl) {
  console.error("❌ POSTGRES_URL is not defined");
  process.exit(1);
}

assertLocalDatabase(databaseUrl);

const sql = postgres(databaseUrl, { prepare: false });

try {
  const rows = await sql`
    UPDATE machines
    SET iscored_game_id = 'local-afm-demo', updated_at = NOW()
    WHERE initials = 'AFM'
      AND (iscored_game_id IS NULL OR iscored_game_id = 'local-afm-demo')
    RETURNING initials
  `;

  if (rows.length === 0) {
    console.log(
      "ℹ️  AFM is absent or already linked to a real iScored game; skipping."
    );
  } else {
    console.log("✅ AFM linked to local-only iScored screenshot scores.");
  }
} finally {
  await sql.end();
}
