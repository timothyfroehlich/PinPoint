---
name: pinpoint-huddle
description: Inter-session coordination via daily/monthly beads injected by SessionStart, UserPromptSubmit, and (throttled) PostToolUse hooks. Manages bootstrap, daily rotation, identity registration, and self-filter. Use when you see a huddle identity announcement, a rotation-needed notice, injected coordination comments, or want to post an update for other sessions to read.
---

# pinpoint-huddle

> **Use when:** you see a huddle SessionStart announcement, a rotation-needed notice, or want to understand the inter-session coordination system. Triggers on "huddle", "coordination bead", "identity announcement", "rotation needed", "bootstrap".

The huddle system is a context-efficient channel between parallel sessions working on PinPoint. Each session learns what other sessions did recently, posts its own updates, and filters out its own echoes — all without consuming thousands of tokens at every session start.

## What you'll see at session start

The `huddle-session-start.sh` hook fires when your session opens. It outputs one of these blocks:

### Bootstrap needed (system not initialized)

    ## ⚠️ Huddle not bootstrapped

    The huddle coordination system is not set up yet. ...

    To bootstrap, run:
        bash scripts/hooks/huddle-bootstrap.sh

Run the command, then start or resume your session normally. Bootstrap is idempotent — safe to re-run.

### Rotation needed (day has rolled)

    ## ⚠️ Huddle rotation needed

    The active coordination bead points to date <STORED_DATE>, but today is <NOW_DATE>.
    Before continuing, dispatch the rotation subagent ...

**Stop and dispatch the rotation subagent before continuing your work.** See the "Rotation" section below for the exact dispatch.

### Identity announcement (you're registered)

    ## Huddle identity

    Your session_id: `<UUID>`
    Registered as: **Claude-<Name>** (self-filter active for your own posts)

You're ready. Sign your huddle comments with `—<YourName>` (em-dash + your full registered name).

### Registration needed (you're new or pruned)

    ## Huddle identity — registration needed

    Your session_id: `<UUID>`
    ...

Read the full notice, derive a name from your first prompt, and register:

    bash scripts/hooks/huddle-whoami.sh register <YourName> <session_id>

**Naming rules:**

- Format: `<Harness>-<Topic>` (CamelCase, ASCII, under ~30 chars)
- Examples: `Claude-WorktreeHookFix`, `Antigravity-TestAudit`, `Codex-DesignBible`
- DO NOT use bead IDs, PR numbers, or generic labels like `Worker1`
- If the name's taken, the helper suggests variations; pick one and retry

### Recent activity summary (follows identity)

After the identity block, session-start injects this month's coordination summary and the descriptions of the N most-recent daily beads (default N=5). This is the context that replaced the old PP-cvh comment dump — ~300 tokens vs ~5,000.

## Bootstrap

The huddle system must be bootstrapped once per local clone before it activates. If you see the "not bootstrapped" notice at session start, run:

    bash scripts/hooks/huddle-bootstrap.sh

This creates:

- A root epic bead (permanent — never closes)
- Today's daily bead (child of root — accepts coordination comments)
- This month's monthly bead (child of root — collects daily summaries)
- `.agents/huddle/config.json` with the root bead ID
- Root bead notes JSON with pointers (§4.2 schema)

Re-running is safe — it's a no-op if already bootstrapped, printing current state.

**Historical archive:** PP-cvh contains coordination activity prior to bootstrap. It stays open as a read-only reference; no one writes there after bootstrap runs.

## Rotation

When the `today_bead.date` in root notes doesn't match today's local date, hooks emit a "rotation needed" notice. **You must dispatch a rotation subagent before continuing your work.**

### Rotation subagent dispatch

Use this `Agent` call (adjust model as appropriate):

```javascript
Agent({
  subagent_type: "claude",
  model: "claude-sonnet-4-5",
  prompt: `
You are the huddle rotation subagent. Your job is to rotate the daily coordination bead.

