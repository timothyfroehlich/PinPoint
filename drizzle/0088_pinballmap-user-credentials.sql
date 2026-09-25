CREATE TABLE "pinballmap_user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"pbm_username" text NOT NULL,
	"pbm_email" text NOT NULL,
	"token_vault_id" uuid NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"needs_relink_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pinballmap_user_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pinballmap_user_credentials" ADD CONSTRAINT "pinballmap_user_credentials_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- SECURITY DEFINER RPC returning one member's linked Pinball Map write
-- credentials with the token decrypted from Supabase Vault (pinballmap spec
-- 8.2/8.4, PP-o355.6). Same hardened shape as get_pinballmap_credentials() in
-- 0062: the in-body auth.role() check is the gate, because Supabase re-grants
-- EXECUTE on public functions to `authenticated`; the REVOKE/GRANT lines are
-- defense in depth. App code reaches it via createAdminClient() only.
--
-- Returns no row when the member has not linked an account. token_vault_id is
-- returned so a write rejected as unauthorized marks exactly the credential it
-- used, never a newer one saved by a concurrent relink.
CREATE OR REPLACE FUNCTION public.get_pinballmap_user_credentials(p_user_id uuid)
RETURNS TABLE (
  pbm_email text,
  token text,
  token_vault_id uuid,
  needs_relink boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'permission denied for function get_pinballmap_user_credentials'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    c.pbm_email,
    v.decrypted_secret::text AS token,
    c.token_vault_id,
    c.needs_relink_at IS NOT NULL AS needs_relink
  FROM pinballmap_user_credentials c
  LEFT JOIN vault.decrypted_secrets v ON v.id = c.token_vault_id
  WHERE c.user_id = p_user_id;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.get_pinballmap_user_credentials(uuid) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_pinballmap_user_credentials(uuid) FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_pinballmap_user_credentials(uuid) TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_pinballmap_user_credentials(uuid) IS
  'Returns one member''s linked Pinball Map write credentials with the token decrypted from Supabase Vault. SECURITY DEFINER — the in-body auth.role() check is the gate; only service_role can call it. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
