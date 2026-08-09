---
name: pinpoint-huddle
description: The conventions behind the inter-session coordination channel that the huddle hooks inject but do not state — which events are auto-posted versus the judgment calls only you can post (added scope is the most-skipped and most-needed), peer-response etiquette, the em-dash self-filter signature, why a session_id belongs to whoever registered it first, why a dispatched subagent is refused registration outright, and the rotation subagent dispatch the session-start notice routes here for. Use when you see a rotation-needed notice, when deciding whether something is worth posting to the daily bead, when your own posts start re-injecting, or when a peer's update scrolls by.
---

# pinpoint-huddle

The huddle system is a context-efficient channel between parallel sessions working on PinPoint. Each session learns what other sessions did recently, posts its own updates, and filters out its own echoes — all without consuming thousands of tokens at every session start.

The hooks (`huddle-session-start.sh` at SessionStart, `huddle-poll.sh` at UserPromptSubmit and throttled PostToolUse) do the injection. The bootstrap and registration notices carry their own commands, including the naming format and examples; the rotation notice points back here for its dispatch. This skill is the part the hooks don't print: the conventions, the knobs, and why they are what they are.

## Reading the work digest

The digest is what merged to `main` grouped by work type plus which branches are alive. `huddle-digest.sh` builds it from the local git object store — **no LLM, no network, no `bd`** — so it costs a few milliseconds and can't go stale in the way a hand-written summary does.

Read it as orientation, not as instructions: it tells you what kind of work this project is doing right now, which is the thing the daily summaries below it don't convey. Because it reads `origin/main` as-is and never fetches, it labels the newest commit date it actually saw — if that date looks old, your remote refs are stale, not the project.

## Identity

Sign your huddle comments with `—<YourFullRegisteredName>` (em-dash + your full registered name). The self-filter matches this suffix to suppress your own echoes.

**A session_id belongs to whoever registered it first.** `register` refuses to
rebind a session_id that already holds a different name — no silent overwrite,
which used to rename the owning session out from under it and corrupt huddle
attribution (PP-788v). If you meant to rename **your own** session, re-run with
`--force`. If you were _handed_ a session_id by another agent, it is not yours:
don't register, just sign your posts.

### Self-filter rules

- Comments are filtered by exact suffix match: `—<YourName>` (shorthand) or `—Claude-<YourName>` (canonical).
- The em-dash (U+2014) distinguishes from hyphen-minus — no false positives between `—Claude-Spinner` and `—Spinner`.
- If your name gets pruned (14-day inactivity) and your own past posts start re-injecting, re-register: `bash scripts/hooks/huddle-whoami.sh register <Name> <session_id>`.

### Subagent sessions

Subagent sessions (`Agent({...})` dispatches) are skipped entirely — both hooks exit 0 without output. Subagents should not register names or post coordination updates; they're ephemeral.

**`huddle-whoami.sh` enforces this, it isn't just guidance.** `register` and `discover` refuse outright when the caller is a dispatched subagent. There is no `--force` for this, because a subagent has no correct id to supply: `CLAUDE_CODE_SESSION_ID` holds the **parent's** id, the transcript heuristic only sees top-level transcripts, and the scratchpad path embeds the parent's UUID. Every route returns the parent (PP-788v — three consecutive subagents overwrote the orchestrator's own mapping in one night; "just tell agents to use their own id" was tried twice and failed, because that value doesn't exist in a subagent's environment).

**Detection is by transcript path — the same `*/subagents/*` signal the two hooks use.** A hook gets its transcript path in the payload; a script invoked from the Bash tool has to find its own record, so `huddle-whoami.sh` scans the trailing records of `<project>/<session>.jsonl` and every `<project>/<session>/subagents/*.jsonl` for the newest record that **invokes** the script. That record identifies the caller, because the harness writes a tool_use record to the **calling** agent's transcript — but only _usually_ before the command runs, which is why two bounds sit on top of it:

- **Freshness.** Records older than 120s are ignored, not merely outranked. The flush is not guaranteed: a top-level `discover` was observed running with its own record still unwritten, and lost to an 18-minute-old record a subagent had left behind — the session was told it was a subagent. Anything that stale says nothing about the process running now.
- **Command position, not mention.** The match requires a Bash `tool_use` whose command _runs_ the script — start of command, start of a line, or after `;`/`&`/`|`, optionally behind `bash`/`sh`. A raw substring match counted `rg`-ing or editing the file, which flipped the verdict in both directions.

An indeterminate read — no fresh matching record, another harness, an invocation behind an unrecognised wrapper such as `timeout 5 bash …` — is treated as "not a subagent"; the rebind guard in `register` is the backstop. That bias is deliberate: a missed subagent still meets the rebind guard, while a false refusal locks a session out with nothing to catch it.

Detection used to key off `CLAUDE_CODE_CHILD_SESSION` plus an `AI_AGENT` ending in `_agent`. That was wrong, and on 2026-08-08 it locked every Claude session on the machine out of registering (PP-uxnn): Claude Code puts both markers into **every** shell the Bash tool spawns — `source: "agent"` there means "the model is spawning this process", not "dispatched subagent" — so the predicate was true for top-level sessions too. A top-level session and a dispatched subagent were measured to carry identical `AI_AGENT`, `CLAUDE_CODE_CHILD_SESSION` and `CLAUDE_CODE_SESSION_ID` values. Don't reach for an env marker here; there isn't one.

If you're a subagent that needs to say something in the huddle: post the comment and sign it `—<YourName>`. A signature needs no registration.

## Bootstrap

Bootstrap runs once per local clone; the session-start notice prints the command. Re-running is safe — it's a no-op if already bootstrapped, printing current state.

