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

## Second calibration: PR #1851 (2026-08-10)

MCP issue tools, `gemini-3.6-flash-high`, five slices, both waves clean
(`status: SUCCESS`, `blocked_slices: []`, 370s and 125s).

Ground truth: Tim's `/code-review high`, **5 findings**. agy returned **2**, both surviving
refutation. **Overlap: 1 by location, 0 by diagnosis.**

| Tim's finding                                                                                         | agy                                                                                                                |
| :---------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `add-issue-comment.ts` — a literal `0x00` byte makes the file binary to git and `rg`                  | **same line, wrong bug** — claimed `.join(" ")` causing hash collisions                                            |
| `get-issue.ts:88` — `asc` + `limit` returns the _oldest_ N and drops the newest, no truncation signal | missed                                                                                                             |
| `update-issue.ts:254` — raw internal error text relayed to the client, `reportError` never called     | missed                                                                                                             |
| `update-issue.ts:274` — a partially-failed update is audited as `outcome: "ok"`                       | missed                                                                                                             |
| `update-issue.ts:48` — comment describes an ownership grant `checkPermission` can never fire          | missed                                                                                                             |
| —                                                                                                     | `update-issue.ts:246` — `changed`/`from` from the pre-loop snapshot (real, but needs a race, and `low` not `high`) |

### Finding 1: refutation cannot fix an observation error

The NUL case is the important one, because **one root cause produced both Tim's finding and
agy's false positive**. The raw `0x00` renders as nothing in a terminal dump, so agy read
the joiner as a space, concluded the scheme was space-joined, and derived a sound collision
argument from a false premise. The prompt had already warned it the file was binary and told
it to use `cat`/`view_file`; it did, and still misread the byte.

**Then its refuter confirmed it at `stands`.** The refuter shares the finder's blind spot —
it read the same byte the same wrong way. So the second wave catches _reasoning_ errors and
is structurally unable to catch an _observation_ error both agents make. That is a real limit
on what refutation buys, and it means a confident false positive can survive the whole
pipeline. `cat -v` disproves the claim in one command.

This is the same shape as the "package maxes out at 9.0.5" false positive already recorded
in agy's skill: sound reasoning, invented premise, high stated confidence. The generalisation
worth adding is that a claim about an exact character, byte, or whitespace must be verified
with something that renders control characters — never read off a plain dump — and that the
refuter brief should say so too.

### Finding 2: severity is not calibrated

agy filed a race-dependent, outcome-preserving discrepancy as `high` at confidence 0.95 —
two levels above where it belongs. Both of its findings were `high`/0.95, which is what a
model that does not really discriminate looks like. Worth watching across more runs before
changing the rubric.

### Where this leaves the design

Two calibrations now: **2/4 on #1825, 0/5 on #1851.** The pipeline runs reliably and
declares its coverage honestly, but it is not yet a second reviewer worth acting on — on
#1851 a maintainer following it would have chased a non-bug and merged five real ones.

The #1825 result showed sliced fan-out recovers findings a single pass missed. The #1851
result shows that is not sufficient: every one of Tim's five sat inside a slice agy's own
subagents owned and reported clean on, and three of them sat in `update-issue.ts`, which the
"honest failure and partial state" slice covered explicitly while surfacing a weaker fourth
claim in the same file. The gap is depth within a slice, not slice selection.

### Outcome: one finding landed

`update-issue.ts:246` was accepted and fixed in `0fe73f19` — `assignIssue` now returns
`{ deliveryPlan, oldAssignedTo, changed }` with `oldAssignedTo` read at the same moment as
the no-op decision, so callers report the value the write actually replaced rather than one
from an earlier snapshot. Two tests added, including one simulating the losing side of the
race. Severity `low` was confirmed by the implementing agent.

So the honest scoreline on #1851 is **0 of the human reviewer's 5, plus 1 real defect the
human review missed**, plus 1 false positive. Recall against a strong reviewer is the wrong
sole metric — a second reviewer that finds a disjoint defect has value even at 0 overlap —
but a pipeline that also emits a confident false positive at 0.95 cannot be handed to a
maintainer unfiltered.

On scoring the NUL finding: the implementing agent argues it is "a true positive from a
false premise" rather than a false positive, since the line was right and the byte really
was the problem. As _written_ the claim is false — the joiner is not a space, there is no
collision, and acting on the text as given produces the wrong fix. But the distinction
matters for diagnosis: the reviewer was reacting to a real artifact it could not perceive
correctly, not hallucinating from nothing.

## v5: the Compare obligation (2026-08-10)

Three changes, from a literature survey of LLM code-review prompting.

**1. A second obligation, `Compare`, alongside `Trace`.** Tracing finds code that is wrong
and structurally cannot find code that is _missing_ — there is nothing there to read. Every
slice brief now requires naming and reading **at least two reference targets outside the
added lines** (a sibling implementing the same pattern, a helper's contract, a caller, other
call sites of a changed function), returned as `checked_against`. An empty `checked_against`
invalidates a clean report.

Evidence: **AbsenceBench** (arXiv 2506.11440) — absence detection is an attention-mechanism
gap, not an effort gap; models fail to identify what is missing even with everything in
context. **Making Absence Visible** (arXiv 2601.07234) — an explicit reference frame moved
human detection 31%→88%; prompting alone without the frame did much less.

**2. A `coverage` array, one entry per slice including clean ones.** `findings: []` cannot
distinguish a slice that looked and found nothing from a slice that never looked. `coverage`
can, and it is what the dispatcher audits before relaying a clean pass.

