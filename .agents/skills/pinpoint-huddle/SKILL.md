---
name: pinpoint-huddle
description: Inter-session coordination via PP-cvh comments injected by SessionStart, UserPromptSubmit, and (throttled) PostToolUse hooks. Use when you see a huddle identity announcement, an injected PP-cvh comments block, want to register a session name, want to tune the PostToolUse throttle, or want to understand how parallel Claude sessions coordinate without re-injecting their own posts.
---

# pinpoint-huddle

> **Use when:** you see a huddle SessionStart announcement or want to understand
> the inter-session coordination system. Triggers on "huddle", "PP-cvh",
> "coordination bead", "identity announcement", "rotation needed".

The huddle system is a context-efficient channel between parallel Claude Code
sessions working on PinPoint. Each session learns what other sessions did
recently, posts its own updates, and filters out its own echoes — all without
consuming thousands of tokens at every session start.

## What you'll see at session start

The `huddle-session-start.sh` hook (registered in project-level
`.claude/settings.json`) fires when your session opens. It outputs one of two
blocks into your context:

### Identity announcement (you're registered)

    ## Huddle identity

    Your session_id: `<UUID>`
    Registered as: **Claude-<Name>** (self-filter active for your own posts)

    If this scrolls out of context later, recall your name with:
        bash scripts/hooks/huddle-whoami.sh whoami <UUID>

You're ready. The poll hook (next section) will filter out comments you
yourself posted. Sign your PP-cvh comments with `—Claude-<YourName>` (em-dash,
canonical).

### Registration needed (you're new)

    ## Huddle identity — registration needed

    Your session_id: `<UUID>`

    When you receive your first user prompt, derive a short descriptive name
    for yourself from what you're being asked to do. ...

Read the full notice, derive a name from your first user prompt, and register:

    bash scripts/hooks/huddle-whoami.sh register <YourName> <session_id>

**Naming rules:**

