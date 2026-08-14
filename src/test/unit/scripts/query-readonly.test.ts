// The read-only query tool and the role it pairs with (PP-xdvw).
//
// Two layers, matching db-target-guards.test.ts:
//   1. Real subprocess runs of scripts/query-readonly.mjs — argument handling,
//      env resolution, and what it tells the operator about the target. A tool
//      whose whole value is "you cannot write with this" has to be legible about
//      which database it is pointed at and which layer is protecting it.
//   2. Source assertions on scripts/sql/readonly-role.sql, pinning the one
//      mistake that already shipped once: granting on `auth` directly.
//
// What is deliberately NOT here: whether a write actually gets SQLSTATE 25006.
// That is a property of the server, not of this script, and asserting it needs a
// live database — see scripts/sql/verify-readonly-role.sql, which is run against
// the target database itself.
//
// Every case points at localhost:1 or supplies no URL at all, so nothing here
// opens a connection or waits on a timeout.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const SCRIPT = "scripts/query-readonly.mjs";
const ROLE_SQL = "scripts/sql/readonly-role.sql";
const VERIFY_SQL = "scripts/sql/verify-readonly-role.sql";

const PROD_POOLER_URL =
  "postgres://pinpoint_readonly.udhesuizjsgxfeotqybn:sup3rs3cret@aws-0-us-east-2.pooler.supabase.com:6543/postgres";
