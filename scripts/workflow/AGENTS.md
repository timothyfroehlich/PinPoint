# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and human-only gate-enforced merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**Merging is human-only (PP-wi85), with one carve-out (PP-c0uy).** `merge-pr.sh` is blocked for agents by the `block-direct-merge.cjs` PreToolUse hook in every invocation shape (including `--dry-run`) **except** a command that is exactly `[bash] [path/]merge-pr.sh <number> --dependabot [--dry-run]` and nothing else — an anchored whole-command allowlist, so no chaining, pipes, redirects, comments, quoting, env prefixes, or other flags. Agents run every other script in this directory freely, including `pr-screenshots.mjs` and `mark-claude-review.sh`. For anything that isn't a Dependabot dependency bump, Tim runs the merge directly (`scripts/workflow/merge-pr.sh <PR> --human`) once an agent hands the PR off as ready.

> **The `--dependabot` path's real control is the honesty contract, not the metadata checks.** `mark-claude-review.sh` attests that _you personally read the diff at that head SHA_ — it verifies nothing, and it is SHA-pinned so any new commit voids it. Never post it for a diff you did not read. What you are looking for is **anything that is not a dependency bump**, a `.github/workflows/**` edit above all: that path is necessarily allowlisted (Dependabot bumps pinned action SHAs there), so a workflow change riding along inside a "dependency bump" is CI execution with repo secrets.

> **Quote the path when you merely _mention_ the merge script in a command.** The hook triggers on any unquoted occurrence of its basename in the command string — so `shellcheck scripts/workflow/merge-pr.sh` is refused, while `shellcheck "scripts/workflow/merge-pr.sh"` is fine. Same for `rg`, `git diff -- <path>`, and heredocs (which aren't quote-stripped). That bluntness is deliberate: the trigger stopped trying to enumerate shell invocation wrappers (`eval`, `exec`, `command`, `time`, `{ …; }`, `for … do`, `case`) — each was a bypass — and now defers every decision to one anchored whole-command allowlist.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, merge state, draft state. All open PRs if no args.                                                                 |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. |

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-screenshots.mjs <PR> [--pages a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                               |

### Readiness and Merge

| Script                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-pr.sh <PR> --human`             | **Human-only — blocked for agents** (except the `--dependabot` shape below). Re-evaluates all 5 gates (`ci`, `currency`, `threads`, `reviewed`, `no_conflict`) and squash-merges if all pass. Removes ready-for-review label on failure. `--human` is required to actually merge (defense-in-depth for non-Claude-Code harnesses); `--dry-run` doesn't need it but agents can't run the script at all inside Claude Code, dry-run included.                                                                                                                                                                                                                                                                                                                            |
| `merge-pr.sh <PR> --dependabot`        | **The one agent-runnable merge (PP-c0uy).** Substitutes for `--human` on Dependabot dependency-bump PRs. Zero gate relief — all 5 gates run normally, and `--force`/`--bypass-merge-requirements` are rejected outright. Hard-REFUSEs unless: PR author is a Dependabot identity, EVERY commit is Dependabot-authored **and signature-verified**, and every changed file is in the allowlist (`pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `.github/workflows/**`, `.github/dependabot.yml`). Those are metadata checks; the **load-bearing control is the `reviewed` gate**, which is NOT waived — read the diff, then `mark-claude-review.sh <PR>` to attest, then merge. Judge from the diff + CI, never the PR body — see `pinpoint-pr-workflow` §4.6. |
| `mark-claude-review.sh <PR> [summary]` | Posts/updates a sticky SHA-pinned Claude-review marker comment (`<!-- pinpoint-claude-review: <head_sha> -->`) that satisfies the `reviewed` gate when Copilot skips.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `_pr-gates.sh`                         | Shared bash helper sourced by merge-pr.sh. Defines the gate functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                                                    | Bypass kind |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                                                     | `admin`     |
| `currency`    | Latest Copilot review covers head (WARN-proceeds if stale past 600s)                                                                           | `force`     |
| `threads`     | Zero unresolved Copilot review threads                                                                                                         | `force`     |
| `reviewed`    | Head commit covered by a Copilot review OR a SHA-pinned Claude marker; WAITs inside the 600s window, FAILs after with no review of either kind | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                                                         | `none`      |

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. Scripts never emit prescriptive advice; the skill (pinpoint-pr-workflow) documents what to do for each token.

## MCP vs Script — When to use which

The pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts handle composite enforcement.

| Operation                                      | Use MCP                                        | Use Script                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                                                                                           |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                                                                                           |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                                                                                           |
| Stream CI runs in real time                    | —                                              | `pr-watch.py`                                                                                               |
| Merge a PR                                     | —                                              | `merge-pr.sh --human` (human-only; agents may only run `merge-pr.sh <PR> --dependabot` on Dependabot bumps) |
| Composite gate evaluation                      | —                                              | `merge-pr.sh` (sources `_pr-gates.sh`) — Tim runs it; agents only via `--dependabot`, incl. `--dry-run`     |
| Post UI screenshots                            | —                                              | `pr-screenshots.mjs` (agent-runnable)                                                                       |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status (FAIL, WAIT, BLOCK, PASS), never prescriptive advice. The skill documents what to do per token.
- **Merge is human-only (PP-wi85), except the Dependabot carve-out (PP-c0uy)**: `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` (any flags, including `--dry-run`) are blocked for an agent by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook — the sole exception being `merge-pr.sh <PR> --dependabot` with no `--human`/`--force`/`--bypass-merge-requirements`. The old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` (or `--dependabot` plus its three preconditions) at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook. The hook cannot verify those preconditions — it only reads the command string — so the script's checks are the authoritative boundary.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agent/skills/pinpoint-pr-workflow/SKILL.md` — Full skill documenting token responses and MCP call sequences
- `.agent/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
