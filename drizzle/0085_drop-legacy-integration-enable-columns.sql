-- Contract phase for 0069/0070 (PP-o355.51.4.1): the serving runtime no longer
-- reads or writes either integration enable flag, reads get_discord_config()
-- without its enabled field, and always supplies the abandonment location.
--
-- A RETURNS TABLE shape cannot change through CREATE OR REPLACE, so the RPC is
-- dropped and recreated. The migrator applies this file in one transaction, so
-- no caller observes the function missing. The body keeps the in-function
-- service_role check from 0029; the grants and comment are re-applied because
-- DROP FUNCTION discards them.
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
GRANT EXECUTE ON FUNCTION public.get_discord_config() TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_discord_config() IS
  'Returns Discord integration config with decrypted bot token from Supabase Vault. SECURITY DEFINER — only service_role can EXECUTE. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';--> statement-breakpoint

ALTER TABLE "pinballmap_abandoned_listings" ALTER COLUMN "location_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "discord_integration_config" DROP COLUMN "enabled";--> statement-breakpoint
ALTER TABLE "pinballmap_state" DROP COLUMN "enabled";
