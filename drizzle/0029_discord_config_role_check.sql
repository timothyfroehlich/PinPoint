-- Harden public.get_discord_config() by checking auth.role() inside the
-- function body. Supabase auto-grants EXECUTE on public.* functions to
-- `authenticated` at connection time, which can override the REVOKE in 0028
-- and let logged-in users read the decrypted bot token via PostgREST RPC.
-- Defense in depth: the function now aborts unless the calling role is
-- service_role.

CREATE OR REPLACE FUNCTION public.get_discord_config()
RETURNS TABLE (
  enabled boolean,
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
    c.enabled,
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
$$;
--> statement-breakpoint

-- Re-apply grants belt-and-suspenders. The auth.role() check above is the
-- primary guard; the grants remain in place in case Supabase ever strips
-- default public-schema EXECUTE from authenticated.
REVOKE ALL ON FUNCTION public.get_discord_config() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_discord_config() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_discord_config() TO service_role;
