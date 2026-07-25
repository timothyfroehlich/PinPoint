// Unit tests for scripts/lib/drizzle-push-guard.ts — the CORE-ARCH-009 refusal
// that `drizzle.config.ts` invokes, and therefore that drizzle-kit itself
// executes on every run.
//
// The guard is pure argv inspection, so it is exercised directly rather than by
// shelling out to drizzle-kit: spawning the real CLI would need a live database
// for the sanctioned subcommands and would turn a millisecond assertion into a
// multi-second one for no extra coverage.
//
// The argv fixtures below are the real shapes, captured from actual runs:
//   [node, <repo>/node_modules/drizzle-kit/bin.cjs, "<command>", "--config=..."]

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertNotDrizzlePush,
  DRIZZLE_PUSH_REFUSAL,
  findDrizzleSubcommand,
  isDrizzlePushInvocation,
} from "../../../scripts/lib/drizzle-push-guard";

const NODE = "/Users/x/.nvm/versions/node/v24.16.0/bin/node";
const BIN = "/Users/x/Code/PinPoint/node_modules/drizzle-kit/bin.cjs";

function argvFor(...args: string[]): string[] {
  return [NODE, BIN, ...args];
}

describe("drizzle-push-guard — refuses push", () => {
  it("refuses `drizzle-kit push`", () => {
    const argv = argvFor("push", "--config=drizzle.config.ts");
    expect(isDrizzlePushInvocation(argv)).toBe(true);
    expect(() => assertNotDrizzlePush(argv)).toThrow(/CORE-ARCH-009/);
  });

  it("refuses the legacy dialect-suffixed `push:pg`", () => {
    const argv = argvFor("push:pg", "--config=drizzle.config.ts");
    expect(isDrizzlePushInvocation(argv)).toBe(true);
    expect(() => assertNotDrizzlePush(argv)).toThrow(/CORE-ARCH-009/);
  });

  it("refuses push regardless of dialect suffix", () => {
    for (const sub of ["push:mysql", "push:sqlite"]) {
      expect(isDrizzlePushInvocation(argvFor(sub))).toBe(true);
    }
  });

  it("refuses push even when flags precede the subcommand", () => {
    expect(isDrizzlePushInvocation(argvFor("--verbose", "push"))).toBe(true);
  });

  it("refuses push with no trailing flags", () => {
    expect(isDrizzlePushInvocation(argvFor("push"))).toBe(true);
  });

  it("points at the sanctioned workflow instead of just saying no", () => {
    expect(DRIZZLE_PUSH_REFUSAL).toContain("CORE-ARCH-009");
    expect(DRIZZLE_PUSH_REFUSAL).toContain("pnpm run db:generate");
    expect(DRIZZLE_PUSH_REFUSAL).toContain("pnpm run db:migrate");
    expect(DRIZZLE_PUSH_REFUSAL).toContain("pnpm run db:studio");
  });

  it("reads process.argv when no argv is passed", () => {
    const original = process.argv;
    try {
      process.argv = argvFor("push", "--config=drizzle.config.ts");
      expect(() => {
        assertNotDrizzlePush();
      }).toThrow(/CORE-ARCH-009/);
    } finally {
      process.argv = original;
    }
  });
});

describe("drizzle-push-guard — lets sanctioned subcommands through", () => {
  // Every subcommand PinPoint actually uses: db:generate, db:migrate,
  // check:migrations, drizzle-kit export (schema dump), db:studio.
  for (const sub of [
    "generate",
    "migrate",
    "check",
    "export",
    "studio",
    "up",
  ]) {
    it(`allows \`drizzle-kit ${sub}\``, () => {
      const argv = argvFor(sub, "--config=drizzle.config.ts");
      expect(findDrizzleSubcommand(argv)).toBe(sub);
      expect(isDrizzlePushInvocation(argv)).toBe(false);
      expect(() => {
        assertNotDrizzlePush(argv);
      }).not.toThrow();
    });
  }

  it("does not refuse a subcommand that merely starts with the letters", () => {
    expect(isDrizzlePushInvocation(argvFor("pushed"))).toBe(false);
    expect(isDrizzlePushInvocation(argvFor("pushup"))).toBe(false);
  });

  it("does not refuse when the config is loaded outside the drizzle-kit CLI", () => {
    // vitest / tsx / an editor importing drizzle.config.ts: no subcommand at all.
    expect(
      findDrizzleSubcommand([NODE, "/path/to/vitest.mjs"])
    ).toBeUndefined();
    expect(isDrizzlePushInvocation([NODE, "/path/to/vitest.mjs"])).toBe(false);
  });

  it("does not refuse when only flags follow the script path", () => {
    expect(isDrizzlePushInvocation(argvFor("--help"))).toBe(false);
  });
});

describe("drizzle.config.ts wiring", () => {
  const source = readFileSync(
    path.resolve(process.cwd(), "drizzle.config.ts"),
    "utf8"
  );

  it("calls the guard", () => {
    expect(source).toContain("assertNotDrizzlePush()");
  });

  it("calls the guard before any credential is resolved", () => {
    // A refusal must never be able to print a connection string, so the guard
    // has to run ahead of env loading and the POSTGRES_URL reads.
    const guardAt = source.indexOf("assertNotDrizzlePush()");
    const envAt = source.indexOf("loadEnvConfig(");
    const credentialAt = source.indexOf("process.env.POSTGRES_URL");

    expect(guardAt).toBeGreaterThan(-1);
    expect(envAt).toBeGreaterThan(guardAt);
    expect(credentialAt).toBeGreaterThan(guardAt);
  });
});
