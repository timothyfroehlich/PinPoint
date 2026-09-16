# PR Lifecycle Monitoring — Feature Spec

**Status: draft.**

**What this document is.** The requirements for PinPoint's PR lifecycle monitoring: how agents watch PRs in the background, adjudicate automated reviews, and act on results. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `scripts/workflow/AGENTS.md` (exit code and terminal JSON semantics), `.agents/skills/pinpoint-pr-workflow/SKILL.md` (PR workflow phases).

---

## 1. Concepts

- **Watch** — an asynchronous background observation of a PR lifecycle phase anchored to a specific commit. Runs until a terminal verdict or timeout without blocking agent turns.
- **Phase** — the lifecycle stage under observation: **CI** (aggregate check gate completion) or **review** (exact-head review evidence and thread resolution).
- **Expected head** — the commit SHA the watch is anchored to. Detects PR branch updates so agents never act on stale commits.
- **Terminal verdict** — an authoritative, machine-readable JSON object emitted upon completion that gives the main agent everything needed to take its next step without follow-up queries.
- **Failure artifact** — a targeted markdown summary of failed CI steps and errors written to disk, sparing the main agent from fetching or parsing raw workflow logs.
- **Automated reviewer** — an AI evaluation service (CodeRabbit or Codex) that inspects PR changes against repository standards and provides reviews or comments.
- **Review hierarchy** — the strict order of review preference: CodeRabbit first, falling back to Codex when CodeRabbit is unavailable or rate-limited, followed by repository owner attestation.
- **Draft gate** — the policy boundary where automated review evaluation is suspended while a pull request is marked as a GitHub draft.
- **Promotion trigger** — the automatic initiation of a CodeRabbit review when a pull request transitions from draft to ready for review.
- **Re-review request** — an explicit, human- or agent-initiated command (`@coderabbitai review` or `@codex review`) requesting a new evaluation on an updated commit head.
- **Review quota** — an external velocity cap (5 CodeRabbit reviews per hour) that bounds automated review consumption.
- **In-progress review** — an active review execution detected via pending commit status, pending check run, or acknowledged request without a terminal verdict.
- **Concurrent review** — an execution state where two distinct automated reviewers are actively evaluating the same commit head simultaneously.
- **First-success verdict** — the immediate reporting of review gate satisfaction when any eligible reviewer covers head, accompanied by an explicit notice identifying any trailing in-progress reviewer that still requires inspection.
- **Actionable review prompt** — a consolidated instruction block extracted from reviewer findings containing file paths, line ranges, and actionable remediation tasks for implementing agents.

---

## 2. Launching a watch

- **2.1** A watch is defined by four core parameters: the worktree path, the PR number, the phase (`ci` | `review`), and the expected head SHA. An optional PR title may be supplied for diagnostic logging. The launching command defaults the worktree to the current working directory when invoked in place.
- **2.2** A watch executes as a non-blocking background process, consuming zero main-agent context tokens while running.
- **2.3** Invalid parameters, missing executables, or corrupt worktrees fail immediately at launch rather than hanging or polling.
- **2.4** Invocation syntax and semantics are identical across all agent harnesses.

---

## 3. Terminal verdicts

- **3.1** Every watch terminates with exactly one structured JSON verdict emitted to standard output.
- **3.2** A terminal verdict contains the complete decision state: PR number, phase, expected and observed head SHAs, outcome, CI gate status, review state, unresolved thread count, merge state, timestamp, and optional failure artifact path. For the review phase, the verdict also includes the covering reviewer, any concurrent in-progress reviewer, the list of pending reviewers, diagnostic review notices, actionable comment counts, extracted review prompts, and rate-limit fallback signals.
- **3.3** Outcomes belong to a closed set:
  - CI phase: **passed**, **failed**, **stale**, **conflicting**, **timed_out**, **undetermined**.
  - Review phase: **passed**, **action_required**, **stale**, **conflicting**, **timed_out**, **undetermined**.
