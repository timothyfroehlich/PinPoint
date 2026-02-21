# Insights Report Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate actionable recommendations from the Claude Code insights report into
PinPoint's development infrastructure.

**Architecture:** Config-only changes across skills, hooks, CLAUDE.md, and AGENTS.md.
No application code changes. All work happens on `feat/orchestration-migration` branch
(PR #1040).

**Tech Stack:** Shell scripts (hooks), Markdown (skills/docs), JSON (settings.json)

---

### Task 1: Rename Skills in `.agent/skills/`

Rename all 8 directories from `pinpoint-*`/`github-monitor` to `tmf-*`.

**Files:**

- Rename: `.agent/skills/pinpoint-commit` → `.agent/skills/tmf-commit`
- Rename: `.agent/skills/pinpoint-e2e` → `.agent/skills/tmf-e2e`
- Rename: `.agent/skills/pinpoint-patterns` → `.agent/skills/tmf-patterns`
- Rename: `.agent/skills/pinpoint-security` → `.agent/skills/tmf-security`
- Rename: `.agent/skills/pinpoint-testing` → `.agent/skills/tmf-testing`
- Rename: `.agent/skills/pinpoint-typescript` → `.agent/skills/tmf-typescript`
- Rename: `.agent/skills/pinpoint-ui` → `.agent/skills/tmf-ui`
- Rename: `.agent/skills/github-monitor` → `.agent/skills/tmf-github-monitor`

**Step 1: Rename all directories**

```bash
cd /home/froeht/Code/PinPoint
git mv .agent/skills/pinpoint-commit .agent/skills/tmf-commit
git mv .agent/skills/pinpoint-e2e .agent/skills/tmf-e2e
git mv .agent/skills/pinpoint-patterns .agent/skills/tmf-patterns
git mv .agent/skills/pinpoint-security .agent/skills/tmf-security
git mv .agent/skills/pinpoint-testing .agent/skills/tmf-testing
git mv .agent/skills/pinpoint-typescript .agent/skills/tmf-typescript
git mv .agent/skills/pinpoint-ui .agent/skills/tmf-ui
git mv .agent/skills/github-monitor .agent/skills/tmf-github-monitor
```

**Step 2: Update `name:` frontmatter in each SKILL.md**

In each `.agent/skills/tmf-*/SKILL.md`, update the `name:` field:

- `pinpoint-commit` → `tmf-commit`
- `pinpoint-e2e` → `tmf-e2e`
- `pinpoint-patterns` → `tmf-patterns`
- `pinpoint-security` → `tmf-security`
- `pinpoint-testing` → `tmf-testing`
- `pinpoint-typescript` → `tmf-typescript`
- `pinpoint-ui` → `tmf-ui`
- `github-monitor` → `tmf-github-monitor`

**Step 3: Verify**

```bash
for f in .agent/skills/tmf-*/SKILL.md; do head -3 "$f"; echo; done
```

Expected: All `name:` fields start with `tmf-`.

---

### Task 2: Recreate `.claude/skills/` Symlinks

Delete old symlinks, create new ones pointing to renamed directories. Also rename the
real `pinpoint-orchestrator` directory.

**Files:**

- Delete + recreate: 8 symlinks in `.claude/skills/`
- Rename: `.claude/skills/pinpoint-orchestrator` → `.claude/skills/tmf-orchestrator`
- Modify: `.claude/skills/tmf-orchestrator/SKILL.md` (name field)

**Step 1: Remove old symlinks**

```bash
cd /home/froeht/Code/PinPoint
rm .claude/skills/pinpoint-commit
rm .claude/skills/pinpoint-e2e
rm .claude/skills/pinpoint-patterns
rm .claude/skills/pinpoint-security
rm .claude/skills/pinpoint-testing
rm .claude/skills/pinpoint-typescript
rm .claude/skills/pinpoint-ui
rm .claude/skills/github-monitor
```

**Step 2: Create new symlinks**

```bash
ln -s ../../.agent/skills/tmf-commit .claude/skills/tmf-commit
ln -s ../../.agent/skills/tmf-e2e .claude/skills/tmf-e2e
ln -s ../../.agent/skills/tmf-patterns .claude/skills/tmf-patterns
ln -s ../../.agent/skills/tmf-security .claude/skills/tmf-security
ln -s ../../.agent/skills/tmf-testing .claude/skills/tmf-testing
ln -s ../../.agent/skills/tmf-typescript .claude/skills/tmf-typescript
ln -s ../../.agent/skills/tmf-ui .claude/skills/tmf-ui
ln -s ../../.agent/skills/tmf-github-monitor .claude/skills/tmf-github-monitor
```

**Step 3: Rename orchestrator (real directory)**

```bash
git mv .claude/skills/pinpoint-orchestrator .claude/skills/tmf-orchestrator
```

Update `.claude/skills/tmf-orchestrator/SKILL.md` line 2:
`name: pinpoint-orchestrator` → `name: tmf-orchestrator`

**Step 4: Verify symlinks resolve**

```bash
ls -la .claude/skills/tmf-* | head -20
```

Expected: All symlinks resolve to `.agent/skills/tmf-*`.

---

### Task 3: Update Cross-References

Update all references to old skill names in AGENTS.md and within skills.

**Files:**

- Modify: `AGENTS.md` (§3 skill table, lines ~31-41)
- Modify: `.claude/skills/tmf-orchestrator/SKILL.md` (reference to `.agent/skills/pinpoint-commit/scripts/watch-ci.sh`)

**Step 1: Update AGENTS.md skill table**

Replace the skill table (lines 31-41) with:

```markdown
| Category       | Skill Name           | Path                                        | When to Use                                                              |
| :------------- | :------------------- | :------------------------------------------ | :----------------------------------------------------------------------- |
| **UI**         | `tmf-ui`             | `.agent/skills/tmf-ui/SKILL.md`             | Components, shadcn/ui, forms, responsive design.                         |
| **TypeScript** | `tmf-typescript`     | `.agent/skills/tmf-typescript/SKILL.md`     | Type errors, generics, strict mode, Drizzle types.                       |
| **Testing**    | `tmf-testing`        | `.agent/skills/tmf-testing/SKILL.md`        | Writing tests, PGlite setup, Playwright.                                 |
| **Testing**    | `tmf-e2e`            | `.agent/skills/tmf-e2e/SKILL.md`            | E2E tests, worker isolation, stability patterns.                         |
| **Security**   | `tmf-security`       | `.agent/skills/tmf-security/SKILL.md`       | Auth flows, CSP, Zod validation, Supabase SSR.                           |
| **Patterns**   | `tmf-patterns`       | `.agent/skills/tmf-patterns/SKILL.md`       | Server Actions, architecture, data fetching.                             |
| **Workflow**   | `tmf-commit`         | `.agent/skills/tmf-commit/SKILL.md`         | Intelligent commit-to-PR workflow and CI monitoring.                     |
| **Workflow**   | `tmf-github-monitor` | `.agent/skills/tmf-github-monitor/SKILL.md` | Monitoring GitHub Actions and build status.                              |
| **Workflow**   | `tmf-orchestrator`   | `.claude/skills/tmf-orchestrator/SKILL.md`  | Parallel subagent work in worktrees (background agents or Claude Teams). |
```

**Step 2: Fix orchestrator cross-reference**

In `.claude/skills/tmf-orchestrator/SKILL.md`, update:
`bash .agent/skills/pinpoint-commit/scripts/watch-ci.sh` →
`bash .agent/skills/tmf-commit/scripts/watch-ci.sh`

**Step 3: Verify no stale references remain**

```bash
rg -l "pinpoint-(commit|e2e|patterns|security|testing|typescript|ui|orchestrator)" \
  --glob '*.md' --glob '!docs/plans/*' --glob '!node_modules/*'
rg -l "skills/github-monitor" --glob '*.md' --glob '!docs/plans/*'
```

Expected: No matches (all references updated).

---

### Task 4: Hook Cleanup — Remove quality-check.cjs

Remove the redundant PostToolUse quality check hook (replaced by TaskCompleted hook).

**Files:**

- Delete: `.claude/hooks/quality-check.cjs`
- Delete: `.claude/hooks/hook-config.json`
- Delete: `.claude/hooks/tsconfig-cache.json`
- Modify: `.claude/settings.json` (remove PostToolUse hook entry)

**Step 1: Delete files**

```bash
git rm .claude/hooks/quality-check.cjs
git rm .claude/hooks/hook-config.json
git rm .claude/hooks/tsconfig-cache.json
```

**Step 2: Remove PostToolUse entry from settings.json**

Remove the entire `"PostToolUse"` block from the `"hooks"` section in `.claude/settings.json`
(the block matching `Edit|Write|MultiEdit` that references `quality-check.cjs`).

**Step 3: Verify settings.json is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('valid')"
```

Expected: `valid`

---

### Task 5: Hook Cleanup — Update pattern-reminder.cjs

Remove stale pre-beta migration patterns from the pattern reminder hook.

**Files:**

- Modify: `.claude/hooks/pattern-reminder.cjs`

**Step 1: Remove the stale pattern**

Remove the `'Migration Files in Pre-Beta'` entry from `FORBIDDEN_PATTERNS` (lines ~42-50).
This includes removing the patterns for `supabase/migrations/`, `drizzle-kit generate`,
and `pnpm run db:generate`.

**Step 2: Verify the hook still runs cleanly**

```bash
echo '{}' | node .claude/hooks/pattern-reminder.cjs
```

Expected: Outputs pattern reminder text, exits 0.

---

### Task 6: New Hook — Post-push Preflight Reminder

Create a non-blocking PostToolUse hook that nudges Claude to run preflight after `git push`.

**Files:**

- Create: `.claude/hooks/preflight-reminder.sh`
- Modify: `.claude/settings.json` (add PostToolUse entry for Bash)

**Step 1: Create the hook script**

Create `.claude/hooks/preflight-reminder.sh`:

```bash
#!/bin/bash
# Claude Code hook: PostToolUse (Bash)
# Non-blocking reminder to run preflight after pushing.
# Always exits 0 — this is a nudge, not a gate.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git push commands
if ! echo "$COMMAND" | grep -qE '^\s*git\s+push|&&\s*git\s+push'; then
  exit 0
fi

cat >&2 <<'MSG'
📋 Reminder: Did you run `pnpm run preflight` before pushing?
   - For code changes: run preflight before marking the task done.
   - For trivial changes (comments, docs, formatting): carry on — CI will validate.
MSG

exit 0
```

**Step 2: Add hook entry to settings.json**

Add a new entry to the `"PostToolUse"` section (which was cleared in Task 4).
Create a new `"PostToolUse"` array matching `Bash`:

```json
"PostToolUse": [
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "bash \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/preflight-reminder.sh",
        "timeout": 5000
      }
    ]
  }
]
```

**Step 3: Verify**

```bash
echo '{"tool_input":{"command":"git push"}}' | bash .claude/hooks/preflight-reminder.sh
echo "Exit: $?"
```

Expected: Prints reminder message, exits 0.

```bash
echo '{"tool_input":{"command":"pnpm run check"}}' | bash .claude/hooks/preflight-reminder.sh
echo "Exit: $?"
```

Expected: No output, exits 0.

---

### Task 7: CLAUDE.md Additions

Add Claude Code-specific behavioral guardrails.

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add Working Style section**

After the existing "Specialized Subagents" section, add:

```markdown
## Working Style

