/**
 * Guard for destructive database scripts.
 *
 * Every reset/truncate/drop script must call this before touching the DB so we
 * can never accidentally run against a cloud database by pointing
 * POSTGRES_URL at the wrong value. Allowed hosts are loopback only.
 */

import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const BOOTSTRAP_SEEDS = new Set([
  "seed-collections.mjs",
  "seed-machine-settings.mjs",
  "seed-iscored-demo.mjs",
  "seed-timeline-demo.mjs",
]);

/**
 * Parse the URL and exit the process if the host is not a local loopback.
 * Accepts the same env vars the reset scripts already read.
 * @param {string} databaseUrl
 * @param {boolean} allowRemoteBootstrap Only the fresh-db seed path may opt in.
 */
export function assertLocalDatabase(databaseUrl, allowRemoteBootstrap = false) {
  const remoteBootstrap =
    process.env.PINPOINT_REMOTE_SUPABASE_BOOTSTRAP === "1" &&
    (allowRemoteBootstrap ||
      (process.env.PINPOINT_REMOTE_SUPABASE_SEED_CHILD === "1" &&
        BOOTSTRAP_SEEDS.has(basename(process.argv[1] ?? ""))));
  if (process.env.PINPOINT_SUPABASE_BACKEND === "remote" && !remoteBootstrap) {
    console.error(
      "❌ Destructive database commands are local-only while remote Supabase is selected."
    );
    console.error(
      "   Use PINPOINT_SUPABASE_BACKEND=local with a deliberate local stack."
    );
    process.exit(2);
  }

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
  if (!remoteBootstrap) {
    try {
      execFileSync("python3", ["scripts/assert-local-stack.py"], {
        env: { ...process.env, PINPOINT_LOCAL_DB_GUARD_URL: databaseUrl },
        stdio: "pipe",
        timeout: 25000,
      });
    } catch (error) {
      console.error(
        "❌ Database is not proved to be this worktree's local Supabase stack."
      );
      if (error.stderr) console.error(error.stderr.toString().trim());
      process.exit(2);
    }
  }
}
