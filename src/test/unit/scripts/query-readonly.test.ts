// The read-only query tool and the role it pairs with (PP-xdvw).
//
// Two layers, matching db-target-guards.test.ts:
//   1. Real subprocess runs of scripts/query-readonly.mjs — argument handling,
//      env resolution, and what it tells the operator about the target. A tool
//      whose whole value is "you cannot write with this" has to be legible about
//      which database it is pointed at and which layer is protecting it.
//   2. Source assertions on scripts/sql/readonly-role.sql and its verify script,
//      pinning the mistakes that already shipped once: granting on `auth`
//      directly, and exposing the collections share token.
//
// What is deliberately NOT here: whether a write actually gets SQLSTATE 25006,
// or whether the view_token exclusion actually denies at the privilege level.
// Those are properties of the server — see scripts/sql/verify-readonly-role.sql,
// which is run against the target database itself.
//
// Every URL fixture points at `localhost:1` (connection refused instantly), so a
// case that reaches the connect step fails fast rather than hanging — and the
// "production" fixture keeps the prod project ref in the USERNAME while pointing
// the host at localhost, so `isPinPointProductionTarget` still fires but nothing
// ever dials the real production endpoint (that would be a CORE-TEST-006
// violation — a production hostname reachable from a unit run). `run()` also
// caps each subprocess with a timeout so a misconfigured host cannot wedge CI.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const SCRIPT = "scripts/query-readonly.mjs";
const ROLE_SQL = "scripts/sql/readonly-role.sql";
const VERIFY_SQL = "scripts/sql/verify-readonly-role.sql";

// Production project ref in the username, host pinned to localhost:1 — reads as
// production to isPinPointProductionTarget, connects to nothing reachable.
const PROD_LIKE_URL =
  "postgres://pinpoint_readonly.udhesuizjsgxfeotqybn:sup3rs3cret@localhost:1/postgres";
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
    // A blackholed host must not wedge the worker: localhost:1 refuses in
    // microseconds, but the timeout is the backstop if a fixture is ever wrong.
    timeout: 20_000,
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

// Temp dirs holding throwaway env fixtures; removed after the suite.
const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

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

describe("query-readonly.mjs — argument parsing is strict", () => {
  // A silent-drop parser would let a misspelled flag or a stray word change
  // which database or which statement runs, without a word to the operator.

  it("rejects an unknown flag instead of dropping it", () => {
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "--frobnicate",
      "select 1",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("unknown flag --frobnicate");
  });

  it("rejects a second positional rather than letting the last one win", () => {
    // The classic footgun: an unquoted query splits into words and the last one
    // silently becomes THE query. Loud instead.
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "select 1",
      "select 2",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("extra argument");
  });

  it("rejects a value-flag that would swallow the next flag as its value", () => {
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      "--env",
      "--json",
      "select 1",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("--env needs a value");
  });

  it("rejects --env-file as unknown rather than silently mis-running", () => {
    // Node (v20+) owns `--env-file`: a missing file makes Node abort before this
    // script runs, and an existing file has Node load EVERY key in it. Either
    // way the operator meant `--env`; the old silent-drop parser turned the
    // typo's filename into a positional and ran the default `.env.local`. Now it
    // is a hard error. (This asserts OUR rejection, so it is robust to a file
    // that exists vs. not — Node's own abort path never reaches us.)
    const { stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      "--env-file",
      "/dev/null",
      "select 1",
    ]);
    expect(stderr).toContain("unknown flag --env-file");
    expect(stderr).not.toContain("(0 rows)");
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

  it("lets an exported variable win over the env file (dotenv precedence)", () => {
    // The which-DB footgun: an operator exports a prod URL, then runs from a
    // worktree whose .env.local also defines one. The export must win, or the
    // tool reads local while reporting prod. Here the file says local and the
    // export says prod-like — prod must be what the banner names.
    const dir = mkdtempSync(path.join(tmpdir(), "query-readonly-env-"));
    tmpDirs.push(dir);
    const envPath = path.join(dir, "local.env");
    writeFileSync(envPath, `POSTGRES_URL_READONLY=${LOCAL_URL}\n`);

    const { stderr } = run({ POSTGRES_URL_READONLY: PROD_LIKE_URL }, [
      "--env",
      envPath,
      "select 1",
    ]);
    expect(stderr).toContain("PRODUCTION");
    expect(stderr).not.toContain("non-production");
  });
});

describe("query-readonly.mjs — --file input", () => {
  it("turns a missing query file into a friendly error, not a stack trace", () => {
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "--file",
      "does/not/exist.sql",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("Cannot read query file");
    expect(stderr).not.toContain("at readFileSync");
  });

  it("does not treat a following flag as the filename", () => {
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      "--file",
      "--json",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("--file needs a value");
  });

  it("rejects --file together with an inline query rather than silently dropping one", () => {
    // --file would win and the positional would vanish — the same "which
    // statement ran?" ambiguity the parser is loud about everywhere else.
    const { status, stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "--file",
      "query.sql",
      "select 1",
    ]);
    expect(status).toBe(1);
    expect(stderr).toContain("not both");
  });
});

