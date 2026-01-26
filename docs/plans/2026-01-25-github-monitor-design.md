# Design: GitHub Actions Monitoring Skill

## Purpose

To provide a context-efficient, cross-agent skill for monitoring GitHub Actions. The agent will "watch" builds and automatically transition into a debugging workflow upon failure.

## Architecture

### 1. Core Script: `scripts/monitor-gh-actions.sh`

- Uses `gh run watch --exit-status` to monitor the latest or a specific run.
- Traps failures and extracts the last 100 lines of logs from failed jobs.
- Writes logs to `.agent/logs/action-failure.md`.
- Creates a signal file `.agent/logs/MONITOR_FAILED` to alert the agent.

### 2. Skill: `.agent/skills/github-monitor/SKILL.md`

- Contains specific blocks for Claude Code, Gemini CLI, and Antigravity.
- **Claude Code/Antigravity**: Instructions on backgrounding the monitor script and polling the signal file.
- **Gemini CLI**: A "foreground watch loop" that uses a `while` loop with `sleep` to stay active and responsive without blocking the agent's ability to report status.
- **Mandate**: Explicit instruction to immediately invoke `superpowers-debug` if a failure is detected.

### 3. Data Flow

1. User: "Monitor the builds."
2. Agent: Executes Identity-Specific Watch Pattern.
3. Script: Monitors GH Actions.
4. Failure -> Script creates `action-failure.md` and `MONITOR_FAILED`.
5. Agent: Detects signal -> Reads `action-failure.md` -> Activates `superpowers-debug`.

## Success Criteria

- Works across all three agents using their native capabilities.
- Minimal token overhead (signal file check vs. reading full logs constantly).
- Zero-latency transition from "watching" to "fixing".
