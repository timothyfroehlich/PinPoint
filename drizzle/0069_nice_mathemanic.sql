-- A disabled tracked location becomes explicit non-configuration. Retained
-- snapshots, health, credentials, matches, intents and abandonment records stay
-- intact but are dormant until a location is configured again.
UPDATE "pinballmap_state" SET "location_id" = NULL WHERE "enabled" = false;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ALTER COLUMN "location_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ALTER COLUMN "location_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" DROP COLUMN "enabled";--> statement-breakpoint

-- A legacy disabled Discord row must not become active merely because the flag
-- disappeared. Unlink and remove only its exact Vault secret, then clear health.
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
WHERE enabled = false;--> statement-breakpoint
ALTER TABLE "discord_integration_config" DROP COLUMN "enabled";--> statement-breakpoint

-- PostgreSQL does not allow CREATE OR REPLACE to change a function's return
-- row type, so drop the previous function before recreating it without enabled.
DROP FUNCTION public.get_discord_config();--> statement-breakpoint
CREATE FUNCTION public.get_discord_config()
RETURNS TABLE (
  guild_id text,
  invite_link text,
  bot_token text,
  bot_health_status text,
  last_bot_check_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied for function get_discord_config'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.guild_id,
    c.invite_link,
    v.decrypted_secret::text AS bot_token,
    c.bot_health_status,
    c.last_bot_check_at,
    c.updated_at
  FROM discord_integration_config c
  LEFT JOIN vault.decrypted_secrets v ON v.id = c.bot_token_vault_id
  WHERE c.id = 'singleton';
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_discord_config() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_discord_config() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_discord_config() TO service_role;
