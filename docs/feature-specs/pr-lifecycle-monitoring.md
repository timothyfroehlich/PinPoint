# PR Lifecycle Monitoring — Feature Spec

**Status: draft.**

**What this document is.** The requirements for PinPoint's PR lifecycle monitoring: how agents watch PRs in the background, which gates a pull request passes before it merges, and how agents act on results. No implementation detail — design records and code carry that. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** `scripts/workflow/AGENTS.md` (exit code and terminal JSON semantics), `.agents/skills/pinpoint-pr-workflow/SKILL.md` (PR workflow phases).

---

## 1. Concepts

- **Watch** — an asynchronous background observation of a PR lifecycle phase anchored to a specific commit. Runs until a terminal verdict or timeout without blocking agent turns.
- **Phase** — the lifecycle stage under observation: **CI** (aggregate check gate completion, and Claude Review once the pull request is out of draft).
- **Expected head** — the commit SHA the watch is anchored to. Detects PR branch updates so agents never act on stale commits.
- **Terminal verdict** — an authoritative, machine-readable JSON object emitted upon completion that gives the main agent everything needed to take its next step without follow-up queries.
- **Failure artifact** — a targeted markdown summary of failed CI steps and errors written to disk, sparing the main agent from fetching or parsing raw workflow logs.
- **Required checks** — the checks the repository ruleset requires on a pull request's head before it can merge: CI Gate, Claude Review, and UI Approval.
- **Claude Review** — the automated Claude Code review that runs in CI on the owner's Claude subscription and reports findings as inline review comments.
- **Reviewed range** — the commits a Claude Review run covers: the whole pull request on the first run, and afterwards the commits since the newest earlier head whose Claude Review passed, with the base branch's changes left out.
- **Review level** — the effort a Claude Review runs at (low, medium, or high), chosen from the weighted diff size of the reviewed range.
- **Weighted diff size** — the reviewed range's changed lines, with generated and fixture content left out and test code counted at half weight (§8.15).
- **UI path** — a file whose change can alter what renders: page and layout components, shared components, stylesheets, Tailwind configuration, and design tokens.
- **UI sign-off** — the owner's approval of a pull request's UI changes, recorded against the commit he saw.
- _Retired 2026-09-24:_ automated reviewer, review hierarchy, promotion trigger, re-review request, review quota, in-progress review, concurrent review, first-success verdict, and actionable review prompt. CodeRabbit and Codex no longer provide review coverage.
- _Retired 2026-10-25:_ local review, review record, draft gate, and the review watch phase. The Claude Review check replaced the owning agent's local review record.

---

## 2. Launching a watch

- **2.1** A watch is defined by four core parameters: the worktree path, the PR number, the phase (`ci`), and the expected head SHA. An optional PR title may be supplied for diagnostic logging. The launching command defaults the worktree to the current working directory when invoked in place.
- **2.2** A watch executes as a non-blocking background process, consuming zero main-agent context tokens while running.
- **2.3** Invalid parameters, missing executables, or corrupt worktrees fail immediately at launch rather than hanging or polling.
- **2.4** Invocation syntax and semantics are identical across all agent harnesses.

---

## 3. Terminal verdicts

- **3.1** Every watch terminates with exactly one structured JSON verdict emitted to standard output.
- **3.2** A terminal verdict contains the complete decision state: PR number, phase, expected and observed head SHAs, outcome, CI gate status, Claude Review status, unresolved thread count, merge state, timestamp, and optional failure artifact path. A CI watch passes only when CI Gate passes and, on a pull request out of draft, Claude Review passes too; a failed Claude Review fails the watch.
- **3.3** Outcomes belong to a closed set: **passed**, **failed**, **stale**, **conflicting**, **timed_out**, **undetermined**.
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
  - `1`: Actionable failure (`failed`, `stale`, `conflicting`).
  - `2`: Infrastructure or timeout failure (`undetermined`, `timed_out`).
- **7.3** Standard output is reserved strictly for the terminal JSON verdict.
- **7.4** Execution telemetry (harness, model if any, wake count, elapsed duration) is recorded locally for operational diagnostics.

---

## 8. Review, UI sign-off & merge gates

