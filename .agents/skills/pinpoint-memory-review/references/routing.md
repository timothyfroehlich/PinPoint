# Routing a fact to the right tier

Load this when deciding **where a fact belongs**. The `SKILL.md` runbook covers how a review pass is run; this file is the judgment layer it defers to.

## The cost table

Every destination differs in **when you pay for it**:

| Destination                    | Token cost                                        | Fires when            |
| :----------------------------- | :------------------------------------------------ | :-------------------- |
| `.claude/hooks/`               | zero                                              | always — mechanically |
| `CLAUDE.md` (global + project) | every session                                     | always                |
| `bd remember`                  | every session, unfiltered (~20 KB via `bd prime`) | always                |
| `.claude/rules/*.md`           | on matching file open                             | path match            |
| `.agents/skills/`              | on matching task                                  | task match            |
| Claude auto-memories           | index always, body on demand                      | description match     |

## The rule

**Route each fact to the cheapest tier that still guarantees it fires when needed.**

Read from the other end this is PP-22e4's "highest tier it qualifies for", and the two orderings agree. Both halves are load-bearing:

- _Cheapest_ — an always-loaded tier is paid for by every session forever, whether or not the fact is relevant. That cost is invisible and compounds.
- _Still guarantees it fires_ — a fact demoted below the tier that reaches it might as well be deleted. A non-negotiable in a skill is worse than useless: it reads as covered while firing only when someone happens to load that skill.

Two consequences fall out of the table:

**`bd remember` is the most expensive place a fact can live.** It is always loaded, unfiltered, and already around 20 KB. Its one defensible role is staging — zero-latency capture that reaches both machines for free. A review should drain it, not grow it.

**Claude auto-memories are the cheap resting place.** The body loads only on a description match, so an unused memory costs one index line. This is where accumulated knowledge belongs by default, which also means a weak `description:` is a real defect: it is the only thing standing between the fact and recall.

## Two rules about the destinations themselves

**`.claude/rules/` is conditional.** It arrives in PP-22e4 PR 8. Check that the directory exists before routing anything into it — `collect_stores.py` reports `rules.exists`. While absent, a path-scoped fact stays where it is and is flagged as _blocked on PR 8_, not forced into a worse tier.

**`AGENTS.md` is not a destination.** PP-22e4 reduces it to a ≤10-line stub with a CI gate that fails if it grows. Never promote into it. Its line count is collected only so a review notices the gate's state.

## The three defects

### 1. Too expensive for its value → demote

A fact in an always-loaded tier that only matters sometimes. The tell: you can name the trigger. "Only when touching migrations", "only when writing an E2E spec", "only on the deploy path" — each of those is a `.claude/rules/` path glob or a skill, not a `CLAUDE.md` line.

The strongest form of this is demotion to **mechanism**: see defect 2.

### 2. Too cheap to fire when needed → promote

A fact that got violated, or nearly did, because it sat somewhere nothing loaded. Being _recorded_ is not the same as being _reachable_.

**Ask "could this be a hook?" for every rule-shaped fact.** It is the highest-value question in the review. A hook costs zero tokens and cannot be forgotten, skimmed, or reasoned around — it is strictly better than any prose that says the same thing. If a hook can enforce it, prose about it is redundant at best.

The counter-case, from PP-22e4: **creation-type prohibitions cannot be path-scoped.** A rule like "never make a second X" has to live in `CLAUDE.md`, because a path-scoped rule cannot fire on a file that does not exist yet.

### 3. Present in more than one tier → dedupe

Delete the redundant copies and keep the best-written one at the correct tier. **Merge before deleting** when the copies each carry detail the others lack — the failure mode here is not duplication, it is deleting the copy that happened to hold the useful part.

⚠️ **Search with `rg --hidden`.** Default `rg` skips dotfile directories, so `.agents/` and `.claude/` are invisible and a dedupe sweep will report false-clean. This exact blind spot let a live `CORE-ARCH-002` citation survive a hand-check that reported clean.

## Worked examples

**Duplication where the copies are not equal — the tmux `-CC` fact.** It lives in three places: a Bazzite memory file, comments in `dotfiles/mac/.zshrc.local`, and the `bazzite` skill. The naive dedupe keeps the skill's copy and deletes the rest — which would destroy the `kill -WINCH <server-pid>` recovery procedure, the single most useful part, present only in the Bazzite memory. Correct handling: merge the recovery into the skill copy first, _then_ delete the others. This is why defect 3 says merge-before-delete rather than pick-one.

**Straight duplication — `copilot-quota`.** Exists as both a beads memory and a Bazzite memory file. Same fact, no distinct detail. It is also time-boxed (the quota resets at month start), so the real verdict is neither "keep both" nor "keep one" but _expired — delete both_.

**Demotion to mechanism — `--no-verify`.** "Never use `--no-verify`" is prose in the global `CLAUDE.md`. There is already a hook stack enforcing commit gates. If a hook can reject the flag outright, the prose is redundant and should go; if it cannot, the prose stays and the gap is worth a bead. Either way the review's job is to _ask_, not to leave a rule sitting in prose because it has always been there.

**Blocked on a destination — a path-scoped gotcha.** A fact that only matters when editing `drizzle/meta` is a textbook `.claude/rules/` candidate. Until PR 8 lands there is nowhere to put it, so it stays and gets flagged. Do not force it into a skill just to move it.

## The exception: facts only Tim can adjudicate

The `feedback_*` class — "delegate to subagents for Fable cost", "DRY at two when the thing is load-bearing", "he skims long replies" — cannot be verified by any agent. There is no file to check and no command to run. These are **surfaced as questions, never as proposals.**

**Only surface one when there is a signal.** Valid signals:

- another item in the corpus contradicts it
- a newer memory supersedes or narrows it
- it has gone months without any reinforcement in the transcript record

Asking about every feedback memory each week trains Tim to rubber-stamp the list, which destroys the veto gate the whole review depends on. Silence about a feedback memory is the correct default.
