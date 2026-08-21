#!/usr/bin/env bash
set -euo pipefail

# review-preflight.sh — check that a review of this PR will actually see the diff, then
# print the commands to hand Tim.
#
# Two reviewers are in use and Tim runs either: `/codex:review` (Codex plugin) and the
# built-in `/code-review`. Both read LOCAL git state in the session's working directory.
# Nothing connects either to the PR you think you are reviewing: neither reads the PR,
# neither knows its head SHA, and neither objects to being pointed somewhere else. Run one
# from the wrong directory and the failure is silent in the worst possible way — a review
# of an empty diff finds nothing and reports nothing, which reads exactly like a clean
# review. Attesting that is a false attestation nobody involved would notice making.
#
# So this is the step between "the branch is ready" and "Tim, please review it". It checks
# the things that have to hold for the review to be about this PR, and refuses to
# print the commands when one doesn't:
#
#   1. the working directory is the PR's branch      — else you review someone else's diff
#   2. local HEAD is the SHA that is actually pushed  — else you attest a commit Codex
#                                                       never read (the marker pins the
#                                                       REMOTE head, this checks they agree)
#   3. the tree is clean                              — LOAD-BEARING. Tim types bare
#                                                       `/codex:review`, whose default
#                                                       `--scope auto` reviews the branch
#                                                       diff only while the tree is clean
#                                                       and silently switches to reviewing
#                                                       the working tree when it isn't.
#                                                       Nothing downstream can tell the
#                                                       difference, and the marker would
#                                                       claim a branch review either way.
#                                                       A dirty tree is worth blocking on
#                                                       for `/code-review` too: whatever it
#                                                       reads, uncommitted work is not part
#                                                       of the PR.
#   4. `<base>...HEAD` is non-empty                   — the silent-null case above
#   5. local `main` == `origin/main`                  — the reviewer resolves the base to
#                                                       the LOCAL branch, which the
#                                                       merge-don't-rebase sync leaves
#                                                       stale, so the review silently
#                                                       covers already-merged work
#
# It also refuses when the PR is not based on `main`, since the attestation it prints
# says `base-main`.
#
# Usage:
#   bash scripts/workflow/review-preflight.sh <PR>
#
# The base is always `main`, and is not a parameter. It briefly was: the earlier shape
# took an optional `[base]` and printed `mark-review.sh … base-<that>` — an attestation
# `mark-review.sh` rejects for every base but `main`, so the preflight would say READY
# and hand over a command that cannot complete. The fix is this direction rather than
# teaching the marker more pairs: PinPoint branches from `main` and merges back to it,
# nothing here reviews against anything else, and widening the attestation vocabulary
# for a case that does not exist is how a record stops meaning one thing. (Codex review
# of #1931.)
#
# The Codex command handed over is bare `/codex:review`, not `--base main`. On a clean
# tree the plugin resolves `--scope auto` to a branch diff against the detected default
# branch, which is `main` here — so the flag was only ever restating the default, and this
# is one fewer thing to type correctly every time. Check 3 is what makes the default safe.
#
# Exit status: 0 ready, 1 not ready (reasons on stdout), 2 usage error.
#
# Invoked via `bash …` — no executable bit required (committed mode 644).

readonly base="main"

pr="${1:-}"

if [[ -z "$pr" || ! "$pr" =~ ^[0-9]+$ ]]; then
  echo "usage: review-preflight.sh <PR>" >&2
  exit 2
fi

