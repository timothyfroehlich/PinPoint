# PinPoint — Copilot code review instructions

The canonical review brief lives at [`REVIEW.md`](../REVIEW.md) in the repository root — read it. It covers priority rules, review scope, relevant agent skills, review mechanics, and the merge boundary.

Path-scoped rules live in `.github/instructions/*.instructions.md`.

Reviews on this repo are **request-only** as of 2026-08-01, apart from a single automatic review fired at PR-open against open-time head. Nothing else triggers one — not an intermediate push, not the `ready-for-review` label, not green CI; after that the author asks explicitly with `gh pr edit <PR> --add-reviewer "@copilot"` once they have stopped iterating. Either way, treat the commit you are handed as the one intended to be final. A review covering the head commit is still required before the PR can merge — see "How a review gets triggered" in `REVIEW.md`.
