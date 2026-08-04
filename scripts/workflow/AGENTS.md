# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and human-only gate-enforced merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**Merging is human-only (PP-wi85).** `merge-pr.sh` is blocked for agents by the `block-direct-merge.cjs` PreToolUse hook, in ANY invocation shape (including `--dry-run`) — there is no agent bypass. Agents run every other script in this directory freely, including `pr-screenshots.mjs`, `mark-claude-review.sh`, and `merge-handoff.sh` (which _prints_ the merge command without being able to run it); only `merge-pr.sh` itself is off-limits. Tim runs it directly (`scripts/workflow/merge-pr.sh <PR> --human`) once an agent hands the PR off as ready.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, review state, merge state, draft state. All open PRs if no args. The Review column shows the unresolved-thread count when there are any (they need action now), otherwise the review state: `reviewed` (`marker` or `commented`), `RE-REVIEW` (either stale state), `NOT REVIEWED` (`unreviewed`).                                                                                                                                                                                                                     |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. Unresolved threads print a reminder but do **not** stop the watch — watching CI is a step _inside_ the fix→push→resolve loop. `--check-ready` also reports a `review` line naming the review state (the five below, or `unknown` if the API calls fail) — reported, not gated: this mode answers "is this PR worth Tim's `/code-review`?", and the review is what happens after that answer is yes. |

`pr-watch.py` exit codes: **0** passed, **1** a run or the CI Gate actually failed, **2** the outcome could not be determined — the GitHub API was unreachable (rate-limit 403, network drop, auth failure), so nothing was observed. Exit 2 is not a red CI: re-run the watch once the API is back rather than hunting for a broken test. (PP-qkl8)

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. `--pages` needs the **equals** form; the space form errors. A filtered run rebuilds the sticky comment from only the pages it shot, so end with an unfiltered run. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                                                                                                                                                                                                  |

### Readiness and Merge

| Script                                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-handoff.sh <PR>`                        | **Agent-runnable, read-only.** Prints the merge handoff block: review depth + how many commits back it was, CI, threads, mergeable + distance behind main, last merge-from-main, diff split src/tests/docs/other, diff since the review, migrations, newly-registered env vars, UI + screenshots, bead. Ends with two `!`-prefixed commands — re-run the report, and merge. The merge command is printed **only** when all four gates pass. Fetches via `refs/pull/<PR>/head`, reads both sides off `FETCH_HEAD`, and passes `--refmap=` so the base fetch does not fast-forward `origin/main` through the configured refspec — it updates no ref and works from any worktree. If `gh` and the pull ref disagree about head, it says so and blocks: the gate answers would be about one commit and the diff about another. |
| `merge-pr.sh <PR> --human [-a]`                | **Human-only — blocked for agents.** Re-evaluates all 4 gates (`ci`, `threads`, `reviewed`, `no_conflict`) and squash-merges if all pass. Removes ready-for-review label on failure. `--human` is required to actually merge (defense-in-depth for non-Claude-Code harnesses); `--dry-run` doesn't need it but agents can't run the script at all inside Claude Code, dry-run included. `-a`/`--automerge` polls until the gates go green (merge), a gate hard-fails (stop, exit 1), or the budget expires (stop, exit 2, PR untouched). It does **not** wait out an unreviewed head: `reviewed` never WAITs, so an unattested head hard-fails on the **first** poll. Run `/code-review` and let the agent attest before firing it.                                                                                        |
| `mark-claude-review.sh <PR> <depth> [summary]` | Posts/updates a sticky SHA-pinned review marker comment (`<!-- pinpoint-claude-review: <head_sha> -->`) — one of the two things that satisfy the `reviewed` gate, and the one for a review that left no comments behind (found nothing, ran at `ultra`, or ran without `--comment`). What it attests to is Tim having run `/code-review`; an agent posting it for a review nobody ran is a false attestation, not a shortcut. `<depth>` (`low`\|`medium`\|`high`\|`xhigh`\|`max`\|`ultra`\|`trivial`) records WHICH review ran, in a second HTML comment; it is required because there is no default that would not be a guess (PP-9onv).                                                                                                                                                                                  |
| `_pr-gates.sh`                                 | Shared bash helper sourced by `merge-pr.sh` and `merge-handoff.sh`. Defines the gate functions and the review-evidence lookup (`_review_record`, whose first two fields are `_review_verdict` — one implementation, so the gate and the handoff report cannot disagree about whether head was reviewed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                      | Bypass kind |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                       | `admin`     |
| `threads`     | Zero unresolved review threads, from any author                                                                  | `force`     |
| `reviewed`    | Hard backstop — head must be reviewed. PASS on `marker` / `commented`; FAIL on the stale states and `unreviewed` | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                           | `none`      |

### Review state (`reviewed`)

**Copilot review was retired on 2026-08-02 (PP-4ric)** — the free tier was too small to review PinPoint's PRs, so no bot reviews this repo. The review that satisfies the gate is Tim running `/code-review` over the branch, which an agent **cannot** launch: it is a Claude Code harness built-in only he can trigger. So the review is a handoff — and the command to hand him is `/code-review <depth> --comment <PR#>`, because `--comment` is what puts the findings on the PR instead of in his terminal. The exception is a genuinely trivial change (a typo, a comment, a one-line mechanical fix), where the marker summary should say why it was trivial.

