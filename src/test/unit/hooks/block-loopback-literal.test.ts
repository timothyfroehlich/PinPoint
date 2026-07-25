// Unit tests for .claude/hooks/block-loopback-literal.cjs — the PreToolUse hook
// that blocks writing a bare 127.0.0.1 into browser-facing config (CORE-SEC-008).
//
// Browsers scope cookies by host STRING, so mixing `localhost` and `127.0.0.1`
// across config breaks Supabase SSR auth in a way that presents as a random
// logout.
//
// The scope is deliberately narrow — config files only. The repo has legitimate
// occurrences in scripts (`url.hostname === "localhost" || url.hostname ===
// "127.0.0.1"` as a safety check) and docs (Dolt server loopback binding) that a
// content match cannot distinguish from violations. Those must stay allowed.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hookPath = path.resolve(
  process.cwd(),
  ".claude/hooks/block-loopback-literal.cjs"
);

function runHook(payload: unknown): { status: number; stderr: string } {
  const result = spawnSync("node", [hookPath], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stderr: result.stderr ?? "" };
}

function write(file_path: string, content: string): unknown {
  return { tool_name: "Write", tool_input: { file_path, content } };
}

function edit(file_path: string, new_string: string): unknown {
  return { tool_name: "Edit", tool_input: { file_path, new_string } };
}

describe("block-loopback-literal.cjs — in-scope config files", () => {
  it.each([
    ["supabase/config.toml", 'api_url = "http://127.0.0.1"'],
    ["supabase/config.toml.template", 'site_url = "http://127.0.0.1:3000"'],
    [".env", "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321"],
    [".env.local", "POSTGRES_URL=postgresql://x@127.0.0.1:54322/postgres"],
    // All three real config filenames — the variant segment follows `.config`.
    ["playwright.config.ts", 'const host = "127.0.0.1";'],
    ["playwright.config.smoke.ts", 'baseURL: "http://127.0.0.1:3000"'],
    ["playwright.config.full.ts", 'baseURL: "http://127.0.0.1:3000"'],
  ])("blocks a Write to %s", (file, content) => {
    const { status, stderr } = runHook(write(file, content));
    expect(status).toBe(2);
    expect(stderr).toContain("CORE-SEC-008");
    expect(stderr).toContain("localhost");
  });

  it("blocks an Edit that introduces the literal", () => {
    const { status } = runHook(
      edit("supabase/config.toml", 'api_url = "http://127.0.0.1"')
    );
    expect(status).toBe(2);
  });

  it("allows the same files when they use localhost", () => {
    expect(
      runHook(write("supabase/config.toml", 'api_url = "http://localhost"'))
        .status
    ).toBe(0);
    expect(
      runHook(write(".env.local", "PORT=3000\nHOST=localhost")).status
    ).toBe(0);
  });

  it("resolves scope from an absolute path", () => {
    const abs = path.resolve(process.cwd(), "supabase/config.toml");
    expect(runHook(write(abs, 'api_url = "http://127.0.0.1"')).status).toBe(2);
  });
});

describe("block-loopback-literal.cjs — out of scope, must stay allowed", () => {
  it.each([
    // Real occurrences in this repo today. Blocking these would be noise, and a
    // noisy hook gets bypassed.
    [
      "supabase/seed-timeline-backfill.mjs",
      'const ok = url.hostname === "localhost" || url.hostname === "127.0.0.1";',
    ],
    ["supabase/seed-timeline-demo.mjs", " * at a localhost/127.0.0.1 host."],
    ["scripts/beads-server/SETUP.md", "dolt sql-server --host 127.0.0.1"],
    ["docs/NON_NEGOTIABLES.md", "Never use 127.0.0.1 — use localhost."],
    ["src/lib/foo.ts", 'const LOOPBACK = "127.0.0.1";'],
  ])("allows %s", (file, content) => {
    expect(runHook(write(file, content)).status).toBe(0);
  });
});

describe("block-loopback-literal.cjs — literal matching", () => {
  it("does not match a longer address that merely starts with it", () => {
    expect(runHook(write(".env", "ALLOWED_HOST=127.0.0.10")).status).toBe(0);
  });

  it("does not match a digit-prefixed lookalike", () => {
    expect(runHook(write(".env", "WEIRD=8127.0.0.1")).status).toBe(0);
  });
});

describe("block-loopback-literal.cjs — fails open", () => {
  it("allows other tools", () => {
    const payload = {
      tool_name: "Bash",
      tool_input: { command: "echo 127.0.0.1 > .env" },
    };
    expect(runHook(payload).status).toBe(0);
  });

  it("allows a malformed payload", () => {
    const result = spawnSync("node", [hookPath], {
      input: "{{{",
      encoding: "utf8",
    });
    expect(result.status ?? 1).toBe(0);
  });

  it("allows a payload with no file_path", () => {
    expect(
      runHook({ tool_name: "Write", tool_input: { content: "127.0.0.1" } })
        .status
    ).toBe(0);
  });
});