**3. Wave 2 moved out of agy onto Sonnet.** A same-family refuter shares the finder's
misreadings — ours blessed a claim one `cat -v` disproves. agy's own Claude models are a
generation behind (`claude-sonnet-4-6`), so refutation now runs as Claude Code subagents:
one per candidate, blind to siblings, carrying an evidence rule ("check the claim, do not
re-read it") and a downward-only severity pass folded in.

Evidence: **Refute-or-Promote** (arXiv 2604.19049) — ten agents including a senior arbiter
unanimously confirmed a nonexistent vulnerability, all sharing one wrong assumption; three
agents made an identical byte-ordering error; _"unanimity should not raise confidence by
itself"_. Their fix was a cross-model critic plus empirical validation gates. Severity: a
dedicated downward-only pass corrected 8 of 9 cases.

**Explicitly NOT done: making the slice prompts more elaborate.** Adding
explanation-and-correction steps to a verification prompt dropped correct verification from
52.4% to 11.0% (arXiv 2508.12358) — elaboration biases toward assuming defects exist. Every
change above is structural separation instead.

### v5 result on #1851: 1 of 5, from 0 of 5

All five slices reported with real outside-the-diff references — `matrix.ts`,
`create-issue.ts`, `list-machines.ts`, `verify-token.ts`, `set-machine-owner.ts`,
`issues/actions.ts`. In v4 they read almost nothing outside the added lines.

**Recovered: `update-issue.ts:125`** — `checkPermission` runs before `resolveIssue` with no
`OwnershipContext`, against a matrix where `issues.update.reporting` is conditional on
ownership for guest. That is the human reviewer's finding 5, and it was found by reading
`matrix.ts`, exactly the absence-by-reference mechanism the obligation is for.

The `:246` assignee finding returned, now argued against its siblings ("unlike
`updateIssueTitle`, `updateIssueStatus`, which re-read DB state") — a stronger version of
the same claim. The NUL false positive also returned, at `medium` rather than `high`.

### The NUL byte has now corrupted four layers

git (file reported binary, whole diff unreviewable), ripgrep (silently skips it without
`--text`), agy's reader (rendered it as a space, producing a confident false positive its
own refuter blessed), and finally this session's own prompt construction — building the
refuter brief, the byte passed through JSON handling and emerged as a space, so the refuter
received a claim reading "joined with space instead of NUL (`parts.join(' ')`)".

Worth stating plainly because it generalises: **a value that breaks the tools also breaks
every reviewer downstream of them, including the ones checking each other.** This is why the
evidence rule has to name specific commands (`cat -v`, `rg --text`) rather than saying
"verify carefully" — carefully re-reading a corrupted rendering reproduces the corruption.

### v5 wave 2: the cross-family refuter, and what it corrected

Three candidates, three Claude Code Sonnet subagents, each blind to its siblings.

| candidate                               | v4 (Gemini refuter) | v5 (Sonnet refuter)                 |
| :-------------------------------------- | :------------------ | :---------------------------------- |
| `add-issue-comment.ts:65` NUL vs space  | `stands`            | **`refuted`, conf 0.98**            |
| `update-issue.ts:125` ownership context | not raised in v4    | **`narrowed`, medium to low**       |
| `update-issue.ts:246` assignee snapshot | `stands`            | **no verdict returned** (see below) |

**The NUL refutation is the direct validation of the change.** The Sonnet refuter ran `xxd`
and `cat -v`, found the literal 0x00, and killed the claim — the same claim the Gemini
refuter had blessed. It also independently surfaced the _real_ distinction while doing so:
`create-issue.ts:107` writes the separator as a unicode escape sequence,
`add-issue-comment.ts:65` writes a raw byte. Same runtime value, different source encoding,
and the raw byte is what made the file binary.

**The severity pass only ever moved downward**, as instructed: medium to low on a
reachability argument (the admin-only token gate plus an unconditional `true` in the matrix
means the ownership-conditional branch is dead on that path), and medium to refuted. Nothing
was raised.

### Harness fact: a Claude Code refuter can go idle without delivering

Two of four subagent dispatches — both assigned to the `:246` candidate — returned
`idle_notification` with no verdict, twice each, including after a direct request to resend.
The other two delivered normally. Cause unknown.

Consequence for the dispatcher: **check that every candidate came back**, the same accounting
problem `blocked_slices` solves on agy's side. A refuter that silently fails to report looks
identical to one that had nothing to say, and defaulting a missing verdict to either
`stands` or `refuted` is wrong.

That candidate's status is known independently anyway — the mechanism was verified by hand,
and the implementing session accepted it and shipped the fix in `0fe73f19` at `low` severity.

### The NUL byte, layer five

It also broke this session's own tooling twice: once building a refuter brief, where the byte
passed through JSON handling and reached the subagent rendered as a space, and once writing
this very section, where a heredoc carrying it was rejected outright as "control characters
that would be hidden in the approval dialog".

git, ripgrep, agy's reader, a prompt-construction step, and a shell guard. Five layers, five
different failure modes, from one byte. The lesson for the skill is narrow and worth keeping:
the evidence rule must name specific commands, because every generic instruction to "check
carefully" is executed through some rendering, and the rendering is the thing that is lying.

### Scoreline

|                                        | v4  | v5               |
| :------------------------------------- | :-- | :--------------- |
| of the human reviewer's 5 findings     | 0   | **1**            |
| real defects the human review missed   | 1   | 1 (the same one) |
| false positives surviving the pipeline | 1   | **0**            |

Recall went up and precision went clean. **1 of 5 is still poor.** The pagination defect, the
error-relay and Sentry gap, and the audit-log gap were missed again, and all three are
absence-shaped findings inside slices that did report valid outside-the-diff references. So
the Compare obligation is necessary and not sufficient: naming two references is a floor, and
these three needed the reviewer to notice a _particular_ absent thing against them.

## v6 — expect before you read, and a calibration harness that does not depend on a review

v5's lesson was that the Compare obligation is necessary and not sufficient. Naming two
reference files is a floor; the three missed findings all sat in slices that named valid
references and still did not notice the particular absent thing. So v6 changes two things:
what the reviewer is obliged to produce, and how we find out whether it worked.

### Calibrate on fix commits, not on posted review comments

Every measurement up to here scored agy against a `/code-review` write-up posted on a PR.
That has three problems. The findings are only as real as the write-up; there is no way to
tell "read the right file and drew the wrong conclusion" from "never looked"; and each new
calibration target costs a human review.

A branch that went through a review round carries the repair in its own history: `fix(...)`
commits landing after the feature commits, usually restating the finding in the message. For
such a commit F, the tree at F's **parent** contained exactly the defects F repairs, and F's
diff is the answer key. The defects are certainly real, because someone fixed them. Their
location is known, so a near miss is measurable. And the targets are free — a survey of PRs
#1800–1858 found eight usable ones in an afternoon, from 86 lines to 1,800.

Two traps, both hit while building the first target:

- **A `fix(...)` headline is not a code fix.** Four commits on the #1856 branch begin
  `docs(pinballmap): fix …` and touch only the plan markdown.
- **Check out the parent, not the fix.** The obvious reading of "calibrate on the fix commit"
  reviews the tree that already contains the repair. And when the parent is a merge commit it
  is fine to check out but wrong to diff from — take the merge base against `origin/main`, or
  the branch's own work drowns in main's.

The first target is PR #1856 at `a5b19d75`, whose three known defects are ahead of it in
`21ec03c4`: a clear condition that reads a reissued row id as a removal, an auto-link write
that does not clear the record it just superseded, and an E2E worker-id collision. Two of the
three are absence, which is the class being tested.

### The third obligation: Expect first

Before opening the code that implements its concern, a slice must write down what a correct
implementation would have to contain — from the domain and the change's stated purpose, not
from the code. For state with a lifecycle that means enumerating every event that should
create a record and every event that should remove one, as a numbered list, before looking at
how removal is implemented. For anything consuming a third party's response it means
enumerating the shapes that response can take before looking at how it is parsed. Then the
slice checks its list item by item and returns it as `expected`, with a verdict per item —
implemented, missing, or not applicable.

The ordering is the entire mechanism. Reading the implementation first makes whatever is
there look like the whole of what should be there, and an absent case leaves nothing on the
page to attend to. Generating the list first is what puts the missing item somewhere it can
be seen. This is the same structural-separation shape as Trace and Compare — a distinct
obligation with a distinct output — and not the elaboration that measurably makes reviewers
worse.

Two ways a slice fakes it, both checkable by the dispatcher: fewer than four items, or every
item marked implemented. A list that agrees with the implementation item for item was derived
from it.

### The negative result: file-level absence scanning does not find condition-level absence

The idea that the dispatcher should precompute an "absence surface" — untouched siblings in
each touched directory, source modules with no test sibling, call sites of changed exports
that were not updated — was built and run against #1856. It produced almost nothing usable.
Section 1 listed 34 untouched E2E specs, which is noise. Section 3 found one call site outside
the diff, and that was a quoting bug in the script rather than a real one. Section 2's one
signal — the new module has no unit-test sibling while thirteen of its neighbours do — is a
false positive, because the module is covered by integration tests instead.

The reason is worth keeping, because it is the same reason the whole problem is hard. All
three known defects here are **condition-level** absences: a missing clause in a `where`, a
missing delete inside a transaction, a colliding id in a test. No file-level scan can see
those, because at file level nothing is missing. What generalises from the idea is not the
scan but its shape — generate the expectation, then check it — applied to transitions rather
than to files. That is what the Expect obligation does.

### Holding the model fixed

Every measurement through v5 varied the prompt against `gemini-3.1-pro-high`, so none of them
says whether the prompt or the model was the binding constraint. v6 is therefore run twice on
the same slices and the same commit, once on Gemini 3.1 Pro and once on
`claude-opus-4-6-thinking`. If the two families miss different things, the cheapest recall
available is running wave 1 twice and unioning the candidates, which costs nothing in design
and would outrank any further prompt wording.

### Harness: a subagent can go idle without delivering, and the work survives

v5 recorded two of four refuters going idle with no verdict. It happened again here to a
plain research subagent, which idled without returning a completed survey. Pinging it
directly produced the whole report.

So the failure is in **delivery, not in the work** — which makes the fix cheap and makes
silent acceptance expensive. Dispatch refuters synchronously, account for every candidate
against a returned verdict, and when one is missing, ask for it before writing anything up.
A background agent that idles is indistinguishable from one that had nothing to say.

### The calibration target set

Surveyed from PRs #1800–1858. "Review SHA" is the commit to check out — always the fix
commit's parent. Sizes exclude planning docs, generated Drizzle snapshots, and lockfiles.

| #   | PR    | Review SHA  | Fix                      | Known defects       | Src+test | Why it is here                                                            |
| :-- | :---- | :---------- | :----------------------- | :------------------ | -------: | :------------------------------------------------------------------------ |
| 1   | #1818 | `87cf3b73c` | `f1e1fae8f`, `6ea681065` | 6 (2 absence)       |    ~1150 | Two fix rounds; stale read-modify-write and a missing revalidate          |
| 2   | #1851 | `f93611c59` | `0fe73f191`              | 7                   |    ~1783 | Richest set found; the NUL byte lives here                                |
| 3   | #1825 | `37137622`  | `9759f4928`              | 3 (1 absence, high) |     ~370 | A missing authz check with **no diff pointing at it** — post-merge hotfix |
| 4   | #1809 | `77d36312b` | `575bf1cb5`              | 4                   |      149 | Smallest with a full round                                                |
| 5   | #1856 | `a5b19d75`  | `21ec03c4`               | 3 (2 absence)       |    ~1530 | The v6 target                                                             |
| 6   | #1802 | `4afc2e5e6` | `bafd41e83`              | 3                   |       86 | Cheapest usable probe                                                     |
| 7   | #1807 | `74849f897` | `eda30504d`              | 3, **all absence**  |      286 | Directly on the failing class, at almost no cost                          |
| 8   | #1838 | `34ffe86a8` | `15c8780b0`              | 3 (2 absence)       |      647 | Hook tooling, not app code — use only if that is acceptable               |

Three of these are worth more than their size suggests. **#1807** is three absence defects in
one function for 286 lines, which makes it the cheapest direct test of the thing v6 exists to
fix. **#1825** is a missing `auth.role()` guard in a `SECURITY DEFINER` RPC found _after_
merge, so there is no diff highlighting the area — it tests whether a reviewer finds a missing
check without being pointed at the neighbourhood. **#1856** carries two deliberately declined
findings alongside its three real ones, which makes it the only target that measures
false-positive discipline and recall at the same time.

Rejected categories, so the survey is not re-run: docs-only PRs (14 of them — their findings
are prose-accuracy, not code defects, and #1820's ten findings are all docs fact-checking),
zero-finding or trivial-depth reviews (14), dependency bumps (6), and the meta-PRs about this
review system itself (#1811, #1854), which are a bad blind target for obvious reasons.

### v6 measured: the failure moved, which is the whole point of the new harness

Three runs, two targets, two model families, all on the same prompt version.

| run            | target              | known defects | found | near miss | false positives |
| :------------- | :------------------ | ------------: | ----: | --------: | --------------: |
| Gemini 3.1 Pro | #1856 @ `a5b19d75`  |             3 |     — |         — |               — |
| Opus 4.6       | #1856 @ `a5b19d75`  |             3 | **0** |     **3** |               1 |
| Gemini 3.1 Pro | #1807 @ `74849f897` |             3 | **2** |         0 |               0 |

The Gemini #1856 row is empty because that run never happened: all five subagents were
canceled on command rules and it returned `needs-attention` with five entries in
`blocked_slices` and no findings. It failed honestly — no fabricated review, which is the
"you may not approve a review you did not receive" rule doing its job — but it measures the
permission surface, not the reviewer. **A run that comes back empty needs `blocked_slices`
read before anything is concluded about the model or the prompt.**

### #1807: the Expect obligation works, on the class it was built for

Two of three, and all three defects on this target are absence. Both hits came out of the
expectation list rather than out of reading the code. The slice generated "the drain
documentation must tell the caller how to handle un-actionable items to avoid infinite loops"
before opening the descriptions, then traced a caller through a fleet sweep and landed on the
defect exactly as the fix commit describes it: the sweep spins forever on the one machine
nobody can link. The same list caught the second defect, the tool-level and parameter-level
descriptions disagreeing with the more prominent one wrong.

The third was owned by a slice that never ran, and was reported as blocked rather than
silently dropped.

**The review found both and then failed to report them.** `findings` came back empty, with
the defects written out in `coverage` and paraphrased in `summary`, because the subagent could
not pin them to a diff line — the anchoring rule said to put an unanchorable problem in
`summary`, and it did. That rule has been changed: an unanchorable finding is still a finding,
with `line: null`. A defect parked in prose the author skims is a defect that does not get
fixed.

### #1856: every known defect was correctly anticipated and then wrongly cleared

Opus scored zero, and the expectation lists say why. The lifecycle slice generated, before
reading any implementation:

- "The abandoned listing is reclaimed by a machine in PinPoint" — this is defect A2.
- "The abandoned listing is removed by a human on the PBM website" — this is A1's clear
  condition.

and the test slice generated "test database isolation for parallel workers avoids
cross-contamination", which is A3. **All three were marked `implemented`.**

So the obligation did its job — the right question was asked in all three cases — and the
failure moved one step downstream, from "never thought to look" to "looked and concluded
wrong". That is a different and far more tractable problem, and it is only visible because the
answer key names where each defect lives. Scoring against a review write-up would have shown
0 of 3 and nothing else.

The fix is structural rather than more instruction: an item marked `implemented` must now cite
the file and line implementing it, and the verdict is `unverified` when it cannot. A verdict
that costs nothing to assert gets asserted.

Opus also raised, at `high` and confidence 1.0, the cascade-delete finding that a real
reviewer had explicitly declined at this tree as out of scope by spec decision. One precision
failure against zero on the other target.

### The permission surface is part of the reviewer

Both Gemini runs and three of Opus's five subagents lost turns to canceled commands, and the
recurring shapes were pipes and `grep`. `command(grep)` is now granted — reviewers reach for
it constantly and it cannot write — and both skills now say that `a | b` is refused as a unit
exactly like `a && b`. This is not incidental: on #1856 it cost an entire five-slice wave.

### Column four, measured: a refuter killed a true finding

Every calibration so far counted what refutation removed and treated that as precision. The
number nobody collects is how often refutation removes something real. Here it is.

The two #1807 candidates are known-true — the fix commit repairs both and explains why. Each
went to its own Sonnet refuter, blind to the other, under the standard brief.

| candidate                       | verdict     | severity      | confidence |
| :------------------------------ | :---------- | :------------ | ---------: |
| the drain loop cannot terminate | **refuted** | low           |        0.9 |
| the two descriptions disagree   | narrowed    | medium to low |       0.75 |

One of two true findings killed, at high confidence, by a refuter that read the right file and
quoted the right line.

**How the kill worked is the part worth keeping.** The finding is that two texts contradict
each other and the more prominent one is unsafe on its own. The refuter dismissed it by
quoting the _other_ text — the parameter description that does carry the termination rule —
and concluding a caller reading the whole schema would not hang. That is not a refutation of
the finding; it is a restatement of it. When a finding is that A and B disagree, "B is
correct" cannot be the answer.

So: **one refuter may not kill a finding.** Two refuters, and `refuted` requires agreement
while `stands` does not. The asymmetry is the point — a weak finding that survives costs a
reader half a minute, and a true one that dies costs the review. The same two refuters
demonstrate why a single verdict cannot be trusted: on the same repository, quoting the same
line of source, one said `stands` and the other `refuted`.

**Both also narrowed on an ungrounded premise.** Each argued from how MCP clients present
tool schemas to a model — a fact about the outside world, asserted from knowledge, absent from
the checkout. The grounding rule already forbids this when reporting a finding; it now applies
to refuting one, because a finding dismissed on an invented premise is harder to catch than a
finding raised on one. Nobody re-checks what was already thrown away.

### The other harness lessons of this round

**`status: SUCCESS` does not mean the review finished.** A run returned SUCCESS after 69
seconds with "I have spawned the 4 subagents… I'll wait for their responses". The check is
whether the response parses as the JSON object, never the status field.

**Subagents die when the parent ends its turn, and v6.1 caused that.** The prompt gained "do
not poll your subagents' status in a loop" as an efficiency measure; the next four-slice wave
came back with all four canceled. Told there was nothing useful to do while waiting, the
parent stopped waiting. It then reported the loss as a server restart, which is the model's
guess and not a system message. The instruction now says the opposite: stay active, periodic
status checks are how the turn is held open. A redundant status check costs nothing next to a
lost wave.

**agy's non-Gemini models share one account-wide quota, and a single review exhausts it.** One
five-slice Opus 4.6 review spent the whole allowance; afterwards `claude-sonnet-4-6` and
`gpt-oss-120b` both refused a one-word prompt with `Individual quota reached … Resets in 4h`,
while Gemini runs continued. A cross-family wave 1 is therefore an experiment to budget for,
not a routine second opinion — and it is the reason cross-family independence belongs in wave
2, which runs on Claude Code and costs agy nothing.

**The idle subagent is a delivery failure, four occurrences in.** Refuters, a research
subagent, and a refuter dispatched with `run_in_background: false` have all gone idle without
returning a result, and every one of them produced its complete work when asked directly. The
procedure is to tick each candidate off against a verdict actually received and message
whatever is missing, rather than to prevent it.

### The second refuter, and which constraint actually did the work

The killed finding went back out to a second refuter carrying three new constraints: do not
refute a claimed contradiction by quoting the correct half of it; hold your own counter-
argument to the evidence standard the claim is held to; and if you conclude the caller has a
way out, name it and confirm from the code that it is reachable.

It returned `stands`, medium, 0.85 — and established the point neither the original finding
nor the first refuter had:

> `total` is a plain `count()` over the filter with **no limit or offset applied**, so no value
> of `offset` changes it. The documented escape — set `offset` to the number of machines you
> have deliberately left alone — changes which page comes back and never changes `total`. The
> one thing that would is `pinballmapExcluded`, and grepping all seven `registerTool()` calls
> shows it is settable only by `add_machine`, only at creation. A pre-existing unactionable
> machine has no MCP-only escape at all.

So the first refutation was not a judgement call that went the other way; it was **wrong on a
checkable fact**. It pointed at an escape hatch and never asked whether the quantity that
hatch is supposed to move responds to it.

That identifies which of the three constraints carries the weight. Most refutations turn on an
escape — a guard upstream, a validation elsewhere, a parameter the caller can set, a retry
that fixes it — and the refuter's real job is to find that mechanism in the code and confirm
it applies to the situation described. "Name the escape and verify it" is now in the standard
brief for that reason. The other two constraints are worth keeping and did visible work (this
refuter explicitly declined to reason about how an MCP client renders parameter descriptions,
in either direction), but they are guards against bad arguments rather than the thing that
finds the answer.

Scoreline for the wave-2 experiment, which is the first time recall through refutation has
been measured here at all:

|                                                              | true findings killed |
| :----------------------------------------------------------- | -------------------: |
| one refuter, standard brief                                  |               1 of 2 |
| two refuters, `refuted` requiring agreement, new constraints |           **0 of 2** |

### Flash, #1807: 2 of 3, no blocked slices, no false positives, first round

Switching wave 1 to `gemini-3.6-flash-high` produced the best result of the exercise, on the
cheapest model on the menu and with no resume needed.

|                                                      | v6 Pro | v6.2 Flash |
| :--------------------------------------------------- | -----: | ---------: |
| known defects found                                  | 2 of 3 | **2 of 3** |
| reported as `findings` rather than stranded in prose |      0 |      **3** |
| slices blocked                                       | 2 of 4 |      **0** |
| false positives                                      |      0 |          0 |
| resumes needed                                       |      1 |      **0** |

The two hits are B1 and B3, and both are stated with the right mechanism rather than the right
vicinity:

> "total counts all matching rows in the database (including the skipped machines) and will
> remain >= 1 even when the page query at offset returns 0 rows … The completion condition
> when skipping unchanged items must be `count === 0` or `hasMore === false`, not
> `total === 0`."

That is what the fix commit says, and it is the same fact a second refuter needed a dedicated
pass to establish earlier in the session. The type finding likewise names the repair the
author actually applied — restore `[SQL, ...SQL[]]`.

B2 was missed, and missed in an interesting way: the finding cites both the tool-level
description (line 205) and the `offset` parameter description (line 109) and treats them as
saying the same thing. The defect is that they do not. Merging two texts into one quotation is
a specific failure worth watching for — a slice looking for one problem read past a second one
that was sitting in the same two lines it had already opened.

**One grounding slip, harmless here.** The type finding asserts the declaration "was changed
from a non-empty tuple type … to `Record<PinballmapFilter, SQL[]>`". The direction is
backwards: `SQL[]` is what the tree under review has, and the tuple is what the fix introduced
afterwards. The defect identification is exactly right and the invented history did not affect
it, but a reviewer narrating a change history it cannot see is the same class of error as
asserting a package version from memory, and it would matter in a finding whose argument
rested on it.

### Wave 2, settled: two lenses, and neither of them is "check it again"

The type finding from the Flash run went to two refuters with deliberately different questions
rather than two copies of the same one.

| lens | question                                                           | verdict        |
| :--- | :----------------------------------------------------------------- | :------------- |
| A    | does the type actually permit an empty array, and is it reachable? | narrowed, low  |
| B    | assume it happens — what does the caller actually get?             | stands, medium |

Neither refuted, so the finding stands at the lower severity, which is exactly where the
change's author put it when fixing it.

**Both grounded their arguments in files rather than in knowledge, which is the constraint
that had been missing.** Lens B needed to know what Drizzle does with an empty condition list;
instead of asserting it, it read the vendored `drizzle-orm` source and confirmed that `and()`
over zero conditions returns `undefined` and `.where(undefined)` emits no WHERE clause. It
then went looking for anything else that would still narrow the query — a soft-delete column,
a tenant column, an RLS policy on `machines` — and reported that none exists, which is what
makes "the caller gets the whole fleet" a checked statement instead of a dramatic one.

**The lenses stayed in their lanes.** Lens B declined to rule on whether the type permits the
empty array at all: "that is the other reviewer's job; I am only certifying that IF it does,
the blast radius is exactly as claimed." That separation is why the pair produced a bounded
finding rather than two overlapping opinions — and lens B supplied the bound nobody had asked
for, that the whole-fleet outcome needs `pinballmap` to be the _only_ filter supplied, and
degrades to a silent partial mislabeling when combined with `search` or `presence`.

So the wave-2 design is now three rules, each earned from a specific failure:

1. **Two refuters, and `refuted` requires agreement.** One refuter killed a true finding at
   0.9 earlier in the same session.
2. **Different lenses, not repeated attempts.** Redundancy catches noise; diversity catches
   the failure modes a single angle cannot see.
3. **A refutation is held to the claim's evidence standard**, including "name the escape and
   verify it is reachable" — the check that saved the killed finding.

### v6.3 on #1856: the falsifiability rule works, and the miss moves somewhere new

One round, clean JSON, no resume, no blocked slices, one `schedule` error of the benign kind.

The rule under test was the one added after the previous run returned an inventory of the
change instead of a list of requirements. It worked, and the effect is not subtle:

|      | items | marked `missing` | of those, became findings |
| :--- | ----: | ---------------: | ------------------------: |
| v6.2 |    39 |                1 |                         — |
| v6.3 |    36 |                4 |                         3 |

The items are now requirements with citations. "When hourly sync receives an empty lineup with
`machineCount > 0` from Pinball Map, reconciliation must refuse to clear abandoned listings",
cited to `pinballmap-reconcile.test.ts:235`, is a sentence that could have come back `missing`.
"A table storing the abandoned entry" — the previous run's shape — could not.

One item marked `missing` produced no finding ("the notice must omit any dismiss control"),
which is the leak the sixth scoring column exists to catch. Three of four is not four of four.

**Recall against the key is still 0 of 3.** But the run produced a finding that is not in the
key and is real, and the reason it missed A3 is now specific enough to fix.

#### The new finding, and what two refuters did to it

`clearResolvedAbandonments` guards against a broken payload by refusing to clear when the live
lmx set comes back _empty_. A payload that is merely _partial_ — a 200 whose xref array has
some malformed items — walks straight past it, because `parseLocation` drops the bad items
silently and leaves the set non-empty but short. The delete then removes rows for listings
that are still live on Pinball Map.

| lens | question                                   | verdict                      |
| :--- | :----------------------------------------- | :--------------------------- |
| A    | is the mechanism real and reachable?       | **stands**, 0.95             |
| B    | grant it happens — what does the user get? | **narrowed** to medium, 0.75 |

Lens A checked six links and found no escape. The one that decides it: `parse.ts:92` is
`machineCount: asNumber(r["machine_count"]) ?? lmxes.length`, so `machineCount` comes from the
API independently and only falls back to the parsed length when the field is absent. Had it
been derived from `lmxes.length`, the inequality the finding rests on could never hold and the
finding would have been dead. Lens A also read the parser's own docstring — "Unparseable
records are skipped, not coerced" — which makes the silent drop deliberate rather than
incidental.

Lens B granted the premise and moved the severity down, on two findings the author of the
finding had not established. The row is deleted permanently: `recordAbandonedListing` has
exactly two call sites, both in the human-triggered retitle path, and nothing in the sync loop
ever re-creates a row, so there is no recovery. That argues _up_. But the notice is
maintainer-only behind a `canLink` gate, and its disappearance is an omission rather than an
assertion — there is no "all clear" message, the Alert simply stops rendering. Net: medium.

Both refuters read files instead of asserting, both stayed in their lane, and the pair produced
a bounded finding at a severity neither had been told to reach. That is the third consecutive
pair to behave this way, so wave 2's three rules can be treated as settled.

#### Why A3 was missed, which is the useful part

A3 is the E2E worker-id collision: `const base = Date.now() % 1_000_000`, no worker scoping,
two workers starting a millisecond apart landing on ids one apart — the same gap the test uses
between its old and new title ids.

The slice read that file. It then wrote, inside a _different_ and lower-severity finding about
E2E concurrency, that "the newly added abandoned notice spec uses worker-scoped numeric IDs",
and cleared the concern on that basis. The file contains no worker scoping of any kind; line 52
is the `Date.now()` expression and nothing else touches the id.

This is not the same failure as the previous two runs, and it is the one worth designing
against, because **every evidence rule in the schema attaches to a claim that raises a concern
and none attaches to a claim that closes one.** An `expected` item marked `implemented` owes an
`at`. A finding owes a file and a line. A sentence in the middle of a finding body owes
nothing — and that is precisely where the false clearance sat.

Two rules follow.

**In agy's skill: a statement that clears a concern needs a citation exactly as much as one
that raises it**, everywhere it appears, including in passing. When it cannot be cited, the
honest form is "I did not verify whether X", and X stays open.

**In the dispatcher's skill: scan finding bodies for the shape "X cannot happen because Y" and
check Y yourself.** It is a two-minute pass over five findings and it is the only audit that
reaches this class.

There is a second, narrower cause. The test slice's eight expectations are all coverage
questions — what a correct suite must pin — and a defect in the test's own machinery is not
reachable from that frame. A colliding fixture is not a gap in what the suite covers; it is the
suite being wrong about itself. So a test slice now has to ask both: what the suite must pin,
and what makes each new test trustworthy on its own.

### The falsifiability rule flattens every concern into a behavioural one

The rule added after #1856's inventory problem was re-run against #1807, which the previous
prompt had scored 2 of 3 on. It scored **0 of 3**: zero findings, verdict `approve`, 28 of 28
expectations `implemented`.

All three defects are still in that tree — checked by hand, and the two on the other target
were re-verified independently by a refuter shown neither the fix commit nor the key's
reasoning. The zero is real.

**The cause is visible without reference to the score, which is what makes it trustworthy on a
single run.** The slice asked "what wrong program does each type still admit" returned eight
expectation items, and **not one of them was about a type**. All eight were behavioural query
assertions, most of them duplicating the query slice's list verbatim in substance.

`when <situation>, <outcome> must happen` is a sentence about runtime behaviour. Given it as a
requirement rather than a default, a slice whose concern is _not_ runtime behaviour converts
the concern into the nearest behavioural question it can phrase that way — and the original
concern is gone, with a full list of well-formed, correctly-cited items standing where it was.
That is worse than the inventory failure it replaced, because an inventory is visibly hollow
and this is not.

It accounts for every miss on both targets:

| defect                        | the question the slice needed to ask                | what it wrote                                      |
| :---------------------------- | :-------------------------------------------------- | :------------------------------------------------- |
| B3, type admits `[]`          | can I construct a value this type should not allow? | eight behavioural filter items                     |
| B2, two descriptions disagree | do A and B state the same fact?                     | "must instruct the caller to re-query at offset 0" |
| B1, drain never terminates    | if a caller follows this exactly, does it stop?     | the same item — found the sentence, cleared it     |
| A3, fixture collision         | would this test fail if the behaviour regressed?    | what a correct suite must pin                      |

The B1 and B2 citations were honest, which is worth saying because the obvious diagnosis is
that they were not. `list-machines.ts:109` genuinely does instruct the caller to re-request at
offset 0. The item was one level too shallow: it asked what the documentation _says_ rather
than what following it _achieves_. Following it does not terminate — `total` is a plain
`count()` over the where clause with no offset applied, so machines the caller deliberately
leaves alone hold it above zero forever, and the documented stop condition of "drain to a
total of 0" is unreachable. And the tool-level description, the more visible of the two, omits
the "set offset to the number you have left alone" refinement entirely, which is B2.

**v6.5 makes the template a default rather than a requirement**, with a falsifiable shape per
kind of concern:

| concern                  | item shape                                                                | how it is falsified           |
| :----------------------- | :------------------------------------------------------------------------ | :---------------------------- |
| a type or schema         | must make `<a specific wrong value>` unrepresentable                      | try to construct it           |
| instructions to a caller | a caller following this exactly, in `<situation>`, must reach `<outcome>` | walk the procedure            |
| two texts on one subject | A and B must state the same `<fact>`                                      | quote both, compare           |
| a test's own machinery   | must fail if `<behaviour>` regresses; fixtures must not collide           | read how fixtures are derived |

And the dispatcher's coverage audit gains a fourth failure shape: **read each slice's items
against its own brief, not only against the falsifiability test.** A types slice with no item
of the form "this type must make X unrepresentable" has flattened its concern, however
well-formed its list looks.

#### Honest limit

v6.2 → v6.3 on #1807 is one run each, so the _score_ movement cannot be separated from
run-to-run variance. The types-slice evidence does not have that problem — a slice returning
zero items in its own subject is a defect in the prompt regardless of what the run scored —
and that is why the fix is being made on the strength of it rather than on the 2 → 0.

### The falsifiability rule flattens every concern into a behavioural one

The rule added after #1856's inventory problem was re-run against #1807, which the previous
prompt had scored 2 of 3 on. It scored **0 of 3**: zero findings, verdict `approve`, 28 of 28
expectations `implemented`.

All three defects are still in that tree — checked by hand, and the two on the other target
were re-verified independently by a refuter shown neither the fix commit nor the key's
reasoning. The zero is real.

**The cause is visible without reference to the score, which is what makes it trustworthy on a
single run.** The slice asked "what wrong program does each type still admit" returned eight
expectation items, and **not one of them was about a type**. All eight were behavioural query
assertions, most of them duplicating the query slice's list verbatim in substance.

`when <situation>, <outcome> must happen` is a sentence about runtime behaviour. Given it as a
requirement rather than a default, a slice whose concern is _not_ runtime behaviour converts
the concern into the nearest behavioural question it can phrase that way — and the original
concern is gone, with a full list of well-formed, correctly-cited items standing where it was.
That is worse than the inventory failure it replaced, because an inventory is visibly hollow
and this is not.

It accounts for every miss on both targets:

| defect                        | the question the slice needed to ask                | what it wrote                                      |
| :---------------------------- | :-------------------------------------------------- | :------------------------------------------------- |
| B3, type admits `[]`          | can I construct a value this type should not allow? | eight behavioural filter items                     |
| B2, two descriptions disagree | do A and B state the same fact?                     | "must instruct the caller to re-query at offset 0" |
| B1, drain never terminates    | if a caller follows this exactly, does it stop?     | the same item — found the sentence, cleared it     |
| A3, fixture collision         | would this test fail if the behaviour regressed?    | what a correct suite must pin                      |

The B1 and B2 citations were honest, which is worth saying because the obvious diagnosis is
that they were not. `list-machines.ts:109` genuinely does instruct the caller to re-request at
offset 0. The item was one level too shallow: it asked what the documentation _says_ rather
than what following it _achieves_. Following it does not terminate — `total` is a plain
`count()` over the where clause with no offset applied, so machines the caller deliberately
leaves alone hold it above zero forever, and the documented stop condition of "drain to a
total of 0" is unreachable. And the tool-level description, the more visible of the two, omits
the "set offset to the number you have left alone" refinement entirely, which is B2.

**v6.5 makes the template a default rather than a requirement**, with a falsifiable shape per
kind of concern:

| concern                  | item shape                                                                | how it is falsified           |
| :----------------------- | :------------------------------------------------------------------------ | :---------------------------- |
| a type or schema         | must make `<a specific wrong value>` unrepresentable                      | try to construct it           |
| instructions to a caller | a caller following this exactly, in `<situation>`, must reach `<outcome>` | walk the procedure            |
| two texts on one subject | A and B must state the same `<fact>`                                      | quote both, compare           |
| a test's own machinery   | must fail if `<behaviour>` regresses; fixtures must not collide           | read how fixtures are derived |

And the dispatcher's coverage audit gains a fourth failure shape: **read each slice's items
against its own brief, not only against the falsifiability test.** A types slice with no item
of the form "this type must make X unrepresentable" has flattened its concern, however
well-formed its list looks.

#### Honest limit

v6.2 → v6.3 on #1807 is one run each, so the _score_ movement cannot be separated from
run-to-run variance. The types-slice evidence does not have that problem — a slice returning
zero items in its own subject is a defect in the prompt regardless of what the run scored —
and that is why the fix is being made on the strength of it rather than on the 2 → 0.

# Fresh calibration targets — keys verified against the review-point tree

Built to stop overfitting to #1856 and #1807. Every defect below was confirmed by reading the
tree at the review point, not by trusting the fix commit's message.

## Target C — PR #1809, review at `77d36312`, fix `575bf1cb`

613 lines / 7 files. **The parent is a merge commit**, so the reviewer's diff must be
`git diff --merge-base origin/main` — diffing from the parent drowns the change in main.

| id  | class         | defect                                                                                                                                                                                                                                                                                                    |
| :-- | :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | ABSENCE       | A `machineGroupId` lookup against an empty catalog mirror returns the same "no family has this id" error as a genuinely bad id, so a fresh or reset environment is told confidently that its id is wrong. `search-pinballmap-catalog.ts:119`, and the query-search branch has the same gap near :150.     |
| C2  | ABSENCE       | The `machineGroupId` parameter description says only "not a pinballmapMachineId" and says nothing about standalone titles, which come back with `machineGroupId: null` and the `pinballmapMachineId` already being the answer — a caller following the text is steered into the wrong second call. `:40`. |
| C3  | CONTRADICTION | Both result shapes expose a field named `count`, against the `total`/`hasMore` convention `list_machines` explicitly trains callers to use _instead_ of `count`. `:128` and `:150`.                                                                                                                       |
| C4  | CONTRADICTION | `get_machine`'s description promises "availability"; the payload key is `presence`. Description at `get-machine.ts:99`, field at `:73`.                                                                                                                                                                   |

Two absences and two contradictions, and the contradictions are only visible against sibling
tools outside the diff — which is the comparison half this harness has historically skipped.

## Target D — PR #1818, review at `2668f4ab`, fixed by #1825 / `9759f492`

~1371 lines of real code and tests, over the size guideline, but all three defects sit in
small isolable spots. Review point is PR #1818's own squash commit rather than the literal
fix parent, because the fix branch forked after two unrelated PRs had landed on top.

| id  | class              | defect                                                                                                                                                                                                                                                                                                                                                        |
| :-- | :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | ABSENCE (security) | `get_pinballmap_credentials()` is `SECURITY DEFINER`, returns a decrypted Vault secret, and has no `auth.role()` check in its body — it relies entirely on `REVOKE`/`GRANT`, which Supabase's connection-time re-grant to `authenticated` defeats, and PostgREST exposes every public function as an RPC. `drizzle/0061_pinballmap_credentials_rpc.sql:9-27`. |
| D2  | TYPE               | The prod opt-in flag is read with `Boolean(process.env[...])`, and `Boolean("0")` and `Boolean("false")` are both true — the two spellings an operator would use to turn the flag off are exactly the ones that enable writing dev credentials into prod's Vault. `supabase/seed-pinballmap-creds.mjs:46`.                                                    |
| D3  | ABSENCE            | The unlist action deletes by the _stored_ lmx handle without re-checking it against the live lineup, so a re-minted id makes the delete 404 as "already gone", clears the local columns, and lets the next reconcile re-list the cabinet — the operator's unlist silently un-happens. `pinballmap-actions.ts:531`.                                            |

D1 is the first genuinely high-severity security defect in the calibration set.

## Target E — PR #1851, review at `e7ee7075`, fixed by #1859 / `a1b975bb`

~2494 lines of real code and tests. Cleanest parent relationship of the four — a single-parent
commit sitting almost directly on #1851's merge.

| id  | class    | defect                                                                                                                                                                                                                                                                                                                                                        |
| :-- | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | TYPE     | `NamedProfile.role` is plain `string` rather than `UserRole`, and three comparisons against string literals would compile fine with a typo and silently match nobody. `shared.ts:191`, comparisons near :239, :253, :265.                                                                                                                                     |
| E2  | PRESENCE | The UUIDv8 content-addressing logic — digest, NUL-join, version and variant bit-stamping, hex rendering — is duplicated verbatim across two files, hand-rolled bit-stamping that must stay in sync for idempotency to hold. `create-issue.ts:107-120` vs `add-issue-comment.ts:75-88`.                                                                        |
| E3  | ABSENCE  | The severity, priority and frequency zod schemas hardcode their own literal arrays instead of deriving from the app's source types, unlike `status`, which derives from `ISSUE_STATUS_VALUES` right next to them. A new value added elsewhere is silently rejected here with nothing failing to compile. `create-issue.ts:43`, `update-issue.ts:101/107/111`. |
| E4  | ABSENCE  | `get_issue`'s comment window orders only by `desc(createdAt)` under a `LIMIT` — not a total order, so two comments sharing a timestamp at the boundary can swap between calls. `list-issues.ts` already breaks the tie with a second key for exactly this reason. `get-issue.ts:117`.                                                                         |

## Target F — PR #1810, review at `23272cd1` (weakest, partially verified)

1041 lines, parent is a merge commit. Two of five defects verified directly: the hourly
reconcile wraps every machine's auto-link write in one transaction, so one collision rolls back
the whole pass (`sync.ts:152`); and save-time capture never checks `pinballmap_state.enabled`,
so a save with the integration switched off still lists a cabinet (`actions.ts:768`). The other
three come from the fix message and are unconfirmed — do not score against them.

Also noted: #1810 has a _second_ review round that found defects surviving the first fix. That
is the target to use if the question is ever "does this reviewer catch what a previous reviewer
missed" rather than "does it catch what a reviewer caught".

## How to use these

Run each prompt **at least twice** before concluding anything about a prompt change. The model
is not deterministic, and the whole v6.3–v6.6 detour came from reading single runs as if they
were measurements.

## Target G — "survived a review": PR #1810 at `830012fd`, keyed against round two

Every other key asks whether the harness can reproduce findings a reviewer already made. This
one asks the question that actually matters for a second opinion: **can it find what a review
missed?** PR #1810 had two review rounds. The review point is the tree immediately after round
one landed — code a human reviewer had just signed off on — and the key is only what round
two (`e8620fcf`) repaired.

**Review point** `830012fd`, single-parent, not a merge commit. The reviewer diffs
`git diff --merge-base origin/main` (merge base `695ec11e`), which reproduces the same 14-file,
1206-insertion view a round-one reviewer had. Not the parent diff — that shows only round one's
repairs, and the point is to look at the whole feature.

| id  | class   | defect                                                                                                                                                                                                                                                                                                                                                                                                                                                  | in round one's own diff?                                                                                                                                         |
| :-- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | ABSENCE | `captureAutoLink` is called with no wrapper, and its try/catch absorbs only the expected `23505`. Anything else — deadlock, dropped connection, a failed timeline receipt — reaches the action's outer catch, which reports "Failed to update machine" for an edit that **already committed**, sending the user to redo work that landed. `actions.ts:874-877` and `:1087-1090`; the outer catch at `:1155-1167` states the false premise in a comment. | **yes**                                                                                                                                                          |
| G2  | ABSENCE | The collision handler checks a bare `23505` with no constraint name, while the same transaction also writes a `timeline_events` row under its own partial unique index. A collision there is misread as "someone else already listed it" and the function returns `false`: nothing linked, nothing logged, repeated hourly with no visible failure. `getPostgresErrorConstraint` already existed and is not used. `sync.ts:119`.                        | **yes**                                                                                                                                                          |
| G3  | ABSENCE | `reconcileAfterSync` never checks `pinballmap_state.enabled` before writing listing state, so a stored snapshot outlives the integration toggle and "Sync now" with the integration off still auto-lists the fleet. `sync.ts:148-149`.                                                                                                                                                                                                                  | **no** — untouched since the original implementation. Round one gated the _other_ auto-link path on `state.enabled` in this same commit and left this one alone. |

**G3 is the isolation case and the most valuable single item in the whole calibration set.** It
is the only defect whose signal is absent from the diff a reviewer was reading — the only way
to reach it is to re-read the feature rather than the patch. If the harness finds G1 and G2 but
not G3, it reviews diffs; if it finds G3, it reviews code.

**Do not score these as false positives.** Round two explicitly considered and declined two
other candidates, leaving its reasoning in the code as comments: a stood-down write leaving a
non-holder, which the counting loop already excludes; and an all-ineligible group staying
counted because a human can resolve it. Raising either is defensible, not wrong.

## Target F — PR #1810 at `23272cd1`, now fully verified

All five key items confirmed by reading the tree; nothing dropped. The three that were
previously taken from the fix message alone:

- Save-time capture calls `emitAutoLinkReceipt(tx, …)` **inside** the `db.transaction` callback
  (`actions.ts:900`, `:1110`), and the catch at `:1193` treats any `23505` in that transaction —
  including one thrown by the receipt insert — as a listing collision, rolling back the human's
  name, owner and presence edits over derived bookkeeping. ABSENCE.
- The counting loop has no holder exclusion at this commit — that is what round one added — so
  a non-holder same-title cabinet is counted `desynced` forever, including the ones the unique
  index structurally forbids from ever holding the listing. ABSENCE.
- `PinballmapListingControl.tsx:47-49` still says the only writers of `pinballmapListed` are two
  named actions, while the same commit has already added auto-link as a third. CONTRADICTION.

### v6.7 on a fresh target, run twice: 2 of 4 both times

PR #1809 at `77d36312` — 613 lines, four defects verified in the tree, and the first target
neither the prompt nor I had seen before. Run twice, per the rule that a single run is an
anecdote. Scored by me and then independently by an agent that held the key and was told to
disagree if it reached a different number.

| key item                                                      | run A                  | run B               |
| :------------------------------------------------------------ | :--------------------- | :------------------ |
| C1 empty mirror indistinguishable from a bad id               | **hit**, both branches | **hit**, one branch |
| C2 parameter description dead-ends standalone titles          | **hit**, high/0.95     | **hit**, high/0.95  |
| C3 `count` field against the `total`/`hasMore` convention     | near miss              | near miss           |
| C4 `get_machine` promises "availability", field is `presence` | miss                   | miss                |
| false positives                                               | 0                      | 0                   |

Two runs agreeing on which two they find and which two they miss is worth more than either
run's score. The `expected` verdict counts, by contrast, were 7 `missing` of 24 in run A and 1
of 24 in run B for identical results — **that list does not predict what a review finds**,
which is one more reason to keep it cheap.

#### The two misses are different failures, and only one is a blind spot

The independent scoring corrected me here, and the correction is the useful part.

**C3 is a near miss: both runs ran the exact comparison that exposes it and concluded the code
was fine.** Run A's slice recorded reading `list-machines.ts` to compare "count/total reporting";
run B's recorded comparing "how list-machines handles over-fetching / `hasMore` counts". Both
then marked their `hasMore` expectation `implemented`. `hasMore` is present, so the item passes
— and what is _absent_ is `total`, while the field that is present is named `count`, the exact
name `list_machines`' own description tells callers never to answer counting questions from.
Each run checked that a convention was present and missed that a neighbouring one was gone.

**C4 is a clean miss.** Neither run mentions "availability" or `presence` anywhere in any field.
Run A did read `get-machine.ts`, but for its PinballMap data block and field naming — a
different part of the file than the tool description at :99 against the payload key at :73.

So the harness's weak spot is now sayable in one line: **it finds absences in behaviour and
misses absences in convention**, where the missing thing is only missing relative to a sibling.
That matches the #1851 measurement from earlier in this doc, where every human finding cited a
comparison target outside the diff and agy's subagents read almost none.

#### One finding outside the key, and it is out of scope rather than wrong

Run A raised `link-columns.ts:90` — the same mirror-state confusion as C1, in a function that
reports "no longer in the catalog" when the mirror is merely unpopulated. Verified real. But
`git diff 4325f8ad 77d36312 -- src/lib/pinballmap/link-columns.ts` is empty: the file is
byte-identical across this change. The run generalised a defect it had correctly understood to
a place this PR never touched.

For "review this PR" that is out of scope. For a second opinion whose job is to catch what the
first reviewer missed, it is arguably the most interesting thing either run produced. Which of
those two things this harness is for is a real question, and the survived-a-review target
(#1810 at `830012fd`) is the one that answers it.

### The survived-a-review target: 2 of 3, including the one the diff could not show

PR #1810 at `830012fd` — the tree immediately after review round one landed, scored only
against what round two repaired. Every other target in this set asks whether the harness can
reproduce findings a reviewer already made. This one asks whether it finds what a reviewer
missed, which is the only question that matters for a second opinion.

| key item                                                                                                                     | in round one's diff? | result                                                |
| :--------------------------------------------------------------------------------------------------------------------------- | :------------------- | :---------------------------------------------------- |
| G1 `captureAutoLink` unwrapped — a non-`23505` failure reports "Failed to update machine" for an edit that already committed | yes                  | **hit**, high/0.9, named both call sites              |
| G2 bare `23505` check misreads a timeline-receipt collision as "already listed"                                              | yes                  | miss — the slice that owned it returned zero findings |
| G3 the enabled gate missing on the manual sync path                                                                          | **no**               | **hit**, medium/0.95                                  |

**G3 is the result the whole exercise was built to get.** It is the only defect in the
calibration set whose signal is absent from the diff the reviewer was reading — those lines had
been untouched since the original implementation, and round one gated the _other_ auto-link
path in that same commit while leaving this one alone.

agy reached it by doing exactly the sibling comparison that was missing on #1809: it named the
cron route and the single-machine save as the two callers that check `state?.enabled`, and this
path as the one that does not.

The fix's own comment, written independently, reproduces the argument almost line for line:

> the two callers disagree: the cron route gates, and "Sync now" deliberately does not (a human
> refresh owns its own decision). That asymmetry was fine while this pass only healed lmx ids.
> Now that it also LISTS, ungated it would mean one technician clicking "Sync now" auto-lists
> the whole fleet while the integration is switched off.

The one divergence is where the check belongs. agy put it at the caller; the fix put it inside
`reconcileAfterSync` _because_ the callers disagree. That is a fix-location choice, not a
different defect. agy also over-claimed the blast radius slightly — it said the ungated path
would trigger external HTTP requests, where the fix notes that fetching a snapshot while
disabled is harmless and only writing listing state off it is not.

#### This corrects the generalisation from #1809

After #1809 I wrote that the harness misses defects requiring comparison outside the diff. That
is too broad. The sharper statement, which both targets support:

- **Behavioural preconditions compare well.** "These three callers do the same job and one of
  them skips a check" is found, across files, outside the diff, at 0.95.
- **Naming conventions compare badly.** "This field is called `count` where the sibling trains
  callers to read `total`" is missed even when the slice records having opened the sibling
  specifically to compare count reporting.

#### Two harness bugs, both mine

**The completeness check keyed on `verdict`.** The parent emitted a complete four-finding
review with `coverage`, `blocked_slices` and `findings`, and no `verdict` — so `run.sh` called
it incomplete and burned three resume rounds re-asking for work it already had. Now keyed on
`findings` being an array, which is the payload; `verdict` is decoration.

**The `schedule` conflict error is not benign after all.** This doc recorded it that morning as
"one per wave, self-heals". At 556 status polls it became the run's terminal error:
`another active schedule task "…/task-55" has a conflicting early termination condition "any"`.
It self-heals early and kills late, and the longer a wave runs the more likely it is to land
fatally. Long waves should expect it.

---

## 2026-08-14 — Gemini 3.7 Flash, and a permission-to-find-nothing framing

### 3.7 Flash + the no-quota framing: 0 of 4, and a confident approve

Two variables moved at once — Gemini 3.7 Flash (High) replaced 3.6, and the prompt gained the
"there is no quota, finding nothing is fine" framing (v6.8). The result on PR #1809 at
`77d36312`, where 3.6 + v6.7 scored 2 of 4 on two separate runs:

| run | model              | prompt   | findings | score                          |
| :-- | :----------------- | :------- | -------: | :----------------------------- |
| a   | 3.6-flash-high     | v6.7     |        2 | 2 of 4                         |
| b   | 3.6-flash-high     | v6.7     |        2 | 2 of 4                         |
| g37 | **3.7**-flash-high | **v6.8** |    **0** | **0 of 4**, `verdict: approve` |

A confident clean is the most expensive way for a reviewer to be wrong, so the run is worth
reading rather than just scoring.

#### Every expectation item was discharged, and every trace was the happy path

24 items across four slices. **All 24 marked `implemented`**, none `missing`, none
`unverified`. That is the exact shape already recorded as the coverage-audit failure signature,
at its limit.

All four slices also traced the same sequence — search `elvira`, take the `machineGroupId`,
list its editions, extract a `pinballmapMachineId` — which is the vanilla success path. The
Trace obligation asks for "a retry, two actors on one record, a value that is stale by one sync
cycle"; four slices out of four picked the path where nothing goes wrong. Three of the four
keyed defects only appear when something does.

#### One item landed on the defect's own line and cleared it

Slice 2, item 3:

> _Listing editions for a non-existent or invalid `machineGroupId` throws a clear not_found
> error rather than returning an empty list disguised as a zero-edition family_ —
> `implemented`, at `search-pinballmap-catalog.ts:119`

C1 **is** line 119. The item read the right file, cited the right line, and was satisfied by it,
because it asked whether an error is thrown at all. C1 is that an _empty catalog mirror_ throws
the same "no family has this id" error as a genuinely bad id, so a fresh environment is told
confidently that its id is wrong. One level deeper and the item finds it.

This is the same shallowness that cost the #1807 v6.3 run, recurring: an item about what the
code _does_ rather than about what following it _achieves_.

#### What did not change

Slice 3 read `list-machines.ts`, `get-machine.ts`, `add-machine.ts` and `shared.ts` — precisely
the siblings C3 and C4 require — and reported nothing. 3.6 did the same thing twice. The
naming-convention blind spot is not a 3.6 artefact.

#### The confound, and the control

Model and prompt moved together, so this run cannot attribute the drop. The disambiguating run
is 3.6 + v6.8 on the same target:

- 3.6 + v6.8 returns ~2 → the model is the regression.
- 3.6 + v6.8 returns 0 → the no-quota framing is, and the plausible mechanism is that it makes
  "everything holds" a comfortable place to stop. 24/24 discharged, four happy-path traces and
  an `approve` is what a reviewer who has been told it is fine to find nothing looks like.

#### The control: 3.6 + v6.8 scores 2 of 4, so the framing is exonerated

| run      | model   | prompt   | findings | score                |
| :------- | :------ | :------- | -------: | :------------------- |
| a        | 3.6     | v6.7     |        2 | 2 of 4               |
| b        | 3.6     | v6.7     |        2 | 2 of 4               |
| **g36c** | **3.6** | **v6.8** |    **3** | **2 of 4** + a bonus |
| g37      | 3.7     | v6.8     |        0 | 0 of 4, `approve`    |

C2 at medium/0.95 and C1's query half at medium/0.85, plus a test-coverage finding not in the
key: `search_pinballmap_catalog`'s seven integration cases all pass an admin context, so the
`machines.view` check could be deleted with nothing failing, where sibling tools in the same
file do cover it.

The no-quota framing costs nothing at three runs across two prompts. That leaves the model.

#### 3.7 run two reproduces run one exactly

24 of 24 implemented, no `missing` items, three of four traces on `elvira`, `verdict:
approve` — and four slices reported with none blocked, so it is a real review returning zero,
not a lost wave.

| model          | runs | findings | keyed            |
| :------------- | ---: | :------- | :--------------- |
| 3.6-flash-high |    3 | 2, 2, 3  | 2 of 4 every run |
| 3.7-flash-high |    2 | 0, 0     | 0 of 4 both runs |

Run two also walked C1's exact path and cleared it. Its slice-2 trace, in full:

> `search_pinballmap_catalog({ machineGroupId: 70012 })` → `runSearchPinballmapCatalog` →
> `listGroupEditions(70012)` **returning `[]`** → `throws McpToolError(not_found)` with hint to
> use machineGroupId instead of pinballmapMachineId

C1 is that the empty array has two causes — a bad id, and a catalog mirror with nothing in it —
and the error only names one. The trace records the empty array and moves on. Never asking why
it was empty is the whole miss.

**Default stays 3.6-flash-high.** 3.7 is measured worse here and its failure mode is the
expensive one: not a review that argues wrongly, a review that approves confidently.

#### What actually separated the scoring run from the zero: which instance got traced

This does not depend on comparing scores across runs, which is the part non-determinism makes
unreliable. It is visible inside the runs.

The control's two `missing` expectation items map one to one onto its two keyed findings:

| item marked `missing`                                                      | finding |
| :------------------------------------------------------------------------- | :------ |
| description explains how standalone titles (`machineGroupId: null`) differ | C2      |
| distinguishes an empty catalog mirror from a query returning 0 matches     | C1      |

22 of 24 implemented, and both exceptions became findings. So the list worked — and the reason
it produced items sharp enough to be violated is upstream of the list. That slice traced **"The
Addams Family"**: a standalone title where `machineGroupId` is `null`. 3.7 traced `elvira`, an
ordinary multi-edition family, in all four slices, marked 24 of 24 implemented, and found
nothing.

The Trace obligation currently asks for a concrete sequence and offers examples of awkward ones.
Both runs complied. Only one picked an instance where a field is null. **Candidate v6.9 change:
require the most awkward instance the change admits, not merely a specific one.** Held rather
than applied — every revision made on one run's evidence has cost recall.

#### The first control attempt was void, and nearly scored as a zero

It returned `findings: []` — and all four slices in `blocked_slices`, each with _"Subagent
execution interrupted by system restart before report could be delivered."_ Nothing restarted;
that is the parent's own confabulation for having ended its turn after fanning out, already on
record from an earlier wave. So it is a lost wave, not a clean review, and it settles nothing.

The reporting rules did their job — the parent listed every dropped slice and returned
`needs-attention` rather than `approve`. The harness did not. `run.sh` gates completeness on
`findings` being an array, and **a wave that loses every slice emits exactly that**: a
well-formed object with an empty array. It parses, it looks like a clean review, and it is the
most dangerous possible false negative in a calibration set.

`run.sh` now prints `findings=N blocked=N slices_reported=N` on every success and exits 3 when
`coverage` is empty. A zero is only a zero when somebody reported.

### #1810 run two: 2 of 3 again, and a different two

Same target, same key, near-identical prompt (v6.8 differs from v6.7 only by the no-quota
paragraph). 5 findings, 4 slices reported, 0 blocked.

| key item                                                                                                                    | run 1 (v6.7)         | run 2 (v6.8)                                  |
| :-------------------------------------------------------------------------------------------------------------------------- | :------------------- | :-------------------------------------------- |
| G1 `captureAutoLink` unwrapped, a non-`23505` failure reports "Failed to update machine" for an edit that already committed | hit, high/0.9        | hit, high/0.9, **both** call sites separately |
| G2 bare `23505` conflates a `timeline_events` collision with a listing collision                                            | **miss**             | **hit**, medium/0.9, `sync.ts:119`            |
| G3 missing `enabled` gate on the manual sync path                                                                           | **hit**, medium/0.95 | **miss**                                      |

**The union of two runs is 3 of 3.** Neither run alone gets there.

This is the clearest evidence yet for running twice rather than tuning once. G2 had been the
open question — the slice that owned it returned zero findings on run 1, and the candidate
explanation was that the slice was mis-designed. It was not. The same slice on the same brief
found it the next time, and named the mechanism the key calls the giveaway: the transaction
also writes a `timeline_events` row under its own partial unique index, so a collision there is
absorbed as "someone else already listed it".

Read the other way: **run 1's G3 hit is not reproducible either.** The single most valuable item
in the calibration set — the only one invisible in the diff a reviewer was reading — was found
once in two attempts. "This harness reviews code rather than diffs" is a claim about one run,
and the honest version is that it _can_, not that it _does_.

#### The two unkeyed findings

Neither is a false positive.

- **`createMachineAction` never calls `resolveAutoLinkForMachine`** (medium/0.85). Verified: the
  only call site is `actions.ts:751`, inside `updateMachineAction` which begins at `:576`;
  `createMachineAction` runs `:211`–`:575` with no call. A cabinet created with a catalog title
  already matched stays unlisted until the hourly cron. Not in the key because round two did not
  address it, but it is the same shape as G3 — two sibling entry points into one job, one of
  them missing a step.
- **Snapshot freshness is never checked** before a save-time auto-link decision (low/0.8),
  correctly hedged as "could be" rather than asserted.

#### What this settles about the framing

3.6 + v6.8 across two targets: 2 of 4 on #1809 plus a valid bonus, 2 of 3 on #1810 plus a valid
bonus. Matches the v6.7 baseline on both. The no-quota paragraph is free — keep it.