`_compute_review_state` in `_pr-gates.sh` reports five states, over the two evidence kinds PP-97tt established:

| State            | Meaning                                                 | `reviewed` |
| ---------------- | ------------------------------------------------------- | ---------- |
| `marker`         | **Some** review marker pins head's SHA                  | PASS       |
| `commented`      | **Some** top-level review comment pins head's SHA       | PASS       |
| `stale_marker`   | Markers exist, none pins head — newest reported         | FAIL       |
| `stale_comments` | Review comments exist, none pins head — newest reported | FAIL       |
| `unreviewed`     | No evidence of either kind on this PR                   | FAIL       |

Both PASS tests are membership — does _any_ piece of evidence pin head — not "does the newest one". A PR normally carries exactly one marker, since `mark-claude-review.sh` rewrites a single sticky comment, but a second session or a hand-posted comment can leave two. If reader and writer each picked a comment and picked differently, re-attesting would rewrite one the gate never reads, and a genuinely reviewed head would report `stale_marker` forever with `--force` as the only way out.

**Markers outrank comments** at every step, pinned and stale alike, because a marker also records a depth. A fixed precedence rather than "whichever is newer": the two clocks are not comparable — a marker's `updated_at` moves when the sticky comment is rewritten, a comment's when someone edits a finding — so ordering by timestamp would make the answer depend on which unrelated edit happened last.

**Review comments pin `original_commit_id`, never `commit_id`.** GitHub re-anchors `commit_id` as a PR advances so a still-applicable comment stays attached to a live line; a gate reading it would find every review comment pinning head forever and wave through commits nobody read. **Replies are excluded** (`in_reply_to_id != null`) for the mirror-image reason: a reply is created at whatever head is current, so an agent answering the thread it just fixed would otherwise re-attest a commit no reviewer has seen.

A `gh` failure on either lookup reads as "no evidence there". That is fail-closed by construction — a lookup can only remove evidence, so an API blip makes the gate stricter, never green.

**Posting review comments needs a permission rule, and its absence is silent.** The first real `/code-review --comment` run on this repo posted nothing: the `mcp__github_inline_comment__create_inline_comment` tool was not in the session and the `gh api …/pulls/<PR>/comments` fallback was refused by the auto-mode classifier, so the findings printed to the terminal and the PR carried no trace of them. `.claude/settings.json` now allows both (`permissions.allow`), checked in so it reaches every machine.

**The rule helps; it is not a guarantee.** The classifier still refuses some shapes of the same call — a multi-line `-f body=…` was refused on the run that added this note, and a single-line `-F body=@file` was refused once and then allowed on an identical retry. So an allow rule makes posting usually work, not reliably work, and `--comment` failing is a thing to expect rather than a thing to debug once. If a review's findings come back as terminal text rather than threads, check the rule first, then just retry: the review happened, nothing recorded it, and the `reviewed` gate is correctly still red until something does.

**Know what the allow rule costs.** Since PP-97tt a top-level inline comment pinning head satisfies `reviewed` on its own, and auto-approving `mcp__github_inline_comment__create_inline_comment` removes the permission prompt that used to sit in front of that surface. Those two changes shipped together in this PR, and combined they mean one throwaway inline comment flips a PR from `unreviewed` to PASS with no human in the loop at the moment it happens. That is a deliberate widening, not an oversight (PP-97tt): agents post under Tim's identity anyway, so the gate could never have distinguished his comments from theirs, and the alternative — prompting on every finding — made `--comment` unusable for the batch of 6 findings it exists to post. The residual control is downstream, not here: merging is human-only via every path, so a falsely-cleared `reviewed` still has to survive someone reading the handoff report before anything lands.