describe("query-readonly.mjs — says which database and which protection", () => {
  it("names PRODUCTION when the target is the production project", () => {
    // A prod read is legitimate. A prod read the operator thought was local is
    // how bad assumptions get made, so the target is never implicit.
    const { stderr } = run({ POSTGRES_URL_READONLY: PROD_LIKE_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("PRODUCTION");
  });

  it("does not print the password when it names the target", () => {
    const { stdout, stderr } = run({ POSTGRES_URL_READONLY: PROD_LIKE_URL }, [
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

  it("warns loudly on the fallback path that the role CAN write", () => {
    // Without the dedicated role the write privilege exists, and a multi-
    // statement query is NOT contained. The operator must be told this is not a
    // safe place to run untrusted SQL — the honest framing, not "protected".
    const { stderr } = run({ POSTGRES_URL: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("NO read-only role");
    expect(stderr).toContain("CAN write");
  });

  it("states the real guarantee when the dedicated role is configured", () => {
    const { stderr } = run({ POSTGRES_URL_READONLY: LOCAL_URL }, [
      ...NO_ENV_FILE,
      "select 1",
    ]);
    expect(stderr).toContain("read-only role");
    expect(stderr).not.toContain("CAN write");
  });

  it("prefers POSTGRES_URL_READONLY when both are set", () => {
    const { stderr } = run(
      { POSTGRES_URL_READONLY: LOCAL_URL, POSTGRES_URL: PROD_LIKE_URL },
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

  it("selects no credential-shaped column into the auth views", () => {
    // The view bodies are the allowlist. Mirrors the catalog check in the verify
    // script from the source side.
    const viewBodies = sql.match(/CREATE\s+VIEW[\s\S]*?;/gi) ?? [];
    expect(viewBodies.length).toBe(2);
    for (const body of viewBodies) {
      expect(body).not.toMatch(
        /\b\w*(token|secret|password|hmac|nonce|challenge)\w*\b/i
      );
    }
  });

  it("excludes collections.view_token from the public grant", () => {
    // public is NOT credential-free: collections.view_token is a share
    // capability token. The blanket grant is narrowed by revoking the table
    // grant on collections and re-granting every column except view_token.
    expect(sql).toMatch(/REVOKE\s+SELECT\s+ON\s+public\.collections/i);
    expect(sql).toMatch(/column_name\s*<>\s*'view_token'/i);
    // …and it must not simply grant the whole table back.
    expect(sql).not.toMatch(/GRANT\s+SELECT\s+ON\s+public\.collections\s+TO/i);
  });

  it("sets ON_ERROR_STOP so a failed statement exits non-zero", () => {
    // Without it, psql exits 0 on error and a broken setup reports success.
    expect(sql).toMatch(/ON_ERROR_STOP\s+on/i);
  });

  it("raises on a missing password rather than \\quit 1 (which exits 0)", () => {
    // `\quit 1` ignores its argument and exits 0; a RAISE under ON_ERROR_STOP
    // exits non-zero, which is the only thing that actually stops the run.
    expect(sql).toMatch(/RAISE\s+EXCEPTION\s+'missing required/i);
  });

  it("pins the role read-only at the role level, not only per-transaction", () => {
    expect(sql).toMatch(/default_transaction_read_only\s*=\s*on/i);
    expect(sql).toMatch(/BYPASSRLS/);
    expect(sql).toMatch(/NOCREATEDB/);
    expect(sql).toMatch(/NOCREATEROLE/);
  });

  it("documents a URL-safe password and the Supavisor tenant suffix", () => {
    // A base64 password can contain `/`, which terminates the URL authority and
    // makes new URL() throw; and without `.<project-ref>` on the username, port
    // 6543 fails authentication. Both live in the header prose (the script
    // cannot know the ref), so assert against the raw file.
    const raw = readFileSync(path.join(repoRoot, ROLE_SQL), "utf8");
    expect(raw).toContain("pinpoint_readonly.<project-ref>");
    expect(raw).toMatch(/rand -hex/);
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

  it("asserts view_token is NOT readable and the rest of collections is", () => {
    expect(sql).toMatch(
      /has_column_privilege\('pinpoint_readonly',\s*'public\.collections',\s*'view_token'/
    );
  });

  it("sets ON_ERROR_STOP and raises, so psql -f exits non-zero on failure", () => {
    // Both are required: RAISE EXCEPTION alone still exits 0 without the \set.
    expect(sql).toMatch(/ON_ERROR_STOP\s+on/i);
    expect(sql).toMatch(/RAISE\s+EXCEPTION/i);
  });

  it("guards checks on optional schemas so a missing one does not abort", () => {
    // has_*_privilege on a missing relation/schema errors and would discard
    // every check before it in the DO block. Guarded on existence.
    expect(sql).toMatch(/to_regnamespace\('vault'\)/i);
    expect(sql).toMatch(/to_regclass\('auth\.flow_state'\)/i);
  });
});
