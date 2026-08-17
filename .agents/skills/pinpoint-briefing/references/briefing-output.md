# Briefing Output Format

```
╔══════════════════════════════════════════════════════╗
║              PINPOINT SESSION BRIEFING               ║
╚══════════════════════════════════════════════════════╝

📅 Date: [today]

## 🚨 Needs Immediate Attention
[Anything failing on main, critical security alerts, P0 bugs, high-severity open `security` beads needing attention]

## 🔐 Security
pnpm audit:    [X vulns (critical/high/moderate)] or ✅ clean
Dependabot:    [X open alerts] — link to any mergeable PRs
Security beads: [X open `security`-labeled beads] — list by severity, or ✅ none open

## 📋 Open PRs
[Table from pr-dashboard.sh: PR# | Title | CI | Merge Ready]
Highlight: any with failing CI or stale > 7 days

## 🏗️ Main Branch Health
[Last 5 post-submit runs: pass/fail summary]
[Flag any failures with link]

## 🐛 New GitHub Issues (last 5 days)
[List: #NNN Title (created X days ago) — [in beads / NOT TRACKED]]

## 🌙 Overnight
Reported:     [each `nightly-report` bead: ID, what it did, PR # if it opened one — or "queue empty"]
Needs you:    [count of open `human` beads, and the newest few — note which the nightly filed vs. which a session did]
[An empty queue is not a failed run. Don't infer one; claude.ai's run history is the only place that says.]

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