The allow pattern is a prefix matcher over `gh api repos/timothyfroehlich/PinPoint/pulls/*/comments*`, which is the review-comments endpoint on this repo and nothing else — but "nothing else" means no other _path_, not no other _method_. Deleting or editing a comment on that path would match the allow rule too, so the `deny` list carries `DELETE`, `PATCH`, and `PUT` entries; deny wins over allow. Posting is what was authorised (PP-97tt), so posting is what is allowed.

Those three are written as bare `Bash(gh api *DELETE*)` rather than as `--method`/`-X` pairs, because the pairs did not work. `Bash(gh api * --method DELETE*)` needs a literal space before `--method`, and `gh api ` has already consumed it — so it matched `gh api <path> --method DELETE` and missed `gh api --method DELETE <path>`, which is the more common order. `-XDELETE` and `--method=DELETE` missed in both positions. Matching the verb anywhere in the command covers every spelling and both orders, at the cost of also denying a read whose _path_ contains one of the words; no such endpoint is used here.

**It is still case-sensitive, and that gap is not closed** — `-X delete` matches nothing. Denying lowercase substrings too would start refusing ordinary reads (any path containing `delete`), which is a worse trade for a rule that CLAUDE.md already scopes as "a speed bump against accidents, not a security boundary". Read it as covering the shapes an agent actually types, not as an enforcement boundary.

Nothing here WAITs. Under Copilot a request could be outstanding with an answer genuinely on its way, so `awaiting` was a legitimate hold; with no bot in the loop there is no such state, and a WAIT would poll for an hour before timing out on a review that was never going to arrive on its own.

**The stale pair is what to read carefully.** They are the successor to the old `pushed_after` and the same trap: the PR visibly HAS a review, so the reflex is to read the gate as flaky rather than as "the commit about to merge was never looked at". Nothing re-attests automatically, and that is deliberate — a 3-commit fixup should not inherit the review of the commit before it. If the pushes were the review's own findings, say so when you re-attest; if they were new work, it needs a fresh `/code-review`. That rule is the same for both stale states — what differs is that `stale_comments` has no way to re-post the reviewer's comments at the new SHA, so the marker is the honest exit. Replying to the threads and resolving them clears `threads`, never `reviewed`; the gate prints the marker command first for that state precisely because the intuitive move accomplishes nothing.

**"Honest exit", not "only exit" — nothing enforces it.** A _new_ top-level comment on the new head is evidence like any other, so posting one flips `stale_comments` to `commented` with no marker and no review. That is the honour system again, not a separate hole. What the SHA pin actually enforces is narrower and still worth having: what a reviewer already wrote cannot be made to cover a commit they never saw.

**Coverage is judged by SHA equality, not by timestamps.** The evidence pins the commit that was actually reviewed. Comparing "the review is newer than the push" instead reported "covers head" for a review of an earlier tree submitted after a later push (observed on PR #1784, under the old Copilot gate — the failure mode is the reviewer-independent one, so the SHA comparison stays).

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. Scripts emit prescriptive advice only where the remedy is otherwise undiscoverable. That is the `reviewed` and `threads` gates: every FAIL is followed by indented continuation lines naming the action that clears it, PR number already substituted. The `reviewed` remedy prints the `/code-review <depth> --comment <PR>` line to hand Tim **before** it prints `mark-claude-review.sh`, and says which case each is for — printing the attestation command alone reads as "attest and move on", which is the false attestation the gate exists to prevent. Continuation lines are indented and carry no status token, so token parsing is unaffected.

## MCP vs Script — When to use which

The pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts handle composite enforcement.

| Operation                                      | Use MCP                                        | Use Script                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                                                                                            |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                                                                                            |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                                                                                            |
| Stream CI runs in real time                    | —                                              | `pr-watch.py`                                                                                                |
| Merge a PR                                     | —                                              | `merge-pr.sh --human` (human-only — blocked for agents via ANY invocation shape)                             |
| Composite gate evaluation                      | —                                              | `merge-pr.sh` (sources `_pr-gates.sh`) — Tim runs it; an agent cannot invoke it at all, not even `--dry-run` |
| Post UI screenshots                            | —                                              | `pr-screenshots.mjs` (agent-runnable)                                                                        |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status tokens (PASS, WARN, WAIT, FAIL, BLOCK) and the table above says what to do per token. The `reviewed` and `threads` gates are the deliberate exception — they append indented `remedy:` lines, because which state you are in decides the action and the token alone doesn't say.
- **Merge is human-only (PP-wi85)**: `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` itself (any flags, including `--dry-run`) are all blocked for an agent by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook. There is no agent-usable bypass — the old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agents/skills/pinpoint-pr-workflow/SKILL.md` — Full skill: the review handoff, the merge handoff, and the MCP call sequences. Status-token responses are the table above, not there.
- `.agents/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
