import postgres from "postgres";

/**
 * Resolve the database URL for one-shot scripts.
 *
 * Scripts connect over the IPv4 transaction pooler exposed as POSTGRES_URL
 * (`…pooler.supabase.com:6543`). We deliberately do NOT fall back to
 * POSTGRES_URL_NON_POOLING: in prod/preview that resolves to an IPv6-only host
 * unreachable from CI/preview/Vercel runners (the cause of ENETUNREACH seed
 * failures). See AGENTS.md §6.
 *
 * @returns {string}
 */
export function resolveScriptDatabaseUrl() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("❌ POSTGRES_URL is not defined");
    process.exit(1);
  }
  return url;
}

/**
 * Create a porsager client for a one-shot script.
 *
 * `prepare: false` because the transaction pooler (:6543) does not support
 * prepared statements (Supabase docs); one-shot scripts gain nothing from
 * statement caching. Pass `options` to extend (e.g. `{ max: 1 }` for DDL).
 * See AGENTS.md §6.
 *
 * @param {string} [databaseUrl]
 * @param {Record<string, unknown>} [options]
 * @returns {import("postgres").Sql}
 */
export function createScriptClient(
  databaseUrl = resolveScriptDatabaseUrl(),
  options = {},
) {
  return postgres(databaseUrl, { prepare: false, ...options });
}
