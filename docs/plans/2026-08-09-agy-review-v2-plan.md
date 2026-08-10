# agy as a PR reviewer, v2 — measurement record (PP-c6xz)

Branch `feat/agy-review-v2-PP-c6xz`. Replaces the approach on PR #1811, which is not being
continued.

This file is the **record of what was measured** against agy 1.1.11 on 2026-08-09. The
operational instructions live in the two skills; do not duplicate them here.

- `~/.gemini/skills/pinpoint-review/SKILL.md` — what agy does when reviewing.
- `~/.claude/skills/agy-review/SKILL.md` — how Claude dispatches one and runs the
  permission loop.
- `scripts/workflow/agy-review-settings.json` — version-controlled copy of the profile
  installed at `~/.gemini/antigravity-cli/settings.json`.

## Why v1 was abandoned

v1 gave agy **no shell at all** and fed it the diff as per-file `.agy-diff.patch` sidecars
in a throwaway checkout. That design rested on one measurement — "a denied command ends the
run" — which turns out to be true only for _unconfigured_ tools:

| refusal                                                | model sees                                                                | run                                                    |
| :----------------------------------------------------- | :------------------------------------------------------------------------ | :----------------------------------------------------- |
| tool unconfigured (needs a prompt headless can't show) | nothing                                                                   | **ends** — exit 0, `status: SUCCESS`, empty `response` |
| tool matches an explicit `deny`                        | `Permission denied for command(fd …). Matches user-configured deny rule.` | **continues**, adapts, finishes                        |

An explicit deny is cheap and informative; an unconfigured tool is a clean, resumable stop.
That makes a grow-as-needed allow-list workable, which is what v2 does.

v1's other blocking claim — "a broader allow silently overrides a narrower deny" — is also
wrong. `command(fd)` allowed in `config.json` and denied in `settings.json`: **deny won**,
matching the documented `Deny > Ask > Allow`. v1 most likely hit a rule that never matched,
since `command` targets are whitespace-separated tokens compiled as **anchored regexes**
and PinPoint's route segments (`(app)`, `[id]`) are full of regex metacharacters.

## Measured facts

**Two permission files are merged.** `~/.gemini/antigravity-cli/settings.json` and
`~/.gemini/config/config.json` → `userSettings.globalPermissionGrants.allow`, the
Antigravity 2.0 app's accumulated "always allow" clicks. The latter currently grants
`command(git commit)`, `command(sed)`, `command(cp)`, `command(npx)`, `command(mkdir)`, two
`write_file(...)` paths, `unsandboxed(npx|npm run|cp)`, and
`mcp(github-mcp-server/pull_request_review_write)`. It is the app's file and is never
edited from here; the review profile's deny list cancels what we don't want, and can fall
behind as the app appends to it.

**`run_command` ignores the invocation directory.** It runs in
`~/.gemini/antigravity-cli` — agy's own config dir — unless `--add-dir` is passed, which
sets the shell's directory. With several, the **last one wins**. This cost the most probes
and explains every early failure.

**Sandbox and linked worktrees are incompatible.** A linked worktree's `.git` is a file
pointing outside the worktree root; `sandbox-exec` blocks it (`fatal: not a git repository:
(null)`), and adding the parent repo to fix it relocates the shell into the main checkout —
a different tree on a different branch. A standalone clone has a real `.git` inside its own
root, so one `--add-dir` suffices and the sandbox has nothing to block. Verified: sandbox
on, clone, `git diff --merge-base origin/main --stat` returns the PR's real diff. The only
residue is a harmless `warning: unable to access '/Users/froeht/.config/git/ignore'`.

Consequence: agy reviews the **pushed head**, never uncommitted work.

**Only `stream-json` reports a refusal.** `--output-format json` returns
`{conversation_id, status:"SUCCESS", response:"", duration_seconds, num_turns, usage}` and
nothing else — no `error`, no tool steps. It cannot distinguish a permission stop from a
model that said nothing. Under `stream-json` the refusal is a step event carrying
`tool_info.parameters.CommandLine` verbatim. `--json-schema` still applies (to the final
`result` event), so nothing is lost by switching.

**The stream must never be printed.** A real review is hundreds of steps carrying full
`text_delta` and full tool output. Logs go to `~/.cache/pinpoint/agy-runs/`, one file per
invocation keyed by PR and timestamp — several sessions review different PRs at once, and
each resume is its own invocation.

**Command chains are matched as one unit.** `pwd && git rev-parse …` was refused because
`pwd` had no rule. The review prompt tells agy one command per call.

**`toolPermission` is a global preset**, documented only on the reference page:
`request-review` (default — prompts for write/bash/web), `proceed-in-sandbox`,
`always-proceed`, `strict` (prompts for all non-read tools). Headless reports
`permission_mode: "request-review"`. `strict` does **not** neutralise `config.json` — allow
rules still auto-approve under it; only explicit denies cancel them.

**No `ask` list.** A catch-all `ask: ["command(*)"]` looks like the way to say "stop on
anything unlisted", but `Ask > Allow` means it would out-rank every allow rule and the
bootstrap loop could never converge. Under `request-review` an unconfigured command already
stops the run.

**Read tools need no rules — but only inside the workspace.** `request-review` prompts for
write/bash/web and not reads, so `view_file`, `list_dir`, `grep_search` and `find_by_name`
work against the review checkout with an empty allow-list. With
`allowNonWorkspaceAccess: false`, a read _outside_ it is a stop like any other. The first
real review run stopped on exactly this: agy tried to open its own procedure at
`/Users/froeht/.gemini/skills/pinpoint-review/SKILL.md` and got
`User denied permission for read_file(...)`. Fixed with a narrow
`read_file(/Users/froeht/.gemini/skills)` grant rather than by copying the skill into the
checkout, which would have put an untracked file in the tree under review.

## Calibration against a known-findings PR

PR #1825 at `3f184b2`, reviewed by agy on `gemini-3.6-flash-high` and independently by Tim's
`/code-review medium`. Ground truth: **four findings, all confirmed and all fixed** in
`7a01ff7e`.

| finding                                                                                                                                                                                                                   | agy    |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----- |
| `pinballmap-actions.ts:641` — the live-lmx resolution closes the drift window in only one direction; when the snapshot is the stale side, `not_found` is still read as "already gone" and the unlist silently un-happens  | missed |
| `snapshot-edit.ts:65` — doc comment describes a lookup-with-fallback the code does not implement, hiding a two-rows-per-title consequence                                                                                 | missed |
| `pinballmap-credentials-rpc.test.ts:75` — teardown ordering: unguarded `memberUser.id` can skip the defensive REVOKE and `sql.end()`, leaking a connection and leaving `authenticated` with EXECUTE on the credential RPC | missed |
| `pinballmap-credentials-rpc.test.ts:41` — porsager client without `prepare: false`; the exact PP-d8l8 / AGENTS.md §7 violation                                                                                            | missed |

agy returned `verdict: approve`, `findings: []`. **0 of 4**, and the comparison is fair —
all three files appear in its own command log, so it had every one in front of it.

**`gemini-3.1-pro-high`, same commit, fresh conversation, no operator nudge: also
`approve`, also 0 of 4.** It behaved better on every process measure — it opened
`src/lib/pinballmap/sync.ts` to understand the sync cadence (flash never read a single file
outside the diff), batched its diffs, and tried `node -e` to test a JS semantics question —
and still concluded wrong. It did not merely miss finding #1, it asserted its negation at
21k output tokens of deliberation:

> "the drifted LMX unlisting **flawlessly** handles the read/write separation between the
> HTTP effect and the transaction while **solving the silent re-list bug**"

It also broke the output contract, wrapping the object in a ` ```json ` fence.

That rules out model tier as the explanation, and largely rules out cause 2 below — pro did
read surrounding source and still got it wrong.

**`gemini-3.1-pro-high` is dropped** (Tim, 2026-08-09) — it is a weaker model than its tier
name suggests, and it cost roughly double flash's wall clock to reach the same wrong answer.
`gemini-3.6-flash-high` stays the default.

Candidate causes, in the order worth ruling out:

1. **The run was cut short by the operator.** Round 2 blew a 15m timeout mid-investigation
   and the round-3 resume said "stop investigating now and emit your final answer". A
   confound introduced by the harness, not by agy.
2. **It only ever read diffs.** The command log is 16 `git diff` calls and one `rg` — no
   `cat`, no `view_file`, no reading of any caller or surrounding source, which the skill
   explicitly asks for. The first finding is not derivable from the diff alone; it needs
   `resolveAutoLink` and the hourly sync cadence.
3. **Model tier** — this was flash. A `gemini-3.1-pro-high` run at the same commit is the
   controlled comparison.
4. **The skill may bias toward approval.** Its calibration section presses "a clean review
   is a real result, do not manufacture a nit", which against an agreeable model is a thumb
   on the scale.

The general lesson for any future version: **a clean pass is only informative once the
reviewer has been shown to find something.** Calibrate against known findings before
trusting an empty `findings` array.

`agy models` also offers `claude-sonnet-4-6` and `claude-opus-4-6-thinking`, which would
make agy a worse second opinion (same family as the primary reviewer) but are available if
the Gemini tiers cannot find anything.

## Known flake

`status: "ERROR", error: "timeout waiting for response"` fires intermittently and unrelated
to `--print-timeout`: observed at 0.46s with zero token usage and two `user_input` steps, at
9s, and at 50.7s under a 120s timeout. An identical retry succeeded. Treat as flake and
retry; cause unknown.

## Still unverified

- Whether `write_file(*)` covers all six write tools the `init` event lists
  (`write_to_file`, `replace_file_content`, `multi_replace_file_content`, `sed_file`,
  `notebook_edit`, `notebook_execution`). The shell write verbs are denied independently as
  a backstop.
- Whether subagents are checked against the same rules, and whether a subagent's stop ends
  the parent run. That governs whether a review may fan out.
- How many permission rounds a real review takes before the allow-list converges.

## v3 redesign — in progress (paused 2026-08-09 ~21:20 CDT)

The diagnostic that settled the 0/4: the same model, same commit, same permissions, asked
two **pointed** questions — trace this sequence and state the end state; does this client
comply with §7 — answered both correctly in 22.9s using two commands. It can reason about
these bugs; it does not go looking for them under an open-ended "review this PR". The
failure is search, not reasoning, so the skill is the lever.

**Subagent facts, measured 2026-08-09:**

- `define_subagent` / `invoke_subagent` / `manage_subagents` are in agy's tool inventory
  and work under the locked-down review profile.
- `invoke_subagent` accepts an **array** of specs — one call fans out N in parallel.
- Subagents inherit the workspace read grant. No extra permission rules needed.
- A subagent that hits an **unconfigured** command is canceled; the parent gets
  `Subagent "<id>" has been explicitly canceled by the user and will be idle until you send
a message to it directly.` The parent and its siblings keep running.
- **Subagent tool calls never appear in the parent's step log** — the parent's `commands
run` was empty across both probes. So the permission loop cannot read a subagent's
  blocked command out of the log; the parent must message the idle subagent for it and
  relay it in `blocked_slices`.

**Agreed design (Tim, 2026-08-09):**

1. Claude picks 4–7 **concern slices** — domains, not file lists, and never a suspected
   defect. Claude owns coverage; recall inside a slice stays agy's (cold-read lesson).
2. agy wave 1: one `slice-reviewer` subagent per slice, all in one `invoke_subagent`.
   Each must trace a concrete sequence end to end and state the end state before it may
   conclude anything, including "clean".
3. agy wave 2: dedupe, then one fresh `refuter` per candidate finding, each seeing only
   the finding — not its author, not that siblings exist. Keep `stands` and `narrowed`.
4. Return survivors + `blocked_slices`; Claude posts them signed `—Antigravity`.
5. Skill changes: drop "a clean review is a real result / don't manufacture a nit"; allow
   valid nits at `low` while still banning invented ones; add the trace obligation.

**State when paused:**

- `~/.gemini/skills/pinpoint-review/SKILL.md` — rewritten, complete.
- `~/.claude/skills/agy-review/SKILL.md` — **partially** rewritten. Header, division of
  labour, and the "Why it is built this way" rationale are in. Still to do: a "Writing the
  slices" section, the new prompt template carrying the slice list, `blocked_slices` in
  "Reading the result", the subagent facts above under "What agy can and cannot do", the
  permission loop's relay path for a subagent-blocked command, and a longer default
  `--print-timeout` for two waves.
- Not yet re-run against #1825 at `3f184b2`. That is the controlled comparison — same
  commit, ground truth of 4 findings.

### v3 implementation — done, awaiting first controlled run

Both skills are rewritten.

`~/.gemini/skills/pinpoint-review/SKILL.md` — agy is now an orchestrator, not a reviewer.
Three steps: establish the diff and fan out one `slice-reviewer` per slice in a single
`invoke_subagent` array; collect and account for every slice (messaging any canceled
subagent for its blocked command); then fan out one `refuter` per candidate finding, each
seeing only the finding. Keeps `stands` and `narrowed`, drops `refuted`.

The two changes the calibration failure argued for:

- **The trace obligation**, copied verbatim into every slice brief: before concluding
  anything — including "clean" — trace one concrete sequence end to end and state the end
  state, naming the functions it passes through in order.
- **The calibration section no longer licenses an empty result.** It previously said "a
  clean review is a real result… do not manufacture a nit", which against an agreeable
  model is a thumb on the scale. It now says an empty array is a claim that N independent
  readers each traced a sequence and found nothing, and to check that every slice actually
  reported a trace before accepting it.

Also: the finding bar now allows a **valid** nit at `low` while still banning the invented
one. The test is "is this true and can I show it", not "is this important enough".

`~/.claude/skills/agy-review/SKILL.md` — Claude picks 4–7 concern slices (domains, never
file lists, never a suspected defect), carries the measured subagent facts, checks
`blocked_slices` on every run, and knows the two places a stopped command can hide.
Default `--print-timeout` 15m → 45m for two waves.

### The 30-minute provider ceiling (measured 2026-08-10)

**The model provider terminates an agy agent at roughly 30 minutes, regardless of
`--print-timeout`.** Two runs on the same review, under a 45m CLI timeout:

| run                             | duration | out tokens | end                                                                                               |
| :------------------------------ | :------- | :--------- | :------------------------------------------------------------------------------------------------ |
| v3 wave 1+2, 7 slices           | 1787s    | 18356      | `ERROR: Encountered retryable error from model provider: Agent execution terminated due to error` |
| resume of the same conversation | 1836s    | 20142      | identical                                                                                         |

Setting `--print-timeout` above 30m buys nothing. It is now 25m so the CLI's own deadline
lands first and produces a clean, resumable stop instead of a provider error.

Consequences, both now in the skills:

- **Waves are dispatched as two separate `agy` runs.** One run doing slices _and_ refuters
  does not fit. The split has a second benefit that was going to be worth engineering
  anyway: a refuter in a fresh conversation cannot see how the finding it is judging was
  arrived at.
- **4–5 slices per wave, not 7.** Seven overran the limit and wave 1 died mid-fan-out.

### The fabricated clean pass (2026-08-10)

Worth recording because it is the failure this whole redesign exists to prevent, and the
first version of the redesign still permitted it.

After the v3 run was cut off mid-fan-out, the resume made **zero tool calls** — it contacted
no subagent and collected no report — and returned `verdict: approve`, `findings: []`,
`blocked_slices: []`, with a confident summary asserting the drift fix "accurately resolves
live LMX IDs by title to prevent silent re-listing reversions". Every one of its seven
slices was unreviewed. The summary was written from the five `git diff` calls the parent
itself had made while drafting briefs.

The resume prompt had explicitly told it to report unrecoverable slices in
`blocked_slices`. It approved instead.

Fixed with a new section in agy's skill, "You may not approve a review you did not
receive": never report on a slice whose subagent did not report; an interrupted wave is an
unreviewed slice, not an absent finding; and `verdict` is `needs-attention` whenever
`blocked_slices` is non-empty, whatever the findings say. The incident is written into the
skill as the worked example, the same way the invented-package-version false positive is.

**Score so far: still 0/4, but no valid measurement yet.** Neither v3 run completed a slice
wave, so the design has not actually been tested.

### Correction: it is not a 30-minute ceiling

Written above from two data points; a third disproves it. Subagent-heavy runs end on
`Encountered retryable error from model provider: Agent execution terminated due to error`
at **978s, 1787s, 1836s and 498s** — no duration pattern. It fires as the agent finishes.

**The operative fact is that `.result.response` is empty (0 chars) when this happens, while
the complete review JSON is in the `text_delta` stream.** A run whose envelope reads
`status: ERROR` with an empty response has, twice now, actually contained a finished review.
Reconstruct with `jq -j` — `-r` appends a newline to every delta, which lands mid-token and
corrupts the JSON — and parse from the first `{`, since the parent narrates a line or two
first.

Both skills now say to do this on every run before concluding anything failed.

### v4 result — 2 of 4, and the pipeline works end to end

Five slices, `gemini-3.6-flash-high`, commit `3f184b2`, waves dispatched as two separate
runs.

**Wave 1**: all five slices reported, `blocked_slices: []`, `verdict: needs-attention`,
four candidates.
**Wave 2**: four refuters, three `stands`, one `refuted` and dropped.

| ground truth                                                                       | outcome                                                                             |
| :--------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| `pinballmap-actions.ts:641` — drift window closes in one direction only            | **found** at `:549`, `high`, conf 0.95, with the end-to-end trace; refuter `stands` |
| `pinballmap-credentials-rpc.test.ts:75` — teardown skips REVOKE and `sql.end()`    | **found** at `:72`, `medium`; refuter `stands`, confidence raised 0.85 → 0.95       |
| `snapshot-edit.ts:65` — doc comment describes a fallback the code lacks            | missed                                                                              |
| `pinballmap-credentials-rpc.test.ts:41` — porsager client without `prepare: false` | missed                                                                              |

Plus one finding outside ground truth that survived refutation: the `drizzle.config.ts`
guard test asserts only that the source _contains the string_ `DRIZZLE_FORCE_PRODUCTION`,
so it passes against reverted code. That looks real.

And one refuted: a claimed `pinballmapMachineId === null` short-circuit in `withLmxRemoved`.
The refuter wave did its job in both directions — it killed a false positive and raised
confidence on two it confirmed.

**Score: 0/4 → 2/4**, and the two it found are the two most expensive: the high-severity
drift bug that `gemini-3.1-pro-high` had explicitly asserted was correctly fixed, and a
connection leak.

The `prepare: false` miss is the disappointing one. The "written word against the code"
slice named the rules "governing database connections" explicitly, and the direct probe
showed flash answers that exact question correctly in seconds. Something about that slice's
subagent did not reach `AGENTS.md` §7 against that test file.

### Fix for the `prepare: false` miss

PR #1834 landed the `.claude/rules/` tier on main the same morning, which happens to supply
the fix. The rule agy missed lives in `.claude/rules/database.md` — a short, subject-scoped
file — rather than only in the 20-rule `docs/NON_NEGOTIABLES.md` catalogue.

agy's skill now tells the rules slice to **start from `.claude/rules/`**, read the two or
three files matching what the diff touches, name which ones it read, and check them one rule
at a time against specific lines. The catalogue stays as the fallback and as the source of
`CORE-*` ids. Untested against #1825 — the next calibration run should re-check whether
finding 4 is recovered.

The general shape of the miss is worth remembering: the slice existed, its brief named
database rules explicitly, and the subagent still reported clean because it judged from
recall instead of opening the file. Naming a concern is not the same as making the reviewer
read something.
