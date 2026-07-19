import "server-only";
import { createAdminClient } from "~/lib/supabase/admin";
import { assertNotInTransaction } from "~/server/db/transaction-context";

/**
 * Mandatory PinballMap blanket API token (X-Api-Token) accessor.
 *
 * From the July 30 2026 gate, PBM's `REQUIRE_API_TOKEN` flips on and EVERY v1
 * endpoint — reads included — requires this token (blog 2026-07-16; CORE-PBM-001,
 * PP-uusr). It is a DISTINCT layer from the per-operator write creds
 * (`user_email`/`user_token`): the api_token gates access, the operator creds
 * identify the writer. The live client sends it as the `X-Api-Token` header on
 * every request.
 *
 * The token lives in Supabase Vault, referenced by `pinballmap_state.api_token_
 * vault_id`; the `get_pinballmap_api_token()` SECURITY DEFINER RPC decrypts it and
 * is EXECUTE-able only by `service_role`, so we reach it through the service-role
 * admin client. Returns null when the integration isn't provisioned yet — the
 * live client then omits the header (fine while PBM's gate is still off; the
 * integration is dormant until the PP-o355.10 rollout).
 *
 * SECURITY: server-only; uses the service-role client and exposes secret
 * material. The "server-only" import guards against accidental client imports.
 */
export async function getPinballMapApiToken(): Promise<string | null> {
  // CORE-ARCH-011 tripwire: the Vault decrypt RPC is an external round-trip and
  // must run before opening a transaction, never inside one (the Doodle Bug,
  // PP-2053). PBM fetches already run outside transactions (state.ts/catalog.ts).
  assertNotInTransaction("getPinballMapApiToken");

  const supabase = createAdminClient();
  // The `get_pinballmap_api_token` RPC (0055) returns a scalar `text` and is not
  // present in Supabase's generated types. Cast to the shape the function returns.
  const response = (await supabase.rpc("get_pinballmap_api_token")) as {
    data: string | null;
    error: { message: string } | null;
  };

  if (response.error) {
    throw new Error(
      `Failed to load PinballMap API token: ${response.error.message}`
    );
  }

  const token = response.data;
  return typeof token === "string" && token.length > 0 ? token : null;
}