- **3.4** The main agent determines its next action directly from the terminal verdict without exploratory commands or additional GitHub API queries.
- **3.5** A **stale** verdict indicates the PR head advanced; the main agent re-evaluates the new head rather than retrying.
- **3.6** A **conflicting** verdict indicates merge conflicts; the main agent merges `origin/main` and resolves rather than retrying.
- **3.7** An **undetermined** verdict indicates infrastructure or API failure; the agent may retry after a backoff.
- **3.8** A **timed_out** verdict indicates the bounded duration ceiling was reached before completion.

---

## 4. Failure reporting

- **4.1** When CI fails, the watcher automatically extracts failing step names and error excerpts into a standalone markdown failure artifact.
- **4.2** Raw workflow logs are never dumped into standard output or the agent's conversational context.
- **4.3** The failure artifact path is returned in the terminal verdict, allowing the agent to read only the digested failure summary.
- **4.4** The failure artifact identifies the failing workflow run ID and includes a direct GitHub URL for human escalation.

---

## 5. Resource efficiency

- **5.1** Passive waiting consumes zero LLM reasoning tokens. Polling and timeout loops run entirely in host process infrastructure.
- **5.2** Intermediate polling status logs stream exclusively to diagnostic output (stderr) and do not pollute the agent's context or trigger premature wakeups.

---

## 6. Host coordination

- **6.1** Concurrent watches on the same PR, phase, and expected head on a host machine coalesce under a single polling leader.
- **6.2** Follower processes attach to the leader's state and exit with identical verdicts without issuing duplicate GitHub API requests.
- **6.3** Coordination is host-local and relies on file locks and atomic state snapshots.

---

## 7. Agent integration

- **7.1** The watcher is invoked via a unified CLI command that any agent harness can launch as a background task.
- **7.2** Process exit codes reflect verdict categories:
  - `0`: Success (`passed`).
  - `1`: Actionable failure (`failed`, `stale`, `conflicting`, `action_required`).
  - `2`: Infrastructure or timeout failure (`undetermined`, `timed_out`).
- **7.3** Standard output is reserved strictly for the terminal JSON verdict.
- **7.4** Execution telemetry (harness, model if any, wake count, elapsed duration) is recorded locally for operational diagnostics.

---

## 8. Reviewer hierarchy & triggers

- **8.1** CodeRabbit is the default automated reviewer for all pull requests.
- **8.2** Codex is the secondary automated reviewer, invoked when CodeRabbit review quota is exhausted or when explicitly requested by an operator or agent.
- **8.3** Local owner attestation is the fallback review mechanism when external automated reviewers are unreachable or inappropriate for the changeset.
- **8.4** Review satisfaction follows the priority chain: a qualifying CodeRabbit approval takes precedence over Codex, and Codex takes precedence over manual attestation.
- **8.5** Any single reviewer providing exact-head coverage satisfies Gate 3 (Review Gate) for pull request mergeability.
- **8.6** New pull requests are created in draft state; automated reviews are suppressed while a pull request remains in draft.
- **8.7** Promoting a pull request out of draft (`gh pr ready`) triggers an automatic CodeRabbit review on the current head commit.
- **8.8** CodeRabbit never automatically initiates a re-review when new commits are pushed to an open pull request.
- **8.9** Re-evaluating an updated commit head with CodeRabbit requires an explicit re-review request (`@coderabbitai review`).
- **8.10** Codex never initiates a review automatically on draft promotion or commit push; Codex reviews are triggered strictly via explicit manual request (`@codex review`).
- **8.11** A review request is anchored to an exact 40-character commit head SHA and is never issued more than once for the same commit head.
- **8.12** Pushing new commits to a pull request branch immediately invalidates all previous review coverage; the updated head requires replacement review evidence.

---

## 9. Quota & rate-limit management