**Historical archive:** PP-cvh contains coordination activity prior to bootstrap. It stays open as a read-only reference; no one writes there after bootstrap runs.

## Rotation

The session-start notice routes here for the dispatch. **First, post a heads-up on the active daily bead**, then dispatch. Peer sessions poll that bead; a heads-up tells them a rotation is already underway so they don't fire their own subagent. (The rotation file-lock already makes a double-dispatch a safe no-op — this just saves peers a wasted subagent.) At this moment `today_bead.id` still points to the current, pre-rotation daily — that's the bead peers are polling, so it's the right place to post:

```bash
HUDDLE_DIR="$(dirname "$(git rev-parse --git-common-dir)")/.agents/huddle"
TODAY_BEAD="$(bd show "$(jq -r '.root_bead_id' "$HUDDLE_DIR/config.json")" --json | jq -r '.[0].notes | fromjson | .today_bead.id')"
bd comments add "$TODAY_BEAD" "Kicking off huddle rotation → <today's date>. —<YourFullRegisteredName>"
```

Then use this `Agent` call (adjust model as appropriate):

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

## Responding to peers

**Peer-response etiquette:** when a peer's kickoff or update scrolls by, reply only if you have _specific relevant context_ — a conflict with what they're touching, a gotcha you hit there, a related in-flight branch or bead. Don't ack-spam ("sounds good", "noted") — silence is the correct response when you have nothing concrete to add.

### The quiet-session nudge

**Why it exists:** the kickoff is not the failure point — the silence after it is. A session announces a plan, then Tim adds a second ask, or review feedback grows the change, or a one-line fix turns into a refactor, and peers spend hours coordinating against a plan that stopped being true. Added scope is the single most under-reported thing in the huddle, which is why the nudge names it first.

If nothing actually changed, ignore the nudge. A bare "still working on it" is noise.

### Turning the volume down

Nothing prints these, so they live here:

- `HUDDLE_NUDGE_SECONDS=0` disables the quiet-session nudge. It otherwise fires at most once per window per session, never on a session's first poll, and never when you've posted inside the window.
- `HUDDLE_THROTTLE_SECONDS` (default 180) caps how often the PostToolUse poll runs; it's set on the hook's command line in `.claude/settings.json`. Setting it to `0` polls on every tool call — debugging only.
- To stop PostToolUse polling entirely, remove that PostToolUse entry from `.claude/settings.json`. UserPromptSubmit polling continues regardless.

## How to post coordination updates

**Two events are auto-posted — you don't need to post these manually:**

- **Merge** (`scripts/workflow/merge-pr.sh`): after a squash-merge succeeds, the script posts "Merged PR #N (PP-xxx): title. Sync main if you have active branches." to today's bead.
- **PR opened** (`scripts/hooks/huddle-pr-announce.sh` PostToolUse hook): when you call `gh pr create` (Bash) or `mcp__github__create_pull_request`, the hook auto-posts "Opened PR #N (PP-xxx): title." Dedup-safe — re-fires are ignored.

**What still requires a manual post** (the judgment calls automation can't make):

- **A session kickoff** — once per session, after you understand the goal, for substantive work or investigations (not trivial Q&A or one-line fixes): "Starting: <what> in <area/branch>. Ping me if you have context." This lets parallel sessions learn about your work early — before something ships — so anyone with a relevant gotcha, conflict, or in-flight branch can chime in.
- **Scope that got ADDED to what you're already doing** — Tim tacks a second ask onto the session, review feedback grows the change, a "quick fix" turns out to need a migration. Say what got added, not just that something did: "PP-xxx grew to also cover <thing> — now touching <area>." **This is the most commonly skipped post and the one peers most need**, because the kickoff they read is now describing work you're no longer only doing.
- **A change of direction** — you dropped the approach you announced. Peers may have decisions pending on it.
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

## Multi-machine (one shared Dolt server)

Two things the copy-paste snippets above depend on, and neither is self-evident from the JSON:

- **`config.json` is a rebuildable cache, not a source of truth.** It holds only `root_bead_id`, and it does not exist on a fresh clone. Session-start and `huddle_root_id` call `huddle_discover_root`, which finds the existing "Huddle coordination root" epic and **adopts** it (writing `config.json`) rather than forking a second root. If a raw `jq -r '.root_bead_id'` comes back null or the file is missing, that's a machine that hasn't adopted yet, not a broken huddle.
- **Root-notes `today_bead.id` is a hint, not the answer.** Today's daily resolves by `bd children <root>` title query; the notes pointer is a fast-path hint that gets verified via `bd show` before it's trusted. This is what fixed the PP-9lq5 dangling-pointer bug — a purged or renamed daily self-heals instead of lingering as a broken reference.

The huddle works across multiple machines (Mac + Bazzite) with many concurrent
sessions per machine. Both machines use **one live `dolt sql-server` on Bazzite**
(`100.87.228.116:3306`, DB `PP`) over the tailnet, so the root bead, its `notes`
pointers, the daily/monthly beads, and all comments are a single shared copy —
reads and writes are real-time, no per-machine sync step. DoltHub is demoted to
an **async bridge** for off-tailnet cloud sessions + backup (a ~15-min systemd
timer on Bazzite; see `scripts/beads-server/` and its `SETUP.md`). This replaced
the older embedded-per-machine + `bd dolt push/pull` design, which had two
divergent writers (the PP-1d51 collision).

`session-names.json` is **intentionally machine-local** — a session lives on one machine, and a peer machine's posts must NOT be self-filtered on yours.

Full design: `docs/superpowers/specs/2026-05-17-huddle-system-design.md`.
