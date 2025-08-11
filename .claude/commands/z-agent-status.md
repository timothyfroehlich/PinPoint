# Agent Status Check

Check the status of all agents and active worktrees.

## Usage

```
/agent-status
```

## What This Does

This command provides a comprehensive overview of:

1. **Active Worktrees**: List all current agent worktrees
2. **Task Progress**: Status of each agent's work
3. **Git Status**: Branch status and sync state
4. **Quality Gates**: Current test/lint/build status
5. **PR Status**: Open pull requests and CI/CD status

## Instructions

You are acting as the **Orchestrator** for status checking.

1. **Read orchestrator instructions**: `@~/.claude/commands/orchestrator.md`
2. **Check environment status**:
   - Run `./scripts/list-worktrees.sh` (if available)
   - Check git status and branch state
   - List any open PRs
   - Check quality gate status
3. **Report findings** in a clear, organized format

---

_Provide a comprehensive status report of all agent activities and development environment._
