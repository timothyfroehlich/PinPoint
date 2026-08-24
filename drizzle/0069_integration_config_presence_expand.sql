-- Expand phase: nullable location_id is authoritative for the new runtime,
-- while enabled remains temporarily for the previous Vercel deployment. The
-- compatibility columns and the old get_discord_config() row shape are removed
-- only by a later contract migration after this deployment is serving.
ALTER TABLE "pinballmap_state" ALTER COLUMN "location_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ALTER COLUMN "location_id" DROP NOT NULL;--> statement-breakpoint

-- A disabled tracked location becomes explicit non-configuration. Retained
-- snapshots, health, credentials, matches, intents and abandonment records stay
-- intact but are dormant until a location is configured again.
UPDATE "pinballmap_state"
SET "location_id" = NULL
WHERE "enabled" = false;--> statement-breakpoint

-- The new Discord runtime ignores enabled, so a legacy disabled row must not
-- become active merely because its required values are present. Unlink and
-- remove only its exact Vault secret, then reset connection health. Keeping the
-- false compatibility flag lets the previous deployment remain safely off.
DELETE FROM vault.secrets
WHERE id IN (
  SELECT bot_token_vault_id
  FROM "discord_integration_config"
  WHERE enabled = false AND bot_token_vault_id IS NOT NULL
);--> statement-breakpoint
UPDATE "discord_integration_config"
SET bot_token_vault_id = NULL,
    bot_health_status = 'unknown',
    last_bot_check_at = NULL
WHERE enabled = false;
