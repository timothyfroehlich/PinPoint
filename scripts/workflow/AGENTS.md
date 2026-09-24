# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and the gate-enforced, Tim-approved merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

Tim decides whether PinPoint PRs merge (PP-wi85). When he explicitly requests a merge in the active task and the PR target is unambiguous, the owning agent in any harness runs `merge-pr.sh <PR> --human`; the script rechecks all four gates. Claude Code and Codex may add a hook approval prompt; the direct request authorizes the agent in every harness. Without that request, use `merge-handoff.sh`. Raw PinPoint merge channels (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) remain prohibited for agents because they skip the gates. This boundary covers implicit current-repository and explicit `timothyfroehlich/PinPoint` targets; a statically explicit non-PinPoint target follows its repository policy. Environment-only selectors fail closed.

## Codex Git Mutations

Codex uses the rule-approved fixed interface for Git operations whose free-form flags
can bypass hooks or rewrite remote history:

```bash
bash scripts/workflow/codex-git.sh commit "<conventional commit message>"
bash scripts/workflow/codex-git.sh push
bash scripts/workflow/codex-git.sh branch codex/<name>
bash scripts/workflow/codex-git.sh merge-main
```

The wrapper rejects extra arguments, creates only `codex/` branches from an existing
non-`main` worktree branch without a force or discard flag, pushes only the current
non-`main` branch to the same branch name on `origin`, and merges only `origin/main`.
Raw `git commit`, `git push`, `git checkout`, `git switch`, and `git merge` invocations
intentionally require approval.
`merge-main` fetches `origin` immediately before the merge so the tracking ref cannot be
stale.

Raw `gh` stays forbidden because case-insensitive and host-qualified repository selectors
cannot be normalized by an exact argv-prefix rule. Routine read-only commands stay
approval-free through fixed-subcommand wrapper operations:

```bash
bash scripts/workflow/codex-gh.sh pr-list [args...]
bash scripts/workflow/codex-gh.sh pr-view [args...]
bash scripts/workflow/codex-gh.sh pr-checks [args...]
bash scripts/workflow/codex-gh.sh pr-diff [args...]
bash scripts/workflow/codex-gh.sh run-list [args...]
bash scripts/workflow/codex-gh.sh run-view [args...]
```

An explicitly authorized merge in another repository uses the validating,
approval-gated route instead:

```bash
bash scripts/workflow/codex-gh.sh merge-external <owner/repo> <PR-number> <merge|squash|rebase>
```

It rejects PinPoint targets case-insensitively; after Tim's explicit request, PinPoint uses `merge-pr.sh --human`, and otherwise uses `merge-handoff.sh`.

## Scripts

### PR Monitoring

| Script                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]`                     | Status table: CI checks, review state, merge state, draft state. All open PRs if no args. One repository GraphQL snapshot batches metadata and checks; the Review column is the merge gate's own label (`_review_summary`, run once per PR): `approved`, `changes requested`, `stale review`, `not reviewed`, or `?` when the gate could not answer.                                                      |
| `pr-watch.py <PR>`                            | Wait on one PR head: `--phase ci\|review --expected-head <SHA>` polls every 30s until a terminal verdict (1h ceiling). Progress goes to stderr; stdout is exactly one terminal JSON verdict. A CI failure writes `tmp/gh-monitor/failure-<run>.md`. `--check-ready` prints a readiness snapshot instead.                                                                                                  |
| `request-codex-review.sh <PR>`                | Request exactly one manual Codex review for the current head. Refuses non-owner auth, draft/closed PRs, non-green current-head CI, heads already reviewed/requested, and a head that moves during validation. Posts the SHA-bound `@codex review` comment consumed by the trusted reaction witness.                                                                                                       |
| `codex-reaction-witness.sh <PR> <SHA> <TIME>` | Trusted helper for `.github/workflows/codex-reaction-witness.yaml`. After the SHA-bound manual request it waits for the connector bot's `+1` on that request comment, checking that the named SHA remains head, then posts a SHA-pinned witness. (`eyes` is not required: Codex replaces it with `+1`, so a fast review may never show it.) A native exact-head review supersedes the need for a witness. |

#### `pr-watch.py` flags and terminal verdict

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase <ci|review> --expected-head <FULL_SHA>
python3 scripts/workflow/pr-watch.py <PR> --check-ready
```

Run the first form as a background command. `--phase` and `--expected-head` (full lowercase 40-character SHA) are required together; `--check-ready` takes neither. Usage errors exit 2 with nothing on stdout.

- `--phase ci`: polls CI Gate for the expected head. Terminal outcomes: `passed` (exit 0), `failed` / `stale` / `conflicting` (exit 1), `timed_out` / `undetermined` (exit 2).
- `--phase review`: polls the merge gate's review label for the expected head. `passed` = `approved` AND 0 unresolved threads (exit 0); `action_required` = unresolved threads or `changes requested` (exit 1); `stale` / `conflicting` (exit 1); `timed_out` / `undetermined` (exit 2).
- `--expected-head <SHA>`: if the PR head moves, the watch ends `stale` rather than following the new head. GitHub's transient `UNKNOWN` merge state is not treated as a conflict.

