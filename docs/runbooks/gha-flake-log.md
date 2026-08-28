# GHA infra-flake log + weekly triage

## Overview

Multiple sessions have been hitting GitHub Actions **infrastructure** flakes —
runner losses, `pnpm install` network timeouts, action/browser download 5xx,
Supabase container-start failures that exhaust the retry loop. Historically each
session just reran and moved on; nothing was recorded, so we couldn't tell a
one-off blip from a systemic problem worth a real fix.

This runbook is the single source of truth for the durable **log** that agents
append to when they classify a CI failure as infra, and the **weekly triage
pass** (folded into the chores session) that correlates the raw sightings, rules
out non-issues, spins genuine problems into their own beads, and keeps an
annotated ledger of what's been dealt with, what's fixed, and what regressed.

**Scope is distinct from `flaky-test` / `flaky`**, which cover _application test_
flakiness (individual specs — see the Weekly Review routine's flaky-test report).
This is **CI-platform / infra** flakiness — a different failure class with a
different owner. If a spec is flaky because of its own logic, that's a
`flaky-test`, not a `gha-flake`.

## Hybrid three-part bead model

Directly analogous to the **huddle** pattern — a permanent root that carries
durable memory, plus rolling time-boxed beads that carry the high-churn raw
stream (huddle: permanent monthly root + rolling daily beads; here: permanent
ledger root + rolling weekly sighting beads). This keeps the durable memory
bounded forever while the append-only raw stream is bounded by closing old
weekly beads.

Three bead roles:

**1. Permanent LEDGER ROOT** = `PP-3w32` (label `gha-flake-log`, **never
closes**), found **by label** (never a hardcoded id, mirroring how the chores
nag finds `weekly-chore`):

```bash
bd list --label gha-flake-log --json | jq -r '.[0].id'
```

- Its **`notes`** hold the durable **signature ledger** — one row per flake
  _signature_ (not per sighting), so it stays bounded forever. Single-writer:
  only the weekly triage pass rewrites it (full replace). Format below.
- Raw sightings do **not** go here. (Any comments already on `PP-3w32` are
  historical pre-rotation backfill seed — leave them.)

> **Do NOT create the ledger root with `--no-history`.** That makes an ephemeral
> **wisp** (separate `dolt_ignored` table, not DoltHub-synced, TTL-compacted,
> and invisible to `bd list --label`). The root must be a normal Dolt-versioned
> bead. (An early `--no-history` wisp was discarded and replaced with `PP-3w32`
> for exactly this reason.)

**2. Rolling WEEKLY sighting beads** = one per ISO week, children of the root.

- Title `GHA flakes <ISO-week>` where `<ISO-week>` = `date -u +%G-W%V` (e.g.
  `GHA flakes 2026-W29`). **bd assigns its own `PP-xxxx` id — the year-week lives
  in the TITLE, not the literal id** (you can't force the id).
- Label `gha-flake-week`, type `task`, created
  `--parent PP-3w32 --no-inherit-labels -l gha-flake-week`.
- **Raw sightings are comments on the current week's bead** (append-only,
  concurrency-safe — each `bd comments add` is an independent insert). The helper
  find-or-creates this bead automatically.
- Triage **closes** them once older than the ~3-week window (see below). Closing
  whole weekly beads is the _only_ way to bound raw-sighting growth, because
  comments are append-only (no delete).

**3. Spun-out REAL-ISSUE beads** = created during triage for genuine recurring
problems:

```bash
bd create "GHA flake: <signature>" -t bug \
  --parent PP-3w32 --no-inherit-labels -l gha-flake,ops \
  --deps discovered-from:PP-3w32 \
  -d "<what recurs, links to run URLs, suspected cause>"
```

Note the label is **`gha-flake`** — distinct from the weekly beads' `gha-flake-week`.

## Logging a sighting

### When to log

Log via the helper **only when YOU have judged the failure to be infra**, not a
real code/test failure. The log is deliberately high-signal — there is **no
auto-capture** of every CI failure. A red run you're confident is a network
timeout, a runner loss, or a download 5xx belongs here; a genuine assertion
failure or a real regression does not.

### How to log

```bash
bash scripts/workflow/log-gha-flake.sh <pr#> <run-id> <class> "<symptom>" [--rerun green|red]
```

- `<pr#>` — the PR the failed run belongs to (bare number; `0` if none).
- `<run-id>` — the run id (the number in the run URL).
- `<class>` — one signature class from the taxonomy below.
- `<symptom>` — one-line human description of what you saw.
- `--rerun green|red` — the outcome if you reran. Omit if you haven't rerun yet
  (records `rerun=n/a`). A rerun that goes **green with no code change** is the
  strongest infra-flake signal — record it.

The helper resolves the ledger root by label (self-healing, no hardcoded id),
find-or-creates the current ISO-week sighting bead (creating it as a child of
the root if this week's doesn't exist yet — concurrent creators converge on the
oldest matching bead), constructs the run URL, best-effort derives the failing
job + step via `gh run view` (degrades to `job=unknown step=unknown` if `gh` is
unavailable or the run is gone), signs the comment, and appends it **to the
week bead**.

### Signature taxonomy

Seeded from what `ci.yml` actually does (the real infra-heavy steps):

| Class                         | Meaning                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm-install-network`        | `ETIMEDOUT` / `EAI_AGAIN` / `ECONNREFUSED` on `pnpm install`                                   |
| `playwright-browser-download` | chromium/webkit binary download flake                                                          |
| `supabase-start`              | Supabase container start failed **after** the 3-retry loop in `.github/actions/setup-supabase` |
| `checkout-download`           | `actions/checkout` 5xx                                                                         |
| `action-setup-download`       | `pnpm/action-setup` / `setup-node` / `setup-cli` download failure                              |
| `registry-5xx`                | npm registry blips                                                                             |
| `runner-lost`                 | runner died / job cancelled by GitHub infra                                                    |
| `other`                       | unclassified — triage assigns a new class if a pattern emerges                                 |

### Raw sighting schema

One greppable, signed line per sighting (emitted by the helper):

```
class=<class> pr=#<n> run=<run-url> job=<job> step=<step> — <one-line symptom> [rerun=green|red|n/a] —<AgentName>
```

Signed `—<YourRegisteredName>` (em-dash), the same convention the huddle
self-filter keys on. `<AgentName>` is derived from `$BEADS_ACTOR`, then git
`user.name`, defaulting to `Claude`.

## The signature ledger (permanent root notes)

The durable memory. The weekly triage pass rewrites the ledger root's `notes`
(single-writer, full replace) with a markdown table — **one row per flake
signature** (not per sighting) — plus a `Triaged through:` cursor:

```markdown
## Triaged through: <ISO timestamp of last processed sighting>

| Signature        | Class                       | First seen | Last seen  | Count | Status         | Fix/Bead | Notes                                   |
| ---------------- | --------------------------- | ---------- | ---------- | ----- | -------------- | -------- | --------------------------------------- |
| webkit-dl-503    | playwright-browser-download | 2026-07-08 | 2026-07-12 | 4     | promoted→PP-x  | PP-xxxx  | webkit 503 on download, recurring       |
| supabase-3x-fail | supabase-start              | 2026-07-09 | 2026-07-09 | 1     | accepted-noise | —        | self-healed on rerun, single occurrence |
```

**Signature** is a short stable slug you assign to a cluster (finer-grained than
`class`) so it can be tracked across weeks — this cross-week identity is what
makes regression detection work.

**Statuses:**

- `investigating` — seen, not yet decided.
- `accepted-noise` — known self-healing or a lone occurrence; no bead.
- `promoted→PP-xxx` — spun out to a real-issue bead (record the id in **Fix/Bead**).
- `fixed` — a fix merged and it hasn't recurred in ~2 weeks.
- `regression` — a signature previously `fixed` reappeared in new sightings.

The **`Triaged through:` cursor** is the timestamp of the last sighting the
weekly pass processed. Next week's pass only considers sightings newer than it.

## Weekly triage procedure (run from the chores session)

Run this as the chores checklist's GHA infra-flake triage item. It is
context-heavy — the chores lead should consider delegating it to a subagent and
keeping only the synthesis.

```bash
root=$(bd list --label gha-flake-log --json | jq -r '.[0].id')   # PP-3w32
bd show "$root"                                                   # current ledger + cursor
```

1. **Gather the window.** Consider the current ISO week plus the prior two. Find
   those weekly beads and read their sightings:

   ```bash
   bd list --label gha-flake-week --status open --json     # open weekly beads
   bd children "$root"                                      # cross-check via nesting
   bd comments <week-bead> --json                           # sightings on each
   ```

2. **Read new sightings past the cursor.** Keep only sightings with a timestamp
   newer than the ledger's `Triaged through:` cursor. (Ignore obvious test
   sightings, e.g. `pr=#9999`.)

3. **Cluster by signature.** Group the new sightings, matching them to existing
   ledger rows where the signature already exists.

4. **Rewrite the ledger (single-writer, full replace).** For each cluster,
   add or update its row — refresh first-seen / last-seen / count. Rule out
   non-issues as `accepted-noise` (known self-healing — a Supabase 3-retry that
   eventually passed, a pnpm-audit registry error the job already swallows to
   exit 0; a real code/test failure misfiled as infra; or a lone sighting with no
   recurrence).

5. **Regression check.** A new sighting whose signature matches a row currently
   marked `fixed` → flip that row to `regression` and reopen (or replace) its fix
   bead. This works across **any** time gap — catching a fixed-then-returned
   flake weeks later is the whole point of the permanent ledger.

   ```bash
   bd reopen <fix-bead>      # or bd create a fresh real-issue bead if the old is stale
   ```

6. **Promote genuine new recurring issues.** If a cluster is material and has no
   bead yet, spin out a real-issue bead (role #3 above) and set the row status to
   `promoted→PP-xxx`.

7. **Close aged-out weekly beads.** Once a weekly bead is older than the ~3-week
   window and its sightings are folded into the ledger, **close it**:

   ```bash
   bd close <week-bead> --reason "folded into gha-flake-log ledger"
   ```

   This is what bounds raw-sighting growth — comments are append-only, so closing
   whole weekly beads is the only lever. (Also merge/close any accidental
   duplicate week bead a create-race produced.)

8. **Advance the cursor.** Set `Triaged through:` to the timestamp of the newest
   sighting you processed, and write the full ledger back:

   ```bash
   bd update "$root" --notes "$(cat ledger.md)"
   ```

## Verification

- **Label lookup:** `bd list --label gha-flake-log --json` returns exactly the
  one ledger root (`PP-3w32`).
- **Helper:** `bash scripts/workflow/log-gha-flake.sh 9999 <recent-run-id> pnpm-install-network "test sighting" --rerun green`
  find-or-creates this week's `GHA flakes <ISO-week>` bead and lands a
  correctly-formatted signed comment on it; `bd comments <week-bead>` shows it.
  Sightings are append-only (no delete), so use an obviously-fake `pr=#9999` for
  tests — triage ignores it and the whole week bead is eventually closed.
- **Skill wiring:** the pr-workflow skill points at the helper at its log-time
  decision points; the chores checklist item #8 and the
  `weekly-chore` bead body both carry the triage item.

## Related

- **Helper:** `scripts/workflow/log-gha-flake.sh`
- **Chores runbook:** `.agents/skills/pinpoint-chores/SKILL.md` (weekly triage item)
- **Log-time pointer:** `pinpoint-pr-workflow` (Phase 3.1 + Phase 4.2 escape hatch)
- **`flaky-test` label** — the _application-test_ flakiness track (distinct owner).
