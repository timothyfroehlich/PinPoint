---
name: tmf-github-monitor
description: Monitor GitHub Actions, watch builds, and automatically transition to debugging on failure. Use when user says "monitor github actions", "watch builds", or "check actions".
---

# GitHub Actions Monitor Skill

Use this skill whenever you are asked to "monitor the github actions" or "watch the builds".

## 1. Environment Detection & Strategy

Identify your agent type to choose the correct monitoring strategy.

### Pattern A: Claude Code / Antigravity (Asynchronous)

1. Run the monitor script in the background:
   `./scripts/workflow/monitor-gh-actions.sh &`
2. Periodically (every few turns or after significant actions) check for the existence of `tmp/monitor-gh-actions/MONITOR_FAILED`.
3. If the signal file exists:
   - READ `tmp/monitor-gh-actions/action-failure.md`.
   - IMMEDIATELY switch goals to **Systematic Debugging** to resolve the issue.

### Pattern B: Gemini CLI (Check-Loop)

1. Since background processes may block, run a foreground watch loop that polls until completion:
   ```bash
   while true; do
     ./scripts/workflow/monitor-gh-actions.sh
     STATUS=$?
     if [ $STATUS -eq 0 ]; then
       echo "PASS: All actions green."
       break
     elif [ $STATUS -eq 1 ]; then
       echo "FAIL: Detected failure. Logs fetched to tmp/monitor-gh-actions/action-failure.md"
       break
     fi
     # Status 2+ or other issues: wait and retry
     sleep 60
   done
   ```
2. If the output indicates "FAIL", READ `tmp/monitor-gh-actions/action-failure.md` and start debugging.

## 2. Core Mandate: Automatic Debugging

Your goal is to reach a passing build. If a failure is detected, you are authorized and encouraged to:

1. Analyze the logs in `tmp/monitor-gh-actions/action-failure.md`.
2. Explore the codebase to find relevant logic.
3. Run local reproduction tests.
4. Apply fixes and re-monitor until all checks pass.