Terminal JSON schema (`stdout`):

```json
{
  "schema_version": 1,
  "repository": "timothyfroehlich/PinPoint",
  "pr": 1234,
  "phase": "ci",
  "expected_head": "40-char-sha",
  "observed_head": "40-char-sha",
  "outcome": "passed",
  "ci_gate": "SUCCESS",
  "review_state": "not reviewed",
  "unresolved_threads": 0,
  "merge_state": "CLEAN",
  "detail_url": "https://github.com/...",
  "failure_artifact": null,
  "timestamp": "2026-09-05T12:00:00Z"
}
```

`pr-watch.py` exit codes:

- **0**: `passed` (clean gate verdict or exact-head review with 0 unresolved threads).
- **1**: Action required or failure (`failed`, `action_required`, `stale`, `conflicting`).
- **2**: Undetermined / unavailable evidence (`undetermined`, `timed_out`). Exit 2 is not a red CI: re-run the watch once evidence is available rather than hunting for a broken test. (PP-qkl8)

### Compact Validation Progress

`quiet-run.py` keeps child stdout/stderr in the private validation log and writes
only its bounded terminal verdict to the existing verdict stream (used for single-command
tasks such as `check`, `test`, and `e2e:all`).

`preflight-runner.py` directly orchestrates the canonical preflight phases
(`database-readiness`, `prototype-clean`, parallel `static-checks` and `unit-tests`,
`database-reset`, `build`, `integration`, `supabase-integration`, `smoke`).
In default compact mode, child stdout/stderr are captured in a private `0600` validation log
under `tmp/validation-logs/`, while stderr receives bounded phase transitions
(`preflight: PHASE <name> START / COMPLETE`) and periodic heartbeats
(`preflight: HEARTBEAT <name> (<elapsed>s elapsed)`) after 60 seconds (configurable
via `--heartbeat-seconds`). Child output never shares the progress channel, keeping
progress secret-safe. On clean pass, the log file is deleted; on warning or failure,
a bounded excerpt is shown and the log is retained. In `--human` mode, commands
stream directly without log capture.

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. `--pages` needs the **equals** form; the space form errors. A filtered run rebuilds the sticky comment from only the pages it shot, so end with an unfiltered run. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                                                                                                                                                                                                  |

### Readiness and Merge