# Refuse a second argument rather than ignoring it. Silently dropping a base someone
# meant would review against `main` while they believed otherwise — the same
# looks-fine-covers-nothing shape this whole script exists to catch.
if [[ $# -gt 1 ]]; then
  echo "review-preflight.sh: unexpected argument '${2}' — the base is always 'main'" >&2
  echo "usage: review-preflight.sh <PR>" >&2
  exit 2
fi

# Capture the `gh` call into a variable and check it, rather than reading a command
# substitution straight into a here-string. `set -e` does NOT abort on a failing
# substitution used that way (verified), so the earlier shape let a rate-limited,
# unauthenticated, or wrong-PR-number `gh` leave all four variables EMPTY and carry on.
# The script then printed four confident, wrong diagnoses — `PR #N is , not open`,
# `targets '', not 'main'`, `no worktree has it checked out`, and a bogus pushed-head
# mismatch — and never mentioned that the API call was what failed. It still failed
# closed, so nothing unsafe got through; the cost was handing the reader four false
# leads instead of the one true one. A preflight that exists to stop people acting on
# a wrong picture of the world has no business generating one of its own.
if ! pr_tsv=$(gh pr view "$pr" --json headRefName,headRefOid,state,baseRefName \
      --jq '[.headRefName, .headRefOid, .state, .baseRefName] | @tsv' 2>/dev/null) \
   || [[ -z "$pr_tsv" ]]; then
  echo
  echo "Review preflight — PR #${pr}"
  echo "  ────────────────────────────────────────────────────────────────────────"
  echo "  NOT READY — could not read PR #${pr} from GitHub."
  echo "    'gh pr view' failed or returned nothing. Check the PR number, 'gh auth status',"
  echo "    and network reachability, then re-run."
  echo "  ────────────────────────────────────────────────────────────────────────"
  echo
  exit 1
fi

# Tab-to-space via parameter expansion rather than a `tr` pipe — one less spawn, and it
# keeps the failure check above attached to `gh` alone instead of to a pipeline whose
# exit status could come from `tr`.
read -r head_branch head_oid pr_state base_branch <<<"${pr_tsv//$'\t'/ }"

local_branch=$(git rev-parse --abbrev-ref HEAD)
local_head=$(git rev-parse HEAD)
toplevel=$(git rev-parse --show-toplevel)

# Update remote-tracking refs so `origin/main` is current. Read-only in the sense that
# matters: it moves no local branch and touches no working tree. Failure is not fatal —
# check 5 compares `main` to whatever `origin/main` we have, and an unreachable remote
# leaves a stale `origin/main` that either matches (silent, and no worse than before) or
# blocks. Both fail closed.
git fetch origin "$base" --quiet 2>/dev/null || true

# Print the path of the worktree that has $1 checked out, if any.
_worktree_holding() {
  git worktree list --porcelain \
    | awk -v want="refs/heads/$1" '
        /^worktree /  { path = substr($0, 10) }
        /^branch /    { if (substr($0, 8) == want) { print path; exit } }'
}

blocking=()

if [[ "$pr_state" != "OPEN" ]]; then
  blocking+=("PR #${pr} is ${pr_state}, not open")
fi

# The attestation pair this script prints is `base-main`, which claims the review covered
# the branch diff against `main`. On a PR based on anything else that record is false, and
# nothing downstream re-derives it — so refuse rather than attest a scope nobody checked.
if [[ "$base_branch" != "$base" ]]; then
  blocking+=("PR #${pr} targets '${base_branch}', not '${base}' — 'base-main' would record a scope that is false")
fi

if [[ "$local_branch" != "$head_branch" ]]; then
  # Name the worktree that IS on the branch, if one exists — "wrong directory" is only
  # half an answer, and the other half is one `git worktree list` away.
  target=$(_worktree_holding "$head_branch")
  if [[ -n "$target" ]]; then
    blocking+=("on branch '${local_branch}', not '${head_branch}' — the PR's worktree is ${target}")
  else
    blocking+=("on branch '${local_branch}', not '${head_branch}' — no worktree has it checked out")
  fi
fi

if [[ "$local_head" != "$head_oid" ]]; then
  blocking+=("local HEAD ${local_head:0:7} is not the pushed head ${head_oid:0:7} — push, or pull, before reviewing")
fi

if [[ -n "$(git status --porcelain)" ]]; then
  blocking+=("working tree is dirty — commit or stash; uncommitted work is not part of the PR")
fi

if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  blocking+=("no local branch '${base}' to diff against")
elif ! git rev-parse --verify --quiet "origin/${base}^{commit}" >/dev/null; then
  blocking+=("no 'origin/${base}' ref — could not reach the remote to check the base is current")
elif [[ "$(git rev-parse "$base")" != "$(git rev-parse "origin/${base}")" ]]; then
  # LOCAL `main`, not `origin/main`, and that is not a typo. `/codex:review` resolves its
  # own base through the plugin's `detectDefaultBranch`, which reads
  # `refs/remotes/origin/HEAD`, then STRIPS the `refs/remotes/origin/` prefix and returns
  # the bare name — so git resolves it as the local branch. Whatever this script measures
  # has to be the ref the reviewer will actually use.
  #
  # And local `main` goes stale as a matter of routine: AGENTS.md §5 says sync with
  # `git fetch origin && git merge origin/main`, which advances the feature branch and
  # never the local `main` it merged from. Staleness only ever ENLARGES the diff, so
  # check 4 below stays safe — but the review then covers other people's already-merged
  # work, which is the same "the review was not about this PR" failure the wrong-directory
  # check exists to catch, just quieter. Measured on PR #1931: 34 files / 1138 lines
  # against a `main` 5 commits stale, versus the PR's actual 22 / 856.
  #
  # This blocks rather than fixes. PP-e74d is the fix: have `merge-pr.sh` fast-forward
  # the root checkout's `main` after each merge, so it is level by default. Keep this
  # check regardless — it covers the window between merges and drift from any other
  # cause.
  behind=$(git rev-list --count "${base}..origin/${base}")
  holder=$(_worktree_holding "$base")
  if [[ -z "$holder" ]]; then
    # Nothing has `main` checked out, so it is an ordinary ref and can be advanced from
    # right here.
    remedy="git fetch origin ${base}:${base}"
  elif [[ "$holder" == "$toplevel" ]]; then
    # THIS worktree is the one holding `main` — reached when the preflight runs from the
    # root checkout against some other branch's PR. The cross-directory form below would
    # tell the reader to go elsewhere to run a command that works where they already are,
    # which is the opposite of what that branch is for.
    remedy="git pull --ff-only"
  else
    # A branch checked out in ANOTHER worktree cannot be fast-forwarded from here — `git
    # fetch origin main:main` refuses outright — so the remedy has to name that worktree.
    #
    # And a worktree-isolated agent session cannot run it at all: Claude Code refuses
    # `git -C <other-checkout>` the same way it refuses `cd <other> && git ...`. The
    # `!` prefix does not help, because that runs in the session too. So the remedy
    # says where to run it rather than pretending it is copy-pasteable from here.
    # (PP-e74d is the real fix: have `merge-pr.sh` do this itself after each merge.)
    remedy="git -C ${holder} pull --ff-only   (from a terminal outside this session)"
  fi
  if ((behind > 0)); then
    blocking+=("local '${base}' is ${behind} commit(s) behind 'origin/${base}' — the review would cover already-merged work; run: ${remedy}")
  else
    blocking+=("local '${base}' has diverged from 'origin/${base}' — the review would be scoped to the wrong base; run: ${remedy}")
  fi
elif [[ -z "$(git diff --name-only "${base}...HEAD")" ]]; then
  blocking+=("'${base}...HEAD' is empty — a review here would find nothing and read as clean")
fi

echo
echo "Review preflight — PR #${pr} (${head_branch})"
echo "  cwd           ${toplevel}"
echo "  branch        ${local_branch}"
echo "  head          ${local_head:0:7} (pushed: ${head_oid:0:7})"
if git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  echo "  diff vs base  $(git diff --shortstat "${base}...HEAD" | sed 's/^ *//')"
fi
echo "  ────────────────────────────────────────────────────────────────────────"

if ((${#blocking[@]} > 0)); then
  echo "  NOT READY — ${#blocking[@]} problem(s):"
  for b in "${blocking[@]}"; do echo "    - ${b}"; done
  echo "  ────────────────────────────────────────────────────────────────────────"
  echo
  exit 1
fi

# Two reviewers, and Tim runs either one — so print both rather than guessing which he
# will pick. Neither is launchable from here: the Codex plugin declares `/codex:review`
# `disable-model-invocation`, and the built-in `/code-review` is user-triggered and billed.
# Printing the commands for him to run is the whole handoff.
#
# Each command sits alone on its own line with nothing else on it. Tim copies by
# triple-clicking, which takes the entire line — a command sharing a line with a label or
# a trailing period pastes that too, and stops being a working slash command.
echo "  READY — ask Tim to run ONE of these, from this directory:"
echo
echo "/codex:review"
echo
echo "/code-review"
echo
# The reviewer/detail pairs are spelled out rather than built from input: they must match
# pairs mark-review.sh accepts, and a printed attestation that drifts from that allowlist
# is a READY handoff to a command that exits 2. `<depth>` is the one placeholder, because
# only Tim knows which `/code-review` level he ran.
#
# No `!` prefix on these: attesting is the agent's step, not Tim's.
echo "  Then attest the head he reviewed — the pair must match the command he ran:"
echo "    bash scripts/workflow/mark-review.sh ${pr} codex-plugin-cc base-main \"<one-line findings>\""
echo "    bash scripts/workflow/mark-review.sh ${pr} claude-code <depth> \"<one-line findings>\""
echo "  ────────────────────────────────────────────────────────────────────────"
echo
