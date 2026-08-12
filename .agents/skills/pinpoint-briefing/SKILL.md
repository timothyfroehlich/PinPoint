---
name: pinpoint-briefing
description: Run a full project health review at session start or on demand — answers "what should I work on?" before the orchestrator answers "how do I work on it?". Sweeps five surfaces in parallel: open PRs / worktrees / ready beads / Dependabot alerts, `pnpm audit`, the last CI runs on main, GitHub issues filed in the last five days, and open security-review beads. Carries the two audit-reading decisions a wrong reading turns into a phantom finding: why a stale local main makes `pnpm audit` report already-patched CVEs as regressions, and why `pnpm outdated` is deliberately never run (Dependabot's soak time is the supply-chain protection). Use when starting a new session, when the user asks for a briefing, when main's CI or a new issue needs triage, or before deciding what to pick up next. The weekly maintenance pass is `pinpoint-chores`, not this.
---

# PinPoint Session Briefing

Run this skill at the start of every session or when asked for a project status check.
Goal: answer "what's broken, what shipped, what needs attention" before picking up any work.

## How to Run

Run all data-gathering steps **in parallel** (one Bash call per logical group). Then synthesize into a structured briefing output.

**Pre-flight first**: run the Step 0 check BEFORE launching the parallel batch. The briefing reads local files (lockfile, `package.json`); if local main is stale, the audit reports rotten data without warning.

---

## Step 0 — Pre-flight check

One gate. Failing it is a stop-and-ask, not a soft warning.

### Confirm we're on a fresh main

The audit, the lockfile, and the package overrides are read from the **local** working tree. If local main is days behind, `pnpm audit` will flag CVEs that have already been patched upstream and the briefing ships a "regression" finding that's actually just stale state. (We've shipped this exact bug — a `uuid` override "regression" turned out to be a 2-day-old local checkout.)

```bash
git fetch origin main
current=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
if [ "$current" = "main" ]; then
  git pull --ff-only origin main
fi
```

- If `current == main` → fast-forward and proceed.
- Otherwise → **STOP. Do NOT run the briefing yet.** Tell the user:

  > ⚠️ I'm on `<branch>`, not main. The briefing reads local files (`pnpm-lock.yaml`, `package.json`) and would silently report stale CVEs from before main moved on. Want me to switch to main first, or run anyway with that caveat in mind?

  Wait for an explicit answer. If they say "run anyway", state in the briefing's Security section that the audit was run from a non-main checkout and any CVE finding should be re-verified.

---

## Step 1 — Parallel Data Gathering

Launch these five groups simultaneously:

### Group A: Orchestration Baseline

```bash
./scripts/workflow/orchestration-status.sh
```

Covers: open PRs (CI + merge), worktree health, beads ready/in-progress, Dependabot alerts. It wraps `pr-dashboard.sh`, `stale-worktrees.sh` and `bd ready -n 50`, so the output template's "Open PRs" and "Worktree Health" sections are filled from this one call — don't re-run those scripts separately.

### Group B: Security Audit

```bash
pnpm audit --audit-level=moderate 2>&1 | tail -20; true
```

`pnpm audit` catches CVEs not yet flagged by Dependabot.

**We intentionally do NOT run `pnpm outdated`.** Dependabot is our source of truth for version bumps — it has a configured soak time that protects against supply-chain compromise (e.g., a malicious release being unpublished within hours of publication). `pnpm outdated` has no such soak and always suggests the newest version, so bumping from its output would defeat the soak protection. If you find yourself wanting to suggest a bump, file it as "let Dependabot propose it" instead.

**Do not add `set -o pipefail` here.** `pnpm audit` exits non-zero whenever it finds vulnerabilities at/above `--audit-level` (normal signaling, not an error). With `pipefail`, that non-zero exit propagates through the pipe and aborts the parallel tool batch — the trailing `; true` keeps the whole line exit 0 regardless.

### Group C: Main Branch CI

```bash
gh run list --branch main --status completed --limit 5 \
  --json status,conclusion,name,createdAt,url
```

Flag any `conclusion == "failure"`.

### Group D: New GitHub Issues (last 5 days)

```bash
gh issue list --state open --limit 20 \
  --json number,title,createdAt \
  --jq '[.[] | select(.createdAt > ((now - 432000) | todate))] | .[] | "#\(.number) \(.title) (\(.createdAt | split("T")[0]))"'
```

User-reported bugs and feature requests. Cross-reference with beads — flag any not yet tracked.

### Group E: Security Review Beads

The Weekly Security Review routine (an AI/human security pass over the week's PRs) files its findings as **beads labeled `security`** — one bead per finding, carrying a severity and a recommendation. High-signal work that's already tracked. List the open ones:

```bash
bd list --status=open --label=security
```

Read the severity and one-line summary of each open `security` bead. These beads stay **OPEN until the finding is addressed**, so open security beads are normal — surface them; don't treat their open state as an alarm by itself.

---

## Step 2 — Structured Briefing Output

Synthesize all gathered data into the format in [references/briefing-output.md](references/briefing-output.md).

---

## Step 3 — Propose Next Work

After the briefing, propose one specific bead to pick up (from `bd ready`, prioritized by P-level and
relation to open PRs). Reference bead ID and title. Wait for user confirmation before claiming.

---

## Relationship to Other Skills

| Skill                   | When to Use                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `pinpoint-briefing`     | Start of session — situational awareness and triage                   |
| `pinpoint-orchestrator` | After briefing — dispatching parallel subagents for chosen work       |
| `pinpoint-pr-workflow`  | During & end of work — commit, CI watch, readiness label, gated merge |
