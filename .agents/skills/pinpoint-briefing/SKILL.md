---
name: pinpoint-briefing
description: Run a full project health review at session start or on demand — answers "what should I work on?" before the orchestrator answers "how do I work on it?". Sweeps six surfaces in parallel: open PRs / worktrees / ready beads / Dependabot alerts, `pnpm audit`, the last CI runs on main, GitHub issues filed in the last five days, open security-review beads, and what the unattended nightly routine did overnight (`nightly-report` beads, plus the `human` decision queue the nightly is one writer to). Carries the two audit-reading decisions a wrong reading turns into a phantom finding: why a stale local main makes `pnpm audit` report already-patched CVEs as regressions, and why `pnpm outdated` is deliberately never run (Dependabot's soak time is the supply-chain protection). Use when starting a new session, when the user asks for a briefing, when main's CI or a new issue needs triage, or before deciding what to pick up next. The weekly maintenance pass is `pinpoint-chores`, not this.
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

Launch these six groups simultaneously:

### Group A: Orchestration Baseline

```bash
./scripts/workflow/orchestration-status.sh
```

Covers: open PRs (CI + merge), the location-agnostic `worktree_reap.py` dry-run, beads ready/in-progress, and Dependabot alerts. The output template's "Open PRs" and "Worktree Health" sections are filled from this one call — don't re-run those reports separately.

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

### Group F: Overnight Work

The nightly bead routine runs unattended, triages a batch of the backlog, and takes one bead as far as it can. It reports **on the bead itself**, flagged with the `nightly-report` label:

```bash
bd list --status=open,in_progress --label=nightly-report --json
bd human list --status=open --json
```

**Both status filters are load-bearing, and they are not spelled the same way.**
`--status=open` alone drops a bead the moment anyone claims it — `open` and `in_progress` are separate statuses — so a nightly bead someone has started, but whose label nobody cleared, silently leaves the queue while still carrying it. `bd list` accepts the comma form. **`bd human list` does not**: `bd human list --status=open,in_progress` returns _no rows at all_ rather than erroring, so pass it the bare `--status=open`. Without any filter it includes **closed** beads, which inflates the count and — worse — inflates it permanently, since resolving a bead never lowers it. That breaks the "a growing count is the signal" reading below.

Two queues, answering different questions:

- **`nightly-report`** — what the nightly actually did since you last looked. Each bead's `notes` carry the PR number, what it changed, what it deliberately didn't, and anything it found that changes the bead's premise. Read the notes, not just the title.
- **`human`** — the general "needs a human decision" flag. **It is not the nightly's queue**; any agent or session sets it, and most entries in it predate the nightly routine entirely. The nightly is simply one more writer: it flags a taste call, a scope question, a close it recommends but is not allowed to perform, or a bead it could not confidently classify. Don't attribute the queue's contents to the nightly — check each entry's author before saying who asked. `bd human list` is the canonical read (it shows resolution state, which the plain `--label=human` list does not, so the two return different sets); `bd human respond` / `bd human dismiss` clear it.

Neither label clears itself, and nothing in the routine or this skill clears them either — both are manual. Tim drops `nightly-report` once he has picked the work up, and a `human` flag when he answers. So a growing count in either is the signal; surface both counts even when nothing else is notable.

**An empty `nightly-report` queue is not evidence that the nightly failed.** It means the same thing as a cleared inbox: either the run had nothing worth handing off, or its output was already picked up and the label dropped. You cannot tell that apart from a run that never fired, because beads are the only surface Group F reads and a run that dies before its beads setup writes nothing at all. Report the queue as empty and stop there. If Tim actually needs to know whether last night ran, the routine's run history on claude.ai is the only place that answers it.

**Report each bead once.** The nightly unclaims the bead before it exits, so the same work shows up in "Overnight", in "Open PRs", and in "Beads State → Ready to pick up". Overnight is its home; the other two sections reference it by ID rather than restating it.

**Each `nightly-report` bead records the session that produced it**, in its notes:

- `session_name:` — `nightly-<YYYY-MM-DD>`, identifying which night's run it was.
- `session_id:` — a durable handle when the run captured one. `claude --resume <id>` reopens that exact conversation with its full context, which is how you ask the nightly _why_ it did something rather than inferring it from the diff. Reach for this before re-deriving a half-finished bead's reasoning. It may read `unknown` — the cloud environment does not always expose an id — in which case the routine's run log on claude.ai is the fallback.

---

## Step 2 — Structured Briefing Output

Synthesize all gathered data into the format in [references/briefing-output.md](references/briefing-output.md).

---

## Step 3 — Propose Next Work

After the briefing, propose one specific bead to pick up (from `bd ready`, prioritized by P-level and
relation to open PRs). Reference bead ID and title. Wait for user confirmation before claiming.

**Check the `nightly-report` queue before proposing anything.** The nightly leaves its bead open and
unassigned, so it comes back in `bd ready` looking like untouched work — while actually having a
finished PR waiting for review. The label is the only thing that distinguishes the two, which is why
Group F runs before this step. If the most useful next move is reviewing what the nightly already
did, say that instead of proposing it as new work.

---

## Relationship to Other Skills

| Skill                   | When to Use                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `pinpoint-briefing`     | Start of session — situational awareness and triage                   |
| `pinpoint-orchestrator` | After briefing — dispatching parallel subagents for chosen work       |
| `pinpoint-pr-workflow`  | During & end of work — commit, CI watch, readiness label, gated merge |