- If you've spent more than 3 tool calls on environment setup without reproducing
  the actual issue, stop and ask the user for guidance.
- For simple PRs (< 5 files changed), do not spawn more than 2 sub-agents.
- Do not over-engineer or spawn excessive parallel agents for straightforward tasks.
```

---

### Task 8: AGENTS.md Additions

Add universal project rules for CI workflow, safety, and testing after refactors.

**Files:**

- Modify: `AGENTS.md`

**Step 1: Add CI Workflow subsection**

After the "Commit Safety" subsection (after line ~108), add a new subsection:

```markdown
### CI Workflow

- When investigating CI failures, check for merge conflicts FIRST:
  `gh pr view <PR> --json mergeable`. A dirty mergeable state blocks all CI.
- Never push directly to protected branches (main). Always use a feature branch.
- After code changes, run `pnpm run preflight` before considering work complete.
  For trivial changes (comments, docs), `pnpm run check` is sufficient.
```

**Step 2: Add to Commit Safety subsection**

Append to the existing "Commit Safety" section (after line ~108):

```markdown
- Never add `gh pr merge` or broad wildcard tool patterns without explicit user approval.
```

**Step 3: Add Testing After Refactors guidance**

After the "Key Commands" subsection, add:

```markdown
### Testing After Refactors