- **9.1** The system enforces an hourly quota ceiling of 5 CodeRabbit reviews per rolling hour.
- **9.2** When CodeRabbit indicates quota exhaustion (`Review rate limited`), the review monitor flags CodeRabbit as rate-limited on the pull request.
- **9.3** Upon detecting CodeRabbit rate-limiting, the review monitor directs the owning agent to fall back to Codex review. If Codex is also out of quota or unavailable, the system alerts the user and recommends either performing a local review attestation or waiting until the next CodeRabbit review slot becomes available.
- **9.4** An active CodeRabbit rate-limit flag clears automatically when a subsequent CodeRabbit review successfully completes on the pull request or after the rolling quota window expires.

---

## 10. Concurrent review adjudication

- **10.1** The review monitor actively detects whether CodeRabbit, Codex, or both are currently in progress on the expected commit head.
- **10.2** An in-progress review is identified by a pending commit status, pending check run, or acknowledged request comment lacking a matching terminal verdict.
- **10.3** When two automated reviewers are in progress simultaneously, the review gate passes as soon as the first reviewer reports success covering the exact head.
- **10.4** When concluding on a first success with a concurrent review still active, the monitor explicitly identifies the winning reviewer and reports the secondary reviewer as running in progress.
- **10.5** The terminal verdict for a first success includes a dedicated notification alerting the owning agent that the concurrent review is still running and must be checked when complete.
- **10.6** If one concurrent reviewer requests changes while the second reviewer is still in progress, the monitor reports an actionable failure while preserving the in-progress status of the second reviewer.
- **10.7** If both concurrent reviewers complete successfully, the primary reviewer in the hierarchy (CodeRabbit) is recorded as the authoritative covering reviewer.

---

## 11. Review findings & agent handoff

- **11.1** When a reviewer requests changes or posts actionable comments, the monitor extracts the consolidated AI agent prompt block directly from the review body.
- **11.2** The extracted prompt block and the count of actionable comments are returned in the monitor's terminal verdict.
- **11.3** Review findings extraction fails open: network failures or unexpected review formatting never crash the monitor or alter process exit codes.
- **11.4** Implementing agents ingest review findings directly from the terminal verdict without executing exploratory GitHub API queries.

---

## Known divergences

| § | Requirement | Code today | Resolution |
| :-- | :-- | :-- | :-- |
| 7.1 | Unified CLI command across all harnesses | Subway watch provides unified CLI; legacy harness agent definitions retained as dormant fallback | Resolved once subagents are deprecated |
| 8.7 | CodeRabbit automatic review on draft promotion | `.coderabbit.yaml` currently sets `auto_review.enabled: false` | Update `.coderabbit.yaml` to enable auto-review on ready PRs |
| 10.1–10.5 | Concurrent in-progress review detection and notification | `pr-watch.py` and `_review_summary` report individual checker records without in-progress status checks or concurrent notices | Add concurrent status tracking to `subway watch` and workflow gates |
| 11.1–11.2 | Actionable prompt and comment count extraction | Reviewers' raw markdown bodies are not parsed into terminal payloads | Implement CodeRabbit prompt extraction in `subway watch` |

---

## Changelog

| Date | Amendment |
| :-- | :-- |
| 2026-09-16 | Amend spec to add automated review requirements (§8–§11): CodeRabbit default review, draft-promotion auto-trigger, manual re-reviews and Codex requests, 5/hr rate limits and fallback, concurrent review first-success reporting with in-progress notices, and prompt extraction. |
| 2026-09-12 | Clarify §2.1: watch is defined by four core parameters with optional title for diagnostic logging. |
| 2026-09-12 | Qualify §6.1 host coalescing by expected head SHA to match leader-lock isolation. |
| 2026-09-12 | Clarify actor as the main agent across concepts and requirements; align §2.1 parameter contract with optional worktree defaulting; align §3.6 conflict resolution to merge origin/main per AGENTS.md branch policy. |
| 2026-09-12 | Initial draft from first principles: background monitoring, structured verdicts, failure reporting, zero-token waiting, and unified CLI invocation via Subway. |
