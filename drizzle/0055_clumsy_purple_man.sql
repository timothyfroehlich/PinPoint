ALTER TABLE "pinballmap_state" ADD COLUMN "api_token_vault_id" uuid;--> statement-breakpoint

-- SECURITY DEFINER RPC that returns the decrypted PinballMap API token (the
-- mandatory blanket X-Api-Token gate; PP-uusr / CORE-PBM-001). Callable only by
-- service_role; app code reaches it via createAdminClient(). Returns NULL when no
-- vault secret is linked yet (integration not provisioned). Mirrors the shape of
-- public.get_discord_config() in 0028 — the same Vault-decrypt-via-DEFINER pattern.
CREATE OR REPLACE FUNCTION public.get_pinballmap_api_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  token text;
BEGIN
  SELECT v.decrypted_secret::text
    INTO token
    FROM pinballmap_state s
    LEFT JOIN vault.decrypted_secrets v ON v.id = s.api_token_vault_id
   WHERE s.id = 'singleton';
  RETURN token;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.get_pinballmap_api_token() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_pinballmap_api_token() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_pinballmap_api_token() TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_pinballmap_api_token() IS
  'Returns the decrypted PinballMap blanket API token (X-Api-Token) from Supabase Vault. SECURITY DEFINER — only service_role can EXECUTE. Do NOT expose via PostgREST; call via createAdminClient() in server code only. NULL when unprovisioned.';
