#!/usr/bin/env node
/**
 * Run a query against a database, biased hard toward reading only.
 *
 * **The real boundary is the role, not this script.** `POSTGRES_URL_READONLY`
 * should point at `pinpoint_readonly` (see scripts/sql/readonly-role.sql), which
 * holds no write grant anywhere. With that role, no query this script sends can
 * write, because the privilege to write does not exist — that is the guarantee.
 *
 * Everything this script adds is accident-prevention on top of that, and is NOT
 * a security boundary against a hostile query string:
 *
 *  - `SET SESSION default_transaction_read_only = on`, then every query inside a
 *    `BEGIN TRANSACTION READ ONLY` that is always rolled back. A single-statement
 *    write fails with 25006 and the session leaves nothing behind.
 *  - BUT a multi-statement query can defeat the transaction: `ROLLBACK; <write>`
 *    ends the block, and the write then runs in autocommit. The session-level
 *    read-only default is only a BEST-EFFORT catch for that, and over the
 *    Supavisor transaction pooler (`:6543`) not even reliable: the pooler can
 *    route the escaped autocommit statement to a different backend than the one
 *    the `SET` ran on. Any query can also `SET … = off` first regardless.
 *
 * So on the FALLBACK path (`POSTGRES_URL`, a role that CAN write), a determined
 * multi-statement query can still write. That path is a convenience for before
 * the role exists, not a safe place to run untrusted SQL. Set up the role — its
 * write-refusal depends on none of the above, because the privilege to write is
 * simply absent.
 *
 * This exists because investigating a production bug means reading production,
 * and doing that over a service-role connection makes every read one typo away
 * from a mutation.
 *
 * Usage:
 *   node scripts/query-readonly.mjs "select count(*) from user_profiles"
 *   node scripts/query-readonly.mjs --file query.sql
 *   node scripts/query-readonly.mjs --json "select ..."
 *   node scripts/query-readonly.mjs --env other.env "select ..."
 *   node scripts/query-readonly.mjs --prod "select ..."   # force production
 *   node scripts/query-readonly.mjs --local "select ..."  # force non-production
 *
 * `POSTGRES_URL_READONLY` is preferred over `POSTGRES_URL`. When that preference
 * would default to PinPoint PRODUCTION but a non-production URL is ALSO
 * configured — a worktree whose `.env.local` carries the prod read-only URL
 * next to its local stack — the tool refuses and makes you choose: `--prod` for
 * production, `--local` for the non-production database. The guard only trips on
 * a production default; defaulting to a non-production database is never ambiguous.
 *
 * Reading auth data: the role cannot select from `auth.users` directly — query
 * `readonly_auth.users` / `readonly_auth.identities` instead. The reason is a
 * Supabase platform constraint, spelled out in scripts/sql/readonly-role.sql.
 *
 * The env-file flag is `--env`, NOT `--env-file`. Node (v20+) implements
 * `--env-file` itself: when the named file EXISTS, Node loads EVERY key in it
 * into the environment — the opposite of the two-key whitelist below — and when
 * it does not exist, Node aborts before this script runs. The flag still reaches
 * argv, so a script flag by that name would be shadowed by Node's own handling.
 * `--env` sidesteps both.
 */

import { readFileSync } from "node:fs";

import { loadEnvFile } from "./lib/env-file.mjs";
import { createScriptClient } from "./lib/pg-client.mjs";
import {
  describeTarget,
  isPinPointProductionTarget,
} from "./lib/db-target.mjs";

class UsageError extends Error {}

/**
 * Parse argv, rejecting anything it does not recognise.
 *
 * A silent-drop parser is a footgun here: a misspelled `--env` would be dropped
 * and its filename reinterpreted as the query, and a stray extra word would
 * overwrite the query with the last positional winning — both silently running
 * against a different database or a different statement than the operator typed.
 * So an unknown `--flag`, a second positional, and a flag that swallows the next
 * flag as its value are all hard errors.
 */
