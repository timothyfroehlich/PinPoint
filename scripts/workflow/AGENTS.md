# PR Workflow Scripts

Bash/Node/Python scripts for the GitHub PR lifecycle: CI monitoring, the PR dashboard, UI screenshots and approval, and the trusted helpers behind the required review checks. No script here merges.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

Merging is native GitHub. Ruleset `6326455` enforces the gates: required checks `CI Gate`, `Claude Review`, and `UI Approval`, every conversation resolved, and the branch up to date with `main`. Tim decides whether a PinPoint PR merges; after his explicit request the owning agent runs `gh pr merge <PR> --squash` (or `--auto --squash`), never `--admin` (AGENTS.md §2.2 "Process rules", `pinpoint-pr-workflow` Phase 4).

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

Codex prefix rules in `.codex/rules/pinpoint.rules` allow `gh pr list|view|checks|diff`,
`gh run list|view`, and `gh pr update-branch` directly, prompt for `gh pr merge` (a prefix
rule cannot deny a later `--admin` flag, so a human stays in the loop), and forbid
`gh pr checkout`/`gh pr co`/`gh co`. Other `gh` commands fall through to Codex's default
approval policy.

## Scripts

### PR Monitoring

| Script                                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]`             | Status table: CI checks, review, UI approval, merge state, draft state. All open PRs if no args. One repository GraphQL snapshot supplies every column. Review and UI are the head's `Claude Review` and `UI Approval` required checks, counted only when the GitHub Actions app ran them: pass, fail, pending, skipped (the job did not run, as Claude Review on a draft), or — when absent. Anything the dashboard cannot read renders as `?`, never as green. |
| `pr-watch.py <PR>`                    | Wait on one PR head's CI Gate and, once the PR is ready, its Claude Review: `--phase ci --expected-head <SHA>` polls every 30s until a terminal verdict (1h ceiling). Progress goes to stderr; stdout is exactly one terminal JSON verdict. A failed check writes `tmp/gh-monitor/failure-<run>.md` when the run log can be fetched.                                                                                                                             |
| `claude-review-level.sh [<base-ref>]` | Trusted helper for `.github/workflows/claude-review.yaml`, not an agent step: prints the review level for HEAD against `origin/main`. Line 1 `low`, `medium`, `high`, or `ask`; line 2 the weighted size. Leaves out the lockfile, `drizzle/meta`, fixtures, binaries and feature specs; counts test code at half weight.                                                                                                                                        |
| `claude-review-range.sh <PR> <SHA>`   | Trusted helper for `.github/workflows/claude-review.yaml` (run from main's copy): picks full, incremental (commits since the newest earlier passing check, main's changes left out), or skip. `CLAUDE_REVIEW_CHECK_NAME` keys it on another check; `CLAUDE_REVIEW_SKIP_LEVEL=1` skips the level.                                                                                                                                                                 |

#### `pr-watch.py` flags and terminal verdict

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase ci --expected-head <FULL_SHA>
```

Run it as a background command. `--phase` and `--expected-head` (full lowercase 40-character SHA) are required together. Usage errors exit 2 with nothing on stdout.

- `--phase ci`: polls CI Gate for the expected head and, on a PR that is not a draft, `Claude Review` too (a draft skips Claude Review). `passed` needs both; a red Claude Review ends the watch `failed` without waiting for CI. A passed verdict carries `unresolved_threads`, Claude Review's findings and any other open threads still to adjudicate. Terminal outcomes: `passed` (exit 0), `failed` / `stale` / `conflicting` (exit 1), `timed_out` / `undetermined` (exit 2). It does not watch `UI Approval`, which can wait on Tim indefinitely.
- `--expected-head <SHA>`: if the PR head moves, the watch ends `stale` rather than following the new head. GitHub's transient `UNKNOWN` merge state is not treated as a conflict.

Terminal JSON schema (`stdout`):

```json
{
  "schema_version": 2,
  "repository": "timothyfroehlich/PinPoint",
  "pr": 1234,
  "phase": "ci",
  "expected_head": "40-char-sha",
  "observed_head": "40-char-sha",
  "outcome": "passed",
  "ci_gate": "SUCCESS",
  "claude_review": "SUCCESS",
  "unresolved_threads": 0,
  "merge_state": "CLEAN",
  "detail_url": "https://github.com/...",
  "failure_artifact": null,
  "timestamp": "2026-09-05T12:00:00Z"
}
```