| Script                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-handoff.sh <PR>`         | **Agent-runnable, read-only.** Prints the merge handoff block: review depth + how many commits back it was, CI, threads, mergeable + distance behind main, last merge-from-main, diff split src/tests/docs/other, diff since the review, migrations, newly-registered env vars, UI + screenshots, bead. Ends with two `!`-prefixed commands — re-run the report, and merge. The merge command is printed **only** when all four gates pass. Fetches `main` and `refs/pull/<PR>/head` into per-invocation temporary refs with `--no-write-fetch-head` and `--refmap=`, then removes those refs on exit; concurrent reports neither read nor overwrite shared `FETCH_HEAD`, update remote-tracking refs, or move local branches. If `gh` and the pull ref disagree about head, it says so and blocks: the gate answers would be about one commit and the diff about another. |
| `merge-pr.sh <PR> --human [-a]` | Runs only after Tim explicitly requests the merge. Re-evaluates all 4 gates and squash-merges if they pass; `--human` records that request. Claude Code and Codex may also prompt through the hook. `--automerge` never waits out review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `_pr-gates.sh`                  | Shared bash helper sourced by `merge-pr.sh`, `merge-handoff.sh`, and `request-codex-review.sh`, and shelled out to by `pr-watch.py` and `pr-dashboard.py`. `_review_summary <PR>` is the one implementation of review evidence: three checkers (CodeRabbit approval, Codex evidence, local attestation) and a four-word label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

`merge-handoff.sh`'s `ui` line keys on file **paths**, so it reads `UI file(s) changed`, never `the UI changed`. A UI-glob edit that renders nothing new (a pure refactor, a non-null-`!` removal) can carry the marker `<!-- no-visual-change -->` in the PR **body** to clear the `NO screenshots posted` nudge — mirroring `pr-screenshots.mjs`'s `<!-- pr-screenshots -->` token. Posted screenshots always take precedence over the marker. It is informational only, below the divider — never a merge gate. (PP-lhjg)

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                                                                                                     | Bypass kind |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                                                                                                      | `admin`     |
| `threads`     | Zero unresolved review threads, from any author                                                                                                                                                 | `force`     |
| `reviewed`    | Hard backstop — some reviewer's evidence covers the exact head. PASS when any of the three checkers covers head (label `approved`); FAIL on `changes requested`, `stale review`, `not reviewed` | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                                                                                                          | `none`      |

### Review state (`reviewed`)

**CodeRabbit is the default automated reviewer.** Promoting a draft after current-head CI succeeds triggers its review. Codex GitHub review is a manual fallback when CodeRabbit is rate-limited or unavailable: run `request-codex-review.sh <PR>` once for that head. The gate accepts a native review pinned to the exact head, the connector's no-major-issues issue comment pinned to a 10- or 40-character prefix of that head, or a trusted GitHub Actions comment witnessing the connector bot's `+1` on the SHA-tagged request while that exact SHA remained head. Direct reactions are never merge evidence because GitHub does not attach a commit SHA to them. A finding-bearing native review relies on the separate thread gate: every finding must be fixed or explicitly declined, replied to, and resolved. Native reviews and clean comments must come from exact account `chatgpt-codex-connector[bot]`; the clean comment must also carry exact app slug `chatgpt-codex-connector` and the known clean-result prefix. Reaction witnesses require exact account `github-actions[bot]`, exact app slug `github-actions`, and the SHA-pinned witness marker. The existing SHA-pinned `mark-review.sh` route remains valid after Tim explicitly runs a local review. A native `APPROVED` review from exact account `coderabbitai[bot]` pinned to head is also accepted (PP-w6u1); CodeRabbit's exact-head approval is an independent checker. Never request a Codex review of the same head twice. A new head requires replacement CI and fresh review coverage.

`_review_summary` in `_pr-gates.sh` runs three independent checkers over one fetch of the PR's reviews and comments. Each answers for its own reviewer only:

| Checker      | Covers head when                                                                                                                                                                   | Other verdicts                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `coderabbit` | Native `APPROVED` from `coderabbitai[bot]` pinned to head                                                                                                                          | `changes_requested` (its `CHANGES_REQUESTED` on head), `stale` (off-head), `none` |
| `codex`      | Newest exact-head record among: native `APPROVED`; native `COMMENTED`/`CHANGES_REQUESTED` (thread gate owns findings); trusted clean comment (10/40-char prefix); reaction witness | `stale` (newest Codex record names an older commit), `none` (nothing usable)      |
| `marker`     | `mark-review.sh` marker, legacy Claude marker, or owner two-axis review comment whose SHA is a prefix of head                                                                      | `stale` (newest marker names an older commit), `none`                             |

The label is derived from the checkers, in order: any `covers` → **`approved`**; else unresolved threads > 0 or any `changes_requested` → **`changes requested`**; else any `stale` → **`stale review`**; else **`not reviewed`**. `codex_request_pending` is reported alongside (the owner's `@codex review` marker pinned to head) so remedies never recommend a second request; it is not evidence.

Checkers never consult each other: a CodeRabbit `CHANGES_REQUESTED` cannot mask a Codex approval, and a stale marker cannot hide a current finding review. Within one checker, only exact-head records decide; a delayed review of an older SHA cannot displace current-head coverage.

Nothing here WAITs. The gate reports the current snapshot and fails on a not-reviewed or stale head; the owning agent waits for the manually requested review outside the merge script. `merge-pr.sh --automerge` must stop rather than hide that unfinished state.

**Every accepted path is SHA-pinned.** Native reviews carry `commit_id`; clean comments name the reviewed SHA; the reaction-witness workflow reads reactions only on the SHA-tagged request comment and verifies the event SHA is still head before recording the `+1` against that SHA. A delayed reaction for an older head is on an older request comment, so it cannot satisfy a newer head's gate.

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. The `reviewed` remedy says to run `request-codex-review.sh` once after current-head CI succeeds and the PR is ready, then wait for evidence; local attestation remains reserved for a local review Tim explicitly runs. Continuation lines are indented and carry no status token, so token parsing is unaffected.

## MCP vs Script — When to use which

The pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts handle composite enforcement.

| Operation                                      | Use MCP                                        | Use Script                                                                         |
| ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                                                                  |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                                                                  |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                                                                  |
| Wait on CI or review for one PR head           | —                                              | `pr-watch.py`                                                                      |
| Request one Codex review for current head      | —                                              | `request-codex-review.sh`                                                          |
| Merge a PR                                     | —                                              | `merge-pr.sh --human` after Tim explicitly requests that PR; script rechecks gates |
| Composite gate evaluation                      | —                                              | `merge-handoff.sh` (read-only); merge script rechecks before a requested merge     |
| Post UI screenshots                            | —                                              | `pr-screenshots.mjs` (agent-runnable)                                              |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status tokens (PASS, WARN, WAIT, FAIL, BLOCK) and the table above says what to do per token. The `reviewed` and `threads` gates are the deliberate exception — they append indented `remedy:` lines, because which state you are in decides the action and the token alone doesn't say.
- **Tim decides whether PinPoint PRs merge (PP-wi85)**: an explicit request in the active task authorizes the owning agent in any harness to run `scripts/workflow/merge-pr.sh <PR> --human` for the unambiguous PR. The flag records the request; Tim need not repeat it in a shell. Claude Code and Codex may additionally prompt through `block-direct-merge.cjs`; the direct request remains authorization in every harness. A readiness label or green gate alone is not authorization. Raw merge channels remain prohibited because they skip the gates; bypass flags require separate explicit authorization. The script fails closed on gate errors. The old `.claude-merge-bypass` sentinel remains removed.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agents/skills/pinpoint-pr-workflow/SKILL.md` — Full skill: the review handoff, the merge handoff, and the MCP call sequences. Status-token responses are the table above, not there.
