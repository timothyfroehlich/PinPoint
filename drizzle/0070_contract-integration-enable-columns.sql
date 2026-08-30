-- Contract phase for 0069: the configuration-presence runtime has been serving
-- since PR #1967 deployed, so no live caller needs either compatibility column
-- or the old Discord RPC row shape.
--
-- PostgreSQL cannot change a function's OUT-parameter row type with
-- CREATE OR REPLACE. Drop it inside this migration's transaction, remove the
-- columns, then recreate it before commit so callers never observe an
-- intermediate schema.
DROP FUNCTION public.get_discord_config();--> statement-breakpoint

ALTER TABLE "discord_integration_config" DROP COLUMN "enabled";--> statement-breakpoint
ALTER TABLE "pinballmap_state" DROP COLUMN "enabled";--> statement-breakpoint

-- SECURITY: the auth.role() check inside the body is the primary gate.
-- REVOKE/GRANT is defense in depth because Supabase may re-grant EXECUTE on
-- public functions to authenticated at connection time (0029, CORE-SEC-001).
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
  'Returns Discord integration config with the bot token decrypted from Supabase Vault. SECURITY DEFINER — the in-body auth.role() check is the gate; only service_role can call it. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
