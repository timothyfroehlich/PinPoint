# Memory & context review skill — design

**Bead:** PP-uoqg · **Branch:** `worktree-memory-context-review-PP-uoqg` · **Date:** 2026-07-28

A weekly human-in-the-loop pass that reviews everything recorded about how we work, proposes changes, and hands Tim a short veto list.

## Problem

Two failures, one skill.

**Recorded context rots and nobody looks at it.** Facts accumulate across six destinations with no curation pass. Duplicates form, claims go stale, and knowledge lands in the wrong tier. A concrete case: the tmux `-CC` server-wedge fact now lives in a Bazzite memory file, in `dotfiles/mac/.zshrc.local` comments, and in the `bazzite` skill — and the single most useful part, the `kill -WINCH` recovery that saves the session, exists only in the memory file that the Mac cannot see.

**Claude auto-memory is per-machine and syncs nowhere.** The store directory name encodes the absolute repo path, so the Mac (`-Users-froeht-Code-PinPoint`) and Bazzite (`-var-home-froeht-Code-PinPoint`) hold **fully disjoint** sets — 22 files vs 11, zero filenames in common. Bazzite has known the tmux root cause _and_ its recovery since 2026-07-16; the Mac rediscovered the problem from scratch on 2026-07-27 and recorded a worse version. Upstream issues [#25739](https://github.com/anthropics/claude-code/issues/25739) and [#56793](https://github.com/anthropics/claude-code/issues/56793) are open with no Anthropic response, and no third-party tool solves the path-encoding problem — the most complete one sidesteps it by requiring identical repo paths on every machine, which Fedora Atomic's `/var/home` makes impossible here.

Tim's stated motivation is the first problem, not the second: he needs oversight that agents record the right things and don't drop things they need, and he rates that above reviewing implementation plans. The sync fix falls out of doing the curation across both machines.

## Core routing principle

Every destination differs in **when you pay for it**. This table describes the **post-PP-22e4 target state** — `.claude/hooks/` exists today, but `.claude/rules/` does not until their PR 8 lands, and `AGENTS.md` is absent because it is being reduced to a stub:

| Destination                    | Token cost                                       | Fires when            |
| :----------------------------- | :----------------------------------------------- | :-------------------- |
| `.claude/hooks/`               | zero                                             | always — mechanically |
| `CLAUDE.md` (global + project) | every session                                    | always                |
| `bd remember`                  | every session, unfiltered (~20KB via `bd prime`) | always                |
| `.claude/rules/*.md`           | on matching file open                            | path match            |
| `.agents/skills/`              | on matching task                                 | task match            |
| Claude auto-memories           | index always, body on demand                     | description match     |

**Route each fact to the cheapest tier that still guarantees it fires when needed.** This is the same rule as PP-22e4's "highest tier it qualifies for", read from the other end, and the two orderings agree.

Two consequences worth stating outright:

- **`bd remember` is the most expensive place a fact can live** — always loaded, unfiltered, and already ~20KB. Its only defensible role is staging: zero-latency capture that syncs across machines for free. The review must drain it aggressively.
- **Claude auto-memories are the cheap resting place** for accumulated knowledge, because the body loads only on a description match. This is where facts belong by default.

Anthropic's own [context-engineering guidance](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) backs both: _"delete overlapping guidance across system prompts, skills, and CLAUDE.md files"_ and _"keep your CLAUDE.md lightweight… spend most of the tokens on gotchas."_ It also warns against using `CLAUDE.md` as an accumulation surface — which is an argument for keeping the always-loaded tier small and **biasing the review toward demotion**, not promotion.

## The three defects

Every finding is one of:

1. **Too expensive for its value** → demote. A niche gotcha in project `CLAUDE.md` that only matters when you touch one directory belongs in `.claude/rules/`.
2. **Too cheap to fire when needed** → promote. A rule that gets violated because it sat in a memory nobody recalled belongs higher — and if it can be _mechanically_ enforced, it belongs in a hook. "Could this be a hook?" is the highest-value question the review asks.
3. **Present in more than one tier** → delete the redundant copies, keeping the best-written one at the correct tier. Merge first if the copies each carry detail the others lack (the tmux case).

Plus one non-defect that still needs handling: **facts only Tim can adjudicate.** The `feedback_*` class ("delegate to subagents for Fable cost", "DRY at two when the thing is load-bearing") cannot be verified by any agent. These are surfaced as questions, not proposals — but only when there is a _signal_, never as a weekly roll-call. Signals: another item in the corpus contradicts it, a newer memory supersedes it, or it has gone unreinforced for months. Asking about all eight feedback memories every week trains Tim to rubber-stamp, which defeats the review.

## Architecture

Two phases, with the veto gate between them. Nothing destructive runs unattended.

### Phase 1 — analyse and propose (read-only)

1. **Collect.** Read every store: beads memories; Claude auto-memories on both machines, both scopes (project and home); and the canonical context files. Bazzite is read over SSH — `ssh bazzite` for the tailnet, falling back to `bazzite-lan` if the tailnet is the suspect.
2. **Fan out verification to subagents.** The corpus is currently ~48 items — 33 project memories (22 Mac, 11 Bazzite), 4 home-scope, 11 beads memories. Batch at roughly six per subagent, so ~8 subagents. Each owns its batch end-to-end and returns structured verdicts, so no two agents need the same context:
   - **Verify claims against reality** — referenced beads still exist and are still open/closed as described; referenced branches merged or abandoned; referenced files, paths, and symbols still present; referenced `package.json` scripts still defined; pinned versions still current. Machine-specific claims about Bazzite are checked over SSH.
   - **Hunt duplication** across the canonical tiers for the facts in its batch.
   - **Propose a routing verdict** per item against the cost table.
3. **Synthesise.** The lead assembles findings into one table and keeps it in context — Tim will ask follow-ups, and the lead must answer without re-reading everything.
4. **Split the proposal** into _silent_ and _consequential_ (below).

### The veto gate

Presented **in-session, not as a document** — Tim skims documents and would rubber-stamp a long one.

- **Silent changes just happen, and are logged**: propagating a fact the other machine already verified, fixing a broken `[[wiki-link]]`, collapsing an exact restatement, correcting a stale bead ID. High volume, no judgment.
- **Consequential changes go on a numbered list, one line each** — the topic only, no rationale. Deletions, merges that drop detail, cross-tier moves, and anything resting on circumstantial evidence. Tim replies conversationally: _"kill 2 and 5, tell me about 7."_ The lead holds the detail and produces it on demand.

### Phase 2 — apply (destructive, post-approval)

1. **Snapshot first.** Each machine copies its own memory store to a timestamped directory before touching it. One-way, never read back by Claude, never merged — this is the undo that the store otherwise lacks, and it carries none of the objections to git-backing.
2. **Apply locally.**
3. **Dispatch to the remote machine.** Write the approved manifest as JSON, ship it over SSH, and run a headless `claude -p` on Bazzite to apply its own half. **The remote side is an agent, not a file write, on purpose:** each machine's memories should be written by that machine's agent using whatever the sanctioned mechanism is at the time. A design where the Mac reaches over and hand-writes Bazzite's files breaks the day a real memory tool ships — which is precisely the format-instability risk that ruled out git-backing.
4. **One round trip, no negotiation.** The remote agent returns a result document. If it disputes an item — the fact is still true on Bazzite, or a proposed merge would lose information — that item is **left unapplied** and escalated to Tim. Disputes never turn into LLM-to-LLM back-and-forth, which is where cost and oscillation would come from.
5. **Report** what was applied, what was skipped, and what is waiting on Tim.

## Where it plugs in

No schedule and no new nudge machinery. The review becomes a checklist item in the existing weekly **chores** pass, whose nag already rides a recurring `weekly-chore` bead: DoltHub-synced, so doing chores on either machine clears it everywhere. Per the `pinpoint-chores` skill, the checklist is duplicated on the bead — **both must be updated.**

This bounds divergence at about a week. That is a deliberate trade: Tim rejected continuous file sync, so a fact learned on Bazzite Tuesday is invisible on the Mac until the next run. The 12-day tmux gap becomes a 7-day worst case.

## Scope decisions

- **Home-scope memories are reviewed for staleness but not propagated by default.** Several are machine-specific by nature — `bluetooth-mt7922-fix` is meaningless on the Mac, `cmux-claude-wrapper` is meaningless on Bazzite. Propagation applies to project-scope memories; a home-scope memory only crosses over if the review judges the fact machine-independent.
- **Skills are a destination, never audited.** The review may propose "this fact belongs in skill X" but does not read skills looking for problems. Tim ruled that out as too much for one pass.
- **Beads memories are triaged individually, not migrated wholesale.** Each is judged against the cost table like anything else; most should drain out of the always-loaded tier, but the decision is per-fact.

## Dependencies and sequencing

PP-22e4 (Claude-ContextRewrite) owns the destination shape and is actively rebuilding it. Their authoritative statement (huddle PP-lt12.61, 2026-07-28):

- **`AGENTS.md` is being reduced to a ≤10-line stub with a CI gate.** It stops being a routing destination. The routing rule must not anchor on it, and must not lean on its §8 "actionable, what and how only" line — that text goes away with the file.
- **`.claude/rules/*.md` arrives in their PR 8.** This skill must not reference that directory before PR 8 lands.
- **`REVIEW.md` (#1764, landed), not `AGENTS.md`,** is what external reviewers see for skill routing.
- **We owe them a cross-tier duplication list** — specifically the duplication their PRs 5/7 skill-simplification pass would _not_ catch.

**Survey gotcha:** default `rg` skips dotfile directories, so `.agents/` and `.claude/` are invisible. The duplication sweep must pass `--hidden` or it will report false-clean. (Credit: Claude-PP-nw80-PE, who hit exactly this while retiring CORE-ARCH-002.)

## Rejected alternatives

- **Git-backed memory store with a symlinked canonical copy.** Would have given free transport, an undo, and conflict visibility, and defeats the path-encoding problem outright. Tim rejected it: coupling to Anthropic's undocumented on-disk format, and hand-merging the `MEMORY.md` index. Noted that hand-editing is already the only sanctioned interface so git adds no new coupling, and that a single-writer review pass has nothing to merge — but the format-instability worry stands on its own, and it is what motivates the headless-agent remote write instead.
- **Continuous file sync (Syncthing).** Rejected with the above: silent propagation with no review, plus a daemon on both machines.
- **Direct SSH file writes for the remote half.** Simpler and deterministic, but hard-codes today's file format on a machine whose agent could use tomorrow's mechanism.
- **Slicing into single-machine-then-cross-machine.** Tim's call to build in one pass, to avoid duplicated and second-guessed work.

## Open question

**Permission mode for the headless remote agent.** A non-interactive `claude -p` on Bazzite must write memory files without prompting, which needs an explicit permission posture. It also needs an absolute binary path (`$HOME/.local/bin/claude`) because non-interactive SSH on Bazzite sources no shell config. To be settled during implementation; if no acceptable posture exists, the fallback is direct file writes over SSH with the format risk accepted and documented.
