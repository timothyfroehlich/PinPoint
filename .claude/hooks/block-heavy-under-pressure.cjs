#!/usr/bin/env node
/**
 * PreToolUse hook: block heavy commands when the host is under critical memory pressure.
 *
 * Intercepts agent-issued commands that match the heavy-run pattern and runs
 * scripts/guard/mem-precheck.sh. If the precheck exits non-zero (HARD-BLOCK
 * zone), the tool call is denied with a clear message and the override hint.
 *
 * FAIL-OPEN: any error during the precheck (exec failure, parse error,
 * unexpected exception) allows the command through. This hook must never
 * wedge a session due to its own malfunction.
 *
 * Honors FORCE_MEM_PRECHECK=skip (passed through to the shell script).
 * Passes through immediately in CI ($CI is set).
 *
 * Matched commands (substring search against the full command string):
 *   pnpm run test:integration
 *   pnpm run test:integration:supabase
 *   pnpm run build
 *   pnpm run smoke
 *   pnpm run e2e
 *   vitest run
 *   playwright test
 */

"use strict";

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const HEAVY_PATTERNS = [
  /pnpm\s+run\s+(test:integration|test:integration:supabase|build|smoke|e2e)\b/,
  /\bvitest\s+run\b/,
  /\bplaywright\s+test\b/,
];

async function main() {
  let inputData = "";
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  if (!inputData.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(inputData);
  } catch {
    // Fail-open on parse error
    process.exit(0);
  }

  const command = input.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  // Only intercept Bash tool calls
  if (input.tool_name !== "Bash") {
    process.exit(0);
  }

  // Fail-open if $CI is set — runners have their own isolation
  if (process.env.CI) {
    process.exit(0);
  }

  // Check if the command matches any heavy pattern
  const isHeavy = HEAVY_PATTERNS.some((re) => re.test(command));
  if (!isHeavy) {
    process.exit(0);
  }

  // Locate the precheck script relative to the hook's own location.
  // Hook lives at .claude/hooks/; script is at scripts/guard/mem-precheck.sh.
  // We resolve from CLAUDE_PROJECT_DIR if available (set by Claude Code), then
  // try __dirname-relative (two levels up), then cwd.
  const candidates = [
    process.env.CLAUDE_PROJECT_DIR &&
      path.join(
        process.env.CLAUDE_PROJECT_DIR,
        "scripts",
        "guard",
        "mem-precheck.sh",
      ),
    path.join(__dirname, "..", "..", "scripts", "guard", "mem-precheck.sh"),
    path.join(process.cwd(), "scripts", "guard", "mem-precheck.sh"),
  ].filter(Boolean);

  const precheckPath = candidates.find((p) => fs.existsSync(p));
  if (!precheckPath) {
    // Fail-open: script not found (e.g., not yet deployed)
    process.exit(0);
  }

  try {
    const env = { ...process.env };
    // Propagate FORCE_MEM_PRECHECK if set in the agent's environment
    execFileSync("bash", [precheckPath], {
      env,
      stdio: ["ignore", "ignore", "pipe"], // capture stderr
      timeout: 330_000, // 5 min poll + 30 s buffer
    });
    // Precheck passed — allow
    process.exit(0);
  } catch (err) {
    // exit code 1 from precheck → HARD-BLOCK
    if (err.status === 1) {
      const stderr = err.stderr?.toString("utf8") ?? "";
      // Extract a compact reason from the precheck's stderr output
      const lines = stderr.split("\n").filter((l) => l.trim().length > 0);
      const summary = lines.slice(-6).join("\n");

      const decision = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            `Memory pressure gate blocked this command.\n\n${summary}\n\n` +
            `Override (one run): set FORCE_MEM_PRECHECK=skip in your command, e.g.:\n` +
            `  FORCE_MEM_PRECHECK=skip ${command.trim().split("\n")[0]}`,
        },
      };
      process.stdout.write(JSON.stringify(decision));
      process.exit(0);
    }

    // Any other failure (SIGTERM, timeout, exec error) → fail-open
    process.exit(0);
  }
}

main().catch(() => process.exit(0));
