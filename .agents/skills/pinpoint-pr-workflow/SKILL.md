---
name: pinpoint-pr-workflow
description: "Use for the PinPoint PR lifecycle: committing, opening or adopting a PR, watching current-head CI or review, adjudicating findings, posting screenshots, applying readiness, handing off a merge, post-merge cleanup, or handling exceptional GitHub and merge-tool states."
---

# PinPoint PR Workflow

Route to the current lifecycle phase, then load only that phase's reference. When work
advances to another phase, read its reference before acting.

## Phase router

- **Uncommitted or local-only work:** read
  [commit and open](references/commit-and-open.md) before committing, opening, or
  adopting a PR.
- **PR open; CI, review, findings, or a replacement head pending:** read
  [CI and review](references/ci-and-review.md) before watching, promoting a draft,
  requesting review, adjudicating threads, or pushing a correction.
- **Current-head review complete; UI evidence or readiness pending:** read
  [screenshots and readiness](references/screenshots-and-readiness.md) before deciding
  whether screenshots are required or applying `ready-for-review`.
- **Ready label applied or merge handoff requested:** read
  [merge handoff](references/merge-handoff.md) before reporting readiness or invoking a
  merge path.
- **Tim merged the PR:** read [post-merge](references/post-merge.md) before deciding
  whether to watch deployment, closing Beads, or cleaning up.

## Lifecycle invariants

- **Exact head:** CI and review evidence must cover the current full head SHA. Every push
  invalidates prior coverage and restarts the CI-then-review sequence.
- **One owner:** the capable owning agent makes every mutation and adjudicates findings.
  Lightweight watcher subagents are isolated, read-only waits that return one terminal
  `pr-watch.py --json` result.
- **Manual review request:** request Codex review exactly once per intended head, only
  after current-head CI succeeds and the PR is ready rather than draft.
- **Tim merges:** PinPoint merge authority belongs to Tim. Agents prepare the
  gate-enforced handoff; raw merge channels remain unavailable to agents.
- **Repository authorities:** `AGENTS.md` owns branch, test, Beads, review-reply, and
  merge-authority policy. `REVIEW.md` owns the review rubric.

## Exceptional routes

Read [exceptional cases](references/exceptional-cases.md) only when one of these branches
applies:

- Tim explicitly chooses `/codex:review` or `/code-review` instead of the GitHub review;
- a merge gate needs an escape-hatch decision or the merge tooling itself is broken;
- two or more Dependabot PRs touch the same lockfile;
- a GitHub MCP response behaves unexpectedly or its field semantics matter.

## Completion path

1. Commit and open the agent-created PR as a draft with its origin attribution.
2. Obtain current-head CI, manually request review once, and adjudicate every thread.
3. Satisfy UI evidence when applicable and apply `ready-for-review` only after all gates.
4. Run `bash scripts/workflow/merge-handoff.sh <PR>` and give Tim its exact output.
5. After Tim merges, perform only risk-appropriate deployment watching and confirmed
   cleanup.

Maintainers changing this skill must read the
[coverage inventory](references/coverage-inventory.md) and account for every affected
route. Status-token meanings and script mechanics remain authoritative in
`scripts/workflow/AGENTS.md`.