- Short, descriptive of the work (CamelCase, ASCII, under ~20 chars)
- Examples: `WorktreeHookFix`, `TestAudit`, `DesignBible`, `DocsSync`, `RotationDesign`
- DO NOT use bead IDs or PR numbers (they don't help Tim recognize sessions)
- DO NOT use generic labels like `Worker1`
- If the name's taken, the helper suggests variations; pick one and retry

## What you'll see during normal work

The `huddle-poll.sh` hook fires from two events:

- **`UserPromptSubmit`** — always polls before each user turn (unthrottled).
- **`PostToolUse`** — polls at most once every `HUDDLE_THROTTLE_SECONDS`
  seconds (default 180 = 3 min). Most tool calls hit a fast-path skip
  (~10–30 ms wall clock) — the bd/jq slow path only runs at the throttle
  cadence. This closes the gap for orchestrator-style sessions that go long
  stretches between user prompts.

When the hook finds new comments since this worktree's last cursor, it injects
them as a system-reminder block:

    ## New PP-cvh coordination comments (N)

    **<author>** (<timestamp>):
    <comment text>
    ...

Comments signed by your own session (matching `—Claude-<YourName>` or
`—<YourName>`) are filtered out — you won't see your own posts re-injected.

If nothing's new, no block appears (zero tokens).

### Throttle override

To change the PostToolUse throttle interval, edit `.claude/settings.json`
and update `HUDDLE_THROTTLE_SECONDS=180` on the PostToolUse hook command line.
Lower means more frequent polling — e.g. `60` for once-per-minute. **Setting
the value to `0` (or removing the env var) makes the script poll on every
tool call**, which is heavy bd load — useful for debugging only. To stop
PostToolUse polling entirely, remove the entire PostToolUse entry from
`.claude/settings.json` (UserPromptSubmit polling continues regardless).

Subagent sessions (`Agent({...})` dispatches) are skipped on both events
without writing the throttle marker, so a subagent's tool calls don't
advance its parent agent's throttle clock.

## How to post coordination updates

Use `bd comments add PP-cvh "..."` with your sign-off. Example:

    bd comments add PP-cvh "Merged PR #1361 (PP-pno7 worktree hook fix). Sync main if you have active branches. —Claude-Slingshot"

Things worth posting:

- A PR you merged ("Merged PR #N (bead X). Sync main if you have active branches.")
- A PR you opened ("Opened PR #N (bead X): brief title.")
- A bead you filed for a non-obvious finding ("Filed PP-XXXX: <finding>.")
- A coordination need ("Working on file Y in branch Z; flag if conflict.")

Things NOT worth posting:

- Every single commit
- Internal debugging chatter
- "I started working on X" (only post merge/discovery; agents read each
  other's outputs after the fact, not real-time)

## Scripts

| Script                                   | Trigger                                    | Purpose                                                |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `scripts/hooks/huddle-poll.sh`           | UserPromptSubmit + PostToolUse (throttled) | Inject new PP-cvh comments since last_seen             |
| `scripts/hooks/huddle-session-start.sh`  | SessionStart                               | Identity announcement; rotation check (currently stub) |
| `scripts/hooks/huddle-whoami.sh`         | manual                                     | Register/lookup/list/discover session→name mappings    |
| `scripts/hooks/huddle-rotation-check.sh` | sourced by both hooks                      | Date-compare for daily rotation (stub in PR #1357)     |
| `scripts/hooks/huddle-lib.sh`            | sourced by all hooks                       | Shared helpers (state-dir resolver)                    |

## State files (all under `<main-worktree>/.claude/huddle/`)

The state directory is shared across all linked worktrees of the same clone
(resolved via `git rev-parse --git-common-dir`). `.claude/huddle/` is
git-ignored so the state stays machine-local.

| File                    | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `session-names.json`    | `{session_id: name}` map (canonical)                         |
| `last-seen-<path-hash>` | Per-checkout poll cursor (most-recent injected `created_at`) |
| `rotation.lock`         | flock target (rotation PR only)                              |
| `config.json`           | Root bead ID + schema version (rotation PR only)             |

Plus one per-worktree file outside the shared state dir:

| File                                            | Purpose                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `$CLAUDE_PROJECT_DIR/.claude/.huddle-last-poll` | Throttle marker (epoch seconds) for PostToolUse; gates the fast-path skip |

## Self-filter rules

- Comments are filtered out by exact suffix match on the **em-dash** form: either `—Claude-<YourName>` (canonical, em-dash + "Claude-" + name) or `—<YourName>` (shorthand).
- The em-dash (U+2014) distinguishes from hyphen-minus: `—Claude-Spinner` does NOT end with `—Spinner` because the byte preceding "Spinner" is a hyphen-minus in "Claude-Spinner", not an em-dash. So no false positives.
- If your name's mapping gets pruned (the rotation PR adds a 14-day inactivity prune) and your own past posts start re-injecting, just re-register: `bash scripts/hooks/huddle-whoami.sh register <Name> <session_id>`.

## Subagent sessions

Subagent sessions (any `Agent({...})` dispatch) are skipped entirely. Detection:
`transcript_path` contains `/subagents/<agent-id>.jsonl`. Both hooks exit 0
without output for subagents. Subagents shouldn't register names or post on
PP-cvh — they're ephemeral.

## What this PR (foundation) doesn't yet include

- **Daily rotation:** PP-cvh remains the single coordination bead. The follow-up
  rotation PR adds daily summary beads, monthly rollups, and a rotation
  subagent that runs at the first session of a new local day.
- **Stale name pruning:** the 14-day name-freeing happens during rotation; not
  yet active.
- **Bootstrap:** the huddle root bead doesn't exist yet because rotation isn't
  shipped. PP-cvh acts as the implicit root.

Full design at `docs/superpowers/specs/2026-05-17-huddle-system-design.md`.
