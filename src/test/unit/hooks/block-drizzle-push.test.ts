// Unit tests for .claude/hooks/block-drizzle-push.cjs — the PreToolUse hook
// that blocks `drizzle-kit push` in every invocation shape (CORE-ARCH-009).
//
// `push` applies a schema delta straight to the database with no migration
// file, forking the prevId chain in drizzle/meta. Prior coverage was partial:
// the `db:_push` package script is a tripwire, and settings denies
// `supabase db push` — neither touches `drizzle-kit push` itself.
//
// Exercises the hook as a subprocess (spawnSync node hookPath, JSON on stdin)
// — matches block-direct-merge.test.ts.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-drizzle-push.cjs"
);

function runHook(payload: unknown): { status: number; stderr: string } {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

function bash(command: string): unknown {
  return { tool_name: "Bash", tool_input: { command } };
}

describe("block-drizzle-push.cjs — blocked invocation shapes", () => {
  it.each([
    ["bare", "drizzle-kit push"],
    ["pnpm exec", "pnpm exec drizzle-kit push"],
    ["npx", "npx drizzle-kit push"],
    ["pnpm dlx", "pnpm dlx drizzle-kit push"],
    ["bunx", "bunx drizzle-kit push"],
    ["with --force", "drizzle-kit push --force"],
    ["with a flag between", "drizzle-kit --config=x.ts push"],
    ["legacy dialect suffix", "drizzle-kit push:pg"],
    ["chained after another command", "git status && npx drizzle-kit push"],
    ["node_modules path", "./node_modules/.bin/drizzle-kit push"],
  ])("blocks %s", (_label, command) => {
    const { status, stderr } = runHook(bash(command));
    expect(status).toBe(2);
    expect(stderr).toContain("drizzle-kit push");
    expect(stderr).toContain("CORE-ARCH-009");
    expect(stderr).toContain("db:generate");
  });
});

describe("block-drizzle-push.cjs — sanctioned drizzle-kit subcommands", () => {
  it.each([
    ["generate", "pnpm run db:generate"],
    ["migrate", "drizzle-kit migrate"],
    ["check", "drizzle-kit check"],
    ["export", "drizzle-kit export --dialect=postgresql"],
    ["studio", "drizzle-kit studio"],
  ])("allows %s", (_label, command) => {
    expect(runHook(bash(command)).status).toBe(0);
  });
});

describe("block-drizzle-push.cjs — fails open", () => {
  it("allows a heredoc that merely mentions the command", () => {
    // Commit messages and docs legitimately explain why push is banned.
    const command = [
      "git commit -m \"$(cat <<'EOF'",
      "chore(db): document why drizzle-kit push is disabled",
      "EOF",
      ')"',
    ].join("\n");
    expect(runHook(bash(command)).status).toBe(0);
  });

  it("allows unrelated commands containing the word push", () => {
    expect(runHook(bash("git push origin main")).status).toBe(0);
    expect(runHook(bash("pnpm run db:migrate")).status).toBe(0);
  });

  it("allows non-Bash tools", () => {
    const payload = {
      tool_name: "Write",
      tool_input: { file_path: "a.ts", content: "drizzle-kit push" },
    };
    expect(runHook(payload).status).toBe(0);
  });

  it("allows a malformed payload", () => {
    const result = spawnSync("node", [hookPath], {
      input: "not json",
      encoding: "utf8",
    });
    expect(result.status ?? 1).toBe(0);
  });

  it("allows a payload with no command", () => {
    expect(runHook({ tool_name: "Bash", tool_input: {} }).status).toBe(0);
  });
});