**Phase A — run the shell script:**

  output=$(bash scripts/hooks/huddle-rotate.sh)
  echo "$output"

Parse the output for key=value lines:
- OLD_TODAY=<id>       — yesterday's daily bead to summarize + close
- OLD_MONTHLY=<id>     — last month's monthly bead (only present if month rolled)
- OLD_MONTH=<name>     — the month label (e.g. "2026-05") of the old monthly
- NEW_TODAY=<id>       — today's fresh daily bead (now active)
- NEW_MONTHLY=<id>     — current monthly bead
- ROTATION_DATE=<date> — the rotation date

If the script exits 0 with no output, a peer already rotated — exit immediately
with "No-op: peer rotated first."

**Phase B — LLM summarization (only if OLD_TODAY is present):**

1. Fetch OLD_TODAY's comments:
     bd comments <OLD_TODAY> --json

2. Write a tight categorized summary into OLD_TODAY's description:
   - Categories (omit empty ones): Merged/Ships, In-flight, Discoveries, Blockers
   - ~30-50 tokens per category; bullet list per category
   - Run: bd update <OLD_TODAY> --description "<summary>"

3. Archive raw comments into OLD_TODAY's notes (JSON array for forensics):
   - Format: [{"author":"...","created_at":"...","text":"..."},...]
   - Run: bd update <OLD_TODAY> --notes '<json-array>'

4. Close OLD_TODAY:
     bd close <OLD_TODAY>

5. If month rolled (OLD_MONTHLY present):
   a. Read OLD_MONTHLY's comments or collect recent daily descriptions for that month
   b. Write monthly rollup summary into OLD_MONTHLY's description
   c. Close OLD_MONTHLY: bd close <OLD_MONTHLY>

