// Regression tests for the prod-safety guards on the DB scripts.
//
// Two layers, deliberately:
//   1. Pure-predicate tests against scripts/lib/db-target.mjs — fast, and they
//      pin the ONE distinction that makes the design work (a Supabase preview
//      branch is a cloud host but is NOT the production project).
//   2. Real subprocess runs of the guarded scripts — spawnSync + exit codes,
//      matching src/test/unit/hooks/*.test.ts. A guard that is exported but
//      never actually invoked is the exact failure mode these catch, and only a
//      real run proves the call site exists AND fires before any connection.
//
// The "passes the guard" cases point at localhost:1, where the socket is
// refused instantly — so the assertion is "it got far enough to try to
// connect", with no waiting on a timeout and no live database required.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  describeTarget,
  isCloudDatabaseUrl,
  isForceProductionEnabled,
  isPinPointProductionTarget,
  PRODUCTION_PROJECT_REF,
} from "../../../../scripts/lib/db-target.mjs";

const repoRoot = process.cwd();

// Shapes taken from the real endpoints (AGENTS.md §7 / pinpoint-deployment).
const PROD_POOLER_URL = `postgres://postgres.${PRODUCTION_PROJECT_REF}:pw@aws-0-us-east-2.pooler.supabase.com:6543/postgres`;
const PROD_DIRECT_URL = `postgres://postgres:pw@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres`;
const PROD_API_URL = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const PREVIEW_POOLER_URL =
  "postgres://postgres.abcdefghijklmnopqrst:pw@aws-0-us-east-2.pooler.supabase.com:6543/postgres";
