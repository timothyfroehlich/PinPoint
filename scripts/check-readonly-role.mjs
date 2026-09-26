#!/usr/bin/env node
/**
 * Weekly chores check: does `pinpoint_readonly` still have the shape
 * scripts/sql/readonly-role.sql intends, on PinPoint-Prod?
 *
 * Background (PP-avnq): the role auto-inherits SELECT on every future public
 * table (`ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES`), by design, so
 * it doesn't go stale mid-investigation. That means a migration adding a
 * token/secret/hash column to `public` silently re-exposes it to the role that
 * backs `POSTGRES_URL_READONLY` — a connection string handed to agents.
 * scripts/sql/verify-readonly-role.sql is the drift detector for exactly that,
 * but nothing ever ran it on a schedule. This script is that schedule.
 *
 * This shells out to `psql` rather than reimplementing the checks in JS: the
 * SQL file is the source of truth (asserted against by
 * src/test/unit/scripts/query-readonly.test.ts), and running it as-is means a
 * future edit to that file is exactly what gets exercised here, with no
 * second copy of the logic to drift.
 *
 * Runs the verify script AS `pinpoint_readonly` itself (over
 * POSTGRES_URL_READONLY), not the admin role the setup script uses — every
 * check in verify-readonly-role.sql only reads catalog views
 * (has_table_privilege, pg_roles, information_schema.columns, ...), which any
 * connected role can query about any other role, so this needs no elevated
 * connection. That also means this script is only ever as capable as the
 * read-only role: it cannot write, on prod or anywhere else.
 *
 * Usage: pnpm run chores:readonly-role
 *   (reads POSTGRES_URL_READONLY from the environment or .env.local, same as
 *   scripts/query-readonly.mjs; get that value from a password manager or by
 *   re-running scripts/sql/readonly-role.sql — see docs/ENV_VARS.md)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { isPinPointProductionTarget } from "./lib/db-target.mjs";

const VERIFY_SQL = new URL("./sql/verify-readonly-role.sql", import.meta.url)
  .pathname;

const CLI_TIMEOUT_MS = 30_000;

/**
 * `.env.local` fallback, matching query-readonly.mjs's own default: an
 * already-exported var wins, so an operator's `export POSTGRES_URL_READONLY=`
 * is never silently swapped out for a worktree's local value.
 */
function loadEnvLocal() {
  if (process.env.POSTGRES_URL_READONLY) return;
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^\s*POSTGRES_URL_READONLY\s*=\s*(.*)$/.exec(line);
    if (match) {
      process.env.POSTGRES_URL_READONLY = match[1]
        .trim()
        .replace(/^["']|["']$/g, "");
      return;
    }
  }
}

function main() {
  loadEnvLocal();

  const url = process.env.POSTGRES_URL_READONLY;
  if (!url) {
    console.error(
      "FAIL — POSTGRES_URL_READONLY is not set.\n" +
        "   This check verifies the pinpoint_readonly role against PinPoint-Prod.\n" +
        "   Set POSTGRES_URL_READONLY to prod's pinpoint_readonly connection string\n" +
        "   (see docs/ENV_VARS.md; role setup: scripts/sql/readonly-role.sql)."
    );
    process.exit(1);
  }

  if (!isPinPointProductionTarget(url)) {
    console.error(
      "FAIL — POSTGRES_URL_READONLY does not look like PinPoint-Prod.\n" +
        "   This chores check exists to catch drift on the connection string that\n" +
        "   gets handed to agents, which is prod's. Point it at prod, or run\n" +
        `   \`psql "$POSTGRES_URL_READONLY" -f ${VERIFY_SQL}\` directly for a non-prod role.`
    );
    process.exit(1);
  }

  console.log("Checking pinpoint_readonly on PinPoint-Prod...\n");

  try {
    const output = execFileSync(
      "psql",
      [url, "-f", VERIFY_SQL, "--set", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        timeout: CLI_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    console.log(output);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(
        "FAIL — the `psql` client is not on PATH. Install it, then re-run."
      );
      process.exit(1);
    }
    const stdout = error.stdout ?? "";
    const stderr = error.stderr ?? "";
    console.log(stdout);
    console.error(stderr);

    // The SQL file's own failure mode: `RAISE EXCEPTION 'pinpoint_readonly: %
    // of % checks failed ...'`, which psql surfaces as an ERROR line. Only
    // THAT is real drift. Anything else here — a bad/expired password, a
    // network blip, or the CLI_TIMEOUT_MS above tripping on a slow prod
    // connection — is a failure to complete the check, not a finding, and
    // must not be reported as one: it would send the weekly-chores operator
    // to file a security bead and run a REVOKE against prod over a transient
    // connectivity issue.
    const isRealDrift = /checks failed/.test(stdout + stderr);

    if (isRealDrift) {
      console.error(
        "\nFAIL — pinpoint_readonly has drifted from what readonly-role.sql intends.\n" +
          "File a P1/P2 bead (severity per what leaked — a credential-shaped column is\n" +
          "P1) and revoke the specific grant, e.g.:\n" +
          '  psql "$POSTGRES_URL_ADMIN" -c \\\n' +
          '    "REVOKE SELECT (<leaked_column>) ON public.<table> FROM pinpoint_readonly;"\n' +
          "(the pattern scripts/sql/readonly-role.sql already uses for\n" +
          "collections.view_token), then re-run this check."
      );
    } else {
      console.error(
        "\nFAIL — could not complete the verification (see the psql error above).\n" +
          "This is NOT a drift finding — investigate the connection/psql failure\n" +
          "(expired credential, network issue, timeout) and re-run, rather than\n" +
          "filing a security bead or revoking anything on the strength of this alone."
      );
    }
    process.exit(1);
  }

  console.log(
    "PASS — pinpoint_readonly's privileges still match scripts/sql/readonly-role.sql."
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