6. Prune stale session names (§8.4 of the design spec):
   a. Read .agents/huddle/session-names.json
   b. For each {session_id: name} entry, scan the last 14 days of huddle content
      (today's bead + recent daily archives + monthly summaries) for sign-offs
      matching "—<name>" or "—Claude-<name>"
   c. Evict entries with no match in 14 days
   d. Write the pruned map back to session-names.json

After phase B, report: "Rotation complete. OLD_TODAY=<id> closed. NEW_TODAY=<id> active."
`,
});
```

The subagent acquires a file lock in phase A. If a peer session already rotated, phase A exits immediately — safe to dispatch even if you're unsure.

## What you'll see during normal work

The `huddle-poll.sh` hook fires from two events:

- **`UserPromptSubmit`** — always polls before each user turn (unthrottled).
- **`PostToolUse`** — polls at most once every `HUDDLE_THROTTLE_SECONDS` seconds (default 180 = 3 min).

When the hook finds new comments since this worktree's last cursor, it injects them:

    ## New huddle coordination comments (N)

    **<author>** (<timestamp>):
    <comment text>
    ...

Comments signed by your own session (matching `—<YourName>` or `—Claude-<YourName>`) are filtered out — you won't see your own posts re-injected.

**Peer-response etiquette:** when a peer's kickoff or update scrolls by, reply only if you have _specific relevant context_ — a conflict with what they're touching, a gotcha you hit there, a related in-flight branch or bead. Don't ack-spam ("sounds good", "noted") — silence is the correct response when you have nothing concrete to add.

### Throttle override

Edit `.claude/settings.json` and update `HUDDLE_THROTTLE_SECONDS=180` on the PostToolUse hook command line. Setting it to `0` polls on every tool call — useful for debugging only. To stop PostToolUse polling entirely, remove the entire PostToolUse entry from `.claude/settings.json` (UserPromptSubmit polling continues regardless).

## How to post coordination updates

**Two events are auto-posted — you don't need to post these manually:**

- **Merge** (`scripts/workflow/merge-pr.sh`): after a squash-merge succeeds, the script posts "Merged PR #N (PP-xxx): title. Sync main if you have active branches." to today's bead.
- **PR opened** (`scripts/hooks/huddle-pr-announce.sh` PostToolUse hook): when you call `gh pr create` (Bash) or `mcp__github__create_pull_request`, the hook auto-posts "Opened PR #N (PP-xxx): title." Dedup-safe — re-fires are ignored.

**What still requires a manual post** (the judgment calls automation can't make):

- **A session kickoff** — once per session, after you understand the goal, for substantive work or investigations (not trivial Q&A or one-line fixes): "Starting: <what> in <area/branch>. Ping me if you have context." This lets parallel sessions learn about your work early — before something ships — so anyone with a relevant gotcha, conflict, or in-flight branch can chime in.
- A bead you filed for a non-obvious finding: "Filed PP-xxx: <finding>."
- A coordination need — file/area conflict risk: "Working on <file/area> in <branch>; flag if conflict."

To post, find today's bead ID (the session-start hook reported it, or look it up):

    HUDDLE_DIR="$(dirname "$(git rev-parse --git-common-dir)")/.agents/huddle"
    bd show "$(jq -r '.root_bead_id' "$HUDDLE_DIR/config.json")" --json | jq -r '.[0].notes | fromjson | .today_bead.id'

Then post:

    bd comments add <TODAY_BEAD_ID> "Your update here. —<YourName>"

Things NOT worth posting:

- Every single commit
- Internal debugging chatter
- A _bare_ status ping with no scope or invitation ("I started working on X") — that's noise. But a **scoped kickoff with an invitation** (specific area/branch + "ping me if you have context") **is** worth posting, once per session, for substantive work — see "What still requires a manual post" above.

Sign with `—<YourFullRegisteredName>` (em-dash + your registered name). The self-filter matches this suffix to suppress your own echoes.

## Scripts

| Script                                   | Trigger                                                  | Purpose                                                                                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/hooks/huddle-bootstrap.sh`      | manual (one-time)                                        | Init root epic + daily + monthly + config.json                                                                                                                                                    |
| `scripts/hooks/huddle-rotate.sh`         | rotation subagent                                        | Phase A: atomic create-and-pointer-update; outputs OLD/NEW bead IDs                                                                                                                               |
| `scripts/hooks/huddle-poll.sh`           | UserPromptSubmit + PostToolUse (throttled)               | Inject new today_bead comments since last_seen                                                                                                                                                    |
| `scripts/hooks/huddle-session-start.sh`  | SessionStart                                             | Bootstrap notice, rotation notice, identity, summary injection                                                                                                                                    |
| `scripts/hooks/huddle-pr-announce.sh`    | PostToolUse (`Bash`\|`mcp__github__create_pull_request`) | Auto-post PR-open notice; dedup + fail-open                                                                                                                                                       |
| `scripts/hooks/huddle-whoami.sh`         | manual                                                   | Register/lookup/list/discover session→name mappings                                                                                                                                               |
| `scripts/hooks/huddle-rotation-check.sh` | sourced by both hooks                                    | Date-compare: returns 0 if today_bead.date < today                                                                                                                                                |
| `scripts/hooks/huddle-lib.sh`            | sourced by all hooks                                     | Shared helpers: state-dir + today-bead resolvers; `huddle_sync` (per-machine throttled Dolt push+pull), `huddle_discover_root` (fork-proof adopt), `huddle_reconcile_today` (cross-machine dedup) |

## State files

All under `<main-worktree>/.agents/huddle/` (shared across all linked worktrees via `git rev-parse --git-common-dir`). Git-ignored — machine-local.

| File                    | Purpose                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.json`           | `{"root_bead_id": "PP-xxx"}` — written by bootstrap, or auto-adopted on a fresh machine (see Multi-machine)                                                                           |
| `session-names.json`    | `{session_id: name}` map (canonical for self-filter). **Intentionally machine-local** — a session lives on one machine, and a peer machine's posts must NOT be self-filtered on yours |
| `last-seen-<path-hash>` | Per-checkout poll cursor (newest injected `created_at`)                                                                                                                               |
| `last-pull`             | **Per-machine** Dolt-sync throttle marker (epoch seconds). Shared across all worktrees/sessions of the clone so one sync per interval serves them all                                 |
| `pull.lock`             | Non-blocking flock/lockf target so exactly one session syncs when many fire at once                                                                                                   |
| `rotation.lock`         | flock/lockf target for same-machine rotation serialization                                                                                                                            |

Plus one per-worktree file outside the shared state dir:

| File                                            | Purpose                                                   |
| ----------------------------------------------- | --------------------------------------------------------- |
| `$CLAUDE_PROJECT_DIR/.agents/.huddle-last-poll` | Throttle marker (epoch seconds) for PostToolUse fast-path |

## Bead hierarchy

```
Huddle Root  (epic, never closes)                   ── PP-XXXX
  notes JSON: today_bead, monthly_bead, recent_dailies, settings, last_rotation
  │
  ├── Daily 2026-05-20  ── PP-AAAA  (open; receives coordination comments today)
  ├── Daily 2026-05-19  ── PP-CCCC  (closed; summary in description, archive in notes)
  │     ... older dailies ...
  │
  ├── Monthly 2026-05   ── PP-BBBB  (open until month rolls)
  └── Monthly 2026-04   ── PP-EEEE  (closed; rollup summary)
```

## Multi-machine (sync across Tim's machines)

The huddle works across multiple machines (Mac + Bazzite) with many concurrent
sessions per machine. It rides the beads sync backbone: beads is \*\*Dolt embedded

- a DoltHub remote\*\* (`sync.remote` in `.beads/config.yaml`), so the root bead,
  its `notes` pointers, the daily/monthly beads, and all comments already sync via
  `bd dolt push` / `bd dolt pull`. Three machine-local mechanisms make that
  seamless:

* **Throttled per-machine sync.** `huddle_sync` (in `huddle-lib.sh`, called by
  the session-start and poll hooks) does `bd dolt push` then `pull`, gated by the
  shared `last-pull` marker + non-blocking `pull.lock`. One sync per
  `HUDDLE_SYNC_SECONDS` (default 180) per machine serves **every** session on it
  — not one-per-session. Fully fail-open: offline or bd errors never block a
  prompt; local coordination keeps working, and the next successful sync catches
  up. Peer posts land in your context within one interval.
* **Fresh-machine auto-adopt (no fork).** `config.json` (the `root_bead_id`
  pointer) is machine-local. On a machine that cloned + synced the beads but
  never ran bootstrap, session-start calls `huddle_discover_root` — finds the
  existing "Huddle coordination root" epic in the synced DB and **adopts** it
  (writes `config.json`) instead of nagging or forking a duplicate root.
  `huddle-bootstrap.sh` does the same discover-and-adopt before ever creating a
  root, so it's safe to run on any machine.
* **Idempotent cross-machine rotation.** `huddle-rotate.sh` pulls first (so a
  peer that already rotated is seen and this machine no-ops), then **adopts** an
  existing "Huddle daily `<today>`" instead of creating a duplicate, then pushes.
  A deterministic `huddle_reconcile_today` safety-net (run at end of rotation and
  once per session-start) collapses any rare double-create to the canonical
  (lowest id), closing the loser — every machine picks the same winner, so they
  converge.

## Self-filter rules

- Comments are filtered by exact suffix match: `—<YourName>` (shorthand) or `—Claude-<YourName>` (canonical).
- The em-dash (U+2014) distinguishes from hyphen-minus — no false positives between `—Claude-Spinner` and `—Spinner`.
- If your name gets pruned (14-day inactivity) and your own past posts start re-injecting, re-register: `bash scripts/hooks/huddle-whoami.sh register <Name> <session_id>`.

## Subagent sessions

Subagent sessions (`Agent({...})` dispatches) are skipped entirely. Detection: `transcript_path` contains `/subagents/`. Both hooks exit 0 without output. Subagents should not register names or post coordination updates — they're ephemeral.

Full design: `docs/superpowers/specs/2026-05-17-huddle-system-design.md`.
