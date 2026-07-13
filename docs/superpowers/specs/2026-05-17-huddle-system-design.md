# Huddle Coordination System — Design

**Status:** Approved (brainstormed 2026-05-17)
**Owner:** Tim
**Implementation split:** PR #1357 (foundation) + a follow-up PR (rotation)

## 1. Goal

A lightweight, context-efficient coordination channel between parallel Claude
Code sessions working on PinPoint. Each session should be able to learn what
other sessions have done recently, post its own updates, and filter out its own
echoes — all without consuming thousands of tokens of conversation history at
every session start.

The current system (a single bd issue, PP-cvh, with all coordination as
chronological comments) works but does not scale: 60+ comments inject as 5,000+
tokens on every fresh session. The proposed system replaces the
single-growing-bead model with a rolling daily-summary structure and reduces
session-start coordination context to ~300-500 tokens.

## 2. Naming

The system is **huddle**. Replaces the previous "cvh" prefix (which derived
from the bd ID PP-cvh — an accident of when the coordination bead was filed,
not a meaningful name). "Huddle" matches the metaphor of agents briefly
gathering to share status before continuing their work.

All scripts use the `huddle-` prefix:

- `huddle-session-start.sh` — SessionStart hook
- `huddle-poll.sh` — UserPromptSubmit hook
- `huddle-rotate.sh` — invoked by the rotation subagent
- `huddle-bootstrap.sh` — one-time initialization
- `huddle-rotation-check.sh` — shared helper sourced by both hooks
- `huddle-whoami.sh` — agent identity helper

All state lives in `<main-worktree>/.agents/huddle/` (project-scoped,
git-ignored, shared across linked worktrees via `git rev-parse --git-common-dir`):

- `<main-worktree>/.agents/huddle/config.json` — local config, holds root bead ID
- `<main-worktree>/.agents/huddle/session-names.json` — session_id → name mapping
- `<main-worktree>/.agents/huddle/last-seen-<path-hash>` — per-checkout poll cursor
- `<main-worktree>/.agents/huddle/last-pull` — per-machine Dolt-sync throttle marker (§14)
- `<main-worktree>/.agents/huddle/pull.lock` — non-blocking sync lock (§14)
- `<main-worktree>/.agents/huddle/rotation.lock` — flock target for rotation

## 3. Plugin Packaging

The huddle system ships as a Claude Code plugin so it can be enabled/disabled
independently of the project. The plugin contains:

- Skill manifest (`SKILL.md`) — describes the system to agents and humans
- All hook scripts under `scripts/hooks/`
- Settings.json snippet for hook registration (SessionStart + UserPromptSubmit)
- README explaining install, bootstrap, and operations

Agents see plugin docs as a skill they can invoke; humans manage it via
`enabledPlugins` in `~/.claude/settings.json`. The plugin is installed at
project level via `scripts/hooks/` (already part of the PinPoint repo) and
referenced from project `.claude/settings.json`. State lives in
`<main-worktree>/.agents/huddle/` so it's project-scoped, not user-scoped — a
clone of PinPoint boots the system without writing to the user's home dir.

The PinPoint-specific bd issue identifiers (the rolling daily/monthly beads)
are stored in `<main-worktree>/.agents/huddle/config.json`, so the same plugin
code works for any project that bootstraps its own huddle root.

## 4. System Architecture

### 4.1 Bead hierarchy

```
Huddle Root  (type: epic, never closes)              ── PP-XXXX
  │  notes (JSON):  pointers + settings (see 4.2)
  │  description:   human-readable system docs
  │
  ├── Daily 2026-05-17  ─ PP-AAAA  (open; receives all comments today)
  ├── Daily 2026-05-16  ─ PP-CCCC  (closed; summary in description, raw archive in notes)
  ├── Daily 2026-05-15  ─ PP-DDDD  (closed)
  │     ... older daily beads
  │
  ├── Monthly 2026-05   ─ PP-BBBB  (open until month rolls; aggregates dailies)
  └── Monthly 2026-04   ─ PP-EEEE  (closed; aggregated summary)
```

