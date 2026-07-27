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
 * Matched commands (each shell segment's RESOLVED command must be the runner —
 * a command that merely mentions one of these in an argument, or names one on a
 * line inside a heredoc body, does NOT match):
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

// --- Pure classifier (unit-testable without spawning anything) ---------------
// Decide whether a shell command string actually INVOKES one of the heavy
// runners above. Mirrors the technique in block-main-worktree-branch-switch.cjs
// (`classifyCommand`): resolve each segment's effective command instead of
// regex-testing the raw string.
//
// The old implementation ran the heavy regexes against the whole command, so
// any command whose TEXT named a heavy runner — `echo "how to run pnpm run
// build"`, `bd comments add "…ran pnpm run smoke…"`, `rg "playwright test"
// docs/`, `git commit -m "speed up vitest run"` — fired a memory probe that can
// poll for up to five minutes. False positives are the cost that matters here:
// the threat model is a well-meaning agent, not an attacker evading a filter,
// so this deliberately does NOT try to be evasion-resistant.

// `pnpm run <script>` is heavy for exactly these scripts. Anchored + \b so
// `build` matches `build` (and today's `e2e:full`-style suffixes) but NOT
// `buildx`. Same set as before this hook grew a classifier.
const HEAVY_PNPM_SCRIPT =
  /^(test:integration|test:integration:supabase|build|smoke|e2e)\b/;

// Direct binaries: heavy only in their run/test subcommand form.
// `vitest --version` and `playwright install` are NOT heavy.
const HEAVY_BINARIES = new Map([
  ["vitest", "run"],
  ["playwright", "test"],
]);

// Package runners we step THROUGH to find the real command
// (`pnpm exec playwright test` → `playwright test`).
const PACKAGE_RUNNERS = new Set([
  "pnpm",
  "pnpx",
  "npm",
  "npx",
  "yarn",
  "bun",
  "bunx",
]);
// Runner subcommands that hand the command slot to the next token.
const RUNNER_EXEC_SUBCOMMANDS = new Set(["exec", "dlx", "x"]);
// Runner subcommands that take a package.json SCRIPT name, not a binary.
const RUNNER_RUN_SUBCOMMANDS = new Set(["run", "run-script"]);

// Leading tokens that do not consume the command slot themselves.
const WRAPPERS = new Set(["sudo", "env", "command", "time", "nice"]);
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*[+:]?=/;

/** Strip one pair of surrounding matching quotes: `"build"` → `build`. */
function unquote(token) {
  const t = String(token || "");
  return (t.startsWith('"') && t.endsWith('"') && t.length > 1) ||
    (t.startsWith("'") && t.endsWith("'") && t.length > 1)
    ? t.slice(1, -1)
    : t;
}

/**
 * Is this ONE segment a heavy invocation?
 *
 * Resolves the segment's effective command by skipping leading env assignments
 * (VAR=value) and leading wrappers (sudo/env/command/time/nice), comparing on
 * BASENAME so `./node_modules/.bin/playwright test` and
 * `/usr/local/bin/pnpm run build` resolve correctly, then stepping through any
 * package runner + subcommand so the effective argv becomes e.g.
 * `playwright test`.
 */
function isHeavySegment(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean);

  let cmdIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (ENV_ASSIGN.test(t)) continue; // skip VAR=value
    if (WRAPPERS.has(t)) continue; // skip wrapper command itself
    cmdIdx = i;
    break;
  }
  if (cmdIdx === -1) return false;

  // Walk package runners. The hop cap just bounds pathological input; two hops
  // covers every real shape (`pnpm exec playwright test`, `npx -y vitest run`).
  let argv = tokens.slice(cmdIdx);
  for (let hops = 0; hops < 3; hops++) {
    const name = path.basename(unquote(argv[0]));

    if (!PACKAGE_RUNNERS.has(name)) {
      // Resolved to a real binary — heavy only in its run/test form.
      const expected = HEAVY_BINARIES.get(name);
      return expected !== undefined && unquote(argv[1] || "") === expected;
    }

    // Skip the runner's own flags (`npx -y …`, `pnpm --silent …`) to find its
    // subcommand. A flag that takes a separate value (`pnpm -C dir run build`)
    // simply resolves to something we don't recognise → not heavy. Fine: a
    // missed exotic invocation is cheaper than a false positive.
    let i = 1;
    while (i < argv.length && argv[i].startsWith("-")) i++;
    const sub = unquote(argv[i] || "");
    if (!sub) return false;

    if (RUNNER_RUN_SUBCOMMANDS.has(sub)) {
      // `pnpm run <script>` — heaviness is decided by the script name.
      return HEAVY_PNPM_SCRIPT.test(unquote(argv[i + 1] || ""));
    }
    // `pnpm exec <cmd>` / `pnpm dlx <cmd>` consume one more token;
    // `npx <cmd>` / `yarn <cmd>` put the command right there.
    argv = argv.slice(RUNNER_EXEC_SUBCOMMANDS.has(sub) ? i + 1 : i);
    if (argv.length === 0) return false;
  }
  return false;
}

/**
 * Does this command string invoke a heavy runner in ANY of its segments?
 * Split on shell separators: && || ; | — deliberately NOT on newlines.
 *
 * Newlines are excluded on purpose (PP-qota). We have no shell parser, so
 * splitting on them made the classifier descend into heredoc bodies and
 * multi-line quoted arguments: any LINE beginning with a heavy invocation
 * became its own "segment" and fired a memory probe that can poll for five
 * minutes. `cat <<EOF > notes.md` / `pnpm run build` / `EOF` is a `cat`, and
 * `bd comments add PP-x "…\npnpm run e2e\n…"` is a `bd`.
 *
 * Accepted cost: a genuine multi-line sequence —
 *   cd foo
 *   pnpm run build
 * — is no longer gated (false negative). That is the right trade under the
 * same principle documented above at the runner-flag walk: a missed exotic
 * invocation is cheaper than a false positive. Agents overwhelmingly write
 * that shape as `cd foo && pnpm run build`, which still gates.
 */
function isHeavyCommand(command) {
  const segments = String(command || "").split(/&&|\|\||;|\|/);
  return segments.some((raw) => {
    const segment = raw.trim();
    return segment !== "" && isHeavySegment(segment);
  });
}

module.exports = { isHeavyCommand };

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

  // Check whether the command actually invokes a heavy runner
  if (!isHeavyCommand(command)) {
    process.exit(0);
  }

  // Honor an INLINE override: `FORCE_MEM_PRECHECK=skip pnpm run build`.
  // The shell only exports that var into the child process when the command
  // runs — it is NOT in this hook's own process.env. Without this check the
  // hook would run the precheck and could deny a command the user explicitly
  // told us to skip. Allow immediately when the inline override is present.
  if (/(^|\s)FORCE_MEM_PRECHECK=skip(\s|$)/.test(command)) {
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

// --- Hook entrypoint ---------------------------------------------------------
// Only run as a hook when invoked directly (not when require()'d by a test).
if (require.main === module) {
  main().catch(() => process.exit(0));
}
