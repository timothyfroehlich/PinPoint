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
- **Local review** — a Claude Code `/code-review` run by the owning agent in its own session against the pull request's exact head.
- **Review level** — the effort a local review runs at (low, medium, or high), chosen from the weighted diff size.
- **Weighted diff size** — the pull request's changed lines against its base branch, with generated and fixture content left out and test code counted at half weight (§8.15).
- **Review record** — the pull request comment the owning agent posts after a clean local review, pinned to the reviewed head and listing every finding with its disposition.
- **Draft gate** — the policy boundary that keeps a pull request a GitHub draft until a review record covers its head.
- _Retired 2026-09-24:_ automated reviewer, review hierarchy, promotion trigger, re-review request, review quota, in-progress review, concurrent review, first-success verdict, and actionable review prompt. CodeRabbit and Codex no longer provide review coverage; the local review replaced them.

---

## 2. Launching a watch

- **2.1** A watch is defined by four core parameters: the worktree path, the PR number, the phase (`ci` | `review`), and the expected head SHA. An optional PR title may be supplied for diagnostic logging. The launching command defaults the worktree to the current working directory when invoked in place.
- **2.2** A watch executes as a non-blocking background process, consuming zero main-agent context tokens while running.
- **2.3** Invalid parameters, missing executables, or corrupt worktrees fail immediately at launch rather than hanging or polling.
- **2.4** Invocation syntax and semantics are identical across all agent harnesses.

---

## 3. Terminal verdicts

- **3.1** Every watch terminates with exactly one structured JSON verdict emitted to standard output.
- **3.2** A terminal verdict contains the complete decision state: PR number, phase, expected and observed head SHAs, outcome, CI gate status, review state, unresolved thread count, merge state, timestamp, and optional failure artifact path. For the review phase, the verdict also includes the covering review record.
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

## 8. Local review & review coverage

- **8.1** _Retired 2026-09-24._ CodeRabbit was the default automated reviewer; the local review (8.13) replaced it. Number kept so older citations don't dangle.
- **8.2** _Retired 2026-09-24._ Codex was the fallback reviewer; there is no fallback reviewer. Number kept so older citations don't dangle.
- **8.3** Only a review record posted from the owner's account provides review coverage. A pull request without it merges only when the owner explicitly directs a forced merge, which bypasses the review gate.
- **8.4** _Retired 2026-09-24._ The priority chain between CodeRabbit and Codex; there is one reviewer. Number kept so older citations don't dangle.
- **8.5** A review record pinned to the exact head satisfies Gate 3 (Review Gate) for pull request mergeability.
- **8.6** New pull requests are created in draft state and stay in draft until a review record covers the head, or until the owner directs a forced merge (8.3), which promotes the pull request first.
- **8.7** _Retired 2026-09-24._ Draft promotion no longer triggers a review; the owning agent promotes after the review (8.20). Number kept so older citations don't dangle.
- **8.8** _Retired 2026-09-24._ CodeRabbit re-review behavior. Number kept so older citations don't dangle.
- **8.9** _Retired 2026-09-24._ CodeRabbit re-review requests. Number kept so older citations don't dangle.
- **8.10** _Retired 2026-09-24._ Codex review requests. Number kept so older citations don't dangle.
- **8.11** _Retired 2026-09-24._ Anchoring review requests to a head; the review record names its reviewed head instead (8.18). Number kept so older citations don't dangle.
- **8.12** Pushing new commits to a pull request branch invalidates previous review coverage, and the updated head requires a new local review. The one exception: a head whose only new commits are clean merges of the base branch keeps the earlier coverage.
- **8.13** The owning agent runs a local review after CI passes on the current head.
- **8.14** The review level follows the weighted diff size: low below 50 lines, medium from 50 up to 1,500, and high from 1,500 through 3,000. Above 3,000, the owning agent asks the owner before reviewing.
- **8.15** The weighted diff size counts added plus deleted lines against the base branch. It leaves out the lockfile, migration snapshots, test fixtures, binary files, and feature specs, and counts test code at half weight.
- **8.16** The owning agent fixes or declines every finding; a decline carries a one-sentence reason.
- **8.17** After fixing findings, the owning agent re-runs the local review on the new head at the same level, and repeats until a round raises no finding that is not already declined. A finding re-raised after being declined stays declined.
- **8.18** After a clean round, the owning agent posts a review record pinned to the head it reviewed, which must be the pull request's current head. The record lists the review level and every finding from every round with its disposition: fixed, with the commit, or declined, with the reason.
- **8.19** The owning agent never posts a review record for a head it did not review.
- **8.20** The owning agent promotes the pull request out of draft after posting the review record.

