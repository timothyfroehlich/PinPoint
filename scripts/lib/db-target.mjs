/**
 * "Which database is this URL pointing at?" — the single home for that question.
 *
 * Two DIFFERENT questions live here; they are not interchangeable and the
 * distinction is load-bearing:
 *
 *   isCloudDatabaseUrl()  — "is this ANY managed cloud Postgres?" A coarse host
 *     match. It is true for PinPoint production AND for every ephemeral Supabase
 *     preview branch, because they share the `*.pooler.supabase.com` host shape.
 *     Use it where the cost of a false positive is a one-line env opt-in typed
 *     by a human (drizzle-kit, mark-migration-applied) — never for something a
 *     CI pipeline runs unattended, or you just teach CI to set the escape hatch.
 *
 *   isPinPointProductionTarget() — "is this THE production project?" Matches the
 *     one and only prod project ref, which appears in every spelling of a
 *     connection to it: the Supavisor username (`postgres.<ref>`), the direct
 *     host (`db.<ref>.supabase.co`), and the Supabase API URL
 *     (`https://<ref>.supabase.co`). Preview branches have their own refs, so
 *     this is false for them — which is what makes it safe to enforce with NO
 *     escape hatch on the remote-capable seed scripts.
 *
 * The API-URL case is exactly why the coarse regex is not sufficient on its own:
 * `https://<ref>.supabase.co` does not contain the string "supabase.com".
 */

/**
 * PinPoint's production Supabase project ref. There is exactly one project in
 * the org, holding live member data with PITR disabled — the recovery floor is
 * the previous nightly backup. Also hardcoded in scripts/backup-production.sh.
 */
export const PRODUCTION_PROJECT_REF = "udhesuizjsgxfeotqybn";

/**
 * Managed-Postgres host shapes. Extracted verbatim from drizzle.config.ts so
 * there is one copy of this regex rather than a third divergent one.
 */
const CLOUD_HOST_PATTERN = /supabase\.com|neon\.tech|rds\.amazonaws\.com/;

/**
 * Is this connection string pointed at a managed cloud database (as opposed to
 * a local Supabase stack)? True for preview branches too — see the module note.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isCloudDatabaseUrl(url) {
  return CLOUD_HOST_PATTERN.test(url);
}

/**
 * Is this value — a Postgres connection string OR a Supabase API URL — pointed
 * at PinPoint production?
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isPinPointProductionTarget(value) {
  return value.includes(PRODUCTION_PROJECT_REF);
}

/**
 * A safe-to-print description of a connection target: host, port, and database
 * name, with any credentials dropped. Falls back to a credential-redacted copy
 * of the raw string when the value does not parse as a URL.
 *
 * @param {string} value
 * @returns {string}
 */
export function describeTarget(value) {
  try {
    const parsed = new URL(value);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.hostname}${port}${parsed.pathname}`;
  } catch {
    return value.replace(/:\/\/[^@]+@/, "://***@");
  }
}

/**
 * Does this `FORCE_PRODUCTION`-style env value mean "yes, I meant it"?
 *
 * The three prod opt-ins (`DRIZZLE_FORCE_PRODUCTION`,
 * `MARK_MIGRATION_FORCE_PRODUCTION`, `SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION`)
 * each read their variable for truthiness, which is backwards for a guard: JS
 * truthiness makes `=0` and `=false` — the two spellings an operator reaches for
 * to TURN A FLAG OFF — enable the bypass. On the PinballMap seed that means
 * `SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION=0` writes an operator token into
 * prod's Vault (PP-rnup).
 *
 * Only the documented `=1`, and `=true` as its obvious synonym, count. Anything
 * else — `0`, `false`, `yes`, a typo, an empty string — reads as disabled, which
 * is the fail-safe direction for a guard: the worst outcome is a refusal whose
 * message names the exact form to type.
 *
 * @param {string | undefined} value the raw env var value
 * @returns {boolean}
 */
export function isForceProductionEnabled(value) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

/**
 * Refuse to continue when `value` targets PinPoint production.
 *
 * There is deliberately NO escape hatch: every caller is a seed script whose
 * whole job is writing demo content (fake users with published passwords, demo
 * collections, a dev Discord bot token). None of that has any business in a
 * database holding real member data, so "I meant it" is never a valid answer.
 *
 * Exits with status 2, matching assert-local-db.mjs.
 *
 * @param {string | undefined} value the connection string or API URL to check
 * @param {string} envVarName the env var it came from, for the message
 * @returns {void}
 */
export function assertNotPinPointProduction(value, envVarName) {
  if (value === undefined || !isPinPointProductionTarget(value)) return;

  console.error(
    `❌ Refusing to run a seed script against PinPoint PRODUCTION.\n` +
      `   ${envVarName} resolves to project ${PRODUCTION_PROJECT_REF} (${describeTarget(value)}).\n` +
      `   Seed scripts write demo data — fake users with published passwords, demo\n` +
      `   collections, dev tokens — into whatever they are pointed at. Production\n` +
      `   holds real member data and has PITR disabled, so the recovery floor is\n` +
      `   last night's backup.\n` +
      `   There is no override. Point ${envVarName} at your local stack (or a\n` +
      `   preview branch) and re-run.`
  );
  process.exit(2);
}
