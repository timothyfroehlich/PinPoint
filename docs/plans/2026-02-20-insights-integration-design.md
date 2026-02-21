# Insights Report Integration Design

**Date**: 2026-02-20
**Source**: Claude Code `/insights` usage report (115 sessions analyzed)
**PR Context**: Builds on PR #1040 (orchestration migration to Agent Teams + hooks)

## Goal

Integrate actionable recommendations from the insights report into the PinPoint development
infrastructure. Focus on reducing recurring friction: rabbit-holing, over-engineering, broken tests
from unupdated mocks, and CI merge-conflict blindness.

## Changes

### 1. Skill Rename: `github-monitor` → `pinpoint-github-monitor`

**Original plan:** Rename all skills to `tmf-*` prefix. **Revised:** Keep `pinpoint-*` prefix
(natural project naming), but fix the one inconsistency: `github-monitor` → `pinpoint-github-monitor`.

The `tmf-*` rename was implemented and then reverted — the `pinpoint-*` convention was clearer
since all custom skills already used it except `github-monitor`.

**What shipped:**

- Renamed `.agent/skills/github-monitor` → `.agent/skills/pinpoint-github-monitor`
- Updated symlink in `.claude/skills/`
- Updated `name:` frontmatter and AGENTS.md skill table

### 2. New Hook: Post-push Preflight Reminder

**Type:** PostToolUse (matches Bash commands containing `git push`)
**Behavior:** Non-blocking (always exit 0). Prints a nudge asking whether preflight was run.
Gives Claude judgment to skip for trivial changes. CI catches wrong decisions.

**Message example:**

```
Reminder: Did you run `pnpm run preflight` before pushing?
If this was a trivial change (comments, docs, formatting), carry on — CI will validate.
For code changes, consider running preflight before marking the task done.
```

### 3. Hook Cleanup

**Remove `quality-check.cjs` + `hook-config.json` + `tsconfig-cache.json`:**

- Redundant now that `definition-of-done.sh` runs `pnpm run check` on TaskCompleted
- Remove PostToolUse hook entry for `quality-check.cjs` from `settings.json`

**Update `pattern-reminder.cjs`:**

- Remove "Migration Files in Pre-Beta" CRITICAL pattern (stale — we're post-launch)
- Remove `drizzle-kit generate` / `pnpm run db:generate` patterns (legitimate commands)

**Remove `pattern-reminder.cjs` entirely (added post-design):**

- SubagentStop only fires for Task tool subagents, not Agent Teams teammates
- Most Task subagents are read-only (Explore, Plan, investigator) — they never change files
- The few that do write files often work in worktrees where `git status` in the parent
  cwd won't see their changes
- Net effect: the hook scans an empty diff most of the time
- The patterns it enforced (PGlite, deprecated auth, snake case) are better caught by
  `pnpm run check` (already runs on TaskCompleted via `definition-of-done.sh`)

### 4. CLAUDE.md Additions

Claude Code-specific behavioral guardrails. These address the anti-rabbit-holing and
over-engineering friction identified in the insights report.

```markdown
## Working Style

- If you've spent more than 3 tool calls on environment setup without reproducing
  the actual issue, stop and ask the user for guidance.
- For simple PRs (< 5 files changed), do not spawn more than 2 sub-agents.
- Do not over-engineer or spawn excessive parallel agents for straightforward tasks.
```

### 5. AGENTS.md Additions

Universal project rules that apply to any agent.

**New "CI Workflow" subsection in §4:**

- Check merge conflicts FIRST when investigating CI failures
  (`gh pr view --json mergeable`). Dirty mergeable state blocks all CI.
- Never push directly to protected branches (main). Always use a feature branch.
- After making changes, run `pnpm run preflight` before considering work complete.
  For trivial changes (comments, docs), `pnpm run check` is sufficient.

**Addition to existing "Commit Safety" subsection:**

- Never add `gh pr merge` or broad wildcard tool patterns without explicit user approval.

**New "Testing After Refactors" guidance:**

- After any refactor, verify that test mocks reflect the new code structure
  (transaction wrappers, changed defaults, new parameters). Update fixtures proactively
  rather than waiting for CI.

### 6. Enhance Existing Skills

**`pinpoint-github-monitor`:** Add "check merge conflicts first" as step 0 in the monitoring flow.

**`pinpoint-commit`:** Add Copilot comment resolution + label-ready flow after push/PR creation.

## Non-Goals

- No new `/ci-monitor` or `/pr-finalize` skills (enhance existing instead)
- No changes to `definition-of-done.sh` or `push-check.sh` (already correct from PR #1040)
- No changes to NON_NEGOTIABLES.md (already covers email privacy + localhost domain)
- No headless mode workflows (future consideration)
