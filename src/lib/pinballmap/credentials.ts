import "server-only";
import { createAdminClient } from "~/lib/supabase/admin";
import { assertNotInTransaction } from "~/server/db/transaction-context";
import type { PbmCredentials } from "./types";

/**
 * Shape returned by the `get_pinballmap_credentials()` RPC. Defined in
 * `drizzle/0061_pinballmap_credentials_rpc.sql`, which is hand-written SQL and
 * therefore absent from Supabase's generated types.
 */
interface PinballMapCredentialsRow {
  outbound_email: string | null;
  outbound_token: string | null;
}

/**
 * The per-operator PinballMap write credentials, with the token decrypted from
 * Supabase Vault (PP-o355.30).
 *
 * Distinct from the blanket `PINBALLMAP_API_TOKEN` env var, which is a platform
 * capability issued to PinPoint-the-application and gates ACCESS to the v1 API.
 * These identify WHO is writing, and PinballMap attributes the edit to them.
 * See the `pinballmapState` schema comment for the full split.
 *
 * Returns `null` when no credential is provisioned — including when only one
 * half is set. A half-filled row is a misconfiguration, and sending it would
 * make PBM reject the write, which we would then report as a bad token.
 *
 * SECURITY: server-only. Uses the service-role client and returns secret
 * material; the `server-only` import above is what stops a client component
 * importing it.
 */
export async function getPinballMapWriteCredentials(): Promise<PbmCredentials | null> {
  // CORE-ARCH-011: the Vault decrypt RPC is an external round-trip and must run
  // before a transaction opens, never inside one (the Doodle Bug, PP-2053).
  assertNotInTransaction("getPinballMapWriteCredentials");

  const supabase = createAdminClient();
  const response = (await supabase.rpc("get_pinballmap_credentials")) as {
    data: PinballMapCredentialsRow[] | null;
    error: { message: string } | null;
  };

  if (response.error) {
    throw new Error(
      `Failed to load PinballMap credentials: ${response.error.message}`
    );
  }

  const row = response.data?.[0];
  if (!row?.outbound_email || !row.outbound_token) return null;
  return { email: row.outbound_email, token: row.outbound_token };
}
