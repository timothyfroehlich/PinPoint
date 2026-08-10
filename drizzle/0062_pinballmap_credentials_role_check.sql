-- Harden public.get_pinballmap_credentials() by checking auth.role() inside the
-- function body (PP-rnup). 0061 shipped it with REVOKE/GRANT only.
--
-- Supabase re-grants EXECUTE on public.* functions to `authenticated` at
-- connection time, which can override a SQL-level REVOKE and let any logged-in
-- user read the decrypted PinballMap operator token via
-- POST /rest/v1/rpc/get_pinballmap_credentials. This is the third RPC in this
-- repo to need the guard: 0029_discord_config_role_check.sql hardened
-- get_discord_config() after 0028 shipped it REVOKE-only, and
-- 0057_superb_switch.sql carried it from the start.
--
-- 0061's header cites 0028 as its model. That is the UNHARDENED version — the
-- shape to mirror is 0029 and 0057, where the in-body role check is the actual
-- gate and the grants are defense in depth.
CREATE OR REPLACE FUNCTION public.get_pinballmap_credentials()
RETURNS TABLE (
  outbound_email text,
  outbound_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied for function get_pinballmap_credentials'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.outbound_email,
    v.decrypted_secret::text AS outbound_token
  FROM pinballmap_state s
  LEFT JOIN vault.decrypted_secrets v ON v.id = s.outbound_token_vault_id
  WHERE s.id = 'singleton';
END;
$$;--> statement-breakpoint

-- Re-apply the grants belt-and-suspenders, same as 0029. The auth.role() check
-- above is the primary guard; these remain in case Supabase ever strips default
-- public-schema EXECUTE from authenticated.
REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_pinballmap_credentials() TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_pinballmap_credentials() IS
  'Returns the PinballMap per-operator write credentials with the token decrypted from Supabase Vault. SECURITY DEFINER — the in-body auth.role() check is the gate; only service_role can call it. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
