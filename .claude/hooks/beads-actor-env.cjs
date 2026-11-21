#!/usr/bin/env node
/**
 * SessionStart hook: attribute agent-initiated `bd` (beads) writes to the agent.
 *
 * `bd` stamps every write with an actor resolved as:
 *   --actor flag > $BEADS_ACTOR > git config user.name > $USER
 * On this machine BEADS_ACTOR is unset, so agent `bd` writes would fall through
 * to git user.name = "Tim Froehlich", indistinguishable from Tim's own writes.
 *
 * This hook appends a `bd` shell function to $CLAUDE_ENV_FILE. Claude Code runs
 * that file as shell code before every Bash command, so the function wraps each
 * `bd` call the agent makes, including ones inside compound or piped commands.
 * Tim's own terminal never sources the file.
 *
 * Why not a PreToolUse rewrite: the previous hook (inject-beads-actor.cjs)
 * returned `updatedInput` on every `bd` command. A hook that changes a call's
 * input after auto mode reviewed it leaves auto mode unable to vouch for that
 * call or any call sent alongside it, so those fell back to permission prompts.
 *
 * The function resolves the huddle name lazily, at each `bd` call, through the
 * global huddle-whoami interface keyed by session id. The identity may not be
 * registered yet when SessionStart runs, so resolving here would be too early.
 *
 * SessionStart fires again on resume, clear, compact and fork. The append is
 * guarded by a per-session marker line, so each session id is written once.
 * The lookup is capped at 3 seconds where `timeout` exists, as the old hook was.
 *
 * Fail-open: any error leaves the env file untouched, and the function falls
 * back to the literal "Claude", never to Tim's name. Never blocks a session.
 */

const fs = require("fs");

const MARKER = "# pinpoint-beads-actor";
const SAFE = /^[A-Za-z0-9_-]+$/;

function functionText(sessionId) {
  return [
    `${MARKER} (session ${sessionId})`,
    "bd() {",
    "  local pinpoint_actor",
    "  if command -v timeout >/dev/null 2>&1; then",
    `    pinpoint_actor=$(timeout 3 bash "$HOME/Code/huddle/lib/huddle-whoami.sh" whoami "${sessionId}" 2>/dev/null)`,
    "  else",
    `    pinpoint_actor=$(bash "$HOME/Code/huddle/lib/huddle-whoami.sh" whoami "${sessionId}" 2>/dev/null)`,
    "  fi",
    '  case "$pinpoint_actor" in',
    "    ''|*[!A-Za-z0-9_-]*) pinpoint_actor=Claude ;;",
    "  esac",
    '  BEADS_ACTOR="${BEADS_ACTOR:-$pinpoint_actor}" command bd "$@"',
    "}",
    "",
  ].join("\n");
}

async function main() {
  let inputData = "";
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  const envFile = process.env.CLAUDE_ENV_FILE;
  if (!envFile) {
    process.exit(0);
  }

  let input = {};
  try {
    input = JSON.parse(inputData || "{}");
  } catch {
    process.exit(0);
  }

  const sessionId = input.session_id;
  // The id is baked into shell code, so accept only a strict charset.
  if (typeof sessionId !== "string" || !SAFE.test(sessionId)) {
    process.exit(0);
  }

  let existing = "";
  try {
    existing = fs.readFileSync(envFile, "utf8");
  } catch {
    // A missing file is fine; appendFileSync creates it.
  }
  // Skip only when this session's block is already there. A clear or fork can
  // reuse the env file under a new session id; the new block is appended after
  // the old one, and the later `bd` definition wins when the file is sourced.
  if (existing.includes(`${MARKER} (session ${sessionId})`)) {
    process.exit(0);
  }

  const prefix = existing === "" || existing.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(envFile, prefix + functionText(sessionId));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`[beads-actor-env] Hook error: ${err?.message ?? err}\n`);
  process.exit(0);
});
