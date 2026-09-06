# CI and review

The capable owner retains every mutation and judgment. Delegate only passive waiting to
an isolated lightweight subagent running deterministic `pr-watch.py --json`.

## Dispatch a watcher

| Harness     | Subagent          | Preferred model                                                                 |
| :---------- | :---------------- | :------------------------------------------------------------------------------ |
| Claude Code | `Agent`           | `haiku`                                                                         |
| Antigravity | `invoke_subagent` | `flash_lite`, then `flash`                                                      |
| Codex       | `spawn_agent`     | `gpt-5.3-codex-spark`, otherwise the fastest callable model the tool advertises |

Model availability is a runtime capability. Use Spark only when Codex advertises it as
a supported override. Pass model and reasoning fields only when the harness exposes
them, and record the exact resolved model ID in telemetry (`unknown` if unavailable).

The bounded watcher prompt contains only:

- worktree path;
- PR number and title;
- `ci` or `review` phase;
- full expected head SHA;
- exact command;
- instruction to return stdout's terminal JSON record and exit.

Exclude diffs, history, and the owner transcript. Codex uses `fork_turns: "none"`; other
harnesses use the equivalent isolated context. The watcher is strictly read-only: it
never changes files or GitHub state, requests review, comments, labels, or resolves
threads.

Set telemetry on the deterministic command with the model the harness resolved:

```bash
GH_MONITOR_HARNESS=<harness> GH_MONITOR_MODEL=<resolved-model-id> \
  python3 scripts/workflow/pr-watch.py <PR> --phase <ci|review> \
  --expected-head <FULL_HEAD_SHA> --json
```

In JSON mode, progress goes to stderr and stdout contains only the terminal object.
Let the subagent block until exit; unchanged state must not wake the capable owner.

## Current-head CI

After every push, dispatch a CI watcher for that exact head:

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase ci \
  --expected-head <FULL_HEAD_SHA> --json
```

Keep a new PR draft until its current-head `CI Gate` succeeds. Then run
`gh pr ready <PR>` and request review. Promotion alone does not request review, and a
green run for an older SHA does not qualify.

Handle the terminal outcome:

- `passed` (exit 0): current-head CI passed. Promote a draft, then continue to the
  manual review request below.
- `failed` (exit 1): inspect `failure_artifact` under `tmp/gh-monitor/`, fix the cause,
  commit, and push. For a confirmed GitHub Actions infrastructure flake, record it with
  `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` before
  retrying.
- `stale` (exit 1): the head changed; re-check branch state and use the new exact head.
- `conflicting` (exit 1): merge `origin/main` into the branch—never rebase—then push.
- `timed_out` or `undetermined` (exit 2): re-run the watcher or investigate API reachability.

## Request exact-head review

Codex review is manual-only. Tim's personal automatic trigger stays off. Once
current-head CI passes and the PR is ready rather than draft, the owner runs exactly
once for that intended head:

```bash
bash scripts/workflow/request-codex-review.sh <PR>
```

The helper verifies repository-owner authentication, an open ready PR, successful
current-head CI, no existing coverage or request for that head, and a stable head. It
posts the SHA-pinned `@codex review` request and marker used by the trusted reaction
witness.

Never repeat a request for the same head. Coverage may arrive as a native review, a
trusted clean connector comment, or a trusted SHA-pinned reaction witness. If no
evidence arrives, keep waiting. If Tim explicitly chooses `/codex:review` or
`/code-review`, read [manual local review](exceptional-cases.md#manual-local-review)
before acting.

Dispatch the isolated review watcher:

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase review \
  --expected-head <FULL_HEAD_SHA> --json
```

Handle the terminal outcome:

- `passed` (exit 0): exact-head coverage exists and unresolved thread count is zero.
  Read [screenshots and readiness](screenshots-and-readiness.md).
- `action_required` (exit 1): exact-head review has unresolved threads or is
  `not_approved`. Adjudicate every finding as described below.
- `stale` (exit 1): the branch head moved; restart with current-head CI.
- `conflicting` (exit 1): merge current `origin/main`, push, and restart with CI.
- `timed_out` or `undetermined` (exit 2): re-run the watcher or inspect GitHub API state.

## Adjudicate review findings

Read threads through GitHub's review-comments interface with `perPage: 100`. Thread
records use `is_resolved`, `is_outdated`, and a `PRRT_...` node ID.

For every unresolved thread, either fix the code or decline with a one-sentence signed
reply, then resolve the thread. `AGENTS.md` §5 "Review comments" owns the reply rules;
`REVIEW.md` owns the rubric. Thread gating is author-agnostic.

- A fix that changes code requires a commit and push, replacement current-head CI, and
  exactly one review request for the new head.
- A declined finding or thread-only resolution with no push retains the exact-head
  review coverage; no replacement request is needed.

The owner remains assigned through the entire loop. A slow review is a wait state:
keep the watcher waiting rather than requesting the same head again or self-attesting.

## Later uploads and readiness semantics

Leave an existing ready PR ready after a later push, but wait for replacement
current-head CI before requesting the new head's one review. If it remains draft, keep
it draft through the push and promote it only after replacement CI passes. Upload size
does not relax this sequence.

`pr-watch.py --check-ready` is only a direct snapshot of whether the current head can
leave draft and receive its manual review request. It reports review state but cannot
gate on review without becoming circular. GitHub-ready is not PinPoint merge-ready;
the `ready-for-review` label comes only after the next phase.
