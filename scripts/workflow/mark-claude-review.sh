#!/usr/bin/env bash
set -euo pipefail

# mark-claude-review.sh — attest that a review covered the PR's head commit.
#
# Posts (or updates in place) a single sticky PR conversation comment carrying a
# SHA-pinned marker `<!-- pinpoint-claude-review: <head_sha> -->`. The `reviewed`
# gate in _pr-gates.sh detects this marker and, because the SHA is pinned to the
# current head, a later fix (new head SHA) invalidates the attestation and forces
# a fresh review.
#
# Since PP-4ric this is the ONLY thing that satisfies that gate — Copilot review was
# retired on 2026-08-02 and no bot reviews this repo. What it attests to is Tim having
# run `/code-review` over the branch: that is a Claude Code harness built-in an agent
# cannot launch, so the review itself is a handoff and this helper is what records it.
# The one exception is a genuinely trivial change (a typo, a comment, a one-line
# mechanical fix), where the summary should say why it was trivial.
#
# The helper only *attests* — the caller is responsible for the review having actually
# happened. Posting the marker for a review nobody ran is a false attestation, not a
# shortcut. Same honesty model as `merge-pr.sh --force`.
#
# Usage:
#   bash scripts/workflow/mark-claude-review.sh <PR> ["one-line findings summary"]
#
# Environment:
#   gh must be authenticated. Repo slug is resolved dynamically via `gh repo view`.
#
# Invoked via `bash …` — no executable bit required (committed mode 644).

MARKER_PREFIX="<!-- pinpoint-claude-review:"

pr="${1:-}"
summary="${2:-no serious findings}"

if [[ -z "$pr" || ! "$pr" =~ ^[0-9]+$ ]]; then
  echo "usage: mark-claude-review.sh <PR> [\"one-line findings summary\"]" >&2
  exit 2
fi

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

head_sha=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
short_sha="${head_sha:0:7}"

marker="${MARKER_PREFIX} ${head_sha} -->"
full_body="${marker}"$'\n'"Claude review of head ${short_sha} — ${summary}"

# Find an existing sticky comment whose body starts with the marker prefix (any SHA).
# Pipe to `jq -rs` (slurp) rather than gh's per-page `--jq`, so a marker that landed on
# page 2+ of a busy PR is still found — otherwise a duplicate sticky marker gets posted.
#
# `last`, matching the SHA `_pr-gates.sh` reports when no marker pins head: if two
# markers ever coexist, the one this rewrites is the one the gate names back at you.
# (The gate passes on ANY marker pinning head, so agreeing here is legibility, not
# correctness — but disagreeing is how a rewrite lands on a comment nobody reads.)
existing_id=$(gh api --paginate "repos/${repo}/issues/${pr}/comments" \
  | jq -rs --arg prefix "$MARKER_PREFIX" \
      '[.[] | flatten | .[] | select(.body | startswith($prefix))] | last.id // empty')

if [[ -n "$existing_id" ]]; then
  echo "Updating Claude-review marker (id=${existing_id}) on PR #${pr} → head ${short_sha}"
  gh api \
    --method PATCH \
    "repos/${repo}/issues/comments/${existing_id}" \
    -f body="$full_body" \
    --jq '.html_url'
else
  echo "Posting Claude-review marker on PR #${pr} → head ${short_sha}"
  gh api \
    --method POST \
    "repos/${repo}/issues/${pr}/comments" \
    -f body="$full_body" \
    --jq '.html_url'
fi
