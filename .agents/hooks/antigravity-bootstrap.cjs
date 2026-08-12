#!/usr/bin/env node
//
// antigravity-bootstrap.cjs — Antigravity bootstrap shim for beads.
//
// At session start (initialNumSteps <= 1) it runs `bd prime` for beads task
// context and injects the result via Antigravity's `{ injectSteps: [...] }`
// response shape. Mid-trajectory it injects nothing.
//
// NO HUDDLE. This shim used to run huddle-session-start.sh at session start and
// inject huddle-poll.sh output as a mid-trajectory user message. Both were
// removed: Antigravity's role in this repo is code review, and a reviewer that
// is told to register a session identity does exactly that — a `gemini-3.1-pro-high`
// review run reached for `bash scripts/hooks/huddle-bootstrap.sh` mid-review,
// correctly following the instruction it had been handed. Coordination chatter
// injected into a review is noise at best and a distraction from the diff at
// worst, and an agy review is dispatched by a Claude session that is already in
// the huddle on its behalf. (PP-c6xz.)

const { execFileSync } = require("child_process");

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

  const initialNumSteps =
    typeof input.initialNumSteps === "number" ? input.initialNumSteps : 0;
  // Antigravity seeds the trajectory with at least 1 system step before the
  // first model invocation, so initialNumSteps is 1 (not 0) on the genuine
  // first turn of a fresh conversation. Treat <= 1 as session-start.
  const isSessionStart = initialNumSteps <= 1;
  const workspacePath = input.workspacePaths?.[0] || process.cwd();

  if (!isSessionStart) {
    process.stdout.write(JSON.stringify({ injectSteps: [] }));
    return;
  }

  let beadsOutput = "";
  try {
    beadsOutput = execFileSync("bd", ["prime"], {
      cwd: workspacePath,
      encoding: "utf8",
    }).trim();
  } catch (err) {
    process.stderr.write(
      `[antigravity-bootstrap] Error running bd prime: ${err.message}\n`
    );
  }

  process.stdout.write(
    JSON.stringify(
      beadsOutput
        ? { injectSteps: [{ userMessage: beadsOutput }] }
        : { injectSteps: [] }
    )
  );
}

main().catch((err) => {
  process.stderr.write(`[antigravity-bootstrap] Hook error: ${err.message}\n`);
  process.exit(0);
});
