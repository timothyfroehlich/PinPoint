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

## 1. Environment Detection & Strategy

Identify your agent type to choose the correct monitoring strategy.

### Pattern A: Claude Code / Antigravity (Monitor tool)

Use the `Monitor` tool to stream events in real time:

```
Monitor(
  command="./scripts/workflow/pr-watch.py <PR>",
  description="CI watch for PR #<PR>",
  persistent=false,
  timeout_ms=3600000
)
```

Each stdout line is a timestamped event. The script exits when all runs complete or a
new Copilot review is detected. On failure, the artifact path is printed to stdout —
READ that file to start debugging.

### Pattern B: Gemini CLI (Foreground)

Run directly in the foreground — `pr-watch.py` is already a blocking process:

```bash
./scripts/workflow/pr-watch.py <PR>
```

Exit 0 = all passed (or review interrupt). Exit 1 = failure.
If exit 1, READ `tmp/gh-monitor/failure-<RUN_ID>.md` and start debugging.

## 2. Core Mandate: Automatic Debugging

Your goal is to reach a passing build. If a failure is detected, you are authorized and encouraged to:

1. Analyze the logs in `tmp/gh-monitor/failure-<RUN_ID>.md` (path is printed by `pr-watch.py`).
2. Explore the codebase to find relevant logic.
3. Run local reproduction tests.
4. Apply fixes and re-monitor until all checks pass.