function parseArgs(argv) {
  const args = {
    json: false,
    file: null,
    sql: null,
    envFile: null,
    prod: false,
    local: false,
  };

  const takeValue = (flag, next) => {
    if (next === undefined || next.startsWith("--")) {
      throw new UsageError(`${flag} needs a value`);
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--prod") {
      args.prod = true;
    } else if (arg === "--local") {
      args.local = true;
    } else if (arg === "--file") {
      args.file = takeValue(arg, argv[++i]);
    } else if (arg === "--env") {
      args.envFile = takeValue(arg, argv[++i]);
    } else if (arg.startsWith("--")) {
      throw new UsageError(`unknown flag ${arg}`);
    } else if (args.sql === null) {
      args.sql = arg;
    } else {
      throw new UsageError(
        `unexpected extra argument ${JSON.stringify(arg)} — quote the whole query as one argument`
      );
    }
  }

  // `--file` plus an inline query is the same ambiguity a second positional is:
  // `--file` would win and the positional would be dropped without a word. The
  // parser is loud about which statement runs everywhere else, so be loud here.
  if (args.file !== null && args.sql !== null) {
    throw new UsageError(
      "give a query OR --file, not both — --file would win and the inline query would be silently ignored"
    );
  }

  // `--prod` and `--local` each NAME the database to run against; together they
  // name two, so the choice they exist to make is undefined. Refuse rather than
  // letting one silently win.
  if (args.prod && args.local) {
    throw new UsageError(
      "give --prod OR --local, not both — they name opposite databases"
    );
  }

  return args;
}

/**
 * Read POSTGRES_URL* out of a dotenv file into the environment (see
 * scripts/lib/env-file.mjs for the precedence rule). Only the two keys this
 * script uses are read.
 */
function loadConnectionStrings(path, { required }) {
  try {
    loadEnvFile(path, {
      keys: ["POSTGRES_URL", "POSTGRES_URL_READONLY"],
      required,
    });
  } catch (error) {
    throw new UsageError(error.message);
  }
}

/**
 * Choose which configured database to query, and refuse to SILENTLY pick
 * production when a non-production database is also configured (PP-4yc8).
 *
 * `POSTGRES_URL_READONLY` (the dedicated read-only role) is preferred over
 * `POSTGRES_URL` (a role that can write). That preference is safe when the two
 * agree on environment, but a worktree whose `.env.local` carries a prod
 * read-only URL alongside its local stack makes them DISAGREE: the preference
 * would default to production while the operator is sitting in a local
 * checkout. So when the preferred target is production AND a non-production URL
 * is also configured, require the operator to say which they meant — `--prod`
 * takes production, `--local` takes the non-production URL. A non-production
 * default is never ambiguous (reading a non-production database is harmless), so
 * only a production default is gated.
 *
 * `dedicated` tracks the ROLE of the chosen URL (read-only vs. can-write), not
 * its environment, because that is what the banner has to be honest about.
 */
function resolveUrl({ prod, local }) {
  // Preference order: the dedicated read-only role first, then the can-write
  // fallback. `isPinPointProductionTarget` treats preview branches as
  // non-production, which is correct here — only the one live project is gated.
  const candidates = [];
  const readonly = process.env.POSTGRES_URL_READONLY;
  const fallback = process.env.POSTGRES_URL;
  if (readonly) candidates.push({ url: readonly, dedicated: true });
  if (fallback) candidates.push({ url: fallback, dedicated: false });

  if (candidates.length === 0) {
    throw new UsageError(
      "Neither POSTGRES_URL_READONLY nor POSTGRES_URL is defined.\n" +
        "   Set up the read-only role: scripts/sql/readonly-role.sql"
    );
  }

  const production = candidates.filter((c) =>
    isPinPointProductionTarget(c.url)
  );
  const nonProduction = candidates.filter(
    (c) => !isPinPointProductionTarget(c.url)
  );

  if (prod) {
    if (production.length === 0) {
      throw new UsageError(
        "--prod: no production database is configured.\n" +
          "   Neither POSTGRES_URL_READONLY nor POSTGRES_URL targets PinPoint production."
      );
    }
    return production[0];
  }

  if (local) {
    if (nonProduction.length === 0) {
      throw new UsageError(
        "--local: no non-production database is configured.\n" +
          "   Every configured connection string targets PinPoint production."
      );
    }
    return nonProduction[0];
  }

  const chosen = candidates[0];
  if (isPinPointProductionTarget(chosen.url) && nonProduction.length > 0) {
    throw new UsageError(
      "Refusing to default to PRODUCTION when a non-production database is also configured.\n" +
        `   production:     ${describeTarget(production[0].url)}\n` +
        `   non-production: ${describeTarget(nonProduction[0].url)}\n` +
        "   Pass --prod to query production, or --local to query the non-production database."
    );
  }
  return chosen;
}

