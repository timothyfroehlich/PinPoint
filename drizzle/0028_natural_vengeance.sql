CREATE TABLE "discord_integration_config" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"guild_id" text,
	"invite_link" text,
	"bot_token_vault_id" uuid,
	"bot_health_status" text DEFAULT 'unknown' NOT NULL,
	"last_bot_check_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "discord_integration_config_singleton" CHECK (id = 'singleton'),
	CONSTRAINT "discord_integration_config_health_check" CHECK (bot_health_status IN ('unknown', 'healthy', 'degraded'))
);
--> statement-breakpoint

-- Seed the singleton row so the app always has something to read
INSERT INTO "discord_integration_config" (id) VALUES ('singleton')
  ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- Enable Row Level Security
ALTER TABLE "discord_integration_config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Admin-only SELECT
DROP POLICY IF EXISTS "Discord config viewable by admins" ON "discord_integration_config";--> statement-breakpoint
CREATE POLICY "Discord config viewable by admins"
ON "discord_integration_config" FOR SELECT
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
--> statement-breakpoint

-- Admin-only UPDATE (the singleton row is pre-seeded, so INSERT is never needed from app code)
DROP POLICY IF EXISTS "Discord config updatable by admins" ON "discord_integration_config";--> statement-breakpoint
CREATE POLICY "Discord config updatable by admins"
ON "discord_integration_config" FOR UPDATE
TO authenticated
USING (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  COALESCE(NULLIF(current_setting('request.user_role', true), ''), auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);
--> statement-breakpoint

-- SECURITY DEFINER RPC that returns the config row joined with the decrypted bot token.
-- Callable only by service_role; app code reaches it via createAdminClient().
-- Returns NULL for bot_token if no vault secret is linked yet.
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

REVOKE ALL ON FUNCTION public.get_discord_config() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_discord_config() FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_discord_config() TO service_role;--> statement-breakpoint

COMMENT ON FUNCTION public.get_discord_config() IS
  'Returns Discord integration config with decrypted bot token from Supabase Vault. SECURITY DEFINER — only service_role can EXECUTE. Do NOT expose via PostgREST; call via createAdminClient() in server code only.';
