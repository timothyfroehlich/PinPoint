#!/usr/bin/env node
// .claude/hooks/ui-screenshot-reminder.cjs
// PostToolUse hook (Bash): non-blocking reminder to get Tim's UI approval.
//
// Fires on `git commit`. If the branch's cumulative diff vs origin/main touches
// a UI glob, returns one reminder as additionalContext. Always exits 0 — this is a
// nudge, not a gate. No network calls beyond the already-local `git diff`
// (which reads git's local knowledge of origin/main — it does not fetch).
//
// UI-touching changes need Tim's visual sign-off before E2E work: capture local
// screenshots, send them to him in chat, and the PR's "UI Approval" check waits
// for his approval (see pinpoint-pr-workflow skill).

const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const tool = payload.tool_name || "";
  if (tool !== "Bash") {
    process.exit(0);
  }

  const cmd = String((payload.tool_input && payload.tool_input.command) || "");
  // Same cmdStart-position + quote-stripping approach as the other Bash-command
  // hooks, so a docs/echo mention of "git commit" doesn't false-positive.
  const stripped = cmd
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
  const cmdStart = /(?:^|;|&&|\|\||\||&|\n|\$\(|<\(|\(|`)\s*/;
  const gitCommit = new RegExp(cmdStart.source + "git\\s+commit\\b");
  if (!gitCommit.test(stripped)) {
    process.exit(0);
  }

  // Determine cwd for the git call — prefer the payload's cwd (worktree-aware).
  const cwd = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

  let changedFiles = [];
  try {
    const out = execFileSync(
      "git",
      ["diff", "--name-only", "origin/main...HEAD"],
      // stdio: explicitly pipe stderr too — execFileSync's default inherits
      // stderr to the parent, which would leak git's error text onto this
      // hook's own stderr and break the "fail open silently" contract below.
      { cwd, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] }
    );
    changedFiles = out.split("\n").filter(Boolean);
  } catch {
    // origin/main unreachable/unknown, not a git repo at cwd, or the diff
    // otherwise failed — this is a nudge, not a gate. Fail open silently.
    process.exit(0);
  }

  // The UI path list is shared with the UI Approval check
  // (scripts/workflow/ui-paths.txt, one extended regex per line).
  let UI_GLOBS = [];
  try {
    UI_GLOBS = readFileSync(join(__dirname, "..", "..", "scripts", "workflow", "ui-paths.txt"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => new RegExp(line));
  } catch {
    process.exit(0);
  }

  const touchesUi = changedFiles.some((f) =>
    UI_GLOBS.some((re) => re.test(f))
  );

  if (!touchesUi) {
    process.exit(0);
  }

  // PostToolUse stderr is never shown to the model; additionalContext is.
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext:
          "UI-touching change — before updating E2E tests, capture screenshots with " +
          "`node scripts/workflow/pr-screenshots.mjs`, send the PNGs to Tim in chat " +
          "(and offer to start the dev server so he can look live), and get his UI " +
          "approval. The PR's \"UI Approval\" check waits for it.",
      },
    })
  );
  process.exit(0);
});