const PREVIEW_API_URL = "https://abcdefghijklmnopqrst.supabase.co";
// Deliberately port 1: local, so it passes the guard, and instantly refused.
const LOCAL_URL = "postgres://postgres:pw@localhost:1/postgres";
const LOCAL_API_URL = "http://localhost:54321";

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runScript(
  relPath: string,
  env: Record<string, string>,
  argv: string[] = []
): RunResult {
  const result = spawnSync("node", [path.join(repoRoot, relPath), ...argv], {
    encoding: "utf8",
    cwd: repoRoot,
    // Start from a clean slate so an ambient POSTGRES_URL from .env.local (or
    // vitest's env passthrough) cannot decide the outcome of these assertions.
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function runTsxScript(
  relPath: string,
  env: Record<string, string>,
  argv: string[] = []
): RunResult {
  const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");
  const result = spawnSync(tsx, [path.join(repoRoot, relPath), ...argv], {
    encoding: "utf8",
    cwd: repoRoot,
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("db-target — isCloudDatabaseUrl (coarse host match)", () => {
  it("is true for the production pooler", () => {
    expect(isCloudDatabaseUrl(PROD_POOLER_URL)).toBe(true);
  });

  it("is true for a preview branch pooler — same host shape as prod", () => {
    // This is precisely why it cannot be the seed-script guard: the preview
    // pipeline would trip it on every run.
    expect(isCloudDatabaseUrl(PREVIEW_POOLER_URL)).toBe(true);
  });

  it("is true for the other managed hosts drizzle.config.ts listed", () => {
    expect(isCloudDatabaseUrl("postgres://u:p@x.neon.tech/db")).toBe(true);
    expect(isCloudDatabaseUrl("postgres://u:p@x.rds.amazonaws.com/db")).toBe(
      true
    );
  });

  it("is false for a local stack", () => {
    expect(
      isCloudDatabaseUrl(
        "postgres://postgres:postgres@localhost:54322/postgres"
      )
    ).toBe(false);
  });
});

describe("db-target — isPinPointProductionTarget (exact project)", () => {
  it("matches every spelling of a production connection", () => {
    expect(isPinPointProductionTarget(PROD_POOLER_URL)).toBe(true);
    expect(isPinPointProductionTarget(PROD_DIRECT_URL)).toBe(true);
    // The API URL is the case the host regex misses entirely: ".supabase.co"
    // does not contain the substring "supabase.com".
    expect(isCloudDatabaseUrl(PROD_API_URL)).toBe(false);
    expect(isPinPointProductionTarget(PROD_API_URL)).toBe(true);
  });

  it("does NOT match a preview branch — the whole point", () => {
    expect(isPinPointProductionTarget(PREVIEW_POOLER_URL)).toBe(false);
    expect(isPinPointProductionTarget(PREVIEW_API_URL)).toBe(false);
  });

  it("does not match a local stack", () => {
    expect(isPinPointProductionTarget(LOCAL_URL)).toBe(false);
  });
});

describe("db-target — isForceProductionEnabled (opt-in, not truthiness)", () => {
  // PP-rnup. All three FORCE_PRODUCTION guards used to read
  // `Boolean(process.env[...])`, which is backwards for a guard: the two
  // spellings an operator reaches for to turn a flag OFF are both truthy
  // strings, so `=0` ENABLED the prod bypass.
  it.each(["0", "false", "off", "no", "", "  ", "yes", "1 1", "true-ish"])(
    "treats %o as disabled",
    (value) => {
      expect(isForceProductionEnabled(value)).toBe(false);
    }
  );

  it("treats an unset variable as disabled", () => {
    expect(isForceProductionEnabled(undefined)).toBe(false);
  });

  it.each(["1", "true", "TRUE", " 1 ", "True"])(
    "treats %o as enabled",
    (value) => {
      expect(isForceProductionEnabled(value)).toBe(true);
    }
  );
});

describe("db-target — describeTarget never leaks credentials", () => {
  it("drops the password from a connection string", () => {
    expect(describeTarget(PROD_POOLER_URL)).not.toContain("pw");
    expect(describeTarget(PROD_POOLER_URL)).toContain(
      "aws-0-us-east-2.pooler.supabase.com:6543"
    );
  });

  it("redacts credentials even when the value does not parse as a URL", () => {
    expect(describeTarget("not a url://user:secret@host/db")).not.toContain(
      "secret"
    );
  });
});

describe("seed scripts — local-only demo seeds refuse remote targets", () => {
  for (const script of [
    "supabase/seed-collections.mjs",
    "supabase/seed-machine-settings.mjs",
  ]) {
    it(`${script} refuses a production URL`, () => {
      const { status, stderr } = runScript(script, {
        POSTGRES_URL: PROD_POOLER_URL,
      });
      expect(status).toBe(2);
      expect(stderr).toContain("Refusing to run destructive DB script");
    });

    it(`${script} refuses a preview-branch URL too (loopback allowlist)`, () => {
      const { status } = runScript(script, {
        POSTGRES_URL: PREVIEW_POOLER_URL,
      });
      expect(status).toBe(2);
    });

    it(`${script} lets a localhost URL through to the connection attempt`, () => {
      const { status, stderr } = runScript(script, { POSTGRES_URL: LOCAL_URL });
      expect(stderr).not.toContain("Refusing to run destructive DB script");
      // Got past the guard and failed on the socket instead.
      expect(stderr).toContain("ECONNREFUSED");
      expect(status).not.toBe(2);
    });
  }
});

describe("seed scripts — remote-capable seeds refuse production only", () => {
  for (const script of [
    "supabase/seed-discord.mjs",
    "supabase/seed-pinballmap-catalog.mjs",
  ]) {
    it(`${script} refuses the production project`, () => {
      const { status, stderr } = runScript(script, {
        POSTGRES_URL: PROD_POOLER_URL,
        // seed-discord no-ops without a token; set one so the guard is what
        // decides the exit, not the early "nothing to do" return.
        DISCORD_BOT_TOKEN: "fake-token-for-test",
      });
      expect(status).toBe(2);
      expect(stderr).toContain("PinPoint PRODUCTION");
      expect(stderr).toContain("There is no override");
    });

    it(`${script} allows a preview-branch URL (preview pipeline must keep working)`, () => {
      const { stderr } = runScript(script, {
        POSTGRES_URL: PREVIEW_POOLER_URL,
        DISCORD_BOT_TOKEN: "fake-token-for-test",
      });
      expect(stderr).not.toContain("PinPoint PRODUCTION");
    });

    it(`${script} allows a localhost URL through to the connection attempt`, () => {
      const { stderr } = runScript(script, {
        POSTGRES_URL: LOCAL_URL,
        DISCORD_BOT_TOKEN: "fake-token-for-test",
      });
      expect(stderr).not.toContain("PinPoint PRODUCTION");
      // These two catch their own connection error and print a bare "seed
      // failed" line, so assert on that rather than on ECONNREFUSED: either way
      // the run got past the guard and reached the database.
      expect(stderr).toMatch(/seed failed/i);
    });
  }
});

describe("reset-preview-db.mjs — destructive, so guarded unconditionally", () => {
  const script = "scripts/reset-preview-db.mjs";

  it("refuses production even when PROD_PROJECT_REF is unset", () => {
    // The pre-existing guard only fires when the caller supplies
    // PROD_PROJECT_REF — which the preview workflows do and a hand-run does
    // not. This script DROPs schemas and DELETEs auth.users.
    const { status, stderr } = runScript(script, {
      POSTGRES_URL: PROD_POOLER_URL,
    });
    expect(status).toBe(2);
    expect(stderr).toContain("PinPoint PRODUCTION");
  });

  it("still honours the caller-declared PROD_PROJECT_REF", () => {
    const { status, stderr } = runScript(script, {
      POSTGRES_URL: PREVIEW_POOLER_URL,
      PROD_PROJECT_REF: "abcdefghijklmnopqrst",
    });
    expect(status).toBe(1);
    expect(stderr).toContain("references the production project");
  });

  it("allows an ordinary preview branch", () => {
    const { stderr } = runScript(script, {
      POSTGRES_URL: PREVIEW_POOLER_URL,
    });
    expect(stderr).not.toContain("PinPoint PRODUCTION");
    expect(stderr).not.toContain("references the production project");
  });
});

describe("seed-users.mjs — guards BOTH write endpoints", () => {
  const baseEnv = {
    SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-key",
  };

  it("refuses when NEXT_PUBLIC_SUPABASE_URL is production, even with a local POSTGRES_URL", () => {
    // The Admin API path (`supabase.auth.admin.createUser`) is driven by the
    // API URL, NOT by POSTGRES_URL — guarding only the latter would still let
    // admin@test.com et al. be created in production auth.
    const { status, stderr } = runScript("supabase/seed-users.mjs", {
      ...baseEnv,
      NEXT_PUBLIC_SUPABASE_URL: PROD_API_URL,
      POSTGRES_URL: LOCAL_URL,
    });
    expect(status).toBe(2);
    expect(stderr).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(stderr).toContain("PinPoint PRODUCTION");
  });

  it("refuses when POSTGRES_URL is production, even with a local API URL", () => {
    const { status, stderr } = runScript("supabase/seed-users.mjs", {
      ...baseEnv,
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_API_URL,
      POSTGRES_URL: PROD_POOLER_URL,
    });
    expect(status).toBe(2);
    expect(stderr).toContain("POSTGRES_URL");
    expect(stderr).toContain("PinPoint PRODUCTION");
  });

  it("allows a preview branch on both endpoints (preview pipeline)", () => {
    const { stderr } = runScript("supabase/seed-users.mjs", {
      ...baseEnv,
      NEXT_PUBLIC_SUPABASE_URL: PREVIEW_API_URL,
      POSTGRES_URL: PREVIEW_POOLER_URL,
    });
    expect(stderr).not.toContain("PinPoint PRODUCTION");
  });

  it("allows a fully local target", () => {
    const { stderr } = runScript("supabase/seed-users.mjs", {
      ...baseEnv,
      NEXT_PUBLIC_SUPABASE_URL: LOCAL_API_URL,
      POSTGRES_URL: LOCAL_URL,
    });
    expect(stderr).not.toContain("PinPoint PRODUCTION");
  });
});

describe("mark-migration-applied.ts — production confirmation gate", () => {
  const script = "scripts/mark-migration-applied.ts";

  it("refuses a remote target with no opt-in token", () => {
    const { status, stderr } = runTsxScript(
      script,
      { POSTGRES_URL: PROD_POOLER_URL },
      ["0001"]
    );
    expect(status).toBe(1);
    expect(stderr).toContain(
      "Refusing to write to drizzle.__drizzle_migrations"
    );
    // The refusal has to name the token, or an operator mid-incident is stuck.
    expect(stderr).toContain("MARK_MIGRATION_FORCE_PRODUCTION=1");
    // …and it must not print the password.
    expect(stderr).not.toContain(":pw@");
  });

  it("names the migration it was asked about", () => {
    const { stderr } = runTsxScript(script, { POSTGRES_URL: PROD_POOLER_URL }, [
      "0042",
    ]);
    expect(stderr).toContain("0042");
  });

  it("permits the prod path once the token is set, without hanging on a non-TTY", () => {
    // spawnSync gives the child a pipe, not a TTY, so the interactive confirm
    // must be skipped entirely — otherwise this test would time out, which is
    // exactly the CI-hang regression it guards against.
    const { status, stderr } = runTsxScript(
      script,
      {
        POSTGRES_URL: PROD_POOLER_URL,
        MARK_MIGRATION_FORCE_PRODUCTION: "1",
      },
      ["0001"]
    );
    expect(stderr).not.toContain("Refusing to write");
    // Past the gate; it now fails on the (unreachable, fake-credential)
    // connection rather than on the guard.
    expect(status).toBe(1);
    expect(stderr).toContain("Failed to mark migration as applied");
  });

  it("still refuses when the token is set to a falsey STRING", () => {
    // PP-rnup. `Boolean("0")` is true, so the old truthiness read turned an
    // operator's attempt to disable the bypass into an enable.
    const { status, stderr } = runTsxScript(
      script,
      {
        POSTGRES_URL: PROD_POOLER_URL,
        MARK_MIGRATION_FORCE_PRODUCTION: "0",
      },
      ["0001"]
    );
    expect(status).toBe(1);
    expect(stderr).toContain(
      "Refusing to write to drizzle.__drizzle_migrations"
    );
  });

  it("does not gate a localhost target at all", () => {
    const { stderr } = runTsxScript(script, { POSTGRES_URL: LOCAL_URL }, [
      "0001",
    ]);
    expect(stderr).not.toContain("Refusing to write");
  });
});

describe("seed-pinballmap-creds.mjs — prod-capable behind an explicit opt-in", () => {
  const script = "supabase/seed-pinballmap-creds.mjs";
  // No credentials in the env: the guard runs first, and on the paths that get
  // past it the script exits at the "not both set" skip — BEFORE it opens a
  // client. Nothing here can reach a real PinballMap or prod endpoint.

  it("refuses the production project with no opt-in", () => {
    const { status, stderr } = runScript(script, {
      POSTGRES_URL: PROD_POOLER_URL,
    });
    expect(status).toBe(1);
    expect(stderr).toContain("Refusing to write PinballMap credentials");
    expect(stderr).toContain("SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION=1");
    expect(stderr).not.toContain(":pw@");
  });

  it("still refuses when the opt-in is set to a falsey STRING", () => {
    // PP-rnup, and the sharpest instance of it: this script writes an operator
    // token into prod's Vault, so `=0` meaning "yes" pushes a DEV credential
    // into production.
    const { status, stderr } = runScript(script, {
      POSTGRES_URL: PROD_POOLER_URL,
      SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION: "0",
    });
    expect(status).toBe(1);
    expect(stderr).toContain("Refusing to write PinballMap credentials");
  });

  it("permits the prod path once the opt-in is really set", () => {
    const { status, stderr } = runScript(script, {
      POSTGRES_URL: PROD_POOLER_URL,
      SEED_PINBALLMAP_CREDS_FORCE_PRODUCTION: "1",
    });
    expect(stderr).not.toContain("Refusing to write PinballMap credentials");
    // Past the gate, then out at the no-credentials skip without connecting.
    expect(status).toBe(0);
  });

  it("does not gate a localhost target at all", () => {
    const { stderr } = runScript(script, { POSTGRES_URL: LOCAL_URL });
    expect(stderr).not.toContain("Refusing to write PinballMap credentials");
  });
});

describe("wiring — drizzle.config.ts uses the shared helper", () => {
  it("imports isCloudDatabaseUrl instead of re-inlining the host regex", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      path.resolve(repoRoot, "drizzle.config.ts"),
      "utf8"
    );

    expect(source).toContain("scripts/lib/db-target.mjs");
    expect(source).toContain("isCloudDatabaseUrl(directUrl)");
    // A second copy of the regex is how this drifts.
    expect(source).not.toContain("rds\\.amazonaws\\.com");
    // The existing escape hatch must survive unchanged.
    expect(source).toContain("DRIZZLE_FORCE_PRODUCTION");
  });
});
