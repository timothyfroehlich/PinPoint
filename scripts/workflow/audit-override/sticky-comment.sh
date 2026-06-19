#!/usr/bin/env bash
set -euo pipefail

# Sticky PR comment helper for the `/audit-override` control surface.
#
# A single bot comment per PR, keyed by an HTML marker, is the human-readable
# audit trail (who/when/why) for an active or cleared override. This script
# finds that comment and either creates it (if absent) or edits it in place
# (upsert), so there is never more than one.
#
# Deliberately a sibling of scripts/workflow/preview/sticky-comment.sh rather
# than a shared helper: at two call sites the Rule of Three (CORE-ARCH-010) says
# don't abstract yet, and the markers must differ so the two sticky comments
# never collide on a PR that has both a preview and an override.
#
# Usage:
#   sticky-comment.sh upsert <pr-number> <body-file>   ('-' for stdin)
#   sticky-comment.sh find   <pr-number>
#
# Environment:
#   GH_TOKEN          required by `gh`
#   GITHUB_REPOSITORY owner/repo (defaults to timothyfroehlich/PinPoint)

MARKER="<!-- pinpoint-audit-override-status -->"
REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"

find_sticky_id() {
  local pr="$1"
  gh api \
    --paginate \
    "repos/${REPO}/issues/${pr}/comments" \
    --jq "map(select(.body | startswith(\"${MARKER}\"))) | .[0].id // empty"
}

find_sticky_body() {
  local pr="$1"
  gh api \
    --paginate \
    "repos/${REPO}/issues/${pr}/comments" \
    --jq "map(select(.body | startswith(\"${MARKER}\"))) | .[0].body // empty"
}

cmd="${1:-}"
pr="${2:-}"

if [[ -z "$cmd" || -z "$pr" ]]; then
  echo "usage: sticky-comment.sh <upsert|find> <pr-number> [body-file]" >&2
  exit 2
fi

case "$cmd" in
  find)
    find_sticky_body "$pr"
    ;;

  upsert)
    body_file="${3:-}"
    if [[ -z "$body_file" ]]; then
      echo "upsert requires a body file (use '-' for stdin)" >&2
      exit 2
    fi

    if [[ "$body_file" == "-" ]]; then
      body_content="$(cat)"
    else
      body_content="$(cat "$body_file")"
    fi

    # Prepend the marker so the body always starts with it.
    full_body="${MARKER}"$'\n'"${body_content}"

    existing_id="$(find_sticky_id "$pr")"

    if [[ -n "$existing_id" ]]; then
      echo "Editing existing sticky comment (id=${existing_id}) on PR #${pr}"
      gh api \
        --method PATCH \
        "repos/${REPO}/issues/comments/${existing_id}" \
        -f body="$full_body" \
        --jq '.html_url'
    else
      echo "Creating sticky comment on PR #${pr}"
      gh api \
        --method POST \
        "repos/${REPO}/issues/${pr}/comments" \
        -f body="$full_body" \
        --jq '.html_url'
    fi
    ;;

  *)
    echo "unknown command: $cmd" >&2
    exit 2
    ;;
esac