/**
 * Read the query text for `--file`, turning a bad path into a friendly error
 * rather than a raw ENOENT stack trace (every other input error here exits 1
 * with a `❌` line, and `--file` should match).
 */
function readQuery(args) {
  if (!args.file) return args.sql;
  try {
    return readFileSync(args.file, "utf8");
  } catch (error) {
    throw new UsageError(
      `Cannot read query file ${args.file}: ${error.message}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // `.env.local` by default, so the documented invocations work in a checkout
  // without anyone having to remember `--env`; absent, it is skipped rather than
  // fatal. An exported variable wins over the file (dotenv precedence, see
  // scripts/lib/env-file.mjs), so an operator who exported a prod URL and happens to run from
  // a worktree gets prod, not the worktree's local stack silently swapped in. The
  // resolved variables then feed resolveUrl, which refuses a production default
  // when a non-production URL is also configured (PP-4yc8).
  loadConnectionStrings(args.envFile ?? ".env.local", {
    required: args.envFile !== null,
  });

  const sql = readQuery(args);
  if (!sql?.trim()) {
    throw new UsageError(
      "No query given.\n" +
        '   node scripts/query-readonly.mjs "select 1"\n' +
        "   node scripts/query-readonly.mjs --file query.sql"
    );
  }

  const { url, dedicated } = resolveUrl(args);

  // Say plainly which database this is and how it is protected. A read against
  // prod is legitimate; a read against prod that the operator THOUGHT was local
  // is how bad assumptions get made, so the target is never implicit.
  const target = isPinPointProductionTarget(url)
    ? "PRODUCTION"
    : "non-production";
  console.error(`→ ${target}: ${describeTarget(url)}`);
  if (dedicated) {
    console.error(
      "→ read-only role: writes have no privilege to run (the real guarantee)"
    );
  } else {
    // The connecting role CAN write either way, but say WHY honestly: a genuinely
    // absent read-only role is a "set it up" nudge, whereas `--local` (or a
    // read-only URL that points at a different environment) left a configured
    // POSTGRES_URL_READONLY deliberately unused — claiming it is "unset" there
    // would be a lie on the one surface this tool exists to be honest about.
    const reason = process.env.POSTGRES_URL_READONLY
      ? "POSTGRES_URL_READONLY is set but was not the chosen target, so this is POSTGRES_URL"
      : "POSTGRES_URL_READONLY unset, so this is POSTGRES_URL";
    console.error(
      `→ NO read-only role (${reason}): the connecting role CAN write. A ` +
        "single-statement write is refused, but a multi-statement query is NOT " +
        "safely contained here — use the read-only role for untrusted SQL."
    );
  }

  // Delegate the pooler-safe client construction (prepare:false applied last, so
  // these options cannot re-enable prepared statements). `max: 1` so BEGIN and
  // the query provably share one connection. `onnotice` to stderr so a NOTICE
  // cannot corrupt `--json` on stdout. The two timeouts bound an accidental
  // runaway query against prod rather than letting it hold a pooler connection
  // and an MVCC snapshot open indefinitely.
  const client = createScriptClient(url, {
    max: 1,
    onnotice: (notice) => console.error(`NOTICE: ${notice.message ?? notice}`),
    connection: {
      statement_timeout: "30s",
      idle_in_transaction_session_timeout: "60s",
    },
  });

  let exitCode = 0;
  try {
    const connection = await client.reserve();
    try {
      // Session-level read-only is a best-effort catch for a `ROLLBACK; …`
      // escape (see the header) on the fallback path — and only best-effort:
      // over the :6543 transaction pooler the escaped autocommit statement may
      // land on a different backend than this SET, and any query can SET it off.
      // The dedicated role does not rely on it; its write-refusal is the grant.
      await connection.unsafe("SET SESSION default_transaction_read_only = on");
      // `.begin()` would COMMIT on success. This has to roll back
      // unconditionally, so the transaction is driven by hand.
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

  // `process.exitCode`, not `process.exit()`: the latter tears the process down
  // before a piped stdout has flushed, silently truncating a large `--json`
  // result with a success code. `client.end()` released the only handle, so the
  // event loop drains and the process exits on its own with this code.
  process.exitCode = exitCode;
}

main().catch((error) => {
  if (error instanceof UsageError) {
    console.error(`❌ ${error.message}`);
  } else {
    console.error(`❌ ${error?.stack ?? error?.message ?? String(error)}`);
  }
  process.exitCode = 1;
});
