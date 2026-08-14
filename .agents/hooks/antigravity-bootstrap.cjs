#!/usr/bin/env node
//
// antigravity-bootstrap.cjs — Antigravity bootstrap shim for the
// harness-agnostic beads + huddle hook scripts.
//
// Antigravity's PreInvocation hook payload uses different field names than
// the shape `~/.claude/hooks/huddle/huddle-*.sh` expect (which originated in Claude
// Code's hook contract). This shim:
//   1. Reads Antigravity's JSON payload (conversationId, workspacePaths,
//      initialNumSteps, …).
//   2. Translates it into the harness-neutral payload shape the huddle
//      scripts read (session_id, transcript_path, cwd, hook_event_name,
//      source).
//   3. At session start (initialNumSteps === 0): runs `bd prime` for beads
//      task context, then runs huddle-session-start.sh for identity
//      announcement.
//   4. Mid-trajectory: runs huddle-poll.sh for new PP-cvh comments.
// All output is wrapped in Antigravity's `{ injectSteps: [...] }` response
// shape and written to stdout.

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// The huddle scripts live in Tim's dotfiles (~/.claude/hooks/huddle/), not in
// this repo, so they are no longer guaranteed to be next to this shim. On a
// checkout without the dotfiles stowed, calling one throws ENOENT and writes a
// stderr line on EVERY turn. Resolve to null instead, and let the caller skip.
function huddleScript(name) {
  // os.homedir() is "" when HOME is unset and the user has no passwd home
  // entry (a hardened container). path.join would then yield a RELATIVE
  // `.claude/hooks/huddle/<name>`, probed against the workspace repo — so an
  // in-repo copy would be run as if it were the dotfiles one.
  const home = os.homedir();
  if (!home) return null;
  const scriptPath = path.join(home, ".claude/hooks/huddle", name);
  try {
    return fs.existsSync(scriptPath) ? scriptPath : null;
  } catch {
    return null;
  }
}

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
  } catch (err) {
    process.exit(0);
  }

  const conversationId = input.conversationId || "";
  const invocationNum = input.invocationNum || 1;
  const initialNumSteps =
    typeof input.initialNumSteps === "number" ? input.initialNumSteps : 0;
  // Antigravity seeds the trajectory with at least 1 system step before the
  // first model invocation, so initialNumSteps is 1 (not 0) on the genuine
  // first turn of a fresh conversation. Treat <= 1 as session-start.
  const isSessionStart = initialNumSteps <= 1;
  const workspacePath = input.workspacePaths?.[0] || process.cwd();

  // Translate Antigravity's payload into the harness-neutral shape the
  // huddle scripts expect (originally defined by Claude Code's hook contract,
  // now the de-facto shared contract for all harnesses routing through these
  // scripts).
  const hookPayload = {
    session_id: conversationId,
    // Synthesize a transcript path that won't trip subagent-detection rules
    // (which skip if the path contains `/subagents/`). Antigravity doesn't
    // write transcripts to disk the way Claude Code does, so this is purely
    // synthetic for the contract.
    transcript_path: path.join(workspacePath, `${conversationId}.jsonl`),
    cwd: workspacePath,
    hook_event_name: isSessionStart ? "SessionStart" : "UserPromptSubmit",
    source: "startup",
  };

  const payloadString = JSON.stringify(hookPayload);

  if (isSessionStart) {
    let combinedOutput = "";

    // 1. Run bd prime to get task list and guidelines
    try {
      const beadsOutput = execFileSync("bd", ["prime"], {
        cwd: workspacePath,
        encoding: "utf8",
      }).trim();
      if (beadsOutput) {
        combinedOutput += beadsOutput + "\n\n";
      }
    } catch (err) {
      process.stderr.write(
        `[antigravity-bootstrap] Error running bd prime: ${err.message}\n`
      );
    }

    // 2. Run huddle-session-start.sh to announce session identity
    const huddleStartScript = huddleScript("huddle-session-start.sh");
    if (huddleStartScript) {
      try {
        const huddleOutput = execFileSync("bash", [huddleStartScript], {
          input: payloadString,
          cwd: workspacePath,
          encoding: "utf8",
        }).trim();
        if (huddleOutput) {
          combinedOutput += huddleOutput;
        }
      } catch (err) {
        process.stderr.write(
          `[antigravity-bootstrap] Error running huddle-session-start.sh: ${err.message}\n`
        );
      }
    }

    if (combinedOutput.trim()) {
      const response = {
        injectSteps: [
          {
            userMessage: combinedOutput.trim(),
          },
        ],
      };
      process.stdout.write(JSON.stringify(response));
    } else {
      process.stdout.write(JSON.stringify({ injectSteps: [] }));
    }
  } else {
    // Mid-trajectory: run huddle-poll.sh to fetch updates
    const huddlePollScript = huddleScript("huddle-poll.sh");
    if (!huddlePollScript) {
      process.stdout.write(JSON.stringify({ injectSteps: [] }));
      return;
    }
    try {
      const huddleOutput = execFileSync("bash", [huddlePollScript], {
        input: payloadString,
        cwd: workspacePath,
        encoding: "utf8",
      }).trim();

      if (huddleOutput) {
        const response = {
          injectSteps: [
            {
              userMessage: huddleOutput,
            },
          ],
        };
        process.stdout.write(JSON.stringify(response));
      } else {
        process.stdout.write(JSON.stringify({ injectSteps: [] }));
      }
    } catch (err) {
      process.stderr.write(
        `[antigravity-bootstrap] Error running huddle-poll.sh: ${err.message}\n`
      );
      process.stdout.write(JSON.stringify({ injectSteps: [] }));
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[antigravity-bootstrap] Hook error: ${err.message}\n`);
  process.exit(0);
});
