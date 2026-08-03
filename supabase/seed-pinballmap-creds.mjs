#!/usr/bin/env node
/**
 * Seed the PinballMap per-operator write credentials from environment.
 *
 * One-time provisioning step (PP-o355.30). If PINBALLMAP_OUTBOUND_EMAIL and
 * PINBALLMAP_OUTBOUND_TOKEN are both set AND the pinballmap_state singleton has
 * no outbound_token_vault_id, this creates a Vault secret holding the token and
 * links it on the row alongside the plain email.
 *
 * After this runs once, the env vars are never consulted again — the DB row and
 * the Vault secret are the source of truth, read at runtime through the
 * `get_pinballmap_credentials()` RPC (drizzle/0061).
 *
 * These credentials identify WHO is writing to PinballMap and are distinct from
 * `PINBALLMAP_API_TOKEN`, the blanket platform token that gates API access.
 *
 * Usage (local):
 *   PINBALLMAP_OUTBOUND_EMAIL=... PINBALLMAP_OUTBOUND_TOKEN=... \
 *     node --env-file=.env.local supabase/seed-pinballmap-creds.mjs
 *
 * Usage (production — this is the documented provisioning path, so the script
 * stays prod-capable behind an explicit opt-in rather than a hard refusal):
 *   SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION=1 POSTGRES_URL=<prod_url> \
 *     PINBALLMAP_OUTBOUND_EMAIL=... PINBALLMAP_OUTBOUND_TOKEN=... \
 *     node supabase/seed-pinballmap-creds.mjs
 *
 * Deliberately NOT part of the `db:reset` chain. The Discord seed is, which is
 * why it refuses production outright — an automatic step must never be able to
 * push a dev token into prod's Vault. This one only ever runs when a human types
 * it, and provisioning prod is its whole purpose.
 */

import {
  isPinPointProductionTarget,
  describeTarget,
} from "../scripts/lib/db-target.mjs";
import { createScriptClient } from "../scripts/lib/pg-client.mjs";

const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL");
  process.exit(1);
}

const forceProduction = Boolean(
  process.env["SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION"]
);

if (isPinPointProductionTarget(POSTGRES_URL) && !forceProduction) {
  console.error(
    `❌ Refusing to write PinballMap credentials to production without an explicit opt-in.\n` +
      `   Target: ${describeTarget(POSTGRES_URL)}\n\n` +
      `   Writing a DEV operator token into prod's Vault would make PinPoint\n` +
      `   attribute real PinballMap edits to the wrong account.\n\n` +
      `   Provisioning prod IS this script's job. To proceed intentionally:\n` +
      `     SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION=1 POSTGRES_URL=<url> \\\n` +
      `       PINBALLMAP_OUTBOUND_EMAIL=... PINBALLMAP_OUTBOUND_TOKEN=... \\\n` +
      `       node supabase/seed-pinballmap-creds.mjs`
  );
  process.exit(1);
}

const envEmail = process.env.PINBALLMAP_OUTBOUND_EMAIL?.trim();
const envToken = process.env.PINBALLMAP_OUTBOUND_TOKEN?.trim();

if (!envEmail || !envToken) {
  console.log(
    "🔵 PINBALLMAP_OUTBOUND_EMAIL / PINBALLMAP_OUTBOUND_TOKEN not both set — " +
      "skipping PinballMap credential seed (outbound list/unlist stays unprovisioned)."
  );
  process.exit(0);
}

const sql = createScriptClient(POSTGRES_URL);

// Wrap the flow so an early return still reaches the connection cleanup below;
// `process.exit()` inside the try would bypass `await sql.end()`.
let vaultId;

try {
  console.log("🌱 Seeding PinballMap operator credentials from env...");

  const seeded = await (async () => {
    // Unlike discord_integration_config, no migration seeds this singleton — the
    // app upserts it lazily the first time the integration is configured. So a
    // missing row is normal here, not a sign migrations were skipped, and this
    // script creates it.
    const existing = await sql`
      SELECT outbound_token_vault_id
      FROM pinballmap_state
      WHERE id = 'singleton'
    `;

    if (existing[0]?.outbound_token_vault_id) {
      console.log(
        "✅ PinballMap operator token already provisioned — leaving DB values untouched."
      );
      return false;
    }

    // vault.create_secret returns the secret's UUID on a single row labeled `id`.
    const created = await sql`
      SELECT vault.create_secret(
        ${envToken},
        ${"pinballmap_outbound_token_seeded_" + Date.now()},
        'PinballMap per-operator write token (PP-o355.30)'
      ) AS id
    `;
    vaultId = created[0]?.id;
    if (!vaultId) {
      console.error("❌ vault.create_secret returned no id");
      process.exitCode = 1;
      return false;
    }
    return true;
  })();

  if (seeded) {
    // Upsert the singleton and claim it in one statement. The WHERE on the
    // conflict branch is what makes a concurrent seed lose rather than clobber:
    // RETURNING comes back empty, and we delete the secret we just created
    // instead of orphaning it (same rollback shape as seed-discord.mjs).
    try {
      const updated = await sql`
        INSERT INTO pinballmap_state (id, outbound_email, outbound_token_vault_id)
        VALUES ('singleton', ${envEmail}, ${vaultId}::uuid)
        ON CONFLICT (id) DO UPDATE
          SET outbound_email = ${envEmail},
              outbound_token_vault_id = ${vaultId}::uuid,
              updated_at = now()
          WHERE pinballmap_state.outbound_token_vault_id IS NULL
        RETURNING id
      `;
      if (updated.length === 0) {
        throw new Error(
          "pinballmap_state singleton was claimed by another writer between SELECT and UPSERT"
        );
      }
    } catch (updateError) {
      try {
        // supabase_vault (0.3.1) exposes only create_secret and update_secret —
        // there is no delete_secret — so deletion is a plain row DELETE scoped to
        // the id we just created. Best-effort: a cleanup failure is logged, not
        // re-thrown, because the original error is what matters.
        await sql`DELETE FROM vault.secrets WHERE id = ${vaultId}::uuid`;
      } catch (cleanupError) {
        console.error(
          "⚠️  Failed to clean up orphaned vault secret",
          vaultId,
          cleanupError.message ?? cleanupError
        );
      }
      throw updateError;
    }

    console.log("✅ PinballMap operator credentials seeded:");
    console.log(`   - outbound_email ← env (${envEmail})`);
    // Length only — never log the token itself.
    console.log(
      `   - outbound_token_vault_id set (token length ${envToken.length})`
    );
  }
} catch (err) {
  console.error("❌ PinballMap credential seed failed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
