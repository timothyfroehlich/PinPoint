#!/usr/bin/env node
/**
 * Seed the mandatory PinballMap API token (X-Api-Token) from environment.
 *
 * One-time bootstrap step (mirrors seed-discord.mjs). If PINBALLMAP_API_TOKEN is
 * set in env AND the pinballmap_state singleton row has no api_token_vault_id,
 * this creates a Vault secret with the env token and links it on the singleton.
 *
 * The api_token is PBM's blanket access gate — required on EVERY v1 endpoint once
 * REQUIRE_API_TOKEN flips on (July 30 2026; CORE-PBM-001, PP-uusr). It is distinct
 * from the per-operator write creds (outbound_email / outbound_token_vault_id).
 *
 * After this runs once, env is no longer consulted at runtime; the DB row (via the
 * get_pinballmap_api_token() RPC) is the single source of truth. Re-run is a no-op
 * once linked — rotate by clearing api_token_vault_id (and deleting the old vault
 * secret) first, PBM has no rotation API.
 *
 * Usage: pnpm run db:_seed-pinballmap-token
 */

import { createScriptClient } from "../scripts/lib/pg-client.mjs";

const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL");
  process.exit(1);
}

const envApiToken = process.env.PINBALLMAP_API_TOKEN?.trim();

if (!envApiToken) {
  console.log(
    "🔵 PINBALLMAP_API_TOKEN not set — skipping PBM api_token seed (integration stays unprovisioned)."
  );
  process.exit(0);
}

const sql = createScriptClient(POSTGRES_URL);

// Wrap the flow in an IIFE so early returns don't skip the connection cleanup;
// process.exit() inside try would bypass `await sql.end()` and leak the client.
let vaultId;
let row;

try {
  console.log("🌱 Seeding PinballMap api_token from env...");

  const seeded = await (async () => {
    // Unlike discord_integration_config, the pinballmap_state singleton is NOT
    // pre-seeded by a migration — it's lazily upserted on first sync. So we
    // create the row here if absent (an unlinked existing row is fine too).
    const existing = await sql`
      SELECT api_token_vault_id
      FROM pinballmap_state
      WHERE id = 'singleton'
    `;
    row = existing[0];

    if (row?.api_token_vault_id) {
      console.log(
        "✅ api_token already saved in DB — leaving it untouched (rotate by clearing first)."
      );
      return false;
    }

    // vault.create_secret returns the secret's UUID on a single row labeled `id`.
    const created = await sql`
      SELECT vault.create_secret(
        ${envApiToken},
        ${"pinballmap_api_token_seeded_" + Date.now()},
        'PinballMap blanket API token (X-Api-Token), seeded from PINBALLMAP_API_TOKEN env'
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
    // Upsert the singleton and link the vault id, but only when still unlinked
    // (the ON CONFLICT WHERE guard), so a concurrent writer can't be clobbered.
    // On any failure we delete the freshly-created vault secret so we never
    // orphan encrypted material (mirrors seed-discord.mjs rollback).
    try {
      const updated = await sql`
        INSERT INTO pinballmap_state (id, api_token_vault_id, updated_at)
        VALUES ('singleton', ${vaultId}::uuid, now())
        ON CONFLICT (id) DO UPDATE
          SET api_token_vault_id = excluded.api_token_vault_id,
              updated_at = now()
          WHERE pinballmap_state.api_token_vault_id IS NULL
        RETURNING id
      `;
      if (updated.length === 0) {
        throw new Error(
          "pinballmap_state singleton was claimed by another writer between SELECT and UPSERT"
        );
      }
    } catch (updateError) {
      try {
        await sql`SELECT vault.delete_secret(${vaultId}::uuid)`;
      } catch (cleanupError) {
        console.error(
          "⚠️  Failed to clean up orphaned vault secret",
          vaultId,
          cleanupError.message ?? cleanupError
        );
      }
      throw updateError;
    }

    console.log("✅ PinballMap api_token seeded: api_token_vault_id set");
  }
} catch (err) {
  console.error("❌ PinballMap api_token seed failed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
