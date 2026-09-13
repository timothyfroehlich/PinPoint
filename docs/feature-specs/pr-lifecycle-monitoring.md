# PR Lifecycle Monitoring — Feature Spec

**Status: draft.**

**What this document is.** The requirements for PinPoint's PR lifecycle monitoring: how agents watch PRs in the background and act on results. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `scripts/workflow/AGENTS.md` (exit code and terminal JSON semantics), `.agents/skills/pinpoint-pr-workflow/SKILL.md` (PR workflow phases).

---

## 1. Concepts

- **Watch** — an asynchronous background observation of a PR lifecycle phase anchored to a specific commit. Runs until a terminal verdict or timeout without blocking agent turns.
- **Phase** — the lifecycle stage under observation: **CI** (aggregate check gate completion) or **review** (exact-head review evidence and thread resolution).
- **Expected head** — the commit SHA the watch is anchored to. Detects PR branch updates so agents never act on stale commits.
- **Terminal verdict** — an authoritative, machine-readable JSON object emitted upon completion that gives the main agent everything needed to take its next step without follow-up queries.
- **Failure artifact** — a targeted markdown summary of failed CI steps and errors written to disk, sparing the main agent from fetching or parsing raw workflow logs.

---

## 2. Launching a watch

- **2.1** A watch is defined by five parameters: the worktree path, the PR number, the PR title, the phase (`ci` | `review`), and the expected head SHA. The launching command defaults the worktree to the current working directory when invoked in place.
- **2.2** A watch executes as a non-blocking background process, consuming zero main-agent context tokens while running.
- **2.3** Invalid parameters, missing executables, or corrupt worktrees fail immediately at launch rather than hanging or polling.
- **2.4** Invocation syntax and semantics are identical across all agent harnesses.

---

## 3. Terminal verdicts

- **3.1** Every watch terminates with exactly one structured JSON verdict emitted to standard output.
- **3.2** A terminal verdict contains the complete decision state: PR number, phase, expected and observed head SHAs, outcome, CI gate status, review state, unresolved thread count, merge state, timestamp, and optional failure artifact path.
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

- **6.1** Concurrent watches on the same PR and phase on a host machine coalesce under a single polling leader.
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

## Known divergences

| § | Requirement | Code today | Resolution |
| :-- | :-- | :-- | :-- |
| 7.1 | Unified CLI command across all harnesses | Subway watch provides unified CLI; legacy harness agent definitions retained as dormant fallback | Resolved once subagents are deprecated |

---

## Changelog

| Date | Amendment |
| :-- | :-- |
| 2026-09-12 | Clarify actor as the main agent across concepts and requirements; align §2.1 parameter contract with optional worktree defaulting; align §3.6 conflict resolution to merge origin/main per AGENTS.md branch policy. |
| 2026-09-12 | Initial draft from first principles: background monitoring, structured verdicts, failure reporting, zero-token waiting, and unified CLI invocation via Subway. |
