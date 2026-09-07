#!/usr/bin/env node
/**
 * Cross-harness PreToolUse guard for PinPoint PR lifecycle waits.
 *
 * Parent agents delegate passive CI/review waits to the project-scoped
 * `pr-lifecycle-watcher`. The watcher calls the MCP server, and that server
 * starts pr-watch.py without issuing another harness shell-tool call, so this
 * guard does not interfere with the delegated path.
 *
 * Direct readiness snapshots (`--check-ready`) and help remain available to
 * capable owners. Ambiguous commands fail open: this is an efficiency and
 * lifecycle-ownership boundary, not an irreversible safety boundary.
 */

"use strict";

const path = require("node:path");
const { resolveCommand } = require("./lib/resolve-command.cjs");

const DIAGNOSTIC_FLAGS = new Set(["--check-ready", "--help", "-h"]);
const BLOCK_REASON =
  "Blocked direct PR lifecycle wait. Invoke the project-scoped named agent " +
  "`pr-lifecycle-watcher` with exactly: worktree, pr, title, phase, and " +
  "expected_head. If named-agent discovery is unavailable, report that as " +
  "a blocker instead of running pr-watch.py in the parent agent.";

function watcherArgsForInvocation(name, args) {
  if (name === "pr-watch.py") return args;

  if (!/^python(?:3(?:\.\d+)?)?$/.test(name)) return null;
  const scriptIndex = args.findIndex(
    (arg) => path.posix.basename(arg) === "pr-watch.py",
  );
  return scriptIndex === -1 ? null : args.slice(scriptIndex + 1);
}

function watcherArgs(segment) {
  const direct = watcherArgsForInvocation(segment.name, segment.args);
  if (direct !== null) return direct;

  let nested;
  if (segment.name === "mise" && segment.args[0] === "exec") {
    const separatorIndex = segment.args.indexOf("--");
    if (separatorIndex !== -1) nested = segment.args.slice(separatorIndex + 1);
  } else if (segment.name === "uv" && segment.args[0] === "run") {
    nested = segment.args.slice(1);
  }

  if (!nested || nested.length === 0) return null;
  return watcherArgsForInvocation(path.posix.basename(nested[0]), nested.slice(1));
}

/** Return whether a shell command starts a direct long-running PR watch. */
function classifyCommand(command) {
  const { segments } = resolveCommand(String(command || ""));

  for (const segment of segments) {
    const args = watcherArgs(segment);
    if (args === null) continue;
    if (args.some((arg) => DIAGNOSTIC_FLAGS.has(arg))) continue;

    const phaseArg = args.find(
      (arg, index) =>
        arg === "--phase" ||
        arg.startsWith("--phase=") ||
        (index > 0 && args[index - 1] === "--phase"),
    );
    return {
      block: true,
      detail: phaseArg ? "delegated CI/review wait" : "legacy PR watch",
    };
  }

  return { block: false, detail: "" };
}

function commandFromPayload(payload) {
  const toolInput = payload?.tool_input;
  if (toolInput && typeof toolInput === "object") {
    for (const key of ["command", "cmd", "CommandLine"]) {
      if (typeof toolInput[key] === "string") return toolInput[key];
    }
  }

  const antigravityArgs = payload?.toolCall?.args;
  if (antigravityArgs && typeof antigravityArgs === "object") {
    for (const key of ["CommandLine", "command", "cmd"]) {
      if (typeof antigravityArgs[key] === "string") {
        return antigravityArgs[key];
      }
    }
  }

  return "";
}

module.exports = { classifyCommand, commandFromPayload };

if (require.main === module) {
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    const { block, detail } = classifyCommand(commandFromPayload(payload));
    if (!block) process.exit(0);

    const reason = BLOCK_REASON.replace("lifecycle wait", detail);
    if (payload?.toolCall) {
      process.stdout.write(`${JSON.stringify({ decision: "deny", reason })}\n`);
      process.exit(0);
    }

    process.stderr.write(`${reason}\n`);
    process.exit(2);
  });
}
