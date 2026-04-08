---
name: pinpoint-briefing
description: Run a full project health review at session start or on demand. Answers "what should I work on?" before the orchestrator answers "how do I work on it?". Use when starting a new session, when user asks for a briefing, or before deciding what to pick up next.
---

# PinPoint Session Briefing

Run this skill at the start of every session or when asked for a project status check.
Goal: answer "what's broken, what shipped, what needs attention" before picking up any work.

## How to Run

Run all data-gathering steps **in parallel** (one Bash call per logical group). Then synthesize into a structured briefing output.

---

## Step 1 — Parallel Data Gathering

Launch these five groups simultaneously:

### Group A: Orchestration Baseline

```bash
./scripts/workflow/orchestration-status.sh
```

Covers: open PRs (CI + Copilot + merge), worktree health, beads ready/in-progress, Dependabot alerts.

### Group B: Security Audit

```bash
pnpm audit --audit-level=moderate 2>&1 | tail -20
pnpm outdated 2>&1 | head -30
```

`pnpm audit` catches CVEs not yet in Dependabot. `pnpm outdated` flags major bumps worth a scheduled update.

### Group C: Main Branch CI

```bash
gh run list --branch main --limit 10 --json status,conclusion,name,createdAt,url \
  --jq '[.[] | select(.status == "completed")] | .[0:5]'
```

Shows the last 5 completed runs on main. Flag any `conclusion == "failure"`.

### Group D: New GitHub Issues (last 5 days)

```bash
gh issue list --state open --limit 20 \
  --json number,title,createdAt \
  --jq '[.[] | select(.createdAt > ((now - 432000) | todate))] | .[] | "#\(.number) \(.title) (\(.createdAt | split("T")[0]))"'
```

User-reported bugs and feature requests. Cross-reference with beads — flag any not yet tracked.

### Group E: Sentry — New Errors

Use the Sentry MCP tools:

1. `mcp__plugin_sentry_sentry__find_organizations` — get org slug
2. `mcp__plugin_sentry_sentry__search_issues` with `query: "is:unresolved firstSeen:>-5d"` and `limit: 10`

Flag issues with high event counts or new regressions.

---

## Step 2 — Structured Briefing Output

Synthesize all gathered data into this format:

```
╔══════════════════════════════════════════════════════╗
║              PINPOINT SESSION BRIEFING               ║
╚══════════════════════════════════════════════════════╝

📅 Date: [today]

## 🚨 Needs Immediate Attention
[Anything failing on main, critical security alerts, P0 bugs]

## 🔐 Security
pnpm audit:    [X vulns (critical/high/moderate)] or ✅ clean
Dependabot:    [X open alerts] — link to any mergeable PRs
pnpm outdated: [notable major bumps] or ✅ up to date

## 📋 Open PRs
[Table from pr-dashboard.sh: PR# | Title | CI | Copilot | Merge Ready]
Highlight: any with unresolved Copilot comments, failing CI, or stale > 7 days

## 🏗️ Main Branch Health
[Last 5 post-submit runs: pass/fail summary]
[Flag any failures with link]

## 🐛 New GitHub Issues (last 5 days)
[List: #NNN Title (created X days ago) — [in beads / NOT TRACKED]]

## ⚠️ Sentry — New Errors
[List: Error message | First seen | Event count | URL]
Or: ✅ No new errors in last 5 days

## 📦 Beads State
Ready to pick up: [top 5 from `bd ready`]
In progress:     [from `bd list --status=in_progress`]
Newly unblocked: [blockers resolved — check `bd blocked` for items whose blocker PRs just merged]
Recently closed: [from `bd list --status=closed --limit 5`]

## 🌿 Worktree Health
[From stale-worktrees.sh: any stale/dirty worktrees]

## 🚀 Recommended Next Actions
1. [Highest impact / most urgent item]
2. [Second priority]
3. [Third priority]
```

---

## Step 3 — Propose Next Work

After the briefing, propose one specific bead to pick up (from `bd ready`, prioritized by P-level and
relation to open PRs). Reference bead ID and title. Wait for user confirmation before claiming.

---

## Relationship to Other Skills

| Skill                      | When to Use                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `pinpoint-briefing`        | Start of session — situational awareness and triage             |
| `pinpoint-orchestrator`    | After briefing — dispatching parallel subagents for chosen work |
| `pinpoint-github-monitor`  | During work — watching a specific PR's CI until green           |
| `pinpoint-ready-to-review` | End of work — getting a PR merged                               |
