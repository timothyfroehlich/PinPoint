-- SECURITY DEFINER RPC returning the PinballMap per-operator write credentials
-- with the token decrypted from Supabase Vault (PP-o355.30).
--
-- Mirrors get_discord_config() in 0028_natural_vengeance.sql: same
-- SECURITY DEFINER + pinned search_path + REVOKE/GRANT shape. Callable only by
-- service_role; app code reaches it via createAdminClient().
--
-- Returns NULL for outbound_token when no Vault secret is linked yet. A row is
-- always returned (the singleton exists), so the accessor distinguishes
-- "not provisioned" from "RPC failed".
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
  RETURN QUERY
  SELECT
    s.outbound_email,
    v.decrypted_secret::text AS outbound_token
  FROM pinballmap_state s
  LEFT JOIN vault.decrypted_secrets v ON v.id = s.outbound_token_vault_id
  WHERE s.id = 'singleton';
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_pinballmap_credentials() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_pinballmap_credentials() TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_pinballmap_credentials() IS
  'Returns the PinballMap per-operator write credentials with the token decrypted from Supabase Vault. SECURITY DEFINER — only service_role can EXECUTE. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
