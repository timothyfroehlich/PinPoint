// Unit tests for .claude/hooks/ui-screenshot-reminder.cjs — the PostToolUse
// (Bash) hook that nudges toward posting screenshots after a UI-touching
// `git commit` (PP-wi85). Non-blocking: always exits 0.
//
// Builds a scratch git repo per test with a fake `origin/main` ref (via
// `update-ref`, no real remote needed) so `git diff --name-only
// origin/main...HEAD` resolves deterministically.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/ui-screenshot-reminder.cjs"
);

const tmpDirs: string[] = [];

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-screenshot-hook-"));
  tmpDirs.push(dir);
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" });

  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");

  fs.writeFileSync(path.join(dir, "README.md"), "base\n");
  git("add", "README.md");
  git("commit", "-q", "-m", "base");
  const baseSha = git("rev-parse", "HEAD").trim();
  git("update-ref", "refs/remotes/origin/main", baseSha);

  git("checkout", "-q", "-b", "feature");
  return dir;
}

function commitFile(dir: string, relPath: string, contents = "x\n"): void {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  execFileSync("git", ["add", relPath], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", `add ${relPath}`], { cwd: dir });
}

function runHook(
  cwd: string,
  command = "git commit -m 'test'"
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command },
      cwd,
    }),
    encoding: "utf8",
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("ui-screenshot-reminder.cjs", () => {
  it("reminds when a commit touches src/components", () => {
    const dir = makeRepo();
    commitFile(dir, "src/components/Foo.tsx", "export const Foo = 1;\n");
    const { status, stderr } = runHook(dir);
    expect(status).toBe(0);
    expect(stderr).toContain("UI-touching change");
    expect(stderr).toContain("pr-screenshots.mjs");
  });

  it("reminds when a commit touches a src/app tsx page", () => {
    const dir = makeRepo();
    commitFile(
      dir,
      "src/app/dashboard/page.tsx",
      "export default function P(){}\n"
    );
    const { status, stderr } = runHook(dir);
    expect(status).toBe(0);
    expect(stderr).toContain("UI-touching change");
  });

  it("reminds when a commit touches a css file", () => {
    const dir = makeRepo();
    commitFile(dir, "src/app/globals.css", "body{}\n");
    const { status, stderr } = runHook(dir);
    expect(status).toBe(0);
    expect(stderr).toContain("UI-touching change");
  });

  it("stays silent for a non-UI commit", () => {
    const dir = makeRepo();
    commitFile(dir, "scripts/workflow/foo.sh", "#!/usr/bin/env bash\n");
    const { status, stderr } = runHook(dir);
    expect(status).toBe(0);
    expect(stderr).toBe("");
  });

  it("stays silent for a non-commit Bash command", () => {
    const dir = makeRepo();
    commitFile(dir, "src/components/Foo.tsx", "export const Foo = 1;\n");
    const { status, stderr } = runHook(dir, "git status");
    expect(status).toBe(0);
    expect(stderr).toBe("");
  });

  it("fails open when origin/main is unavailable", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-screenshot-hook-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    execFileSync("git", ["config", "user.email", "test@example.com"], {
      cwd: dir,
    });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
    fs.writeFileSync(path.join(dir, "README.md"), "base\n");
    execFileSync("git", ["add", "README.md"], { cwd: dir });
    execFileSync("git", ["commit", "-q", "-m", "base"], { cwd: dir });
    // No origin/main ref created — the hook must not throw/exit non-zero.
    const { status, stderr } = runHook(dir);
    expect(status).toBe(0);
    expect(stderr).toBe("");
  });

  it("stays silent for malformed JSON on stdin", () => {
    const result = spawnSync("node", [hookPath], {
      input: "{not json",
      encoding: "utf8",
    });
    expect(result.status ?? 1).toBe(0);
  });
});