- After any refactor, verify that test mocks reflect the new code structure
  (transaction wrappers, changed defaults, new parameters).
- Update test fixtures and seed data proactively rather than waiting for CI to fail.
```

---

### Task 9: Enhance tmf-github-monitor Skill

Add merge-conflict-first check as step 0 in the monitoring flow.

**Files:**

- Modify: `.agent/skills/tmf-github-monitor/SKILL.md`

**Step 1: Add pre-check step**

Before "## 1. Environment Detection & Strategy", add:

````markdown
## 0. Pre-Check: Merge Conflicts

Before investigating CI failures, ALWAYS check merge status first:

```bash
gh pr view <PR> --json mergeable --jq '.mergeable'
```
````

If the result is `CONFLICTING`, resolve merge conflicts before investigating other
failures. A dirty merge state blocks all CI checks and wastes debugging time.

````

---

### Task 10: Enhance tmf-commit Skill

Add Copilot comment resolution and label-ready flow after PR creation.

**Files:**
- Modify: `.agent/skills/tmf-commit/SKILL.md`

**Step 1: Add Phase 6.5 after CI monitoring**

After the CI monitoring section and before "Final Summary", add:

```markdown
### 6.2 Address Copilot Comments (if any)

After CI completes, check for Copilot review comments:

```bash
bash scripts/workflow/copilot-comments.sh <PR>
````

If comments exist, address each one and resolve the thread:

```bash
bash scripts/workflow/respond-to-copilot.sh <PR> "<path>:<line>" "Fixed: <description>. —Claude"
```

### 6.3 Label Ready for Review

Once CI is green and Copilot comments are resolved:

```bash
bash scripts/workflow/label-ready.sh <PR>
```

````

---

### Task 11: Commit and Verify

**Step 1: Run shellcheck on new hook**

```bash
shellcheck .claude/hooks/preflight-reminder.sh
````

Expected: No errors.

**Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('valid')"
```

**Step 3: Verify no stale skill references**

```bash
rg "pinpoint-(commit|e2e|patterns|security|testing|typescript|ui|orchestrator)" \
  --glob '*.md' --glob '!docs/plans/*' --glob '!node_modules/*' --glob '!.beads/*'
rg "skills/github-monitor" --glob '*.md' --glob '!docs/plans/*'
```

Expected: No matches.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: integrate insights report recommendations

- Rename all custom skills from pinpoint-*/github-monitor to tmf-* prefix
- Add post-push preflight reminder hook (non-blocking)
- Remove redundant quality-check.cjs hook (replaced by TaskCompleted)
- Remove stale pre-beta migration patterns from pattern-reminder
- Add anti-rabbit-holing and over-engineering guardrails to CLAUDE.md
- Add CI workflow, safety, and testing-after-refactors rules to AGENTS.md
- Enhance tmf-github-monitor with merge-conflict-first check
- Enhance tmf-commit with Copilot resolution and label-ready flow"
```