Parent-child links via `bd dep add <child> <root> --type parent-child`.
`bd epic status <root>` shows daily/monthly progress.

### 4.2 Coord root `notes` JSON schema

```json
{
  "schema_version": 1,
  "today_bead": { "id": "PP-AAAA", "date": "2026-05-17" },
  "monthly_bead": { "id": "PP-BBBB", "month": "2026-05" },
  "settings": {
    "n_dailies_to_inject": 5,
    "day_boundary_tz": "local",
    "stale_name_cutoff_days": 14
  },
  "last_rotation": "2026-05-17T00:00:00-05:00"
}
```

- `today_bead`: the only bead currently accepting coordination comments. The
  `id` is a fast-path HINT only — readers verify it via `bd show` (open +
  titled-for-today) and fall back to a `bd children <root>` title query, so a
  stale/dangling id is never trusted (PP-9lq5).
- `monthly_bead`: the open monthly summary for the current month.
- `last_rotation`: timestamp of the last successful rotation, for diagnostics.

> Root notes hold only genuine pointers + settings. There is **no**
> `recent_dailies` array — it was a cache of DB state and the source of the
> PP-9lq5 dangling pointers; session-start now queries `bd children <root>` by
> title at read time (§14.2).

### 4.3 Local config file (`<main-worktree>/.agents/huddle/config.json`)

```json
{
  "schema_version": 1,
  "root_bead_id": "PP-XXXX"
}
```

The only join key between the file system and the bd database. Created by
`huddle-bootstrap.sh`. Hooks read this on every fire.

## 5. Hook Scripts

### 5.1 `huddle-session-start.sh` (SessionStart)

Fires with stdin payload `{ session_id, transcript_path, cwd, source, model,
agent_type? }` where `source` is `startup` | `resume` | `clear` | `compact`.

Logic, in order:

1. **Skip if subagent:** if `transcript_path` contains `/subagents/`, exit 0.
2. **Per-machine sync** (§14.1): `huddle_sync` — no-op in server mode (shared
   live DB); throttled `bd dolt push`+`pull` in embedded mode so the session
   opens on the freshest cross-machine state.
3. **Skip if not bootstrapped:** if `config.json` is missing, first try
   `huddle_discover_root` to **auto-adopt** an already-synced root (§14.2); only
   if none exists emit the "bootstrap needed" notice (see §7.1) and exit.
4. **Rotation check:** source `huddle-rotation-check.sh`. If the active
   `today_bead.date` ≠ today's local date, emit the "rotation needed" notice
   (see §7.2) and skip the remaining steps. The lead agent dispatches a rotation
   subagent before continuing. Otherwise `huddle_reconcile_today` runs once
   (§14.3) to collapse any cross-machine duplicate daily.
5. **Identity announcement** (suppressed if `source == "compact"`): look up
   the session's name in `session-names.json`. Emit either the
   "registered as Claude-<Name>" block or the "registration needed" notice
   (see §7.3 and §7.4).
6. **Summary injection** (suppressed if `source == "compact"`): inject the
   monthly summary description and the descriptions of the
   `n_dailies_to_inject` most-recent daily beads, resolved by a
   `bd children <root>` title query (newest date first) — not a notes cache.

### 5.2 `huddle-poll.sh` (UserPromptSubmit)

Fires on every user prompt with stdin payload `{ session_id, transcript_path,
cwd, permission_mode, hook_event_name, prompt }`.

Logic, in order:

1. **Skip if subagent:** if `transcript_path` contains `/subagents/`, exit 0.
2. **Per-machine sync** (§14.1): `huddle_sync` — no-op in server mode; in
   embedded mode a throttled `bd dolt push`+`pull` before reading so peer
   machines' new comments are pulled in before the poll.