`claude_review` is the head's Claude Review conclusion or status, `SKIPPED_DRAFT` on a draft, or `UNKNOWN` before the check posts. `unresolved_threads` is counted only on a `passed` verdict, and is `null` otherwise or when GitHub cannot say.

`pr-watch.py` exit codes:

- **0**: `passed` (CI Gate passed on the expected head, and Claude Review too unless the PR is a draft).
- **1**: Failure or action required (`failed`, `stale`, `conflicting`).
- **2**: Undetermined / unavailable evidence (`undetermined`, `timed_out`). Exit 2 is not a red CI: re-run the watch once evidence is available rather than hunting for a broken test. (PP-qkl8)

### Compact Validation Progress

`quiet-run.py` keeps child stdout/stderr in a private `0600` log under
`tmp/validation-logs/` and prints only a bounded verdict (used for `check`, `test`,
`e2e:all` and `preflight`). On a clean pass the log is deleted; on a warning or
failure a bounded excerpt is shown and the log is kept.

`preflight.sh` runs the canonical preflight phases in order, printing `== <phase>`
before each and stopping at the first failure: readiness, `check:human`, `test:human`,
`db:fast-reset`, `build`, `test:integration`, `test:integration:supabase`,
chromium-only smoke. `pnpm run preflight` wraps it in `quiet-run.py`;
`pnpm run preflight:human` streams it.

### UI Screenshots

| Script                                                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-screenshots.mjs [--pages=a,b,c] [--out=<dir>] [--force-auth]` | Local only: shoots the pages in `ui-screenshot-manifest.json` at the three review viewports (desktop 1440×900, large mobile 430×932, small mobile 320×568; `pinpoint-design-bible` §4) into `tmp/pr-screenshots/<short-sha>/` (or `--out`) as `<viewport>-<page-id>.png`, then prints one absolute path per PNG on stdout (progress on stderr) so the agent can send the files to Tim in Claude Code Desktop chat before the PR's `UI Approval` check can pass. Nothing is uploaded to GitHub. Agent-runnable — not a merge action. `--pages` needs the **equals** form; the space form errors. |
| `ui-screenshot-manifest.json`                                     | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `ui-paths.txt`                                                    | The one UI path list (extended regexes, matched case-insensitively), read by the UI Approval check and the reminder hook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ui-approval-scope.sh <PR> <SHA>`                                 | Trusted helper for `.github/workflows/ui-approval.yaml`: whether a UI path changed since the newest earlier passing UI Approval, with main's changes left out.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `approve-ui.sh <PR> --head <SHA> --source chat\|artifact`         | Records Tim's own UI approval (in chat, or an orchestrator-artifact click) on the waiting UI Approval run of the commit he saw; refuses if the PR head moved. Agents never call the `pending_deployments` API directly.                                                                                                                                                                                                                                                                                                                                                                         |

### Shared helpers

| Script      | Purpose                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gh_cli.py` | Python's one `gh` wrapper: `run_gh(*args, error=...)` returns stdout and raises the caller's exception type on a non-zero exit. `pr-watch.py` and `pr-dashboard.py` import it and keep their own `gh()` seam; add any new Python workflow script's `gh` calls here rather than a third copy. |

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Check passed                                                | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. Continuation lines are indented and carry no status token, so token parsing is unaffected.

## MCP vs Script — When to use which

The pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts and `gh` handle what is not a single typed call.

| Operation                                      | Use MCP                                        | Use Script                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                                                                                                   |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                                                                                                   |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                                                                                                   |
| Wait on CI for one PR head                     | —                                              | `pr-watch.py --phase ci`                                                                                            |
| Required-check state for one PR                | —                                              | `gh pr checks <PR> --required`                                                                                      |
| Merge a PR                                     | —                                              | `gh pr merge <PR> --squash` (or `--auto --squash`) after Tim explicitly requests that PR; GitHub enforces the gates |
| Capture UI screenshots                         | —                                              | `pr-screenshots.mjs` (agent-runnable, local)                                                                        |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases.
- **Mechanical script output**: scripts emit status tokens (PASS, WARN, WAIT, FAIL, BLOCK) and the table above says what to do per token.
- **GitHub enforces the merge gates**: the ruleset is the one gate implementation, so no script re-evaluates it. A green check alone is not merge authorization; Tim's explicit request is. The ruleset's admin bypass is Tim's alone; agents never pass `--admin`.
- **Fail closed on API errors**: a script that cannot determine state exits non-zero, and the dashboard shows `?`.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agents/skills/pinpoint-pr-workflow/SKILL.md` — Full skill: the review flow, the merge, and the MCP call sequences. Status-token responses are the table above, not there.
