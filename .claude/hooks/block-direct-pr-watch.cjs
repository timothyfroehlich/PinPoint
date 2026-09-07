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
const UV_RUN_VALUE_FLAGS = new Set([
  "--config-file",
  "--directory",
  "--env-file",
  "--index",
  "--project",
  "--python",
  "--with",
  "--with-editable",
  "--with-requirements",
]);
const MAX_WRAPPER_DEPTH = 5;
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

function uvRunCommand(args) {
  for (let index = 1; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") return args.slice(index + 1);
    if (!arg.startsWith("-")) return args.slice(index);
    if (!arg.includes("=") && UV_RUN_VALUE_FLAGS.has(arg)) index++;
  }
  return [];
}

function watcherArgsForTokens(tokens, depth = 0) {
  if (tokens.length === 0 || depth >= MAX_WRAPPER_DEPTH) return null;

  const name = path.posix.basename(tokens[0]);
  const args = tokens.slice(1);
  const direct = watcherArgsForInvocation(name, args);
  if (direct !== null) return direct;

  let nested;
  if (name === "mise" && ["exec", "x"].includes(args[0])) {
    const separatorIndex = args.indexOf("--");
    if (separatorIndex !== -1) nested = args.slice(separatorIndex + 1);
  } else if (name === "uv" && args[0] === "run") {
    nested = uvRunCommand(args);
  }

  return nested ? watcherArgsForTokens(nested, depth + 1) : null;
}

function watcherArgs(segment) {
  return watcherArgsForTokens([segment.command, ...segment.args]);
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
