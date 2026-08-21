#!/usr/bin/env bash
set -euo pipefail

# mark-review.sh — record a real review of a PR's current head commit.
#
# The marker is intentionally only an attestation. It is never a request for a review,
# and posting it for a review that did not happen is a false attestation. The SHA in the
# marker makes the record self-expiring: every push requires a new review of the new head.
#
# The review itself is Tim's to run: the Codex plugin declares `/codex:review` (and
# `/codex:result`) `disable-model-invocation`, so an agent cannot launch either one. That
# is what keeps the attestation witnessed by someone other than its author — this script
# only records what he ran.
#
# Usage:
#   bash scripts/workflow/mark-review.sh <PR> <reviewer> <detail> ["one-line findings"]
#
#   <reviewer>  codex-plugin-cc | claude-code
#   <detail>    codex-plugin-cc: base-main   (i.e. Codex reviewed the branch diff against
#                                             `main` — the target, not the flags; bare
#                                             `/codex:review` on a clean tree resolves to
#                                             exactly that)
#               claude-code: low | medium | high | xhigh | max | ultra | trivial

MARKER_PREFIX="<!-- pinpoint-review:"
LEGACY_MARKER_PREFIX="<!-- pinpoint-claude-review:"
REVIEWER_PREFIX="<!-- pinpoint-reviewer:"
DETAIL_PREFIX="<!-- pinpoint-review-detail:"

pr="${1:-}"
reviewer="${2:-}"
detail="${3:-}"
summary="${4:-no serious findings}"

usage() {
  echo "usage: mark-review.sh <PR> <reviewer> <detail> [\"one-line findings summary\"]" >&2
  echo "       reviewer: codex-plugin-cc | claude-code" >&2
  echo "       codex-plugin-cc detail: base-main" >&2
  echo "       claude-code detail: low | medium | high | xhigh | max | ultra | trivial" >&2
}

if [[ -z "$pr" || ! "$pr" =~ ^[0-9]+$ ]]; then
  usage
  exit 2
fi

case "$reviewer:$detail" in
  codex-plugin-cc:base-main) ;;
  claude-code:low | claude-code:medium | claude-code:high | claude-code:xhigh | claude-code:max | claude-code:ultra | claude-code:trivial) ;;
  *)
    echo "mark-review.sh: unsupported reviewer/detail pair: '${reviewer}:${detail}'" >&2
    usage
    exit 2
    ;;
esac

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
head_sha=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
short_sha="${head_sha:0:7}"

marker="${MARKER_PREFIX} ${head_sha} -->"
reviewer_marker="${REVIEWER_PREFIX} ${reviewer} -->"
detail_marker="${DETAIL_PREFIX} ${detail} -->"

case "$reviewer:$detail" in
  codex-plugin-cc:base-main)
    visible="Codex review of head ${short_sha} — branch diff vs main — ${summary}"
    ;;
  claude-code:trivial)
    visible="Claude review of head ${short_sha} — trivial change, no /code-review run — ${summary}"
    ;;
  claude-code:*)
    visible="Claude review of head ${short_sha} — \`/code-review ${detail}\` — ${summary}"
    ;;
esac

full_body="${marker}"$'\n'"${reviewer_marker}"$'\n'"${detail_marker}"$'\n'"${visible}"

# Rewrite a single existing marker, including the legacy form, rather than adding a
# second sticky comment. Slurping handles comments beyond GitHub's first API page.
existing_id=$(gh api --paginate "repos/${repo}/issues/${pr}/comments" \
  | jq -rs --arg prefix "$MARKER_PREFIX" --arg legacy "$LEGACY_MARKER_PREFIX" \
      '[.[] | flatten | .[] | select((.body // "") | startswith($prefix) or startswith($legacy))] | last.id // empty')

if [[ -n "$existing_id" ]]; then
  echo "Updating ${reviewer} review marker (id=${existing_id}) on PR #${pr} → head ${short_sha}"
  gh api --method PATCH "repos/${repo}/issues/comments/${existing_id}" -f body="$full_body" --jq '.html_url'
else
  echo "Posting ${reviewer} review marker on PR #${pr} → head ${short_sha}"
  gh api --method POST "repos/${repo}/issues/${pr}/comments" -f body="$full_body" --jq '.html_url'
fi
