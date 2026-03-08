---
name: pinpoint-teammate-guide
description: Guide for subagents dispatched to worktrees. Covers environment setup, task contract protocol, Copilot review loop, and CI verification.
audience: dispatched subagent
---

> **Audience**: This skill is for **subagents dispatched to worktrees**.
> If you are the lead agent coordinating work, use `pinpoint-orchestrator` instead.

---

## Standalone Subagent Mode

If you were launched without `team_name` (no `SendMessage` available):
- Quality gates are YOUR responsibility — run `pnpm run check` before returning
- Self-check `.claude-task-contract` items before returning
- Return a structured report: branch, PR#, CI status, Copilot status, blockers

---

## Environment

You are working in a **git worktree** — an isolated copy of the repo with its own Supabase instance and ports.

- **Ports**: Your Next.js and Supabase ports are in `.env.local`. Never hardcode `localhost:3000`.
- **Config files**: `supabase/config.toml` and `.env.local` are auto-generated and **read-only**. To regenerate: `python3 pinpoint-wt.py sync`.
- **Supabase**: Must be started before running E2E tests. Not needed for `pnpm run check`.

### Supabase Startup

```bash
supabase start    # required before E2E tests
```

**Troubleshooting** if `supabase start` fails:
1. `supabase stop` — stop this worktree's instance only (**NEVER** `supabase stop --all` — that kills every other agent's environment too)
2. `docker ps` — check for orphaned containers on conflicting ports
3. `python3 pinpoint-wt.py sync` — regenerate config if mismatched
4. If Docker itself is down: note this as a blocker in your return report.

---

## Task Contract

Your worktree root should contain `.claude-task-contract` — your obligation checklist.

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

---

## Ready-to-Review

After creating the PR, run the full CI → Copilot → label sequence.

**Use `pinpoint-ready-to-review` skill** — it covers CI watching, Copilot polling loop, comment resolution, and the final `label-ready.sh` call.

---

## Quality Gates

| Command | When | Supabase needed? |
|---------|------|-----------------|
| `pnpm run check` | During development, frequently | No |
| `pnpm run preflight` | Before final push | No |
| `pnpm run e2e:full` | After `supabase start` | Yes |

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

```bash
touch .claude-hook-bypass    # persistent bypass for hooks blocking you
```
