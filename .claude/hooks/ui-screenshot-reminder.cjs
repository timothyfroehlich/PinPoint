#!/usr/bin/env node
// .claude/hooks/ui-screenshot-reminder.cjs
// PostToolUse hook (Bash): non-blocking reminder to post UI screenshots.
//
// Fires on `git commit`. If the branch's cumulative diff vs origin/main touches
// a UI glob, prints one reminder line to stderr. Always exits 0 — this is a
// nudge, not a gate. No network calls beyond the already-local `git diff`
// (which reads git's local knowledge of origin/main — it does not fetch).
//
// PP-wi85: UI-touching PRs must have desktop+mobile screenshots posted before
// handoff to Tim (see AGENTS.md §9, pinpoint-pr-workflow skill Phase 2/3).

const { execFileSync } = require("node:child_process");

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

  const UI_GLOBS = [
    /^src\/app\/.*\.tsx$/,
    /^src\/app\/.*\.css$/,
    /^src\/components\//,
    /\.css$/,
    /(^|\/)tailwind[^/]*$/i,
    /(^|\/)design-tokens?[^/]*$/i,
  ];

  const touchesUi = changedFiles.some((f) =>
    UI_GLOBS.some((re) => re.test(f))
  );

  if (!touchesUi) {
    process.exit(0);
  }

  process.stderr.write(
    "🖼  UI-touching change — before handing this PR to Tim, post screenshots: " +
      "scripts/workflow/pr-screenshots.mjs <PR> (desktop+mobile).\n"
  );
  process.exit(0);
});
