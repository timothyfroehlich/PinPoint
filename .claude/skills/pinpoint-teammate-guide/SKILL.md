---
name: pinpoint-teammate-guide
description: Guide for teammates dispatched to worktrees. Covers environment setup, task contract protocol, Copilot review loop, and CI verification.
audience: dispatched teammate
---

> **Audience**: This skill is for **teammates dispatched to worktrees**.
> If you are the lead agent coordinating work, use `pinpoint-orchestrator` instead.

---

## Environment

You are working in a **git worktree** — an isolated copy of the repo with its own Supabase instance and ports. Key differences from the main repo:

- **Ports**: Your Next.js and Supabase ports are in `.env.local`. Never hardcode `localhost:3000`.
- **Config files**: `supabase/config.toml` and `.env.local` are auto-generated and **read-only**. Do not edit them. To regenerate: `python3 pinpoint-wt.py sync`.
- **Supabase**: Must be started before running E2E tests. Not needed for `pnpm run check`.

### Supabase Startup

```bash
supabase start    # required before E2E tests
```

**Troubleshooting** if `supabase start` fails:
1. `supabase stop --all` — stop any running instances
2. `docker ps` — check for orphaned containers on conflicting ports
3. `python3 pinpoint-wt.py sync` — regenerate config if mismatched
4. If Docker itself is down: you cannot run E2E tests. Notify the lead via `SendMessage`.

---

## Task Contract

Your worktree root contains `.claude-task-contract` — your obligation checklist. The `TaskCompleted` hook **will block** until all items are checked off.

**As you complete each item**, edit the file to check it off:

```
- [ ] Code changes implemented and tests pass (pnpm run check)
```
becomes:
```
- [x] Code changes implemented and tests pass (pnpm run check)
```

**Append timeline entries** under `## Timeline` as events happen:

```bash
echo "- $(date '+%Y-%m-%d %H:%M') — PR #1042 created, waiting for Copilot review" >> .claude-task-contract
```

> Do NOT `git add` the contract file — it's in `.gitignore`.

---

## PR Creation and Number Capture

After creating the PR, capture the number:

```bash
PR_URL=$(gh pr create --title "..." --body "...")
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
```

Or after creation:
```bash
PR_NUMBER=$(gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number')
```

Update the contract:
```
- [x] PR created (#1042)
```

---

## Copilot Review Loop

After creating the PR, run:

```bash
bash scripts/workflow/copilot-comments.sh $PR_NUMBER
```

The output always shows review status:
- **`⏳ Copilot review pending`** — last push is newer than last review. Wait and retry.
- **`✅ Copilot review is current`** — review is up to date.

### Polling loop (up to 5 minutes, breaks early when review arrives):

```bash
for i in $(seq 1 5); do
    output=$(bash scripts/workflow/copilot-comments.sh $PR_NUMBER)
    echo "$output"
    # Break early if review is current (no ⏳ pending banner)
    echo "$output" | grep -q "⏳" || break
    sleep 60
done
```

### If comments exist:
1. Address each comment (evaluate critically — not all Copilot suggestions are correct)
2. Reply to each thread: `bash scripts/workflow/respond-to-copilot.sh $PR_NUMBER "path:line" "Fixed: ... —Claude"`
3. Push your fix
4. Poll again — Copilot may re-review the new push

### Timeout (5 minutes, no review):
Check off the item with a note and add a timeline entry:
```
- [x] Copilot review received and comments addressed (no review after 5min timeout)
```

### Done when:
- Status shows "current" (not pending)
- Zero unresolved comments

---

## CI Verification

After your final push, verify CI on GitHub (local `pnpm run check` is not the same as CI):

```bash
gh pr checks $PR_NUMBER
```

Or poll until complete:
```bash
bash .agent/skills/pinpoint-commit/scripts/watch-ci.sh $PR_NUMBER
```

Only check off "CI passing" after these commands confirm it.

---

## Quality Gates

| Command | When | Supabase needed? |
|---------|------|-----------------|
| `pnpm run check` | During development, frequently | No |
| `pnpm run preflight` | Before final push | No |
| `pnpm run e2e:full` | After `supabase start` | Yes |

The `TaskCompleted` hook runs `pnpm run check` automatically, but don't rely on it as your only check — run it yourself during development.

---

## Project Rules (Quick Reference)

- **Path aliases**: `~/lib/utils` not `../../lib/utils`
- **TypeScript**: no `any`, no `!`, no unsafe `as` (ts-strictest)
- **Shell paths**: escape parentheses `src/app/\(app\)/`
- **Copilot replies**: one sentence, sign with `—Claude`
- **Migrations**: `pnpm run db:generate && pnpm run db:migrate` (never `drizzle-kit push`)
- **Server Components**: default. `"use client"` only for interaction leaves.

---

## When You're Truly Stuck

If a hook is blocking you in a loop and you cannot resolve it:

```bash
touch .claude-hook-bypass    # consumed once by the hook, then deleted
```

If you're using Agent Teams, message the lead explaining what's blocking you.
