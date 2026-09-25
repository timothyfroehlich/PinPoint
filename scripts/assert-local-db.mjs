/**
 * Guard for destructive database scripts.
 *
 * Every reset/truncate/drop script must call this before touching the DB so we
 * can never accidentally run against a cloud database by pointing
 * POSTGRES_URL at the wrong value. Allowed hosts are loopback, plus any
 * dev-stack hosts the operator lists in PINPOINT_DEV_DB_HOSTS (a Supabase
 * stack on another machine, see docs/runbooks/remote-supabase.md). A managed
 * cloud host is refused even when listed.
 */

import { isCloudDatabaseUrl } from "./lib/db-target.mjs";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Hosts named in PINPOINT_DEV_DB_HOSTS (comma-separated), lower-cased.
 * @returns {Set<string>}
 */
function devStackHosts() {
  const raw = process.env.PINPOINT_DEV_DB_HOSTS ?? "";
  return new Set(
    raw
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter((host) => host.length > 0)
  );
}

/**
 * Is this host a local dev stack: loopback, or listed in PINPOINT_DEV_DB_HOSTS
 * and not a managed cloud host? Throws on an unparseable URL.
 * @param {string} databaseUrl
 * @returns {boolean}
 */
export function isLocalDatabaseUrl(databaseUrl) {
  // URL hostname strips brackets from [::1], so compare against bare form.
  const host = new URL(databaseUrl).hostname.toLowerCase();
  return (
    LOCAL_HOSTS.has(host) ||
    (devStackHosts().has(host) && !isCloudDatabaseUrl(databaseUrl))
  );
}

/**
 * Parse the URL and exit the process if the host is not a local dev stack.
 * Accepts the same env vars the reset scripts already read.
 * @param {string} databaseUrl
 */
export function assertLocalDatabase(databaseUrl) {
  let host;
  let allowed;
  try {
    host = new URL(databaseUrl).hostname.toLowerCase();
    allowed = isLocalDatabaseUrl(databaseUrl);
  } catch (error) {
    console.error("❌ POSTGRES_URL is not a valid URL:", error.message);
    process.exit(2);
  }

  if (!allowed) {
    console.error(
      `❌ Refusing to run destructive DB script against non-local host: "${host}"`
    );
    console.error(
      "   This script is only safe against a local Supabase instance (localhost/127.0.0.1)"
    );
    console.error("   or a dev-stack host listed in PINPOINT_DEV_DB_HOSTS.");
    console.error(
      "   If you really intended this, change POSTGRES_URL in your shell env."
    );
    process.exit(2);
  }
}
