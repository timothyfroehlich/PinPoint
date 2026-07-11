#!/usr/bin/env node
/**
 * PreToolUse hook: attribute agent-initiated `bd` (beads) writes to the agent.
 *
 * `bd` stamps every write with an actor resolved as:
 *   --actor flag > $BEADS_ACTOR > git config user.name > $USER
 * On this machine BEADS_ACTOR is unset, so agent `bd` writes fall through to
 * git user.name = "Tim Froehlich" — indistinguishable from Tim's own writes.
 *
 * Key insight: this hook ONLY ever fires for agent-initiated Bash tool calls.
 * Tim's own terminal `bd` commands never pass through a Claude Code PreToolUse
 * hook. So every command seen here is agent-initiated and should be attributed
 * to an agent (its huddle identity, e.g. `Claude-DevxReview`) — never to Tim.
 *
 * We resolve the agent's huddle name from the shared session-names.json map
 * (keyed by session_id) and prepend `export BEADS_ACTOR="<name>";` so the
 * attribution covers compound/piped commands (a bare `BEADS_ACTOR=x bd …`
 * prefix would only apply to the first segment of `bd … && …`).
 *
 * Fail-open: any error → let the command through unmodified. NEVER block or
 * fail a bd command because of this hook.
 *
 * Note: normalize-workspace-paths.cjs is the only other hook that returns
 * updatedInput. In practice bd commands don't carry absolute workspace paths,
 * so the two never rewrite the same command; both operate on the original
 * input.tool_input.command and don't depend on chaining between them.
 */

const fs = require("fs");
const path = require("path");

// Resolve the agent's huddle name from <main-worktree>/.agents/huddle/session-names.json.
// Mirrors huddle_state_dir() in scripts/hooks/huddle-lib.sh. Fail-open: on ANY
// error or a missing/invalid name, return the literal "Claude" — never unset,
// never "Tim Froehlich".
function resolveActor(sessionId, cwd) {
  const fallback = "Claude";
  try {
    const { execSync } = require("child_process");
    const commonDir = execSync("git rev-parse --git-common-dir", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!commonDir) {
      return fallback;
    }
    const absCommon = path.isAbsolute(commonDir)
      ? commonDir
      : path.resolve(cwd, commonDir);
    const mainRoot = path.dirname(absCommon);
    const namesFile = path.join(
      mainRoot,
      ".agents",
      "huddle",
      "session-names.json"
    );
    const map = JSON.parse(fs.readFileSync(namesFile, "utf8"));
    const name = map[sessionId];
    // Huddle names are already constrained to this charset by huddle-whoami.sh;
    // re-validate defensively before injecting into a shell command.
    if (typeof name === "string" && /^[A-Za-z0-9_-]+$/.test(name)) {
      return name;
    }
    return fallback;
  } catch {
    return fallback;
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
  } catch {
    process.exit(0);
  }

  const command = input.tool_input?.command;
  if (!command) {
    process.exit(0);
  }

  // Fire only when `bd` is invoked as a command word: at the start of the
  // command or immediately after a shell command separator (newline, ;, &&,
  // ||, |, or `(`), followed by a word boundary.
  if (!/(?:^|\n|;|&&|\|\||\||\()\s*bd\b/.test(command)) {
    process.exit(0);
  }

  // Respect explicit attribution — if the command already sets BEADS_ACTOR or
  // passes --actor, don't double-set.
  if (/BEADS_ACTOR=/.test(command) || /--actor(?:[=\s]|$)/.test(command)) {
    process.exit(0);
  }

  const cwd = input.cwd || process.cwd();
  const name = resolveActor(input.session_id, cwd);

  // Prepend an export so attribution covers compound/piped commands.
  const modified = `export BEADS_ACTOR="${name}"; ${command}`;

  // Emit permissionDecision: "allow" alongside updatedInput. A PreToolUse
  // updatedInput is only applied when it rides on a permission result, and a
  // hook produces a permission result ONLY when it emits a permissionDecision
  // (verified against bundled Claude Code v2.1.201) — so we MUST return "allow"
  // for the command rewrite to take effect. This matches the
  // normalize-workspace-paths.cjs precedent. Tradeoff: "allow" auto-approves
  // the matched bd command; that is consistent with normalize-workspace-paths,
  // and the block-* deny hooks still fire (deny > allow), so no safety
  // regression.
  const decision = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: `Injected BEADS_ACTOR="${name}" so this agent's bd writes are attributed to it, not to Tim.`,
      updatedInput: { ...input.tool_input, command: modified },
    },
  };
  process.stdout.write(JSON.stringify(decision));
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(
    `[inject-beads-actor] Hook error: ${err?.message ?? err}\n`
  );
  process.exit(0);
});
