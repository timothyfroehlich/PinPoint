#!/usr/bin/env node
/**
 * Run a query against a database with writes made impossible.
 *
 * Two independent layers, either of which is sufficient on its own:
 *
 *  1. **A read-only transaction.** Every statement runs inside
 *     `BEGIN TRANSACTION READ ONLY`, which Postgres enforces server-side: any
 *     INSERT/UPDATE/DELETE/DDL fails with 25006 no matter what the connecting
 *     role is permitted to do. This works even against the ordinary
 *     POSTGRES_URL, which is why the script is useful before anyone has set up
 *     the role.
 *  2. **A SELECT-only role.** `POSTGRES_URL_READONLY` should point at
 *     `pinpoint_readonly` (see scripts/sql/readonly-role.sql), which holds no
 *     write grants anywhere.
 *
 * The transaction is always rolled back, so even a read that acquires locks
 * leaves nothing behind.
 *
 * This exists because investigating a production bug means reading production,
 * and doing that over a service-role connection makes every read one typo away
 * from a mutation. Removing the capability beats asking for restraint.
 *
 * Usage:
 *   node scripts/query-readonly.mjs "select count(*) from user_profiles"
 *   node scripts/query-readonly.mjs --file query.sql
 *   node scripts/query-readonly.mjs --json "select ..."
 */

import { readFileSync } from "node:fs";

import postgres from "postgres";

import {
  describeTarget,
  isPinPointProductionTarget,
} from "./lib/db-target.mjs";

function parseArgs(argv) {
  const args = { json: false, file: null, sql: null, envFile: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") args.json = true;
    else if (arg === "--file") args.file = argv[++i] ?? null;
    else if (arg === "--env-file") args.envFile = argv[++i] ?? null;
    else if (!arg.startsWith("--")) args.sql = arg;
  }
  return args;
}

/**
 * Read POSTGRES_URL* out of a dotenv file into the environment.
 *
 * Exists so a connection string never has to be pasted onto a command line,
 * where it lands in shell history and in this tool's own logs. Only the two
 * keys this script uses are read; everything else in the file is ignored.
 */
function loadEnvFile(path, { required = true } = {}) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    // A missing default file is not an error — the caller may have exported the
    // variables instead. An explicitly named one that cannot be read is.
    if (!required) return;
    console.error(`❌ Cannot read env file ${path}: ${error.message}`);
    process.exit(1);
  }
  for (const line of contents.split("\n")) {
    const match = /^\s*(POSTGRES_URL(?:_READONLY)?)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) process.env[match[1]] = value;
  }
}

function resolveUrl() {
  const readonly = process.env.POSTGRES_URL_READONLY;
  if (readonly) return { url: readonly, dedicated: true };

  const fallback = process.env.POSTGRES_URL;
  if (!fallback) {
    console.error(
      "❌ Neither POSTGRES_URL_READONLY nor POSTGRES_URL is defined.\n" +
        "   Set up the read-only role: scripts/sql/readonly-role.sql"
    );
    process.exit(1);
  }
  return { url: fallback, dedicated: false };
}

const args = parseArgs(process.argv.slice(2));
// `.env.local` by default, so the documented invocations work in a checkout
// without anyone having to remember `--env-file`; absent, it is skipped rather
// than fatal. Values in the file override exported ones, which fails in the safe
// direction — `.env.local` is the local stack, so the accident it can cause is
// querying local while you meant prod, never the reverse.
loadEnvFile(args.envFile ?? ".env.local", { required: args.envFile !== null });
const sql = args.file ? readFileSync(args.file, "utf8") : args.sql;

if (!sql?.trim()) {
  console.error(
    "❌ No query given.\n" +
      '   node scripts/query-readonly.mjs "select 1"\n' +
      "   node scripts/query-readonly.mjs --file query.sql"
  );
  process.exit(1);
}

const { url, dedicated } = resolveUrl();

// Say plainly which database this is and how it is protected. A read against
// prod is legitimate; a read against prod that the operator THOUGHT was local
// is how bad assumptions get made, so the target is never implicit.
const target = isPinPointProductionTarget(url)
  ? "PRODUCTION"
  : "non-production";
console.error(`→ ${target}: ${describeTarget(url)}`);
console.error(
  dedicated
    ? "→ read-only role + read-only transaction"
    : "→ read-only transaction only (POSTGRES_URL_READONLY not set — the " +
        "connecting role CAN write; the transaction is what is stopping it)"
);

// `prepare: false` — the transaction pooler on :6543 does not support prepared
// statements (AGENTS.md §7; PP-d8l8 traced silent prod commit loss to this).
// `max: 1` so the BEGIN and the query provably share one connection.
const client = postgres(url, { prepare: false, max: 1 });

let exitCode = 0;
try {
  // `.begin()` would COMMIT on success. This has to roll back unconditionally,
  // so the transaction is driven by hand on a reserved connection.
  const connection = await client.reserve();
  try {
    await connection.unsafe("BEGIN TRANSACTION READ ONLY");
    const rows = await connection.unsafe(sql);
    // Roll back before printing: if rendering throws, the transaction is
    // already closed rather than left open on the pooler.
    await connection.unsafe("ROLLBACK");

    if (args.json) {
      console.log(JSON.stringify(rows, null, 2));
    } else if (rows.length === 0) {
      console.log("(0 rows)");
    } else {
      console.table(rows);
      console.log(`(${rows.length} row${rows.length === 1 ? "" : "s"})`);
    }
  } catch (error) {
    await connection.unsafe("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
} catch (error) {
  // 25006 is "cannot execute X in a read-only transaction" — the guard doing
  // its job, so name it rather than letting it read as a broken script.
  if (error?.code === "25006") {
    console.error(
      "❌ Refused: that statement writes, and this tool only reads.\n" +
        "   Blocked by the server, not by this script."
    );
  } else {
    console.error(`❌ ${error?.message ?? String(error)}`);
  }
  exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}

process.exit(exitCode);
