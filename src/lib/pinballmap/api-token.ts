import "server-only";

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
 * The token is a **platform capability, not tenant data** — PBM issues it to an
 * approved account against a use-plan, i.e. to PinPoint-the-application. Even
 * under future multi-tenancy every tenant inherits it and none may touch it,
 * which makes it a deploy-time constant rather than runtime state. So it reads
 * from a plain `PINBALLMAP_API_TOKEN` env var, not Supabase Vault (PP-o355.23;
 * the Vault path from PP-uusr / migration 0057 is gone). Deliberately NOT in the
 * `next.config.ts` build registry: without it PBM sync degrades and every other
 * surface still works, so it is optional per CORE-SEC-009 (docs/ENV_VARS.md §4.2).
 *
 * Returns null when unset — the live client then omits the header (fine while
 * PBM's gate is still off; the integration is dormant until the PP-o355.10
 * rollout). Local dev and CI never set it: PBM must never be reached from tests
 * (CORE-TEST-006), and `pinballmap_state.enabled` gates the integration anyway.
 *
 * SECURITY: server-only; exposes secret material. The "server-only" import
 * guards against accidental client imports.
 */
export function getPinballMapApiToken(): string | null {
  const token = process.env["PINBALLMAP_API_TOKEN"]?.trim() ?? "";
  return token.length > 0 ? token : null;
}