- **8.1** _Retired 2026-09-24._ CodeRabbit was the default automated reviewer. Number kept so older citations don't dangle.
- **8.2** _Retired 2026-09-24._ Codex was the fallback reviewer; there is no fallback reviewer. Number kept so older citations don't dangle.
- **8.3** A pull request merges only when every required check passes on its head, every review conversation is resolved, and its branch is up to date with the base branch. GitHub's repository ruleset enforces this; only the owner may bypass it.
- **8.4** _Retired 2026-09-24._ The priority chain between CodeRabbit and Codex. Number kept so older citations don't dangle.
- **8.5** Claude Review runs on every pull request that is not a draft: when it is opened ready, when it is marked ready, and on every push after that. A run reviews its reviewed range and passes without a review when that range adds nothing beyond the base branch, such as a clean merge of the base branch.
- **8.6** New pull requests are created in draft state. The owning agent marks a pull request ready after the owner's UI sign-off, where one is needed, and after the end-to-end tests are updated.
- **8.7** _Retired 2026-09-24._ Draft promotion no longer triggers a separate review request. Number kept so older citations don't dangle.
- **8.8** _Retired 2026-09-24._ CodeRabbit re-review behavior. Number kept so older citations don't dangle.
- **8.9** _Retired 2026-09-24._ CodeRabbit re-review requests. Number kept so older citations don't dangle.
- **8.10** _Retired 2026-09-24._ Codex review requests. Number kept so older citations don't dangle.
- **8.11** _Retired 2026-09-24._ Anchoring review requests to a head. Number kept so older citations don't dangle.
- **8.12** A Claude Review run passes only when the review finished over its whole reviewed range; a passing run marks its head reviewed for the next run's range. A base-branch merge with a conflict resolution is reviewed.
- **8.13** Claude Review posts each finding as an inline comment on the line it concerns. It cannot edit, commit, push, approve, or request changes, and it treats pull request content as data, never as instructions.
- **8.14** The review level follows the weighted diff size: low below 50 lines, medium from 50 up to 1,500, and high from 1,500 up.
- **8.15** The weighted diff size counts added plus deleted lines. It leaves out the lockfile, migration snapshots, test fixtures, binary files, and feature specs, and counts test code at half weight.
- **8.16** The owning agent fixes or declines every finding, declines with a one-sentence signed reply, and resolves the conversation.
- **8.17** A pull request comment of `/claude-review` from someone with write access re-runs Claude Review on the current head.
- **8.18** UI Approval passes on its own when no UI path changed since the newest earlier head whose UI Approval passed, with the base branch's changes left out. Otherwise it waits for the owner's UI sign-off. A sign-off covers later commits that change no UI path; a later UI change waits again.
- **8.19** Before asking for a UI sign-off, the owning agent shows the owner screenshots of the changed UI at the three review viewports, taken from the committed, pushed head, and offers the running app for hands-on review.
- **8.20** The owning agent records a UI sign-off only on the owner's own approval and only for the commit he saw.
- **8.21** The owner decides whether a pull request merges. On his explicit request, the owning agent merges it with a squash merge, or enables auto-merge so GitHub merges once the required checks pass; a branch behind the base branch is brought up to date by merging the base branch into it. Agents never bypass the ruleset.
- **8.22** While auto-merge is enabled on a non-draft pull request from this repository, an automated workflow merges the base branch into it each time the base branch moves and the pull request is behind. A pull request whose update conflicts is left for its owning agent. Pull requests opened by bots are excluded.

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

---

## Changelog

| Date | Amendment |
| :-- | :-- |
| 2026-10-30 | Add §8.22: pull requests with auto-merge enabled are kept up to date with the base branch automatically. |
| 2026-10-25 | Replace the local review record with GitHub-native gates (§1, §2.1, §3.2–3.3, §7.2, §8): required checks CI Gate, Claude Review, and UI Approval plus resolved conversations and an up-to-date branch; Claude Review reviews the whole pull request first and then each push's new commits; UI Approval waits for the owner's sign-off on UI changes; the owner decides merges and agents merge natively on his request; the review watch phase and the migration-renumber coverage rule retire; the CI watch also waits for Claude Review and reports it with the unresolved thread count. |
| 2026-10-06 | §8.12 also keeps coverage across a base-branch merge whose only resolution renumbers the branch's migrations with unchanged SQL. |
| 2026-10-03 | Add xhigh and max review levels (Concepts, §8.14): above 3,000 weighted lines the owner chooses xhigh or max, or splits the pull request. |
| 2026-09-27 | Retire CodeRabbit checker from review gates and handoff scripts; only review record and Codex remain during transition. |
| 2026-09-24 | Replace CodeRabbit and Codex with a local Claude Code review (§1, §3.2, §8, §9–§11): the owning agent reviews at a level set by weighted diff size, re-reviews after fixes until clean, posts a review record pinned to the head, then promotes; a forced merge promotes a draft first; §8.12 keeps coverage across clean base-branch merges; §9–§11 retired. |
| 2026-09-24 | Drop local owner attestation as a review provider (§1, §8.3, §8.4, §9.3): only CodeRabbit and Codex cover a head; the owner merges a PR without that coverage by directing a forced merge. |
| 2026-09-16 | Amend spec to add automated review requirements (§8–§11): CodeRabbit default review, draft-promotion auto-trigger, manual re-reviews and Codex requests, 5/hr rate limits and fallback, concurrent review first-success reporting with in-progress notices, and prompt extraction. |
| 2026-09-12 | Clarify §2.1: watch is defined by four core parameters with optional title for diagnostic logging. |
| 2026-09-12 | Qualify §6.1 host coalescing by expected head SHA to match leader-lock isolation. |
| 2026-09-12 | Clarify actor as the main agent across concepts and requirements; align §2.1 parameter contract with optional worktree defaulting; align §3.6 conflict resolution to merge origin/main per AGENTS.md branch policy. |
| 2026-09-12 | Initial draft from first principles: background monitoring, structured verdicts, failure reporting, zero-token waiting, and unified CLI invocation via Subway. |