3. **Skip if not bootstrapped:** if config missing, exit 0 silently (the
   SessionStart hook handles the user-visible notice / auto-adopt).
4. **Rotation check:** source `huddle-rotation-check.sh`. If rotation needed,
   emit the rotation notice and skip the poll — new comments must wait for the
   new today_bead to be created.
5. **Poll for new comments:** read the current `today_bead.id` from
   `config.json` + root notes. Run `bd comments <today_bead> --json`.
   Filter to comments newer than `last-seen-<path-hash>` and not
   signed by the current session (self-filter). Inject any matches as a
   system-reminder block. Update the last-seen file to the newest
   `created_at`.

### 5.3 `huddle-rotation-check.sh` (shared helper)

Sourced by both hooks. Defines a single function `huddle_rotation_needed()`
that returns 0 if rotation is needed, 1 if not. Reads `config.json`,
`bd show <root> --json`, compares `today_bead.date` to `date +%F`.

Single source of truth for the detection logic.

### 5.4 `huddle-rotate.sh`

Invoked by the rotation subagent (dispatched by the lead agent when the
rotation notice fires). Acquires the flock at
`<main-worktree>/.agents/huddle/rotation.lock` (same `lockf(1)` / `flock(1)`
platform-detection pattern as PP-bg45's worktree-create.sh), then performs
the rotation. See §6 for the rotation flow.

### 5.5 `huddle-bootstrap.sh`

One-time initialization. Idempotent — re-running on an already-bootstrapped
project is a no-op that prints status. Creates the root epic, today's first
daily bead, this month's monthly bead, writes
`<main-worktree>/.agents/huddle/config.json`, and initializes the root's notes
JSON.

### 5.6 `huddle-whoami.sh`

Agent identity helper. Subcommands:

- `whoami [SESSION_ID]` — print name for SESSION_ID (or discovered session)
- `register NAME [SESSION_ID]` — record SESSION_ID → NAME. Rejects if NAME
  is taken by another session_id; suggests variants (`Name2`, `NameB`,
  alternate descriptive term).
- `list` — all mappings, sorted by name
- `discover` — best-effort session_id from newest top-level transcript

## 6. Rotation Flow

Triggered when a session detects `today_bead.date < today_local_date`. The
lead agent dispatches a single rotation subagent. The subagent runs
`huddle-rotate.sh`, which:

1. **Acquire lock** via `lockf -t 60` (macOS) or `flock -x -w 60` (Linux) on
   `<main-worktree>/.agents/huddle/rotation.lock`. 60s allows the slowest case
   (LLM-driven summarization of a long day's chatter) to complete without
   spurious timeouts from a peer's concurrent rotation attempt.
2. **Re-check date** inside the lock. If rotation is no longer needed (a
   peer session got there first), release lock and exit 0.
3. **Create new beads (orphan)** — do not point at them yet:
   - `bd create -t task --parent <root> --title "Huddle daily YYYY-MM-DD"`
   - If month changed: `bd create -t task --parent <root> --title "Huddle monthly YYYY-MM"`
4. **Atomically update root pointers** in a single
   `bd update <root> --notes "<new-json>"` call. After this step, the new
   beads are live and the system is consistent.
5. **Post pointer comments** on the old beads (best-effort):
   - On old `today_bead`: `→ continued in <new-today-bead-id>`
   - On old `monthly_bead` (if rolled): `→ continued in <new-monthly-id>`
6. **LLM-summarize old beads:** subagent reads the old `today_bead`'s
   comments and writes a tight categorized summary into the old bead's
   `description`. The raw verbatim comment text goes into the old bead's
   `notes` for forensics. Same for the rolled-out monthly (which summarizes
   that month's daily summaries).
7. **Close old beads:** `bd close <old-today>` (and old monthly if rolled).
8. **Prune stale session names** (see §8.4): scan recent content for
   sign-off appearances; evict map entries whose name hasn't appeared in
   the last 14 days of huddle content.
9. **Release lock** (automatic on process exit).

**Crash-safety:** Steps 1-4 are the "make consistent" path. If the process
dies between step 4 and step 7, the result is a closed-bead-still-acting-
as-archive with no summary yet. The next rotation detects "any closed daily
under root without a summary in description" and fills it in before
proceeding. No bead is left in an unreachable state.

## 7. Hook Output Templates

### 7.1 Bootstrap needed

```
## ⚠️ Huddle not bootstrapped

The huddle coordination system isn't set up yet. It maintains a daily bead
for agents to coordinate on, summarizes each day's chatter into ~50-token
digests so it stays cheap to read, and rotates at local midnight.

To bootstrap, run:
    bash scripts/hooks/huddle-bootstrap.sh

That creates the root bead, today's daily, this month's monthly, and writes
<main-worktree>/.agents/huddle/config.json with the IDs. Re-running the script
is safe — it's a no-op if already bootstrapped.
```

### 7.2 Rotation needed

```
## ⚠️ Huddle rotation needed

The active coordination bead points to date <STORED_DATE>, but today is
<NOW_DATE>. Before continuing, dispatch the rotation subagent — it will
summarize the previous day, create today's bead, update pointers, and
post "continued in" markers on closed beads.

Dispatch:
    Agent({
      subagent_type: "claude",
      prompt: "Run bash scripts/hooks/huddle-rotate.sh and report.",
      model: "sonnet"
    })

The subagent acquires a lock; if a peer session already rotated, it
returns immediately. Safe to dispatch even if you're unsure.
```

### 7.3 Identity announcement (registered)

```
## Huddle identity

Your session_id: `<UUID>`
Registered as: **Claude-<Name>** (self-filter active for your own posts)

If this scrolls out of context later, recall your name with:
    bash scripts/hooks/huddle-whoami.sh whoami <UUID>
```

### 7.4 Registration needed

```
## Huddle identity — registration needed

Your session_id: `<UUID>`

When you receive your first user prompt, derive a short descriptive name
for yourself from what you're being asked to do. The name should help Tim
recognize at a glance what each parallel Claude is working on.

Examples (based on what the first prompt is about):
  - "WorktreeHookFix"  → fixing a worktree hook bug
  - "TestAudit"        → auditing test coverage
  - "DesignBible"      → working on the design bible
  - "DocsSync"         → keeping docs aligned
  - "RotationDesign"   → designing rotation logic

Format: CamelCase, ASCII letters only, under ~20 chars. Suffix with 2, 3,
or a letter only if you need to dodge a collision.

When you've chosen, register yourself:
    bash scripts/hooks/huddle-whoami.sh register <YourName> <UUID>

If the name's taken, the helper rejects it and suggests a variation.
Sign your huddle posts with —Claude-<YourName> (the filter accepts that
form and the shorthand —<YourName> for typo tolerance).

DO NOT use bead IDs, PR numbers, or generic labels like "Worker1" — none
of those help Tim track who's doing what. The name describes the WORK.
```

## 8. Agent Identity

### 8.1 Mapping storage

`<main-worktree>/.agents/huddle/session-names.json` — JSON map of `{session_id:
name}`. Persists across restarts and compactions because it's a regular file.
The canonical lookup for both the SessionStart hook (announcement) and the
poll hook (self-filter).

### 8.2 Sign-off convention

Canonical: `—Claude-<Name>` (em-dash, U+2014, then "Claude-", then the
registered name). 44 of 45 historical sign-offs use this form. The
self-filter ALSO accepts the shorthand `—<Name>` (em-dash, then name) to be
forgiving of typos. The em-dash distinguishes the suffixes: `—Claude-Spinner`
ends with hyphen-minus + "Spinner", not em-dash + "Spinner", so no false
positives between forms.

### 8.3 Uniqueness

`huddle-whoami.sh register NAME` checks the existing map. If NAME is taken
by any other session_id, registration fails and suggests variations:
`Name2`, `Name3`, `NameB`. Agents retry with a variant until uniqueness
holds. Avoids the silent cross-session self-filter bug where two agents
named "Plunger" would filter each other out.

### 8.4 Stale session name freeing

Names must be freeable over time — Tim will run many sessions named
"DependabotFix" or "TestAudit" across weeks, and they shouldn't have to
pick "TestAudit47" because every earlier audit's entry lingers.

The rotation subagent, on each rotation it performs, prunes stale entries
from `session-names.json`. For each entry, it scans recent huddle
content (today's bead + last 14 daily beads' raw archives + monthly
summaries) for any sign-off matching `—Claude-<Name>` or `—<Name>`. If no
match is found in the last 14 days of content, the entry is evicted from
the map and the name becomes immediately available for reuse.

**False-positive risk:** A long-running session that reads huddle content
but never posts for 14+ days gets pruned. Recovery: on their next post,
the poll hook detects their own historical content (since the self-filter
no longer recognizes them) and re-injects it. The agent notices, runs
`huddle-whoami.sh register <Name> <session_id>` again, and the entry is
restored. One-command recovery; not catastrophic.

The 14-day cutoff is tunable via `settings.stale_name_cutoff_days` in the
root notes JSON. Default 14.

## 9. Edge Cases

### 9.1 Subagent sessions

Every `Agent({...})` dispatch creates a new Claude Code session with its own
session_id and its own SessionStart hook firing. Subagents are ephemeral and
should not participate in huddle coordination. Detection: `transcript_path`
contains `/subagents/<agent-id>.jsonl` for subagents vs
`/<session_id>.jsonl` for lead sessions. Both hooks check the path at the
top and exit 0 for subagents.

### 9.2 Long-running session across midnight

A session started at 23:00 and continuing past midnight never fires
SessionStart again. The rotation check in `huddle-poll.sh` (every user
prompt) catches this — the next user prompt after midnight emits the
rotation notice.

### 9.3 Compact mid-day

PreCompact hook fires, then SessionStart fires again with `source=compact`.
The identity announcement is suppressed (the agent already knew its name
pre-compaction), but the rotation check is NOT suppressed — if midnight
passed during the agent's pre-compact work, the post-compact session start
catches it.

### 9.4 Two sessions racing rotation

**Same machine:** Both sessions see "rotation needed" at the same time. Both
dispatch a rotation subagent. The lock (`rotation.lock`) serializes them. The
second subagent acquires the lock after the first finishes, re-checks the
date inside the lock, sees rotation is no longer needed, and exits 0.
Idempotent.

**Different machines (see §14):** the local lock cannot serialize across
machines, so cross-machine safety is layered: (a) `huddle-rotate.sh` pulls
before the date re-check, so a machine whose peer already rotated + pushed
sees today's date and no-ops; (b) before creating the new daily it queries
root's children and **adopts** an existing "Huddle daily `<today>`" instead of
creating a duplicate; (c) `huddle_reconcile_today` deterministically collapses
any residual duplicate (canonical = lowest id) at end of rotation and once per
session-start. The only window that produces a duplicate is two machines both
passing the date check _and_ both creating before either pushes — reconcile
cleans it on the next sync/session; rotation is lazy so the transient duplicate
is harmless.

### 9.5 Crash during rotation

If `huddle-rotate.sh` dies between creating the new today_bead and updating
the root pointers, the new bead exists but is unreferenced — effectively
an orphan. Acceptable: the next rotation creates a fresh today_bead, and
the orphan can be hand-closed later or simply ignored.

If the crash happens between updating pointers (step 4) and closing old
beads (step 7), the result is one extra open daily bead under root and an
old `today_bead` that didn't get summarized. The next rotation's first
action is "any closed daily under root without a summary in description?"
and fills in any missed summaries before proceeding with the current
rotation.

### 9.6 Name collision at register

Caught by `huddle-whoami.sh register`'s uniqueness check. See §8.3.

### 9.7 Coord root deleted or closed

If the bead pointed to by `config.json` is missing or closed, hooks
fall back to the bootstrap path. Re-running `huddle-bootstrap.sh` creates
a fresh root and rewrites the config. Comments from the old root are
preserved (we don't delete it from bd) — they're orphaned but readable.

## 10. Reading Context Budget

At session start, huddle injects approximately:

- Identity announcement: ~30 tokens
- Monthly summary description: ~50 tokens (target)
- Recent dailies (N=5, descriptions only): ~250 tokens (~50 each)
- Today's comments (via poll hook on first prompt): variable, day-bounded

Total typical injection: **~300-500 tokens** for fresh sessions, vs the
current ~5,000 tokens for PP-cvh's 60-comment dump. Order-of-magnitude
reduction, achievable because the daily summaries are intentionally tight
(no play-by-play; raw archive lives in the daily bead's `notes` field for
agents that need to drill down).

## 11. Migration

Fresh start. The current PP-cvh bead stays open as historical reference
(its 60 comments preserved, no one writes there anymore). The new
`huddle-bootstrap.sh` creates a fresh root, today's first daily, and this
month's first monthly. The coord root's `description` includes
"Historical archive: PP-cvh contains coordination activity prior to
2026-05-17." The huddle hooks point exclusively to the new root.

## 12. Implementation Split

### PR #1357 (in flight, "foundation")

- Rename cvh-_ → huddle-_
- Plugin packaging skeleton (SKILL.md, settings.json snippet, README)
- Self-documenting hooks (inline how/when/why in stdout output and in
  SKILL.md)
- The four current hooks: `huddle-poll.sh`, `huddle-session-start.sh`,
  `huddle-whoami.sh`, `huddle-rotation-check.sh` (stub that always returns
  "no rotation needed" pre-bootstrap)
- Copilot fixes already accepted (path-hashed state file, jq --arg, jq
  fail-open, xargs empty-input guard, name validation)
- Sign-off filter accepts both `—Claude-<Name>` and `—<Name>` forms
- Subagent skip via transcript_path check
- Migration NOT included — PP-cvh remains the active bead under #1357

### Follow-up PR ("rotation")

- `huddle-rotate.sh`
- `huddle-bootstrap.sh`
- Full implementation of `huddle-rotation-check.sh` (real date compare)
- Bead hierarchy creation logic
- Rotation subagent dispatch instructions (in SKILL.md)
- Migration step: bootstrap creates new root, hooks switch to it,
  PP-cvh archived
- Spec for the summarization prompt (what the LLM-driven summarizer is
  told to produce)

The follow-up PR depends on PR #1357 being merged so the renamed
foundation is on main. Brand-new bead to be filed when PR #1357 lands.

## 13. Open Questions Deferred to Implementation

- **Exact summarization prompt** for the rotation subagent — should
  produce a categorized bullet list (Merged/Ships, In-flight, Discoveries,
  Blockers) with ~30-50 tokens per category. Will be tuned in the
  follow-up PR.
- **Monthly summary format** — same shape as daily, but rollup-of-rollups.
  Likely shorter (the dailies are already summaries).
- **N default value** — starting at 5. Tunable in `settings.n_dailies_to_inject`.
- **Lock timeout** — 60s. Larger than PP-bg45's worktree lock (30s) because
  this lock covers LLM-driven summarization, which can be the slowest step.

## 14. Multi-machine model: one shared Dolt server (PP-0fwz)

The huddle runs across Tim's machines (Mac + Bazzite) with many concurrent
sessions per machine. Both machines use **one live `dolt sql-server` on Bazzite**
(`100.87.228.116:3306`, DB `PP`, user `beads`) over the tailnet, so the root bead

- its `notes` pointers, the daily/monthly beads, and every comment are a single
  shared copy — reads and writes are real-time, with no per-machine replication
  step. DoltHub (`advacar/pinpoint-beads`) is demoted to an **async bridge** for
  off-tailnet cloud sessions and off-machine backup: a systemd `--user` timer on
  Bazzite runs `bd dolt commit → pull → push` every ~15 min (see
  `scripts/beads-server/`).

This replaces the earlier "embedded Dolt on each machine, reconciled via
`bd dolt push/pull` to DoltHub" design. Two divergent writers caused the
2026-07-07 ID collision (PP-1d51) and a pile of workaround machinery; a single hot
server deletes that whole bug class.

### 14.1 Mode gate

The backend is selected per-machine by `dolt_mode` in `<main-worktree>/.beads/`
`metadata.json` (gitignored): `"server"` or `"embedded"`. `huddle_dolt_mode`
(`huddle-lib.sh`) reads it with a tolerant parse (missing file/key ⇒ `embedded`,
the safe default), resolving the main worktree the same way `huddle_state_dir`
does (linked worktrees carry only a `redirect` stub in `.beads/`). Every hot-path
`bd dolt push/pull` is gated on this:

- `huddle_sync` — **no-op** in server mode (nothing local to push/pull); the
  throttled push+pull below applies only in embedded mode.
- `huddle_discover_root` — skips the pre-query `bd dolt pull` in server mode (the
  query already hits the live shared DB).
- `huddle-rotate.sh` — skips the verified pre-rotation pull/conflict-abort, the
  post-rotation push, and the trailing reconcile pull in server mode. The
  `rotation.lock` (same-machine serialization) and adopt-existing-daily-by-title
  (cross-machine idempotency) are retained in both modes.
- `.claude/hooks/worktree-remove.sh` and `.husky/pre-push` — skip their
  `bd dolt push` flush in server mode.

Rollback is a one-line flip of `metadata.json` back to `embedded`.

### 14.2 State reads straight from beads (no caches)

Local files are machine-scoped, race-safe, and never caches of DB state:

- **Today's daily** resolves by title query — `bd children <root>` selecting the
  open `"Huddle daily <today>"` (lowest id) — not a cached `today_bead.id`. The
  root-notes id is kept only as a fast-path HINT, verified via `bd show` (open +
  titled-for-today) before it's trusted. Missing entirely ⇒ rotation self-heals by
  (re)creating it. (Fixes the PP-9lq5 dangling pointer.)
- **Root pointer** — `config.json` is a rebuildable cache: on miss or a stale id
  (`bd show` fails), `huddle_root_id` re-discovers by title query and rewrites it.
- **Recent dailies** — session-start queries `bd children <root>` by title at read
  time; the old `recent_dailies` notes array (source of the PP-9lq5 dangling
  pointers) is gone. Root notes hold only genuine pointers + settings.

### 14.3 Idempotent rotation + reconcile

Covered in §9.4: adopt-existing-daily-by-title plus a deterministic
`huddle_reconcile_today` dedup, both now operating on the single live DB (so the
"two machines created a duplicate daily before either pushed" race is largely
moot). The local `rotation.lock` serializes same-machine sessions. Daily beads are
**normal (non-ephemeral) tasks** — closed dailies must survive so session-start
can inject their summaries and rotation can roll them into the monthly; the
ephemeral+wisp marking (#1631) made them `bd purge`-eligible once closed and lost
the day's log (PP-9lq5).

### 14.4 Server-down visibility

The huddle hooks are fail-open, so a down server would otherwise silently kill
coordination on both machines. `huddle_warn_degraded` emits a throttled (~10 min)
one-line stderr `huddle degraded: beads server unreachable` when a hook's `bd`
read fails in server mode, so sessions see the degradation instead of nothing.

### 14.5 Intentionally still machine-local

`session-names.json` (self-filter) and `last-seen-<hash>` (poll cursor) stay
per-machine/per-checkout by design — a session lives on one machine, and a peer
machine's posts must not be self-filtered on yours. Stale poll cursors and old
`session-names.json.pre-prune-*` backups are swept during rotation.
