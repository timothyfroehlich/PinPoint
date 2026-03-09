---
name: pinpoint-github-monitor
description: Monitor GitHub Actions, watch builds, and automatically transition to debugging on failure. Use when user says "monitor github actions", "watch builds", or "check actions".
---

# GitHub Actions Monitor Skill

Use this skill whenever you are asked to "monitor the github actions" or "watch the builds".

## 0. Pre-Check: Merge Conflicts

Before investigating CI failures, ALWAYS check merge status first:

```bash
gh pr view <PR> --json mergeable --jq '.mergeable'
```

If the result is `CONFLICTING`, resolve merge conflicts before investigating other
failures. A dirty merge state blocks all CI checks and wastes debugging time.

## 1. Run the Monitor

```bash
./scripts/workflow/monitor-gh-actions.sh <PR>
```

This script uses `gh run watch` to monitor active CI runs. It blocks until all runs
complete, then reports pass/fail. On failure, logs are written to
`tmp/monitor-gh-actions/action-failure.md`.

**For background monitoring** (Claude Code / Antigravity):

1. Run: `./scripts/workflow/monitor-gh-actions.sh <PR> &`
2. Periodically check for `tmp/monitor-gh-actions/MONITOR_FAILED`
3. If the signal file exists, read `tmp/monitor-gh-actions/action-failure.md`

**For foreground monitoring** (Gemini / Codex):

1. Run: `./scripts/workflow/monitor-gh-actions.sh <PR>`
2. Check exit code: 0 = all passed, 1 = failure detected

## 2. On Failure: Automatic Debugging

If a failure is detected, you are authorized and encouraged to:

1. Analyze the logs in `tmp/monitor-gh-actions/action-failure.md`
2. Explore the codebase to find relevant logic
3. Run local reproduction tests
4. Apply fixes and re-monitor until all checks pass

## 3. After CI Passes: Check for Copilot Reviews

CI passing does NOT mean the PR is ready. After CI completes:

1. Load the `pinpoint-ready-to-review` skill
2. Follow Step 2 (fetch Copilot comments via MCP subagent)
3. Address any comments, then label ready