const LOCAL_URL = "postgres://postgres:pw@localhost:1/postgres";

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(env: Record<string, string>, argv: string[] = []): RunResult {
  const result = spawnSync("node", [path.join(repoRoot, SCRIPT), ...argv], {
    encoding: "utf8",
    cwd: repoRoot,
    // Clean slate: an ambient POSTGRES_URL must not decide these outcomes.
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// `.env.local` is the default env file and exists in every worktree, so the
// "nothing configured" cases have to opt out of it explicitly or they pick up
// the local stack's URL and assert nothing.
const NO_ENV_FILE = ["--env", "/dev/null"];

describe("query-readonly.mjs — refuses to run without a query", () => {
  it("exits 1 and shows both invocations", () => {
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("No query given");
    expect(stderr).toContain("--file");
  });

  it("treats a whitespace-only query as no query", () => {
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "   ",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("No query given");
  });
});

describe("query-readonly.mjs — env resolution", () => {
  it("exits 1 with no connection string, and names the setup script", () => {
    // The operator's next action has to be in the error, or they are stuck.
    const { status, stderr } = run({}, [...NO_ENV_FILE, "select 1"]);
    expect(status).toBe(1);
    expect(stderr).toContain("POSTGRES_URL_READONLY");
    expect(stderr).toContain("readonly-role.sql");
  });

  it("fails on an explicitly named env file it cannot read", () => {
    // A missing DEFAULT file is fine (the caller may have exported the vars);
    // a file the caller named and misspelled is not, or the run silently
    // targets something other than what they asked for.
    const { status, stderr } = run({}, [
      "--env",
      "does/not/exist.env",
      "select 1",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("Cannot read env file");
  });

  it("uses --env rather than --env-file, which Node claims for itself", () => {
    // Node v20+ implements `--env-file` and consumes it even after the script
    // path, so the script never sees it: a bad path dies with Node's own
    // "not found" and exit 9 instead of the message above, and a good path has
    // Node load EVERY key in the file into the environment — the opposite of
    // the two-key whitelist loadEnvFile applies. Renaming the flag is what
    // keeps both properties.
    //
    // A tripwire, not a spec for Node: if a future runtime stops claiming the
    // flag this goes red, and the right response is to read this comment and
    // decide — not to widen the assertion. Only the absence of OUR message is
    // checked, so it does not pin Node's wording.
    const { stderr } = run({}, [
      "--env-file",
      "does/not/exist.env",
      "select 1",
    ]);
    expect(stderr).not.toContain("Cannot read env file");
  });
});

describe("query-readonly.mjs — says which database and which protection", () => {
  it("names PRODUCTION when the target is the production project", () => {
    // A prod read is legitimate. A prod read the operator thought was local is
    // how bad assumptions get made, so the target is never implicit.
    const { stderr } = run({ POSTGRES_URL_READONLY: PROD_POOLER_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("PRODUCTION");
  });

  it("does not print the password when it names the target", () => {
    const { stdout, stderr } = run({ POSTGRES_URL_READONLY: PROD_POOLER_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).not.toContain("sup3rs3cret");
    expect(stdout).not.toContain("sup3rs3cret");
  });

  it("labels a non-production target as such", () => {
    const { stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("non-production");
  });

  it("warns when falling back to POSTGRES_URL that the role CAN write", () => {
    // This is the honest-reporting case: without the dedicated role the only
    // thing stopping a write is the transaction, and the operator should know
    // they are running on one layer rather than two.
    const { stderr } = run({ POSTGRES_URL: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("read-only transaction only");
    expect(stderr).toContain("CAN write");
  });

  it("reports both layers when the dedicated role is configured", () => {
    const { stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("read-only role + read-only transaction");
    expect(stderr).not.toContain("CAN write");
  });

  it("prefers POSTGRES_URL_READONLY when both are set", () => {
    const { stderr } = run(
      { POSTGRES_URL_READONLY: LOCAL_URL, POSTGRES_URL: PROD_POOLER_URL },
      [...NO_ENV_FILE, "select 1"]
    );
    expect(stderr).toContain("non-production");
    expect(stderr).not.toContain("PRODUCTION");
  });
});

/**
 * Strip `--` comments before asserting on a SQL file.
 *
 * These files explain at length what they deliberately do NOT do — the auth
 * grant, `security_invoker` — so a naive source match hits the prose that warns
 * against the thing and fails on a correct file. Only executable text counts.
 */
function statementsOf(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), "utf8")
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join("\n");
}

describe("readonly-role.sql — never grants on auth directly", () => {
  const sql = statementsOf(ROLE_SQL);

  it("does not GRANT on schema auth — Postgres only WARNS when that fails", () => {
    // The original version shipped `GRANT USAGE ON SCHEMA auth`. Schema `auth`
    // is owned by `supabase_admin` and `postgres` holds USAGE on it WITHOUT
    // grant option, so the statement emits `WARNING: no privileges were
    // granted` and psql still exits 0 — a role that cannot read the one thing
    // it exists to read, with a setup script that reported success.
    expect(sql).not.toMatch(/GRANT\s+USAGE\s+ON\s+SCHEMA\s+auth/i);
    expect(sql).not.toMatch(/GRANT\s+SELECT[\s\S]{0,200}?ON\s+auth\./i);
  });

  it("reaches auth through owner-rights views instead", () => {
    expect(sql).toMatch(/CREATE\s+VIEW\s+readonly_auth\.users/i);
    expect(sql).toMatch(/CREATE\s+VIEW\s+readonly_auth\.identities/i);
    expect(sql).toMatch(/GRANT\s+USAGE\s+ON\s+SCHEMA\s+readonly_auth/i);
  });

  it("does NOT make those views security_invoker", () => {
    // The caller has no USAGE on auth, so invoker rights would resolve to
    // permission denied. This is the mechanism, not an oversight.
    expect(sql).not.toMatch(/security_invoker/i);
  });

  it("keeps the credential-bearing auth tables out entirely", () => {
    for (const table of [
      "flow_state",
      "refresh_tokens",
      "mfa_factors",
      "sessions",
      "custom_oauth_providers",
    ]) {
      expect(sql).not.toMatch(new RegExp(`FROM\\s+auth\\.${table}\\b`, "i"));
    }
  });

  it("selects no credential-shaped column into the views", () => {
    // Mirrors the catalog check in verify-readonly-role.sql, from the source
    // side: the view bodies are the allowlist.
    const viewBodies = sql.match(/CREATE\s+VIEW[\s\S]*?;/gi) ?? [];
    expect(viewBodies.length).toBe(2);
    for (const body of viewBodies) {
      expect(body).not.toMatch(
        /\b\w*(token|secret|password|hmac|nonce|challenge)\w*\b/i
      );
    }
  });

  it("pins the role read-only at the role level, not only per-transaction", () => {
    expect(sql).toMatch(/default_transaction_read_only\s*=\s*on/i);
    expect(sql).toMatch(/BYPASSRLS/);
    expect(sql).toMatch(/NOCREATEDB/);
    expect(sql).toMatch(/NOCREATEROLE/);
  });

  it("documents the Supavisor tenant suffix the connection string needs", () => {
    // Without `.<project-ref>` on the username, port 6543 fails authentication
    // rather than failing to route — an error that reads like a wrong password.
    // Asserted against the RAW file: this one lives in the header prose, which
    // is the only place it can live, since the script cannot know the ref.
    const raw = readFileSync(path.join(repoRoot, ROLE_SQL), "utf8");
    expect(raw).toContain("pinpoint_readonly.<project-ref>");
  });
});

describe("verify-readonly-role.sql — asserts privileges, not statements", () => {
  const sql = statementsOf(VERIFY_SQL);

  it("checks the catalog rather than re-running grants", () => {
    expect(sql).toMatch(/has_schema_privilege\(/);
    expect(sql).toMatch(/has_table_privilege\(/);
    expect(sql).not.toMatch(/^\s*GRANT\s/im);
  });

  it("asserts that direct auth USAGE is ABSENT", () => {
    // The check that would have caught the original bug.
    expect(sql).toMatch(
      /has_schema_privilege\('pinpoint_readonly',\s*'auth',\s*'USAGE'\)/
    );
  });

  it("raises rather than merely warning, so psql -f exits non-zero", () => {
    expect(sql).toMatch(/RAISE\s+EXCEPTION/i);
  });
});
