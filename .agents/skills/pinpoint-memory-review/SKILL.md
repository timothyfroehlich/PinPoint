---
name: pinpoint-memory-review
description: Weekly curated pass over everything recorded about how we work — beads memories, Claude auto-memories on both the Mac and Bazzite, and the canonical context files. Prunes stale facts, promotes and demotes between tiers, dedupes across tiers, hands Tim a short veto list, then applies the verdicts on both machines. Use when the weekly chores checklist reaches the memory item, or when Tim says "memory review", "review memories", or asks what has been recorded. **Auditing the contents of skills is explicitly out of scope** — this pass covers recorded facts, not the skill corpus.
---

# pinpoint-memory-review

> **Use when:** the weekly `chores` pass reaches its memory item, or Tim says "memory review" / "review the memories" / "what have you been recording". Triggers on "memory review", "review memories", "context review".

A curation pass, not a capture mechanism. It reads every store of recorded context across both machines, works out what is stale, misplaced, or duplicated, and applies **only what Tim approves**.

It is also the sync mechanism. Claude auto-memory is per-machine and syncs nowhere — the store directory name encodes the absolute repo path, so the Mac and Bazzite hold entirely separate sets. Nothing else closes that gap, which bounds divergence at roughly one week.

**Not for:** writing a single memory during normal work (just write it), or auditing skill contents (explicitly out of scope — see Constraints).

## Phase 1 — collect

Nothing here writes anything.

```bash
REPO="$(git rev-parse --show-toplevel)"

# This machine
python3 scripts/memory_review/collect_stores.py --repo "$REPO" > /tmp/mr-local.json

# The other machine. The script is piped over stdin on purpose: non-interactive
# SSH on Bazzite sources no shell config, so brew is off PATH - but
# /usr/bin/python3 is always there.
ssh bazzite 'python3 - --repo /var/home/froeht/Code/PinPoint' \
  < scripts/memory_review/collect_stores.py > /tmp/mr-bazzite.json

# Beads memories (needs `bd`, a subprocess, so it is not in the collector)
bd memories
```

⚠️ If Bazzite is unreachable, try `bazzite-lan` before concluding anything is wrong — and note that **`tailscale ping` succeeding proves nothing**, since disco pings ride outside WireGuard. A 1.96.4 magicsock bug once made the tailnet look perfectly healthy while dropping every byte of data.

Each inventory reports `memory_stores[]` with a `scope`, plus `context_files[]`, `rules` (whose `exists` is `false` until PP-22e4 PR 8 lands), and `skills[]`.

**The corpus is `project` + `home` + `worktree` only.** `~/.claude/projects` holds a store for every repo Tim has ever opened, and those come back as **`other-project`** — read them for context if you like, but never verify, dedupe, or propose changes to them. They belong to a different project. Passing a worktree path as `--repo` is fine; the collector resolves it back to the main checkout, which is where the memories that matter live.

**Read the index drift for free.** Compare each store's `index.pointers` against its `entries[].file`:

- a pointer with no file → an index line pointing at a deleted memory
- a file with no pointer → a memory unreachable by recall, because the index is what gets loaded

## Phase 2 — verify, fanned out to subagents

The corpus is around 48 items. Batch at roughly six per subagent (~8 subagents) and give each batch **end-to-end ownership**, so no two agents need the same context.

Each subagent does three things for its batch:

1. **Verify every claim against reality.** Referenced beads still exist and are still open or closed as described; referenced branches merged or abandoned; referenced files, paths, and symbols still present; `package.json` scripts still defined; pinned versions still current. Claims about Bazzite are checked over SSH.
2. **Hunt duplication** across the other tiers. ⚠️ **Use `rg --hidden`** — default `rg` skips dotfile directories, so `.agents/` and `.claude/` are invisible and a sweep will report false-clean.
3. **Propose a routing verdict** per item, against `references/routing.md`.

Have each subagent return a compact structured verdict per item — the memory's name, what it checked, what it found, and a proposed action — not prose.

## Phase 3 — synthesise

Assemble every verdict into one table and **keep it in context**. Tim will ask follow-ups on individual items, and answering by re-reading the corpus wastes the fan-out. The lead holds the detail; the subagents are gone.

Then split the proposals in two:

- **Silent** — propagating a fact the other machine already verified, repairing a broken `[[wiki-link]]`, adding a missing index line, collapsing an exact restatement, correcting a stale bead ID. High volume, no judgment.
- **Consequential** — deletions, merges that drop detail, cross-tier moves, and anything resting on circumstantial evidence.

## Phase 4 — the veto gate

**Present in-session. Never as a document.** Tim skims long documents and will rubber-stamp them, which turns the veto into theatre and defeats the whole review.

- Apply the silent tier immediately. Log what was done in one line.
- Present the consequential tier as a **numbered list, one line each, topic only** — no rationale, no evidence. Hold all of that for follow-up.

He replies conversationally: _"kill 2 and 5, tell me about 7."_ Produce detail on demand, one item at a time.

Facts only he can adjudicate (the `feedback_*` class) are **questions, not proposals**, and only when there is a signal — see the exception section in `references/routing.md`. Never run a weekly roll-call over them.

## Phase 5 — apply

```bash
# Local snapshot first - the memory store has no undo without it
python3 scripts/memory_review/snapshot_stores.py

# ...apply the approved local changes...

# Then the other machine. It snapshots there before touching anything.
bash scripts/memory_review/apply_remote.sh --manifest /tmp/mr-manifest.json
```

`apply_remote.sh` hands the remote half to **Bazzite's own Claude** rather than writing its files over SSH, so each machine's memories are written by that machine's agent using whatever the sanctioned mechanism is at the time. Flags:

- `--dry-run` — snapshot the remote and stop, shipping nothing.
- `--stage-only` — snapshot, ship the manifest, and print a prompt for Tim to run by hand in an interactive session there.
- `--host bazzite-lan` — when the tailnet is the suspect.

The remote agent may **dispute** an action; a disputed item is left unapplied and reported. **Do not renegotiate it** — surface it to Tim and move on. Two agents arguing is how this gets expensive and oscillates.

Report at the end: what applied, what was skipped, what is waiting on Tim.

## Phase 6 — close out

Note findings as a comment on the weekly chores bead, then re-defer it a week out per `pinpoint-chores`. File beads for anything actionable that the review itself should not fix.

## Constraints

- **Never audit skill contents.** The review may propose "this fact belongs in skill X", but it does not read skills hunting for problems. Out of scope by decision — it is too much for one pass.
- **Home-scope memories are reviewed but not propagated** by default. Several are machine-specific by nature — a Bluetooth chipset fix is meaningless on the Mac. A home-scope memory crosses over only if the fact is judged machine-independent.
- **Beads memories are triaged per-fact, not migrated wholesale.** Each is judged against the cost table like anything else. Most should drain out of the always-loaded tier, but that is a conclusion, not a rule.
- **Never promote into `AGENTS.md`.** PP-22e4 reduces it to a ≤10-line stub with a CI gate.
