CREATE TABLE "mcp_oauth_clients" (
	"client_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"audience" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_oauth_clients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "mcp_oauth_clients" FROM anon, authenticated, public;
--> statement-breakpoint
GRANT SELECT ON TABLE "mcp_oauth_clients" TO supabase_auth_admin;
--> statement-breakpoint
CREATE POLICY "Supabase Auth reads enabled MCP OAuth clients"
ON "mcp_oauth_clients"
FOR SELECT
TO supabase_auth_admin
USING (true);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.mcp_custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  client_audience text;
BEGIN
  -- Supabase may re-grant EXECUTE on public functions to API roles. The hook
  -- changes unsigned JSON only, but keeping the execution boundary explicit
  -- prevents it from becoming an accidental public RPC.
  IF current_user <> 'supabase_auth_admin' THEN
    RAISE EXCEPTION 'permission denied'
      USING ERRCODE = '42501';
  END IF;

  SELECT client.audience
  INTO client_audience
  FROM public.mcp_oauth_clients AS client
  WHERE client.client_id = event->'claims'->>'client_id'
    AND client.enabled;

  IF client_audience IS NOT NULL THEN
    event := jsonb_set(
      event,
      '{claims,aud}',
      to_jsonb(client_audience)
    );
  END IF;

  RETURN jsonb_build_object('claims', event->'claims');
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.mcp_custom_access_token_hook(jsonb)
TO supabase_auth_admin;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.mcp_custom_access_token_hook(jsonb)
FROM anon, authenticated, public;
