#!/usr/bin/env node
/**
 * PreToolUse hook: Rewrites unnecessary absolute workspace paths to relative.
 *
 * When an agent in a worktree runs a command with an absolute path like:
 *   bash /home/.../PinPoint/scripts/workflow/respond-to-copilot.sh 1039 ...
 *
 * This hook rewrites it to:
 *   bash scripts/workflow/respond-to-copilot.sh 1039 ...
 *
 * Why: The settings.json allowlist uses relative paths. Absolute paths don't
 * match, causing unnecessary permission prompts. This hook auto-fixes the
 * command and tells the agent to use relative paths next time.
 */

const fs = require("fs");
const path = require("path");

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

  const agentCwd = input.cwd || process.cwd();

  // Resolve worktree/repo root for path existence checks (handles subdirectory cwd)
  let repoRoot = agentCwd;
  try {
    const { execSync } = require("child_process");
    repoRoot =
      execSync("git rev-parse --show-toplevel", {
        cwd: agentCwd,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim() || agentCwd;
  } catch {
    // Not in a git repo — fall back to cwd
  }

  let modified = command;
  const rewrites = [];

  // Match absolute paths starting with known workspace roots.
  // Handles /home/.../PinPoint/foo and /home/.../pinpoint-worktrees/branch-name/foo
  const absPathRegex =
    /\/home\/froeht\/Code\/(?:PinPoint|pinpoint-worktrees\/[^\s/"']+)\/([\w./@{}-][^\s"']*)/g;

  let match;
  while ((match = absPathRegex.exec(command)) !== null) {
    const fullAbsPath = match[0];
    const relativePart = match[1];

    // Only rewrite if the file exists relative to the repo/worktree root
    const localPath = path.join(repoRoot, relativePart);
    if (fs.existsSync(localPath)) {
      modified = modified.replace(fullAbsPath, relativePart);
      rewrites.push(`  ${fullAbsPath} -> ${relativePart}`);
    }
  }

  if (rewrites.length > 0) {
    const reason =
      `Auto-fixed ${rewrites.length} absolute path(s) to relative:\n` +
      rewrites.join("\n") +
      "\nUse relative paths from the start — they match the settings.json allowlist.";

    const decision = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: reason,
        updatedInput: { ...input.tool_input, command: modified },
      },
    };
    process.stdout.write(JSON.stringify(decision));
    process.exit(0);
  }

  // No rewrites needed
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(
    `[normalize-workspace-paths] Hook error: ${err?.message ?? err}\n`
  );
  process.exit(0);
});
