// Unit tests for the `isHeavyCommand` classifier exported from
// .claude/hooks/block-heavy-under-pressure.cjs.
//
// The classifier is pure (no exec/fs I/O) so these tests run without spawning
// the memory precheck. They cover the fix for the false-positive where the
// heavy-command regexes were tested against the WHOLE command string, so any
// command that merely NAMED a heavy runner in an argument (echo, bd comments,
// rg, a commit message) fired a memory probe that can poll for five minutes.
//
// They also cover the follow-up fix (PP-qota): newlines are no longer treated
// as segment separators, so heredoc bodies and multi-line quoted arguments
// stop tripping the gate.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, it, expect } from "vitest";

// Resolve the hook relative to the repo root (process.cwd() in vitest).
const require = createRequire(import.meta.url);
const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-heavy-under-pressure.cjs"
);
const { isHeavyCommand } = require(hookPath) as {
  isHeavyCommand: (cmd: string) => boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function expectHeavy(cmd: string) {
  expect(
    isHeavyCommand(cmd),
    `Expected HEAVY (precheck runs) for: ${JSON.stringify(cmd)}`
  ).toBe(true);
}

function expectNotHeavy(cmd: string) {
  expect(
    isHeavyCommand(cmd),
    `Expected NOT heavy (allow immediately) for: ${JSON.stringify(cmd)}`
  ).toBe(false);
}

// ---------------------------------------------------------------------------
// Real heavy invocations — must still be detected
// ---------------------------------------------------------------------------
describe("real heavy invocations → HEAVY", () => {
  it.each([
    "pnpm run build",
    "pnpm run smoke",
    "pnpm run e2e",
    "pnpm run test:integration",
    "pnpm run test:integration:supabase",
  ])("detects %s", (cmd) => {
    expectHeavy(cmd);
  });

  it("detects vitest run", () => {
    expectHeavy("vitest run");
  });

  it("detects playwright test", () => {
    expectHeavy("playwright test");
  });

  it("detects a pnpm run script with flags after it", () => {
    expectHeavy("pnpm run smoke --reporter=list");
  });

  it("detects e2e:* suffixed scripts (preserved from the old regex)", () => {
    expectHeavy("pnpm run e2e:full");
    expectHeavy("pnpm run e2e:all");
  });
});

// ---------------------------------------------------------------------------
// Package-runner and path forms — the classifier steps through / basenames
// ---------------------------------------------------------------------------
describe("package runners and absolute/relative paths → HEAVY", () => {
  it("steps through pnpm exec", () => {
    expectHeavy("pnpm exec playwright test --project=chromium");
  });

  it("steps through npx with its own flag", () => {
    expectHeavy("npx -y playwright test");
  });

  it("steps through pnpm dlx", () => {
    expectHeavy("pnpm dlx vitest run");
  });

  it("steps through npm exec", () => {
    expectHeavy("npm exec vitest run");
  });

  it("steps through yarn / bun direct binary form", () => {
    expectHeavy("yarn playwright test");
    expectHeavy("bun vitest run");
  });

  it("resolves ./node_modules/.bin/<bin> on basename", () => {
    expectHeavy("./node_modules/.bin/vitest run");
    expectHeavy("./node_modules/.bin/playwright test");
  });

  it("resolves an absolute pnpm path on basename", () => {
    expectHeavy("/usr/local/bin/pnpm run build");
  });

  it("skips leading env assignments and wrappers", () => {
    expectHeavy("CI=1 pnpm run build");
    expectHeavy("time pnpm run smoke");
  });
});

// ---------------------------------------------------------------------------
// Compound commands — heavy if ANY segment invokes a heavy runner.
// Separators are && || ; | only; see the newline section below.
// ---------------------------------------------------------------------------
describe("compound commands → HEAVY if any segment is", () => {
  it("detects a heavy command chained after cd", () => {
    expectHeavy("cd packages/app && pnpm run build");
  });

  it("detects a heavy command after a semicolon", () => {
    expectHeavy("echo starting; playwright test e2e/foo.spec.ts");
  });

  it("detects a heavy command piped into another", () => {
    expectHeavy("vitest run | tee out.log");
  });
});

// ---------------------------------------------------------------------------
// Prose mentions (the false-positive fix) — must NOT be heavy
// ---------------------------------------------------------------------------
describe("prose mentioning a heavy command → NOT heavy (false-positive fix)", () => {
  it("allows echo of instructions naming a heavy script", () => {
    expectNotHeavy('echo "how to run pnpm run build"');
  });

  it("allows a bead comment describing a heavy run", () => {
    expectNotHeavy('bd comments add "PP-x" "ran pnpm run smoke"');
  });

  it("allows ripgrep searching for a heavy command", () => {
    expectNotHeavy('rg "playwright test" docs/');
  });

  it("allows a commit message naming a heavy command", () => {
    expectNotHeavy('git commit -m "speed up vitest run"');
  });

  it("allows a heredoc whose body names heavy commands", () => {
    expectNotHeavy(
      [
        "cat > /tmp/notes.md <<'EOF'",
        "Release steps:",
        "1. pnpm run build",
        "2. pnpm run smoke",
        "EOF",
      ].join("\n")
    );
  });
});

// ---------------------------------------------------------------------------
// Newlines are NOT segment separators (PP-qota).
//
// Without a shell parser, splitting on newlines made the classifier descend
// into heredoc bodies and multi-line quoted arguments: any LINE that BEGAN
// with a heavy invocation became its own "segment" and fired the (up to
// five-minute) memory probe. Quoting was never the discriminator — a heredoc
// line reading "Run pnpm run smoke first" only escaped because it started with
// "Run". These cover the lines that DO start with a heavy invocation.
// ---------------------------------------------------------------------------
describe("newline bodies → NOT heavy (PP-qota)", () => {
  it("allows a heredoc whose body LINE STARTS with a heavy invocation", () => {
    expectNotHeavy(
      ["cat <<EOF > notes.md", "pnpm run build", "EOF"].join("\n")
    );
  });

  it("allows a heredoc body line starting with playwright test", () => {
    expectNotHeavy(
      [
        "cat > /tmp/handoff.md <<'EOF'",
        "playwright test e2e/foo.spec.ts",
        "vitest run",
        "EOF",
      ].join("\n")
    );
  });

  it("allows a multi-line quoted argument whose line starts with a heavy invocation", () => {
    expectNotHeavy('bd comments add PP-x "line1\npnpm run e2e\nline3"');
  });

  it("allows a multi-line commit message body naming a heavy run", () => {
    expectNotHeavy(
      'git commit -m "fix: speed up CI\n\npnpm run build was slow"'
    );
  });

  // Accepted cost of dropping the newline split: a GENUINE multi-line sequence
  // is no longer gated. Correct trade — a missed exotic invocation is cheaper
  // than a false positive, and agents write this as `cd foo && pnpm run build`,
  // which still gates (see the compound-commands section).
  it("accepts the false negative: a real newline-separated heavy sequence", () => {
    expectNotHeavy("cd packages/app\npnpm run build");
    expectNotHeavy("git fetch origin\npnpm run test:integration");
  });
});

// ---------------------------------------------------------------------------
// Near misses — similar but genuinely not heavy
// ---------------------------------------------------------------------------
describe("near misses → NOT heavy", () => {
  it.each([
    "pnpm run buildx",
    "pnpm run lint",
    "playwright install",
    "vitest --version",
    "pnpm run check",
    "pnpm install",
  ])("allows %s", (cmd) => {
    expectNotHeavy(cmd);
  });

  it("allows an empty or whitespace-only command", () => {
    expectNotHeavy("");
    expectNotHeavy("   ");
  });
});

// ---------------------------------------------------------------------------
// Subprocess: the hook end-to-end, with a stub precheck that ALWAYS blocks.
// This is what proves the classifier and the inline override actually keep the
// (slow, up-to-5-minute) precheck from running — not just that they return
// false in isolation.
// ---------------------------------------------------------------------------
const stubRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mem-precheck-stub-"));
fs.mkdirSync(path.join(stubRoot, "scripts", "guard"), { recursive: true });
fs.writeFileSync(
  path.join(stubRoot, "scripts", "guard", "mem-precheck.sh"),
  '#!/usr/bin/env bash\necho "STUB HARD-BLOCK" >&2\nexit 1\n'
);

afterAll(() => {
  fs.rmSync(stubRoot, { recursive: true, force: true });
});

/** Run the hook as a subprocess against the always-blocking stub precheck. */
function runHook(command: string): { status: number; stdout: string } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: stubRoot,
  };
  // The hook passes through unconditionally when $CI is set; drop it so the
  // classifier is what decides here (CI is set on GitHub Actions runners).
  delete env.CI;
  const result = spawnSync("node", [hookPath], {
    env,
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "" };
}

describe("hook subprocess — the precheck only runs for real heavy commands", () => {
  it("denies a genuine heavy command when the precheck hard-blocks", () => {
    const { status, stdout } = runHook("pnpm run build");
    expect(status).toBe(0); // hooks always exit 0; the decision is in stdout
    expect(stdout).toContain('"permissionDecision":"deny"');
    expect(stdout).toContain("STUB HARD-BLOCK");
  });

  it("short-circuits on the inline FORCE_MEM_PRECHECK=skip override", () => {
    const { status, stdout } = runHook(
      "FORCE_MEM_PRECHECK=skip pnpm run build"
    );
    expect(status).toBe(0);
    expect(stdout).toBe("");
  });

  it("never reaches the precheck for prose naming a heavy command", () => {
    const { status, stdout } = runHook('echo "how to run pnpm run build"');
    expect(status).toBe(0);
    expect(stdout).toBe("");
  });

  it("never reaches the precheck for a heredoc body line starting with a heavy invocation", () => {
    const { status, stdout } = runHook(
      ["cat <<EOF > notes.md", "pnpm run build", "EOF"].join("\n")
    );
    expect(status).toBe(0);
    expect(stdout).toBe("");
  });
});