---

## 9. Quota & rate-limit management

- **9.1–9.4** _Retired 2026-09-24._ CodeRabbit quota and Codex fallback; the local review has no quota. Numbers kept so older citations don't dangle.

---

## 10. Concurrent review adjudication

- **10.1–10.7** _Retired 2026-09-24._ Adjudication between concurrent CodeRabbit and Codex reviews; there is one reviewer. Numbers kept so older citations don't dangle.

---

## 11. Review findings & agent handoff

- **11.1–11.4** _Retired 2026-09-24._ Extracting reviewer prompts into the watch verdict; the local review hands findings to the owning agent directly. Numbers kept so older citations don't dangle.

---

## Known divergences

| § | Requirement | Code today | Resolution |
| :-- | :-- | :-- | :-- |
| 2.1, 2.3 | Worktree and title launch parameters; corrupt-worktree rejection at launch | `pr-watch.py` takes the PR number, phase, and expected head. The worktree is the process's working directory; there is no title parameter and no worktree validation. Both lived only in the MCP wrapper, removed 2026-09-24 in the watcher simplification Tim approved (one CLI, no wrapper layers). | Amend 2.1 and 2.3 to the three-parameter CLI (requirement diff needs Tim's approval) |
| 6.1–6.3 | Host coordination: concurrent watches coalesce under one polling leader | Removed 2026-09-24 in the watcher simplification: each watch polls GitHub on its own. The XDG lock, state-file, and leader/follower machinery cost more code than the duplicate polling it saved. | Delete §6 (requirement diff needs Tim's approval) |
| 7.4 | Local execution telemetry (harness, model, wake count, elapsed duration) | Removed 2026-09-24 with the MCP wrapper and watcher agents, the only sources of harness, model, and wake data; nothing read the `tmp/gh-monitor/watcher-run-*.json` records. | Delete 7.4 (requirement diff needs Tim's approval) |
| 8.3 | Only a review record provides coverage | The gate still accepts a CodeRabbit approval or Codex review on the exact head | Remove the CodeRabbit and Codex checkers once both subscriptions end |
| 8.5–8.6, 8.13–8.20 | Local review, review record, and promotion after review | The gate does not read review records; agents promote on green CI and wait for CodeRabbit | PP-l4k4 |

---

## Changelog

| Date | Amendment |
| :-- | :-- |
| 2026-09-24 | Replace CodeRabbit and Codex with a local Claude Code review (§1, §3.2, §8, §9–§11): the owning agent reviews at a level set by weighted diff size, re-reviews after fixes until clean, posts a review record pinned to the head, then promotes; a forced merge promotes a draft first; §8.12 keeps coverage across clean base-branch merges; §9–§11 retired. |
| 2026-09-24 | Drop local owner attestation as a review provider (§1, §8.3, §8.4, §9.3): only CodeRabbit and Codex cover a head; the owner merges a PR without that coverage by directing a forced merge. |
| 2026-09-16 | Amend spec to add automated review requirements (§8–§11): CodeRabbit default review, draft-promotion auto-trigger, manual re-reviews and Codex requests, 5/hr rate limits and fallback, concurrent review first-success reporting with in-progress notices, and prompt extraction. |
| 2026-09-12 | Clarify §2.1: watch is defined by four core parameters with optional title for diagnostic logging. |
| 2026-09-12 | Qualify §6.1 host coalescing by expected head SHA to match leader-lock isolation. |
| 2026-09-12 | Clarify actor as the main agent across concepts and requirements; align §2.1 parameter contract with optional worktree defaulting; align §3.6 conflict resolution to merge origin/main per AGENTS.md branch policy. |
| 2026-09-12 | Initial draft from first principles: background monitoring, structured verdicts, failure reporting, zero-token waiting, and unified CLI invocation via Subway. |
