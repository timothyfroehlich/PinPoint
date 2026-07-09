#!/usr/bin/env bash
set -euo pipefail

# mark-claude-review.sh — attest that a Claude Code review covered the PR's head commit.
#
# Posts (or updates in place) a single sticky PR conversation comment carrying a
# SHA-pinned marker `<!-- pinpoint-claude-review: <head_sha> -->`. The `reviewed`
# gate in _pr-gates.sh detects this marker and, because the SHA is pinned to the
# current head, a later fix (new head SHA) invalidates the attestation and forces
# a fresh review. This is the Claude fallback for when Copilot silently skips.
#
# The helper only *attests* — the caller is responsible for having actually run the
# review first (`/code-review`, the model-invocable local review). Same honesty model
# as `merge-pr.sh --force`.
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
existing_id=$(gh api --paginate "repos/${repo}/issues/${pr}/comments" \
  --jq "map(select(.body | startswith(\"${MARKER_PREFIX}\"))) | .[0].id // empty")

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
