#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Seed Discord Integration Config from Environment
 *
 * One-time bootstrap step. If DISCORD_BOT_TOKEN is set in env AND the
 * discord_integration_config singleton row has no bot_token_vault_id, this
 * creates a Vault secret with the env token and links it on the singleton row.
 * Optional env vars (DISCORD_GUILD_ID, DISCORD_INVITE_LINK) are copied into
 * their columns only when those columns are currently NULL — never overwrites
 * admin-saved values.
 *
 * After this runs once, env vars are no longer consulted at runtime; the DB
 * row is the single source of truth.
 *
 * Usage: pnpm run db:_seed-discord
 *
 * Loaded by Node's --env-file flag in the package.json script invocation.
 */

import postgres from "postgres";

const POSTGRES_URL = process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error("❌ Missing POSTGRES_URL");
  process.exit(1);
}

const envBotToken = process.env.DISCORD_BOT_TOKEN?.trim();
const envGuildId = process.env.DISCORD_GUILD_ID?.trim();
const envInviteLink = process.env.DISCORD_INVITE_LINK?.trim();

if (!envBotToken) {
  console.log(
    "🔵 DISCORD_BOT_TOKEN not set — skipping Discord seed (admin can paste a token via the UI)."
  );
  process.exit(0);
}

const sql = postgres(POSTGRES_URL);

// Wrap the whole flow in an IIFE so we can `return` early without skipping
// the connection-cleanup block at the end. `process.exit()` inside the try
// block would bypass `await sql.end()` and leak the postgres connection.
let vaultId;
let row;

try {
  console.log("🌱 Seeding Discord integration from env...");

  const seeded = await (async () => {
    const existing = await sql`
      SELECT bot_token_vault_id, guild_id, invite_link
      FROM discord_integration_config
      WHERE id = 'singleton'
    `;
    row = existing[0];

    if (!row) {
      console.error(
        "❌ discord_integration_config singleton row missing — migrations probably haven't run."
      );
      process.exitCode = 1;
      return false;
    }

    if (row.bot_token_vault_id) {
      console.log(
        "✅ Bot token already saved in DB — leaving DB values untouched."
      );
      return false;
    }

    // Create the vault secret. vault.create_secret returns the secret's UUID
    // on a single row labeled `id`.
    const created = await sql`
      SELECT vault.create_secret(
        ${envBotToken},
        ${"discord_bot_token_seeded_" + Date.now()},
        'Discord bot token (seeded from DISCORD_BOT_TOKEN env)'
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
    // Update the singleton. guild_id and invite_link are only filled if they
    // were null — admin-saved values are never overwritten. RETURNING confirms
    // the row was actually linked, and on any failure we delete the freshly-
    // created vault secret so we don't orphan it (mirrors the rollback in
    // saveDiscordConfig).
    try {
      const updated = await sql`
        UPDATE discord_integration_config
        SET
          bot_token_vault_id = ${vaultId}::uuid,
          guild_id = COALESCE(guild_id, ${envGuildId ?? null}),
          invite_link = COALESCE(invite_link, ${envInviteLink ?? null}),
          updated_at = now()
        WHERE id = 'singleton' AND bot_token_vault_id IS NULL
        RETURNING id
      `;
      if (updated.length === 0) {
        throw new Error(
          "discord_integration_config singleton was claimed by another writer between SELECT and UPDATE"
        );
      }
    } catch (updateError) {
      try {
        // vault.delete_secret is the inverse of vault.create_secret used
        // above (pg_vault extension). Best-effort cleanup so we don't leave
        // an encrypted secret with no DB reference; failure here is logged
        // but not re-thrown — the original UPDATE error is what matters.
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

    console.log("✅ Discord seeded:");
    console.log("   - bot_token_vault_id set");
    if (envGuildId && !row.guild_id) {
      console.log(`   - guild_id ← env (${envGuildId})`);
    }
    if (envInviteLink && !row.invite_link) {
      console.log(`   - invite_link ← env`);
    }
  }
} catch (err) {
  console.error("❌ Discord seed failed:", err.message ?? err);
  process.exitCode = 1;
} finally {
  // Always close the postgres connection, even on early-exit / error paths.
  await sql.end();
}
