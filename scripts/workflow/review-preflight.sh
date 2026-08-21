#!/usr/bin/env bash
set -euo pipefail

# review-preflight.sh — check that a Codex review of this PR will actually see the diff,
# then print the command to hand Tim.
#
# `/codex:review` reviews LOCAL git state in the session's working directory. Nothing
# connects it to the PR you think you are reviewing: it does not read the PR, does not
# know its head SHA, and does not object to being pointed somewhere else. Run it from the
# wrong directory and the failure is silent in the worst possible way — a review of an
# empty diff finds nothing and reports nothing, which reads exactly like a clean review.
# Attesting that is a false attestation nobody involved would notice making.
#
# So this is the step between "the branch is ready" and "Tim, please review it". It checks
# the four things that have to hold for the review to be about this PR, and refuses to
# print the command when one doesn't:
#
#   1. the working directory is the PR's branch      — else you review someone else's diff
#   2. local HEAD is the SHA that is actually pushed  — else you attest a commit Codex
#                                                       never read (the marker pins the
#                                                       REMOTE head, this checks they agree)
#   3. the tree is clean                              — uncommitted work is not in the PR,
#                                                       and a dirty tree makes `--scope
#                                                       auto` review the working tree
#                                                       instead of the branch
#   4. `<base>...HEAD` is non-empty                   — the silent-null case above
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

read -r head_branch head_oid pr_state <<<"$(
  gh pr view "$pr" --json headRefName,headRefOid,state \
    --jq '[.headRefName, .headRefOid, .state] | @tsv' | tr '\t' ' '
)"

local_branch=$(git rev-parse --abbrev-ref HEAD)
local_head=$(git rev-parse HEAD)
toplevel=$(git rev-parse --show-toplevel)

blocking=()

if [[ "$pr_state" != "OPEN" ]]; then
  blocking+=("PR #${pr} is ${pr_state}, not open")
fi

if [[ "$local_branch" != "$head_branch" ]]; then
  # Name the worktree that IS on the branch, if one exists — "wrong directory" is only
  # half an answer, and the other half is one `git worktree list` away.
  target=$(git worktree list --porcelain \
    | awk -v want="refs/heads/${head_branch}" '
        /^worktree /  { path = substr($0, 10) }
        /^branch /    { if (substr($0, 8) == want) { print path; exit } }')
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
  blocking+=("no local ref '${base}' to diff against — fetch it first")
elif [[ -z "$(git diff --name-only "${base}...HEAD")" ]]; then
  blocking+=("'${base}...HEAD' is empty — a review here would find nothing and read as clean")
fi

echo
echo "Codex review preflight — PR #${pr} (${head_branch})"
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

# `!`-prefixed: Tim types this into the Claude Code prompt. `/codex:review` is declared
# `disable-model-invocation` by the Codex plugin, so an agent cannot launch it — printing
# the command for him to run is the whole handoff.
echo "  READY — ask Tim to run, from this directory:"
echo
echo "/codex:review --base ${base}"
echo
# `base-main` is spelled out, not interpolated: it must match a pair mark-review.sh
# accepts, and a printed attestation that drifts from that allowlist is a READY handoff
# to a command that exits 2.
echo "  Then attest the head he reviewed:"
echo "! bash scripts/workflow/mark-review.sh ${pr} codex-plugin-cc base-main \"<one-line findings>\""
echo "  ────────────────────────────────────────────────────────────────────────"
echo
