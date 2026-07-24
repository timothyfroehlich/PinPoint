-- PP-o355.23: move PinballMap's blanket api_token out of Supabase Vault and into
-- the PINBALLMAP_API_TOKEN env var, deleting the whole vault path added by 0057.
--
-- The token is a platform capability PBM issues to PinPoint-the-application, not
-- tenant data, so it is a deploy-time constant. This drops the read RPC and the
-- pointer column. `outbound_email` / `outbound_token_vault_id` are UNTOUCHED —
-- those are per-operator identity and correctly stay in Vault.

-- 1. Delete the linked vault secret BEFORE dropping the pointer, or it is orphaned
--    with nothing left referencing it. NULL pointer (the expected state in prod,
--    which was never provisioned) or a missing singleton row selects zero rows and
--    is a no-op; local and preview DBs may have a real secret seeded by the
--    now-deleted db:reset step. Deleted straight from `vault.secrets` (which the
--    migrating `postgres` role has DELETE on) rather than through a
--    `vault.delete_secret()` helper — supabase_vault ships `create_secret` and
--    `update_secret` only, with no delete counterpart (verified against the local
--    stack; see PP-w3d9).
DELETE FROM vault.secrets
 WHERE id IN (
   SELECT api_token_vault_id
     FROM pinballmap_state
    WHERE id = 'singleton'
      AND api_token_vault_id IS NOT NULL
 );--> statement-breakpoint

-- 2. Drop the SECURITY DEFINER read RPC (0057). Nothing calls it: api-token.ts now
--    reads process.env, so this also retires the hand-rolled auth.role() guard that
--    existed only because PostgREST re-exposes public functions.
DROP FUNCTION IF EXISTS public.get_pinballmap_api_token();--> statement-breakpoint

-- 3. Drop the pointer column.
ALTER TABLE "pinballmap_state" DROP COLUMN "api_token_vault_id";
