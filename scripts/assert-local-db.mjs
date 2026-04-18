/**
 * Guard for destructive database scripts.
 *
 * Every reset/truncate/drop script must call this before touching the DB so we
 * can never accidentally run against a cloud database by pointing
 * POSTGRES_URL at the wrong value. Allowed hosts are loopback only.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * Parse the URL and exit the process if the host is not a local loopback.
 * Accepts the same env vars the reset scripts already read.
 * @param {string} databaseUrl
 */
export function assertLocalDatabase(databaseUrl) {
  let host;
  try {
    host = new URL(databaseUrl).hostname;
  } catch (error) {
    console.error("❌ POSTGRES_URL is not a valid URL:", error.message);
    process.exit(2);
  }

  // URL hostname strips brackets from [::1], so compare against bare form.
  if (!LOCAL_HOSTS.has(host)) {
    console.error(
      `❌ Refusing to run destructive DB script against non-local host: "${host}"`
    );
    console.error(
      "   This script is only safe against a local Supabase instance (localhost/127.0.0.1)."
    );
    console.error(
      "   If you really intended this, change POSTGRES_URL in your shell env."
    );
    process.exit(2);
  }
}
